const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, memoryBackend } = require('../src/storage');

function freshStore() {
  return createStore(memoryBackend());
}

test('getPlanetState returns default state when unset', () => {
  const store = freshStore();
  const state = store.getPlanetState('123');
  assert.deepEqual(state, { mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] });
});

test('setPlanetState / getPlanetState round-trips', () => {
  const store = freshStore();
  store.setPlanetState('123', { mode: 'list', list: [{ code: 'M', level: 10 }], rule: null, cachedLevels: { M: 8 }, done: [] });
  const state = store.getPlanetState('123');
  assert.equal(state.list[0].code, 'M');
  assert.equal(state.cachedLevels.M, 8);
});

test('updatePlanetState merges patch into existing state', () => {
  const store = freshStore();
  store.updatePlanetState('123', { cachedLevels: { M: 5 } });
  const state = store.updatePlanetState('123', { cachedLevels: { M: 6 } });
  assert.equal(state.cachedLevels.M, 6);
  assert.equal(state.mode, 'list'); // untouched default field preserved
});

test('getLifeformState returns default state when unset', () => {
  const store = freshStore();
  assert.deepEqual(store.getLifeformState('123'), { mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] });
});

test('setLifeformState / getLifeformState round-trips and stays independent of the regular building queue', () => {
  const store = freshStore();
  store.setPlanetState('123', { mode: 'list', list: [], rule: null, cachedLevels: { M: 10 }, done: [] });
  store.setLifeformState('123', { mode: 'list', list: [{ code: 'RS', level: 5 }], rule: null, cachedLevels: { RS: 3 }, done: [] });
  assert.equal(store.getLifeformState('123').cachedLevels.RS, 3);
  assert.equal(store.getPlanetState('123').cachedLevels.M, 10); // untouched
});

test('updateLifeformState merges patch into existing lifeform state', () => {
  const store = freshStore();
  store.updateLifeformState('123', { cachedLevels: { RS: 1 } });
  const state = store.updateLifeformState('123', { cachedLevels: { RS: 2 } });
  assert.equal(state.cachedLevels.RS, 2);
});

test('listPlanetIds does not pick up lifeform keys as planet ids', () => {
  const store = freshStore();
  store.setPlanetState('1', {});
  store.setLifeformState('1', {});
  store.setLifeformState('2', {}); // no matching setPlanetState('2', ...)
  assert.deepEqual(store.listPlanetIds(), ['1']);
});

test('getAccountState returns default state when unset', () => {
  const store = freshStore();
  assert.deepEqual(store.getAccountState(), { mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] });
});

test('setAccountState / getAccountState round-trips', () => {
  const store = freshStore();
  store.setAccountState({ mode: 'list', list: [{ code: 'EN', level: 5 }], rule: null, cachedLevels: { EN: 3 }, done: [] });
  const state = store.getAccountState();
  assert.equal(state.list[0].code, 'EN');
  assert.equal(state.cachedLevels.EN, 3);
});

test('updateAccountState merges patch and is independent of planet state', () => {
  const store = freshStore();
  store.setPlanetState('123', { mode: 'list', list: [], rule: null, cachedLevels: { M: 9 }, done: [] });
  const state = store.updateAccountState({ cachedLevels: { EN: 4 } });
  assert.equal(state.cachedLevels.EN, 4);
  assert.equal(store.getPlanetState('123').cachedLevels.M, 9); // untouched
});

test('listPlanetIds does not include the account key', () => {
  const store = freshStore();
  store.setPlanetState('1', {});
  store.setAccountState({ mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] });
  assert.deepEqual(store.listPlanetIds(), ['1']);
});

test('listPlanetIds returns only planet keys', () => {
  const store = freshStore();
  store.setPlanetState('1', {});
  store.setPlanetState('2', {});
  store.saveTemplate('foo', { mode: 'list', list: [] });
  const ids = store.listPlanetIds().sort();
  assert.deepEqual(ids, ['1', '2']);
});

test('templates: save, get, delete', () => {
  const store = freshStore();
  store.saveTemplate('New Colony', { mode: 'list', list: [{ code: 'M', level: 1 }] });
  assert.ok(store.getTemplates()['New Colony']);
  store.deleteTemplate('New Colony');
  assert.equal(store.getTemplates()['New Colony'], undefined);
});
