const test = require('node:test');
const assert = require('node:assert/strict');
const Buildings = require('../src/buildings');

test('byCode resolves known shorthand', () => {
  const m = Buildings.byCode('m');
  assert.equal(m.id, 1);
  assert.equal(m.name, 'Metal Mine');
});

test('byCode throws on unknown shorthand', () => {
  assert.throws(() => Buildings.byCode('ZZ'));
});

test('byId resolves known id', () => {
  const b = Buildings.byId(2);
  assert.equal(b.code, 'C');
});

test('codeForAlias resolves friendly rule names', () => {
  assert.equal(Buildings.codeForAlias('Metal'), 'M');
  assert.equal(Buildings.codeForAlias('Shipyard'), 'SY');
  assert.equal(Buildings.codeForAlias('unknownthing'), null);
});
