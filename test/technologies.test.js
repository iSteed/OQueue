const test = require('node:test');
const assert = require('node:assert/strict');
const Technologies = require('../src/technologies');

test('byCode resolves known shorthand', () => {
  const en = Technologies.byCode('en');
  assert.equal(en.id, 113);
  assert.equal(en.name, 'Energy Technology');
});

test('byCode throws on unknown shorthand', () => {
  assert.throws(() => Technologies.byCode('ZZ'));
});

test('byId resolves known id', () => {
  const t = Technologies.byId(115);
  assert.equal(t.code, 'CD');
  assert.equal(t.name, 'Combustion Drive');
});

test('no technology shorthand collides with a building shorthand', () => {
  const Buildings = require('../src/buildings');
  const buildingCodes = new Set(Object.keys(Buildings.BUILDINGS));
  const techCodes = Object.keys(Technologies.TECHNOLOGIES);
  const collisions = techCodes.filter((c) => buildingCodes.has(c));
  assert.deepEqual(collisions, []);
});
