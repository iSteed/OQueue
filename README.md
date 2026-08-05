# OQueue

A Tampermonkey userscript that adds a floating build-queue panel to OGame. Tracks what to build next (buildings or research), auto-detects your actual levels from the page, and highlights the right row — checklist-first, with an optional rule-based planner for players who want the queue to self-correct instead of going stale.

## Install / update

The distributable file is `ogame-build-queue.user.js` at the repo root — built from `src/*.js` via:

```bash
node build.js
```

The built file carries `@updateURL`/`@downloadURL` pointing at this repo's raw file on GitHub (`https://raw.githubusercontent.com/iSteed/OQueue/main/ogame-build-queue.user.js`), so once installed, Tampermonkey checks that URL for updates on its own schedule (Dashboard → Settings → "Update" to check manually/immediately).

**First install:** visit that raw URL directly in the browser — Tampermonkey will offer to install it.

**Releasing an update:** after touching `src/`, run `npm test`, bump `@version` in `build.js`'s `METADATA` block (Tampermonkey only refetches when the version string increases), `node build.js`, then commit + push to `main`. Tampermonkey picks it up from there.

## The panel

```
──────────────
 Colony Queue - <planet>
──────────────
✓ Metal Mine 4
✓ Crystal Mine 3

➡ Metal Mine 5

Next
Crystal Mine 4
Solar Plant 5

[Done] [Edit] [Save as Template]
```

