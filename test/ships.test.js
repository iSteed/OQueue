const test = require('node:test');
const assert = require('node:assert/strict');
const Ships = require('../src/ships');

test('byCode resolves known shorthand', () => {
  const pf = Ships.byCode('pf');
  assert.equal(pf.id, 219);
  assert.equal(pf.name, 'Pathfinder');
});

test('byCode throws on unknown shorthand', () => {
  assert.throws(() => Ships.byCode('ZZ'));
});

test('byId resolves known id', () => {
  const s = Ships.byId(203);
  assert.equal(s.code, 'LC');
  assert.equal(s.name, 'Large Cargo');
});

test('no ship shorthand collides with a building, technology, or lifeform shorthand', () => {
  const Buildings = require('../src/buildings');
  const Technologies = require('../src/technologies');
  const LifeformBuildings = require('../src/lifeformBuildings');
  const used = new Set([
    ...Object.keys(Buildings.BUILDINGS),
    ...Object.keys(Technologies.TECHNOLOGIES),
    ...Object.keys(LifeformBuildings.SPECIES.HUMANS),
    ...Object.keys(LifeformBuildings.SPECIES.ROCKTAL),
  ]);
  const collisions = Object.keys(Ships.SHIPS).filter((c) => used.has(c));
  assert.deepEqual(collisions, []);
});
