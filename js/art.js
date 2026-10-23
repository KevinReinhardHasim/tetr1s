// Everything drawn on the canvas: palettes, blocks, boards, panels, runes, relics, monsters,
// dungeon backgrounds, logo and effects. Static pieces (blocks, walls) are cached as sprites.
(function (TR) {
  'use strict';
  const {COLS, VIS, HID, ROWS, MINOS} = TR;

  TR.PAL = {
    flip: {bg: '#0A0F22', board: '#111936', panel: '#111936', stroke: '#2B3870', grid: '#18214A', text: '#E6ECFF', muted: '#7E8BC0', soft: '#A9B4DE', gold: '#FFD166', danger: '#FF5A6E',
      garbage: '#343B58', garbageLine: '#262C45',
      piece: {I: '#FF6B8B', O: '#46D7E8', T: '#FFD166', S: '#B794F6', Z: '#5EE0A0', J: '#FF9F5A', L: '#5B8DEF', G: '#343B58'}},
    dungeon: {bg: '#16100D', board: '#0E0A08', panel: '#211812', stroke: '#5A4130', grid: '#1E1712', text: '#F3E7D7', muted: '#B59F88', soft: '#D9C7B0', gold: '#FFC46B', danger: '#FF6A55',
      garbage: '#3B312B', garbageLine: '#2A221D',
      piece: {I: '#C9A27E', O: '#9C7B5B', T: '#B5654A', S: '#7E8C5A', Z: '#A0524A', J: '#6E7FA0', L: '#C48A3A', G: '#3B312B'}}
  };
  TR.PAL.versus = Object.assign({}, TR.PAL.flip, {bg: '#0A0D1C', board: '#111632', p1: '#46D7E8', p2: '#FF6B8B'});
  TR.RUNE_COLOR = {fire: '#FF7A3D', ice: '#7FD8FF', thunder: '#FFD84D', leaf: '#7EE081'};
  TR.TIER_COLOR = ['#D9C7B0', '#7FD8FF', '#C77DFF'];

  // ---- colour and shading helpers (hex in, hex out, so results can be mixed again) ----
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hmix = (a, b, f) => { const B = hexRgb(b); return '#' + hexRgb(a).map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0')).join(''); };
  const lt = (c, f) => hmix(c, '#ffffff', f), dk = (c, f) => hmix(c, '#000000', f);
  const easeOut = u => 1 - (1 - u) * (1 - u);
  const devScale = x => { const m = x.getTransform ? x.getTransform() : null; return m ? Math.hypot(m.a, m.b) : 2; };

  // Light from the top left and a dark cartoon outline, shared by monsters and relics.
  function grad(x, cx, cy, r, c) { const g = x.createRadialGradient(cx - r * .4, cy - r * .5, r * .05, cx, cy, r * 1.15); g.addColorStop(0, lt(c, .34)); g.addColorStop(.5, c); g.addColorStop(1, dk(c, .4)); return g; }
  function ell(x, cx, cy, rx, ry, c, o) {
    o = o || {}; x.beginPath(); x.ellipse(cx, cy, rx, ry, o.rot || 0, 0, Math.PI * 2);
    x.fillStyle = o.flat ? c : grad(x, cx, cy, Math.max(rx, ry), c); x.fill();
    if (!o.noLine) { x.lineWidth = o.lw || 2.4; x.strokeStyle = dk(c, .62); x.stroke(); }
  }
  function poly(x, p, c, o) {
    o = o || {}; let a = 1e9, b = 1e9, A = -1e9, B = -1e9;
    x.beginPath();
    for (let i = 0; i < p.length; i += 2) { const X = p[i], Y = p[i + 1]; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); a = Math.min(a, X); A = Math.max(A, X); b = Math.min(b, Y); B = Math.max(B, Y); }
    x.closePath();
    x.fillStyle = o.flat ? c : grad(x, (a + A) / 2, (b + B) / 2, Math.max(A - a, B - b) / 2, c); x.fill();
    if (!o.noLine) { x.lineWidth = o.lw || 2.4; x.lineJoin = 'round'; x.strokeStyle = dk(c, .62); x.stroke(); }
  }
  function rrPath(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function rrg(x, X, Y, w, h, r, c) { rrPath(x, X, Y, w, h, r); x.fillStyle = grad(x, X + w / 2, Y + h / 2, Math.max(w, h) / 2, c); x.fill(); x.lineWidth = 2.4; x.strokeStyle = dk(c, .62); x.stroke(); }
  function limb(x, p, c, w) {
    const go = () => { x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); };
    const a = x.globalAlpha;
    x.lineCap = 'round'; x.lineJoin = 'round';
    go(); x.strokeStyle = dk(c, .62); x.lineWidth = w + 4.5; x.stroke();
    go(); x.strokeStyle = c; x.lineWidth = w; x.stroke();
    go(); x.strokeStyle = lt(c, .22); x.lineWidth = w * .3; x.globalAlpha = a * .6; x.stroke(); x.globalAlpha = a;
  }
  function line(x, p, c, w) { x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.stroke(); }
  function eye(x, cx, cy, r, iris, look, closed) {
    if (closed) { line(x, [cx - r, cy, cx, cy + r * .35, cx + r, cy], '#1A1010', 2.6); return; }
    ell(x, cx, cy, r, r * .88, '#F7F3EA', {lw: 2});
    ell(x, cx + look, cy + 1, r * .56, r * .56, iris, {lw: 1.4});
    ell(x, cx + look, cy + 1, r * .27, r * .27, '#111111', {flat: true, noLine: true});
    ell(x, cx + look - r * .22, cy - r * .22, r * .17, r * .17, '#FFFFFF', {flat: true, noLine: true});
  }
  function glow(x, cx, cy, r, rgb, a) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  const blink = (t, ph) => ((t + (ph || 0)) % 3.7) < .13;
  function shadow(x, w) { const g = x.createRadialGradient(0, 80, 0, 0, 80, w); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 80, w, w * .16, 0, 0, 7); x.fill(); }
  TR.glow = glow;

  // ---- sprite cache: anything static is drawn once per size and device scale ----
  const SPR = new Map();
  function sprite(key, w, h, R, draw) {
    const k = key + '|' + w + 'x' + h + '|' + R;
    let c = SPR.get(k);
    if (!c) {
      if (SPR.size > 900) SPR.clear();
      c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * R)); c.height = Math.max(1, Math.ceil(h * R));
      const cx = c.getContext('2d'); cx.setTransform(R, 0, 0, R, 0, 0); draw(cx); SPR.set(k, c);
    }
    return c;
  }
  const quant = x => Math.max(1, Math.min(4, Math.round(devScale(x) * 4) / 4));

  // ---- blocks ----
  function flipFace(x, s, c) {
    const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, lt(c, .38)); g.addColorStop(.5, c); g.addColorStop(1, dk(c, .3));
    rrPath(x, 1, 1, s - 2, s - 2, Math.min(3, s * .15)); x.fillStyle = g; x.fill();
    const e = Math.max(1.2, s * .09);
    x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(3, 3, s - 6, e); x.fillRect(3, 3, e, s - 6);
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(3, s - 3 - e, s - 6, e); x.fillRect(s - 3 - e, 3, e, s - 6);
    if (s >= 12) { x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(s * .24, s * .24, s * .14, s * .14); }
  }
  function flipBack(x, s, c) {
    const base = hmix(c, '#0A0F22', .62), g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, lt(base, .15)); g.addColorStop(1, dk(base, .25));
    rrPath(x, 1, 1, s - 2, s - 2, Math.min(3, s * .15)); x.fillStyle = g; x.fill();
    x.save(); x.beginPath(); x.rect(2, 2, s - 4, s - 4); x.clip();
    x.strokeStyle = c; x.globalAlpha = .6; x.lineWidth = 1.2; x.beginPath();
    for (let i = -s; i < s; i += 5) { x.moveTo(i, s); x.lineTo(i + s, 0); }
    x.stroke(); x.restore();
    x.strokeStyle = c; x.lineWidth = 1.4; x.strokeRect(2.2, 2.2, s - 4.4, s - 4.4);
  }
  function stoneFace(x, s, c, seed, back) {
    const r = TR.rng(seed * 31 + 7), base = back ? hmix(c, '#120C09', .45) : c;
    const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, lt(base, .22)); g.addColorStop(1, dk(base, .3)); x.fillStyle = g; x.fillRect(1, 1, s - 2, s - 2);
    for (let i = 0; i < 6; i++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,240,220,.16)'; x.fillRect(3 + r() * (s - 7), 3 + r() * (s - 7), Math.max(1.5, s * .08), Math.max(1.5, s * .08)); }
    if (r() < .4) line(x, [4, 5 + r() * s * .3, s * .5, s * .5, s * .5 + 3, s - 4], 'rgba(0,0,0,.35)', 1.1);
    x.fillStyle = 'rgba(255,240,220,.25)'; x.fillRect(1, 1, s - 2, 2); x.fillRect(1, 1, 2, s - 2);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(1, s - 3, s - 2, 2); x.fillRect(s - 3, 1, 2, s - 2);
    if (back) { x.strokeStyle = 'rgba(255,226,176,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(4, s - 4); x.lineTo(s - 4, 4); x.stroke(); }
  }
  TR.cellFlip = function (x, X, Y, s, color, back) {
    const c = sprite('f' + color + (back ? 'b' : ''), s, s, quant(x), cx => (back ? flipBack : flipFace)(cx, s, color));
    x.drawImage(c, X, Y, s, s);
  };
  TR.cellStone = function (x, X, Y, s, color, back, seed) {
    const sd = (seed || 0) % 6, c = sprite('s' + color + sd + (back ? 'b' : ''), s, s, quant(x), cx => stoneFace(cx, s, color, sd, back));
    x.drawImage(c, X, Y, s, s);
  };
  TR.cellGarbage = function (x, X, Y, s, pal) {
    x.fillStyle = pal.garbage; x.fillRect(X + 1, Y + 1, s - 2, s - 2);
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(X + 1, Y + 1, s - 2, 2);
    x.strokeStyle = pal.garbageLine; x.lineWidth = 1; x.beginPath(); x.moveTo(X + 3, Y + s - 3); x.lineTo(X + s - 3, Y + 3); x.stroke();
  };
  TR.cell = function (x, style, X, Y, s, v, pal, back) {
    if (v.t === 'G') TR.cellGarbage(x, X, Y, s, pal);
    else if (style === 'stone') TR.cellStone(x, X, Y, s, pal.piece[v.t], back, v.s);
    else TR.cellFlip(x, X, Y, s, pal.piece[v.t], back);
    if (v.rune) TR.runeBadge(x, v.rune, X, Y, s);
  };

  // ---- runes ----
  TR.runeIcon = function (x, type, cx, cy, s) {
    const c = TR.RUNE_COLOR[type];
    x.save(); x.strokeStyle = c; x.fillStyle = c; x.lineWidth = Math.max(1.4, s * .13); x.lineCap = 'round'; x.lineJoin = 'round';
    if (type === 'fire') {
      x.beginPath(); x.moveTo(cx, cy - s * .44);
      x.quadraticCurveTo(cx + s * .4, cy, cx + s * .2, cy + s * .32); x.quadraticCurveTo(cx, cy + s * .46, cx - s * .2, cy + s * .32);
      x.quadraticCurveTo(cx - s * .4, cy, cx, cy - s * .44); x.fill();
    } else if (type === 'ice') {
      x.beginPath();
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; x.moveTo(cx + Math.cos(a) * s * .4, cy + Math.sin(a) * s * .4); x.lineTo(cx - Math.cos(a) * s * .4, cy - Math.sin(a) * s * .4); }
      x.stroke();
    } else if (type === 'thunder') {
      x.beginPath(); x.moveTo(cx + s * .14, cy - s * .44); x.lineTo(cx - s * .18, cy + s * .04); x.lineTo(cx + s * .1, cy + s * .04); x.lineTo(cx - s * .14, cy + s * .44); x.stroke();
    } else {
      x.beginPath(); x.ellipse(cx, cy, s * .42, s * .2, -Math.PI / 4, 0, 7); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - s * .26, cy + s * .26); x.lineTo(cx + s * .26, cy - s * .26); x.stroke();
    }
    x.restore();
  };
  TR.runeBadge = function (x, rune, X, Y, s) {
    x.fillStyle = 'rgba(12,9,10,.72)'; x.beginPath(); x.arc(X + s / 2, Y + s / 2, s * .36, 0, 7); x.fill();
    TR.runeIcon(x, rune, X + s / 2, Y + s / 2, s * .62);
  };

  // ---- relics (designed in a 64 px box) ----
  const RELIC = {
    dagger(x) {
      const bl = x.createLinearGradient(-5, 0, 5, 0); bl.addColorStop(0, '#8D96A3'); bl.addColorStop(.5, '#F2F6FA'); bl.addColorStop(1, '#8D96A3');
      x.beginPath(); x.moveTo(-5, 6); x.lineTo(-5, -22); x.lineTo(0, -32); x.lineTo(5, -22); x.lineTo(5, 6); x.closePath(); x.fillStyle = bl; x.fill(); x.lineWidth = 2; x.strokeStyle = '#3E454E'; x.stroke();
      line(x, [0, -26, 0, 4], 'rgba(120,130,145,.8)', 1.2);
      rrg(x, -15, 6, 30, 6, 2, '#D9A441'); rrg(x, -3.5, 12, 7, 13, 2, '#6B4A30');
      line(x, [-3.5, 15, 3.5, 17], '#3E2A1C', 1.2); line(x, [-3.5, 19, 3.5, 21], '#3E2A1C', 1.2);
      ell(x, 0, 28, 5, 5, '#E0414C', {lw: 1.4}); ell(x, -1.5, 26.5, 1.4, 1.4, '#FFFFFF', {flat: true, noLine: true});
    },
    amulet(x) {
      x.strokeStyle = '#D9A441'; x.lineWidth = 2; x.setLineDash([3, 2]); x.beginPath(); x.arc(0, -6, 20, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); x.setLineDash([]);
      ell(x, 0, 8, 17, 17, '#D9A441'); ell(x, 0, 8, 13, 13, '#7FD8FF', {lw: 1.6});
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; line(x, [Math.cos(a) * 9, 8 + Math.sin(a) * 9, -Math.cos(a) * 9, 8 - Math.sin(a) * 9], '#FFFFFF', 1.6); }
    },
    crystal(x) {
      glow(x, 1, -4, 22, '200,160,255', .35);
      poly(x, [-14, 22, -18, -2, -10, -14, -4, 0, -6, 22], '#8A5CE0', {lw: 1.8});
      poly(x, [-6, 24, -8, -18, 2, -32, 10, -16, 8, 24], '#B58CFF', {lw: 1.8});
      poly(x, [8, 24, 10, -4, 18, -10, 20, 22], '#8A5CE0', {lw: 1.8});
      line(x, [0, -16, 4, -4, -2, 4, 3, 14], 'rgba(255,240,255,.9)', 1.8);
    },
    drum(x) {
      rrg(x, -18, -10, 36, 30, 6, '#8A5232');
      ell(x, 0, -10, 18, 6, '#E9D8B4'); rrg(x, -19, 16, 38, 5, 2, '#B8302A');
      line(x, [-14, -4, -6, 14, 2, -4, 10, 14, 16, -4], '#F2E3C0', 1.4);
      limb(x, [-24, -26, -4, -12], '#D9B88A', 3); limb(x, [24, -26, 4, -12], '#D9B88A', 3);
    },
    shield(x) {
      x.beginPath(); x.moveTo(-18, -24); x.lineTo(18, -24); x.lineTo(18, 0); x.quadraticCurveTo(16, 18, 0, 28); x.quadraticCurveTo(-16, 18, -18, 0); x.closePath();
      x.fillStyle = grad(x, 0, 0, 26, '#9AA4B2'); x.fill(); x.lineWidth = 3; x.strokeStyle = '#4A525C'; x.stroke();
      rrg(x, -3, -18, 6, 38, 2, '#D9A441'); rrg(x, -14, -6, 28, 6, 2, '#D9A441');
      [[-13, -19], [13, -19], [-13, 6], [13, 6]].forEach(([a, b]) => ell(x, a, b, 2, 2, '#E8EDF3', {lw: 1}));
    },
    spear(x) {
      limb(x, [-20, 24, 12, -12], '#8A5C36', 4);
      const st = x.createLinearGradient(8, -10, 24, -28); st.addColorStop(0, '#8D96A3'); st.addColorStop(1, '#F2F6FA');
      x.beginPath(); x.moveTo(10, -10); x.quadraticCurveTo(14, -24, 26, -30); x.quadraticCurveTo(22, -16, 14, -6); x.closePath(); x.fillStyle = st; x.fill(); x.lineWidth = 2; x.strokeStyle = '#3E454E'; x.stroke();
      poly(x, [6, -6, 2, 6, 10, 2], '#C8323A', {lw: 1.2}); poly(x, [8, -4, 12, 8, 14, -2], '#E0414C', {lw: 1.2});
    },
    ring(x) {
      x.lineWidth = 7; x.strokeStyle = '#8A6A1E'; x.beginPath(); x.ellipse(0, 8, 16, 14, 0, 0, 7); x.stroke();
      const g = x.createLinearGradient(-16, -6, 16, 22); g.addColorStop(0, '#FFE9A0'); g.addColorStop(.5, '#D9A441'); g.addColorStop(1, '#8A6A1E');
      x.lineWidth = 4; x.strokeStyle = g; x.stroke();
      ell(x, 0, -8, 9, 8, '#2EC4B6');
      x.strokeStyle = '#E8FFFC'; x.lineWidth = 1.5; x.beginPath();
      for (let i = 0; i < 20; i++) { const a = i * .5, r = i * .3; if (i) x.lineTo(Math.cos(a) * r, -8 + Math.sin(a) * r); else x.moveTo(0, -8); }
      x.stroke();
    },
    flask(x) {
      rrg(x, -5, -26, 10, 12, 2, '#8A5C36');
      x.beginPath(); x.moveTo(-6, -14); x.lineTo(-6, -6); x.arc(0, 10, 18, -Math.PI / 2 - .35, Math.PI * 1.5 + .35, false); x.lineTo(6, -14); x.closePath();
      x.fillStyle = 'rgba(220,240,255,.35)'; x.fill(); x.lineWidth = 2.2; x.strokeStyle = '#5A6E7A'; x.stroke();
      x.save(); x.clip(); x.fillStyle = grad(x, 0, 18, 18, '#4FBF5A'); x.fillRect(-20, 6, 40, 30); x.restore();
      ell(x, -7, 2, 3, 6, 'rgba(255,255,255,.7)', {flat: true, noLine: true}); ell(x, 4, 16, 2, 2, '#C4F8B4', {flat: true, noLine: true});
      ell(x, 12, -14, 7, 3.5, '#5CC96A', {rot: -.6, lw: 1.2});
    },
    scroll(x) {
      rrg(x, -16, -16, 32, 32, 2, '#E9D8B4');
      ell(x, 0, -17, 19, 5, '#C9B48A'); ell(x, 0, 17, 19, 5, '#C9B48A');
      ell(x, 0, 0, 10, 6, '#FFFFFF', {lw: 1.6}); ell(x, 0, 0, 4, 4, '#3A7BD5', {lw: 1}); ell(x, 0, 0, 1.8, 1.8, '#111111', {flat: true, noLine: true});
      line(x, [-11, 10, 11, 10], 'rgba(90,60,30,.5)', 1.4);
    },
    horn(x) {
      x.beginPath(); x.moveTo(-22, 18); x.quadraticCurveTo(-18, -10, 14, -22); x.lineTo(22, -10); x.quadraticCurveTo(0, -2, -14, 22); x.closePath();
      x.fillStyle = grad(x, 0, 0, 24, '#E8B84A'); x.fill(); x.lineWidth = 2.4; x.strokeStyle = '#7A5A16'; x.stroke();
      ell(x, 18, -16, 6, 9, '#7A5A16', {rot: .6}); line(x, [-12, 4, -4, 10], '#9A7420', 2); line(x, [-4, -6, 4, 2], '#9A7420', 2);
    }
  };
  TR.relicIcon = function (x, id, cx, cy, size) {
    if (!RELIC[id]) return;
    x.save(); x.translate(cx, cy); x.scale(size / 64, size / 64); RELIC[id](x); x.restore();
  };

  // ---- pieces and panels ----
  TR.mini = function (x, type, cx, cy, s, style, pal, rune) {
    const m = MINOS[type][0], xs = m.map(c => c[0]), ys = m.map(c => c[1]);
    const w = Math.max.apply(null, xs) - Math.min.apply(null, xs) + 1, h = Math.max.apply(null, ys) - Math.min.apply(null, ys) + 1;
    const ox = cx - w * s / 2 - Math.min.apply(null, xs) * s, oy = cy - h * s / 2 - Math.min.apply(null, ys) * s;
    m.forEach(([c, r], i) => TR.cell(x, style, ox + c * s, oy + r * s, s, {t: type, s: i, rune: rune && rune.i === i ? rune.type : null}, pal, false));
  };
  TR.panel = function (x, X, Y, w, h, label, pal, stroke) {
    TR.rr(x, X, Y, w, h, 8);
    const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, lt(pal.panel, .05)); g.addColorStop(1, dk(pal.panel, .15)); x.fillStyle = g; x.fill();
    x.strokeStyle = stroke || pal.stroke; x.lineWidth = 1; x.stroke();
    if (label) TR.text(x, label, X + 10, Y + 18, TR.fm(10, 600), pal.muted);
  };
  TR.lockIcon = function (x, cx, cy, s, color) {
    x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = s * .12;
    x.beginPath(); x.arc(cx, cy - s * .12, s * .22, Math.PI, 0); x.stroke(); x.fillRect(cx - s * .32, cy - s * .1, s * .64, s * .46); x.restore();
  };

  // Board with flip animation, cascade, sweeping clear flash, ghost and active piece.
  // The last geometry is stored on the game so modes can aim particles at cleared rows.
  TR.drawBoard = function (x, g, o) {
    const {x0, y0, cs, pal, style} = o, W = cs * COLS, H = cs * VIS, P = g.phase, pt = g.pt;
    g.geo = {x0, y0, cs};
    const cx = x0 + W / 2, cy = y0 + H / 2;
    let sx = 1, sy = 1, k = 0;
    if (P === 'flip') { k = TR.ease(Math.min(1, pt / TR.T_FLIP)); sy = Math.cos(Math.PI * k); sx = 1 + .06 * Math.sin(Math.PI * k); }
    x.save();
    x.translate(cx, cy); x.scale(sx, Math.abs(sy) < .002 ? .002 : sy); x.translate(-cx, -cy);
    const face = P === 'flip' && k > .5;
    TR.rr(x, x0 - 6, y0 - 6, W + 12, H + 12, 8);
    const bg = x.createLinearGradient(0, y0, 0, y0 + H); bg.addColorStop(0, lt(pal.board, .04)); bg.addColorStop(1, dk(pal.board, .25)); x.fillStyle = bg; x.fill();
    let stroke = o.accent || pal.stroke;
    const danger = g.stackTop() < HID + 4 && !g.over;
    if (danger) stroke = TR.alpha(pal.danger, .55 + .35 * Math.sin(g.time * 8));
    if (P === 'flipWarn' || P === 'flip') stroke = TR.alpha(pal.gold, .55 + .45 * Math.sin(pt * 22));
    x.strokeStyle = stroke; x.lineWidth = 2; x.stroke();
    x.strokeStyle = pal.grid; x.lineWidth = 1; x.beginPath();
    for (let i = 1; i < COLS; i++) { x.moveTo(x0 + i * cs + .5, y0); x.lineTo(x0 + i * cs + .5, y0 + H); }
    for (let j = 1; j < VIS; j++) { x.moveTo(x0, y0 + j * cs + .5); x.lineTo(x0 + W, y0 + j * cs + .5); }
    x.stroke();
    x.save(); x.beginPath(); x.rect(x0, y0, W, H); x.clip();
    if (g.moves) {
      const q = TR.easeIn(Math.min(1, pt / TR.T_CASCADE));
      g.moves.forEach(m => TR.cell(x, style, x0 + m.x * cs, y0 + (m.from + (m.to - m.from) * q - HID) * cs, cs, m.v, pal, m.v.back));
    } else {
      for (let y = HID; y < ROWS; y++) for (let X = 0; X < COLS; X++) {
        const v = g.grid[y][X];
        if (v) TR.cell(x, style, x0 + X * cs, y0 + (y - HID) * cs, cs, v, pal, face ? !v.back : v.back);
      }
    }
    if (P === 'clear' && g.clearRows) {
      const q = Math.min(1, pt / g.o.clearDelay);
      g.clearRows.forEach(r => {
        const Y = y0 + (r - HID) * cs, sw = x.createLinearGradient(x0, 0, x0 + W, 0);
        sw.addColorStop(Math.max(0, q - .35), 'rgba(255,255,255,0)'); sw.addColorStop(Math.min(1, q), 'rgba(255,255,255,.95)'); sw.addColorStop(Math.min(1, q + .04), 'rgba(255,255,255,.3)');
        x.fillStyle = 'rgba(255,255,255,' + (.35 * q) + ')'; x.fillRect(x0, Y, W, cs);
        x.fillStyle = sw; x.fillRect(x0, Y, W, cs);
      });
    }
    if (g.piece && P === 'play') {
      const p = g.piece, gy = g.ghostY(), col = pal.piece[p.type];
      x.strokeStyle = col; x.globalAlpha = .45; x.lineWidth = 1.5;
      MINOS[p.type][p.rot].forEach(([c, r]) => x.strokeRect(x0 + (p.x + c) * cs + 2.5, y0 + (gy + r - HID) * cs + 2.5, cs - 5, cs - 5));
      x.globalAlpha = .08; x.fillStyle = col;
      MINOS[p.type][p.rot].forEach(([c, r]) => x.fillRect(x0 + (p.x + c) * cs + 2, y0 + (gy + r - HID) * cs + 2, cs - 4, cs - 4));
      x.globalAlpha = 1;
      MINOS[p.type][p.rot].forEach(([c, r], i) => TR.cell(x, style, x0 + (p.x + c) * cs, y0 + (p.y + r - HID) * cs, cs, {t: p.type, s: i, rune: p.rune && p.rune.i === i ? p.rune.type : null}, pal, false));
    }
    if (o.red > 0) { x.fillStyle = TR.alpha(pal.danger, o.red * .5); x.fillRect(x0, y0, W, H); }
    x.restore();
    x.restore();
  };

  // HOLD and NEXT panels shared by the modes.
  TR.drawHold = function (x, g, X, Y, w, h, cs, style, pal, label) {
    TR.panel(x, X, Y, w, h, label || 'HOLD', pal);
    const locked = g.holdLocked > 0;
    if (g.hold) { x.globalAlpha = (g.holdUsed || locked) ? .35 : 1; TR.mini(x, g.hold.type, X + w / 2, Y + h / 2 + 8, cs, style, pal, g.hold.rune); x.globalAlpha = 1; }
    if (locked) TR.lockIcon(x, X + w - 18, Y + 14, 16, pal.danger);
  };
  TR.drawNext = function (x, g, X, Y, w, h, n, cs, gap, style, pal) {
    TR.panel(x, X, Y, w, h, 'NEXT', pal);
    if (g.fog > 0) {
      x.fillStyle = TR.alpha(pal.muted, .25); TR.rr(x, X + 8, Y + 26, w - 16, h - 34, 6); x.fill();
      TR.text(x, 'HIDDEN', X + w / 2, Y + h / 2 + 4, TR.fm(11, 600), pal.soft, 'center');
      TR.text(x, g.fog + ' more', X + w / 2, Y + h / 2 + 20, TR.fm(10), pal.muted, 'center');
      return;
    }
    g.queue.slice(0, n).forEach((t, i) => TR.mini(x, t, X + w / 2, Y + 40 + i * gap + (i ? 4 : 0), i ? cs : cs * 1.1, style, pal));
  };

  // ---- monsters: drawn around (0,0), feet near y = 78, about 170 px tall at scale 1 ----
  const MON = {
    slime(x, t) {
      const w = Math.sin(t * 3) * 4; shadow(x, 66);
      x.save(); x.translate(0, 74); x.scale(1 + w * .012, 1 - w * .012); x.translate(0, -74);
      x.beginPath(); x.moveTo(-66, 72); x.bezierCurveTo(-80, 4, -38, -48, 0, -48); x.bezierCurveTo(38, -48, 80, 4, 66, 72); x.quadraticCurveTo(0, 82, -66, 72);
      const g = x.createRadialGradient(-26, -22, 4, 0, 14, 96); g.addColorStop(0, '#C4F8B4'); g.addColorStop(.45, '#5CC96A'); g.addColorStop(1, '#2A7639');
      x.fillStyle = g; x.fill(); x.lineWidth = 3; x.strokeStyle = '#1F5A2A'; x.stroke();
      const a = x.globalAlpha;
      for (let i = 0; i < 5; i++) { const ph = (t * .45 + i * .37) % 1; x.globalAlpha = a * .4 * (1 - ph); ell(x, -30 + i * 15 + Math.sin(t + i) * 4, 62 - ph * 92, 3 + i % 3, 3 + i % 3, '#E8FFE0', {flat: true, noLine: true}); }
      x.globalAlpha = a;
      x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-30, -20, 16, 8, -.6, 0, 7); x.fill(); x.beginPath(); x.ellipse(-46, -2, 4, 3, -.6, 0, 7); x.fill();
      const b = blink(t, .3); eye(x, -18, 12, 10, '#1E3A22', 0, b); eye(x, 18, 12, 10, '#1E3A22', 0, b);
      x.globalAlpha = a * .6; ell(x, -32, 28, 7, 4, '#FF9FB0', {flat: true, noLine: true}); ell(x, 32, 28, 7, 4, '#FF9FB0', {flat: true, noLine: true}); x.globalAlpha = a;
      x.strokeStyle = '#1F5A2A'; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath(); x.arc(0, 28, 8, .25, Math.PI - .25); x.stroke();
      x.restore();
    },
    goblin(x, t) {
      shadow(x, 46);
      const bob = Math.sin(t * 4) * 3, b = blink(t, 1.1);
      limb(x, [-11, 48, -13, 68], '#6E9A40', 10); limb(x, [11, 48, 13, 68], '#6E9A40', 10);
      ell(x, -15, 73, 12, 6, '#5E8A38'); ell(x, 15, 73, 12, 6, '#5E8A38');
      limb(x, [-24, 22, -42, 44], '#7FB04A', 10);
      poly(x, [-26, 12, 26, 12, 34, 56, -34, 56], '#8A5C36');
      rrg(x, -34, 34, 68, 8, 3, '#5A3C24'); rrg(x, -6, 33, 12, 10, 2, '#D9A441');
      ell(x, 20, 48, 8, 7, '#7A5232');
      poly(x, [-26, -30, -86, -52, -36, -4], '#7FB04A'); poly(x, [26, -30, 86, -52, 36, -4], '#7FB04A');
      poly(x, [-32, -26, -70, -44, -36, -12], '#E39A8C', {noLine: true}); poly(x, [32, -26, 70, -44, 36, -12], '#E39A8C', {noLine: true});
      ell(x, 0, -18, 38, 33, '#8DBF55');
      [[-22, -40, 3], [18, -42, 2.5], [26, -8, 2.5]].forEach(([a, c, r]) => ell(x, a, c, r, r, '#6E9A40', {lw: 1}));
      if (b) { line(x, [-22, -24, -5, -22], '#1A1A1A', 2.6); line(x, [22, -24, 5, -22], '#1A1A1A', 2.6); }
      else [-13, 13].forEach(a => { ell(x, a, -24, 10, 7.5, '#F4E04D', {lw: 2}); ell(x, a, -24, 2.6, 6, '#1A1A1A', {flat: true, noLine: true}); ell(x, a - 3, -26, 1.8, 1.8, '#FFFFFF', {flat: true, noLine: true}); });
      line(x, [-26, -38, -6, -31], '#3D5A20', 4.5); line(x, [26, -38, 6, -31], '#3D5A20', 4.5);
      ell(x, 0, -9, 8, 10, '#7AAE48');
      x.fillStyle = '#3A1A12'; x.beginPath(); x.moveTo(-18, 2); x.quadraticCurveTo(0, 19, 18, 2); x.closePath(); x.fill();
      poly(x, [-12, 3, -9, 10, -6, 4], '#F2EBD8', {lw: 1}); poly(x, [6, 4, 9, 10, 12, 3], '#F2EBD8', {lw: 1});
      limb(x, [24, 22, 42, 40 + bob], '#7FB04A', 10);
      const bl = x.createLinearGradient(44, 40, 76, 6); bl.addColorStop(0, '#8D96A3'); bl.addColorStop(.5, '#E8EDF3'); bl.addColorStop(1, '#9AA3B0');
      x.beginPath(); x.moveTo(44, 36 + bob); x.lineTo(76, 4 + bob); x.lineTo(80, 10 + bob); x.lineTo(50, 42 + bob); x.closePath(); x.fillStyle = bl; x.fill(); x.lineWidth = 2; x.strokeStyle = '#4A525C'; x.stroke();
      line(x, [38, 34 + bob, 52, 48 + bob], '#8A6A2A', 5);
    },
    wolf(x, t) {
      shadow(x, 80);
      const wag = Math.sin(t * 6) * 8, b = blink(t, 2.2);
      limb(x, [52, 6, 74, -2, 86, -16 + wag * .5, 84, -36 + wag], '#565E6B', 13);
      limb(x, [24, 28, 24, 72], '#4E5560', 12); limb(x, [44, 26, 48, 72], '#4E5560', 12);
      ell(x, 6, 16, 62, 33, '#626A78');
      const back = [-36, -10]; for (let i = 0; i < 7; i++) back.push(-30 + i * 13, -22 - (i % 2) * 8, -24 + i * 13, -12);
      poly(x, back.concat([52, -4, 52, 4, -36, 4]), '#4E5560', {lw: 2});
      limb(x, [-36, 30, -38, 72], '#565E6B', 12); limb(x, [-18, 32, -18, 72], '#565E6B', 12);
      [-38, -18].forEach(a => ell(x, a, 74, 9, 5, '#4E5560'));
      poly(x, [-48, 4, -18, 6, -14, 40, -26, 32, -32, 48, -42, 30, -50, 34], '#A4ACB8');
      ell(x, -48, -14, 31, 27, '#626A78');
      poly(x, [-64, -30, -60, -64, -46, -36], '#4E5560'); poly(x, [-42, -36, -34, -64, -28, -32], '#4E5560');
      poly(x, [-61, -36, -59, -54, -51, -38], '#C98B8B', {noLine: true});
      ell(x, -79, -4, 25, 14, '#737B89');
      ell(x, -101, -8, 6.5, 5, '#15161A'); ell(x, -103, -10, 2, 1.5, '#FFFFFF', {flat: true, noLine: true});
      line(x, [-96, 5, -64, 7], '#15161A', 3);
      poly(x, [-90, 5, -87, 15, -84, 5], '#F2EBD8', {lw: 1}); poly(x, [-77, 6, -74, 16, -71, 6], '#F2EBD8', {lw: 1});
      glow(x, -54, -20, 16, '255,210,80', .35);
      if (b) line(x, [-60, -20, -48, -19], '#15161A', 2.6);
      else { ell(x, -54, -20, 7, 5, '#FFD24A', {lw: 1.6}); ell(x, -54, -20, 2, 4.3, '#15161A', {flat: true, noLine: true}); }
      line(x, [-64, -27, -46, -25], '#3A404A', 3);
    },
    spider(x, t) {
      x.strokeStyle = 'rgba(220,214,235,.5)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, -240); x.lineTo(0, -44); x.stroke();
      shadow(x, 74);
      const k = Math.sin(t * 5) * 3, m = Math.sin(t * 6) * 2;
      [-1, 1].forEach(s => {
        for (let i = 0; i < 4; i++) {
          const kx = s * (48 + i * 8), ky = -16 + i * 14 + (i % 2 ? k : -k);
          limb(x, [s * 16, 14 + i * 7, kx, ky], '#4A3866', 6); limb(x, [kx, ky, s * (68 + i * 6), 74], '#4A3866', 5); ell(x, kx, ky, 4.5, 4.5, '#6A5490', {lw: 1.4});
        }
      });
      ell(x, 0, -6, 48, 42, '#3E2D52');
      poly(x, [-10, -26, 10, -26, 0, -8], '#E0414C', {lw: 1.6}); poly(x, [-10, 10, 10, 10, 0, -8], '#E0414C', {lw: 1.6});
      [[-26, -14, 6], [26, -10, 5], [-20, 14, 4], [22, 18, 4]].forEach(([a, c, r]) => ell(x, a, c, r, r * .8, '#6A5490', {lw: 1}));
      x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.ellipse(-18, -28, 15, 7, -.5, 0, 7); x.fill();
      ell(x, 0, 38, 28, 22, '#4B3863');
      poly(x, [-10, 52, -6 - m, 68, -1, 52], '#E9DFC6', {lw: 1.4}); poly(x, [1, 52, 6 + m, 68, 10, 52], '#E9DFC6', {lw: 1.4});
      glow(x, 0, 32, 22, '255,60,80', .25);
      [-9, 9].forEach(a => { ell(x, a, 34, 5.5, 5.5, '#FF4D5E', {lw: 1.4}); ell(x, a - 1.5, 32, 1.6, 1.6, '#FFFFFF', {flat: true, noLine: true}); });
      [-18, -6, 6, 18].forEach(a => ell(x, a, 24, 2.8, 2.8, '#FF4D5E', {lw: 1}));
    },
    golem(x, t) {
      shadow(x, 90);
      const sw = Math.sin(t * 1.5) * 3, g = .6 + .4 * Math.sin(t * 3), cyan = 'rgba(110,235,255,' + g + ')';
      for (let i = 0; i < 3; i++) { const a = t * .8 + i * 2.1, rx = Math.cos(a) * 100, ry = -46 + Math.sin(a) * 14; poly(x, [rx - 8, ry - 4, rx - 2, ry - 10, rx + 8, ry - 6, rx + 9, ry + 5, rx - 4, ry + 8], '#7D7F86', {lw: 1.6}); }
      rrg(x, -44, 46, 30, 32, 6, '#6A6C73'); rrg(x, 14, 46, 30, 32, 6, '#6A6C73');
      rrg(x, -100, -26 + sw, 38, 80, 14, '#7D7F86'); rrg(x, 62, -26 - sw, 38, 80, 14, '#7D7F86');
      ell(x, -81, 58 + sw, 24, 18, '#6A6C73'); ell(x, 81, 58 - sw, 24, 18, '#6A6C73');
      rrg(x, -66, -52, 132, 104, 22, '#8A8C93');
      line(x, [-44, -34, -30, -12, -40, 10], '#55575E', 3); line(x, [32, 18, 44, 34, 30, 48], '#55575E', 3); line(x, [-52, 26, -36, 30], '#55575E', 2.5);
      ell(x, -46, -48, 21, 9, '#5E8A4A'); ell(x, 42, -44, 15, 7, '#5E8A4A'); ell(x, -88, -22 + sw, 12, 6, '#5E8A4A');
      glow(x, 0, 4, 44, '110,235,255', .3 * g);
      x.lineJoin = 'round'; x.strokeStyle = 'rgba(110,235,255,' + .35 * g + ')'; x.lineWidth = 10; x.beginPath(); x.moveTo(0, -18); x.lineTo(16, 4); x.lineTo(0, 26); x.lineTo(-16, 4); x.closePath(); x.stroke();
      x.strokeStyle = cyan; x.lineWidth = 3.5; x.stroke();
      rrg(x, -34, -94, 68, 48, 14, '#7D7F86');
      rrg(x, -28, -84, 56, 7, 3, '#5E6067');
      glow(x, -14, -70, 14, '110,235,255', .45 * g); glow(x, 14, -70, 14, '110,235,255', .45 * g);
      x.fillStyle = cyan; x.fillRect(-21, -73, 13, 6); x.fillRect(8, -73, 13, 6);
    },
    orc(x, t) {
      shadow(x, 66);
      const a = Math.sin(t * 2) * .06, b = blink(t, 1.7);
      limb(x, [-18, 50, -20, 72], '#4A3A2A', 16); limb(x, [18, 50, 20, 72], '#4A3A2A', 16);
      ell(x, -21, 75, 13, 6, '#2E241A'); ell(x, 21, 75, 13, 6, '#2E241A');
      limb(x, [-56, 12, -66, 50], '#6E8B4E', 15); ell(x, -66, 54, 10, 9, '#6E8B4E');
      ell(x, 0, 32, 52, 36, '#6B4A30');
      rrg(x, -48, 44, 96, 8, 3, '#3E2A1C'); rrg(x, -8, 42, 16, 12, 3, '#D9A441');
      x.save(); x.translate(66, 54); x.rotate(a);
      limb(x, [0, 0, 4, -94], '#6B4A30', 7);
      const st = x.createLinearGradient(4, -108, 40, -64); st.addColorStop(0, '#E8EDF3'); st.addColorStop(1, '#8D96A3');
      x.beginPath(); x.moveTo(4, -94); x.lineTo(38, -110); x.quadraticCurveTo(48, -86, 40, -62); x.lineTo(4, -76); x.closePath(); x.fillStyle = st; x.fill(); x.lineWidth = 2.4; x.strokeStyle = '#3E454E'; x.stroke();
      line(x, [38, -106, 42, -64], 'rgba(255,255,255,.7)', 2);
      x.restore();
      limb(x, [56, 12, 64, 50], '#6E8B4E', 15);
      ell(x, -50, 6, 24, 17, '#7D828C'); ell(x, 50, 6, 24, 17, '#7D828C');
      poly(x, [-64, 0, -58, -20, -48, -2], '#C9CED6', {lw: 1.6}); poly(x, [64, 0, 58, -20, 48, -2], '#C9CED6', {lw: 1.6});
      ell(x, 0, -22, 36, 32, '#6E8B4E');
      x.beginPath(); x.arc(0, -30, 38, Math.PI, 0); x.closePath(); x.fillStyle = grad(x, 0, -48, 38, '#7D828C'); x.fill(); x.lineWidth = 2.4; x.strokeStyle = '#3E454E'; x.stroke();
      rrg(x, -39, -34, 78, 7, 3, '#5E636C');
      poly(x, [-30, -48, -48, -82, -22, -58], '#EFE3C4'); poly(x, [30, -48, 48, -82, 22, -58], '#EFE3C4');
      line(x, [-22, -16, -8, -12], '#C8323A', 3); line(x, [22, -16, 8, -12], '#C8323A', 3);
      rrg(x, -26, -28, 52, 7, 3, '#4E6A3A');
      if (b) { line(x, [-17, -19, -7, -19], '#1A1A1A', 2.4); line(x, [17, -19, 7, -19], '#1A1A1A', 2.4); }
      else { ell(x, -12, -19, 5, 4, '#FF6A3D', {lw: 1.4}); ell(x, 12, -19, 5, 4, '#FF6A3D', {lw: 1.4}); }
      ell(x, 0, -1, 23, 12, '#5E7A42');
      poly(x, [-15, 0, -13, -18, -8, 0], '#F2EBD8', {lw: 1.4}); poly(x, [15, 0, 13, -18, 8, 0], '#F2EBD8', {lw: 1.4});
    },
    minotaur(x, t) {
      shadow(x, 68);
      const b = blink(t, .9), steam = t % 2.6, a0 = x.globalAlpha;
      limb(x, [-18, 52, -20, 72], '#5A3622', 18); limb(x, [18, 52, 20, 72], '#5A3622', 18);
      ell(x, -20, 75, 11, 6, '#2A1A12'); ell(x, 20, 75, 11, 6, '#2A1A12');
      limb(x, [-56, 12, -72, 48], '#7A4A2E', 17); ell(x, -73, 52, 11, 10, '#7A4A2E');
      ell(x, 0, 32, 58, 38, '#7A4A2E'); ell(x, 0, 36, 32, 24, '#9A6A48', {lw: 1.6});
      line(x, [0, 18, 0, 50], 'rgba(60,30,15,.5)', 2); line(x, [-14, 34, 14, 34], 'rgba(60,30,15,.4)', 2);
      poly(x, [-36, 52, 36, 52, 28, 72, -28, 72], '#3E2A4A'); rrg(x, -38, 48, 76, 7, 3, '#D9A441');
      limb(x, [56, 12, 72, 48], '#7A4A2E', 17); ell(x, 73, 52, 11, 10, '#7A4A2E');
      [-1, 1].forEach(s => {
        x.beginPath(); x.moveTo(s * 22, -44); x.quadraticCurveTo(s * 80, -50, s * 70, -98); x.quadraticCurveTo(s * 64, -60, s * 18, -32); x.closePath();
        x.fillStyle = grad(x, s * 50, -66, 34, '#EFE3C4'); x.fill(); x.lineWidth = 2.4; x.strokeStyle = '#8A7A5A'; x.stroke();
        line(x, [s * 46, -48, s * 50, -40], '#B5A57E', 2); line(x, [s * 58, -58, s * 64, -54], '#B5A57E', 2);
      });
      ell(x, -37, -30, 12, 6, '#6A3E24', {rot: -.4}); ell(x, 37, -30, 12, 6, '#6A3E24', {rot: .4});
      ell(x, 0, -26, 34, 32, '#6A3E24');
      poly(x, [-12, -56, 0, -46, 12, -56, 6, -40, -6, -40], '#4A2A18', {lw: 1.4});
      ell(x, 0, -4, 24, 17, '#B58A6A'); ell(x, -8, -2, 4, 3, '#3A2014', {flat: true, noLine: true}); ell(x, 8, -2, 4, 3, '#3A2014', {flat: true, noLine: true});
      x.strokeStyle = '#E8C25A'; x.lineWidth = 3.5; x.beginPath(); x.arc(0, 6, 7, 0, Math.PI); x.stroke();
      line(x, [-25, -43, -6, -36], '#3A2014', 4.5); line(x, [25, -43, 6, -36], '#3A2014', 4.5);
      if (b) { line(x, [-19, -31, -9, -31], '#1A1010', 2.4); line(x, [19, -31, 9, -31], '#1A1010', 2.4); }
      else { glow(x, -14, -31, 9, '255,60,60', .4); glow(x, 14, -31, 9, '255,60,60', .4); ell(x, -14, -31, 5, 4, '#E23B3B', {lw: 1.4}); ell(x, 14, -31, 5, 4, '#E23B3B', {lw: 1.4}); }
      if (steam < .9) { const k = steam / .9; x.globalAlpha = a0 * (1 - k) * .5; [-1, 1].forEach(s => ell(x, s * (10 + k * 26), 6 + k * 14, 4 + k * 8, 3 + k * 6, '#F2EEE8', {flat: true, noLine: true})); x.globalAlpha = a0; }
    },
    cyclops(x, t) {
      shadow(x, 68);
      const look = Math.sin(t * .9) * 4, b = blink(t, 2.9), tap = Math.max(0, Math.sin(t * 2.2)) * .12;
      limb(x, [-20, 52, -22, 72], '#9C7E5A', 18); limb(x, [20, 52, 22, 72], '#9C7E5A', 18);
      ell(x, -23, 75, 13, 6, '#7A6040'); ell(x, 23, 75, 13, 6, '#7A6040');
      limb(x, [-54, 8, -68, 42], '#C2A07A', 16); ell(x, -69, 46, 10, 9, '#C2A07A');
      ell(x, 0, 16, 60, 58, '#C2A07A');
      poly(x, [-50, 40, 50, 40, 40, 68, -40, 68], '#6B4A30');
      x.setLineDash([4, 4]); line(x, [-44, 46, 44, 46], '#3E2A1C', 1.6); x.setLineDash([]);
      x.save(); x.translate(74, 44); x.rotate(-.12 - tap);
      const wd = x.createLinearGradient(-8, 0, 16, -80); wd.addColorStop(0, '#5A3C24'); wd.addColorStop(1, '#8A5C36');
      x.beginPath(); x.moveTo(-5, 0); x.lineTo(5, 0); x.lineTo(16, -76); x.lineTo(-6, -80); x.closePath(); x.fillStyle = wd; x.fill(); x.lineWidth = 2.4; x.strokeStyle = '#3A2414'; x.stroke();
      ell(x, 5, -84, 16, 18, '#7A5232');
      line(x, [0, -30, 4, -60], 'rgba(40,20,10,.5)', 1.5);
      [[-6, -90], [14, -92], [16, -76]].forEach(([a, c]) => poly(x, [a - 3, c, a, c - 7, a + 3, c], '#DDD3BD', {lw: 1}));
      x.restore();
      limb(x, [54, 8, 72, 40], '#C2A07A', 16);
      poly(x, [-9, -36, 0, -62, 9, -36], '#EFE3C4');
      if (b) { ell(x, 0, -8, 25, 20, '#C2A07A'); line(x, [-22, -8, 0, -2, 22, -8], '#3A2414', 3); }
      else { ell(x, 0, -8, 25, 20, '#F7F3EA', {lw: 2.4}); ell(x, look, -6, 11, 11, '#3A7BD5', {lw: 1.6}); ell(x, look, -6, 5, 5, '#111111', {flat: true, noLine: true}); ell(x, look - 3, -9, 2.6, 2.6, '#FFFFFF', {flat: true, noLine: true}); }
      limb(x, [-30, -34, 0, -31, 30, -37], '#4A3524', 5);
      x.strokeStyle = '#4A2A1A'; x.lineWidth = 3; x.beginPath(); x.arc(0, 26, 14, .3, Math.PI - .3); x.stroke();
      poly(x, [4, 38, 8, 46, 12, 37], '#F2EBD8', {lw: 1});
    },
    troll(x, t) {
      shadow(x, 82);
      const s = Math.sin(t * 1.8) * 4, b = blink(t, 1.4);
      limb(x, [-22, 52, -24, 72], '#4C6B59', 20); limb(x, [22, 52, 24, 72], '#4C6B59', 20);
      ell(x, -26, 75, 15, 7, '#3E5A4A'); ell(x, 26, 75, 15, 7, '#3E5A4A');
      limb(x, [-62, 0, -84, 56 + s], '#5B7D6A', 18); limb(x, [62, 0, 84, 56 - s], '#5B7D6A', 18);
      ell(x, -86, 62 + s, 15, 11, '#4C6B59'); ell(x, 86, 62 - s, 15, 11, '#4C6B59');
      ell(x, 0, 20, 72, 54, '#5B7D6A'); ell(x, 0, 34, 42, 30, '#7A9A85', {lw: 1.6});
      [[-40, 4, 6], [44, 14, 5], [-20, 50, 4]].forEach(([a, c, r]) => ell(x, a, c, r, r * .8, '#4C6B59', {lw: 1}));
      poly(x, [-30, -36, -66, -48, -32, -20], '#5B7D6A'); poly(x, [30, -36, 66, -48, 32, -20], '#5B7D6A');
      ell(x, 0, -30, 38, 31, '#5B7D6A');
      [[-26, -54, 15], [-8, -60, 17], [12, -59, 16], [28, -50, 12]].forEach(([a, c, r]) => ell(x, a, c, r, r * .6, '#3E5A2E'));
      poly(x, [10, -66, 14, -74, 18, -66], '#7EB05A', {lw: 1});
      line(x, [-22, -42, -8, -39], '#2E4436', 4); line(x, [22, -42, 8, -39], '#2E4436', 4);
      if (b) { line(x, [-18, -35, -10, -35], '#1A1A1A', 2.4); line(x, [18, -35, 10, -35], '#1A1A1A', 2.4); }
      else { ell(x, -14, -35, 4.5, 4.5, '#F2D04A', {lw: 1.4}); ell(x, 14, -35, 4.5, 4.5, '#F2D04A', {lw: 1.4}); }
      ell(x, 0, -2, 20, 7, '#2A1A12', {lw: 1.6});
      ell(x, 0, -16, 10, 22, '#6E9280'); ell(x, -4, -6, 2, 2, '#4C6B59', {flat: true, noLine: true}); ell(x, 5, -14, 1.6, 1.6, '#4C6B59', {flat: true, noLine: true});
      poly(x, [-15, -2, -12, -17, -7, -2], '#E9DFC6', {lw: 1.4}); poly(x, [15, -2, 12, -17, 7, -2], '#E9DFC6', {lw: 1.4});
    },
    dragon(x, t) {
      const flap = Math.sin(t * 2.4) * .14, a0 = x.globalAlpha;
      shadow(x, 100);
      [-1, 1].forEach(s => {
        x.save(); x.translate(s * 22, -8); x.rotate(s * flap - s * .04);
        const mg = x.createLinearGradient(0, 0, s * 120, -40); mg.addColorStop(0, '#B3302A'); mg.addColorStop(1, '#5E1212');
        x.beginPath(); x.moveTo(0, 0); x.lineTo(s * 114, -76); x.quadraticCurveTo(s * 100, -48, s * 122, -24); x.quadraticCurveTo(s * 98, -14, s * 104, 30); x.quadraticCurveTo(s * 70, 14, s * 36, 22); x.closePath();
        x.fillStyle = mg; x.fill(); x.lineWidth = 2.6; x.strokeStyle = '#3A0A0A'; x.stroke();
        [[s * 122, -24], [s * 104, 30]].forEach(([a, c]) => line(x, [0, 0, a, c], '#5E1212', 3));
        limb(x, [0, 0, s * 114, -76], '#A52A22', 6);
        poly(x, [s * 114, -76, s * 124, -84, s * 118, -70], '#F2E3C0', {lw: 1.4});
        x.restore();
      });
      const tw = Math.sin(t * 3) * 6;
      limb(x, [30, 50, 56, 62, 80, 62, 98, 50, 104, 30 + tw], '#C8392B', 15);
      poly(x, [96, 32 + tw, 122, 18 + tw, 112, 42 + tw], '#7E1A16');
      ell(x, 44, 66, 18, 13, '#A52A22');
      ell(x, 10, 28, 56, 42, '#C8392B');
      x.strokeStyle = 'rgba(90,10,10,.35)'; x.lineWidth = 1.6;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { x.beginPath(); x.arc(22 + c * 12 - r * 6, 4 + r * 12, 6, Math.PI * .1, Math.PI * .9); x.stroke(); }
      ell(x, 0, 40, 31, 29, '#F2C27A');
      x.strokeStyle = '#D9A55A'; x.lineWidth = 2; [24, 34, 44, 54].forEach(y => { x.beginPath(); x.moveTo(-24, y); x.lineTo(24, y); x.stroke(); });
      ell(x, -32, 66, 18, 13, '#A52A22');
      [[-44, 74], [-34, 76], [-24, 74], [34, 74], [44, 76], [54, 74]].forEach(([a, c]) => poly(x, [a - 3, c - 3, a, c + 4, a + 3, c - 3], '#F2E3C0', {lw: 1}));
      limb(x, [2, 12, -12, -14, -24, -34, -34, -48], '#C8392B', 26);
      for (let i = 0; i < 4; i++) poly(x, [-2 - i * 9, 2 - i * 14, -8 - i * 9, -16 - i * 14, 6 - i * 9, -6 - i * 14], '#7E1A16', {lw: 1.4});
      poly(x, [-30, -78, -2, -110, -18, -72], '#F2E3C0'); poly(x, [-46, -80, -38, -114, -54, -78], '#F2E3C0');
      ell(x, -42, -60, 32, 25, '#C8392B'); ell(x, -75, -52, 27, 15, '#C8392B');
      poly(x, [-58, -76, -36, -82, -30, -72, -52, -68], '#7E1A16', {lw: 1.4});
      glow(x, -47, -66, 16, '255,210,80', .4);
      ell(x, -47, -66, 7.5, 5.5, '#FFD24A', {lw: 1.6}); ell(x, -47, -66, 2, 4.8, '#1A1A1A', {flat: true, noLine: true});
      ell(x, -94, -56, 3.2, 2.2, '#5E1212', {flat: true, noLine: true});
      line(x, [-99, -44, -58, -42], '#5E1212', 3);
      poly(x, [-92, -44, -89, -37, -86, -44], '#F2EBD8', {lw: 1}); poly(x, [-80, -44, -77, -37, -74, -44], '#F2EBD8', {lw: 1});
      for (let i = 0; i < 3; i++) { const ph = (t * .6 + i / 3) % 1; x.globalAlpha = a0 * (1 - ph) * .35; ell(x, -100 - ph * 22, -60 - ph * 34, 3 + ph * 7, 3 + ph * 7, '#BDB4AA', {flat: true, noLine: true}); }
      x.globalAlpha = a0;
    }
  };

  // Monster state: atk, hit, dead are seconds since that animation started, or -1.
  const IDLE = {atk: -1, hit: -1, dead: -1};
  TR.MON_IDLE = IDLE;
  function pose(st, t) {
    const p = {ox: 0, oy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, flash: 0};
    const br = Math.sin(t * 2.4); p.sy += br * .018; p.sx -= br * .012;
    if (st.atk >= 0 && st.atk < 1) {
      const k = st.atk;
      if (k < .28) { const u = easeOut(k / .28); p.ox = 16 * u; p.sy *= 1 - .08 * u; p.sx *= 1 + .06 * u; }
      else if (k < .42) { const u = (k - .28) / .14; p.ox = 16 - 76 * u; p.sx *= 1.06; p.sy *= 1.05; }
      else { const u = easeOut((k - .42) / .58); p.ox = -60 * (1 - u); }
    }
    if (st.hit >= 0 && st.hit < .5) { const u = st.hit / .5; p.flash = 1 - u; p.ox += 22 * Math.sin(Math.PI * Math.min(1, u * 2)) * (1 - u) + Math.sin(st.hit * 80) * 5 * (1 - u); p.rot += .08 * (1 - u); }
    if (st.dead >= 0) { const u = Math.min(1, st.dead / 1.1); p.rot += u * .35; p.oy += u * 26; p.alpha = 1 - u; p.sy *= 1 - .25 * u; p.flash = Math.max(p.flash, (1 - u) * .6); }
    return p;
  }
  function fireBall(x, cx, cy, r, i) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r), c = i < 4 ? ['#FFFBE0', 'rgba(255,226,122,0)'] : i < 9 ? ['#FFE27A', 'rgba(255,138,61,0)'] : ['#FF8A3D', 'rgba(200,41,30,0)'];
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  }
  // Each monster's signature attack, aimed left toward the board.
  function attackFx(x, id, k, t) {
    const u = (k - .3) / .7; if (u < 0 || u > 1) return; const a = 1 - u;
    x.save();
    if (id === 'dragon') {
      for (let i = 0; i < 16; i++) { const f = i / 15, d = 10 + f * 230 * Math.min(1, u * 2.2); x.globalAlpha = a * (1 - f * .55); fireBall(x, -100 - d, -44 + f * 22 + Math.sin(t * 30 + i) * 3, 5 + f * 26, i); }
    } else if (id === 'spider') {
      const px = -60 - u * 230, py = 40 - Math.sin(u * Math.PI) * 30;
      x.globalAlpha = a; line(x, [0, 52, px, py], 'rgba(240,240,255,.8)', 1.5);
      ell(x, px, py, 12, 12, '#F2F0FA', {lw: 1.4});
      for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; line(x, [px, py, px + Math.cos(an) * 16, py + Math.sin(an) * 16], 'rgba(255,255,255,.8)', 1.2); }
    } else if (id === 'cyclops') {
      if (u < .75) { const w = 1 - u / .75; x.globalAlpha = w; line(x, [0, -8, -330, 30], 'rgba(255,70,70,.55)', 18 * w); line(x, [0, -8, -330, 30], '#FFE0E0', 5 * w); glow(x, 0, -8, 30, '255,80,80', .6 * w); }
    } else if (id === 'golem') {
      x.globalAlpha = a; x.strokeStyle = '#D6C8B0'; x.lineWidth = 6 * a + 1; x.beginPath(); x.ellipse(0, 78, 30 + u * 240, 8 + u * 26, 0, 0, 7); x.stroke();
      for (let i = 0; i < 7; i++) { const an = Math.PI + i * Math.PI / 6, r = 40 + u * 160, h = 70 - Math.sin(u * Math.PI) * (30 + i * 6); poly(x, [Math.cos(an) * r - 5, h - 4, Math.cos(an) * r + 5, h, Math.cos(an) * r, h + 6], '#7D7F86', {lw: 1}); }
    } else if (id === 'wolf') {
      x.globalAlpha = a; const l = Math.min(1, u * 3);
      for (let i = 0; i < 3; i++) line(x, [-110 + i * 14, -40, -110 + i * 14 - 26 * l, -40 + 70 * l], '#FFFFFF', 4 * a + 1);
    } else if (id === 'goblin' || id === 'orc') {
      x.globalAlpha = a; x.strokeStyle = '#FFFFFF'; x.lineWidth = 8 * a + 1; x.lineCap = 'round';
      x.beginPath(); x.arc(-10, -10, 84, Math.PI * .65, Math.PI * .65 + Math.min(1, u * 2.5) * Math.PI * .7); x.stroke();
    } else if (id === 'minotaur') {
      for (let i = 0; i < 5; i++) { x.globalAlpha = a * .6; ell(x, 40 + i * 18 + u * 40, 70 - i * 3, 10 + u * 14, 7 + u * 8, '#B8AFA4', {flat: true, noLine: true}); }
      x.globalAlpha = a; for (let i = 0; i < 4; i++) line(x, [60 + i * 10, -20 + i * 18, 110 + i * 10 + u * 30, -20 + i * 18], 'rgba(255,255,255,.7)', 2);
    } else if (id === 'troll') {
      for (let i = 0; i < 3; i++) { const px = -40 - u * (200 + i * 30), py = 20 - Math.sin(u * Math.PI) * (60 + i * 20) + i * 10; poly(x, [px - 9, py - 4, px - 2, py - 11, px + 9, py - 5, px + 8, py + 7, px - 6, py + 8], '#7D7F86', {lw: 1.4}); }
    } else if (id === 'slime') {
      for (let i = 0; i < 9; i++) { const an = Math.PI * (.1 + i * .1); x.globalAlpha = a; ell(x, Math.cos(an) * 130 * u, 70 - Math.sin(an) * 110 * u + 120 * u * u, 5, 6, '#7FDA88', {lw: 1.2}); }
    }
    x.restore();
  }
  function hitFx(x, k) {
    if (k < 0 || k > .5) return; const u = k / .5;
    x.save(); x.globalAlpha = 1 - u;
    for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5 + .3, r0 = 18 + u * 30, r1 = r0 + 16 * (1 - u) + 4; line(x, [Math.cos(an) * r0, -10 + Math.sin(an) * r0, Math.cos(an) * r1, -10 + Math.sin(an) * r1], i % 2 ? '#FFFFFF' : '#FFD24A', 3); }
    x.restore();
  }
  function deathFx(x, k) {
    if (k < 0 || k > 1.4) return; const u = Math.min(1, k / 1.4);
    x.save(); for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6, r = 20 + u * 90; x.globalAlpha = (1 - u) * .7; ell(x, Math.cos(an) * r * 1.2, 10 + Math.sin(an) * r * .6 - u * 30, 8 + u * 16, 6 + u * 12, '#B8AFA4', {flat: true, noLine: true}); } x.restore();
  }
  // Elite monsters glow gold with a cool tint; Nightmare monsters are darkened and wrapped in purple.
  const TIER_FX = [null, {tint: 'rgba(70,110,200,.16)', aura: '255,200,90'}, {tint: 'rgba(60,0,80,.38)', aura: '170,60,255'}];
  let off = null, offR = 0;
  TR.drawMonster = function (x, id, cx, cy, sc, t, st, tier) {
    st = st || IDLE; tier = tier || 0;
    const p = pose(st, t), T = TIER_FX[tier];
    x.save();
    x.translate(cx + p.ox * sc, cy + p.oy * sc + 78 * sc); x.rotate(p.rot); x.scale(sc * p.sx, sc * p.sy); x.translate(0, -78);
    x.globalAlpha = p.alpha;
    if (T) glow(x, 0, -4, 125, T.aura, .2 + .08 * Math.sin(t * 3));
    if (p.flash > 0 || T) {
      const R = Math.max(1, Math.min(4, Math.round(devScale(x) * 4) / 4));
      if (!off || offR !== R) { off = off || document.createElement('canvas'); off.width = off.height = Math.ceil(320 * R); offR = R; }
      const o = off.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, off.width, off.height);
      o.setTransform(R, 0, 0, R, 160 * R, 160 * R); MON[id](o, t);
      o.globalCompositeOperation = 'source-atop';
      if (T) { o.fillStyle = T.tint; o.fillRect(-160, -160, 320, 320); }
      if (p.flash > 0) { o.fillStyle = 'rgba(255,255,255,' + (p.flash * .8) + ')'; o.fillRect(-160, -160, 320, 320); }
      x.drawImage(off, -160, -160, 320, 320);
    } else MON[id](x, t);
    if (tier === 2) for (let i = 0; i < 8; i++) { const ph = (t * .35 + i / 8) % 1; x.globalAlpha = p.alpha * Math.sin(ph * Math.PI) * .7; ell(x, Math.sin(i * 2.3 + t) * 80, 70 - ph * 170, 2.5, 2.5, '#C77DFF', {flat: true, noLine: true}); }
    x.globalAlpha = 1;
    if (st.atk >= 0) attackFx(x, id, st.atk, t);
    hitFx(x, st.hit);
    x.restore();
    if (st.dead >= 0) { x.save(); x.translate(cx, cy); x.scale(sc, sc); deathFx(x, st.dead); x.restore(); }
  };

  // ---- dungeon background per tier: brick wall, arch, floor (cached), torches and dust (live) ----
  const BG = [
    {wall: ['#191210', '#2C2019'], brick: '255,220,180', arch: '#3A2A20', door: ['#0A0605', '#1C130F'], floor: ['#2A1E17', '#120C09'], flame: ['#FFF3B0', '#FF9A3D', '232,69,44'], light: '255,140,60', dust: ['#E8D9C4', '#FFB46B']},
    {wall: ['#0F131B', '#1C2430'], brick: '190,215,255', arch: '#2C3850', door: ['#05070C', '#121826'], floor: ['#1A2230', '#0B0F16'], flame: ['#F0FBFF', '#7FD8FF', '60,140,255'], light: '90,170,255', dust: ['#CFE3FF', '#7FD8FF']},
    {wall: ['#140910', '#2A1020'], brick: '255,150,210', arch: '#3E1830', door: ['#060205', '#160810'], floor: ['#24101C', '#0E050A'], flame: ['#FBE8FF', '#C77DFF', '140,40,220'], light: '180,70,255', dust: ['#F0C8FF', '#FF6BD0']}
  ];
  function staticBg(x, W, H, B, archX, archR) {
    const wall = x.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, B.wall[0]); wall.addColorStop(1, B.wall[1]); x.fillStyle = wall; x.fillRect(0, 0, W, H);
    const r = TR.rng(7), bh = 24, bw = 52, fy = H - Math.min(40, H * .16);
    for (let y = 0, row = 0; y < fy; y += bh, row++) for (let X = -(row % 2) * bw / 2; X < W; X += bw) {
      x.fillStyle = 'rgba(' + B.brick + ',' + (.015 + r() * .035) + ')'; x.fillRect(X + 2, y + 2, bw - 4, bh - 4);
      x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2; x.strokeRect(X + 1, y + 1, bw - 2, bh - 2);
    }
    const ax = archX, ar = archR;
    x.beginPath(); x.moveTo(ax - ar, fy); x.lineTo(ax - ar, fy - ar * .55); x.arc(ax, fy - ar * .55, ar, Math.PI, 0); x.lineTo(ax + ar, fy); x.closePath();
    const dg = x.createLinearGradient(0, fy - ar * 1.5, 0, fy); dg.addColorStop(0, B.door[0]); dg.addColorStop(1, B.door[1]); x.fillStyle = dg; x.fill();
    x.lineWidth = Math.max(6, ar * .07); x.strokeStyle = B.arch; x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const an = Math.PI + i * Math.PI / 8, w = Math.max(4, ar * .04); x.beginPath(); x.moveTo(ax + Math.cos(an) * (ar - w), fy - ar * .55 + Math.sin(an) * (ar - w)); x.lineTo(ax + Math.cos(an) * (ar + w), fy - ar * .55 + Math.sin(an) * (ar + w)); x.stroke(); }
    const fl = x.createLinearGradient(0, fy, 0, H); fl.addColorStop(0, B.floor[0]); fl.addColorStop(1, B.floor[1]); x.fillStyle = fl; x.fillRect(0, fy, W, H - fy);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
    for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(W / 2 + i * W * .045, fy); x.lineTo(W / 2 + i * W * .14, H); x.stroke(); }
    x.fillStyle = B.arch; x.fillRect(0, fy, W, 2);
  }
  TR.torch = function (x, X, Y, t, i, tier) {
    const B = BG[tier || 0], f = 1 + .14 * Math.sin(t * 13 + i * 3) + .08 * Math.sin(t * 7.3 + i);
    x.save(); x.globalCompositeOperation = 'lighter'; glow(x, X, Y - 6, 90 * f, B.light, .16); x.restore();
    rrg(x, X - 4, Y, 8, 30, 3, '#4A3526'); rrg(x, X - 9, Y - 2, 18, 7, 3, '#5A4130');
    const fg = x.createRadialGradient(X, Y - 6, 1, X, Y - 10 * f, 16 * f); fg.addColorStop(0, B.flame[0]); fg.addColorStop(.5, B.flame[1]); fg.addColorStop(1, 'rgba(' + B.flame[2] + ',0)');
    x.fillStyle = fg; x.beginPath(); x.ellipse(X, Y - 10 * f, 9, 16 * f, 0, 0, 7); x.fill();
  };
  TR.dungeonBg = function (x, X, Y, W, H, t, tier, opts) {
    opts = opts || {}; tier = tier || 0;
    const B = BG[tier], ax = opts.archX != null ? opts.archX : W * .5, ar = opts.archR || Math.min(170, W * .36);
    const R = Math.max(1, Math.min(4, Math.round(devScale(x) * 2) / 2));
    x.drawImage(sprite('bg' + tier + '|' + ax + '|' + ar, W, H, R, cx => staticBg(cx, W, H, B, ax, ar)), X, Y, W, H);
    x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.translate(X, Y);
    const fy = H - Math.min(40, H * .16);
    (opts.torches || [W * .08, W * .92]).forEach((tx, i) => TR.torch(x, tx, fy - Math.min(80, H * .3), t, i, tier));
    const n = opts.dust == null ? 22 : opts.dust;
    for (let i = 0; i < n; i++) {
      const s = TR.rng(100 + i)(), ph = (t * (.05 + s * .08) + s) % 1;
      x.globalAlpha = .5 * Math.sin(ph * Math.PI); x.fillStyle = i % 3 ? B.dust[0] : B.dust[1];
      x.beginPath(); x.arc(((s * 997) % 1) * W + Math.sin(t + i) * 8, H - ph * H, 1 + (i % 3) * .6, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    const v = x.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .3, W / 2, H * .55, Math.max(W, H) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
    x.restore();
  };

  // ---- logo: TETR1S in 3x5 block letters ----
  const GLYPH = {
    T: ['111', '010', '010', '010', '010'], E: ['111', '100', '110', '100', '111'], R: ['110', '101', '110', '101', '101'],
    '1': ['010', '110', '010', '010', '111'], S: ['011', '100', '010', '001', '110']
  };
  const LOGO_COL = ['#46D7E8', '#FF6B8B', '#5EE0A0', '#B794F6', '#FFD166', '#FF9F5A'];
  TR.drawLogo = function (x, X, Y, cs, t) {
    const word = 'TETR1S';
    const cyc = t % 7, k = cyc > 5.6 ? (cyc - 5.6) / 1.4 : 0, sy = Math.cos(2 * Math.PI * TR.ease(k));
    const W = word.length * 4 * cs - cs, H = 5 * cs;
    x.save(); x.translate(X + W / 2, Y + H / 2); x.scale(1, Math.abs(sy) < .01 ? .01 : sy); x.translate(-(X + W / 2), -(Y + H / 2));
    for (let i = 0; i < word.length; i++) {
      const g = GLYPH[word[i]];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') TR.cellFlip(x, X + (i * 4 + c) * cs, Y + r * cs, cs, LOGO_COL[i], sy < 0);
    }
    x.restore();
    return {w: W, h: H};
  };
  TR.logoSize = cs => ({w: 6 * 4 * cs - cs, h: 5 * cs});

  // ---- floating text, projectiles, block particles and confetti ----
  class Fx {
    constructor() { this.items = []; this.shots = []; this.parts = []; }
    pop(text, X, Y, color, size, opts) { this.items.push(Object.assign({text, X, Y, color, size: size || 16, life: 1.1, t: 0, mono: false, outline: false}, opts || {})); }
    shot(x0, y0, x1, y1, color, onArrive, dur) { this.shots.push({x0, y0, x1, y1, color, onArrive, t: 0, dur: dur || .55}); }
    // Pieces of cleared rows fly out after the sweep reaches them.
    burst(points, scale) {
      const k = scale || 1;
      points.forEach(p => { for (let i = 0; i < 3; i++) this.parts.push({x: p.x, y: p.y, vx: (Math.random() - .5) * 340 * k, vy: (-120 - Math.random() * 260) * k, g: 520 * k, r: 0, vr: (Math.random() - .5) * 12, s: (4 + Math.random() * 5) * k, c: p.c, t: -(p.delay || 0), life: 1.1}); });
    }
    confetti(W, H, n) {
      const cols = ['#FFD166', '#FF6B8B', '#46D7E8', '#5EE0A0', '#B794F6', '#FF9F5A'];
      for (let i = 0; i < (n || 90); i++) this.parts.push({x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 60, vy: 60 + Math.random() * 90, g: 30, r: Math.random() * 6, vr: (Math.random() - .5) * 8, s: 5 + Math.random() * 5, c: cols[i % cols.length], t: 0, life: 4 + Math.random() * 2, flat: true});
    }
    update(dt) {
      this.items.forEach(f => { f.t += dt; }); this.items = this.items.filter(f => f.t < f.life);
      this.shots.forEach(s => { s.t += dt; });
      const done = this.shots.filter(s => s.t >= s.dur); this.shots = this.shots.filter(s => s.t < s.dur);
      done.forEach(s => { if (s.onArrive) s.onArrive(); });
      this.parts.forEach(p => { p.t += dt; if (p.t < 0) return; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.r += p.vr * dt; if (p.flat) p.vx += Math.sin(p.t * 3 + p.r) * 20 * dt; });
      this.parts = this.parts.filter(p => p.t < p.life);
    }
    draw(x) {
      this.parts.forEach(p => {
        if (p.t < 0) return;
        x.save(); x.globalAlpha = Math.max(0, Math.min(1, (p.life - p.t) / .4)); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
        if (p.flat) x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); else x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        x.restore();
      });
      this.shots.forEach(s => {
        for (let j = 0; j < 6; j++) {
          const k = Math.max(0, s.t / s.dur - j * .035), u = 1 - k, mx = (s.x0 + s.x1) / 2, my = Math.min(s.y0, s.y1) - 90;
          const px = u * u * s.x0 + 2 * u * k * mx + k * k * s.x1, py = u * u * s.y0 + 2 * u * k * my + k * k * s.y1;
          x.globalAlpha = 1 - j / 6; x.fillStyle = s.color; x.beginPath(); x.arc(px, py, 6 - j * .7, 0, 7); x.fill();
        }
        x.globalAlpha = 1;
      });
      this.items.forEach(f => {
        const k = f.t / f.life, sc = f.bounce ? 1 + .4 * Math.max(0, 1 - k * 6) : 1, Y = f.Y - k * 24;
        x.save(); x.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3; x.translate(f.X, Y); x.scale(sc, sc);
        x.font = f.mono ? TR.fm(f.size, 600) : TR.fd(f.size); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        if (f.outline) { x.lineWidth = Math.max(3, f.size * .22); x.lineJoin = 'round'; x.strokeStyle = 'rgba(20,10,8,.9)'; x.strokeText(f.text, 0, 0); }
        x.fillStyle = f.color; x.fillText(f.text, 0, 0);
        x.restore();
      });
    }
  }
  TR.Fx = Fx;
})(window.TR);
