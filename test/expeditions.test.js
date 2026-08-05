const test = require('node:test');
const assert = require('node:assert/strict');
const { cargoTargetForRank1Points, hasExpeditionFleet, buildAdvisory } = require('../src/expeditions');

const READY_FLEET = { PF: 1, LC: 30 };

test('cargoTargetForRank1Points: picks the matching bracket below 5M', () => {
  assert.deepEqual(cargoTargetForRank1Points(50000), { pointTarget: 2500, cargo: '42 LC + 1 probe', approximate: false });
  assert.deepEqual(cargoTargetForRank1Points(500000), { pointTarget: 6000, cargo: '100 LC + 1 probe', approximate: false });
  assert.deepEqual(cargoTargetForRank1Points(4999999), { pointTarget: 9000, cargo: '150 LC + 1 probe', approximate: false });
});

test('cargoTargetForRank1Points: top bracket at/above 100M', () => {
  assert.deepEqual(cargoTargetForRank1Points(100000000), { pointTarget: 25000, cargo: '400 LC + 1 probe', approximate: false });
  assert.deepEqual(cargoTargetForRank1Points(500000000), { pointTarget: 25000, cargo: '400 LC + 1 probe', approximate: false });
});

test('cargoTargetForRank1Points: undocumented 5M-100M gap falls back to the 5M bracket, flagged approximate', () => {
  const result = cargoTargetForRank1Points(78973266);
  assert.deepEqual(result, { pointTarget: 9000, cargo: '150 LC + 1 probe', approximate: true });
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

test('buildAdvisory: ready with a suggestion when a fleet exists and points are known', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, 500000, READY_FLEET);
  assert.equal(advisory.freeSlots, 1);
  assert.equal(advisory.maxSlots, 1);
  assert.equal(advisory.ready, true);
  assert.match(advisory.suggestion, /100 LC \+ 1 probe/);
  assert.match(advisory.suggestion, /6,000 pts/);
});

test('buildAdvisory: ready but suggestion is null when rank-1 points are unknown', () => {
  const advisory = buildAdvisory({ used: 0, max: 1 }, null, READY_FLEET);
  assert.equal(advisory.ready, true);
  assert.equal(advisory.suggestion, null);
});
