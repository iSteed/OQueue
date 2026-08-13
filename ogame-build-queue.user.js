// ==UserScript==
// @name         OQueue - OGame Build Queue
// @namespace    https://github.com/iSteed/OQueue
// @version      0.10.0
// @description  Floating build-queue panel for OGame: manual checklist, DOM auto-detection, multi-planet, import, templates, and a rule-based planner.
// @match        https://*.ogame.gameforge.com/game/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/iSteed/OQueue/main/ogame-build-queue.user.js
// @downloadURL  https://raw.githubusercontent.com/iSteed/OQueue/main/ogame-build-queue.user.js
// ==/UserScript==

// ---- buildings.js ------------------------------------------------
/*
 * Building shorthand -> stable OGame building ID map.
 *
 * OGame internal building IDs are stable across servers/languages (they come from
 * the game's LocutusID/object-id system), so we key everything off these numbers
 * rather than localized building names.
 *
 * CONFIRMED against a live OGame session (2026-08-03, server s276-en) by reading
 * `li.technology[data-technology]` on the supplies and facilities pages - every
 * id below matches the game's own `data-technology` attribute exactly.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Buildings = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // shorthand code -> { id, name }
  const BUILDINGS = {
    // Resources page (supplies) - high confidence
    M:  { id: 1,  name: 'Metal Mine' },
    C:  { id: 2,  name: 'Crystal Mine' },
    D:  { id: 3,  name: 'Deuterium Synthesizer' },
    S:  { id: 4,  name: 'Solar Plant' },
    F:  { id: 12, name: 'Fusion Reactor' },
    MS: { id: 22, name: 'Metal Storage' },
    CS: { id: 23, name: 'Crystal Storage' },
    DS: { id: 24, name: 'Deuterium Tank' },

    // Facilities page (station)
    R:  { id: 14, name: 'Robotics Factory' },
    SY: { id: 21, name: 'Shipyard' },
    RL: { id: 31, name: 'Research Lab' },
    AD: { id: 34, name: 'Alliance Depot' },
    MSI:{ id: 44, name: 'Missile Silo' },
    NF: { id: 15, name: 'Nanite Factory' },
    T:  { id: 33, name: 'Terraformer' },
    SD: { id: 36, name: 'Space Dock' },
  };

  const BY_ID = {};
  for (const code in BUILDINGS) {
    BY_ID[BUILDINGS[code].id] = { code, name: BUILDINGS[code].name };
  }

  // Friendly rule-DSL variable names -> shorthand codes, e.g. "Metal" -> "M".
  // Used by the rule engine so users can write `Metal = Crystal + 2` instead
  // of shorthand codes in rule text.
  const RULE_ALIASES = {
    Metal: 'M',
    Crystal: 'C',
    Deuterium: 'D',
    Solar: 'S',
    Fusion: 'F',
    Robotics: 'R',
    Shipyard: 'SY',
    Research: 'RL',
    Nanite: 'NF',
    Terraformer: 'T',
    SpaceDock: 'SD',
    AllianceDepot: 'AD',
    MissileSilo: 'MSI',
    MetalStorage: 'MS',
    CrystalStorage: 'CS',
    DeuteriumTank: 'DS',
  };

  function codeForAlias(name) {
    if (RULE_ALIASES[name]) return RULE_ALIASES[name];
    if (BUILDINGS[name.toUpperCase()]) return name.toUpperCase();
    return null;
  }

  function byCode(code) {
    const entry = BUILDINGS[code.toUpperCase()];
    if (!entry) throw new Error(`Unknown building shorthand: ${code}`);
    return { code: code.toUpperCase(), id: entry.id, name: entry.name };
  }

  function byId(id) {
    const entry = BY_ID[id];
    if (!entry) throw new Error(`Unknown building id: ${id}`);
    return { code: entry.code, id, name: entry.name };
  }

  return { BUILDINGS, byCode, byId, RULE_ALIASES, codeForAlias };
});

// ---- technologies.js ---------------------------------------------
/*
 * Technology shorthand -> stable OGame research ID map. Mirrors buildings.js
 * exactly (same shape, same byCode/byId functions) since the research page
 * uses the same `data-technology`-based level pattern as buildings/facilities.
 *
 * CORRECTED (2026-08-06): the first five ids (EP/CT/WT/ST/AT) were off by
 * one-to-two from OGame's real numbering - a user report of Espionage
 * Technology (actually level 2) reading as level 0/missing traced back to
 * EP pointing at id 108, which is really Computer Technology's row. Fixed
 * against OGame's known research id list: EP=106, CT=108, WT=109, ST=110,
 * AT=111 (EN=113 onward was already correct). STILL NOT verified against a
 * live research page's `data-technology` attributes the way buildings.js's
 * ids were - do that confirmation once possible.
 *
 * Shorthand codes were chosen to not collide with any building code in
 * buildings.js, so the same import/edit textarea works for both.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Technologies = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TECHNOLOGIES = {
    EP: { id: 106, name: 'Espionage Technology' },
    CT: { id: 108, name: 'Computer Technology' },
    WT: { id: 109, name: 'Weapons Technology' },
    ST: { id: 110, name: 'Shielding Technology' },
    AT: { id: 111, name: 'Armour Technology' },
    EN: { id: 113, name: 'Energy Technology' },
    HT: { id: 114, name: 'Hyperspace Technology' },
    CD: { id: 115, name: 'Combustion Drive' },
    ID: { id: 117, name: 'Impulse Drive' },
    HD: { id: 118, name: 'Hyperspace Drive' },
    LT: { id: 120, name: 'Laser Technology' },
    IT: { id: 121, name: 'Ion Technology' },
    PT: { id: 122, name: 'Plasma Technology' },
    IRN: { id: 123, name: 'Intergalactic Research Network' },
    AP: { id: 124, name: 'Astrophysics' },
    GT: { id: 199, name: 'Graviton Technology' },
  };

  const BY_ID = {};
  for (const code in TECHNOLOGIES) {
    BY_ID[TECHNOLOGIES[code].id] = { code, name: TECHNOLOGIES[code].name };
  }

  function byCode(code) {
    const entry = TECHNOLOGIES[code.toUpperCase()];
    if (!entry) throw new Error(`Unknown technology shorthand: ${code}`);
    return { code: code.toUpperCase(), id: entry.id, name: entry.name };
  }

  function byId(id) {
    const entry = BY_ID[id];
    if (!entry) throw new Error(`Unknown technology id: ${id}`);
    return { code: entry.code, id, name: entry.name };
  }

  return { TECHNOLOGIES, byCode, byId };
});

// ---- lifeformBuildings.js ----------------------------------------
/*
 * Lifeform building shorthand -> stable OGame ID map, namespaced by species
 * since each lifeform (Humans/Rock'tal/Mecha/Kaelesh) has its own building
 * set - a planet only ever has one active species, so codes are looked up
 * per-species rather than merged into one flat table.
 *
 * CONFIRMED live (2026-08-03, server s276-en) for HUMANS: read real
 * `data-technology` attributes on the `lfbuildings` page (same
 * `li.technology[data-technology]` / `.level[data-value]` markup as regular
 * buildings/research - readLevelsFor in dom.js works unchanged).
 *
 * CONFIRMED live (2026-08-05, server s276-en, planet "Ukdah") for ROCK'TAL:
 * same page/markup, `aria-label` on each `li.technology` gave the real name.
 * This also confirmed the id-block guess from the earlier comment: Humans =
 * 111xx, Rock'tal = 121xx - a per-species block of 12 ids each.
 *
 * Mecha/Kaelesh are NOT included yet - not verified live. Add each species
 * only once verified the same way, per OQueue's "no invented IDs" convention.
 *
 * SPECIES_BY_INDEX maps the active-species indicator seen live
 * (`#lifeform .lifeform-item-icon` carries a `lifeformN` class, N = 1 for
 * Humans, 2 for Rock'tal) to the species key here - used by
 * dom.js#activeLifeformSpecies to auto-detect which table to read against.
 * Only indices confirmed live are listed; 3/4 (presumably Mecha/Kaelesh) are
 * an unconfirmed guess and intentionally left out.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.LifeformBuildings = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HUMANS = {
    RS: { id: 11101, name: 'Residential Sector' },
    BF: { id: 11102, name: 'Biosphere Farm' },
    RC: { id: 11103, name: 'Research Centre' },
    AS: { id: 11104, name: 'Academy of Sciences' },
    NCC: { id: 11105, name: 'Neuro-Calibration Centre' },
    HES: { id: 11106, name: 'High Energy Smelting' },
    FS: { id: 11107, name: 'Food Silo' },
    FPP: { id: 11108, name: 'Fusion-Powered Production' },
    SKY: { id: 11109, name: 'Skyscraper' },
    BL: { id: 11110, name: 'Biotech Lab' },
    MET: { id: 11111, name: 'Metropolis' },
    PS: { id: 11112, name: 'Planetary Shield' },
  };

  const ROCKTAL = {
    ME:  { id: 12101, name: 'Meditation Enclave' },
    CF:  { id: 12102, name: 'Crystal Farm' },
    RT:  { id: 12103, name: 'Rune Technologium' },
    RF:  { id: 12104, name: 'Rune Forge' },
    ORI: { id: 12105, name: 'Oriktorium' },
    MF:  { id: 12106, name: 'Magma Forge' },
    DC:  { id: 12107, name: 'Disruption Chamber' },
    MEG: { id: 12108, name: 'Megalith' },
    CR:  { id: 12109, name: 'Crystal Refinery' },
    DSY: { id: 12110, name: 'Deuterium Synthesiser' },
    MRC: { id: 12111, name: 'Mineral Research Centre' },
    ARP: { id: 12112, name: 'Advanced Recycling Plant' },
  };

  const SPECIES = { HUMANS, ROCKTAL };

  // Active-species indicator index (see file header) -> species key here.
  const SPECIES_BY_INDEX = { 1: 'HUMANS', 2: 'ROCKTAL' };

  function buildingsFor(species) {
    const set = SPECIES[species];
    if (!set) throw new Error(`Unknown lifeform species: ${species}`);
    return set;
  }

  function byCode(species, code) {
    const set = buildingsFor(species);
    const entry = set[code.toUpperCase()];
    if (!entry) throw new Error(`Unknown ${species} lifeform building shorthand: ${code}`);
    return { code: code.toUpperCase(), id: entry.id, name: entry.name };
  }

  function byId(species, id) {
    const set = buildingsFor(species);
    for (const code in set) {
      if (set[code].id === id) return { code, id, name: set[code].name };
    }
    throw new Error(`Unknown ${species} lifeform building id: ${id}`);
  }

  return { SPECIES, SPECIES_BY_INDEX, byCode, byId };
});

// ---- ships.js ----------------------------------------------------
/*
 * Ship shorthand -> stable OGame ship ID map. Mirrors buildings.js/
 * technologies.js exactly (same shape, same byCode/byId), but for the
 * dispatchable ship roster shown on the Fleet Dispatch page.
 *
 * CONFIRMED live (2026-08-05, server s276-en) by reading
 * `li.technology[data-technology]` + `aria-label` on the fleetdispatch
 * page's ship selector - every id below matches. Solar Satellite and
 * Crawler deliberately aren't here: neither is dispatchable (they don't
 * appear in that list at all), so they don't belong in this registry.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Ships = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SHIPS = {
    LF:  { id: 204, name: 'Light Fighter' },
    HF:  { id: 205, name: 'Heavy Fighter' },
    CRU: { id: 206, name: 'Cruiser' },
    BS:  { id: 207, name: 'Battleship' },
    BC:  { id: 215, name: 'Battlecruiser' },
    BM:  { id: 211, name: 'Bomber' },
    DES: { id: 213, name: 'Destroyer' },
    DTH: { id: 214, name: 'Deathstar' },
    RPR: { id: 218, name: 'Reaper' },
    PF:  { id: 219, name: 'Pathfinder' },
    SC:  { id: 202, name: 'Small Cargo' },
    LC:  { id: 203, name: 'Large Cargo' },
    COL: { id: 208, name: 'Colony Ship' },
    RCY: { id: 209, name: 'Recycler' },
    PRB: { id: 210, name: 'Espionage Probe' },
  };

  const BY_ID = {};
  for (const code in SHIPS) {
    BY_ID[SHIPS[code].id] = { code, name: SHIPS[code].name };
  }

  function byCode(code) {
    const entry = SHIPS[code.toUpperCase()];
    if (!entry) throw new Error(`Unknown ship shorthand: ${code}`);
    return { code: code.toUpperCase(), id: entry.id, name: entry.name };
  }

  function byId(id) {
    const entry = BY_ID[id];
    if (!entry) throw new Error(`Unknown ship id: ${id}`);
    return { code: entry.code, id, name: entry.name };
  }

  // Expedition points per ship, straight from BuildOrder.md section 10's
  // "Fleet composition" table for the 9 ships it lists explicitly. PF and
  // RPR aren't in that table, so they're derived from the doc's own
  // formula instead of guessed: points = (metal cost + crystal cost) x
  // 5 / 1000, using each ship's known build cost (deuterium doesn't count).
  // Verified the formula reproduces every one of the doc's 9 listed values
  // exactly before trusting it for these two:
  //   PF:  (8,000 metal + 15,000 crystal) x 5 / 1000 = 115
  //   RPR: (85,000 metal + 55,000 crystal) x 5 / 1000 = 700
  // DTH/COL/RCY are explicitly called out in the doc as contributing
  // nothing to an expedition ("never send them") - 0 here reflects the
  // game's own exclusion, not a gap in the formula.
  const EXPO_POINTS = {
    PRB: 5,
    SC: 20,
    LF: 20,
    HF: 50,
    LC: 60,
    CRU: 135,
    BS: 300,
    BC: 350,
    BM: 375,
    DES: 550,
    PF: 115,
    RPR: 700,
    DTH: 0,
    COL: 0,
    RCY: 0,
  };

  function expoPointsFor(code) {
    const upper = code.toUpperCase();
    if (!(upper in EXPO_POINTS)) throw new Error(`No expedition point value for ship shorthand: ${code}`);
    return EXPO_POINTS[upper];
  }

  return { SHIPS, byCode, byId, EXPO_POINTS, expoPointsFor };
});

// ---- formulas.js -------------------------------------------------
/*
 * OGame energy formulas: how much energy a building produces or consumes at
 * a given level. Sourced from the standard, publicly documented OGame
 * formulas (widely cross-published across community wikis/tools) - NOT yet
 * numerically cross-checked against a real account's displayed production
 * numbers. Worth a quick sanity check against the overview page's actual
 * production/consumption figures if these ever look off in practice.
 *
 * Deliberately scoped to energy only (not full metal/crystal/deuterium
 * production modeling) - that's all the build-order generator needs.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Formulas = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Metal Mine and Crystal Mine draw energy identically.
  function energyConsumptionMine(level) {
    return 10 * level * Math.pow(1.1, level);
  }

  // Temperature affects deuterium *production*, not the synthesizer's own
  // energy draw, per standard OGame formulas - no temperature param needed here.
  function energyConsumptionDeuteriumSynthesizer(level) {
    return 20 * level * Math.pow(1.1, level);
  }

  function energyProductionSolarPlant(level) {
    return 20 * level * Math.pow(1.1, level);
  }

  // LOW CONFIDENCE: real Fusion Reactor output also scales with Energy
  // Technology research level, which OQueue doesn't track. This assumes
  // Energy Technology 0 (a conservative/pessimistic estimate) and is not
  // used by the build-order generator - included for completeness only.
  function energyProductionFusionReactor(level) {
    return 30 * level * Math.pow(1.1, level);
  }

  // levels: { M, C, D, S, F } (shorthand building codes -> current level).
  // Returns net energy (production - consumption); non-negative is healthy.
  function energyBalance(levels) {
    levels = levels || {};
    const consumption =
      energyConsumptionMine(levels.M || 0) +
      energyConsumptionMine(levels.C || 0) +
      energyConsumptionDeuteriumSynthesizer(levels.D || 0);
    const production =
      energyProductionSolarPlant(levels.S || 0) +
      energyProductionFusionReactor(levels.F || 0);
    return production - consumption;
  }

  return {
    energyConsumptionMine,
    energyConsumptionDeuteriumSynthesizer,
    energyProductionSolarPlant,
    energyProductionFusionReactor,
    energyBalance,
  };
});

// ---- buildorder.js -----------------------------------------------
/*
 * Build-order generator: takes a community-informed priority order (what to
 * build, ignoring Solar Plant) and inserts Solar Plant level-ups at exactly
 * the points required to keep energy non-negative, using the real formulas
 * in formulas.js instead of guessing timing by eye.
 *
 * priorityTargets: ordered [{code, level}], any building except 'S' (Solar
 * Plant is inserted automatically - don't include it yourself).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings,
      typeof require !== 'undefined' ? require('./formulas') : root.OQueue.Formulas
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.BuildOrder = factory(root.OQueue.Buildings, root.OQueue.Formulas);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings, Formulas) {
  'use strict';

  function toQueueItem(code, level) {
    const b = Buildings.byCode(code);
    return { code: b.code, id: b.id, name: b.name, level };
  }

  function generateBuildOrder(priorityTargets, opts) {
    opts = opts || {};
    const levels = Object.assign({ M: 0, C: 0, D: 0, S: 0, F: 0 }, opts.startingLevels || {});
    const output = [];

    function pushSolarUntilSafe(targetCode, targetLevel) {
      while (true) {
        const projected = Object.assign({}, levels, { [targetCode]: targetLevel });
        if (Formulas.energyBalance(projected) >= 0) break;
        levels.S += 1;
        output.push(toQueueItem('S', levels.S));
      }
    }

    for (const target of priorityTargets) {
      if (target.code !== 'S') {
        pushSolarUntilSafe(target.code, target.level);
      }
      levels[target.code] = target.level;
      output.push(toQueueItem(target.code, target.level));
    }

    return output;
  }

  // Community-informed priority orders (the "tap the nerds" half) - what to
  // build and when, independent of the energy math above.

  const BALANCED_ECONOMY = [
    { code: 'M', level: 1 }, { code: 'C', level: 1 },
    { code: 'M', level: 2 }, { code: 'C', level: 2 },
    { code: 'M', level: 3 }, { code: 'C', level: 3 },
    { code: 'R', level: 2 },
    { code: 'M', level: 5 }, { code: 'C', level: 5 },
    { code: 'MS', level: 1 }, { code: 'CS', level: 1 },
    { code: 'M', level: 7 }, { code: 'C', level: 6 },
    { code: 'RL', level: 1 },
    { code: 'M', level: 9 }, { code: 'C', level: 8 },
    { code: 'R', level: 3 },
    { code: 'D', level: 3 },
    { code: 'M', level: 11 }, { code: 'C', level: 10 },
    { code: 'MS', level: 3 }, { code: 'CS', level: 3 },
  ];

  const RUSHER = [
    { code: 'M', level: 1 }, { code: 'C', level: 1 },
    { code: 'M', level: 2 }, { code: 'C', level: 2 },
    { code: 'R', level: 2 },
    { code: 'M', level: 4 }, { code: 'C', level: 3 },
    { code: 'SY', level: 2 },
    { code: 'M', level: 6 }, { code: 'C', level: 5 },
    { code: 'SY', level: 4 },
    { code: 'M', level: 8 }, { code: 'C', level: 6 },
    { code: 'R', level: 4 },
    { code: 'D', level: 2 },
    { code: 'M', level: 10 }, { code: 'C', level: 8 },
    { code: 'SY', level: 6 },
  ];

  // BuildOrder.md §3's "Each new colony's build order" (Metal 1-6, Solar
  // interleaved, Crystal 1-4, Robotics 2->4, Deuterium 1-3, Shipyard 1),
  // continued past the guide's hand-wavy "to parity with the rest of the
  // empire" using the same community-informed ramp Balanced Economy uses -
  // long enough to cover most of a colony's early-to-mid growth rather than
  // stopping right after bootstrap.
  // No Research Lab targets in here on purpose: per BuildOrder.md's
  // research-priority table, "Only networked labs count" - a colony's lab
  // does nothing for research speed until Intergalactic Research Network
  // reaches it (Computer Tech 8 + Hyperspace Tech 8, homeworld-first). This
  // generator has no way to know whether IRN is up on your account, so it
  // leaves Research Lab out entirely rather than guess - add it by hand
  // once IRN covers this colony.
  const NEW_COLONY = [
    { code: 'M', level: 1 }, { code: 'M', level: 2 }, { code: 'M', level: 3 },
    { code: 'C', level: 1 },
    { code: 'M', level: 4 }, { code: 'C', level: 2 },
    { code: 'M', level: 5 }, { code: 'C', level: 3 },
    { code: 'D', level: 1 },
    { code: 'M', level: 6 }, { code: 'C', level: 4 },
    { code: 'R', level: 2 },
    { code: 'D', level: 2 },
    { code: 'R', level: 3 },
    { code: 'D', level: 3 },
    { code: 'R', level: 4 },
    { code: 'SY', level: 1 },
    // Bootstrap ends here; continue toward empire parity.
    { code: 'M', level: 8 }, { code: 'C', level: 6 },
    { code: 'MS', level: 1 }, { code: 'CS', level: 1 },
    { code: 'M', level: 10 }, { code: 'C', level: 8 },
    { code: 'D', level: 5 },
    { code: 'M', level: 12 }, { code: 'C', level: 10 },
    { code: 'R', level: 5 },
    { code: 'SY', level: 2 },
    { code: 'MS', level: 3 }, { code: 'CS', level: 3 },
    { code: 'M', level: 14 }, { code: 'C', level: 12 },
    { code: 'D', level: 7 },
    { code: 'M', level: 16 }, { code: 'C', level: 14 },
    { code: 'R', level: 6 },
    { code: 'SY', level: 3 },
    { code: 'DS', level: 1 },
    { code: 'M', level: 18 }, { code: 'C', level: 16 },
    { code: 'D', level: 9 },
    { code: 'MS', level: 5 }, { code: 'CS', level: 5 },
    { code: 'M', level: 20 }, { code: 'C', level: 18 },
    { code: 'SY', level: 4 },
    { code: 'D', level: 11 },
    { code: 'DS', level: 3 },
  ];

  const PRESETS = {
    'Balanced Economy': generateBuildOrder(BALANCED_ECONOMY),
    Rusher: generateBuildOrder(RUSHER),
    'New Colony': generateBuildOrder(NEW_COLONY),
  };

  return { generateBuildOrder, BALANCED_ECONOMY, RUSHER, NEW_COLONY, PRESETS };
});

// ---- expeditions.js ----------------------------------------------
/*
 * Expedition fleet-sizing advisor: given the rank-1 player's Points-category
 * score (the "general points" BuildOrder.md's expedition find formula scales
 * off), looks up the baseline point target from the doc's own table
 * (BuildOrder.md section 10, "Fleet composition"), then builds an actual
 * loadout - specific ships, specific counts - out of whatever's really
 * sitting in the hangar (Dom.readShipCounts), instead of just repeating a
 * flat "42 LC" figure that assumes unlimited Large Cargo.
 *
 * SOURCE (community-informed, ×1 eco/no bonuses baseline - BuildOrder.md
 * says to multiply by eco_speed x 1.5 x 2 for a Discoverer+Pathfinder setup,
 * which this module deliberately does NOT attempt since eco_speed isn't
 * tracked anywhere yet):
 *   < 100k      -> 2,500 pts
 *   < 1M        -> 6,000 pts
 *   < 5M        -> 9,000 pts
 *   >= 100M     -> 25,000 pts
 *
 * NOTE: the source table has a real gap between 5M and 100M - not an
 * omission here, BuildOrder.md itself doesn't define that range. Points in
 * the gap fall back to the < 5M bracket, flagged `approximate: true` so
 * callers can say "floor, not a target" instead of presenting it as exact.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(typeof require !== 'undefined' ? require('./ships') : root.OQueue.Ships);
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Expeditions = factory(root.OQueue.Ships);
  }
})(typeof self !== 'undefined' ? self : this, function (Ships) {
  'use strict';

  const CARGO_TABLE = [
    { maxPoints: 100000, pointTarget: 2500 },
    { maxPoints: 1000000, pointTarget: 6000 },
    { maxPoints: 5000000, pointTarget: 9000 },
  ];
  const TOP_BRACKET = { minPoints: 100000000, pointTarget: 25000 };

  // rank1Points: number | null (unknown). Returns null if unknown, otherwise
  // { pointTarget, approximate }.
  function cargoTargetForRank1Points(rank1Points) {
    if (rank1Points == null || isNaN(rank1Points)) return null;

    if (rank1Points >= TOP_BRACKET.minPoints) {
      return { pointTarget: TOP_BRACKET.pointTarget, approximate: false };
    }
    for (const bracket of CARGO_TABLE) {
      if (rank1Points < bracket.maxPoints) {
        return { pointTarget: bracket.pointTarget, approximate: false };
      }
    }
    // Falls in the undocumented 5M-100M gap - use the highest defined
    // bracket as a floor rather than inventing numbers.
    const last = CARGO_TABLE[CARGO_TABLE.length - 1];
    return { pointTarget: last.pointTarget, approximate: true };
  }

  // A launchable expedition fleet needs a Pathfinder (BuildOrder.md section
  // 3: "One Pathfinder in an expedition fleet doubles the find... get one
  // per expedition slot") and at least one cargo ship to carry the loot
  // home - Large Cargo preferred, Small Cargo as a fallback for an early
  // account that hasn't unlocked LC yet.
  function hasExpeditionFleet(shipCounts) {
    shipCounts = shipCounts || {};
    return {
      pathfinder: (shipCounts.PF || 0) > 0,
      cargo: (shipCounts.LC || 0) > 0 || (shipCounts.SC || 0) > 0,
    };
  }

  // Builds an actual dispatchable loadout out of what's really in the
  // hangar: 1 Pathfinder + 1 Probe (BuildOrder.md's "baseline expo-miner
  // fleet"), then fills the remaining point target with Large Cargo first,
  // Small Cargo second, capped at whatever count is actually available -
  // never suggests more of a ship than the account owns. Returns
  // { plan: [{code, name, count}], pointsAchieved, pointTarget, shortfall }
  // - shortfall > 0 means the available cargo can't fully reach the target
  // even using everything in the hangar.
  function suggestLoadout(shipCounts, pointTarget) {
    shipCounts = shipCounts || {};
    const plan = [];
    let points = 0;

    function take(code, want) {
      if (want <= 0) return;
      const have = shipCounts[code] || 0;
      const count = Math.min(have, want);
      if (count > 0) {
        plan.push({ code, name: Ships.byCode(code).name, count });
        points += count * Ships.expoPointsFor(code);
      }
    }

    // Fixed, not sized to the target: recon probe + the x2 find multiplier.
    take('PRB', 1);
    take('PF', 1);

    // Fill the rest with cargo, Large Cargo preferred (fewer ships for the
    // same points/capacity), Small Cargo topping up whatever's left.
    const remaining = () => Math.max(0, pointTarget - points);
    take('LC', Math.ceil(remaining() / Ships.EXPO_POINTS.LC));
    take('SC', Math.ceil(remaining() / Ships.EXPO_POINTS.SC));

    return { plan, pointsAchieved: points, pointTarget, shortfall: Math.max(0, pointTarget - points) };
  }

  function formatLoadout(loadout) {
    const parts = loadout.plan.map((p) => `${p.count} ${p.name}`);
    const achieved = loadout.pointsAchieved.toLocaleString();
    const target = loadout.pointTarget.toLocaleString();
    if (loadout.shortfall > 0) {
      return `${parts.join(' + ')} = ${achieved}/${target} pts (short ${loadout.shortfall.toLocaleString()} - build more cargo)`;
    }
    return `${parts.join(' + ')} = ${achieved}/${target} pts`;
  }

  // slots: { used, max } from Dom.readExpeditionSlots. shipCounts: from
  // Dom.readShipCounts. Returns null if no slot data (page not visited yet)
  // or no free slots, otherwise an advisory object for the panel:
  //   { freeSlots, maxSlots, ready, missing, suggestion }
  // ready is false (with `missing` describing what's absent) until an
  // actual Pathfinder + cargo fleet exists - only then is `suggestion` a
  // real loadout built from the hangar's actual contents instead of null.
  function buildAdvisory(slots, rank1Points, shipCounts) {
    if (!slots) return null;
    const freeSlots = Math.max(0, slots.max - slots.used);
    if (freeSlots <= 0) return null;

    const have = hasExpeditionFleet(shipCounts);
    const missing = [];
    if (!have.pathfinder) missing.push('a Pathfinder');
    if (!have.cargo) missing.push('cargo ships (Large/Small Cargo)');

    if (missing.length) {
      return { freeSlots, maxSlots: slots.max, ready: false, missing, suggestion: null };
    }

    const target = cargoTargetForRank1Points(rank1Points);
    let suggestion = null;
    if (target) {
      const loadout = suggestLoadout(shipCounts, target.pointTarget);
      suggestion = formatLoadout(loadout) + (target.approximate ? ' (target approx.)' : '');
    }

    return { freeSlots, maxSlots: slots.max, ready: true, missing: [], suggestion };
  }

  return { cargoTargetForRank1Points, hasExpeditionFleet, suggestLoadout, formatLoadout, buildAdvisory };
});

// ---- storage.js --------------------------------------------------
/*
 * localStorage wrapper. Accepts an injectable backend so the same code can run
 * under Tampermonkey (real localStorage) and under plain Node for unit tests
 * (in-memory fallback below).
 *
 * Key scheme:
 *   oqueue:planet:<planetId>    -> { mode: 'list'|'rule', list, rule, cachedLevels, done }
 *   oqueue:lifeform:<planetId>  -> same shape - a planet's lifeform-building queue,
 *                                  tracked separately from its regular building queue
 *                                  (deliberately a different prefix, not a suffix on
 *                                  oqueue:planet:, so it can't be mistaken for a planet
 *                                  id by listPlanetIds)
 *   oqueue:account              -> same shape, but singular - for account-wide
 *                                  things like research, which aren't per-planet
 *   oqueue:templates            -> { [name]: { mode: 'list'|'rule', list?, rule? } }
 *   oqueue:rank1points          -> { points, capturedAt } - last-seen rank-1
 *                                  Points-category score, cached whenever the
 *                                  player visits that highscore tab so the
 *                                  expedition cargo advisory (see
 *                                  expeditions.js) has a number to work with
 *                                  even on pages that aren't the highscore page.
 *
 * Templates use a separate backend from everything else above. Every other
 * key is legitimately per-server (planet/tech levels don't mean anything
 * across servers), so plain localStorage (scoped per-origin, i.e. per
 * subdomain like s276-en vs s275-en) is correct for those. Templates are
 * just saved rule/list definitions with no server-specific data in them, so
 * a player who plays multiple universes reasonably expects to reuse them
 * across servers - that needs storage scoped to the whole script, not to one
 * origin. Tampermonkey's GM_getValue/GM_setValue (grant added in build.js)
 * provide exactly that, and are synchronous like everything else here, so
 * they drop in without changing any calling code's shape. Falls back to the
 * regular backend when GM_* isn't available (Node tests, @grant none).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Storage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLANET_PREFIX = 'oqueue:planet:';
  const LIFEFORM_PREFIX = 'oqueue:lifeform:';
  const ACCOUNT_KEY = 'oqueue:account';
  const TEMPLATES_KEY = 'oqueue:templates';
  const RANK1_POINTS_KEY = 'oqueue:rank1points';

  function defaultQueueState() {
    return { mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] };
  }

  function memoryBackend() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key: (i) => Array.from(map.keys())[i],
      get length() { return map.size; },
    };
  }

  function defaultBackend() {
    if (typeof localStorage !== 'undefined') return localStorage;
    return memoryBackend();
  }

  // Cross-server backend for templates - see file header. Returns null (not
  // a fallback) when GM_getValue/GM_setValue aren't in scope, so callers can
  // tell "no GM support" apart from "GM support that happens to be empty".
  function gmBackend() {
    if (typeof GM_getValue !== 'function' || typeof GM_setValue !== 'function') return null;
    return {
      getItem: (k) => {
        const v = GM_getValue(k);
        return v === undefined || v === null ? null : v;
      },
      setItem: (k, v) => GM_setValue(k, v),
      removeItem: (k) => {
        if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
      },
    };
  }

  function createStore(backend, templatesBackend) {
    const be = backend || defaultBackend();
    const tbe = templatesBackend || gmBackend() || be;

    function readJSON(store, key, fallback) {
      const raw = store.getItem(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }

    function writeJSON(store, key, value) {
      store.setItem(key, JSON.stringify(value));
    }

    function getPlanetState(planetId) {
      return readJSON(be, PLANET_PREFIX + planetId, defaultQueueState());
    }

    function setPlanetState(planetId, state) {
      writeJSON(be, PLANET_PREFIX + planetId, state);
    }

    function updatePlanetState(planetId, patch) {
      const current = getPlanetState(planetId);
      const next = Object.assign({}, current, patch);
      setPlanetState(planetId, next);
      return next;
    }

    function getLifeformState(planetId) {
      return readJSON(be, LIFEFORM_PREFIX + planetId, defaultQueueState());
    }

    function setLifeformState(planetId, state) {
      writeJSON(be, LIFEFORM_PREFIX + planetId, state);
    }

    function updateLifeformState(planetId, patch) {
      const current = getLifeformState(planetId);
      const next = Object.assign({}, current, patch);
      setLifeformState(planetId, next);
      return next;
    }

    function getAccountState() {
      return readJSON(be, ACCOUNT_KEY, defaultQueueState());
    }

    function setAccountState(state) {
      writeJSON(be, ACCOUNT_KEY, state);
    }

    function updateAccountState(patch) {
      const current = getAccountState();
      const next = Object.assign({}, current, patch);
      setAccountState(next);
      return next;
    }

    function listPlanetIds() {
      const ids = [];
      const n = be.length;
      for (let i = 0; i < n; i++) {
        const key = be.key(i);
        if (key && key.startsWith(PLANET_PREFIX)) {
          ids.push(key.slice(PLANET_PREFIX.length));
        }
      }
      return ids;
    }

    function getTemplates() {
      return readJSON(tbe, TEMPLATES_KEY, {});
    }

    function saveTemplate(name, template) {
      const templates = getTemplates();
      templates[name] = template;
      writeJSON(tbe, TEMPLATES_KEY, templates);
      return templates;
    }

    function deleteTemplate(name) {
      const templates = getTemplates();
      delete templates[name];
      writeJSON(tbe, TEMPLATES_KEY, templates);
      return templates;
    }

    function getRank1Points() {
      return readJSON(be, RANK1_POINTS_KEY, null);
    }

    function setRank1Points(points) {
      const record = { points, capturedAt: Date.now() };
      writeJSON(be, RANK1_POINTS_KEY, record);
      return record;
    }

    return {
      getPlanetState,
      setPlanetState,
      updatePlanetState,
      getLifeformState,
      setLifeformState,
      updateLifeformState,
      getAccountState,
      setAccountState,
      updateAccountState,
      listPlanetIds,
      getTemplates,
      saveTemplate,
      deleteTemplate,
      getRank1Points,
      setRank1Points,
    };
  }

  return { createStore, memoryBackend };
});

// ---- import.js ---------------------------------------------------
/*
 * Import/export for shorthand queue text, e.g.:
 *   M10
 *   C8
 *   S10
 *   R2
 *   SY1
 * -> list-mode queue: [{code:'M', id:1, name:'Metal Mine', level:10}, ...]
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings,
      typeof require !== 'undefined' ? require('./technologies') : root.OQueue.Technologies,
      typeof require !== 'undefined' ? require('./lifeformBuildings') : root.OQueue.LifeformBuildings
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Import = factory(root.OQueue.Buildings, root.OQueue.Technologies, root.OQueue.LifeformBuildings);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings, Technologies, LifeformBuildings) {
  'use strict';

  const TOKEN_RE = /^([A-Za-z]+)\s*(\d+)$/;

  // Buildings, then technologies, then lifeform buildings - lets the same
  // shorthand syntax work across the per-planet building queue, the
  // account-wide research queue, and the per-planet lifeform queue.
  // species defaults to HUMANS for backward compatibility, but callers on a
  // lifeform page should pass the planet's actual active species (see
  // dom.js#activeLifeformSpecies) so e.g. Rock'tal codes resolve correctly.
  function resolveCode(code, species) {
    try {
      return Buildings.byCode(code);
    } catch (e) {
      try {
        return Technologies.byCode(code);
      } catch (e2) {
        return LifeformBuildings.byCode(species || 'HUMANS', code);
      }
    }
  }

  function parseImportText(text, species) {
    const tokens = text
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const list = [];
    const errors = [];

    for (const token of tokens) {
      const match = TOKEN_RE.exec(token);
      if (!match) {
        errors.push(`Could not parse "${token}"`);
        continue;
      }
      const [, code, levelStr] = match;
      try {
        const item = resolveCode(code, species);
        list.push({
          code: item.code,
          id: item.id,
          name: item.name,
          level: parseInt(levelStr, 10),
        });
      } catch (e) {
        errors.push(`Unknown shorthand: ${code}`);
      }
    }

    return { list, errors };
  }

  function serializeList(list) {
    return list.map((item) => `${item.code}${item.level}`).join('\n');
  }

  return { parseImportText, serializeList };
});

// ---- rules.js ----------------------------------------------------
/*
 * Rule engine: parses a small DSL into a rule spec, and resolves the next
 * build target from current building levels — no eval(), hand-written
 * tokenizer/parser/evaluator only.
 *
 * DSL text (one rule block):
 *
 *   repeat:
 *     Metal = Crystal + 2
 *     Solar >= ceil((Metal + Crystal)/2)
 *   until:
 *     Metal = 22
 *   then:
 *     Robotics = 4
 *     Shipyard = 2
 *
 * Leading "- " bullets (as in idea.md) are accepted and stripped.
 *
 * Resolution semantics:
 *   - While `until` is not yet satisfied: walk `repeat` constraints in order,
 *     return the first one whose target building hasn't reached the level the
 *     constraint implies (computed fresh from current levels every call, so
 *     building things out of order just changes what's "next", nothing goes
 *     stale).
 *   - Once `until` is satisfied: walk `then` (an ordered map) and return the
 *     first entry whose target level hasn't been reached.
 *   - Returns null when everything is satisfied (queue complete) or when a
 *     repeat cycle is stuck (all repeat constraints satisfied but `until`
 *     still not met - nothing left for the rules to ask for).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Rules = factory(root.OQueue.Buildings);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings) {
  'use strict';

  // ---- Tokenizer ----------------------------------------------------------

  const TOKEN_RE = /\s*(>=|<=|=|>|<|\+|-|\*|\/|\(|\)|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)/g;

  function tokenize(line) {
    const tokens = [];
    let match;
    let lastIndex = 0;
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(line))) {
      if (match.index !== lastIndex) {
        const skipped = line.slice(lastIndex, match.index);
        if (skipped.trim()) throw new Error(`Unexpected character near "${skipped}" in: ${line}`);
      }
      tokens.push(match[1]);
      lastIndex = TOKEN_RE.lastIndex;
    }
    if (lastIndex !== line.length && line.slice(lastIndex).trim()) {
      throw new Error(`Unexpected trailing content in: ${line}`);
    }
    return tokens;
  }

  // ---- Expression parser/evaluator ----------------------------------------

  const FUNCS = {
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
  };

  function makeExprParser(tokens) {
    let pos = 0;

    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parseExpression() {
      let node = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = next();
        const right = parseTerm();
        node = { type: 'binop', op, left: node, right };
      }
      return node;
    }

    function parseTerm() {
      let node = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = next();
        const right = parseFactor();
        node = { type: 'binop', op, left: node, right };
      }
      return node;
    }

    function parseFactor() {
      const tok = peek();
      if (tok === undefined) throw new Error('Unexpected end of expression');
      if (tok === '(') {
        next();
        const node = parseExpression();
        if (next() !== ')') throw new Error('Expected closing )');
        return node;
      }
      if (/^\d/.test(tok)) {
        next();
        return { type: 'num', value: parseFloat(tok) };
      }
      if (/^[A-Za-z_]/.test(tok)) {
        next();
        if (peek() === '(') {
          if (!FUNCS[tok]) throw new Error(`Unknown function: ${tok}`);
          next(); // (
          const arg = parseExpression();
          if (next() !== ')') throw new Error('Expected closing ) after function arg');
          return { type: 'call', fn: tok, arg };
        }
        return { type: 'var', name: tok };
      }
      throw new Error(`Unexpected token: ${tok}`);
    }

    return { parseExpression, rest: () => tokens.slice(pos) };
  }

  function evalNode(node, levels) {
    switch (node.type) {
      case 'num': return node.value;
      case 'var': {
        const code = Buildings.codeForAlias(node.name);
        if (!code) throw new Error(`Unknown variable: ${node.name}`);
        return levels[code] || 0;
      }
      case 'call':
        return FUNCS[node.fn](evalNode(node.arg, levels));
      case 'binop': {
        const l = evalNode(node.left, levels);
        const r = evalNode(node.right, levels);
        switch (node.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          default: throw new Error(`Unknown operator: ${node.op}`);
        }
      }
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  // ---- Statement parser: "Identifier CompareOp Expression" ----------------

  const COMPARE_OPS = ['>=', '<=', '=', '>', '<'];

  function parseStatement(line) {
    const tokens = tokenize(line);
    if (tokens.length < 3) throw new Error(`Malformed rule statement: ${line}`);
    const varName = tokens[0];
    const op = tokens[1];
    if (!COMPARE_OPS.includes(op)) {
      throw new Error(`Expected comparison operator after "${varName}" in: ${line}`);
    }
    const code = Buildings.codeForAlias(varName);
    if (!code) throw new Error(`Unknown building variable: ${varName}`);
    const parser = makeExprParser(tokens.slice(2));
    const expr = parser.parseExpression();
    if (parser.rest().length) throw new Error(`Unexpected trailing tokens in: ${line}`);
    return { code, name: varName, op, expr, raw: line.trim() };
  }

  function satisfies(currentLevel, op, targetValue) {
    switch (op) {
      case '=': return currentLevel >= targetValue;
      case '>=': return currentLevel >= targetValue;
      case '<=': return currentLevel <= targetValue;
      case '>': return currentLevel > targetValue;
      case '<': return currentLevel < targetValue;
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  function targetLevelFor(op, exprValue) {
    // Buildings only ever go up, so for "less than" style operators there's
    // nothing constructive to build toward - treat as already satisfied by caller.
    return Math.ceil(exprValue);
  }

  // ---- DSL text -> rule spec ------------------------------------------------

  function stripBullet(line) {
    return line.replace(/^\s*-\s*/, '').trim();
  }

  function parseRuleText(text) {
    const lines = text.split('\n');
    const sections = { repeat: [], until: [], then: [] };
    let current = null;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const headerMatch = /^(repeat|until|then)\s*:\s*$/i.exec(line);
      if (headerMatch) {
        current = headerMatch[1].toLowerCase();
        continue;
      }
      // allow "until: Metal = 22" on one line
      const inlineMatch = /^(repeat|until|then)\s*:\s*(.+)$/i.exec(line);
      if (inlineMatch) {
        current = inlineMatch[1].toLowerCase();
        sections[current].push(stripBullet(inlineMatch[2]));
        continue;
      }
      if (!current) throw new Error(`Rule line outside of a section: ${line}`);
      sections[current].push(stripBullet(line));
    }

    const repeat = sections.repeat.map(parseStatement);
    const until = sections.until.length ? parseStatement(sections.until[0]) : null;
    const then = sections.then.map(parseStatement);

    return { repeat, until, then };
  }

  // ---- Resolver -------------------------------------------------------------

  function resolveStatement(stmt, levels) {
    const targetValue = evalNode(stmt.expr, levels);
    const currentLevel = levels[stmt.code] || 0;
    const target = targetLevelFor(stmt.op, targetValue);
    const done = satisfies(currentLevel, stmt.op, targetValue);
    return { done, target, code: stmt.code };
  }

  function resolveRule(ruleSpec, currentLevels) {
    const untilDone = ruleSpec.until ? resolveStatement(ruleSpec.until, currentLevels).done : false;

    if (!untilDone) {
      for (const stmt of ruleSpec.repeat) {
        const r = resolveStatement(stmt, currentLevels);
        if (!r.done) {
          const b = Buildings.byCode(r.code);
          return { code: b.code, id: b.id, name: b.name, level: r.target };
        }
      }
      return null; // stuck: repeat cycle satisfied but `until` not yet met
    }

    for (const stmt of ruleSpec.then) {
      const r = resolveStatement(stmt, currentLevels);
      if (!r.done) {
        const b = Buildings.byCode(r.code);
        return { code: b.code, id: b.id, name: b.name, level: r.target };
      }
    }
    return null; // fully complete
  }

  return { parseRuleText, resolveRule, tokenize, parseStatement };
});

