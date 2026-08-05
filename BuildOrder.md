# OGame Build Order — Discoverer + Rock'tal ("Expo-Miner")

**Version target:** v13.0.0 (rolled out to live servers late July / early Aug 2026 — mostly a codebase rewrite, not a balance patch, so build math is unchanged. Community add-ons/scripts broke on rollout; re-check yours.)

**Assumed universe:** modern settings, 8x economy / 16x research, 50% deut consumption. Adjust absolute numbers if your uni differs; ratios and ordering hold.

---

## 0. Why this playstyle

Class: **Discoverer**. Lifeform: **Rock'tal** on every planet, with a hybrid research pick (Rock'tal production techs + Kaelesh expedition techs bought with artefacts).

This is the build with the cleanest documented "spreadsheet" — the 18 lifeform research slots have a known optimal assignment, and expedition income scales multiplicatively rather than linearly, so it stays relevant at every account size.

**Discoverer bonuses:**

| Bonus | Value |
|---|---|
| Expedition slots | +2 |
| Expedition rewards | +50% (×1.5 multiplier) |
| Chance of pirates/aliens on expo | −50% |
| Research time | −25% |
| Colony planet size on colonisation | +10% fields |
| Phalanx range | +20% |
| Loot from inactives | 75% (vs 50%) |
| Research acceleration DM discount | −10% |
| Class ship | **Pathfinder** — ×2 expedition find multiplier, 10k cargo, harvests expo debris |

**What you give up vs Collector:** +25% mine production, +25% cargo capacity, +100% transporter speed, and **Crawlers entirely** (Collector-only ship). That's a real cost. You're betting that expedition income + faster research + more/bigger planets beats a flat mine multiplier. At high expedition volume it does; at very low activity it doesn't — if you plan to log in less than once a day, play Collector instead.

**Class change costs 500,000 DM.** Pick once.

---

## 1. Core formulas you'll live by

```
Colonies available     = ceil(Astrophysics / 2)        # odd levels grant the slot
Max expeditions        = floor(sqrt(Astrophysics)) + 2 (Discoverer) + 1 (Admiral)
Fleet slots            = Computer Tech + 1  (+2 with General — not you)
Expedition points/ship = Structural Integrity (metal+crystal cost) × 5 / 1000
Moon chance            = debris field / 100,000, capped at 20%
Phalanx range          = (level² − 1) systems, ×1.2 for Discoverer
Crawler cap (n/a here) = (Metal + Crystal + Deut mine levels) × 8
```

Expedition find:
```
Metal found = U[0.1, 1] × base_cap × eco_speed × k_class × k_pathfinder
Crystal = Metal × 2/3      Deuterium = Metal × 1/3
k_class = 1.5 (Discoverer), k_pathfinder = 2 (any Pathfinder in fleet)
```

`base_cap` is driven by the **rank-1 player's general points**, not yours — which is why expeditions get better all round as the universe matures.

Astrophysics milestones worth memorising:

| Astro | Colonies | Expo slots (Discoverer) |
|---|---|---|
| 1 | 1 | 3 |
| 4 | 2 | 4 |
| 9 | 5 | 5 |
| 16 | 8 | 6 |
| 25 | 13 | 7 |
| 36 | 18 | 8 |

---

## 2. Phase 1 — Opening (first ~24–48h, homeworld only)

Build in this order. You will dip negative on energy at points; that's intentional — the production gain outruns the energy penalty.

```
 1. Metal Mine 1
 2. Metal Mine 2
 3. Solar Plant 1
 4. Metal Mine 3
 5. Solar Plant 2
 6. Crystal Mine 1
 7. Metal Mine 4
 8. Crystal Mine 2
 9. Solar Plant 3
10. Metal Mine 5
11. Crystal Mine 3
12. Solar Plant 4
13. Deuterium Synthesizer 1
14. Metal Mine 6
15. Solar Plant 5
16. Crystal Mine 4
17. Robotics Factory 2
18. Research Lab 1
19. Deuterium Synthesizer 2
20. Solar Plant 6
```

Research, interleaved as soon as Lab 1 is up:
```
Energy Technology 1
Combustion Drive 1 → 2
Espionage Technology 1 → 4
Computer Technology 1 → 2
Impulse Drive 1 → 3
```

Then: **Shipyard 1 → 2**, build ~10–20 Small Cargo. Use them to farm inactives in your system and adjacent ones. This is your only meaningful income until expeditions come online.

**Do not build defence yet.** You're inside noob protection.

---

