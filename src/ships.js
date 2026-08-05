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

  return { SHIPS, byCode, byId };
});
