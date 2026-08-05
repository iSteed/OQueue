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
