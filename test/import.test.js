const test = require('node:test');
const assert = require('node:assert/strict');
const { parseImportText, serializeList } = require('../src/import');

test('parses shorthand import text', () => {
  const { list, errors } = parseImportText('M10\nC8\nS10\nR2\nSY1');
  assert.deepEqual(errors, []);
  assert.equal(list.length, 5);
  assert.deepEqual(list[0], { code: 'M', id: 1, name: 'Metal Mine', level: 10 });
  assert.deepEqual(list[3], { code: 'R', id: 14, name: 'Robotics Factory', level: 2 });
});

test('handles commas and extra whitespace', () => {
  const { list, errors } = parseImportText('  M10,  C8 ,\nS10  ');
  assert.deepEqual(errors, []);
  assert.equal(list.length, 3);
});

test('collects errors for unparseable tokens without throwing', () => {
  const { list, errors } = parseImportText('M10 ??? ZZ5');
  assert.equal(list.length, 1);
  assert.equal(errors.length, 2);
});

test('falls back to technology shorthand when not a building code', () => {
  const { list, errors } = parseImportText('EN8 CD5');
  assert.deepEqual(errors, []);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { code: 'EN', id: 113, name: 'Energy Technology', level: 8 });
  assert.deepEqual(list[1], { code: 'CD', id: 115, name: 'Combustion Drive', level: 5 });
});

test('falls back to Humans lifeform building shorthand when not a building or tech code', () => {
  const { list, errors } = parseImportText('RS10 MET5');
  assert.deepEqual(errors, []);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { code: 'RS', id: 11101, name: 'Residential Sector', level: 10 });
  assert.deepEqual(list[1], { code: 'MET', id: 11111, name: 'Metropolis', level: 5 });
});

test('resolves lifeform shorthand against the given species instead of the Humans default', () => {
  const { list, errors } = parseImportText('ME21 CF23', 'ROCKTAL');
  assert.deepEqual(errors, []);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 21 });
  assert.deepEqual(list[1], { code: 'CF', id: 12102, name: 'Crystal Farm', level: 23 });
});

test('mixes building and technology shorthand in one import', () => {
  const { list, errors } = parseImportText('M10 EN8');
  assert.deepEqual(errors, []);
  assert.equal(list[0].name, 'Metal Mine');
  assert.equal(list[1].name, 'Energy Technology');
});

test('serializeList round-trips', () => {
  const { list } = parseImportText('M10 C8');
  assert.equal(serializeList(list), 'M10\nC8');
});
