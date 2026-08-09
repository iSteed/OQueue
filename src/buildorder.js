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
