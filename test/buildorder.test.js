const test = require('node:test');
const assert = require('node:assert/strict');
const Formulas = require('../src/formulas');
const { generateBuildOrder, PRESETS } = require('../src/buildorder');

// Replays a generated list, tracking running levels, and returns the energy
// balance after every step - used to assert no step ever leaves it negative.
function balancesAfterEachStep(list) {
  const levels = { M: 0, C: 0, D: 0, S: 0, F: 0 };
  return list.map((item) => {
    levels[item.code] = item.level;
    return Formulas.energyBalance(levels);
  });
}

test('generateBuildOrder inserts a Solar Plant step before an energy-negative target', () => {
  const list = generateBuildOrder([{ code: 'M', level: 10 }]);
  const codes = list.map((i) => i.code);
  assert.ok(codes.includes('S'), 'expected a Solar Plant step to be inserted');
  assert.equal(codes[codes.length - 1], 'M'); // the actual target still comes last
});

test('generateBuildOrder never leaves a negative energy balance after any step', () => {
  const list = generateBuildOrder([
    { code: 'M', level: 1 }, { code: 'C', level: 1 },
    { code: 'M', level: 5 }, { code: 'C', level: 5 },
    { code: 'M', level: 10 }, { code: 'C', level: 8 },
    { code: 'D', level: 3 },
  ]);
  const balances = balancesAfterEachStep(list);
  assert.ok(balances.every((b) => b >= -1e-9), `found a negative balance: ${JSON.stringify(balances)}`);
});

test('generateBuildOrder does not insert Solar Plant for buildings that draw no energy', () => {
  // Robotics Factory/Research Lab/Shipyard aren't energy consumers in the
  // model, so targeting them alone should never trigger a Solar Plant insert.
  const list = generateBuildOrder([{ code: 'R', level: 2 }, { code: 'RL', level: 1 }, { code: 'SY', level: 2 }]);
  assert.equal(list.filter((i) => i.code === 'S').length, 0);
});

test('generateBuildOrder respects startingLevels', () => {
  // Already has enough Solar Plant to cover Metal Mine 5 - shouldn't insert more.
  const list = generateBuildOrder([{ code: 'M', level: 5 }], { startingLevels: { S: 10 } });
  assert.equal(list.filter((i) => i.code === 'S').length, 0);
});

test('both curated presets are fully energy-safe at every step', () => {
  for (const name of Object.keys(PRESETS)) {
    const balances = balancesAfterEachStep(PRESETS[name]);
    assert.ok(balances.every((b) => b >= -1e-9), `preset "${name}" went energy-negative: ${JSON.stringify(balances)}`);
  }
});

test('presets include both a Balanced Economy and a Rusher option', () => {
  assert.ok(PRESETS['Balanced Economy']);
  assert.ok(PRESETS['Rusher']);
});