## 3. Phase 2 — First colonies + expeditions online

Goal: **Astrophysics 4** as fast as possible, then keep pushing it.

Order of operations:
1. Espionage 4 + Impulse 3 → unlock **Astrophysics**
2. Shipyard 4 → **Colony Ship**
3. Astro 1 → colonise. Astro 3 → colonise again. Astro 4 → second expo slot.
4. Combustion 6 + Shipyard 4 → **Large Cargo**
5. Shielding 2 → **Recycler** (for your own debris + expo debris later)
6. Shielding 5 + Hyperspace Technology 3 + Hyperspace Drive 2 + Shipyard 5 → **Pathfinder** ← *highest-value ship unlock in this entire build* (Hyperspace Drive 1 itself requires both Shielding Technology 5 and Hyperspace Technology 3 - corrected from an earlier "Shielding 4" with no Hyperspace Technology prereq listed at all in this doc)

**One Pathfinder in an expedition fleet doubles the find.** Get one per expedition slot as early as you can afford it. Everything else in the fleet is cargo to carry the loot.

### Colony targeting

- **Positions 6–10** are the sweet spot: high field counts, decent deuterium, tolerable satellite energy. Discoverer's +10% fields applies at colonisation.
- Avoid 13–15 (tiny fields). Positions 1–3 only if you specifically want a solar-satellite energy planet.
- **Spread across galaxies and systems.** Do not stack colonies in one system — it makes you trivially farmable by anyone who relocates a planet next to you, and it depletes your own expedition systems.
- Ideal expo-launch planet: a system where you're the only resident, with quiet neighbours 2 systems either side.

### Each new colony's build order

```
Metal 1–6, Solar 1–5 (interleaved as in Phase 1)
Crystal 1–4
Robotics 2 → 4
Deuterium 1–3
Shipyard 1
Metal/Crystal/Deut to parity with the rest of the empire
```
Ship over ~2× your homeworld's hourly metal+crystal production to bootstrap each new colony.

---

## 4. Phase 3 — Lifeform activation

This is where modern OGame diverges from the 2010 game, and where most people fall behind.

### 4.1 Bootstrap

1. Activate lifeforms — **you always start as Humans**, no choice.
2. Human tech tree → research **Intergalactic Envoys** (level 1+).
3. Start sending **exploration missions** from Galaxy View (purple DNA icon).
   - Cost: 5,000 metal / 1,000 crystal / 500 deut, no ships, but **consumes a fleet slot**
   - 50 additional missions accrue per day (they bank, not use-or-lose)
   - 7-day cooldown per coordinate
   - Lifeform XP caps at level 100 = **+10% to all lifeform effects** — get there
4. Discover **Rock'tal**, **Kaelesh**, **Mecha**. Switch all planets to Rock'tal.

**Artefacts** are earned from exploration missions and let you *choose* a research slot instead of rolling for it:

| Slot tier | Artefact cost |
|---|---|
| Tier 1 | 200 |
| Tier 2 | 400 |
| Tier 3 | 600 |

Storage cap **3,600**. At or above cap you find zero — so spend, don't hoard past ~3,000. Worst-case cost to force every non-native pick in this build: **4,800 artefacts**. In practice many appear as free random offers.

> **Rule: never spend artefacts on a tech that already appeared randomly.** Accept the free one, bank for the slots that won't cooperate.

### 4.2 Key mechanics

- Lifeform buildings **do not consume planet fields**.
- Building bonuses are **planet-local**. Research bonuses are **empire-wide** (as long as that species stays active on the planet that researched it).
- Lifeform building speed scales with **Nanite Factory** level on that planet — and you can't queue a lifeform building while Nanite is upgrading, or vice versa.
- You can't run a lifeform research while the Research Lab is upgrading, or vice versa.
- Switching a planet's lifeform: 48h cooldown, population resets to zero and must regrow, but **buildings and research levels are preserved**.
- Population is a **gate**, not a currency. It isn't spent.

---

## 5. Rock'tal building order (per planet)

### Phase 0 — Foundation (→ 200,000 T1 population)

| Building | Target | Purpose |
|---|---|---|
| Meditation Enclave | ~21 | T1 housing — the main population driver. ×1.20 cost factor, nearly free |
| Crystal Farm | ~23 | Food. Also ×1.20, keep it slightly ahead of housing |
| Rune Technologium | 1 | Unlocks the research tree at all |
| Megalith | 3–5 | −1% Rock'tal building cost per level; self-improving, build early |
| Disruption Chamber | 5–10 | Energy for the Rune Forge later; cheap to scale |

