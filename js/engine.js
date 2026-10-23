// One playfield: SRS rotation, 7-bag, hold, lock delay, line clears, garbage, and the board flip.
// Modes listen to events (clear, afterLock, topout, ...) and decide what a clear is worth.
(function (root) {
  'use strict';
  const TR = root.TR = root.TR || {};

  const COLS = 10, VIS = 20, HID = 2, ROWS = VIS + HID;
  const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  const RUNES = ['fire', 'ice', 'thunder', 'leaf'];
  const T_WARN = .45, T_FLIP = .8, T_CASCADE = .55;

  const BASE = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };

  // MINOS[type][rot] lists the four blocks as [x, y] inside the piece box. The order is kept
  // through every rotation, so a rune stays on the same block while the piece turns.
  const MINOS = {};
  TYPES.forEach(t => {
    const m = BASE[t], n = m.length, first = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) first.push([c, r]);
    MINOS[t] = [first];
    for (let k = 1; k < 4; k++) MINOS[t].push(MINOS[t][k - 1].map(([c, r]) => [n - 1 - r, c]));
  });

  // SRS wall kicks in the guideline's (x, y-up) form; y is negated when applied.
  const KICKS = {
    '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };
  const KICKS_I = {
    '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  };

  Object.assign(TR, {COLS, VIS, HID, ROWS, TYPES, RUNES, MINOS, T_WARN, T_FLIP, T_CASCADE});

  // Seconds per row at a level (guideline curve), capped at level 20.
  TR.gravityTime = function (level) {
    const L = Math.min(20, Math.max(1, level));
    return Math.pow(0.8 - (L - 1) * 0.007, L - 1);
  };

  const emptyRow = () => Array(COLS).fill(null);
  const emptyGrid = () => Array.from({length: ROWS}, emptyRow);

  class Game {
    constructor(opts) {
      this.o = Object.assign({seed: 1, preview: 5, lockDelay: .5, maxResets: 15, clearDelay: .25, onEvent: null}, opts || {});
      this.rng = TR.rng(this.o.seed);
      this.aux = TR.rng((this.o.seed * 7919) ^ 0x5bd1e995);
      this.grid = emptyGrid(); this.bag = []; this.queue = [];
      this.hold = null; this.holdUsed = false; this.holdLocked = 0; this.fog = 0;
      this.piece = null; this.level = 1; this.sdf = 20; this.runeChance = 0;
      this.lines = 0; this.score = 0; this.pieces = 0; this.combo = -1; this.b2b = false; this.time = 0;
      this.phase = 'idle'; this.pt = 0; this.over = false; this.paused = false; this.halted = false;
      this.soft = false; this.gacc = 0; this.lockT = 0; this.resets = 0; this.lowest = 0;
      this.clearRows = null; this.clearFromFlip = false; this.moves = null;
      this.flipQueued = false; this.saved = null; this.lastTspin = 0;
      this.fill();
    }

    emit(type, data) { if (this.o.onEvent) this.o.onEvent(type, data || {}, this); }
    go(p) { this.phase = p; this.pt = 0; }

    fill() {
      while (this.queue.length < 7) {
        if (!this.bag.length) {
          this.bag = TYPES.slice();
          for (let i = 6; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); const t = this.bag[i]; this.bag[i] = this.bag[j]; this.bag[j] = t; }
        }
        this.queue.push(this.bag.pop());
      }
    }

    start() { this.spawn(); }

    fits(type, rot, x, y) {
      const m = MINOS[type][rot];
      for (let i = 0; i < 4; i++) {
        const X = x + m[i][0], Y = y + m[i][1];
        if (X < 0 || X >= COLS || Y < 0 || Y >= ROWS || this.grid[Y][X]) return false;
      }
      return true;
    }
    cells(p) { return MINOS[p.type][p.rot].map(([c, r], i) => [p.x + c, p.y + r, i]); }

    // type/rune are given when a held or saved piece comes back; otherwise the queue supplies one.
    spawn(type, rune, keepHold) {
      let t = type;
      if (!t) { t = this.queue.shift(); this.fill(); }
      const p = {type: t, rot: 0, x: t === 'O' ? 4 : 3, y: 1, rune: rune || null, lastRot: false, kick: 0};
      if (!type && this.runeChance && this.aux() < this.runeChance) p.rune = {i: Math.floor(this.aux() * 4), type: RUNES[Math.floor(this.aux() * 4)]};
      if (!keepHold) this.holdUsed = false;
      if (!this.fits(t, 0, p.x, p.y)) { this.piece = null; this.topOut('block'); return; }
      this.piece = p; this.lockT = 0; this.resets = 0; this.lowest = p.y; this.gacc = 0;
      this.go('play');
      this.emit('spawn', {type: t});
    }

    ghostY() { const p = this.piece; let y = p.y; while (this.fits(p.type, p.rot, p.x, y + 1)) y++; return y; }
    grounded() { const p = this.piece; return !this.fits(p.type, p.rot, p.x, p.y + 1); }
    touch() { if (this.resets < this.o.maxResets) { this.lockT = 0; this.resets++; } }

    shift(dx, dy) {
      const p = this.piece;
      if (!p || this.phase !== 'play' || !this.fits(p.type, p.rot, p.x + dx, p.y + dy)) return false;
      const was = this.grounded();
      p.x += dx; p.y += dy; p.lastRot = false;
      if (p.y > this.lowest) { this.lowest = p.y; this.resets = 0; this.lockT = 0; }
      else if (dx && (was || this.grounded())) this.touch();
      return true;
    }
    move(dir) { const ok = this.shift(dir, 0); if (ok) this.emit('move'); return ok; }

    rotate(dir) {
      const p = this.piece;
      if (!p || this.phase !== 'play' || p.type === 'O') return false;
      const from = p.rot, to = (from + dir + 4) % 4, kicks = (p.type === 'I' ? KICKS_I : KICKS)['' + from + to];
      const was = this.grounded();
      for (let i = 0; i < kicks.length; i++) {
        const nx = p.x + kicks[i][0], ny = p.y - kicks[i][1];
        if (!this.fits(p.type, to, nx, ny)) continue;
        p.x = nx; p.y = ny; p.rot = to; p.lastRot = true; p.kick = i;
        if (p.y > this.lowest) { this.lowest = p.y; this.resets = 0; this.lockT = 0; }
        else if (was || this.grounded()) this.touch();
        this.emit('rotate');
        return true;
      }
      return false;
    }

    hardDrop() {
      if (!this.piece || this.phase !== 'play') return false;
      let n = 0; while (this.shift(0, 1)) n++;
      this.emit('harddrop', {cells: n});
      this.lockPiece();
      return true;
    }

    holdPiece() {
      const p = this.piece;
      if (!p || this.phase !== 'play') return false;
      if (this.holdUsed || this.holdLocked > 0) { this.emit('holdDenied'); return false; }
      const cur = {type: p.type, rune: p.rune};
      this.piece = null;
      if (this.hold) { const h = this.hold; this.hold = cur; this.spawn(h.type, h.rune, true); }
      else { this.hold = cur; this.spawn(null, null, true); }
      this.holdUsed = true;
      this.emit('hold');
      return true;
    }

    update(dt) {
      if (this.over || this.paused || this.phase === 'idle') return;
      this.pt += dt; this.time += dt;
      switch (this.phase) {
        case 'play': this.tickPlay(dt); break;
        case 'clear': if (this.pt >= this.o.clearDelay) this.finishClear(); break;
        case 'flipWarn': if (this.pt >= T_WARN) { this.go('flip'); this.emit('flip'); } break;
        case 'flip': if (this.pt >= T_FLIP) { this.flipGrid(); this.go('cascade'); } break;
        case 'cascade':
          if (this.pt >= T_CASCADE) { this.moves = null; const rows = this.fullRows(); if (rows.length) this.beginClear(rows, true); else this.endFlip(); }
          break;
      }
    }

    tickPlay(dt) {
      if (!this.piece) return;
      const g = 1 / TR.gravityTime(this.level);
      if (this.soft && this.sdf === Infinity) {
        let n = 0; while (this.shift(0, 1)) n++;
        if (n) this.emit('softdrop', {cells: n});
      } else {
        this.gacc += (this.soft ? g * this.sdf : g) * dt;
        while (this.gacc >= 1) {
          this.gacc -= 1;
          if (this.shift(0, 1)) { if (this.soft) this.emit('softdrop', {cells: 1}); }
          else { this.gacc = 0; break; }
        }
      }
      if (this.piece && this.grounded()) { this.lockT += dt; if (this.lockT >= this.o.lockDelay) this.lockPiece(); }
    }

    // 3-corner rule; a T-spin is "full" when both corners on the pointing side are filled,
    // or when the last kick was the fifth test.
    tspinCheck(p) {
      if (p.type !== 'T' || !p.lastRot) return 0;
      const occ = (x, y) => x < 0 || x >= COLS || y < 0 || y >= ROWS || !!this.grid[y][x];
      const c = [occ(p.x, p.y), occ(p.x + 2, p.y), occ(p.x + 2, p.y + 2), occ(p.x, p.y + 2)];
      if (c.filter(Boolean).length < 3) return 0;
      const front = [[0, 1], [1, 2], [2, 3], [3, 0]][p.rot];
      if (c[front[0]] && c[front[1]]) return 2;
      return p.kick === 4 ? 2 : 1;
    }

    lockPiece() {
      const p = this.piece;
      if (!p) return;
      const tspin = this.tspinCheck(p), cells = this.cells(p);
      // s picks one of a few stone textures, so a block keeps its look when it moves or flips.
      for (const [X, Y, i] of cells) this.grid[Y][X] = {t: p.type, back: false, rune: p.rune && p.rune.i === i ? p.rune.type : null, s: (this.pieces * 4 + i) % 6};
      this.piece = null; this.pieces++;
      if (this.holdLocked > 0) this.holdLocked--;
      if (this.fog > 0) this.fog--;
      this.lastTspin = tspin;
      this.emit('lock', {type: p.type, cells, tspin});
      if (cells.every(c => c[1] < HID)) { this.topOut('lockout'); return; }
      const rows = this.fullRows();
      if (rows.length) { this.beginClear(rows, false); return; }
      this.combo = -1;
      if (tspin) this.emit('clear', {lines: 0, tspin, b2b: false, combo: -1, runes: [], perfect: false, rows: []});
      this.afterLock(0);
    }

    fullRows() { const out = []; for (let y = 0; y < ROWS; y++) if (this.grid[y].every(Boolean)) out.push(y); return out; }

    beginClear(rows, fromFlip) {
      const n = rows.length, runes = [];
      rows.forEach(r => this.grid[r].forEach(v => { if (v && v.rune) runes.push(v.rune); }));
      const tspin = fromFlip ? 0 : this.lastTspin;
      let b2b = false;
      if (!fromFlip) {
        this.combo++;
        if (n >= 4 || tspin > 0) { b2b = this.b2b; this.b2b = true; } else this.b2b = false;
      }
      const perfect = this.grid.every((row, y) => rows.indexOf(y) >= 0 || row.every(v => !v));
      this.lines += n; this.clearRows = rows; this.clearFromFlip = fromFlip;
      this.go('clear');
      this.emit(fromFlip ? 'flipClear' : 'clear', {lines: n, tspin, b2b, combo: fromFlip ? 0 : this.combo, runes, perfect, rows});
    }

    finishClear() {
      const n = this.clearRows.length, fromFlip = this.clearFromFlip, rows = this.clearRows;
      this.grid = this.grid.filter((r, y) => rows.indexOf(y) < 0);
      while (this.grid.length < ROWS) this.grid.unshift(emptyRow());
      this.clearRows = null;
      if (fromFlip) this.endFlip(); else this.afterLock(n);
    }

    // Modes add garbage, queue a flip, or halt the board from the afterLock event.
    afterLock(lines) {
      this.emit('afterLock', {lines});
      if (this.over || this.halted) return;
      if (this.flipQueued) { this.flipQueued = false; this.beginFlip(); return; }
      this.spawn();
    }

    beginFlip() { this.go('flipWarn'); this.emit('flipStart'); }

    // Versus flips mid-piece: the falling piece is set aside and comes back at the top afterwards.
    requestFlipNow() {
      if (this.over) return false;
      if (this.phase === 'play' && this.piece) {
        this.saved = {type: this.piece.type, rune: this.piece.rune};
        this.piece = null;
        this.beginFlip();
        return true;
      }
      if (this.phase === 'clear' && !this.clearFromFlip) { this.flipQueued = true; return true; }
      return false;
    }

    // Turn the board upside down, then let every column fall to the new floor.
    flipGrid() {
      const r = this.grid.slice().reverse().map(row => row.map(v => v ? Object.assign({}, v, {back: !v.back}) : null));
      const ng = emptyGrid(), mv = [];
      for (let X = 0; X < COLS; X++) {
        let k = ROWS - 1;
        for (let y = ROWS - 1; y >= 0; y--) { const v = r[y][X]; if (v) { mv.push({x: X, from: y, to: k, v}); ng[k][X] = v; k--; } }
      }
      this.grid = ng; this.moves = mv;
    }

    endFlip() {
      this.flipQueued = false;
      this.emit('flipEnd');
      if (this.over || this.halted) return;
      const s = this.saved; this.saved = null;
      if (s) this.spawn(s.type, s.rune, true); else this.spawn();
    }

    topOut(reason) {
      if (this.over) return;
      this.over = true; this.piece = null; this.go('dead');
      this.emit('topout', {reason});
    }

    addGarbage(n, gap) {
      for (let i = 0; i < n; i++) {
        if (this.grid[0].some(Boolean)) { this.topOut('garbage'); return false; }
        this.grid.shift();
        const row = emptyRow();
        for (let X = 0; X < COLS; X++) if (X !== gap) row[X] = {t: 'G', back: false, rune: null, s: X % 6};
        this.grid.push(row);
      }
      const p = this.piece;
      if (p) {
        while (!this.fits(p.type, p.rot, p.x, p.y) && p.y > 0) p.y--;
        if (!this.fits(p.type, p.rot, p.x, p.y)) { this.topOut('garbage'); return false; }
      }
      this.emit('garbage', {n});
      return true;
    }

    removeGarbageRow() {
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.grid[y].some(v => v && v.t === 'G')) { this.grid.splice(y, 1); this.grid.unshift(emptyRow()); return true; }
      }
      return false;
    }

    tallestColumn() {
      for (let y = 0; y < ROWS; y++) for (let X = 0; X < COLS; X++) if (this.grid[y][X]) return X;
      return -1;
    }
    clearColumn(X) { let n = 0; if (X < 0) return 0; for (let y = 0; y < ROWS; y++) if (this.grid[y][X]) { this.grid[y][X] = null; n++; } return n; }

    stackTop() { for (let y = 0; y < ROWS; y++) if (this.grid[y].some(Boolean)) return y; return ROWS; }
  }

  TR.Game = Game;
})(typeof window !== 'undefined' ? window : global);
