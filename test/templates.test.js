const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, memoryBackend } = require('../src/storage');
const {
  applyTemplate,
  saveCurrentAsTemplate,
  applyTemplateToAccount,
  saveAccountStateAsTemplate,
  applyTemplateToLifeform,
  saveLifeformStateAsTemplate,
  seedDefaultTemplates,
  resetDefaultTemplates,
  CURATED_TEMPLATES,
} = require('../src/templates');
const BuildOrder = require('../src/buildorder');

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

test('saveLifeformStateAsTemplate captures a planet\'s lifeform-building queue', () => {
  const store = freshStore();
  store.setLifeformState('1', { mode: 'list', list: [{ code: 'ME', level: 21 }], rule: null, cachedLevels: {}, done: [] });
  saveLifeformStateAsTemplate(store, '1', 'Rock\'tal Growth');
  const templates = store.getTemplates();
  assert.deepEqual(templates['Rock\'tal Growth'], { mode: 'list', list: [{ code: 'ME', level: 21 }] });
});

test('applyTemplateToLifeform writes template onto a planet\'s lifeform queue, resetting done', () => {
  const store = freshStore();
  store.saveTemplate('Rock\'tal Growth', { mode: 'list', list: [{ code: 'ME', level: 21 }, { code: 'CF', level: 23 }] });
  store.updateLifeformState('2', { done: ['stale'] });

  applyTemplateToLifeform(store, '2', 'Rock\'tal Growth');
  const state = store.getLifeformState('2');
  assert.equal(state.mode, 'list');
  assert.equal(state.list.length, 2);
  assert.deepEqual(state.done, []);
  // Independent of the regular per-planet building queue for the same planet id.
  assert.deepEqual(store.getPlanetState('2').list, []);
});

test('applyTemplateToLifeform throws for unknown template name', () => {
  const store = freshStore();
  assert.throws(() => applyTemplateToLifeform(store, '1', 'Nope'));
});

test('seedDefaultTemplates populates every preset and curated template on a totally empty store', () => {
  const store = freshStore();
  seedDefaultTemplates(store);
  const templates = store.getTemplates();
  for (const name in BuildOrder.PRESETS) assert.ok(templates[name], `missing preset: ${name}`);
  for (const name in CURATED_TEMPLATES) assert.ok(templates[name], `missing curated template: ${name}`);
});

test('seedDefaultTemplates backfills missing curated templates without touching ones that already exist', () => {
  const store = freshStore();
  // Simulate an older install that already auto-seeded just the presets.
  store.saveTemplate('Balanced Economy', { mode: 'list', list: [{ code: 'CUSTOM', level: 99 }] });

  seedDefaultTemplates(store);
  const templates = store.getTemplates();

  // Pre-existing template under a curated name is left untouched...
  assert.deepEqual(templates['Balanced Economy'].list, [{ code: 'CUSTOM', level: 99 }]);
  // ...but the previously-missing curated templates get backfilled.
  assert.ok(templates['Homeworld Growth']);
  assert.ok(templates['Core Research']);
  assert.ok(templates["Rock'tal Growth"]);
});

test('seedDefaultTemplates is a no-op for names the user already has, even after being called twice', () => {
  const store = freshStore();
  seedDefaultTemplates(store);
  seedDefaultTemplates(store);
  const templates = store.getTemplates();
  assert.equal(Object.keys(templates).length, Object.keys(BuildOrder.PRESETS).length + Object.keys(CURATED_TEMPLATES).length);
});

test('resetDefaultTemplates overwrites a stale built-in with the shipped default', () => {
  const store = freshStore();
  // Simulate a locally-saved copy of a built-in from before it changed upstream.
  store.saveTemplate('New Colony', { mode: 'list', list: [{ code: 'STALE', level: 1 }] });

  const names = resetDefaultTemplates(store);
  const templates = store.getTemplates();

  assert.ok(names.includes('New Colony'));
  assert.deepEqual(templates['New Colony'], { mode: 'list', list: BuildOrder.PRESETS['New Colony'] });
});

test('resetDefaultTemplates leaves a user-made template (not a built-in name) untouched', () => {
  const store = freshStore();
  store.saveTemplate('My Custom Queue', { mode: 'list', list: [{ code: 'M', level: 42 }] });

  const names = resetDefaultTemplates(store);
  const templates = store.getTemplates();

  assert.ok(!names.includes('My Custom Queue'));
  assert.deepEqual(templates['My Custom Queue'], { mode: 'list', list: [{ code: 'M', level: 42 }] });
});
