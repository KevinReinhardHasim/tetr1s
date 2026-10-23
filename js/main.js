// App shell: screens, settings, overlays, layout and the main loop.
(function (TR) {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const q = new URLSearchParams(location.search);
  const coarse = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  TR.isTouch = q.get('touch') === '1' || (q.get('touch') !== '0' && coarse);

  const DEFAULTS = {das: .167, arr: .033, sdf: 20, vol: .6};
  const clone = o => JSON.parse(JSON.stringify(o));

  const App = TR.App = {
    mode: null, paused: false, scale: 1, port: false, last: 0,

    init() {
      const d = TR.store.load();
      d.settings = Object.assign({}, DEFAULTS, d.settings || {});
      d.binds = Object.assign(clone(TR.DEFAULT_BINDS), d.binds || {});
      d.best = d.best || {};
      if (d.settings.sdf === null) d.settings.sdf = Infinity;
      this.settings = d.settings;
      TR.Sfx.setVol(this.settings.vol);
      TR.Keys.init();
      document.body.classList.toggle('is-touch', TR.isTouch);

      this.canvas = $('#game'); this.ctx = this.canvas.getContext('2d');
      this.logo = $('#logo'); this.lctx = this.logo.getContext('2d');

      $$('[data-go]').forEach(b => b.addEventListener('click', () => this.go(b.dataset.go)));
      $$('[data-flip]').forEach(b => b.addEventListener('click', () => this.startMode('flip', b.dataset.flip)));
      $('#btn-pause').addEventListener('click', () => this.pause());
      if (TR.isTouch) { $('#btn-versus').classList.add('locked'); $('#btn-versus').setAttribute('aria-disabled', 'true'); }

      this.initTouch();
      this.initMenuKeys();
      this.buildSettings();
      addEventListener('resize', () => this.layout());
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode && !this.mode.done) this.pause(); });
      ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => TR.Sfx.unlock(), {passive: true}));

      this.show('scr-menu');
      this.renderBests();
      requestAnimationFrame(t => this.loop(t));
    },

    // ---------- navigation ----------
    show(id) {
      $$('.screen').forEach(s => { s.hidden = s.id !== id; });
      this.screen = id;
      TR.Keys.capture = id === 'scr-game';
      const first = $('#' + id + ' button:not([aria-disabled="true"])');
      if (first && id !== 'scr-game' && !TR.isTouch) first.focus({preventScroll: true});
      if (id === 'scr-menu') this.renderBests();
      if (id === 'scr-flip') this.renderFlipBests();
      this.layout();
    },
    go(where) {
      TR.Sfx.play('select');
      if (where === 'menu') this.show('scr-menu');
      else if (where === 'flip') this.show('scr-flip');
      else if (where === 'settings') { this.renderBinds(); this.show('scr-settings'); }
      else if (where === 'howto') this.show('scr-howto');
      else if (where === 'dungeon') this.startMode('dungeon');
      else if (where === 'versus') {
        if (TR.isTouch) { this.note('Versus needs a keyboard. Open Tetr1s on a laptop or PC to play with a friend.'); return; }
        this.startMode('versus');
      }
    },
    note(text) {
      const n = $('#note'); n.textContent = text; n.hidden = false;
      clearTimeout(this.noteT); this.noteT = setTimeout(() => { n.hidden = true; }, 3200);
    },

    binds(set) {
      const b = clone(TR.store.data.binds[set]);
      if (set === 'solo') Object.keys(TR.TOUCH_CODES).forEach(a => { b[a] = (b[a] || []).concat(TR.TOUCH_CODES[a]); });
      return b;
    },
    best(key) {
      const b = TR.store.data.best;
      if (key === 'daily') return b.daily && b.daily.date === TR.today() ? b.daily.score : null;
      return b[key] == null ? null : b[key];
    },
    saveBest(key, val, better) {
      const cur = this.best(key);
      if (cur != null && !better(val, cur)) return false;
      TR.store.data.best[key] = key === 'daily' ? {date: TR.today(), score: val} : val;
      TR.store.save();
      return true;
    },
    renderBests() {
      const rows = [['Marathon', this.best('marathon'), v => TR.fmtNum(v)], ['Sprint 40', this.best('sprint'), v => TR.fmtTime(v)],
        ['Daily (today)', this.best('daily'), v => TR.fmtNum(v)], ['Dungeon', this.best('dungeon'), v => v >= 11 ? 'Cleared' : 'Floor ' + v]];
      $('#bests').innerHTML = rows.map(([k, v, f]) => '<div><dt>' + k + '</dt><dd>' + (v == null ? '—' : f(v)) + '</dd></div>').join('');
    },
    renderFlipBests() {
      $('#best-marathon').textContent = this.best('marathon') == null ? '—' : TR.fmtNum(this.best('marathon'));
      $('#best-sprint').textContent = this.best('sprint') == null ? '—' : TR.fmtTime(this.best('sprint'));
      $('#best-daily').textContent = this.best('daily') == null ? '—' : TR.fmtNum(this.best('daily'));
      $('#daily-date').textContent = TR.today();
    },

    // ---------- playing ----------
    startMode(kind, sub) {
      this.kindArgs = [kind, sub];
      this.closeOverlay();
      this.mode = kind === 'flip' ? new TR.FlipMode(this, sub) : kind === 'dungeon' ? new TR.DungeonMode(this) : new TR.VersusMode(this);
      TR.Keys.bound = new Set([].concat.apply([], ['solo', 'p1', 'p2'].map(s => [].concat.apply([], Object.values(TR.store.data.binds[s])))));
      TR.Keys.take();
      this.paused = false;
      $('#touch').hidden = !(TR.isTouch && kind !== 'versus');
      this.show('scr-game');
      this.mode.start();
    },
    restart() { const a = this.kindArgs; this.startMode(a[0], a[1]); },
    quit() { this.closeOverlay(); this.mode = null; this.paused = false; this.show('scr-menu'); },
    pause() {
      if (!this.mode || this.paused || this.mode.done || this.overlayOpen) return;
      this.paused = true;
      const extra = this.mode.kind === 'dungeon' && this.mode.relics.length
        ? '<p class="relic-list">' + this.mode.relics.map(id => { const r = TR.Rules.RELICS.find(z => z.id === id); return '<b>' + r.name + '</b> ' + r.desc; }).join('<br>') + '</p>' : '';
      this.overlay('<h2>Paused</h2>' + extra + '<div class="actions"><button data-a="resume">Resume</button><button data-a="restart">Restart</button><button data-a="quit">Quit to menu</button></div>', {
        resume: () => this.resume(), restart: () => this.restart(), quit: () => this.quit()
      }, () => this.resume());
    },
    resume() { this.closeOverlay(); this.paused = false; TR.Keys.take(); },

    showResult(r) {
      const stats = r.stats.map(s => '<tr><th>' + s[0] + '</th><td>' + s[1] + '</td></tr>').join('');
      this.overlay('<p class="eyebrow">' + (r.isBest ? 'New best' : '&nbsp;') + '</p><h2>' + r.title + '</h2><p class="headline">' + r.headline + '</p>' +
        '<table class="stats">' + stats + '</table><div class="actions"><button data-a="again">' + (r.rematch ? 'Rematch' : 'Play again') + '</button><button data-a="quit">Menu</button></div>',
      {again: () => this.restart(), quit: () => this.quit()}, () => this.quit());
    },
    showChoice(o) {
      const cards = o.options.map((r, i) => '<button class="relic" data-a="pick' + i + '"><canvas width="96" height="96" data-relic="' + r.id + '" aria-hidden="true"></canvas><span class="k">' + (i + 1) + '</span><b>' + r.name + '</b><span>' + r.desc + '</span></button>').join('');
      const acts = {};
      o.options.forEach((r, i) => { acts['pick' + i] = () => { this.closeOverlay(); o.onPick(r); }; });
      this.overlay('<p class="eyebrow">Relic</p><h2>' + o.title + '</h2><p>' + o.sub + '</p><div class="relics">' + cards + '</div>', acts, null, o.options.length);
      $$('#overlay canvas[data-relic]').forEach(c => { const x = c.getContext('2d'); x.scale(2, 2); TR.relicIcon(x, c.dataset.relic, 24, 24, 34, '#FFC46B'); });
    },
    overlay(html, actions, onEsc, digits) {
      const o = $('#overlay');
      $('#overlay-card').innerHTML = html;
      $$('#overlay [data-a]').forEach(b => b.addEventListener('click', () => { TR.Sfx.play('select'); actions[b.dataset.a](); }));
      o.hidden = false; this.overlayOpen = true; this.overlayEsc = onEsc; this.overlayDigits = digits || 0; this.overlayActions = actions;
      TR.Keys.capture = false;
      const first = $('#overlay button'); if (first) first.focus({preventScroll: true});
    },
    closeOverlay() { $('#overlay').hidden = true; this.overlayOpen = false; TR.Keys.capture = this.screen === 'scr-game'; },

    // ---------- touch ----------
    initTouch() {
      $$('#touch button').forEach(b => {
        const code = b.dataset.k;
        const down = e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('on'); TR.Keys.press(code); };
        const up = () => { b.classList.remove('on'); TR.Keys.release(code); };
        b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', e => e.preventDefault());
      });
      this.canvas.addEventListener('pointerdown', e => {
        const m = this.mode; if (!m || !m.holdRect) return;
        const r = this.canvas.getBoundingClientRect(), X = (e.clientX - r.left) / this.scale, Y = (e.clientY - r.top) / this.scale, h = m.holdRect;
        if (X >= h.x && X <= h.x + h.w && Y >= h.y && Y <= h.y + h.h) { TR.Keys.press('TouchHold'); setTimeout(() => TR.Keys.release('TouchHold'), 80); }
      });
    },

    // Arrow keys move focus in menus; Esc goes back; digits pick relics.
    initMenuKeys() {
      addEventListener('keydown', e => {
        if (TR.Keys.listener) return;
        if (this.overlayOpen) {
          if (e.code === 'Escape' && this.overlayEsc) { e.preventDefault(); this.overlayEsc(); return; }
          const n = parseInt(e.key, 10);
          if (this.overlayDigits && n >= 1 && n <= this.overlayDigits) { e.preventDefault(); this.overlayActions['pick' + (n - 1)](); return; }
        } else if (this.screen === 'scr-game') return;
        else if (e.code === 'Escape' && this.screen !== 'scr-menu') { this.go('menu'); return; }
        if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
        const scope = this.overlayOpen ? $('#overlay') : $('#' + this.screen);
        const list = Array.from(scope.querySelectorAll('button, input, select')).filter(b => b.offsetParent !== null);
        if (!list.length) return;
        e.preventDefault();
        const i = list.indexOf(document.activeElement), next = e.code === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[i < 0 ? 0 : next].focus();
      });
    },

    // ---------- settings ----------
    buildSettings() {
      const s = this.settings;
      const das = $('#set-das'), arr = $('#set-arr'), sdf = $('#set-sdf'), vol = $('#set-vol');
      const sync = () => {
        $('#out-das').textContent = Math.round(s.das * 1000) + ' ms';
        $('#out-arr').textContent = Math.round(s.arr * 1000) + ' ms';
        $('#out-vol').textContent = Math.round(s.vol * 100) + '%';
      };
      das.value = Math.round(s.das * 1000); arr.value = Math.round(s.arr * 1000); vol.value = Math.round(s.vol * 100);
      sdf.value = s.sdf === Infinity ? 'inf' : String(s.sdf);
      const save = () => { TR.store.data.settings = Object.assign({}, s, {sdf: s.sdf === Infinity ? null : s.sdf}); TR.store.save(); sync(); };
      das.addEventListener('input', () => { s.das = das.value / 1000; save(); });
      arr.addEventListener('input', () => { s.arr = arr.value / 1000; save(); });
      sdf.addEventListener('change', () => { s.sdf = sdf.value === 'inf' ? Infinity : +sdf.value; save(); });
      vol.addEventListener('input', () => { s.vol = vol.value / 100; TR.Sfx.setVol(s.vol); save(); });
      vol.addEventListener('change', () => TR.Sfx.play('clear', 2));
      $('#set-reset').addEventListener('click', () => {
        Object.assign(s, DEFAULTS); TR.store.data.binds = clone(TR.DEFAULT_BINDS);
        das.value = 167; arr.value = 33; sdf.value = '20'; vol.value = 60; TR.Sfx.setVol(s.vol); save(); this.renderBinds();
      });
      sync();
    },
    renderBinds() {
      const B = TR.store.data.binds, sets = [['solo', 'Solo (Flip and Dungeon)'], ['p1', 'Versus · Player 1'], ['p2', 'Versus · Player 2']];
      const shared = new Set(Object.values(B.p1).reduce((a, k) => a.concat(k), []).filter(c => Object.values(B.p2).some(k => k.indexOf(c) >= 0)));
      $('#binds').innerHTML = sets.map(([set, title]) => {
        const acts = TR.ACTIONS.filter(a => set !== 'solo' || a !== 'flip');
        return '<section class="bindset"><h3>' + title + '</h3><table>' + acts.map(a => {
          const k = B[set][a] || [];
          const cell = slot => {
            const code = k[slot], clash = set !== 'solo' && code && shared.has(code);
            return '<td><button class="key' + (clash ? ' clash' : '') + '" data-set="' + set + '" data-act="' + a + '" data-slot="' + slot + '" title="' + (clash ? 'Used by both players' : 'Click, then press a key') + '">' + (code ? TR.keyLabel(code) : '+') + '</button></td>';
          };
          return '<tr><th>' + TR.ACTION_LABEL[a] + '</th>' + cell(0) + cell(1) + '</tr>';
        }).join('') + '</table></section>';
      }).join('');
      $('#bind-warn').hidden = !shared.size;
      $$('#binds button.key').forEach(b => b.addEventListener('click', () => this.rebind(b)));
    },
    rebind(btn) {
      const {set, act, slot} = btn.dataset, B = TR.store.data.binds;
      btn.textContent = 'Press a key…'; btn.classList.add('wait');
      TR.Keys.listener = code => {
        TR.Keys.listener = null;
        const list = (B[set][act] || []).slice();
        if (code === 'Escape') { this.renderBinds(); return; }
        if (code === 'Backspace' || code === 'Delete') { if (list.length > 1) list.splice(+slot, 1); }
        else {
          Object.keys(B[set]).forEach(a => { B[set][a] = B[set][a].filter(c => c !== code || (a === act)); });
          list[+slot] = code;
        }
        B[set][act] = list.filter((c, i, arr) => c && arr.indexOf(c) === i);
        if (!B[set][act].length) B[set][act] = TR.DEFAULT_BINDS[set][act].slice();
        TR.store.save(); this.renderBinds();
        const again = $('#binds button[data-set="' + set + '"][data-act="' + act + '"][data-slot="' + slot + '"]'); if (again) again.focus();
      };
    },

    // ---------- layout and loop ----------
    layout() {
      if (this.screen !== 'scr-game' || !this.mode) return;
      const scr = $('#scr-game'), touch = $('#touch');
      this.port = this.mode.kind !== 'versus' && (TR.isTouch || innerWidth < 640 || innerHeight > innerWidth * 1.1);
      const S = this.mode.size(this.port);
      const th = touch.hidden ? 0 : touch.offsetHeight;
      const aw = scr.clientWidth - 16, ah = scr.clientHeight - th - 16;
      const scale = Math.max(.3, Math.min(aw / S.w, ah / S.h));
      const d = window.devicePixelRatio || 1;
      this.canvas.style.width = Math.floor(S.w * scale) + 'px'; this.canvas.style.height = Math.floor(S.h * scale) + 'px';
      this.canvas.width = Math.round(S.w * scale * d); this.canvas.height = Math.round(S.h * scale * d);
      this.ctx.setTransform(scale * d, 0, 0, scale * d, 0, 0);
      this.scale = scale;
    },
    drawLogo(t) {
      const box = this.logo.parentElement.clientWidth, cs = Math.max(8, Math.min(20, Math.floor(box / 24))), L = TR.logoSize(cs), d = window.devicePixelRatio || 1;
      const w = L.w + 4, h = L.h + 4;
      if (this.logo.width !== Math.round(w * d)) { this.logo.width = Math.round(w * d); this.logo.height = Math.round(h * d); this.logo.style.width = w + 'px'; this.logo.style.height = h + 'px'; }
      this.lctx.setTransform(d, 0, 0, d, 0, 0); this.lctx.clearRect(0, 0, w, h);
      TR.drawLogo(this.lctx, 2, 2, cs, t);
    },
    loop(now) {
      const dt = Math.min(.05, (now - (this.last || now)) / 1000); this.last = now;
      const codes = TR.Keys.take();
      if (this.screen === 'scr-menu') this.drawLogo(now / 1000);
      if (this.screen === 'scr-game' && this.mode) {
        if (!this.paused && !this.overlayOpen) {
          if (codes.indexOf('Escape') >= 0 || (this.mode.kind !== 'versus' && codes.indexOf('KeyP') >= 0)) this.pause();
          else this.mode.update(dt, codes);
        }
        this.mode.draw(this.ctx, this.port);
      }
      requestAnimationFrame(t => this.loop(t));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init()); else App.init();
})(window.TR);
