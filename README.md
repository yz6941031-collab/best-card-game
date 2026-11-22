# Starforge Duel

[![make.fun bounty](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/yz6941031-collab/best-card-game/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/yz6941031-collab/best-card-game/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

**A card duel at the last anvil of the sky. Break the Warden, or be unmade.**

Starforge Duel is a complete, original 1v1 card game that runs entirely in
the browser from static files — no server, no network requests, no assets.
Everything (design, code, CSS/SVG art, sound, text) was written for this
bounty in a single session.

## How to play

- You and **the Warden** start at **30 HP**. First duelist to 0 falls.
- Each round your **energy** refills and grows: 3, 4, 5 … up to 8. You draw
  2 cards a round (opening hand 4, hand limit 8).
- Cards cost energy and belong to four suits, told apart by colour **and**
  icon shape: **Ember** (flame — damage), **Frost** (shard — shield),
  **Storm** (bolt — energy and draw tempo), **Grove** (leaf — healing).
- **Shield soaks damage before health.** A shield raised in round 1 still
  protects you in round 5.
- **Resonance:** play a card whose suit matches the card you played just
  before it this turn and it lands **+2** stronger — damage, shield or
  healing. Chain a suit to swing a round.
- **Intent:** the Warden commits to its whole plan at the start of the
  round, and the banner tells you exactly what is coming — total attack,
  shield and healing. Read it. Counter it. Shield up before a 16-point
  strike; race a healing Warden down before it mends.
- 14 card designs, 30-card decks, one built-in AI opponent.

**Controls:** click a card to play it, click **END TURN** to hand over.
Keyboard: **1–8** play the card in that slot, **Enter** ends the turn (and
starts the duel from the title screen).

**First-duel tips:** the Warden's intent is a promise, not a bluff — when
it declares a strike bigger than your health plus shield, spend the round
on Frost. Ember chains are the fastest kills: a Spark Jab into a Flame
Lance with Resonance armed out-damages either card alone. And Overcharge
is never free — the 2 damage it costs you is real, so take it behind a
shield or not at all.

## Running it

Open `game/index.html` from any static file server (ES modules need
`http://`, so `file://` will not do — e.g. `python3 -m http.server` inside
`game/`). It plays start to finish with mouse or keyboard, with synthesized
WebAudio sound effects and no external requests of any kind.

For the bounty, `node main.ts` copies `game/` and `screenshots/` into the
output directory (`MAKEFUN_OUTPUT_DIR`, else `/output`) and writes the
`dossier.json` with the kit's own `buildDossier`.

## How it was built

Plain HTML, CSS and JavaScript modules — no framework, no build step, no
libraries. The rules live in a pure, DOM-free engine so whole games can be
played headlessly in Node:

| File | Role |
| --- | --- |
| `game/src/engine.js` | The duel as a state machine: rounds, energy, shield, Resonance, win/loss |
| `game/src/cards.js` | The four suits and all 14 card designs; builds the 30-card decks |
| `game/src/ai.js` | The Warden: plans a full turn by projection, declares its intent |
| `game/src/render.js` | DOM renderer — cards, HP bars, intent banner, floaters, end screens |
| `game/src/input.js` | Mouse and keyboard wiring |
| `game/src/audio.js` | WebAudio-synthesized sound effects (zero audio files) |
| `game/src/main.js` | The controller: turns, the Warden's animated replies, game flow |
| `game/src/shots.js` | The `?shot=` scenes used to render the screenshots below |
| `game/src/random.js` | A seeded RNG (mulberry32) so scenes and tests are reproducible |
| `main.ts` | The entry program: assembles the output and the dossier |
| `vendor/makefun-game.ts` | The kit's dossier builder, copied verbatim |

Testing: the engine played 300 seeded games against a greedy policy in
Node (159 player wins, 141 Warden wins, every game terminating, card
conservation and HP/shield invariants asserted throughout), and the real
game was played start to finish in headless Chromium with actual mouse
clicks — a 15-round defeat, a duel-again restart, a keyboard turn, and a
6-round victory — with zero console errors and zero non-local requests.

## Screenshots

The four renders in `screenshots/` are the real game, captured at
1280×800 through its own `?shot=` scenes (seeded, scripted play through
the real engine and renderer — nothing is composited):

1. `1-title.jpg` — the title screen.
2. `2-table.jpg` — round 3: the Warden at 19 HP behind a declared intent,
   the player's four-card hand, shields up on both sides.
3. `3-victory.jpg` — a won duel: 7 rounds, 38 damage dealt.
4. `4-defeat.jpg` — a lost duel: 6 rounds, 29 damage taken.

## License

MIT — see `LICENSE`.
