// Everything drawn on the canvas: palettes, blocks, boards, panels, runes, relics, monsters, logo, effects.
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

  // ---- blocks ----
  TR.cellFlip = function (x, X, Y, s, color, back) {
    const e = Math.max(2, Math.round(s * .15));
    if (!back) {
      x.fillStyle = color; x.fillRect(X + 1, Y + 1, s - 2, s - 2);
      x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(X + 1, Y + 1, s - 2, e);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(X + 1, Y + s - 1 - e, s - 2, e);
      return;
    }
    x.fillStyle = TR.mix(color, '#0A0F22', .62); x.fillRect(X + 1, Y + 1, s - 2, s - 2);
    x.save(); x.beginPath(); x.rect(X + 2, Y + 2, s - 4, s - 4); x.clip();
    x.strokeStyle = color; x.globalAlpha = .6; x.lineWidth = 1.2; x.beginPath();
    for (let i = -s; i < s; i += 5) { x.moveTo(X + i, Y + s); x.lineTo(X + i + s, Y); }
    x.stroke(); x.restore();
    x.strokeStyle = color; x.lineWidth = 1.4; x.strokeRect(X + 2.2, Y + 2.2, s - 4.4, s - 4.4);
  };
  TR.cellStone = function (x, X, Y, s, color, back) {
    x.fillStyle = back ? TR.mix(color, '#120C09', .45) : color; x.fillRect(X + 1, Y + 1, s - 2, s - 2);
    x.fillStyle = 'rgba(255,240,220,.22)'; x.fillRect(X + 1, Y + 1, s - 2, 2); x.fillRect(X + 1, Y + 1, 2, s - 2);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X + 1, Y + s - 3, s - 2, 2); x.fillRect(X + s - 3, Y + 1, 2, s - 2);
    if (back) { x.strokeStyle = TR.alpha('#FFE2B0', .35); x.lineWidth = 1; x.beginPath(); x.moveTo(X + 4, Y + s - 4); x.lineTo(X + s - 4, Y + 4); x.stroke(); }
  };
  TR.cellGarbage = function (x, X, Y, s, pal) {
    x.fillStyle = pal.garbage; x.fillRect(X + 1, Y + 1, s - 2, s - 2);
    x.strokeStyle = pal.garbageLine; x.lineWidth = 1; x.beginPath(); x.moveTo(X + 3, Y + s - 3); x.lineTo(X + s - 3, Y + 3); x.stroke();
  };
  TR.cell = function (x, style, X, Y, s, v, pal, back) {
    if (v.t === 'G') TR.cellGarbage(x, X, Y, s, pal);
    else if (style === 'stone') TR.cellStone(x, X, Y, s, pal.piece[v.t], back);
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

  // ---- relics ----
  TR.relicIcon = function (x, id, cx, cy, s, color) {
    x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = Math.max(1.5, s * .08); x.lineCap = 'round'; x.lineJoin = 'round';
    const L = (a, b, c, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
    if (id === 'keris') {
      x.beginPath(); x.moveTo(cx - s * .38, cy + s * .38);
      for (let i = 1; i <= 6; i++) { const f = i / 6, w = (i % 2 ? 1 : -1) * s * .08; x.lineTo(cx - s * .38 + f * s * .76 + w, cy + s * .38 - f * s * .76 + w); }
      x.stroke(); x.lineWidth *= 1.6; L(cx - s * .46, cy + s * .22, cx - s * .22, cy + s * .46);
    } else if (id === 'jimat') {
      x.beginPath(); x.arc(cx, cy, s * .38, 0, 7); x.stroke();
      x.beginPath(); x.moveTo(cx, cy - s * .2); x.lineTo(cx + s * .18, cy + s * .14); x.lineTo(cx - s * .18, cy + s * .14); x.closePath(); x.fill();
    } else if (id === 'akik') {
      x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(cx + Math.cos(a) * s * .38, cy + Math.sin(a) * s * .38); } x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.arc(cx - s * .1, cy - s * .1, s * .09, 0, 7); x.fill();
    } else if (id === 'gong') {
      x.beginPath(); x.arc(cx, cy, s * .38, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, s * .13, 0, 7); x.fill();
    } else if (id === 'batik') {
      x.strokeRect(cx - s * .36, cy - s * .36, s * .72, s * .72);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * s * .13, cy + Math.sin(a) * s * .13, s * .12, s * .06, a, 0, 7); x.fill(); }
    } else if (id === 'bambu') {
      L(cx - s * .36, cy + s * .36, cx + s * .2, cy - s * .2);
      x.beginPath(); x.moveTo(cx + s * .4, cy - s * .4); x.lineTo(cx + s * .12, cy - s * .26); x.lineTo(cx + s * .26, cy - s * .12); x.closePath(); x.fill();
      L(cx - s * .2, cy + s * .08, cx - s * .08, cy + s * .2);
    } else if (id === 'wayang') {
      x.beginPath(); x.ellipse(cx, cy, s * .3, s * .4, 0, 0, 7); x.stroke();
      x.beginPath(); x.ellipse(cx - s * .12, cy - s * .06, s * .08, s * .04, -.3, 0, 7); x.ellipse(cx + s * .12, cy - s * .06, s * .08, s * .04, .3, 0, 7); x.fill();
      L(cx - s * .1, cy + s * .2, cx + s * .1, cy + s * .2);
    } else if (id === 'kendi') {
      x.beginPath(); x.arc(cx, cy + s * .1, s * .3, 0, 7); x.fill(); x.fillRect(cx - s * .08, cy - s * .38, s * .16, s * .24);
      L(cx + s * .24, cy - s * .02, cx + s * .44, cy - s * .2);
    } else if (id === 'lontar') {
      x.strokeRect(cx - s * .4, cy - s * .2, s * .8, s * .4);
      L(cx - s * .28, cy - s * .06, cx + s * .28, cy - s * .06); L(cx - s * .28, cy + s * .07, cx + s * .16, cy + s * .07);
    } else {
      L(cx - s * .38, cy + s * .34, cx + s * .38, cy + s * .34);
      [-.26, 0, .26].forEach((o, i) => { x.strokeRect(cx + s * o - s * .07, cy - s * (.36 - i * .08), s * .14, s * (.62 - i * .08)); });
    }
    x.restore();
  };

  // ---- pieces and panels ----
  TR.mini = function (x, type, cx, cy, s, style, pal, rune) {
    const m = MINOS[type][0], n = type === 'I' ? 4 : type === 'O' ? 2 : 3;
    const xs = m.map(c => c[0]), ys = m.map(c => c[1]);
    const w = Math.max.apply(null, xs) - Math.min.apply(null, xs) + 1, h = Math.max.apply(null, ys) - Math.min.apply(null, ys) + 1;
    const ox = cx - w * s / 2 - Math.min.apply(null, xs) * s, oy = cy - h * s / 2 - Math.min.apply(null, ys) * s;
    m.forEach(([c, r], i) => TR.cell(x, style, ox + c * s, oy + r * s, s, {t: type, rune: rune && rune.i === i ? rune.type : null}, pal, false));
    return n;
  };
  TR.panel = function (x, X, Y, w, h, label, pal, stroke) {
    TR.rr(x, X, Y, w, h, 8); x.fillStyle = pal.panel; x.fill(); x.strokeStyle = stroke || pal.stroke; x.lineWidth = 1; x.stroke();
    if (label) TR.text(x, label, X + 10, Y + 18, TR.fm(10, 600), pal.muted);
  };
  TR.lockIcon = function (x, cx, cy, s, color) {
    x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = s * .12;
    x.beginPath(); x.arc(cx, cy - s * .12, s * .22, Math.PI, 0); x.stroke(); x.fillRect(cx - s * .32, cy - s * .1, s * .64, s * .46); x.restore();
  };

  // Board with flip animation, cascade, clear flash, ghost and active piece.
  TR.drawBoard = function (x, g, o) {
    const {x0, y0, cs, pal, style} = o, W = cs * COLS, H = cs * VIS, P = g.phase, pt = g.pt;
    const cx = x0 + W / 2, cy = y0 + H / 2;
    let sx = 1, sy = 1, k = 0;
    if (P === 'flip') { k = TR.ease(Math.min(1, pt / TR.T_FLIP)); sy = Math.cos(Math.PI * k); sx = 1 + .06 * Math.sin(Math.PI * k); }
    x.save();
    x.translate(cx, cy); x.scale(sx, Math.abs(sy) < .002 ? .002 : sy); x.translate(-cx, -cy);
    const face = P === 'flip' && k > .5;
    TR.rr(x, x0 - 6, y0 - 6, W + 12, H + 12, 8); x.fillStyle = pal.board; x.fill();
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
      x.fillStyle = 'rgba(255,255,255,' + (.85 * (1 - pt / g.o.clearDelay)) + ')';
      g.clearRows.forEach(r => x.fillRect(x0, y0 + (r - HID) * cs, W, cs));
    }
    if (g.piece && P === 'play') {
      const p = g.piece, gy = g.ghostY(), col = pal.piece[p.type];
      x.strokeStyle = col; x.globalAlpha = .45; x.lineWidth = 1.5;
      MINOS[p.type][p.rot].forEach(([c, r]) => x.strokeRect(x0 + (p.x + c) * cs + 2.5, y0 + (gy + r - HID) * cs + 2.5, cs - 5, cs - 5));
      x.globalAlpha = 1;
      MINOS[p.type][p.rot].forEach(([c, r], i) => TR.cell(x, style, x0 + (p.x + c) * cs, y0 + (p.y + r - HID) * cs, cs, {t: p.type, rune: p.rune && p.rune.i === i ? p.rune.type : null}, pal, false));
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
    if (locked) { TR.lockIcon(x, X + w - 18, Y + 14, 16, pal.danger); }
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

  // ---- monsters (drawn around 0,0, about 150 px tall at scale 1) ----
  const E = (x, a, b, rx, ry, c, rot) => { x.fillStyle = c; x.beginPath(); x.ellipse(a, b, rx, ry, rot || 0, 0, 7); x.fill(); };
  const eyes = (x, dx, y, r, white, pupil, look) => { E(x, -dx, y, r, r * .85, white); E(x, dx, y, r, r * .85, white); E(x, -dx + look, y + 1, r * .45, r * .45, pupil); E(x, dx + look, y + 1, r * .45, r * .45, pupil); };
  const MON = {
    tuyul(x, t) {
      E(x, 0, 64, 40, 8, 'rgba(0,0,0,.35)');
      E(x, 0, 44, 26, 22, '#A9B79A'); E(x, 0, 58, 25, 10, '#6B4E3A');
      E(x, -44, -8, 12, 16, '#9AA88B'); E(x, 44, -8, 12, 16, '#9AA88B');
      E(x, 0, -8, 44, 42, '#B9C7A8');
      E(x, -16, -10, 10, 13, '#151515'); E(x, 16, -10, 10, 13, '#151515'); E(x, -13, -14, 3, 3, '#FFF'); E(x, 19, -14, 3, 3, '#FFF');
      x.strokeStyle = '#4C3A2E'; x.lineWidth = 3; x.beginPath(); x.arc(0, 12, 12, .2, Math.PI - .2); x.stroke();
    },
    babi(x, t) {
      E(x, 0, 66, 70, 9, 'rgba(0,0,0,.35)');
      x.fillStyle = '#2B211F'; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(i * 15 - 7, -36); x.lineTo(i * 15, -58 + Math.abs(i) * 5); x.lineTo(i * 15 + 7, -36); x.fill(); }
      E(x, 0, 10, 74, 54, '#3A2E2B');
      x.fillStyle = '#3A2E2B'; x.beginPath(); x.moveTo(-50, -30); x.lineTo(-60, -62); x.lineTo(-28, -40); x.fill(); x.beginPath(); x.moveTo(50, -30); x.lineTo(60, -62); x.lineTo(28, -40); x.fill();
      eyes(x, 26, -10, 8, '#F2D7C9', '#C8323A', -2);
      E(x, 0, 22, 26, 18, '#C78B83'); E(x, -8, 22, 4, 6, '#5B2E2A'); E(x, 8, 22, 4, 6, '#5B2E2A');
      x.strokeStyle = '#F5F0E0'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(-24, 34); x.quadraticCurveTo(-34, 22, -30, 8); x.moveTo(24, 34); x.quadraticCurveTo(34, 22, 30, 8); x.stroke();
    },
    banaspati(x, t) {
      const f = Math.sin(t * 9) * 4, g = Math.sin(t * 6.3) * 5;
      x.fillStyle = '#FF7A3D'; x.beginPath(); x.moveTo(0, -86 - f);
      x.bezierCurveTo(30 + g, -52, 66, -36, 56, 14); x.bezierCurveTo(50, 56, 22, 66, 0, 66); x.bezierCurveTo(-22, 66, -50, 56, -56, 14); x.bezierCurveTo(-66, -36, -30 - g, -52, 0, -86 - f); x.fill();
      x.fillStyle = '#FFD84D'; x.beginPath(); x.moveTo(0, -40 + f); x.bezierCurveTo(26, -10, 36, 10, 30, 30); x.bezierCurveTo(24, 52, -24, 52, -30, 30); x.bezierCurveTo(-36, 10, -26, -10, 0, -40 + f); x.fill();
      x.fillStyle = '#3A1206'; x.beginPath(); x.moveTo(-26, 6); x.lineTo(-8, 12); x.lineTo(-24, 18); x.fill(); x.beginPath(); x.moveTo(26, 6); x.lineTo(8, 12); x.lineTo(24, 18); x.fill();
      x.beginPath(); x.ellipse(0, 34, 14, 7, 0, 0, Math.PI); x.fill();
    },
    kunti(x, t) {
      const sway = Math.sin(t * 1.6) * 4;
      E(x, 0, 74, 46, 8, 'rgba(0,0,0,.3)');
      x.fillStyle = '#EDEBE6'; x.beginPath(); x.moveTo(-30, 0); x.lineTo(30, 0); x.lineTo(48 + sway, 70); x.lineTo(-48 + sway, 70); x.closePath(); x.fill();
      x.fillStyle = '#141113'; x.beginPath(); x.moveTo(-40, -40); x.quadraticCurveTo(0, -100, 40, -40); x.lineTo(46 + sway, 40); x.lineTo(-46 + sway, 40); x.closePath(); x.fill();
      E(x, 0, -30, 24, 30, '#E9E4DA');
      x.fillStyle = '#141113'; x.beginPath(); x.moveTo(-26, -58); x.quadraticCurveTo(0, -70, 26, -58); x.lineTo(10, -40); x.lineTo(-14, -44); x.closePath(); x.fill();
      E(x, -9, -28, 4, 3, '#C8323A'); E(x, 9, -28, 4, 3, '#C8323A');
      x.strokeStyle = '#7A2E2E'; x.lineWidth = 2; x.beginPath(); x.moveTo(-6, -10); x.lineTo(6, -10); x.stroke();
    },
    genderuwo(x, t) {
      E(x, 0, 76, 80, 10, 'rgba(0,0,0,.4)');
      x.fillStyle = '#2C1F17';
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r1 = 78, r2 = 92 + (i % 2) * 6; x.beginPath(); x.moveTo(Math.cos(a - .12) * r1, Math.sin(a - .12) * r1 * .85 + 6); x.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * .85 + 6); x.lineTo(Math.cos(a + .12) * r1, Math.sin(a + .12) * r1 * .85 + 6); x.fill(); }
      E(x, 0, 6, 80, 68, '#3B2A20');
      E(x, 0, -6, 46, 40, '#6A4B38');
      eyes(x, 18, -14, 9, '#FFB4A0', '#C8101A', -2);
      x.strokeStyle = '#1B120D'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(-34, -32); x.lineTo(-8, -24); x.moveTo(34, -32); x.lineTo(8, -24); x.stroke();
      E(x, 0, 14, 22, 10, '#1B0E0A');
      x.fillStyle = '#F2E8D0'; x.beginPath(); x.moveTo(-14, 10); x.lineTo(-9, 24); x.lineTo(-4, 10); x.fill(); x.beginPath(); x.moveTo(14, 10); x.lineTo(9, 24); x.lineTo(4, 10); x.fill();
    },
    pocong(x, t) {
      const hop = Math.abs(Math.sin(t * 3)) * -8;
      E(x, 0, 78, 34, 7, 'rgba(0,0,0,.3)');
      x.save(); x.translate(0, hop);
      TR.rr(x, -34, -70, 68, 144, 34); x.fillStyle = '#EEEAE0'; x.fill();
      x.strokeStyle = '#CFC8B8'; x.lineWidth = 2; [-20, 20, 50].forEach(yy => { x.beginPath(); x.moveTo(-32, yy); x.lineTo(32, yy); x.stroke(); });
      x.fillStyle = '#CFC8B8'; x.beginPath(); x.moveTo(-10, -70); x.lineTo(0, -86); x.lineTo(10, -70); x.fill();
      E(x, 0, -38, 20, 22, '#6B6458'); E(x, -7, -40, 3.5, 3.5, '#F2EDE2'); E(x, 7, -40, 3.5, 3.5, '#F2EDE2');
      x.restore();
    },
    leak(x, t) {
      const bob = Math.sin(t * 2.4) * 6;
      x.save(); x.translate(0, bob);
      x.fillStyle = TR.alpha('#9BE07B', .18); x.beginPath(); x.arc(0, -6, 76, 0, 7); x.fill();
      x.fillStyle = '#231915'; for (let i = 0; i < 16; i++) { const a = Math.PI + i / 15 * Math.PI; x.beginPath(); x.moveTo(Math.cos(a - .15) * 44, Math.sin(a - .15) * 44 - 10); x.lineTo(Math.cos(a) * 70, Math.sin(a) * 66 - 10); x.lineTo(Math.cos(a + .15) * 44, Math.sin(a + .15) * 44 - 10); x.fill(); }
      E(x, 0, -6, 46, 48, '#D8B98E');
      eyes(x, 18, -12, 12, '#FFFFFF', '#B3121C', 0);
      x.fillStyle = '#B3121C'; x.beginPath(); x.moveTo(-8, 22); x.quadraticCurveTo(0, 74 + Math.sin(t * 4) * 6, 8, 22); x.fill();
      E(x, 0, 20, 16, 6, '#4A1A14');
      x.restore();
    },
    jenglot(x, t) {
      E(x, 0, 70, 30, 6, 'rgba(0,0,0,.3)');
      x.fillStyle = '#1E1612'; x.beginPath(); x.moveTo(-26, -40); x.quadraticCurveTo(0, -84, 26, -40); x.lineTo(36, 40); x.lineTo(-36, 40); x.closePath(); x.fill();
      TR.rr(x, -14, -6, 28, 70, 12); x.fillStyle = '#5A3F2C'; x.fill();
      E(x, 0, -28, 20, 24, '#6B4B34');
      E(x, -7, -30, 4, 4, '#E8D25A'); E(x, 7, -30, 4, 4, '#E8D25A');
      x.fillStyle = '#F2E8D0'; x.beginPath(); x.moveTo(-6, -14); x.lineTo(-3, -6); x.lineTo(0, -14); x.lineTo(3, -6); x.lineTo(6, -14); x.fill();
      x.strokeStyle = '#3A2A1E'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(-14, 6); x.lineTo(-34, 30); x.moveTo(14, 6); x.lineTo(34, 30); x.stroke();
      x.strokeStyle = '#D9CBA8'; x.lineWidth = 2; x.beginPath(); x.moveTo(-34, 30); x.lineTo(-40, 44); x.moveTo(34, 30); x.lineTo(40, 44); x.stroke();
    },
    wewe(x, t) {
      E(x, 0, 78, 52, 8, 'rgba(0,0,0,.35)');
      x.fillStyle = '#2B2522'; x.beginPath(); x.moveTo(-36, -60); x.quadraticCurveTo(0, -104, 36, -60); x.quadraticCurveTo(58, 10, 50, 76); x.lineTo(-50, 76); x.quadraticCurveTo(-58, 10, -36, -60); x.fill();
      E(x, 0, -40, 22, 28, '#A68A6D');
      E(x, -8, -42, 4, 3, '#F0E6D2'); E(x, 8, -42, 4, 3, '#F0E6D2'); E(x, -8, -42, 2, 2, '#2A0B0B'); E(x, 8, -42, 2, 2, '#2A0B0B');
      x.strokeStyle = '#5A2A22'; x.lineWidth = 2.5; x.beginPath(); x.arc(0, -26, 9, .3, Math.PI - .3); x.stroke();
      x.strokeStyle = '#7D6650'; x.lineWidth = 7; x.lineCap = 'round'; const s = Math.sin(t * 2) * 6;
      x.beginPath(); x.moveTo(-34, -6); x.lineTo(-60, 40 + s); x.moveTo(34, -6); x.lineTo(60, 40 - s); x.stroke();
    },
    buto(x, t) {
      E(x, 0, 76, 74, 10, 'rgba(0,0,0,.35)');
      E(x, -70, 22, 17, 27, '#3F8640', -.4); E(x, 70, 22, 17, 27, '#3F8640', .4);
      x.fillStyle = '#E9DFC6'; x.beginPath(); x.moveTo(-42, -46); x.lineTo(-60, -92); x.lineTo(-22, -56); x.fill(); x.beginPath(); x.moveTo(42, -46); x.lineTo(60, -92); x.lineTo(22, -56); x.fill();
      E(x, 0, 0, 70, 62, '#4E9A4A');
      x.fillStyle = '#2F6B33'; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 14 - 8, -56); x.lineTo(i * 14, -74 + Math.abs(i) * 4); x.lineTo(i * 14 + 8, -56); x.fill(); }
      E(x, 0, 24, 42, 30, '#79B866');
      x.strokeStyle = '#1F3A1E'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(-40, -34); x.lineTo(-12, -26); x.moveTo(40, -34); x.lineTo(12, -26); x.stroke();
      eyes(x, 24, -13, 12, '#F5F0E0', '#C8323A', -2);
      x.fillStyle = '#2B1410'; x.beginPath(); x.ellipse(0, 12, 26, 13, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#F5F0E0'; x.beginPath(); x.moveTo(-18, 13); x.lineTo(-12, -2); x.lineTo(-7, 13); x.fill(); x.beginPath(); x.moveTo(18, 13); x.lineTo(12, -2); x.lineTo(7, 13); x.fill();
    }
  };
  // state: {flash, shake, atk, dead} in seconds remaining
  TR.drawMonster = function (x, id, mx, my, scale, t, st) {
    let ox = 0;
    if (st.atk > 0) ox = -Math.sin((1 - st.atk / .8) * Math.PI) * 38;
    if (st.shake > 0) ox += Math.sin(t * 90) * 5 * st.shake / .3;
    x.save();
    x.translate(mx + ox * scale, my + Math.sin(t * 2.2) * 3 * scale);
    let s = scale;
    if (st.dead > 0) { const k = 1 - st.dead / 1.2; x.globalAlpha = Math.max(0, 1 - k); s *= 1 - k * .3; x.rotate(k * .4); }
    x.scale(s, s);
    if (st.flash > 0) {
      // Whiten only the monster's own pixels: draw it on a scratch canvas first.
      const S = 260, R = 2;
      flashCanvas = flashCanvas || document.createElement('canvas');
      flashCanvas.width = S * R; flashCanvas.height = S * R;
      const o = flashCanvas.getContext('2d');
      o.setTransform(R, 0, 0, R, S * R / 2, S * R / 2);
      MON[id](o, t);
      o.globalCompositeOperation = 'source-atop'; o.globalAlpha = Math.min(1, st.flash / .25) * .75; o.fillStyle = '#FFFFFF'; o.fillRect(-S / 2, -S / 2, S, S);
      x.drawImage(flashCanvas, -S / 2, -S / 2, S, S);
    } else MON[id](x, t);
    x.restore();
  };
  let flashCanvas = null;

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

  // ---- floating text and projectiles ----
  class Fx {
    constructor() { this.items = []; this.shots = []; }
    pop(text, X, Y, color, size, opts) { this.items.push(Object.assign({text, X, Y, color, size: size || 16, life: 1.1, t: 0, mono: false}, opts || {})); }
    shot(x0, y0, x1, y1, color, onArrive, dur) { this.shots.push({x0, y0, x1, y1, color, onArrive, t: 0, dur: dur || .55}); }
    update(dt) {
      this.items.forEach(f => { f.t += dt; }); this.items = this.items.filter(f => f.t < f.life);
      this.shots.forEach(s => { s.t += dt; });
      const done = this.shots.filter(s => s.t >= s.dur); this.shots = this.shots.filter(s => s.t < s.dur);
      done.forEach(s => { if (s.onArrive) s.onArrive(); });
    }
    draw(x) {
      this.shots.forEach(s => {
        for (let j = 0; j < 6; j++) {
          const k = Math.max(0, s.t / s.dur - j * .035), u = 1 - k, mx = (s.x0 + s.x1) / 2, my = Math.min(s.y0, s.y1) - 90;
          const px = u * u * s.x0 + 2 * u * k * mx + k * k * s.x1, py = u * u * s.y0 + 2 * u * k * my + k * k * s.y1;
          x.globalAlpha = 1 - j / 6; x.fillStyle = s.color; x.beginPath(); x.arc(px, py, 6 - j * .7, 0, 7); x.fill();
        }
        x.globalAlpha = 1;
      });
      this.items.forEach(f => {
        const k = f.t / f.life;
        x.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
        TR.text(x, f.text, f.X, f.Y - k * 24, f.mono ? TR.fm(f.size, 600) : TR.fd(f.size), f.color, 'center');
        x.globalAlpha = 1;
      });
    }
  }
  TR.Fx = Fx;
})(window.TR);