**Spam Meditation Enclave + Crystal Farm.** Both have absurdly cheap base costs and a ×1.20 factor. They are the only thing between you and all 18 research slots.

### Population → building level reference (estimates, verify in-game)

| Slot | T1 pop | ~Meditation Enclave | ~Crystal Farm |
|---|---|---|---|
| 1 | 200,000 | ~21 | ~23 |
| 2 | 300,000 | ~25 | ~27 |
| 3 | 400,000 | ~28 | ~30 |
| 4 | 500,000 | ~31 | ~33 |
| 5 | 750,000 | ~37 | ~39 |
| 6 | 1,000,000 | ~42 | ~44 |

Growth is roughly `L^1.2`.

### Phase 2 — T1 → T2 transition

Prerequisite: **all six T1 slots unlocked** (not just researched — unlocked).

| Building | Target | Notes |
|---|---|---|
| Rune Forge | 6–8 | Converts T1 → T2. **×1.70 cost factor** — level only as much as you need, lvl 10 is already ~6M metal equivalent |
| Disruption Chamber | 10–15 | Rune Forge needs energy; cheapest source |
| Meditation Enclave / Crystal Farm | keep climbing | T1 pop feeds the conversion |
| Rune Technologium | 5–10 | −2% research time per level |

### Phase 4 — T2 → T3 transition

Prerequisite: all six T2 slots unlocked.

| Building | Target | Notes |
|---|---|---|
| **Megalith** | **8–10 first** | −8–10% on all Rock'tal buildings — do this *before* investing in Oriktorium |
| Oriktorium | 3–5 | Converts T2 → T3. ×1.65 factor, expensive |
| Rune Forge | 10–12 | Must feed the Oriktorium enough T2 |
| Rune Technologium | 15+ | −30% research time |

### Endgame targets (all 18 slots available)

| Building | Level |
|---|---|
| Crystal Farm | 78 |
| Meditation Enclave | 75 |
| Rune Forge | 16 |
| Oriktorium | 11 |
| Megalith | 10 |
| Mineral Research Centre | 5 |

Total to get there: on the order of **~10.6 billion MSU**. This is a multi-year project on one planet, and you do not need it on every planet — research bonuses are empire-wide, so **one or two "lifeform capital" planets carry the research tree** while the rest just run production buildings.

### Production buildings (build on *every* planet, ongoing)

