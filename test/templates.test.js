const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, memoryBackend } = require('../src/storage');
const {
  applyTemplate,
  saveCurrentAsTemplate,
  applyTemplateToAccount,
  saveAccountStateAsTemplate,
} = require('../src/templates');

function freshStore() {
  return createStore(memoryBackend());
}

test('saveCurrentAsTemplate captures list-mode queue', () => {
  const store = freshStore();
  store.setPlanetState('1', { mode: 'list', list: [{ code: 'M', level: 1 }], rule: null, cachedLevels: {}, done: [] });
  saveCurrentAsTemplate(store, '1', 'New Colony');
  const templates = store.getTemplates();
  assert.deepEqual(templates['New Colony'], { mode: 'list', list: [{ code: 'M', level: 1 }] });
});

test('applyTemplate writes template onto a different planet, resetting done', () => {
  const store = freshStore();
  store.saveTemplate('New Colony', { mode: 'list', list: [{ code: 'M', level: 1 }, { code: 'C', level: 1 }] });
  store.updatePlanetState('2', { done: ['stale'] });

  applyTemplate(store, '2', 'New Colony');
  const state = store.getPlanetState('2');
  assert.equal(state.mode, 'list');
  assert.equal(state.list.length, 2);
  assert.deepEqual(state.done, []);
});

test('applyTemplate throws for unknown template name', () => {
  const store = freshStore();
  assert.throws(() => applyTemplate(store, '1', 'Nope'));
});

test('saveAccountStateAsTemplate captures the research queue', () => {
  const store = freshStore();
  store.setAccountState({ mode: 'list', list: [{ code: 'EN', level: 8 }], rule: null, cachedLevels: {}, done: [] });
  saveAccountStateAsTemplate(store, 'Core Research');
  const templates = store.getTemplates();
  assert.deepEqual(templates['Core Research'], { mode: 'list', list: [{ code: 'EN', level: 8 }] });
});

test('applyTemplateToAccount replaces the research queue and resets done', () => {
  const store = freshStore();
  store.saveTemplate('Core Research', { mode: 'list', list: [{ code: 'EN', level: 8 }, { code: 'CD', level: 6 }] });
  store.updateAccountState({ done: ['stale'] });

  applyTemplateToAccount(store, 'Core Research');
  const state = store.getAccountState();
  assert.equal(state.mode, 'list');
  assert.equal(state.list.length, 2);
  assert.deepEqual(state.done, []);
});

test('applyTemplateToAccount throws for unknown template name', () => {
  const store = freshStore();
  assert.throws(() => applyTemplateToAccount(store, 'Nope'));
});
