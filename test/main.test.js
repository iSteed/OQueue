const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// main.js expects a populated OQueue namespace (mirrors browser globals) when
// required directly under Node.
global.self = global.self || global;
global.self.OQueue = {
  Buildings: require('../src/buildings'),
  Storage: require('../src/storage'),
  Import: require('../src/import'),
  Rules: require('../src/rules'),
  Templates: require('../src/templates'),
};
const { computeView, capDoneItems, resolveContext } = require(path.join('..', 'src', 'main.js'));

test('computeView: marks items done when cached level meets/exceeds target', () => {
  const state = {
    mode: 'list',
    list: [
      { code: 'M', id: 1, name: 'Metal Mine', level: 4 },
      { code: 'C', id: 2, name: 'Crystal Mine', level: 3 },
      { code: 'M', id: 1, name: 'Metal Mine', level: 5 },
    ],
    cachedLevels: { M: 4, C: 3 },
    done: [],
  };
  const view = computeView(state, {});
  assert.equal(view.doneItems.length, 2);
  assert.equal(view.current.label, 'Metal Mine 5');
  assert.equal(view.upcoming.length, 0);
});

test('computeView: rule mode resolves current target via the rule engine', () => {
  const state = {
    mode: 'rule',
    rule: require('../src/rules').parseRuleText('repeat:\n  Metal = Crystal + 2\nuntil:\n  Metal = 22\nthen:\n  Robotics = 4'),
    cachedLevels: { M: 0, C: 0 },
    done: [],
  };
  const view = computeView(state, {});
  assert.equal(view.current.label, 'Metal Mine 2');
});

test('capDoneItems keeps only the most recent items and reports the hidden count', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((label) => ({ label }));
  const { doneItems, moreDoneCount } = capDoneItems(items, 5);
  assert.deepEqual(doneItems.map((i) => i.label), ['c', 'd', 'e', 'f', 'g']);
  assert.equal(moreDoneCount, 2);
});

test('capDoneItems reports zero hidden when under the limit', () => {
  const items = [{ label: 'a' }, { label: 'b' }];
  const { doneItems, moreDoneCount } = capDoneItems(items, 5);
  assert.equal(doneItems.length, 2);
  assert.equal(moreDoneCount, 0);
});

test('resolveContext picks the research scope on the research page', () => {
  assert.equal(resolveContext('research').scope, 'research');
});

test('resolveContext picks the lifeform scope on the lfbuildings page', () => {
  assert.equal(resolveContext('lfbuildings').scope, 'lifeform');
});

test('resolveContext picks the fleet scope on the fleet dispatch page', () => {
  assert.equal(resolveContext('fleetdispatch').scope, 'fleet');
});

test('resolveContext picks the highscore scope on the highscore page', () => {
  assert.equal(resolveContext('highscore').scope, 'highscore');
});

test('resolveContext picks the planet scope everywhere else', () => {
  assert.equal(resolveContext('supplies').scope, 'planet');
  assert.equal(resolveContext('facilities').scope, 'planet');
  assert.equal(resolveContext(null).scope, 'planet');
  assert.equal(resolveContext(undefined).scope, 'planet');
});
