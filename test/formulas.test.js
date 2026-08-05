const test = require('node:test');
const assert = require('node:assert/strict');
const Formulas = require('../src/formulas');

test('energyConsumptionMine matches hand-computed values', () => {
  assert.equal(Formulas.energyConsumptionMine(0), 0);
  // 10 * 10 * 1.1^10 = 100 * 2.59374246... = 259.374...
  assert.ok(Math.abs(Formulas.energyConsumptionMine(10) - 259.374) < 0.01);
});

test('energyProductionSolarPlant matches hand-computed values', () => {
  assert.equal(Formulas.energyProductionSolarPlant(0), 0);
  // 20 * 10 * 1.1^10 = 518.748...
  assert.ok(Math.abs(Formulas.energyProductionSolarPlant(10) - 518.748) < 0.01);
});

test('energyBalance sums production minus consumption across mines/solar', () => {
  const levels = { M: 5, C: 5, D: 0, S: 10, F: 0 };
  const expected =
    Formulas.energyProductionSolarPlant(10) -
    (Formulas.energyConsumptionMine(5) + Formulas.energyConsumptionMine(5));
  assert.ok(Math.abs(Formulas.energyBalance(levels) - expected) < 1e-9);
});

test('energyBalance treats missing levels as zero', () => {
  assert.equal(Formulas.energyBalance({}), 0);
  assert.equal(Formulas.energyBalance(), 0);
});

test('energyBalance goes negative once mines outpace solar', () => {
  // Metal Mine 10 alone draws ~259 energy; no Solar Plant to cover it.
  const levels = { M: 10, C: 0, D: 0, S: 0, F: 0 };
  assert.ok(Formulas.energyBalance(levels) < 0);
});
