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
