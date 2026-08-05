const test = require('node:test');
const assert = require('node:assert/strict');
const LifeformBuildings = require('../src/lifeformBuildings');

test('byCode resolves known Humans shorthand', () => {
  const rs = LifeformBuildings.byCode('HUMANS', 'rs');
  assert.equal(rs.id, 11101);
  assert.equal(rs.name, 'Residential Sector');
});

test('byCode throws on unknown shorthand', () => {
  assert.throws(() => LifeformBuildings.byCode('HUMANS', 'ZZ'));
});

test('byCode throws on unknown species', () => {
  assert.throws(() => LifeformBuildings.byCode('MECHA', 'RS'));
});

test('byId resolves known id', () => {
  const b = LifeformBuildings.byId('HUMANS', 11112);
  assert.equal(b.code, 'PS');
  assert.equal(b.name, 'Planetary Shield');
});

test('byCode resolves known Rock\'tal shorthand', () => {
  const me = LifeformBuildings.byCode('ROCKTAL', 'me');
  assert.equal(me.id, 12101);
  assert.equal(me.name, 'Meditation Enclave');
});

test('byId resolves known Rock\'tal id', () => {
  const b = LifeformBuildings.byId('ROCKTAL', 12108);
  assert.equal(b.code, 'MEG');
  assert.equal(b.name, 'Megalith');
});

test('SPECIES_BY_INDEX maps the active-species indicator to a species key', () => {
  assert.equal(LifeformBuildings.SPECIES_BY_INDEX[1], 'HUMANS');
  assert.equal(LifeformBuildings.SPECIES_BY_INDEX[2], 'ROCKTAL');
});

test('no lifeform code collides with a building, technology, or another species shorthand', () => {
  const Buildings = require('../src/buildings');
  const Technologies = require('../src/technologies');
  const used = new Set([...Object.keys(Buildings.BUILDINGS), ...Object.keys(Technologies.TECHNOLOGIES)]);
  for (const species in LifeformBuildings.SPECIES) {
    const collisions = Object.keys(LifeformBuildings.SPECIES[species]).filter((c) => used.has(c));
    assert.deepEqual(collisions, [], `${species} collides with: ${collisions.join(', ')}`);
    Object.keys(LifeformBuildings.SPECIES[species]).forEach((c) => used.add(c));
  }
});
