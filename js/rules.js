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
      if (i.lines === 4 && has('dagger')) d *= 1.5;
      if (i.tspin && has('ring')) d *= 2;
      if (i.lines === 1 && !i.tspin && has('spear')) d += 8;
      if (i.b2b) d *= has('horn') ? 1.5 : 1.25;
      d += 4 * i.combo;
      if (i.combo >= 3 && has('drum')) d += 15;
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

  // Ten monsters; bosses on 5 and 10. Intents cycle in order.
  const MONSTERS = [
    {id: 'slime', name: 'Slime', hp: 90, every: 5, intents: [{k: 'garbage', n: 1}]},
    {id: 'goblin', name: 'Goblin', hp: 130, every: 5, intents: [{k: 'garbage', n: 1}, {k: 'garbage', n: 2}]},
    {id: 'wolf', name: 'Dire Wolf', hp: 170, every: 4, intents: [{k: 'garbage', n: 1}, {k: 'fog', n: 3}]},
    {id: 'spider', name: 'Giant Spider', hp: 210, every: 4, intents: [{k: 'lock', n: 3}, {k: 'garbage', n: 2}]},
    {id: 'golem', name: 'Stone Golem', hp: 320, every: 4, boss: true, intents: [{k: 'garbage', n: 2}, {k: 'garbage', n: 3}]},
    {id: 'orc', name: 'Orc', hp: 260, every: 4, intents: [{k: 'garbage', n: 2}, {k: 'fog', n: 3}]},
    {id: 'minotaur', name: 'Minotaur', hp: 300, every: 4, intents: [{k: 'garbage', n: 2}, {k: 'lock', n: 3}]},
    {id: 'cyclops', name: 'Cyclops', hp: 340, every: 3, intents: [{k: 'garbage', n: 1}, {k: 'garbage', n: 2}]},
    {id: 'troll', name: 'Troll', hp: 380, every: 3, intents: [{k: 'fog', n: 3}, {k: 'garbage', n: 2}]},
    {id: 'dragon', name: 'Dragon', hp: 520, every: 4, boss: true, intents: [{k: 'garbage', n: 2}, {k: 'flip'}, {k: 'garbage', n: 3}]}
  ];

  // Three tiers of ten floors. The same monsters come back stronger.
  const TIERS = [
    {id: 'normal', name: 'Normal', hp: 1, every: 0, garbage: 0, level: 0, note: ''},
    {id: 'elite', name: 'Elite', hp: 1.5, every: -1, garbage: 0, level: 2, note: 'Elite floors: +50% HP, attacks come sooner.'},
    {id: 'nightmare', name: 'Nightmare', hp: 2.2, every: -1, garbage: 1, level: 4, note: 'Nightmare floors: +120% HP, faster attacks, bigger garbage.'}
  ];
  const FLOORS = 30;
  const tierOf = floor => Math.floor((floor - 1) / 10);
  function floorMonster(floor) {
    const tier = tierOf(floor), T = TIERS[tier], local = (floor - 1) % 10, M = MONSTERS[local];
    return {
      id: M.id, base: M.name, name: tier ? T.name + ' ' + M.name : M.name, boss: !!M.boss, tier,
      hp: Math.round(M.hp * T.hp), every: Math.max(3, M.every + T.every),
      intents: M.intents.map(it => it.k === 'garbage' ? {k: 'garbage', n: it.n + T.garbage} : Object.assign({}, it)),
      level: Math.min(10, 1 + Math.floor((local + 1) * .7) + T.level)
    };
  }

  const RELICS = [
    {id: 'dagger', name: 'Steel Dagger', desc: 'Quad clears deal +50% damage.'},
    {id: 'amulet', name: 'Frost Amulet', desc: 'Ice runes delay attacks by 2 more pieces.'},
    {id: 'crystal', name: 'Rune Crystal', desc: 'Runes appear more often.'},
    {id: 'drum', name: 'War Drum', desc: 'Combos of 3 or more deal +15 damage.'},
    {id: 'shield', name: 'Iron Shield', desc: 'Every garbage attack is 1 row smaller.'},
    {id: 'spear', name: "Hunter's Spear", desc: 'Single clears deal +8 damage.'},
    {id: 'ring', name: 'Spiral Ring', desc: 'T-spins deal double damage.'},
    {id: 'flask', name: 'Herbal Flask', desc: 'Leaf runes remove 2 garbage rows.'},
    {id: 'scroll', name: "Seer's Scroll", desc: 'See 5 pieces in NEXT instead of 3.'},
    {id: 'horn', name: 'Golden Horn', desc: 'Back-to-back bonus is +50% instead of +25%.'}
  ];

  function intentText(it) {
    if (it.k === 'garbage') return '+' + it.n + ' garbage';
    if (it.k === 'lock') return 'Locks HOLD';
    if (it.k === 'fog') return 'Hides NEXT';
    return 'Flips board';
  }

  TR.Rules = {info, score, attack, damage, label, intentText, MONSTERS, TIERS, FLOORS, tierOf, floorMonster, RELICS, COMBO};
})(typeof window !== 'undefined' ? window : global);
