/*
 * Expedition fleet-sizing advisor: given the rank-1 player's Points-category
 * score (the "general points" BuildOrder.md's expedition find formula scales
 * off), looks up the baseline cargo target from the doc's own table
 * (BuildOrder.md section 10, "Fleet composition").
 *
 * SOURCE (community-informed, ×1 eco/no bonuses baseline - BuildOrder.md
 * says to multiply by eco_speed x 1.5 x 2 for a Discoverer+Pathfinder setup,
 * which this module deliberately does NOT attempt since eco_speed isn't
 * tracked anywhere yet):
 *   < 100k      -> 2,500 pts  -> 42 LC + 1 probe
 *   < 1M        -> 6,000 pts  -> 100 LC + 1 probe
 *   < 5M        -> 9,000 pts  -> 150 LC + 1 probe
 *   >= 100M     -> 25,000 pts -> 400 LC + 1 probe
 *
 * NOTE: the source table has a real gap between 5M and 100M - not an
 * omission here, BuildOrder.md itself doesn't define that range. Points in
 * the gap fall back to the < 5M bracket, flagged `approximate: true` so
 * callers can say "floor, not a target" instead of presenting it as exact.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Expeditions = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CARGO_TABLE = [
    { maxPoints: 100000, pointTarget: 2500, cargo: '42 LC + 1 probe' },
    { maxPoints: 1000000, pointTarget: 6000, cargo: '100 LC + 1 probe' },
    { maxPoints: 5000000, pointTarget: 9000, cargo: '150 LC + 1 probe' },
  ];
  const TOP_BRACKET = { minPoints: 100000000, pointTarget: 25000, cargo: '400 LC + 1 probe' };

  // rank1Points: number | null (unknown). Returns null if unknown, otherwise
  // { pointTarget, cargo, approximate }.
  function cargoTargetForRank1Points(rank1Points) {
    if (rank1Points == null || isNaN(rank1Points)) return null;

    if (rank1Points >= TOP_BRACKET.minPoints) {
      return { pointTarget: TOP_BRACKET.pointTarget, cargo: TOP_BRACKET.cargo, approximate: false };
    }
    for (const bracket of CARGO_TABLE) {
      if (rank1Points < bracket.maxPoints) {
        return { pointTarget: bracket.pointTarget, cargo: bracket.cargo, approximate: false };
      }
    }
    // Falls in the undocumented 5M-100M gap - use the highest defined
    // bracket as a floor rather than inventing numbers.
    const last = CARGO_TABLE[CARGO_TABLE.length - 1];
    return { pointTarget: last.pointTarget, cargo: last.cargo, approximate: true };
  }

  // slots: { used, max } from Dom.readExpeditionSlots. Returns null if no
  // slot data (page not visited yet), otherwise an advisory object for the
  // panel: { freeSlots, maxSlots, suggestion } where suggestion is a label
  // string or null if rank-1 points haven't been captured yet.
  function buildAdvisory(slots, rank1Points) {
    if (!slots) return null;
    const freeSlots = Math.max(0, slots.max - slots.used);
    if (freeSlots <= 0) return null;

    const target = cargoTargetForRank1Points(rank1Points);
    const suggestion = target
      ? `~${target.cargo} (target ${target.pointTarget.toLocaleString()} pts${target.approximate ? ', approx.' : ''})`
      : null;

    return { freeSlots, maxSlots: slots.max, suggestion };
  }

  return { cargoTargetForRank1Points, buildAdvisory };
});
