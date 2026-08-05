// ==UserScript==
// @name         OQueue - OGame Build Queue
// @namespace    https://github.com/iSteed/OQueue
// @version      0.2.0
// @description  Floating build-queue panel for OGame: manual checklist, DOM auto-detection, multi-planet, import, templates, and a rule-based planner.
// @match        https://*.ogame.gameforge.com/game/*
// @grant        none
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
 * NEEDS VERIFICATION: these ids are from public OGame knowledge, not yet
 * confirmed against a live research page the way buildings.js's ids were
 * confirmed against supplies/facilities. Confirm the same way once possible:
 * read real `data-technology` attributes on the research page.
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
    EP: { id: 108, name: 'Espionage Technology' },
    CT: { id: 109, name: 'Computer Technology' },
    WT: { id: 110, name: 'Weapons Technology' },
    ST: { id: 111, name: 'Shielding Technology' },
    AT: { id: 112, name: 'Armour Technology' },
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

  const PRESETS = {
    'Balanced Economy': generateBuildOrder(BALANCED_ECONOMY),
    Rusher: generateBuildOrder(RUSHER),
  };

  return { generateBuildOrder, BALANCED_ECONOMY, RUSHER, PRESETS };
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

  function createStore(backend) {
    const be = backend || defaultBackend();

    function readJSON(key, fallback) {
      const raw = be.getItem(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }

    function writeJSON(key, value) {
      be.setItem(key, JSON.stringify(value));
    }

    function getPlanetState(planetId) {
      return readJSON(PLANET_PREFIX + planetId, defaultQueueState());
    }

    function setPlanetState(planetId, state) {
      writeJSON(PLANET_PREFIX + planetId, state);
    }

    function updatePlanetState(planetId, patch) {
      const current = getPlanetState(planetId);
      const next = Object.assign({}, current, patch);
      setPlanetState(planetId, next);
      return next;
    }

    function getLifeformState(planetId) {
      return readJSON(LIFEFORM_PREFIX + planetId, defaultQueueState());
    }

    function setLifeformState(planetId, state) {
      writeJSON(LIFEFORM_PREFIX + planetId, state);
    }

    function updateLifeformState(planetId, patch) {
      const current = getLifeformState(planetId);
      const next = Object.assign({}, current, patch);
      setLifeformState(planetId, next);
      return next;
    }

    function getAccountState() {
      return readJSON(ACCOUNT_KEY, defaultQueueState());
    }

    function setAccountState(state) {
      writeJSON(ACCOUNT_KEY, state);
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
      return readJSON(TEMPLATES_KEY, {});
    }

    function saveTemplate(name, template) {
      const templates = getTemplates();
      templates[name] = template;
      writeJSON(TEMPLATES_KEY, templates);
      return templates;
    }

    function deleteTemplate(name) {
      const templates = getTemplates();
      delete templates[name];
      writeJSON(TEMPLATES_KEY, templates);
      return templates;
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

  // First-run bootstrap only: if the store has zero templates, seed the
  // curated presets so a fresh install has something usable in the dropdown.
  // Never overwrites - if the user already has any templates (including
  // having deleted one), this does nothing.
  function seedDefaultTemplates(store) {
    if (Object.keys(store.getTemplates()).length > 0) return;
    for (const name in BuildOrder.PRESETS) {
      store.saveTemplate(name, { mode: 'list', list: BuildOrder.PRESETS[name] });
    }
  }

  return {
    applyTemplate,
    saveCurrentAsTemplate,
    applyTemplateToAccount,
    saveAccountStateAsTemplate,
    seedDefaultTemplates,
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
 *   panel.on('done', () => ...);
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
      root.innerHTML = '';
      const header = el('div', { class: 'header' }, [
        el('span', { text: vm.title || 'Colony Queue' }),
        el('span', { class: 'close', text: '✕' }),
      ]);
      header.lastChild.addEventListener('click', () => emit('close'));
      root.appendChild(header);
      makeDragHandlers(header, root);
      root.appendChild(body);
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
        emit('importSave', textarea.value);
      });
      saveRow.children[1].addEventListener('click', () => {
        editMode = false;
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

      const body = el('div', { class: 'body' });

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
        body.appendChild(el('div', { class: 'actions' }, [select]));
      }

      const actions = el('div', { class: 'actions' }, [
        el('button', { text: 'Done' }),
        el('button', { text: 'Edit' }),
        el('button', { text: 'Save as Template' }),
      ]);
      actions.children[0].addEventListener('click', () => emit('done'));
      actions.children[1].addEventListener('click', () => {
        editMode = true;
        renderEditMode(vm);
      });
      actions.children[2].addEventListener('click', () => {
        const name = prompt('Template name?');
        if (name) emit('saveTemplate', name);
      });
      body.appendChild(actions);

      renderChrome(vm, body);
    }

    return {
      host,
      mount(parent) { (parent || doc.body).appendChild(host); },
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
    root.OQueue.Dom = factory(root.OQueue.Buildings, root.OQueue.Technologies, root.OQueue.LifeformBuildings);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings, Technologies, LifeformBuildings) {
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
        Notify: require('./notify'),
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
    const isPlanetQueue = context.scope === 'planet';
    const planetId = isResearch ? null : OQueue.Dom.activePlanetId(doc) || 'default';
    const title = isResearch
      ? 'Research Queue'
      : isLifeform
        ? `Lifeform Queue - ${planetId}`
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

    function refresh() {
      const state = getState();
      const domLevels = readLevels();
      if (Object.keys(domLevels).length) {
        state.cachedLevels = Object.assign({}, state.cachedLevels, domLevels);
        setState(state);
      }

      const view = computeView(state, domLevels);
      const templates = isPlanetQueue || isResearch ? Object.keys(store.getTemplates()) : [];
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
    }

    panel.on('done', () => {
      const state = getState();
      const list = state.list || [];
      const idx = list.findIndex((item) => (state.cachedLevels[item.code] || 0) < item.level);
      if (idx >= 0) {
        const completed = list[idx];
        state.cachedLevels[completed.code] = completed.level;
        state.done = (state.done || []).concat(labelFor(completed));
        setState(state);
        const next = list[idx + 1];
        const { body } = OQueue.Notify.notifyBuildComplete(completed.name, next ? labelFor(next) : null);
        toast = body;
      }
      refresh();
    });

    panel.on('importSave', (text) => {
      const species = isLifeform ? activeSpecies() : DEFAULT_LIFEFORM_SPECIES;
      const { list, errors } = OQueue.Import.parseImportText(text, species);
      setState(Object.assign({}, getState(), { mode: 'list', list, done: [] }));
      toast = errors.length ? `Import errors: ${errors.join('; ')}` : 'Imported';
      refresh();
    });

    // Templates work for the regular per-planet building queue and the
    // account-wide research queue (one shared name -> template store, just
    // applied differently depending on scope). Not wired up for lifeform
    // buildings yet - separate per-planet queue, different registry.
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
    }

    panel.on('close', () => panel.unmount());

    let pollTimer = null;
    function start() {
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
