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

test('expoPointsFor: matches every value in BuildOrder.md\'s expedition points table', () => {
  assert.equal(Ships.expoPointsFor('PRB'), 5);
  assert.equal(Ships.expoPointsFor('sc'), 20);
  assert.equal(Ships.expoPointsFor('LF'), 20);
  assert.equal(Ships.expoPointsFor('HF'), 50);
  assert.equal(Ships.expoPointsFor('LC'), 60);
  assert.equal(Ships.expoPointsFor('CRU'), 135);
  assert.equal(Ships.expoPointsFor('BS'), 300);
  assert.equal(Ships.expoPointsFor('BC'), 350);
  assert.equal(Ships.expoPointsFor('BM'), 375);
  assert.equal(Ships.expoPointsFor('DES'), 550);
});

test('expoPointsFor: Deathstar/Colony Ship/Recycler contribute nothing, per the doc\'s explicit exclusion', () => {
  assert.equal(Ships.expoPointsFor('DTH'), 0);
  assert.equal(Ships.expoPointsFor('COL'), 0);
  assert.equal(Ships.expoPointsFor('RCY'), 0);
});

test('expoPointsFor: throws on unknown shorthand', () => {
  assert.throws(() => Ships.expoPointsFor('ZZ'));
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
