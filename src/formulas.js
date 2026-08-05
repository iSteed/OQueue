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
