const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRuleText, resolveRule } = require('../src/rules');

const RULE_TEXT = `
repeat:
  - Metal = Crystal + 2
  - Solar >= ceil((Metal + Crystal)/2)
until:
  Metal = 22
then:
  Robotics = 4
  Shipyard = 2
`;

test('parseRuleText parses repeat/until/then sections', () => {
  const spec = parseRuleText(RULE_TEXT);
  assert.equal(spec.repeat.length, 2);
  assert.equal(spec.repeat[0].code, 'M');
  assert.equal(spec.repeat[0].op, '=');
  assert.equal(spec.repeat[1].code, 'S');
  assert.equal(spec.repeat[1].op, '>=');
  assert.ok(spec.until);
  assert.equal(spec.until.code, 'M');
  assert.equal(spec.then.length, 2);
  assert.equal(spec.then[0].code, 'R');
  assert.equal(spec.then[1].code, 'SY');
});

test('resolveRule: from empty colony, Metal is first target', () => {
  const spec = parseRuleText(RULE_TEXT);
  const next = resolveRule(spec, {});
  assert.equal(next.code, 'M');
  assert.equal(next.level, 2); // Crystal(0) + 2
});

test('resolveRule: after Metal catches up, Solar becomes the target', () => {
  const spec = parseRuleText(RULE_TEXT);
  const next = resolveRule(spec, { M: 2, C: 0 });
  assert.equal(next.code, 'S');
  assert.equal(next.level, 1); // ceil((2+0)/2)
});

test('resolveRule: self-corrects if Crystal was built out of order', () => {
  const spec = parseRuleText(RULE_TEXT);
  // Crystal jumped ahead unexpectedly; Metal target recalculates relative to it,
  // rather than the plan becoming "off by one".
  const next = resolveRule(spec, { M: 0, C: 5 });
  assert.equal(next.code, 'M');
  assert.equal(next.level, 7); // Crystal(5) + 2
});

test('resolveRule: moves to `then` once `until` is satisfied', () => {
  const spec = parseRuleText(RULE_TEXT);
  const levels = { M: 22, C: 20, S: 21 }; // repeat constraints all hold, until (M=22) holds
  const next = resolveRule(spec, levels);
  assert.equal(next.code, 'R');
  assert.equal(next.level, 4);
});

test('resolveRule: works through `then` entries in order', () => {
  const spec = parseRuleText(RULE_TEXT);
  const levels = { M: 22, C: 20, S: 21, R: 4 };
  const next = resolveRule(spec, levels);
  assert.equal(next.code, 'SY');
  assert.equal(next.level, 2);
});

test('resolveRule: returns null when everything is complete', () => {
  const spec = parseRuleText(RULE_TEXT);
  const levels = { M: 22, C: 20, S: 21, R: 4, SY: 2 };
  assert.equal(resolveRule(spec, levels), null);
});

test('resolveRule: returns null (stuck) when repeat cycle is satisfied but until is not', () => {
  const spec = parseRuleText(`
repeat:
  Metal = Crystal
until:
  Metal = 100
then:
  Robotics = 1
`);
  // Metal already equals Crystal (both 0), so nothing in repeat asks to build
  // anything, yet Metal is nowhere near 100 - a genuinely stuck rule.
  assert.equal(resolveRule(spec, { M: 0, C: 0 }), null);
});

test('rule DSL rejects unknown variables', () => {
  assert.throws(() => parseRuleText('repeat:\n  Foo = 1\nuntil:\n  Foo = 2\nthen:\n'));
});