| Building | Target | Effect |
|---|---|---|
| Magma Forge | 20+ | Metal +2%/level |
| Crystal Refinery | 20+ | Crystal +2%/level |
| Deuterium Synthesiser (Rock'tal) | 20+ | Deut +2%/level — high value, expeditions burn deut |
| Disruption Chamber | 15–20 | Energy production + consumption reduction |
| Rune Technologium | 20+ | −40% research time at lvl 20 |

---

## 6. The 18 research slots — assignment map

Priority rule: **expedition finds > all-resource production > metal > deut > crystal**

Bold = non-native, may need artefacts.

### Tier 1

| Slot | Pick | LF | Category | Rationale |
|---|---|---|---|---|
| 1 | **Catalyser Technology** | Mecha | Deut +0.08%/lvl | Native Rock'tal offers energy +0.25%; deut ranks higher |
| 2 | **High-Performance Extractors** | Humans | All-res +0.06%/lvl | Beats native crystal-only +0.08% |
| 3 | High Energy Pump Systems | Rock'tal | Deut | Only production option in this slot |
| 4 | **Telekinetic Tractor Beam** | Kaelesh | Expo fleet finds +0.2%/lvl | Fallback without artefacts: Cargo Hold Expansion (Rock'tal) |
| 5 | **Enhanced Sensor Technology** | Kaelesh | Expo res finds +0.2%/lvl | Highest T1 priority |
| 6 | **Automated Transport Lines** | Mecha | All-res +0.06%/lvl | Beats native energy +0.25% |

**T1 research order (build these first, in this order): 5 → 4 → 2 → 6 → 3 → 1**

### Tier 2

| Slot | Pick | LF | Category | Rationale |
|---|---|---|---|---|
| 7 | Depth Sounding | Rock'tal | Metal +0.06%/lvl | Only production option |
| 8 | **Enhanced Production Technologies** | Humans | All-res +0.06%/lvl | Native here is Heavy Fighter stats — useless |
| 9 | Improved Stellarator | Rock'tal | Low value | No production in this slot for anyone; plasma cost reduction is least-bad |
| 10 | Hardened Diamond Drill Heads | Rock'tal | Metal +0.08%/lvl | Beats Kaelesh round-trip speed |
| 11 | **Sixth Sense** | Kaelesh | Expo res finds +0.2%/lvl | Highest T2 priority |
| 12 | **Psychoharmoniser** | Kaelesh | All-res +0.06%/lvl | Beats native deut-only |

**T2 research order: 11 → 8 → 12 → 10 → 7 → 9**

### Tier 3

| Slot | Pick | LF | Category | Rationale |
|---|---|---|---|---|
| 13 | **Artificial Swarm Intelligence** | Mecha | All-res +0.06%/lvl | Native Ion Crystal Modules only helps Crawlers — you have none |
| 14 | **Overclocking: Large Cargo** | Kaelesh | LC stats | No production options here; useful if you fly LC on expos |
| 15 | **Gravitation Sensors** | Kaelesh | Expo DM finds +0.1%/lvl | DM is worth more per unit than resources |
| 16 | Obsidian Shield Reinforcement | Rock'tal | Defence +0.5%/lvl | No production options; marginal |
| 17 | **Robot Assistants** | Humans | Research time −0.2%/lvl (cap 99%) | Stacks with Rune Technologium |
| 18 | **Kaelesh Discoverer Enhancement** | Kaelesh | Discoverer class bonus +0.2%/lvl | **Spend 600 artefacts here without hesitation.** The native Rock'tal option amplifies *Collector* — zero value to you |

**T3 research order: 18 → 13 → 14 → 15 → 17 → 16**

### Population gates (all tiers)

| Slot | Tier | Pop | Slot | Tier | Pop |
|---|---|---|---|---|---|
| 1 | T1 | 200,000 | 10 | T2 | 7,000,000 |
| 2 | T1 | 300,000 | 11 | T2 | 9,000,000 |
| 3 | T1 | 400,000 | 12 | T2 | 11,000,000 |
| 4 | T1 | 500,000 | 13 | T3 | 13,000,000 |
| 5 | T1 | 750,000 | 14 | T3 | 26,000,000 |
| 6 | T1 | 1,000,000 | 15 | T3 | 56,000,000 |
| 7 | T2 | 1,200,000 | 16 | T3 | 112,000,000 |
| 8 | T2 | 3,000,000 | 17 | T3 | 224,000,000 |
| 9 | T2 | 5,000,000 | 18 | T3 | 448,000,000 |

Artefact budget if nothing rolls free: slots 1, 2, 4, 5 (200 ea) + 6, 8, 11, 12 (400 ea) + 13, 14, 15, 18 (600 ea) = **4,800**.

---

## 7. Standard research order (non-lifeform)

Roughly in priority sequence once the opening is done:

```
Astrophysics    → push relentlessly. Every odd level = a planet, every
                  perfect square = an expedition slot. This is your #1
                  research sink until ~level 20.

Computer Tech   → fleet slots (= Computer + 1). You need slots for expos
                  AND exploration missions AND transports. Push to 10+.

Energy 8 + Laser 10 → unlocks PLASMA TECHNOLOGY
Plasma Tech     → +1% metal, +0.66% crystal, +0.33% deut per level,
                  empire-wide. Best production research in the game.
                  Never stop levelling it.

Computer 8 + Hyperspace Tech 8 → Intergalactic Research Network (IRN)
IRN             → each level networks one more planet's Research Lab
                  into your effective lab total. Massive with Discoverer's
                  −25% research time.

Combustion Drive → 6 for Large Cargo, then keep climbing for cargo speed
Hyperspace Drive → 2 for Pathfinder, 6 for Destroyer
Hyperspace Technology → 3 for Hyperspace Drive 1 (prereq), 8 for IRN (with Computer 8)
Shielding 5      → Pathfinder (Hyperspace Drive 1 prereq)
Weapons/Shield/Armour → only enough to survive expedition pirates/aliens
Espionage        → 6–8 is plenty. Higher levels make you easier to scan.
Graviton         → skip unless you specifically want Deathstars/moon
                   destruction. Not part of this build.
```

**Skip or defer:** Impulse Drive beyond 3–5, high Espionage, Ion Tech beyond what Plasma requires.

---

## 8. Facilities

| Facility | When | Notes |
|---|---|---|
| Robotics Factory | 2 early, 10 before Nanite | Prereq for Nanite (Robotics 10 + Computer 10) |
| Research Lab | Homeworld first, then everywhere once IRN is up | Only networked labs count |
| Shipyard | 4 (Colony Ship / LC / Recycler) → 5 (Pathfinder) → 9 (Destroyer) | |
| Nanite Factory | Once mines are ~lvl 25+ AND you have surplus | Costs ~1M metal / 500k crystal / 100k deut at lvl 1. **Also gates lifeform building speed** — that's the real reason to build it in this playstyle |
| Terraformer | After Nanite 1 + Energy Tech 12 | +5 fields/lvl. Discoverer's +10% colony fields reduces how much you need |
| Missile Silo | Low priority | Only if you're being missile-harassed |
| Alliance Depot | Skip unless your alliance actively ACS-defends | |

**Nanite rule of thumb:** don't chase Nanite levels for their own sake. If your next mine takes 5 days to build and 14 days to afford, Nanite 4 buys you nothing. Build Nanite when build time is genuinely the bottleneck, or when lifeform building queues are stalling you.

---

## 9. Energy

1. **Solar Plant** until ~level 20–25. Past that, each level costs more than the energy is worth.
2. Then **Solar Satellites** — especially on positions 1–3 (hot planets produce more satellite energy). Satellites are debris on death, so keep them modest on farmable planets or accept the loss.
3. **Fusion Reactor** is viable if you're deut-rich, but it eats the resource you need for expeditions. Generally: satellites + Rock'tal **Disruption Chamber** + **Geothermal Power Plants** research is the cheaper path.
4. Rock'tal Disruption Chamber both **adds energy and reduces consumption** on the planet — cheap ×1.20 factor, level it to 15–20 everywhere.

---

## 10. Expedition operations

This is your job. Everything above exists to make this loop bigger.

### Fleet composition

You want to hit the **expedition point target** without overshooting, then fill the rest with cargo.

| Ship | Expo points |
|---|---|
| Espionage Probe | 5 |
| Small Cargo / Light Fighter | 20 |
| Heavy Fighter | 50 |
| Large Cargo | 60 |
| Cruiser | 135 |
| Battleship | 300 |
| Battlecruiser | 350 |
| Bomber | 375 |
| Destroyer | 550 |

**Deathstars, Colony Ships and Recyclers contribute nothing — never send them.**

Baseline expo-miner fleet: **1 Pathfinder + N Large Cargo + 1 Espionage Probe.**

Cargo sizing table (×1 eco, no bonuses — **multiply by `eco_speed × 1.5 × 2`** for your actual Discoverer+Pathfinder setup):

| Rank-1 general points | Point target | Baseline cargo |
|---|---|---|
| < 100k | 2,500 | 42 LC + 1 probe |
| < 1M | 6,000 | 100 LC + 1 probe |
| < 5M | 9,000 | 150 LC + 1 probe |
| ≥ 100M | 25,000 | 400 LC + 1 probe |

A full find with insufficient cargo wastes the whole yield. Overprovision cargo rather than under.

Add **1 Bomber** to the fleet if pirate/alien losses are annoying you — Discoverer already halves the encounter rate.

### Outcome table

| Event | Probability |
|---|---|
| Resources | 32.5% |
| Abandoned ships | 22% |
| Nothing | 18.6% |
| Dark Matter | 9% |
| Delay (2×/3×/5× return time) | 7% |
| Pirates | 5.8% |
| Aliens | 2.6% |
| Early return | 2% |
| Merchant | 0.7% |
| **Black hole (fleet lost)** | **0.33%** |

Pirates fight at your combat tech −3, at 30–80% of your structural integrity. Aliens fight at your tech **+3** at 40–120% — significantly nastier.

**Merchant:** click the **black** trade button, not the green one. Green dismisses the merchant and charges you 3,500 DM for a replacement.

### System depletion

Loot degrades if you hammer one system. Regeneration is 10 expeditions/day.

| Message | Status | Action |
|---|---|---|
| Zone not exhausted | 0–10 expos/day | Keep going |
| Zone a little exhausted | 10–25/day | Start rotating |
| Zone exhausted | 25+/day | Move systems |

- Uni speed ≤ ×2: max ~3 continuous expeditions per system position
- Uni speed > ×2: max ~2
- Avoid systems where another Discoverer is running expos — you deplete each other

---

## 11. Daily loop

```
1. Recall/redispatch all expedition slots        (main income)
2. Fire off exploration missions                 (artefacts + LF XP)
   — they bank at 50/day, so batch them if you skip a day
3. Check galaxy for new inactives in range       (Pathfinders farm these
   well: 10k cargo, Discoverer takes 75% loot instead of 50%)
4. Queue mines / lifeform buildings so nothing idles
5. Queue research so the lab never sits empty
6. Fleetsave anything not in the air
```

**Fleetsave:** the expo-miner's structural advantage is that your fleet is *usually already in the air*. For what isn't — deut on moons, or a slow transport to a far coordinate timed to land after you're back. Never leave a fleet parked on a planet overnight.

---

## 12. Defence policy

Build enough that a casual raider's profit calculation comes out negative, and no more. You will never out-turtle a determined fleeter.

Per planet, scaled to your account size:
- Rocket Launchers as bulk cannon fodder (cheapest hull per resource)
- Light Lasers in a supporting ratio (~1 LL per 3–5 RL)
- Plasma Turrets once you have Plasma Tech — best value per resource by far
- Small Shield Dome, then Large Shield Dome
- **Skip** Gauss/Ion largely; skip Anti-Ballistic Missiles unless actually being missiled

The real defence is: keep resources moving, keep storages from being fat, and don't be the most profitable target in your neighbourhood.

---

## 13. Moons

Moon chance = `debris field / 100,000`, capped at 20%. You'll want moons for:
- **Sensor Phalanx** (range = `(level² − 1)` systems, ×1.2 for you) — defensive intel
- **Jump Gate** (Lunar Base 1 + Hyperspace Tech 7) — instant fleet repositioning, huge for logistics
- Fleetsave parking

As an expo-miner, moons come from deliberately crashing your own ships or from alliance help. Target 1 moon per active planet eventually; prioritise moons on your lifeform capitals and expedition-launch planets.

---

## 14. Long-term milestone checklist

- [ ] Astrophysics 4 — 2 expo slots
- [ ] First Pathfinder built
- [ ] Lifeforms activated, Intergalactic Envoys researched
- [ ] Rock'tal + Kaelesh + Mecha discovered
- [ ] All planets switched to Rock'tal
- [ ] All 6 T1 lifeform slots unlocked and assigned
- [ ] Plasma Technology unlocked (Energy 8 + Laser 10)
- [ ] Astrophysics 9 — 5 colonies, 5 expo slots
- [ ] IRN unlocked (Computer 8 + Hyperspace 8)
- [ ] Nanite Factory on lifeform capital
- [ ] All 6 T2 lifeform slots unlocked and assigned
- [ ] Astrophysics 16 — 8 colonies, 6 expo slots
- [ ] Lifeform XP level 100 (+10% to all LF effects)
- [ ] Megalith 10 on lifeform capital
- [ ] Slot 18 = Kaelesh Discoverer Enhancement (600 artefacts)
- [ ] All 18 slots assigned
- [ ] Astrophysics 25 — 13 colonies, 7 expo slots
- [ ] Plasma Tech 15+
- [ ] Terraformers everywhere fields are the constraint

---

## 15. Tools

- **toolsforogame.com** — costs calculator (shows cumulative cost, real build time given your Robotics/Nanite, and points per level), production calculator, battle sim with lifeform bonus fields, flight time, phalanx range
- **proxyforgame.com/en/ogame/calc/lfcosts.php** — lifeform building cost calculator
- **lonestarx.net** — lifeform calculator
- **OGLight** and similar browser add-ons — check compatibility, v13 broke most of them on rollout

Use the costs calculator to decide your next mine rather than following a fixed ratio. The rule is **amortisation**: build whichever mine repays its cost fastest at your current bonuses. As a starting heuristic, keep Crystal ~2 levels under Metal and Deuterium ~4–6 under, then let the calculator take over once Plasma and lifeform bonuses start distorting the maths.

---

## 16. Common ways this build goes wrong

| Mistake | Consequence |
|---|---|
| Stacking colonies in one system | Trivially farmable; also depletes your own expo systems |
| Hoarding artefacts past 3,600 | You stop earning entirely — spend them |
| Over-levelling Rune Forge / Oriktorium early | ×1.70 and ×1.65 factors will eat your entire economy |
| Building Megalith after Oriktorium | You pay full price on the most expensive building in the tree |
| Under-provisioning expedition cargo | Wastes full-cap finds, which are the whole point |
| Chasing Nanite levels with no resources to feed the queue | Dead capital |
| Levelling Espionage high | Makes you a more attractive, more visible target |
| Solar Plant past ~25 | Negative return; switch to satellites + Disruption Chamber |
| Parking fleet on a planet overnight | This is how accounts die |