- **Done** — manually advances to the next item (for when you'd rather click than wait on auto-detection).
- **Edit** — opens a textarea with the current queue in shorthand text (see below); Save re-parses and replaces the queue.
- **Save as Template** — stores the current queue under a name you pick, for reuse later (see Templates).
- The panel auto-detects real building/tech levels from the page and checkmarks anything already reached — building things out of order doesn't break it.
- Only the last 5 completed items are shown (with a "+N earlier" note) so the current/upcoming items stay visible without scrolling.

### Two separate queues

Buildings are per-planet; research is account-wide. The panel automatically manages **whichever queue matches the page you're on**:

- Any planet page (Resources, Facilities, etc.) → that planet's building queue, titled "Colony Queue - `<planet>`"
- The Research page → the one shared research queue, titled "Research Queue"

Templates (below) only apply to the per-planet building queue for now.

## Import / Edit syntax

Paste (or type into Edit) one shorthand code + target level per line (whitespace/commas both work as separators):

```
M10
C8
S10
R2
SY1
```

Each line means "reach this level" — not "build this many levels." You don't need to list every intermediate level (`R2` from a fresh level-0 Robotics Factory is fine, no need for `R1` first).

Shorthand codes are checked against buildings first, then technologies, so both can be mixed in the same paste — useful if you're copying a plan that spans planets and research.

### Building codes

| Code | Building |
|------|----------|
| M | Metal Mine |
| C | Crystal Mine |
| D | Deuterium Synthesizer |
| S | Solar Plant |
| F | Fusion Reactor |
| MS | Metal Storage |
| CS | Crystal Storage |
| DS | Deuterium Tank |
| R | Robotics Factory |
| SY | Shipyard |
| RL | Research Lab |
| AD | Alliance Depot |
| MSI | Missile Silo |
| NF | Nanite Factory |
| T | Terraformer |
| SD | Space Dock |

### Technology codes

| Code | Technology |
|------|------------|
| EP | Espionage Technology |
| CT | Computer Technology |
| WT | Weapons Technology |
| ST | Shielding Technology |
| AT | Armour Technology |
| EN | Energy Technology |
| HT | Hyperspace Technology |
| CD | Combustion Drive |
| ID | Impulse Drive |
| HD | Hyperspace Drive |
| LT | Laser Technology |
| IT | Ion Technology |
| PT | Plasma Technology |
| IRN | Intergalactic Research Network |
| AP | Astrophysics |
| GT | Graviton Technology |

(Full source of truth: `src/buildings.js` / `src/technologies.js`.)

### Lifeform building codes

On the `lfbuildings` page, shorthand resolves against whichever species is active on that planet (auto-detected; Humans is the fallback if detection fails).

**Humans**

| Code | Building |
|------|----------|
| RS | Residential Sector |
| BF | Biosphere Farm |
| RC | Research Centre |
| AS | Academy of Sciences |
| NCC | Neuro-Calibration Centre |
| HES | High Energy Smelting |
| FS | Food Silo |
| FPP | Fusion-Powered Production |
| SKY | Skyscraper |
| BL | Biotech Lab |
| MET | Metropolis |
| PS | Planetary Shield |

**Rock'tal**

| Code | Building |
|------|----------|
| ME | Meditation Enclave |
| CF | Crystal Farm |
| RT | Rune Technologium |
| RF | Rune Forge |
| ORI | Oriktorium |
| MF | Magma Forge |
| DC | Disruption Chamber |
| MEG | Megalith |
| CR | Crystal Refinery |
| DSY | Deuterium Synthesiser |
| MRC | Mineral Research Centre |
| ARP | Advanced Recycling Plant |

Mecha and Kaelesh aren't wired up yet — verified live only once, like every other id in this project (see `src/lifeformBuildings.js`).

(Full source of truth: `src/lifeformBuildings.js`.)

## Templates

Named, reusable queues you can apply to any planet in one click from the panel's dropdown.

Two are built in and seeded automatically the first time you run OQueue (only if you don't already have any templates saved, so they'll never overwrite your own):

- **Balanced Economy** — mines/storage/Robotics/Research Lab/Deuterium at a measured pace
- **Rusher** — pushes Robotics Factory + Shipyard earlier for a faster early fleet

Both are generated, not hand-typed: a small algorithm (`src/buildorder.js`) walks a priority list of targets and inserts Solar Plant level-ups automatically, exactly when the real OGame energy formulas (`src/formulas.js`) say you'd otherwise go energy-negative — so the Solar Plant timing is calculated, not guessed.

Use **Save as Template** in the panel to save your current queue under a new name; use the dropdown to apply any saved template to the current planet (this replaces that planet's current queue and clears its "done" history).

## Rule-based planner (advanced, list-mode only for now)

Instead of a fixed list, a rule spec continuously recalculates the next target from your *current* levels — so if you build something out of the order you originally planned, it doesn't go "off by one," it just re-evaluates. This is separate from the plain shorthand list above and not yet wired into the panel's Edit box UI (see `src/rules.js` for the engine if you want to construct one programmatically).

```
repeat:
  - Metal = Crystal + 2
  - Solar >= ceil((Metal + Crystal)/2)
until:
  Metal = 22
then:
  Robotics = 4
  Shipyard = 2
```

- `repeat` — an ordered list of conditions, checked top to bottom every time. The first one not yet satisfied becomes the next build target (target level computed fresh from current levels each time).
- `until` — once this condition is met, stop cycling through `repeat` and move on to `then`.
- `then` — a fixed sequence of targets to build once `until` is satisfied.

Variable names in rules use friendly words, not shorthand codes: `Metal`, `Crystal`, `Deuterium`, `Solar`, `Fusion`, `Robotics`, `Shipyard`, `Research`, `Nanite`, `Terraformer`, `SpaceDock`, `AllianceDepot`, `MissileSilo`, `MetalStorage`, `CrystalStorage`, `DeuteriumTank`. Supported operators: `=`, `>=`, `<=`, `>`, `<`, plus `+ - * /` and `ceil()`/`floor()`/`round()` in expressions.

## Project layout

```
src/            source modules (one concern per file, plain UMD, zero dependencies)
test/           node --test unit tests + a couple of manual browser test harnesses
build.js        concatenates src/*.js + a Tampermonkey metadata block into the bundle below
ogame-build-queue.user.js   the actual distributable — install this in Tampermonkey
```

Run tests with `npm test`. DOM-dependent code (`src/dom.js`) has no automated tests — it's verified by loading the script against a real OGame session and checking behavior directly.
