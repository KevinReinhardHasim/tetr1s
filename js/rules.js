// What a clear is worth in each mode, plus the Dungeon's monsters and relics.
// Pure data and functions so tests/rules.test.js can check them in Node.
(function (root) {
  'use strict';
  const TR = root.TR = root.TR || {};

  // Normalise an engine clear event into one shape.
  function info(d, flip) {
    const r = {lines: d.lines || 0, tspin: flip ? 0 : (d.tspin || 0), b2b: !flip && !!d.b2b, combo: flip ? 0 : Math.max(0, d.combo || 0),
      perfect: !!d.perfect, flip: !!flip, fire: 0, ice: 0, thunder: 0, leaf: 0};
    (d.runes || []).forEach(k => { r[k]++; });
    return r;
  }

  // Flip modes: guideline points, multiplied by level.
  function score(i, level) {
    if (i.flip) return ([0, 200, 600, 1000, 1600][Math.min(4, i.lines)] + Math.max(0, i.lines - 4) * 400) * level;
    let s;
    if (i.tspin === 2) s = [400, 800, 1200, 1600][i.lines];
    else if (i.tspin === 1) s = [100, 200, 400, 400][i.lines];
    else s = [0, 100, 300, 500, 800][i.lines];
    if (i.b2b && i.lines > 0) s *= 1.5;
    s *= level;
    if (i.combo > 0 && i.lines > 0) s += 50 * i.combo * level;
    if (i.perfect) s += [0, 800, 1200, 1800, 2000][Math.min(4, i.lines)] * level;
    return Math.round(s);
  }

  // Versus: garbage rows sent to the other player.
  const COMBO = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
  function attack(i) {
    if (i.flip) return [0, 1, 2, 3, 4][Math.min(4, i.lines)] + Math.max(0, i.lines - 4) + i.fire;
    let a;
    if (i.tspin === 2) a = [0, 2, 4, 6][i.lines];
    else if (i.tspin === 1) a = [0, 0, 1, 1][i.lines];
    else a = [0, 0, 1, 2, 4][i.lines];
    if (i.lines > 0) { if (i.b2b) a += 1; a += COMBO[Math.min(i.combo, COMBO.length - 1)]; }
    if (i.perfect) a += 6;
    return a + i.fire;
  }

  // Dungeon: damage to the monster. Relics are passed as an array of ids.
  function damage(i, relics) {
    const has = id => relics.indexOf(id) >= 0;
    let d;
    if (i.flip) d = [0, 15, 32, 50, 75][Math.min(4, i.lines)] + Math.max(0, i.lines - 4) * 20;
    else if (i.tspin === 2) d = [8, 36, 64, 96][i.lines];
    else if (i.tspin === 1) d = [0, 16, 28, 28][i.lines];
    else d = [0, 12, 28, 46, 72][i.lines];
    if (!i.flip && i.lines > 0) {
      if (i.lines === 4 && has('keris')) d *= 1.5;
      if (i.tspin && has('wayang')) d *= 2;
      if (i.lines === 1 && !i.tspin && has('bambu')) d += 8;
      if (i.b2b) d *= has('angklung') ? 1.5 : 1.25;
      d += 4 * i.combo;
      if (i.combo >= 3 && has('gong')) d += 15;
    }
    if (i.perfect) d += 40;
    d += i.fire * 15 + i.thunder * 10;
    return Math.round(d);
  }

  function label(i) {
    if (i.flip) return i.lines ? 'FLIP +' + i.lines : '';
    const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'];
    if (i.tspin === 2) return 'T-SPIN' + (i.lines ? ' ' + names[i.lines] : '');
    if (i.tspin === 1) return 'MINI T-SPIN' + (i.lines ? ' ' + names[i.lines] : '');
    return i.lines >= 2 ? names[i.lines] : '';
  }

  // Ten floors; bosses on 5 and 10. Intents cycle in order.
  const MONSTERS = [
    {id: 'tuyul', name: 'Tuyul', hp: 90, every: 5, intents: [{k: 'garbage', n: 1}]},
    {id: 'babi', name: 'Babi Ngepet', hp: 130, every: 5, intents: [{k: 'garbage', n: 1}, {k: 'garbage', n: 2}]},
    {id: 'banaspati', name: 'Banaspati', hp: 170, every: 4, intents: [{k: 'garbage', n: 1}, {k: 'fog', n: 3}]},
    {id: 'kunti', name: 'Kuntilanak', hp: 210, every: 4, intents: [{k: 'lock', n: 3}, {k: 'garbage', n: 2}]},
    {id: 'genderuwo', name: 'Genderuwo', hp: 320, every: 4, boss: true, intents: [{k: 'garbage', n: 2}, {k: 'garbage', n: 3}]},
    {id: 'pocong', name: 'Pocong', hp: 260, every: 4, intents: [{k: 'garbage', n: 2}, {k: 'fog', n: 3}]},
    {id: 'leak', name: 'Leak', hp: 300, every: 4, intents: [{k: 'garbage', n: 2}, {k: 'lock', n: 3}]},
    {id: 'jenglot', name: 'Jenglot', hp: 340, every: 3, intents: [{k: 'garbage', n: 1}, {k: 'garbage', n: 2}]},
    {id: 'wewe', name: 'Wewe Gombel', hp: 380, every: 3, intents: [{k: 'fog', n: 3}, {k: 'garbage', n: 2}]},
    {id: 'buto', name: 'Buto Ijo', hp: 520, every: 4, boss: true, intents: [{k: 'garbage', n: 2}, {k: 'flip'}, {k: 'garbage', n: 3}]}
  ];

  const RELICS = [
    {id: 'keris', name: 'Keris', desc: 'Quad clears deal +50% damage.'},
    {id: 'jimat', name: 'Ice Charm', desc: 'Ice runes delay attacks by 2 more pieces.'},
    {id: 'akik', name: 'Agate Stone', desc: 'Runes appear more often.'},
    {id: 'gong', name: 'Small Gong', desc: 'Combos of 3 or more deal +15 damage.'},
    {id: 'batik', name: 'Batik Cloth', desc: 'Every garbage attack is 1 row smaller.'},
    {id: 'bambu', name: 'Bamboo Spear', desc: 'Single clears deal +8 damage.'},
    {id: 'wayang', name: 'Wayang Mask', desc: 'T-spins deal double damage.'},
    {id: 'kendi', name: 'Clay Jug', desc: 'Leaf runes remove 2 garbage rows.'},
    {id: 'lontar', name: 'Lontar Scroll', desc: 'See 5 pieces in NEXT instead of 3.'},
    {id: 'angklung', name: 'Angklung', desc: 'Back-to-back bonus is +50% instead of +25%.'}
  ];

  function intentText(it) {
    if (it.k === 'garbage') return '+' + it.n + ' garbage';
    if (it.k === 'lock') return 'Locks HOLD';
    if (it.k === 'fog') return 'Hides NEXT';
    return 'Flips board';
  }

  TR.Rules = {info, score, attack, damage, label, intentText, MONSTERS, RELICS, COMBO};
})(typeof window !== 'undefined' ? window : global);
