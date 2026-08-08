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
