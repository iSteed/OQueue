const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cargoTargetForRank1Points,
  hasExpeditionFleet,
  suggestLoadout,
  formatLoadout,
  buildAdvisory,
  ASSUMED_MAX_RANK1_POINTS,
} = require('../src/expeditions');

const READY_FLEET = { PF: 1, PRB: 1, LC: 30 };

test('cargoTargetForRank1Points: picks the matching bracket below 5M', () => {
  assert.deepEqual(cargoTargetForRank1Points(50000), { pointTarget: 2500, approximate: false });
  assert.deepEqual(cargoTargetForRank1Points(500000), { pointTarget: 6000, approximate: false });
  assert.deepEqual(cargoTargetForRank1Points(4999999), { pointTarget: 9000, approximate: false });
});

test('cargoTargetForRank1Points: top bracket at/above 100M', () => {
  assert.deepEqual(cargoTargetForRank1Points(100000000), { pointTarget: 25000, approximate: false });
  assert.deepEqual(cargoTargetForRank1Points(500000000), { pointTarget: 25000, approximate: false });
});

test('cargoTargetForRank1Points: undocumented 5M-100M gap falls back to the 5M bracket, flagged approximate', () => {
  const result = cargoTargetForRank1Points(78973266);
  assert.deepEqual(result, { pointTarget: 9000, approximate: true });
});

test('cargoTargetForRank1Points: returns null for unknown input', () => {
  assert.equal(cargoTargetForRank1Points(null), null);
  assert.equal(cargoTargetForRank1Points(undefined), null);
  assert.equal(cargoTargetForRank1Points(NaN), null);
});

test('hasExpeditionFleet: true only when both a Pathfinder and a cargo ship are present', () => {
  assert.deepEqual(hasExpeditionFleet({ PF: 1, LC: 10 }), { pathfinder: true, cargo: true });
  assert.deepEqual(hasExpeditionFleet({ PF: 1, LC: 0, SC: 5 }), { pathfinder: true, cargo: true });
  assert.deepEqual(hasExpeditionFleet({ PF: 0, LC: 10 }), { pathfinder: false, cargo: true });
  assert.deepEqual(hasExpeditionFleet({ PF: 1 }), { pathfinder: true, cargo: false });
  assert.deepEqual(hasExpeditionFleet({}), { pathfinder: false, cargo: false });
  assert.deepEqual(hasExpeditionFleet(null), { pathfinder: false, cargo: false });
});

test('suggestLoadout: builds 1 Pathfinder + 1 Probe + enough Large Cargo to just clear the target', () => {
  const loadout = suggestLoadout({ PF: 5, PRB: 3, LC: 100 }, 2500);
  assert.deepEqual(loadout.plan, [
    { code: 'PRB', name: 'Espionage Probe', count: 1 },
    { code: 'PF', name: 'Pathfinder', count: 1 },
    { code: 'LC', name: 'Large Cargo', count: 40 }, // (2500 - 5 - 115) / 60 = 39.67 -> 40
  ]);
  assert.equal(loadout.pointsAchieved, 5 + 115 + 40 * 60);
  assert.equal(loadout.shortfall, 0);
});

test('suggestLoadout: caps at what is actually in the hangar and reports the shortfall', () => {
  // Only 20 LC available, nowhere near enough for a 2,500-pt target.
  const loadout = suggestLoadout({ PF: 1, PRB: 1, LC: 20 }, 2500);
  const lcEntry = loadout.plan.find((p) => p.code === 'LC');
  assert.equal(lcEntry.count, 20); // capped at what's on hand, not the 40 it would want
  assert.ok(loadout.shortfall > 0);
});

test('suggestLoadout: tops up with Small Cargo once Large Cargo runs out', () => {
  const loadout = suggestLoadout({ PF: 1, PRB: 1, LC: 5, SC: 150 }, 2500);
  const scEntry = loadout.plan.find((p) => p.code === 'SC');
  assert.ok(scEntry.count > 0);
  assert.equal(loadout.shortfall, 0);
});

test('suggestLoadout: skips ships entirely absent from the hangar', () => {
  const loadout = suggestLoadout({ LC: 50 }, 2500); // no Pathfinder, no Probe owned
  assert.equal(loadout.plan.find((p) => p.code === 'PF'), undefined);
  assert.equal(loadout.plan.find((p) => p.code === 'PRB'), undefined);
});

test('formatLoadout: renders a readable summary, flags a shortfall', () => {
  const met = suggestLoadout({ PF: 1, PRB: 1, LC: 100 }, 2500);
  assert.match(formatLoadout(met), /1 Espionage Probe \+ 1 Pathfinder \+ \d+ Large Cargo = [\d,]+\/2,500 pts$/);

  const short = suggestLoadout({ PF: 1, PRB: 1, LC: 5 }, 2500);
  assert.match(formatLoadout(short), /short [\d,]+ - build more cargo/);
});

test('buildAdvisory: null when no slot data', () => {
  assert.equal(buildAdvisory(null, 1000, READY_FLEET), null);
});

test('buildAdvisory: null when all slots are used', () => {
  assert.equal(buildAdvisory({ used: 3, max: 3 }, 1000, READY_FLEET), null);
});

test('buildAdvisory: not ready when no expedition fleet exists yet, even with a free slot', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, 500000, {});
  assert.equal(advisory.freeSlots, 1);
  assert.equal(advisory.ready, false);
  assert.equal(advisory.suggestion, null);
  assert.deepEqual(advisory.missing, ['a Pathfinder', 'cargo ships (Large/Small Cargo)']);
});

test('buildAdvisory: not ready lists only what is actually missing', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, 500000, { PF: 1 });
  assert.equal(advisory.ready, false);
  assert.deepEqual(advisory.missing, ['cargo ships (Large/Small Cargo)']);
});

test('buildAdvisory: ready with a real loadout built from the hangar when a fleet exists and points are known', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, 500000, READY_FLEET);
  assert.equal(advisory.freeSlots, 1);
  assert.equal(advisory.maxSlots, 1);
  assert.equal(advisory.ready, true);
  assert.match(advisory.suggestion, /Large Cargo/);
  assert.match(advisory.suggestion, /6,000 pts/);
});

test('buildAdvisory: flags a shortfall in the suggestion when the hangar can\'t reach the target', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, 500000, { PF: 1, PRB: 1, LC: 3 });
  assert.equal(advisory.ready, true);
  assert.match(advisory.suggestion, /short/);
});

test('ASSUMED_MAX_RANK1_POINTS: lands in the top bracket (25,000 pt target)', () => {
  assert.deepEqual(cargoTargetForRank1Points(ASSUMED_MAX_RANK1_POINTS), { pointTarget: 25000, approximate: false });
});

test('buildAdvisory: ready but suggestion is null when rank-1 points are unknown', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, null, READY_FLEET);
  assert.equal(advisory.ready, true);
  assert.equal(advisory.suggestion, null);
});
