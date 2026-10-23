# Tetr1s

A block-stacking game where the board flips upside down, fantasy monsters fight back, and two players can battle on one keyboard. It runs in the browser with plain HTML, CSS and JavaScript. There is no build step and no dependencies.

**Play:** open `index.html`, or visit the GitHub Pages link once the repository is published.

## Modes

| Mode | What makes it different | Devices |
| --- | --- | --- |
| **Flip** (Marathon, Sprint 40, Daily) | Every 7 pieces the board turns upside down and every column falls to the new floor. Holes close by themselves, and rows that become full clear for bonus points. Blocks that have been flipped show a striped back side. | Laptop and phone |
| **Dungeon** | A 30-floor run in three tiers: Normal (1–10), Elite (11–20) and Nightmare (21–30). Line clears damage fantasy monsters (Slime, Goblin, Dire Wolf, Giant Spider, Stone Golem, Orc, Minotaur, Cyclops, Troll, Dragon), each with idle, attack, hit and defeat animations. Each monster shows its next attack: garbage rows, a locked Hold, or a hidden Next queue. Rune blocks (fire, ice, thunder, leaf) trigger when their row clears. After each floor you pick 1 of 3 relics. After each tier you can continue or end the run; the records are the highest floor and the fastest full clear. | Laptop and phone |
| **Versus** | Two players on one keyboard. Clears send garbage to the other side, and your own clears cancel incoming garbage first. Cleared rows charge a Flip meter; at 8 you can flip your own board, and rows that fill up after the flip count as an attack. Best of 3. | Laptop only |

The core rules follow modern guideline-style play: 7-bag randomiser, Hold, Next queue, ghost piece, SRS rotation with wall kicks, lock delay with move reset, T-spin detection (3-corner rule), combos and back-to-back bonuses.

## Controls

| Action | Solo | Player 1 | Player 2 |
| --- | --- | --- | --- |
| Move | ← → | A D | ← → |
| Soft drop | ↓ | S | ↓ |
| Hard drop | Space | Space | Enter |
| Rotate left / right | Z / ↑ or X | Q / W | . / ↑ |
| Hold | C or Left Shift | Left Shift | Right Shift |
| Flip | automatic | E | / |
| Pause | Esc or P | Esc | Esc |

Every key can be rebound in Settings, along with DAS, ARR and soft drop speed. On a phone, use the on-screen buttons and tap the HOLD box. Some laptop keyboards cannot register many keys pressed at once; if that happens in Versus, move one player to other keys.

## Project structure

```
index.html        screens: menu, mode select, how to play, settings, game
css/style.css     layout and theme
js/util.js        seeded RNG, easing, formatting, storage, canvas helpers
js/engine.js      one playfield: SRS, 7-bag, hold, lock delay, clears, garbage, board flip
js/rules.js       scoring, Versus attack table, Dungeon damage, monsters, tiers and relics (pure data)
js/art.js         canvas drawing: cached block sprites, boards, monsters and their animations,
                  relics, dungeon backgrounds per tier, logo, particles and confetti
js/input.js       keyboard and touch input, DAS/ARR controller
js/audio.js       sound effects synthesised with Web Audio
js/modes.js       Flip, Dungeon and Versus: game rules on top of the engine, and their screens
js/main.js        app shell: navigation, overlays, settings, layout, main loop
tests/run.js      engine and rules tests for Node
```

The engine knows nothing about modes. It emits events (`clear`, `flipClear`, `afterLock`, `topout`, ...), and each mode turns them into score, damage or garbage. That keeps the playfield logic testable on its own.

## Run and test locally

Open `index.html` directly, or serve the folder:

```
python -m http.server 8000
```

Run the tests (Node 11 or newer):

```
node tests/run.js
```

The tests cover the 7-bag, SRS rotation and wall kicks, line clears, T-spin double detection, combos and back-to-back, the board flip, garbage, hold, and the score, attack and damage tables.

## Credits

Made by Kevin Reinhard Hasim. Fonts: Unbounded and JetBrains Mono (Google Fonts). All art is drawn in code and all sounds are synthesised at runtime.

Tetr1s is a fan-made game inspired by Tetris and is not affiliated with or endorsed by The Tetris Company.
