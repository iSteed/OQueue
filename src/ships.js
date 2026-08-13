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
