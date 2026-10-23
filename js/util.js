// Small helpers shared by every other script. Loaded first; everything hangs off the TR namespace.
(function (root) {
  'use strict';
  const TR = root.TR = root.TR || {};

  // Seeded PRNG (mulberry32), so a seed always produces the same piece order.
  TR.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  TR.randSeed = () => (Math.floor(Math.random() * 2147483646) + 1);

  TR.ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  TR.easeIn = t => t * t;
  TR.easeOut = t => 1 - (1 - t) * (1 - t);
  TR.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  TR.mix = (a, b, f) => { const A = hexRgb(a), B = hexRgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',') + ')'; };
  TR.alpha = (h, a) => { const c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  TR.fmtNum = n => Math.round(n).toLocaleString('en-US');
  TR.fmtTime = s => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); };
  TR.fmtClock = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  TR.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  TR.todaySeed = () => parseInt(TR.today().replace(/-/g, ''), 10);

  // localStorage can be missing or blocked (private windows), so every access is guarded.
  const KEY = 'tetr1s.v1';
  TR.store = {
    data: {},
    load() { try { this.data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.data = {}; } return this.data; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* progress only lasts for this visit */ } }
  };

  // Canvas helpers.
  TR.FD = '"Unbounded","Arial Black",system-ui,sans-serif';
  TR.FM = '"JetBrains Mono",Consolas,ui-monospace,monospace';
  TR.fd = (s, w) => (w || 700) + ' ' + s + 'px ' + TR.FD;
  TR.fm = (s, w) => (w || 400) + ' ' + s + 'px ' + TR.FM;
  TR.rr = function (x, X, Y, w, h, r) {
    x.beginPath(); x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  };
  TR.text = function (x, s, X, Y, font, color, align) {
    x.font = font; x.fillStyle = color; x.textAlign = align || 'left'; x.textBaseline = 'alphabetic'; x.fillText(s, X, Y);
  };
})(typeof window !== 'undefined' ? window : global);