// ---- templates.js ------------------------------------------------
/*
 * Templates: named, reusable queues (list or rule mode) that can be applied
 * to any planet in one click. Thin layer over Storage's template CRUD.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildorder') : root.OQueue.BuildOrder
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Templates = factory(root.OQueue.BuildOrder);
  }
})(typeof self !== 'undefined' ? self : this, function (BuildOrder) {
  'use strict';

  function applyTemplate(store, planetId, templateName) {
    const templates = store.getTemplates();
    const template = templates[templateName];
    if (!template) throw new Error(`Unknown template: ${templateName}`);

    return store.updatePlanetState(planetId, {
      mode: template.mode,
      list: template.mode === 'list' ? template.list.slice() : [],
      rule: template.mode === 'rule' ? template.rule : null,
      done: [],
    });
  }

  function saveCurrentAsTemplate(store, planetId, templateName) {
    const state = store.getPlanetState(planetId);
    const template =
      state.mode === 'list'
        ? { mode: 'list', list: state.list.slice() }
        : { mode: 'rule', rule: state.rule };
    return store.saveTemplate(templateName, template);
  }

  // Same idea as applyTemplate/saveCurrentAsTemplate above, but for the
  // account-wide research queue instead of a per-planet building queue -
  // there's only ever one research queue, so "apply" replaces it outright
  // rather than targeting a chosen planet.
  function applyTemplateToAccount(store, templateName) {
    const templates = store.getTemplates();
    const template = templates[templateName];
    if (!template) throw new Error(`Unknown template: ${templateName}`);

    return store.updateAccountState({
      mode: template.mode,
      list: template.mode === 'list' ? template.list.slice() : [],
      rule: template.mode === 'rule' ? template.rule : null,
      done: [],
    });
  }

  function saveAccountStateAsTemplate(store, templateName) {
    const state = store.getAccountState();
    const template =
      state.mode === 'list'
        ? { mode: 'list', list: state.list.slice() }
        : { mode: 'rule', rule: state.rule };
    return store.saveTemplate(templateName, template);
  }

  // Same idea again, for a planet's lifeform-building queue - a separate
  // per-planet store from the regular building queue (see storage.js's
  // oqueue:lifeform: prefix), so it needs its own apply/save pair even
  // though the shape is identical to applyTemplate/saveCurrentAsTemplate.
  function applyTemplateToLifeform(store, planetId, templateName) {
    const templates = store.getTemplates();
    const template = templates[templateName];
    if (!template) throw new Error(`Unknown template: ${templateName}`);

    return store.updateLifeformState(planetId, {
      mode: template.mode,
      list: template.mode === 'list' ? template.list.slice() : [],
      rule: template.mode === 'rule' ? template.rule : null,
      done: [],
    });
  }

  function saveLifeformStateAsTemplate(store, planetId, templateName) {
    const state = store.getLifeformState(planetId);
    const template =
      state.mode === 'list'
        ? { mode: 'list', list: state.list.slice() }
        : { mode: 'rule', rule: state.rule };
    return store.saveTemplate(templateName, template);
  }

  // Concrete, hand-verified queue snapshots the user actually ran on their
  // s276-en account (captured 2026-08-05, before that server's local
  // templates went stale from a fresh-account restart - see oqueue-roadmap
  // memory). Unlike BuildOrder.PRESETS these aren't formula-generated, so
  // they're baked in here as literal data rather than computed.
  const CURATED_TEMPLATES = {
    'Homeworld Growth': {
      mode: 'list',
      list: [
        { code: 'S', id: 4, name: 'Solar Plant', level: 1 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 3 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 4 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 5 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 5 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 4 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 6 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 7 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 8 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 8 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 7 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 9 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 3 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 2 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 2 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 10 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 11 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 12 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 12 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 10 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 13 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 6 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 4 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 14 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 15 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 16 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 16 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 17 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 14 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 5 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 5 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 3 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 4 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 9 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 4 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 18 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 19 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 20 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 20 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 18 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 6 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 12 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 6 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 8 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 8 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 6 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 24 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 22 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 8 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 1 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 15 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 6 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 8 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 28 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 25 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 10 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 2 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 18 },
        { code: 'T', id: 33, name: 'Terraformer', level: 1 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 12 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 12 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 9 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 32 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 29 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 8 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 10 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 21 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 3 },
        { code: 'T', id: 33, name: 'Terraformer', level: 3 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 35 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 32 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 24 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 9 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 12 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 4 },
        { code: 'T', id: 33, name: 'Terraformer', level: 5 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 15 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 15 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 12 },
      ],
    },
    'Core Research': {
      mode: 'list',
      list: [
        { code: 'EN', id: 113, name: 'Energy Technology', level: 1 },
        { code: 'CD', id: 115, name: 'Combustion Drive', level: 1 },
        { code: 'CD', id: 115, name: 'Combustion Drive', level: 2 },
        { code: 'EP', id: 106, name: 'Espionage Technology', level: 1 },
        { code: 'EP', id: 106, name: 'Espionage Technology', level: 4 },
        { code: 'CT', id: 108, name: 'Computer Technology', level: 1 },
        { code: 'CT', id: 108, name: 'Computer Technology', level: 2 },
        { code: 'ID', id: 117, name: 'Impulse Drive', level: 1 },
        { code: 'ID', id: 117, name: 'Impulse Drive', level: 2 },
        { code: 'ID', id: 117, name: 'Impulse Drive', level: 3 },
        { code: 'AP', id: 124, name: 'Astrophysics', level: 1 },
        { code: 'AP', id: 124, name: 'Astrophysics', level: 3 },
        { code: 'AP', id: 124, name: 'Astrophysics', level: 4 },
        { code: 'CD', id: 115, name: 'Combustion Drive', level: 6 },
        { code: 'ST', id: 110, name: 'Shielding Technology', level: 2 },
        { code: 'ST', id: 110, name: 'Shielding Technology', level: 5 },
        { code: 'HT', id: 114, name: 'Hyperspace Technology', level: 3 },
        { code: 'HD', id: 118, name: 'Hyperspace Drive', level: 2 },
        { code: 'CT', id: 108, name: 'Computer Technology', level: 8 },
        { code: 'HT', id: 114, name: 'Hyperspace Technology', level: 8 },
        { code: 'IRN', id: 123, name: 'Intergalactic Research Network', level: 1 },
        { code: 'EN', id: 113, name: 'Energy Technology', level: 8 },
        { code: 'LT', id: 120, name: 'Laser Technology', level: 10 },
        { code: 'PT', id: 122, name: 'Plasma Technology', level: 1 },
      ],
    },
    "Rock'tal Growth": {
      mode: 'list',
      list: [
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 21 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 23 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 1 },
        { code: 'MEG', id: 12108, name: 'Megalith', level: 3 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 5 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 25 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 27 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 28 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 30 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 31 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 33 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 8 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 37 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 39 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 42 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 44 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 6 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 12 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 6 },
        { code: 'MF', id: 12106, name: 'Magma Forge', level: 20 },
        { code: 'CR', id: 12109, name: 'Crystal Refinery', level: 20 },
        { code: 'DSY', id: 12110, name: 'Deuterium Synthesiser', level: 20 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 8 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 15 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 50 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 52 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 10 },
        { code: 'MEG', id: 12108, name: 'Megalith', level: 8 },
        { code: 'MEG', id: 12108, name: 'Megalith', level: 10 },
        { code: 'ORI', id: 12105, name: 'Oriktorium', level: 3 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 10 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 12 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 15 },
        { code: 'ORI', id: 12105, name: 'Oriktorium', level: 5 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 20 },
        { code: 'MF', id: 12106, name: 'Magma Forge', level: 25 },
        { code: 'CR', id: 12109, name: 'Crystal Refinery', level: 25 },
        { code: 'DSY', id: 12110, name: 'Deuterium Synthesiser', level: 25 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 20 },
      ],
    },
  };

  // name -> template shape, for every built-in default regardless of which
  // of the two sources above it came from. Shared by seedDefaultTemplates
  // (only fills in what's missing) and resetDefaultTemplates (forces every
  // default back to this content) so the two can't drift out of sync.
  function defaultTemplateEntries() {
    const entries = {};
    for (const name in BuildOrder.PRESETS) entries[name] = { mode: 'list', list: BuildOrder.PRESETS[name] };
    for (const name in CURATED_TEMPLATES) entries[name] = CURATED_TEMPLATES[name];
    return entries;
  }

  // First-run bootstrap: backfills any curated default (BuildOrder.PRESETS
  // plus the hand-verified CURATED_TEMPLATES above) that's missing by name,
  // without touching one that already exists. Deliberately per-name rather
  // than "only if the store is totally empty" - the old all-or-nothing check
  // meant a store that had already auto-seeded Balanced Economy/Rusher once
  // would never pick up newly-added curated templates like these on a later
  // script update. Never overwrites an existing template under the same
  // name (including one the user edited or deliberately deleted - deletion
  // isn't distinguishable from "never existed" here, which matches the old
  // behavior's intent of not fighting the user's own edits).
  function seedDefaultTemplates(store) {
    const existing = store.getTemplates();
    const defaults = defaultTemplateEntries();
    for (const name in defaults) {
      if (!existing[name]) store.saveTemplate(name, defaults[name]);
    }
  }

  // The opposite of seedDefaultTemplates' caution: unconditionally overwrites
  // every built-in template with its shipped content, for when a script
  // update changes a default (like New Colony growing from 22 to 69 steps)
  // and a locally-saved copy from before that update needs to actually pick
  // it up. Names that aren't a built-in default (the user's own saved
  // templates) are left untouched. Returns the list of names reset, so
  // callers can report how many changed.
  function resetDefaultTemplates(store) {
    const defaults = defaultTemplateEntries();
    const names = Object.keys(defaults);
    for (const name of names) store.saveTemplate(name, defaults[name]);
    return names;
  }

  return {
    applyTemplate,
    saveCurrentAsTemplate,
    applyTemplateToAccount,
    saveAccountStateAsTemplate,
    applyTemplateToLifeform,
    saveLifeformStateAsTemplate,
    seedDefaultTemplates,
    resetDefaultTemplates,
    CURATED_TEMPLATES,
  };
});

// ---- panel.js ----------------------------------------------------
/*
 * Floating panel UI. Renders into a Shadow DOM host so OGame's page styles
 * can't bleed in and vice versa. No framework - plain DOM + template strings.
 *
 * Usage:
 *   const panel = OQueue.Panel.createPanel(document);
 *   panel.mount(document.body);
 *   panel.render(viewModel);
 *
 * viewModel shape:
 *   {
 *     title: string,            // header text, e.g. "Colony Queue - <planet>" or "Research Queue"
 *     mode: 'list' | 'rule',
 *     doneItems: [{ label }],
 *     current: { label } | null,
 *     upcoming: [{ label }],
 *     editText: string,        // current raw text for the Edit textarea
 *     templates: string[],     // known template names
 *     toast: string | null,    // transient message, e.g. "Metal Mine complete"
 *   }
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Panel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STYLES = `
    :host { all: initial; }
    .panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 240px;
      background: #1b1f24;
      color: #e6e6e6;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border: 1px solid #3a4048;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      z-index: 999999;
      user-select: none;
    }
    .header {
      padding: 6px 10px;
      background: #262b31;
      border-bottom: 1px solid #3a4048;
      border-radius: 6px 6px 0 0;
      font-weight: 600;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .body { padding: 8px 10px; max-height: 320px; overflow-y: auto; }
    .done { color: #6fbf73; margin: 2px 0; }
    .more-done { color: #6a7078; font-style: italic; margin: 2px 0 4px; }
    .current { color: #ffd479; margin: 6px 0; font-weight: 600; }
    .upcoming-label { margin-top: 8px; color: #9aa4af; font-weight: 600; }
    .upcoming { margin: 2px 0; color: #cfd6dc; }
    .toast {
      margin-top: 6px;
      padding: 4px 6px;
      background: #2f3a2f;
      border: 1px solid #4a6a4a;
      border-radius: 4px;
      color: #bfe6bf;
    }
    .actions { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid #3a4048; flex-wrap: wrap; }
    button {
      flex: 1 1 auto;
      background: #323a42;
      color: #e6e6e6;
      border: 1px solid #454e57;
      border-radius: 4px;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 11px;
    }
    button:hover { background: #3d4650; }
    textarea {
      width: 100%;
      box-sizing: border-box;
      background: #12151a;
      color: #e6e6e6;
      border: 1px solid #3a4048;
      border-radius: 4px;
      font: 11px/1.3 monospace;
      min-height: 100px;
    }
    select { width: 100%; margin-bottom: 6px; }
    .close { cursor: pointer; opacity: 0.7; }
    .close:hover { opacity: 1; }
    .hidden { display: none; }
  `;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function createPanel(doc) {
    doc = doc || document;
    const host = doc.createElement('div');
    host.id = 'oqueue-panel-host';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = doc.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const listeners = {};
    function emit(name, payload) {
      (listeners[name] || []).forEach((fn) => fn(payload));
    }
    function on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    }

    const root = el('div', { class: 'panel' });
    shadow.appendChild(root);

    let editMode = false;
    let lastViewModel = null;
    let lastRenderKey = null;

    function makeDragHandlers(headerEl, panelEl) {
      let dragging = false;
      let offsetX = 0;
      let offsetY = 0;
      headerEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('close')) return;
        dragging = true;
        const rect = panelEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      });
      doc.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        panelEl.style.left = `${e.clientX - offsetX}px`;
        panelEl.style.top = `${e.clientY - offsetY}px`;
        panelEl.style.right = 'auto';
      });
      doc.addEventListener('mouseup', () => { dragging = false; });
    }

    function renderChrome(vm, body) {
      // Preserve scroll position across a rebuild - the body is torn down
      // and recreated below, which would otherwise snap an in-progress
      // scroll back to the top every time.
      const prevBody = root.querySelector('.body');
      const scrollTop = prevBody ? prevBody.scrollTop : 0;

      root.innerHTML = '';
      const header = el('div', { class: 'header' }, [
        el('span', { text: vm.title || 'Colony Queue' }),
        el('span', { class: 'close', text: '✕' }),
      ]);
      header.lastChild.addEventListener('click', () => emit('close'));
      root.appendChild(header);
      makeDragHandlers(header, root);
      root.appendChild(body);
      body.scrollTop = scrollTop;
    }

    // Builds the edit view once, on entry - never rebuilt by a background
    // render() call, so a poll tick mid-typing/pasting can't wipe it out.
    function renderEditMode(vm) {
      const body = el('div', { class: 'body' });
      const textarea = el('textarea');
      textarea.value = vm.editText || '';
      body.appendChild(textarea);
      const saveRow = el('div', { class: 'actions' }, [
        el('button', { text: 'Save' }),
        el('button', { text: 'Cancel' }),
      ]);
      saveRow.children[0].addEventListener('click', () => {
        editMode = false;
        lastRenderKey = null;
        emit('importSave', textarea.value);
      });
      saveRow.children[1].addEventListener('click', () => {
        editMode = false;
        lastRenderKey = null;
        render(lastViewModel);
      });
      body.appendChild(saveRow);
      renderChrome(vm, body);
    }

    function render(vm) {
      lastViewModel = vm;
      // Skip re-rendering while the user is actively editing - nothing in the
      // edit view depends on live data, and rebuilding it on every poll tick
      // would wipe out whatever they're mid-typing/pasting.
      if (editMode) return;

      // The construction-box MutationObserver fires on every countdown tick
      // (roughly once a second) even though the queue itself hasn't changed.
      // Rebuilding the whole panel on each of those calls would reset scroll
      // position and interrupt clicks/selection, so skip the rebuild when the
      // view model is identical to what's already on screen.
      const renderKey = JSON.stringify(vm);
      if (renderKey === lastRenderKey) return;
      lastRenderKey = renderKey;

      const body = el('div', { class: 'body' });

      // Fleet/Highscore pages aren't queue pages - no done/current/upcoming
      // list, no templates, no Edit/Save buttons. Just an advisory line (or
      // status message) and whatever toast is pending.
      if (vm.showQueue === false) {
        if (vm.expeditionAdvisory) {
          const a = vm.expeditionAdvisory;
          const slotWord = a.freeSlots === 1 ? 'slot' : 'slots';
          if (a.ready) {
            body.appendChild(
              el('div', { class: 'current', text: `🚀 Launch expedition (${a.freeSlots}/${a.maxSlots} ${slotWord} free)` })
            );
            if (a.suggestion) {
              body.appendChild(el('div', { class: 'upcoming', text: a.suggestion }));
            }
          } else {
            body.appendChild(
              el('div', { class: 'upcoming-label', text: `${a.freeSlots}/${a.maxSlots} ${slotWord} free` })
            );
            body.appendChild(el('div', { class: 'upcoming', text: `Still need: ${a.missing.join(', ')}` }));
          }
        } else if (vm.statusMessage) {
          body.appendChild(el('div', { class: 'upcoming', text: vm.statusMessage }));
        }
        if (vm.toast) {
          body.appendChild(el('div', { class: 'toast', text: vm.toast }));
        }
        renderChrome(vm, body);
        return;
      }

      if (vm.moreDoneCount) {
        body.appendChild(el('div', { class: 'more-done', text: `+${vm.moreDoneCount} earlier` }));
      }
      (vm.doneItems || []).forEach((item) => {
        body.appendChild(el('div', { class: 'done', text: `✓ ${item.label}` }));
      });

      if (vm.current) {
        body.appendChild(el('div', { class: 'current', text: `➡ ${vm.current.label}` }));
      } else {
        body.appendChild(el('div', { class: 'current', text: 'Queue complete' }));
      }

      if ((vm.upcoming || []).length) {
        body.appendChild(el('div', { class: 'upcoming-label', text: 'Next' }));
        vm.upcoming.forEach((item) => {
          body.appendChild(el('div', { class: 'upcoming', text: item.label }));
        });
      }

      if (vm.toast) {
        body.appendChild(el('div', { class: 'toast', text: vm.toast }));
      }

      if ((vm.templates || []).length) {
        const select = el('select');
        select.appendChild(el('option', { value: '', text: 'Apply template...' }));
        vm.templates.forEach((name) => select.appendChild(el('option', { value: name, text: name })));
        select.addEventListener('change', () => {
          if (select.value) emit('applyTemplate', select.value);
          select.value = '';
        });
        // Resets any built-in template (Balanced Economy, New Colony, etc.)
        // back to its shipped content, overwriting a locally-saved copy that
        // predates a script update - the only way to pick up a changed
        // default otherwise is to know its new content and re-save it by
        // hand. No-op for templates you made up yourself (not a default).
        const resetBtn = el('button', { text: '↻ Reset built-ins', title: 'Reset built-in templates to their shipped defaults' });
        resetBtn.addEventListener('click', () => emit('resetTemplates'));
        body.appendChild(el('div', { class: 'actions' }, [select, resetBtn]));
      }

      const actions = el('div', { class: 'actions' }, [
        el('button', { text: 'Edit' }),
        el('button', { text: 'Save as Template' }),
      ]);
      actions.children[0].addEventListener('click', () => {
        editMode = true;
        renderEditMode(vm);
      });
      actions.children[1].addEventListener('click', () => {
        const name = prompt('Template name?');
        if (name) emit('saveTemplate', name);
      });
      body.appendChild(actions);

      renderChrome(vm, body);
    }

    return {
      host,
      // Removes any stray '#oqueue-panel-host' left behind by another script
      // instance before mounting this one - guards against exactly the
      // failure mode seen when two Tampermonkey copies of OQueue end up
      // installed at once (e.g. a @namespace change on update) and both
      // inject a panel into the same page, stacking two independent
      // instances (one stale/broken) on top of each other.
      mount(parent) {
        parent = parent || doc.body;
        const stray = parent.querySelector(`#${host.id}`);
        if (stray && stray !== host) stray.remove();
        parent.appendChild(host);
      },
      unmount() { if (host.parentNode) host.parentNode.removeChild(host); },
      render,
      on,
    };
  }

  return { createPanel };
});

// ---- dom.js ------------------------------------------------------
/*
 * DOM integration: reads building levels/planet info from the live OGame page
 * and watches for construction completion.
 *
 * CONFIRMED against a live OGame session (2026-08-03, server s276-en):
 *   - Building rows: `li.technology[data-technology="<id>"]`, level lives on
 *     the child `.level` element's `data-value` attribute (not page text).
 *     Lifeform building rows on the `lfbuildings` page use this exact same
 *     markup - no separate selectors needed.
 *   - Planet sidebar: `#planetList .smallplanet` (one div per planet, id
 *     `planet-<id>`), containing `a.planetlink` (gets `.active` on the
 *     current planet) and a `.planet-name` text node.
 *   - Construction widget: `#productionboxbuildingcomponent`, a
 *     `table.construction` that gains/loses the `active` class and whose
 *     `tbody` holds a row per queued item while building; countdown lives in
 *     a `<time class="countdown ...">` element inside it (confirmed via the
 *     equivalent `#productionboxshipyardcomponent` widget, same template).
 *
 * CONFIRMED (2026-08-05, server s276-en): the active lifeform species shows
 * up as `#lifeform .lifeform-item-icon`, which carries a `lifeformN` class
 * (N = 1 Humans, 2 Rock'tal, per LifeformBuildings.SPECIES_BY_INDEX) -
 * that's how activeLifeformSpecies() below tells planets on different
 * species apart without guessing from the page's building ids.
 *
 * CONFIRMED (2026-08-05, server s276-en) on the Fleet Dispatch page
 * (component=fleetdispatch): `#slots` holds two `.fleft` children whose text
 * reads "Fleets: X/Y" and "Expeditions: X/Y" - readExpeditionSlots() below
 * parses the second one. This is the signal behind the "launch expedition"
 * advisory (see expeditions.js) - reliable because it's the game's own slot
 * counter, not a guess at per-row mission-type markup.
 *
 * CONFIRMED (2026-08-05, server s276-en) on the Fleet Dispatch page's ship
 * selector: same `li.technology[data-technology]` markup as buildings, but
 * the count lives in a `.amount` child's text instead of a `.level`
 * element's `data-value` attribute - readShipCounts() below reads that.
 *
 * CONFIRMED (2026-08-05, server s276-en) on the Player highscore page
 * (page=highscore&category=1, the "Points" tab): `#ranks tbody tr` (rank 1
 * is the first row) has a `td.score` cell with the comma-formatted score -
 * readRank1Points() below parses that. Only meaningful on the Points tab
 * specifically (category=1) - other tabs (Economy/Research/Military/...)
 * reuse the same table markup with a different score, so callers must check
 * the URL's `category` param before trusting the result (see currentPage's
 * sibling currentHighscoreCategory() below).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings,
      typeof require !== 'undefined' ? require('./technologies') : root.OQueue.Technologies,
      typeof require !== 'undefined' ? require('./lifeformBuildings') : root.OQueue.LifeformBuildings,
      typeof require !== 'undefined' ? require('./ships') : root.OQueue.Ships
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Dom = factory(root.OQueue.Buildings, root.OQueue.Technologies, root.OQueue.LifeformBuildings, root.OQueue.Ships);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings, Technologies, LifeformBuildings, Ships) {
  'use strict';

  const SELECTORS = {
    buildingRow: (id) => `li.technology[data-technology="${id}"]`,
    buildingLevel: '.level',
    constructionBox: '#productionboxbuildingcomponent',
    constructionTable: 'table.construction',
    constructionCountdown: 'time.countdown',
    planetList: '#planetList',
    planetItem: '.smallplanet',
    planetLink: 'a.planetlink',
    planetName: '.planet-name',
    lifeformIndicator: '#lifeform .lifeform-item-icon',
    expeditionSlots: '#slots',
    highscoreTable: '#ranks',
    shipAmount: '.amount',
  };

  function currentPlanetId(loc) {
    loc = loc || (typeof location !== 'undefined' ? location : null);
    if (!loc) return null;
    const params = new URLSearchParams(loc.search);
    return params.get('cp');
  }

  function currentPage(loc) {
    loc = loc || (typeof location !== 'undefined' ? location : null);
    if (!loc) return null;
    const params = new URLSearchParams(loc.search);
    return params.get('component') || params.get('page');
  }

  // The highscore page reuses the same #ranks table markup across its
  // Points/Economy/Research/Military/... tabs, distinguished only by this
  // URL param - readRank1Points() is only meaningful when this is '1'.
  function currentHighscoreCategory(loc) {
    loc = loc || (typeof location !== 'undefined' ? location : null);
    if (!loc) return null;
    return new URLSearchParams(loc.search).get('category');
  }

  // Shared by readBuildingLevels/readTechLevels: walks a registry's {code:
  // {id}} entries and reads whichever ones have a matching row on the
  // current page (buildings and technologies share the same row/level markup).
  function readLevelsFor(doc, registry) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return {};
    const levels = {};
    for (const code in registry) {
      const { id } = registry[code];
      const row = doc.querySelector(SELECTORS.buildingRow(id));
      if (!row) continue;
      const levelEl = row.querySelector(SELECTORS.buildingLevel);
      const value = levelEl ? levelEl.getAttribute('data-value') : null;
      if (value != null) levels[code] = parseInt(value, 10);
    }
    return levels;
  }

  // doc: Document to read from. Returns { [buildingCode]: level }.
  function readBuildingLevels(doc) {
    return readLevelsFor(doc, Buildings.BUILDINGS);
  }

  // doc: Document to read from (the research page). Returns { [techCode]: level }.
  function readTechLevels(doc) {
    return readLevelsFor(doc, Technologies.TECHNOLOGIES);
  }

  // doc: Document to read from (the lfbuildings page). species: e.g. 'HUMANS'.
  // Returns { [lifeformBuildingCode]: level }.
  function readLifeformBuildingLevels(doc, species) {
    return readLevelsFor(doc, LifeformBuildings.SPECIES[species] || {});
  }

  // Reads the current planet's active lifeform species (e.g. 'HUMANS',
  // 'ROCKTAL') from the toolbar indicator. Returns null if the indicator
  // isn't present (not logged in, page not loaded yet) or its index isn't
  // one of the confirmed species in SPECIES_BY_INDEX - callers should fall
  // back to a sane default rather than throw.
  function activeLifeformSpecies(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    const el = doc.querySelector(SELECTORS.lifeformIndicator);
    if (!el) return null;
    const match = /\blifeform(\d+)\b/.exec(el.className);
    if (!match) return null;
    return LifeformBuildings.SPECIES_BY_INDEX[match[1]] || null;
  }

  // The `cp` URL param is only present when you've just switched planets -
  // for the common case of staying on one planet across page loads, the
  // active planet has to be read from the sidebar instead.
  function activePlanetId(doc) {
    const planets = readPlanetList(doc);
    const active = planets.find((p) => p.active);
    return active ? active.id : currentPlanetId();
  }

  function readPlanetList(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return [];
    const container = doc.querySelector(SELECTORS.planetList);
    if (!container) return [];
    return Array.from(container.querySelectorAll(SELECTORS.planetItem)).map((el) => {
      const link = el.querySelector(SELECTORS.planetLink);
      const nameEl = el.querySelector(SELECTORS.planetName);
      return {
        id: el.id.replace(/^planet-/, ''),
        name: nameEl ? nameEl.textContent.trim() : null,
        active: link ? link.classList.contains('active') : false,
      };
    });
  }

  // doc: Document to read from (the Fleet Dispatch page). Returns
  // { used, max } or null if the widget isn't present (wrong page).
  function readExpeditionSlots(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    const box = doc.querySelector(SELECTORS.expeditionSlots);
    if (!box) return null;
    const parts = Array.from(box.children);
    const expeditionPart = parts.find((p) => /expedition/i.test(p.textContent));
    if (!expeditionPart) return null;
    const match = /(\d+)\s*\/\s*(\d+)/.exec(expeditionPart.textContent);
    if (!match) return null;
    return { used: parseInt(match[1], 10), max: parseInt(match[2], 10) };
  }

  // doc: Document to read from (the highscore page, Points tab). Returns the
  // rank-1 player's score as a number, or null if not present/not parseable.
  // Caller is responsible for checking currentHighscoreCategory() === '1'
  // first - this function doesn't know which tab produced the markup.
  function readRank1Points(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    const table = doc.querySelector(SELECTORS.highscoreTable);
    if (!table) return null;
    const scoreCell = table.querySelector('tbody tr td.score');
    if (!scoreCell) return null;
    const value = parseInt(scoreCell.textContent.replace(/[^\d]/g, ''), 10);
    return isNaN(value) ? null : value;
  }

  // doc: Document to read from (the Fleet Dispatch page). Returns
  // { [shipCode]: count } for the departure planet - used to check whether
  // an expedition fleet (Pathfinder + cargo) actually exists before
  // suggesting you launch one (see expeditions.js#buildAdvisory).
  function readShipCounts(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return {};
    const counts = {};
    for (const code in Ships.SHIPS) {
      const { id } = Ships.SHIPS[code];
      const row = doc.querySelector(SELECTORS.buildingRow(id));
      if (!row) continue;
      const amountEl = row.querySelector(SELECTORS.shipAmount);
      if (!amountEl) continue;
      const value = parseInt(amountEl.textContent.replace(/[^\d]/g, ''), 10);
      if (!isNaN(value)) counts[code] = value;
    }
    return counts;
  }

  // Returns true while a building is actively under construction.
  function isBuildingActive(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return false;
    const box = doc.querySelector(SELECTORS.constructionBox);
    if (!box) return false;
    const table = box.querySelector(SELECTORS.constructionTable);
    return !!(table && table.classList.contains('active'));
  }

  // Fires callback() whenever the construction box's content changes -
  // used as the "build completed" signal (caller re-reads levels to confirm).
  function watchConstructionBox(doc, callback) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return { disconnect() {} };
    const target = doc.querySelector(SELECTORS.constructionBox);
    if (!target) return { disconnect() {} };
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  function highlightBuilding(doc, buildingId, className) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    doc.querySelectorAll(`.${className}`).forEach((el) => el.classList.remove(className));
    const row = doc.querySelector(SELECTORS.buildingRow(buildingId));
    if (row) row.classList.add(className);
  }

  return {
    SELECTORS,
    currentPlanetId,
    activePlanetId,
    currentPage,
    currentHighscoreCategory,
    readExpeditionSlots,
    readRank1Points,
    readShipCounts,
    readBuildingLevels,
    readTechLevels,
    readLifeformBuildingLevels,
    activeLifeformSpecies,
    readPlanetList,
    isBuildingActive,
    watchConstructionBox,
    highlightBuilding,
  };
});

// ---- notify.js ---------------------------------------------------
/*
 * Notifications on build completion: always shows the in-panel toast (handled
 * by the panel itself via viewModel.toast); optionally also fires a browser
 * Notification if permission has been granted.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Notify = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function requestPermission() {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission);
    }
    return Notification.requestPermission();
  }

  function notifyBuildComplete(completedLabel, nextLabel) {
    const title = `${completedLabel} complete`;
    const body = nextLabel ? `Next: ${nextLabel}` : 'Queue complete';
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return { title, body };
  }

  return { requestPermission, notifyBuildComplete };
});

// ---- cleanup.js --------------------------------------------------
/*
 * Cosmetic page cleanup: hides premium-upsell nav items and the ad banner,
 * and relocates the Merchant link out of that hidden group into the account
 * header bar. Mostly CSS injection - a single <style> tag added once to
 * <head>, not a DOM removal, so it can't break anything the game's own JS
 * expects to find - plus one small, guarded DOM insertion for Merchant.
 *
 * CONFIRMED (2026-08-05, server s276-en / s275-en):
 *   - Merchant/Recruit Officers/Shop/Rewards nav items: each is an
 *     `<a class="... premiumHighligt ...">` inside an `<li>` under
 *     #menuTable - hiding the `<li>` via :has() removes exactly those four,
 *     since no other nav item carries that class.
 *   - Ad banner: #bannerSkyscrapercomponent, a sibling of #planetbarcomponent
 *     inside #right.
 *   - Account header bar: `#headerBarLinks` holds one `<span>` per link
 *     (Profile, Highscore, Notes, Buddies, Search, Options, Support, Log
 *     out) with no separator markup between them (spacing/dividers are
 *     pure CSS) - so a plain `<span><a>...</a></span>` dropped in front of
 *     the Log out span matches the existing items with no extra styling.
 *     The user asked for Merchant specifically (not Recruit
 *     Officers/Shop/Rewards) moved there, since they still want to use it
 *     despite it being a premium-upsell-styled nav item.
 *
 * CORRECTED (2026-08-10, server s275-en, real page source): the Merchant
 * `<a class="menubutton premiumHighligt ...">` under #menuTable actually
 * has `href=".../index.php?page=ingame&component=trader"` - the original
 * selector below looked for `component=traderOverview` instead, which is
 * the CSS class (`menuImage traderOverview`) on a *different*, smaller
 * icon-link next to it, not a URL parameter that ever existed. That typo
 * meant relocateMerchantLink's querySelector always missed and silently
 * no-op'd (by design, for accounts where the item genuinely isn't there -
 * indistinguishable from "selector is just wrong" without live HTML,
 * which is what it took to catch this).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Cleanup = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STYLE_ID = 'oqueue-cleanup-style';
  const HEADER_MERCHANT_ID = 'oqueue-header-merchant';
  const CSS = [
    '#menuTable li:has(a.premiumHighligt) { display: none !important; }',
    '#bannerSkyscrapercomponent { display: none !important; }',
  ].join('\n');

  // Merchant's sidebar entry stays hidden by the CSS above along with the
  // other three premium items - this just gives it a second, visible way in
  // via the header bar rather than un-hiding the sidebar one in place.
  function relocateMerchantLink(doc) {
    if (doc.getElementById(HEADER_MERCHANT_ID)) return;
    const headerLinks = doc.getElementById('headerBarLinks');
    if (!headerLinks) return;
    const merchantLink = doc.querySelector('#menuTable a.premiumHighligt[href*="component=trader"]');
    if (!merchantLink) return;
    const logoutSpan = Array.from(headerLinks.children).find((span) => /log ?out/i.test(span.textContent));
    if (!logoutSpan) return;

    const span = doc.createElement('span');
    span.id = HEADER_MERCHANT_ID;
    const link = doc.createElement('a');
    link.href = merchantLink.href;
    link.textContent = 'Merchant';
    span.appendChild(link);

    headerLinks.insertBefore(span, logoutSpan);
  }

  // Idempotent - safe to call every time the app starts, only inserts once
  // per document (a fresh page load gets a fresh document anyway).
  function apply(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
    }
    relocateMerchantLink(doc);
  }

  return { apply, CSS, STYLE_ID, HEADER_MERCHANT_ID };
});

// ---- roi.js ------------------------------------------------------
/*
 * ROI math for the Supplies-page mine overlay: estimates hours-to-payback
 * for upgrading Metal Mine / Crystal Mine / Deuterium Synthesizer one level,
 * from cost and production formulas alone (no live-page reads required).
 *
 * NEEDS VERIFICATION, same category as formulas.js's energy numbers: the
 * base costs/factors and the mine production formula below are the
 * standard values widely published across community OGame calculators, not
 * yet checked against this account's own numbers. Confirm against a real
 * account (queue a mine level, compare the game's own displayed cost to
 * costForLevel() below) before trusting the badge at a glance.
 *
 * Deliberately simplified in two ways:
 *   - Only weighs the resource a mine actually produces against its own
 *     cost in that same resource (e.g. Crystal Mine's metal cost isn't
 *     factored in) - this is a "does the upgrade pay for itself in kind"
 *     number, not a full opportunity-cost model across all three resources.
 *   - Assumes economy speed 1x by default. Pass `options.speed` (your
 *     universe's economy speed multiplier) for an accurate number - on an
 *     8x uni, real payback is ~8x faster than the default assumes.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Roi = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // code -> base cost + per-level growth factor. Cost of level N (going
  // from N-1 to N) is base * factor^(N-1).
  const BUILDING_COSTS = {
    M: { metal: 60, crystal: 15, deuterium: 0, factor: 1.5 },
    C: { metal: 48, crystal: 24, deuterium: 0, factor: 1.6 },
    D: { metal: 225, crystal: 75, deuterium: 0, factor: 1.5 },
  };

  // code -> production/hr formula base. All three mines share the same
  // shape (base * level * 1.1^level); Deuterium Synthesizer also scales
  // with planet temperature.
  const PRODUCTION_BASE = { M: 30, C: 20, D: 10 };

  const RESOURCE_KEY = { M: 'metal', C: 'crystal', D: 'deuterium' };

  function costForLevel(code, level) {
    const spec = BUILDING_COSTS[code];
    if (!spec) return null;
    const factorPow = Math.pow(spec.factor, level - 1);
    return {
      metal: Math.round(spec.metal * factorPow),
      crystal: Math.round(spec.crystal * factorPow),
      deuterium: Math.round(spec.deuterium * factorPow),
    };
  }

  // options.speed: economy speed multiplier (default 1). options.temperature:
  // planet's average temperature in Celsius - only used for 'D', ignored
  // otherwise.
  function productionPerHour(code, level, options) {
    options = options || {};
    const base = PRODUCTION_BASE[code];
    if (base == null) return null;
    const speed = options.speed || 1;
    let value = base * level * Math.pow(1.1, level) * speed;
    if (code === 'D') {
      const temp = options.temperature;
      const tempFactor = temp != null ? Math.max(1.44 - 0.004 * temp, 0) : 1;
      value *= tempFactor;
    }
    return value;
  }

  // Hours to earn back the resource cost of going from currentLevel to
  // currentLevel + 1, purely from that mine's own production increase.
  // Returns null for anything that isn't a mine (Solar Plant, storages,
  // etc. don't have a resource-production payback in these terms) or where
  // the next level wouldn't actually increase production.
  function paybackHours(code, currentLevel, options) {
    if (!BUILDING_COSTS[code]) return null;
    const cost = costForLevel(code, currentLevel + 1);
    const before = productionPerHour(code, currentLevel, options);
    const after = productionPerHour(code, currentLevel + 1, options);
    const increase = after - before;
    if (!(increase > 0)) return null;
    const resourceCost = cost[RESOURCE_KEY[code]];
    return resourceCost / increase;
  }

  return { BUILDING_COSTS, costForLevel, productionPerHour, paybackHours };
});

// ---- roiOverlay.js -----------------------------------------------
/*
 * Injects a small "18h"-style payback badge onto each mine tile
 * (Metal/Crystal Mine, Deuterium Synthesizer) on the Supplies page - see
 * roi.js for the math. Writes directly into the game's own DOM (not the
 * shadow-DOM panel), since the badge has to sit inside OGame's own building
 * tiles rather than float separately.
 *
 * UNCONFIRMED like roi.js's formulas: badge placement assumes each
 * `li.technology` tile can take `position: relative` without breaking the
 * page's own layout - reasonable for a floated/absolute badge, but not yet
 * checked against a live Supplies page.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./roi') : root.OQueue.Roi,
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings,
      typeof require !== 'undefined' ? require('./dom') : root.OQueue.Dom
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.RoiOverlay = factory(root.OQueue.Roi, root.OQueue.Buildings, root.OQueue.Dom);
  }
})(typeof self !== 'undefined' ? self : this, function (Roi, Buildings, Dom) {
  'use strict';

  const BADGE_CLASS = 'oqueue-roi-badge';
  const STYLE_ID = 'oqueue-roi-style';
  const MINE_CODES = ['M', 'C', 'D'];

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BADGE_CLASS} {
        position: absolute;
        bottom: 2px;
        left: 2px;
        font: 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(20, 24, 28, 0.85);
        color: #ffd479;
        pointer-events: none;
        z-index: 5;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function formatHours(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
    if (hours < 48) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  }

  // doc: live document. levels: { M, C, D } current mine levels (e.g. from
  // Dom.readBuildingLevels). options: passed through to Roi.paybackHours -
  // { speed, temperature }.
  function render(doc, levels, options) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    levels = levels || {};
    ensureStyle(doc);

    MINE_CODES.forEach((code) => {
      const level = levels[code];
      const building = Buildings.byCode(code);
      const row = doc.querySelector(Dom.SELECTORS.buildingRow(building.id));
      if (!row) return;

      const hours = level == null ? null : Roi.paybackHours(code, level, options);
      let badge = row.querySelector(`.${BADGE_CLASS}`);

      if (hours == null) {
        if (badge) badge.remove();
        return;
      }

      if (!badge) {
        const view = doc.defaultView;
        const position = view ? view.getComputedStyle(row).position : row.style.position;
        if (!position || position === 'static') row.style.position = 'relative';
        badge = doc.createElement('span');
        badge.className = BADGE_CLASS;
        row.appendChild(badge);
      }
      badge.textContent = formatHours(hours);
      badge.title =
        "OQueue: estimated time for this mine's own production increase to earn back this upgrade's cost";
    });
  }

  function remove(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    doc.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
  }

  return { render, remove };
});

// ---- main.js -----------------------------------------------------
/*
 * Orchestrator: wires storage, rule/list resolution, the panel, DOM readers,
 * and notifications together. This is the only module that touches globals
 * like `document`/`location`/`setInterval` directly at the top level.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      root.OQueue || {
        Buildings: require('./buildings'),
        LifeformBuildings: require('./lifeformBuildings'),
        Storage: require('./storage'),
        Import: require('./import'),
        Rules: require('./rules'),
        Templates: require('./templates'),
        Panel: require('./panel'),
        Dom: require('./dom'),
        Cleanup: require('./cleanup'),
        Roi: require('./roi'),
        RoiOverlay: require('./roiOverlay'),
      }
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.App = factory(root.OQueue);
  }
})(typeof self !== 'undefined' ? self : this, function (OQueue) {
  'use strict';

  const POLL_INTERVAL_MS = 3000;
  const DONE_HISTORY_LIMIT = 5;
  // Fallback only - used when the live page's active-species indicator isn't
  // present/recognised yet (see dom.js#activeLifeformSpecies). Once a planet
  // is confirmed on a species, the real detection takes over.
  const DEFAULT_LIFEFORM_SPECIES = 'HUMANS';

  function labelFor(entry) {
    if (!entry) return null;
    const name = entry.name || (OQueue.Buildings.BUILDINGS[entry.code] || {}).name || entry.code;
    return `${name} ${entry.level}`;
  }

  // Resolves the next target for a planet's queue (list or rule mode) given
  // current levels, without mutating anything - pure derivation from stored state.
  function computeView(state, currentLevels) {
    const levels = Object.assign({}, state.cachedLevels, currentLevels);

    if (state.mode === 'rule' && state.rule) {
      const next = OQueue.Rules.resolveRule(state.rule, levels);
      return {
        current: next ? { label: labelFor(next) } : null,
        upcoming: [],
        doneItems: (state.done || []).map((label) => ({ label })),
      };
    }

    const list = state.list || [];
    const doneItems = [];
    let current = null;
    const upcoming = [];

    for (const item of list) {
      const have = levels[item.code] || 0;
      if (have >= item.level) {
        doneItems.push({ label: labelFor(item) });
      } else if (!current) {
        current = { label: labelFor(item) };
      } else {
        upcoming.push({ label: labelFor(item) });
      }
    }

    return { current, upcoming, doneItems };
  }

  // Keeps the panel's done-history short so the current/upcoming items stay
  // visible without scrolling once a queue has a long completed tail.
  function capDoneItems(doneItems, limit) {
    const moreDoneCount = Math.max(0, doneItems.length - limit);
    return { doneItems: doneItems.slice(-limit), moreDoneCount };
  }

  // Research is account-wide and lifeform buildings are a separate per-planet
  // queue from regular buildings, so the app needs to manage a different
  // "queue" depending on which page you're on. Pure/testable independent of
  // any real document - takes the page's `component` string.
  function resolveContext(pageComponent) {
    if (pageComponent === 'research') {
      return { scope: 'research' };
    }
    if (pageComponent === 'lfbuildings') {
      return { scope: 'lifeform' };
    }
    if (pageComponent === 'fleetdispatch') {
      return { scope: 'fleet' };
    }
    if (pageComponent === 'highscore') {
      return { scope: 'highscore' };
    }
    return { scope: 'planet' };
  }

  function createApp(opts) {
    opts = opts || {};
    const store = opts.store || OQueue.Storage.createStore();
    const doc = opts.document || (typeof document !== 'undefined' ? document : null);

    OQueue.Templates.seedDefaultTemplates(store);

    const context = resolveContext(OQueue.Dom.currentPage(doc.location));
    const isResearch = context.scope === 'research';
    const isLifeform = context.scope === 'lifeform';
    const isFleet = context.scope === 'fleet';
    const isHighscore = context.scope === 'highscore';
    const isPlanetQueue = context.scope === 'planet';
    const isSupplies = OQueue.Dom.currentPage(doc.location) === 'supplies';
    const planetId =
      isResearch || isFleet || isHighscore ? null : OQueue.Dom.activePlanetId(doc) || 'default';
    const title = isResearch
      ? 'Research Queue'
      : isLifeform
        ? `Lifeform Queue - ${planetId}`
        : isFleet
          ? 'Fleet - Expeditions'
          : isHighscore
            ? 'Highscore'
            : `Colony Queue - ${planetId}`;

    function getState() {
      if (isResearch) return store.getAccountState();
      if (isLifeform) return store.getLifeformState(planetId);
      return store.getPlanetState(planetId);
    }
    function setState(state) {
      if (isResearch) store.setAccountState(state);
      else if (isLifeform) store.setLifeformState(planetId, state);
      else store.setPlanetState(planetId, state);
    }
    function activeSpecies() {
      return OQueue.Dom.activeLifeformSpecies(doc) || DEFAULT_LIFEFORM_SPECIES;
    }
    function readLevels() {
      if (isResearch) return OQueue.Dom.readTechLevels(doc);
      if (isLifeform) return OQueue.Dom.readLifeformBuildingLevels(doc, activeSpecies());
      return OQueue.Dom.readBuildingLevels(doc);
    }

    const panel = OQueue.Panel.createPanel(doc);
    let toast = null;

    // Fleet Dispatch and Highscore aren't queue pages - Fleet shows the
    // expedition-slot advisory, Highscore silently caches rank-1 points
    // (see storage.js) for that advisory to use elsewhere. Neither has a
    // building/research/lifeform list to track, so they skip getState/
    // setState/computeView entirely.
    function refreshFleet() {
      const slots = OQueue.Dom.readExpeditionSlots(doc);
      let advisory = null;
      let statusMessage = null;
      if (!slots) {
        statusMessage = 'Could not read expedition slots on this page.';
      } else {
        const rank1 = store.getRank1Points();
        const shipCounts = OQueue.Dom.readShipCounts(doc);
        advisory = OQueue.Expeditions.buildAdvisory(slots, rank1 ? rank1.points : null, shipCounts);
        if (!advisory) statusMessage = `All expedition slots active (${slots.used}/${slots.max}) ✓`;
      }
      panel.render({ title, showQueue: false, expeditionAdvisory: advisory, statusMessage, toast });
      toast = null;
    }

    function refreshHighscore() {
      let statusMessage = 'Switch to the Points tab to cache rank-1 data for the expedition advisor.';
      if (OQueue.Dom.currentHighscoreCategory(doc.location) === '1') {
        const points = OQueue.Dom.readRank1Points(doc);
        if (points != null) {
          store.setRank1Points(points);
          statusMessage = `Rank-1 points cached: ${points.toLocaleString()}`;
        }
      }
      panel.render({ title, showQueue: false, statusMessage, toast });
      toast = null;
    }

    function refresh() {
      if (isFleet) return refreshFleet();
      if (isHighscore) return refreshHighscore();

      const state = getState();
      const domLevels = readLevels();
      if (Object.keys(domLevels).length) {
        state.cachedLevels = Object.assign({}, state.cachedLevels, domLevels);
        setState(state);
      }

      const view = computeView(state, domLevels);
      const templates =
        isPlanetQueue || isResearch || isLifeform ? Object.keys(store.getTemplates()) : [];
      const { doneItems, moreDoneCount } = capDoneItems(view.doneItems, DONE_HISTORY_LIMIT);

      panel.render({
        title,
        mode: state.mode,
        doneItems,
        moreDoneCount,
        current: view.current,
        upcoming: view.upcoming,
        editText: OQueue.Import.serializeList(state.list || []),
        templates,
        toast,
      });
      toast = null;

      if (view.current) {
        const entry = (state.list || []).find((i) => labelFor(i) === view.current.label);
        if (entry) OQueue.Dom.highlightBuilding(doc, entry.id, 'oqueue-highlight');
      }

      if (isSupplies) OQueue.RoiOverlay.render(doc, domLevels);
    }

    panel.on('importSave', (text) => {
      const species = isLifeform ? activeSpecies() : DEFAULT_LIFEFORM_SPECIES;
      const { list, errors } = OQueue.Import.parseImportText(text, species);
      setState(Object.assign({}, getState(), { mode: 'list', list, done: [] }));
      toast = errors.length ? `Import errors: ${errors.join('; ')}` : 'Imported';
      refresh();
    });

    // Templates work for the regular per-planet building queue, the
    // account-wide research queue, and a planet's lifeform-building queue -
    // one shared name -> template store, just applied differently depending
    // on scope.
    if (isPlanetQueue) {
      panel.on('applyTemplate', (name) => {
        OQueue.Templates.applyTemplate(store, planetId, name);
        toast = `Applied template "${name}"`;
        refresh();
      });

      panel.on('saveTemplate', (name) => {
        OQueue.Templates.saveCurrentAsTemplate(store, planetId, name);
        toast = `Saved template "${name}"`;
        refresh();
      });
    } else if (isResearch) {
      panel.on('applyTemplate', (name) => {
        OQueue.Templates.applyTemplateToAccount(store, name);
        toast = `Applied template "${name}"`;
        refresh();
      });

      panel.on('saveTemplate', (name) => {
        OQueue.Templates.saveAccountStateAsTemplate(store, name);
        toast = `Saved template "${name}"`;
        refresh();
      });
    } else if (isLifeform) {
      panel.on('applyTemplate', (name) => {
        OQueue.Templates.applyTemplateToLifeform(store, planetId, name);
        toast = `Applied template "${name}"`;
        refresh();
      });

      panel.on('saveTemplate', (name) => {
        OQueue.Templates.saveLifeformStateAsTemplate(store, planetId, name);
        toast = `Saved template "${name}"`;
        refresh();
      });
    }

    // The template store is shared across scopes, so one handler covers
    // planet/research/lifeform panels alike.
    if (isPlanetQueue || isResearch || isLifeform) {
      panel.on('resetTemplates', () => {
        const names = OQueue.Templates.resetDefaultTemplates(store);
        toast = `Reset ${names.length} built-in template${names.length === 1 ? '' : 's'} to default`;
        refresh();
      });
    }

    panel.on('close', () => panel.unmount());

    let pollTimer = null;
    function start() {
      OQueue.Cleanup.apply(doc);
      panel.mount(doc.body);
      refresh();
      OQueue.Dom.watchConstructionBox(doc, refresh);
      pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
    }
    function stop() {
      if (pollTimer) clearInterval(pollTimer);
      panel.unmount();
    }

    return { start, stop, refresh, panel };
  }

  return { createApp, computeView, labelFor, capDoneItems, resolveContext };
});

(function () {
  'use strict';
  function boot() {
    const app = OQueue.App.createApp();
    app.start();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
