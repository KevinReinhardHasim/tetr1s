// Keyboard and touch input. Touch buttons press virtual keys, so one Controller handles both.
(function (TR) {
  'use strict';

  TR.ACTIONS = ['left', 'right', 'soft', 'hard', 'ccw', 'cw', 'hold', 'flip'];
  TR.ACTION_LABEL = {left: 'Move left', right: 'Move right', soft: 'Soft drop', hard: 'Hard drop', ccw: 'Rotate left', cw: 'Rotate right', hold: 'Hold', flip: 'Flip (Versus)'};
  TR.DEFAULT_BINDS = {
    solo: {left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'], hard: ['Space'], ccw: ['KeyZ', 'ControlLeft'], cw: ['ArrowUp', 'KeyX'], hold: ['KeyC', 'ShiftLeft']},
    p1: {left: ['KeyA'], right: ['KeyD'], soft: ['KeyS'], hard: ['Space'], ccw: ['KeyQ'], cw: ['KeyW'], hold: ['ShiftLeft'], flip: ['KeyE']},
    p2: {left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'], hard: ['Enter', 'NumpadEnter'], ccw: ['Period'], cw: ['ArrowUp'], hold: ['ShiftRight'], flip: ['Slash']}
  };
  TR.TOUCH_CODES = {left: 'TouchLeft', right: 'TouchRight', soft: 'TouchSoft', hard: 'TouchHard', cw: 'TouchRotate', hold: 'TouchHold'};

  const NAMES = {ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Enter: 'Enter', NumpadEnter: 'Num Enter',
    ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
    Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Tab: 'Tab'};
  TR.keyLabel = function (code) {
    if (!code) return '—';
    if (NAMES[code]) return NAMES[code];
    if (code.indexOf('Key') === 0) return code.slice(3);
    if (code.indexOf('Digit') === 0) return code.slice(5);
    if (code.indexOf('Numpad') === 0) return 'Num ' + code.slice(6);
    return code;
  };

  const Keys = TR.Keys = {
    held: new Set(), queue: [], capture: false, bound: new Set(), listener: null,
    init() {
      addEventListener('keydown', e => {
        if (this.listener) { e.preventDefault(); this.listener(e.code); return; }
        if (this.capture && (this.bound.has(e.code) || e.code.indexOf('Arrow') === 0 || e.code === 'Space')) e.preventDefault();
        if (e.repeat) return;
        this.held.add(e.code); this.queue.push(e.code);
      });
      addEventListener('keyup', e => { this.held.delete(e.code); });
      addEventListener('blur', () => { this.held.clear(); });
    },
    press(code) { if (!this.held.has(code)) { this.held.add(code); this.queue.push(code); } },
    release(code) { this.held.delete(code); },
    take() { return this.queue.splice(0); }
  };

  // DAS/ARR handling for one player. hand = {das, arr, sdf} in seconds and gravity multiples.
  class Controller {
    constructor(binds, hand, onAction) {
      this.b = binds; this.h = hand; this.onAction = onAction; this.dir = 0; this.das = 0; this.arr = 0;
      this.map = {};
      Object.keys(binds).forEach(a => binds[a].forEach(c => { if (!this.map[c]) this.map[c] = a; }));
    }
    held(a) { const k = this.b[a]; return !!k && k.some(c => Keys.held.has(c)); }
    update(dt, g, codes) {
      // Presses are applied one by one in the order they happened, even when a slow frame collects several.
      codes.forEach(c => {
        const a = this.map[c];
        if (a === 'left' || a === 'right') { this.dir = a === 'left' ? -1 : 1; this.das = 0; this.arr = 0; g.move(this.dir); }
        else if (a === 'cw') g.rotate(1);
        else if (a === 'ccw') g.rotate(-1);
        else if (a === 'hold') g.holdPiece();
        else if (a === 'hard') g.hardDrop();
        else if (a === 'flip' && this.onAction) this.onAction('flip');
      });
      const L = this.held('left'), R = this.held('right');
      if (this.dir === -1 && !L) { this.dir = R ? 1 : 0; this.das = 0; this.arr = 0; }
      if (this.dir === 1 && !R) { this.dir = L ? -1 : 0; this.das = 0; this.arr = 0; }
      if (this.dir) {
        this.das += dt;
        if (this.das >= this.h.das) {
          if (this.h.arr <= 0) { while (g.move(this.dir)) { /* slide to the wall */ } }
          else {
            this.arr += dt;
            while (this.arr >= this.h.arr) { this.arr -= this.h.arr; if (!g.move(this.dir)) { this.arr = 0; break; } }
          }
        }
      }
      g.soft = this.held('soft');
      g.sdf = this.h.sdf;
    }
  }
  TR.Controller = Controller;
})(window.TR);
