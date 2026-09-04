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
  Formulas: require('../src/formulas'),
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

test('computeView: rule mode overrides to Solar Plant when the live energy deficit is excessive', () => {
  const state = {
    mode: 'rule',
    // Rule itself would ask for Metal next (Crystal already caught up) -
    // nothing in the rule/formula math knows about the unmodeled drain
    // (e.g. lifeform buildings) causing the live deficit below.
    rule: require('../src/rules').parseRuleText('repeat:\n  Metal = Crystal + 2\nuntil:\n  Metal = 999\nthen:\n'),
    cachedLevels: { M: 5, C: 3, S: 5 },
    done: [],
  };
  // Solar(5) produces ~163 (20*5*1.1^5) - a 500-deep deficit is way past the
  // 20% excessive-deficit threshold.
  const view = computeView(state, {}, -500);
  assert.equal(view.current.label, 'Solar Plant 6');
  assert.equal(view.energyOverride, true);
});

test('computeView: rule mode leaves a small/expected energy dip alone', () => {
  const state = {
    mode: 'rule',
    rule: require('../src/rules').parseRuleText('repeat:\n  Metal = Crystal + 2\nuntil:\n  Metal = 999\nthen:\n'),
    cachedLevels: { M: 3, C: 3, S: 5 }, // Metal not yet caught up to Crystal+2
    done: [],
  };
  // A small deficit (well under 20% of Solar(5)'s ~163 production) is the
  // rule's own expected margin, not something to override.
  const view = computeView(state, {}, -10);
  assert.equal(view.current.label, 'Metal Mine 5');
  assert.equal(view.energyOverride, false);
});

test('computeView: rule mode does not double-override when the rule already wants Solar', () => {
  const state = {
    mode: 'rule',
    rule: require('../src/rules').parseRuleText('repeat:\n  Solar = 10\nuntil:\n  Solar = 999\nthen:\n'),
    cachedLevels: { S: 5 },
    done: [],
  };
  const view = computeView(state, {}, -500);
  assert.equal(view.current.label, 'Solar Plant 10'); // the rule's own target, not level+1
  assert.equal(view.energyOverride, false);
});

test('computeView: a positive or unknown energy balance never triggers an override', () => {
  const state = {
    mode: 'rule',
    rule: require('../src/rules').parseRuleText('repeat:\n  Metal = 5\nuntil:\n  Metal = 999\nthen:\n'),
    cachedLevels: { M: 0 },
    done: [],
  };
  assert.equal(computeView(state, {}, 200).energyOverride, false);
  assert.equal(computeView(state, {}, null).energyOverride, false);
  assert.equal(computeView(state, {}).energyOverride, false); // energyBalance omitted entirely
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

test('resolveContext picks the lifeformResearch scope on the lfresearch page', () => {
  assert.equal(resolveContext('lfresearch').scope, 'lifeformResearch');
});

test('resolveContext picks the fleet scope on the fleet dispatch page', () => {
  assert.equal(resolveContext('fleetdispatch').scope, 'fleet');
});

test('resolveContext picks the highscore scope on the highscore page', () => {
  assert.equal(resolveContext('highscore').scope, 'highscore');
});

test('resolveContext picks the galaxy scope on the galaxy page', () => {
  assert.equal(resolveContext('galaxy').scope, 'galaxy');
});

test('resolveContext picks the planet scope everywhere else', () => {
  assert.equal(resolveContext('supplies').scope, 'planet');
  assert.equal(resolveContext('facilities').scope, 'planet');
  assert.equal(resolveContext(null).scope, 'planet');
  assert.equal(resolveContext(undefined).scope, 'planet');
});
