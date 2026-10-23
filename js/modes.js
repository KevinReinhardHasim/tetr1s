// The three modes. Each owns its Game(s), turns engine events into score, damage or attacks,
// and draws its own screen in a landscape (720x450) or portrait (360x600) layout.
(function (TR) {
  'use strict';
  const R = TR.Rules, T = TR.text, fd = TR.fd, fm = TR.fm;
  const LAND = {w: 720, h: 450}, PORT = {w: 360, h: 600};

  function makeStars(n, w, h, seed) { const r = TR.rng(seed); return Array.from({length: n}, () => [r() * w, r() * h, r() * 1.3 + .4, r() * 6]); }
  function drawStars(x, list, t) {
    list.forEach(s => { x.globalAlpha = .22 + .18 * Math.sin(t * 1.3 + s[3]); x.fillStyle = '#9FB2FF'; x.beginPath(); x.arc(s[0], s[1], s[2], 0, 7); x.fill(); });
    x.globalAlpha = 1;
  }

  class Mode {
    constructor(app) { this.app = app; this.fx = new TR.Fx(); this.t = 0; this.hardJust = false; this.holdRect = null; this.done = false; this.endT = 0; this.result = null; this.shown = false; }
    size(port) { return port ? PORT : LAND; }
    sound(e, d) {
      const S = TR.Sfx;
      if (e === 'move') S.play('move');
      else if (e === 'rotate') S.play('rotate');
      else if (e === 'hold') S.play('hold');
      else if (e === 'holdDenied') S.play('deny');
      else if (e === 'harddrop') { S.play('hard'); this.hardJust = true; }
      else if (e === 'lock') { if (!this.hardJust) S.play('lock'); this.hardJust = false; }
      else if (e === 'flipStart') S.play('flipwarn');
      else if (e === 'flip') S.play('flip');
      else if (e === 'garbage') S.play('garbage');
      else if (e === 'clear' || e === 'flipClear') {
        if (d.lines >= 4) S.play('quad'); else if (d.tspin) S.play('tspin'); else if (d.lines) S.play('clear', d.lines);
      }
    }
    popClear(i, cx, cy, color) {
      let y = cy; const lab = R.label(i);
      if (lab) { this.fx.pop(lab, cx, y, color || '#FFFFFF', i.lines >= 4 || i.tspin || i.flip ? 17 : 14); y += 24; }
      if (i.b2b && i.lines) { this.fx.pop('BACK-TO-BACK', cx, y, '#FFD166', 11, {mono: true}); y += 20; }
      if (i.combo > 0 && i.lines) { this.fx.pop('COMBO ' + i.combo, cx, y, '#5EE0A0', 11, {mono: true}); y += 20; }
      if (i.perfect) this.fx.pop('PERFECT CLEAR', cx, y, '#FFD166', 15, {life: 1.6});
    }
    // Shows the result card a moment after the run ends, so the last clear can be seen.
    endUpdate(dt) {
      if (this.done && this.result && !this.shown) { this.endT += dt; if (this.endT > .9) { this.shown = true; this.app.showResult(this.result); } }
    }
    keyHint(x, X, Y, color, binds) {
      const k = a => TR.keyLabel((binds[a] || [])[0]);
      T(x, k('left') + ' ' + k('right') + ' move · ' + k('soft') + ' soft · ' + k('hard') + ' drop', X, Y, fm(10), color);
      T(x, k('cw') + ' ' + k('ccw') + ' rotate · ' + k('hold') + ' hold · Esc pause', X, Y + 16, fm(10), color);
    }
  }

  /* ===================== FLIP ===================== */
  class FlipMode extends Mode {
    constructor(app, sub) {
      super(app);
      this.kind = 'flip'; this.sub = sub;
      this.title = {marathon: 'MARATHON', sprint: 'SPRINT 40', daily: 'DAILY ' + TR.today()}[sub];
      this.g = new TR.Game({seed: sub === 'daily' ? TR.todaySeed() : TR.randSeed(), onEvent: (e, d) => this.onEvent(e, d)});
      this.every = 7; this.left = 7; this.lastBonus = 0; this.flips = 0; this.quads = 0; this.tspins = 0; this.maxCombo = 0;
      this.best = app.best(sub);
      this.ctrl = new TR.Controller(app.binds('solo'), app.settings, null);
      this.stars = makeStars(70, 720, 600, 11);
      this.bc = {x: 360, y: 190};
    }
    start() { this.g.start(); }
    update(dt, codes) {
      this.t += dt; this.fx.update(dt); this.endUpdate(dt);
      if (this.done) return;
      this.ctrl.update(dt, this.g, codes);
      this.g.update(dt);
      if (this.sub === 'daily' && this.g.time >= 180) this.finish(true);
    }
    onEvent(e, d) {
      const g = this.g;
      this.sound(e, d);
      if (e === 'softdrop') g.score += d.cells;
      else if (e === 'harddrop') g.score += 2 * d.cells;
      else if (e === 'clear' || e === 'flipClear') {
        const i = R.info(d, e === 'flipClear');
        g.score += R.score(i, g.level);
        if (i.flip) this.lastBonus = i.lines;
        if (i.lines === 4 && !i.flip) this.quads++;
        if (i.tspin) this.tspins++;
        this.maxCombo = Math.max(this.maxCombo, i.combo);
        this.popClear(i, this.bc.x, this.bc.y, i.flip ? '#FFD166' : '#FFFFFF');
        if (this.sub !== 'sprint') {
          const lv = Math.min(15, 1 + Math.floor(g.lines / 10));
          if (lv > g.level) { g.level = lv; this.fx.pop('LEVEL ' + lv, this.bc.x, this.bc.y + 90, '#5EE0A0', 15); TR.Sfx.play('level'); }
        }
      } else if (e === 'afterLock') {
        if (this.checkGoal()) return;
        this.left--;
        if (this.left <= 0) g.flipQueued = true;
      } else if (e === 'flipStart') { this.flips++; this.lastBonus = 0; }
      else if (e === 'flipEnd') {
        this.left = this.every;
        if (!this.lastBonus) this.fx.pop('FLIPPED', this.bc.x, this.bc.y, '#E6ECFF', 14);
        this.checkGoal();
      } else if (e === 'topout') this.finish(false);
    }
    checkGoal() {
      const goal = this.sub === 'sprint' ? 40 : this.sub === 'marathon' ? 150 : 0;
      if (goal && this.g.lines >= goal) { this.finish(true); return true; }
      return false;
    }
    finish(win) {
      if (this.done) return;
      const g = this.g, sub = this.sub;
      this.done = true; g.halted = true; g.paused = true;
      TR.Sfx.play(win ? 'win' : 'over');
      let title, isBest = false, headline;
      if (sub === 'sprint') {
        title = win ? 'Sprint complete' : 'Game over';
        headline = win ? TR.fmtTime(g.time) : g.lines + ' / 40 lines';
        if (win) isBest = this.app.saveBest('sprint', g.time, (a, b) => a < b);
      } else {
        title = sub === 'daily' ? (win ? "Time's up" : 'Game over') : (win ? 'Marathon complete' : 'Game over');
        headline = TR.fmtNum(g.score);
        isBest = this.app.saveBest(sub, g.score, (a, b) => a > b);
      }
      this.result = {title, headline, isBest, stats: [
        ['Score', TR.fmtNum(g.score)], ['Lines', g.lines], ['Level', g.level], ['Board flips', this.flips],
        ['Quads', this.quads], ['T-spins', this.tspins], ['Best combo', this.maxCombo], ['Time', TR.fmtTime(g.time)]
      ]};
    }
    statValue(k) {
      const g = this.g;
      if (k === 'time') return this.sub === 'daily' ? TR.fmtClock(180 - g.time) : TR.fmtTime(g.time);
      if (k === 'lines') return this.sub === 'sprint' ? g.lines + '/40' : this.sub === 'marathon' ? g.lines + '/150' : String(g.lines);
      if (k === 'best') { const b = this.best; return b == null ? '—' : this.sub === 'sprint' ? TR.fmtTime(b) : TR.fmtNum(b); }
      return '';
    }
    dial(x, cx, cy, R0, pal) {
      const ph = this.g.phase, done = this.every - Math.max(0, this.left), warn = ph === 'flipWarn' || ph === 'flip' || ph === 'cascade' || (ph === 'clear' && this.g.clearFromFlip);
      for (let i = 0; i < this.every; i++) {
        const a0 = -Math.PI / 2 + i * 2 * Math.PI / this.every + .08, a1 = a0 + 2 * Math.PI / this.every - .16;
        x.beginPath(); x.arc(cx, cy, R0, a0, a1); x.strokeStyle = warn || i < done ? pal.gold : '#24305E'; x.lineWidth = 7; x.stroke();
      }
      T(x, warn ? '!' : String(Math.max(0, this.left)), cx, cy + 9, fd(24), warn ? pal.gold : pal.text, 'center');
    }
    draw(x, port) {
      const g = this.g, pal = TR.PAL.flip, S = this.size(port);
      x.fillStyle = pal.bg; x.fillRect(0, 0, S.w, S.h);
      drawStars(x, this.stars, this.t);
      if (port) {
        this.bc = {x: 121, y: 300};
        T(x, 'FLIP', 16, 32, fd(18), pal.text); T(x, this.title, 72, 31, fm(10, 600), pal.muted);
        T(x, 'SCORE', 16, 62, fm(9, 600), pal.muted); T(x, TR.fmtNum(g.score), 16, 86, fm(22, 600), pal.text);
        [['LINES', this.statValue('lines'), 16], ['LEVEL', String(g.level), 106], ['TIME', this.statValue('time'), 172]].forEach(([l, v, X]) => {
          T(x, l, X, 114, fm(9, 600), pal.muted); T(x, v, X, 134, fm(14, 600), pal.text);
        });
        this.dial(x, 300, 74, 32, pal); T(x, 'until flip', 300, 128, fm(9), pal.soft, 'center');
        TR.drawBoard(x, g, {x0: 16, y0: 152, cs: 21, pal, style: 'flip'});
        TR.drawNext(x, g, 240, 146, 108, 244, 5, 10, 40, 'flip', pal);
        this.holdRect = {x: 240, y: 400, w: 108, h: 86};
        TR.drawHold(x, g, 240, 400, 108, 86, 13, 'flip', pal, 'HOLD · TAP');
        T(x, 'BEST', 244, 516, fm(9, 600), pal.muted); T(x, this.statValue('best'), 244, 536, fm(13, 600), pal.text);
        T(x, 'LAST FLIP', 244, 562, fm(9, 600), pal.muted); T(x, '+' + this.lastBonus + ' lines', 244, 580, fm(12, 600), pal.gold);
      } else {
        this.bc = {x: 360, y: 190};
        TR.drawBoard(x, g, {x0: 265, y0: 35, cs: 19, pal, style: 'flip'});
        T(x, 'FLIP', 36, 62, fd(30), pal.text); T(x, this.title, 37, 82, fm(10, 600), pal.muted);
        this.holdRect = {x: 36, y: 100, w: 120, h: 86};
        TR.drawHold(x, g, 36, 100, 120, 86, 14, 'flip', pal);
        T(x, 'SCORE', 36, 216, fm(10, 600), pal.muted); T(x, TR.fmtNum(g.score), 36, 244, fm(24, 600), pal.text);
        T(x, 'LINES', 36, 278, fm(10, 600), pal.muted); T(x, this.statValue('lines'), 36, 302, fm(18, 600), pal.text);
        T(x, 'LEVEL', 150, 278, fm(10, 600), pal.muted); T(x, String(g.level), 150, 302, fm(18, 600), pal.text);
        T(x, this.sub === 'daily' ? 'TIME LEFT' : 'TIME', 36, 336, fm(10, 600), pal.muted); T(x, this.statValue('time'), 36, 360, fm(18, 600), pal.text);
        T(x, 'BEST', 36, 394, fm(10, 600), pal.muted); T(x, this.statValue('best'), 36, 418, fm(15, 600), pal.soft);
        TR.drawNext(x, g, 476, 35, 104, 262, 5, 12, 46, 'flip', pal);
        this.dial(x, 640, 92, 36, pal);
        T(x, 'pieces until', 640, 150, fm(11), pal.soft, 'center'); T(x, 'the board flips', 640, 165, fm(11), pal.soft, 'center');
        T(x, 'BLOCK SIDES', 600, 204, fm(10, 600), pal.muted);
        TR.cellFlip(x, 600, 214, 18, '#46D7E8', false); T(x, 'front', 625, 228, fm(11), pal.soft);
        TR.cellFlip(x, 600, 240, 18, '#46D7E8', true); T(x, 'back', 625, 254, fm(11), pal.soft);
        T(x, 'LAST FLIP', 600, 288, fm(10, 600), pal.muted); T(x, '+' + this.lastBonus + ' lines', 600, 308, fm(14, 600), pal.gold);
        this.keyHint(x, 476, 404, pal.muted, this.app.binds('solo'));
        if (g.phase === 'flipWarn') T(x, 'FLIP!', 360, 24, fd(13), pal.gold, 'center');
      }
      this.fx.draw(x);
    }
  }

  /* ===================== DUNGEON ===================== */
  class DungeonMode extends Mode {
    constructor(app) {
      super(app);
      this.kind = 'dungeon'; this.floor = 1; this.relics = []; this.dealt = 0; this.fightTime = 0; this.lines = 0;
      this.bc = {x: 119, y: 190}; this.port = false;
      this.ctrl = new TR.Controller(app.binds('solo'), app.settings, null);
      this.bestFloor = app.best('dungeon');
      this.startFloor();
    }
    has(id) { return this.relics.indexOf(id) >= 0; }
    startFloor() {
      const M = R.MONSTERS[this.floor - 1];
      this.mon = {def: M, hp: M.hp, hpShow: M.hp, timer: M.every, idx: 0, flash: 0, shake: 0, atk: 0, dead: 0};
      this.g = new TR.Game({seed: TR.randSeed(), preview: this.has('lontar') ? 5 : 3, onEvent: (e, d) => this.onEvent(e, d)});
      this.g.level = 1 + Math.floor(this.floor * .7);
      this.g.runeChance = this.has('akik') ? .45 : .3;
      this.pend = {thunder: 0, leaf: 0};
      this.killed = false; this.red = 0;
      this.state = 'intro'; this.st = 0;
    }
    start() { }
    update(dt, codes) {
      this.t += dt; this.st += dt; this.fx.update(dt); this.endUpdate(dt);
      const m = this.mon;
      m.flash = Math.max(0, m.flash - dt); m.shake = Math.max(0, m.shake - dt); m.atk = Math.max(0, m.atk - dt); this.red = Math.max(0, this.red - dt * 1.6);
      if (m.dead > 0) m.dead = Math.max(0, m.dead - dt);
      m.hpShow += (m.hp - m.hpShow) * Math.min(1, dt * 3);
      if (this.state === 'intro') { if (this.st >= 1.6) { this.state = 'fight'; this.g.start(); } return; }
      if (this.state === 'fight') { this.fightTime += dt; this.ctrl.update(dt, this.g, codes); this.g.update(dt); return; }
      if (this.state === 'dying' && this.st >= 1.4) {
        if (this.floor >= 10) this.finish(true);
        else { this.state = 'choose'; this.offerRelics(); }
      }
    }
    onEvent(e, d) {
      const g = this.g, m = this.mon;
      this.sound(e, d);
      if (e === 'clear' || e === 'flipClear') {
        const i = R.info(d, e === 'flipClear');
        this.lines += i.lines;
        const dmg = R.damage(i, this.relics);
        this.popClear(i, this.bc.x, this.bc.y, '#FFE2B0');
        if (dmg > 0) {
          m.hp = Math.max(0, m.hp - dmg); this.dealt += dmg;
          if (m.hp <= 0) this.killed = true;
          const row = d.rows && d.rows.length ? d.rows[0] - TR.HID : 10;
          const from = this.boardPoint(row), to = this.monPoint();
          this.fx.shot(from.x, from.y, to.x, to.y, i.fire ? TR.RUNE_COLOR.fire : '#FFE2B0', () => {
            m.flash = .25; m.shake = .3; TR.Sfx.play('hit');
            this.fx.pop('-' + dmg, to.x + (Math.random() - .5) * 40, to.y - 50, '#FFD1A8', 20);
          });
        }
        let oy = 0; const say = (s, c) => { this.fx.pop(s, this.bc.x, this.bc.y + 60 + oy, c, 11, {mono: true, life: 1.5}); oy += 18; };
        if (i.fire) say('Fire +' + i.fire * 15, TR.RUNE_COLOR.fire);
        if (i.thunder) { this.pend.thunder += i.thunder; say('Thunder: column cleared', TR.RUNE_COLOR.thunder); }
        if (i.ice) { m.timer += i.ice * (this.has('jimat') ? 4 : 2); say('Ice: attack delayed', TR.RUNE_COLOR.ice); }
        if (i.leaf) { this.pend.leaf += i.leaf * (this.has('kendi') ? 2 : 1); say('Leaf: garbage removed', TR.RUNE_COLOR.leaf); }
      } else if (e === 'afterLock' || e === 'flipEnd') {
        this.applyPending();
        if (this.killed) { this.kill(); return; }
        if (e === 'afterLock') { m.timer--; if (m.timer <= 0) this.attack(); }
      } else if (e === 'topout') this.finish(false);
    }
    applyPending() {
      const g = this.g;
      for (; this.pend.thunder > 0; this.pend.thunder--) g.clearColumn(g.tallestColumn());
      for (; this.pend.leaf > 0; this.pend.leaf--) g.removeGarbageRow();
    }
    kill() {
      this.g.halted = true; this.state = 'dying'; this.st = 0; this.mon.dead = 1.2;
      TR.Sfx.play('win');
      this.fx.pop(this.mon.def.name.toUpperCase() + ' DEFEATED', this.monPoint().x, this.monPoint().y - 70, '#FFC46B', 15, {life: 1.6});
    }
    attack() {
      const g = this.g, m = this.mon, M = m.def, it = M.intents[m.idx % M.intents.length];
      m.idx++; m.timer = M.every; m.atk = .8; TR.Sfx.play('attack');
      const p = this.monPoint();
      if (it.k === 'garbage') {
        const n = Math.max(0, it.n - (this.has('batik') ? 1 : 0));
        if (n) { g.addGarbage(n, Math.floor(g.aux() * TR.COLS)); this.red = .6; this.fx.pop('+' + n + ' garbage', this.bc.x, this.bc.y + 150, '#FF9A8A', 13, {mono: true}); }
        else this.fx.pop('Batik blocked it', p.x, p.y - 70, '#FFC46B', 12, {mono: true});
      } else if (it.k === 'lock') { g.holdLocked = it.n; this.fx.pop('HOLD locked', this.bc.x, this.bc.y + 150, '#FF9A8A', 13, {mono: true}); }
      else if (it.k === 'fog') { g.fog = it.n; this.fx.pop('NEXT hidden', this.bc.x, this.bc.y + 150, '#FF9A8A', 13, {mono: true}); }
      else { g.flipQueued = true; this.fx.pop('Your board flips!', this.bc.x, this.bc.y + 150, '#FFC46B', 13, {mono: true}); }
    }
    offerRelics() {
      const pool = R.RELICS.filter(r => !this.has(r.id)), pick = [];
      while (pool.length && pick.length < 3) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      const next = () => { this.floor++; this.startFloor(); };
      if (!pick.length) { next(); return; }
      this.app.showChoice({
        title: 'Floor ' + this.floor + ' cleared', sub: 'Choose 1 relic for the rest of this run.', options: pick,
        onPick: r => { this.relics.push(r.id); TR.Sfx.play('select'); next(); }
      });
    }
    finish(win) {
      if (this.done) return;
      this.done = true; this.g.halted = true; this.g.paused = true; this.state = 'over';
      if (!win) TR.Sfx.play('over');
      const reached = win ? 11 : this.floor;
      const isBest = this.app.saveBest('dungeon', reached, (a, b) => a > b);
      this.result = {title: win ? 'Dungeon cleared' : 'Run over', headline: win ? 'All 10 floors' : 'Floor ' + this.floor + ' · ' + this.mon.def.name, isBest, stats: [
        ['Floor reached', win ? '10 / 10' : this.floor + ' / 10'], ['Damage dealt', TR.fmtNum(this.dealt)], ['Lines', this.lines],
        ['Relics', this.relics.length ? this.relics.map(id => R.RELICS.find(r => r.id === id).name).join(', ') : 'None'], ['Time', TR.fmtTime(this.fightTime)]
      ]};
    }
    boardPoint(row) { return this.port ? {x: 121, y: 152 + row * 21} : {x: 119, y: 40 + row * 19}; }
    monPoint() { return this.port ? {x: 92, y: 92} : {x: 480, y: 180}; }
    intentBox(x, X, Y, w, h, pal, big) {
      const m = this.mon, M = m.def, it = M.intents[m.idx % M.intents.length], urgent = m.timer <= 1;
      TR.rr(x, X, Y, w, h, 8); x.fillStyle = '#2E211A'; x.fill(); x.strokeStyle = urgent ? '#FF8A5B' : '#6B4D38'; x.lineWidth = 1.5; x.stroke();
      T(x, 'ATTACK IN', X + 10, Y + 16, fm(9, 600), pal.muted);
      T(x, String(Math.max(0, m.timer)), X + 10, Y + h - 12, fd(big ? 22 : 18), '#FF8A5B');
      T(x, m.timer === 1 ? 'piece' : 'pieces', X + (big ? 30 : 28), Y + h - 26, fm(9), pal.muted);
      T(x, R.intentText(it), X + (big ? 30 : 28), Y + h - 12, fm(10, 600), pal.text);
    }
    hpBar(x, X, Y, w, pal) {
      const m = this.mon;
      TR.rr(x, X, Y, w, 9, 4.5); x.fillStyle = '#3A2420'; x.fill();
      const wg = w * Math.max(0, m.hpShow) / m.def.hp, wh = w * m.hp / m.def.hp;
      if (wg > 1) { TR.rr(x, X, Y, wg, 9, 4.5); x.fillStyle = '#F2B6A0'; x.fill(); }
      if (wh > 1) { TR.rr(x, X, Y, wh, 9, 4.5); x.fillStyle = '#D9453B'; x.fill(); }
    }
    torch(x, X, Y) {
      x.fillStyle = '#4A3526'; x.fillRect(X - 3, Y, 6, 34);
      const f = 1 + .15 * Math.sin(this.t * 13 + X) + .1 * Math.sin(this.t * 7.3 + X);
      x.fillStyle = '#FF8A3D'; x.beginPath(); x.ellipse(X, Y - 8 * f, 7, 12 * f, 0, 0, 7); x.fill();
      x.fillStyle = '#FFD86B'; x.beginPath(); x.ellipse(X, Y - 5 * f, 3.5, 6 * f, 0, 0, 7); x.fill();
    }
    floorDots(x, X, Y, pal) {
      for (let i = 1; i <= 10; i++) {
        const dx = X + (i - 1) * 9.4; x.fillStyle = i < this.floor ? '#8A6A4E' : i === this.floor ? pal.gold : '#3A2C22'; x.beginPath();
        if (R.MONSTERS[i - 1].boss) { x.moveTo(dx, Y - 5); x.lineTo(dx + 4, Y); x.lineTo(dx, Y + 5); x.lineTo(dx - 4, Y); x.closePath(); } else x.arc(dx, Y, 3, 0, 7);
        x.fill();
      }
    }
    draw(x, port) {
      const g = this.g, pal = TR.PAL.dungeon, S = this.size(port), M = this.mon.def, n = g.o.preview;
      this.port = port;
      x.fillStyle = pal.bg; x.fillRect(0, 0, S.w, S.h);
      const runes = [['fire', 'Fire +dmg'], ['ice', 'Ice delay'], ['thunder', 'Thunder col'], ['leaf', 'Leaf -row']];
      if (port) {
        this.bc = {x: 121, y: 300};
        x.save(); TR.rr(x, 12, 8, 336, 136, 12); x.fillStyle = pal.panel; x.fill(); x.clip();
        x.fillStyle = '#2A1E17'; x.beginPath(); x.arc(92, 146, 84, Math.PI, 0); x.fill();
        x.fillStyle = '#1A120E'; x.fillRect(12, 124, 336, 22);
        TR.drawMonster(x, M.id, 92, 82, M.boss ? .5 : .44, this.t, this.mon);
        x.restore();
        T(x, M.name, 178, 30, fd(12), pal.text); T(x, Math.ceil(this.mon.hp) + '/' + M.hp, 340, 30, fm(10, 600), pal.muted, 'right');
        this.hpBar(x, 178, 38, 162, pal);
        this.intentBox(x, 178, 56, 162, 56, pal, false);
        T(x, 'FLOOR ' + this.floor + '/10', 178, 132, fm(10, 600), M.boss ? pal.gold : pal.text); this.floorDots(x, 262, 128, pal);
        TR.drawBoard(x, g, {x0: 16, y0: 152, cs: 21, pal, style: 'stone', red: this.red});
        const nh = 34 + n * 38;
        TR.drawNext(x, g, 240, 146, 108, nh, n, 10, 38, 'stone', pal);
        this.holdRect = {x: 240, y: 146 + nh + 8, w: 108, h: 78};
        TR.drawHold(x, g, 240, 146 + nh + 8, 108, 78, 12, 'stone', pal, 'HOLD · TAP');
        let y = 146 + nh + 102;
        runes.forEach(([k, s], i) => { const X = 250, Y = y + i * 20; x.fillStyle = '#241A14'; x.beginPath(); x.arc(X, Y - 4, 8, 0, 7); x.fill(); TR.runeIcon(x, k, X, Y - 4, 11); T(x, s, X + 13, Y, fm(9), pal.text); });
        y += 92;
        T(x, 'RELICS', 244, y, fm(9, 600), pal.muted);
        this.relics.forEach((id, i) => TR.relicIcon(x, id, 256 + (i % 4) * 26, y + 18 + Math.floor(i / 4) * 26, 18, pal.gold));
      } else {
        this.bc = {x: 119, y: 190};
        T(x, 'FLOOR ' + this.floor + '/10', 24, 26, fm(11, 600), M.boss ? pal.gold : pal.text); this.floorDots(x, 130, 22, pal);
        TR.drawBoard(x, g, {x0: 24, y0: 40, cs: 19, pal, style: 'stone', red: this.red});
        const nh = 34 + n * 42;
        TR.drawNext(x, g, 226, 40, 66, nh, n, 10, 42, 'stone', pal);
        this.holdRect = {x: 226, y: 40 + nh + 10, w: 66, h: 70};
        TR.drawHold(x, g, 226, 40 + nh + 10, 66, 70, 10, 'stone', pal);
        T(x, 'DAMAGE', 226, 380, fm(9, 600), pal.muted); T(x, TR.fmtNum(this.dealt), 226, 396, fm(12, 600), pal.text);
        T(x, 'TIME', 226, 414, fm(9, 600), pal.muted); T(x, TR.fmtClock(this.fightTime), 226, 430, fm(12, 600), pal.text);
        x.save(); TR.rr(x, 304, 24, 392, 276, 12); x.fillStyle = pal.panel; x.fill(); x.clip();
        x.fillStyle = '#2A1E17'; x.beginPath(); x.arc(490, 300, 172, Math.PI, 0); x.fill();
        x.fillStyle = '#1A120E'; x.fillRect(304, 262, 392, 40); x.fillStyle = '#3A2A20'; x.fillRect(304, 262, 392, 2);
        this.torch(x, 334, 196); this.torch(x, 668, 196);
        TR.drawMonster(x, M.id, 480, 192, M.boss ? 1.1 : 1, this.t, this.mon);
        x.restore();
        T(x, M.name + (M.boss ? '  · BOSS' : ''), 320, 50, fd(13), M.boss ? pal.gold : pal.text);
        T(x, 'HP ' + Math.ceil(this.mon.hp) + ' / ' + M.hp, 684, 50, fm(11, 600), pal.muted, 'right');
        this.hpBar(x, 320, 58, 364, pal);
        this.intentBox(x, 572, 84, 116, 70, pal, true);
        T(x, 'RELICS', 304, 326, fm(10, 600), pal.muted);
        if (!this.relics.length) T(x, 'None yet. Beat a floor to choose one.', 304, 352, fm(11), pal.muted);
        this.relics.forEach((id, i) => { const X = 304 + i * 42; TR.rr(x, X, 334, 36, 36, 7); x.fillStyle = '#241A14'; x.fill(); x.strokeStyle = pal.stroke; x.lineWidth = 1; x.stroke(); TR.relicIcon(x, id, X + 18, 352, 22, pal.gold); });
        T(x, 'RUNES', 304, 398, fm(10, 600), pal.muted);
        runes.forEach(([k, s], i) => { const X = 314 + i * 98; x.fillStyle = '#241A14'; x.beginPath(); x.arc(X, 414, 9, 0, 7); x.fill(); TR.runeIcon(x, k, X, 414, 12); T(x, s, X + 14, 418, fm(10), pal.text); });
        if (!TR.isTouch) this.keyHintShort(x, pal);
      }
      this.fx.draw(x);
      if (this.state === 'intro') {
        const k = Math.min(1, this.st / .25) * (this.st > 1.3 ? Math.max(0, 1 - (this.st - 1.3) / .3) : 1);
        x.globalAlpha = k; x.fillStyle = 'rgba(14,9,7,.82)'; x.fillRect(0, 0, S.w, S.h);
        T(x, 'FLOOR ' + this.floor, S.w / 2, S.h / 2 - 24, fd(port ? 26 : 30), pal.gold, 'center');
        T(x, M.name + (M.boss ? ' · BOSS' : ''), S.w / 2, S.h / 2 + 10, fd(port ? 15 : 17), pal.text, 'center');
        T(x, 'Attacks every ' + M.every + ' pieces', S.w / 2, S.h / 2 + 38, fm(12), pal.muted, 'center');
        x.globalAlpha = 1;
      }
    }
    keyHintShort(x, pal) { T(x, 'Esc pause', 696, 440, fm(10), pal.muted, 'right'); }
  }

  /* ===================== VERSUS ===================== */
  class VersusMode extends Mode {
    constructor(app) {
      super(app);
      this.kind = 'versus'; this.wins = [0, 0]; this.round = 1; this.speedT = 0; this.totals = {sent: [0, 0], lines: [0, 0]};
      this.newRound();
    }
    newRound() {
      const seed = TR.randSeed();
      this.P = [0, 1].map(i => {
        const pl = {i, pending: [], charge: 0, pend: {thunder: 0, leaf: 0}, red: 0, acc: i ? TR.PAL.versus.p2 : TR.PAL.versus.p1, x0: i ? 472 : 78, y0: 48, cs: 17, sent: 0, lines: 0};
        pl.g = new TR.Game({seed, preview: 3, onEvent: (e, d) => this.onEvent(pl, e, d)});
        pl.g.runeChance = .2;
        pl.ctrl = new TR.Controller(this.app.binds(i ? 'p2' : 'p1'), this.app.settings, a => this.action(pl, a));
        return pl;
      });
      this.state = 'count'; this.st = 0; this.beeped = 0; this.speedT = 0;
    }
    start() { }
    update(dt, codes) {
      this.t += dt; this.st += dt; this.fx.update(dt); this.endUpdate(dt);
      if (this.state === 'count') {
        const n = Math.floor(this.st);
        if (n >= this.beeped && n < 3) { TR.Sfx.play('beep'); this.beeped = n + 1; }
        if (this.st >= 3) { TR.Sfx.play('go'); this.state = 'play'; this.st = 0; this.P.forEach(pl => pl.g.start()); }
        return;
      }
      if (this.state === 'play') {
        this.speedT += dt;
        const lv = Math.min(12, 1 + Math.floor(this.speedT / 30));
        this.P.forEach(pl => {
          if (pl.g.level !== lv) { pl.g.level = lv; if (pl.i === 0) this.fx.pop('SPEED UP', 360, 300, '#FFD166', 13); }
          pl.red = Math.max(0, pl.red - dt * 1.8);
          pl.ctrl.update(dt, pl.g, codes); pl.g.update(dt);
        });
        return;
      }
      if (this.state === 'round' && this.st >= 2.6) {
        if (this.match) this.finishMatch(); else { this.round++; this.newRound(); }
      }
    }
    action(pl, a) {
      if (a !== 'flip' || this.state !== 'play') return;
      if (pl.charge >= 8 && pl.g.requestFlipNow()) { pl.charge = 0; this.fx.pop('FLIP!', pl.x0 + 85, 40, TR.PAL.versus.gold, 14); }
      else TR.Sfx.play('deny');
    }
    onEvent(pl, e, d) {
      const g = pl.g;
      this.sound(e, d);
      if (e === 'clear' || e === 'flipClear') {
        const i = R.info(d, e === 'flipClear'), cx = pl.x0 + 85;
        pl.lines += i.lines;
        let atk = R.attack(i);
        if (!i.flip) pl.charge = Math.min(8, pl.charge + i.lines);
        this.popClear(i, cx, 150, pl.acc);
        let oy = 0; const say = (s, c) => { this.fx.pop(s, cx, 230 + oy, c, 11, {mono: true, life: 1.4}); oy += 18; };
        if (i.fire) say('Fire +' + i.fire, TR.RUNE_COLOR.fire);
        if (i.ice) { let k = 2 * i.ice; while (k > 0 && pl.pending.length) { const take = Math.min(k, pl.pending[0].n); pl.pending[0].n -= take; k -= take; if (!pl.pending[0].n) pl.pending.shift(); } say('Ice: blocked 2', TR.RUNE_COLOR.ice); }
        if (i.thunder) { pl.pend.thunder += i.thunder; say('Thunder: column cleared', TR.RUNE_COLOR.thunder); }
        if (i.leaf) { pl.pend.leaf += i.leaf; say('Leaf: -1 garbage', TR.RUNE_COLOR.leaf); }
        while (atk > 0 && pl.pending.length) { const take = Math.min(atk, pl.pending[0].n); pl.pending[0].n -= take; atk -= take; if (!pl.pending[0].n) pl.pending.shift(); }
        if (atk > 0) {
          const o = this.P[1 - pl.i], row = d.rows && d.rows.length ? d.rows[0] - TR.HID : 10, amount = atk;
          pl.sent += amount;
          this.fx.shot(cx, pl.y0 + row * pl.cs, o.i ? o.x0 - 9 : o.x0 + 178, o.y0 + 300, '#FF5A5A', () => { o.pending.push({n: amount, gap: Math.floor(Math.random() * TR.COLS)}); });
          this.fx.pop('+' + amount + ' sent', cx, pl.y0 + row * pl.cs - 8, pl.acc, 12, {mono: true});
        }
      } else if (e === 'afterLock' || e === 'flipEnd') {
        for (; pl.pend.thunder > 0; pl.pend.thunder--) g.clearColumn(g.tallestColumn());
        for (; pl.pend.leaf > 0; pl.pend.leaf--) g.removeGarbageRow();
        if (e === 'afterLock' && d.lines === 0 && pl.pending.length) {
          let room = 8;
          while (room > 0 && pl.pending.length && !g.over) {
            const p = pl.pending[0], take = Math.min(room, p.n);
            if (!g.addGarbage(take, p.gap)) break;
            p.n -= take; room -= take; if (!p.n) pl.pending.shift();
          }
          pl.red = .5;
        }
      } else if (e === 'topout') this.endRound(pl);
    }
    endRound(loser) {
      if (this.state !== 'play') return;
      const w = 1 - loser.i;
      this.wins[w]++; this.winner = w; this.match = this.wins[w] >= 2;
      this.state = 'round'; this.st = 0;
      this.P.forEach(pl => { pl.g.paused = true; this.totals.sent[pl.i] += pl.sent; this.totals.lines[pl.i] += pl.lines; });
      TR.Sfx.play(this.match ? 'win' : 'over');
    }
    finishMatch() {
      this.done = true; this.state = 'over';
      const w = this.winner, t = this.totals;
      this.result = {title: 'Player ' + (w + 1) + ' wins', headline: this.wins[0] + ' – ' + this.wins[1], isBest: false, rematch: true, stats: [
        ['Rounds played', this.wins[0] + this.wins[1]], ['Garbage sent (P1 – P2)', t.sent[0] + ' – ' + t.sent[1]], ['Lines cleared (P1 – P2)', t.lines[0] + ' – ' + t.lines[1]]
      ]};
      this.endT = 1;
    }
    drawPlayer(x, pl, pal) {
      const {x0, y0, cs, g} = pl;
      T(x, pl.i ? 'PLAYER 2' : 'PLAYER 1', pl.i ? x0 + 170 : x0, 34, fd(12), pl.acc, pl.i ? 'right' : 'left');
      TR.drawBoard(x, g, {x0, y0, cs, pal, style: 'flip', accent: TR.mix(pl.acc, '#111632', .45), red: pl.red});
      const mx = pl.i ? x0 - 12 : x0 + 175, pend = pl.pending.reduce((s, p) => s + p.n, 0);
      TR.rr(x, mx, y0, 6, 340, 3); x.fillStyle = '#1A2040'; x.fill();
      if (pend > 0) { const h = Math.min(20, pend) * cs; x.fillStyle = '#FF5A5A'; x.fillRect(mx, y0 + 340 - h, 6, h); }
      T(x, 'INCOMING', mx + 3, y0 + 354, fm(8, 600), '#FF8A8A', 'center');
      const hx = pl.i ? 652 : 12;
      TR.drawHold(x, g, hx, 48, 56, 62, 9, 'flip', pal);
      const nx = pl.i ? 404 : 262;
      TR.drawNext(x, g, nx, 48, 54, 156, 3, 9, 40, 'flip', pal);
      const fx = nx + 27, fy = 244, ready = pl.charge >= 8;
      for (let i = 0; i < 8; i++) {
        const a0 = -Math.PI / 2 + i * Math.PI / 4 + .07, a1 = a0 + Math.PI / 4 - .14;
        x.beginPath(); x.arc(fx, fy, 17, a0, a1); x.strokeStyle = i < pl.charge ? (ready ? TR.alpha(pal.gold, .6 + .4 * Math.sin(this.t * 8)) : pal.gold) : '#24305E'; x.lineWidth = 5; x.stroke();
      }
      T(x, pl.charge + '/8', fx, fy + 4, fm(9, 600), pal.text, 'center');
      T(x, ready ? 'FLIP READY' : 'FLIP', fx, fy + 34, fm(ready ? 9 : 10, 600), ready ? pal.gold : pal.muted, 'center');
      if (ready) T(x, 'press ' + TR.keyLabel(this.app.binds(pl.i ? 'p2' : 'p1').flip[0]), fx, fy + 48, fm(9), pal.gold, 'center');
    }
    keys(x, X, Y, items) {
      items.forEach(([caps, label]) => {
        caps.forEach(c => {
          x.font = fm(10, 600); const w = Math.max(18, x.measureText(c).width + 10);
          TR.rr(x, X, Y - 13, w, 18, 4); x.fillStyle = '#1A2040'; x.fill(); x.strokeStyle = '#33406E'; x.lineWidth = 1; x.stroke();
          T(x, c, X + w / 2, Y, fm(10, 600), '#E6ECFF', 'center'); X += w + 3;
        });
        X += 3; T(x, label, X, Y, fm(10), '#A9B4DE'); x.font = fm(10); X += x.measureText(label).width + 12;
      });
    }
    draw(x) {
      const pal = TR.PAL.versus;
      x.fillStyle = pal.bg; x.fillRect(0, 0, 720, 450);
      this.P.forEach(pl => this.drawPlayer(x, pl, pal));
      T(x, 'ROUND ' + this.round, 360, 132, fm(11, 600), pal.soft, 'center');
      T(x, 'VS', 360, 206, fd(30), pal.text, 'center');
      T(x, this.wins[0] + ' – ' + this.wins[1], 360, 246, fd(18), pal.gold, 'center');
      T(x, 'BEST OF 3', 360, 268, fm(10), pal.muted, 'center');
      T(x, 'LEVEL ' + this.P[0].g.level, 360, 296, fm(10), pal.muted, 'center');
      [0, 1].forEach(i => {
        const b = this.app.binds(i ? 'p2' : 'p1'), k = a => TR.keyLabel((b[a] || [])[0]), X = i ? 392 : 12;
        this.keys(x, X, 418, [[[k('left'), k('right')], 'move'], [[k('soft')], 'soft'], [[k('hard')], 'drop']]);
        this.keys(x, X, 440, [[[k('ccw'), k('cw')], 'rotate'], [[k('hold')], 'hold'], [[k('flip')], 'flip']]);
      });
      this.fx.draw(x);
      if (this.state === 'count') {
        x.fillStyle = 'rgba(8,10,22,.55)'; x.fillRect(0, 0, 720, 450);
        const n = 3 - Math.floor(this.st);
        T(x, String(n), 360, 240, fd(64), pal.gold, 'center');
        T(x, 'Round ' + this.round + ' · first to 2 wins', 360, 280, fm(13), pal.text, 'center');
      }
      if (this.state === 'round') {
        x.globalAlpha = Math.min(1, this.st / .3); x.fillStyle = 'rgba(8,10,22,.82)'; x.fillRect(0, 0, 720, 450);
        T(x, 'PLAYER ' + (this.winner + 1) + (this.match ? ' WINS THE MATCH' : ' WINS THE ROUND'), 360, 210, fd(20), this.winner ? pal.p2 : pal.p1, 'center');
        T(x, this.wins[0] + ' – ' + this.wins[1], 360, 248, fd(18), pal.gold, 'center');
        x.globalAlpha = 1;
      }
    }
  }

  TR.FlipMode = FlipMode; TR.DungeonMode = DungeonMode; TR.VersusMode = VersusMode;
})(window.TR);
