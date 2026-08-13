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
