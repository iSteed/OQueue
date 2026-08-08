const test = require('node:test');
const assert = require('node:assert/strict');
const Roi = require('../src/roi');

test('costForLevel returns Metal Mine base cost at level 1', () => {
  const cost = Roi.costForLevel('M', 1);
  assert.deepEqual(cost, { metal: 60, crystal: 15, deuterium: 0 });
});

test('costForLevel grows by the per-resource factor each level', () => {
  const level1 = Roi.costForLevel('C', 1);
  const level2 = Roi.costForLevel('C', 2);
  assert.equal(level2.metal, Math.round(level1.metal * 1.6));
  assert.equal(level2.crystal, Math.round(level1.crystal * 1.6));
});

test('costForLevel returns null for a non-mine code', () => {
  assert.equal(Roi.costForLevel('S', 1), null);
});

test('productionPerHour increases with level', () => {
  const low = Roi.productionPerHour('M', 5);
  const high = Roi.productionPerHour('M', 10);
  assert.ok(high > low);
});

test('productionPerHour scales linearly with speed', () => {
  const at1x = Roi.productionPerHour('M', 10, { speed: 1 });
  const at8x = Roi.productionPerHour('M', 10, { speed: 8 });
  assert.equal(at8x, at1x * 8);
});

test('productionPerHour for Deuterium Synthesizer drops on hot planets', () => {
  const cold = Roi.productionPerHour('D', 10, { temperature: 0 });
  const hot = Roi.productionPerHour('D', 10, { temperature: 300 });
  assert.ok(hot < cold);
});

test('paybackHours returns a positive number for a mine', () => {
  const hours = Roi.paybackHours('M', 10);
  assert.ok(hours > 0);
});

test('paybackHours drops as speed increases (same cost, faster production)', () => {
  const slow = Roi.paybackHours('M', 10, { speed: 1 });
  const fast = Roi.paybackHours('M', 10, { speed: 8 });
  assert.ok(fast < slow);
  assert.equal(fast, slow / 8);
});

test('paybackHours returns null for a non-mine code', () => {
  assert.equal(Roi.paybackHours('S', 10), null);
  assert.equal(Roi.paybackHours('MS', 5), null);
});
