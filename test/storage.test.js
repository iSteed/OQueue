const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, memoryBackend } = require('../src/storage');

function freshStore() {
  return createStore(memoryBackend());
}

test('getPlanetState returns the self-sustaining rule default when unset', () => {
  const store = freshStore();
  const state = store.getPlanetState('123');
  assert.equal(state.mode, 'rule');
  assert.equal(state.list.length, 0);
  assert.ok(state.rule);
  assert.deepEqual(state.cachedLevels, {});
  assert.deepEqual(state.done, []);
});

test('the default rule keeps resolving forward without ever getting stuck', () => {
  const store = freshStore();
  const { resolveRule } = require('../src/rules');
  const spec = store.getPlanetState('123').rule;
  let levels = {};
  for (let i = 0; i < 30; i++) {
    const next = resolveRule(spec, levels);
    assert.ok(next, `rule got stuck after ${i} steps at levels ${JSON.stringify(levels)}`);
    levels[next.code] = next.level;
  }
});

test('setPlanetState / getPlanetState round-trips', () => {
  const store = freshStore();
  store.setPlanetState('123', { mode: 'list', list: [{ code: 'M', level: 10 }], rule: null, cachedLevels: { M: 8 }, done: [] });
  const state = store.getPlanetState('123');
  assert.equal(state.list[0].code, 'M');
  assert.equal(state.cachedLevels.M, 8);
});

test('getPlanetState upgrades an already-stored-but-never-customized planet to the rule default', () => {
  const store = freshStore();
  // Simulates a colony visited once before this default existed - main.js's
  // auto-detect cachedLevels merge writes this shape even if the player
  // never touched Edit/templates.
  store.setPlanetState('123', { mode: 'list', list: [], rule: null, cachedLevels: { M: 3 }, done: [] });
  const state = store.getPlanetState('123');
  assert.equal(state.mode, 'rule');
  assert.ok(state.rule);
});

test('getPlanetState leaves an actually-customized planet alone', () => {
  const store = freshStore();
  store.setPlanetState('123', { mode: 'list', list: [{ code: 'M', level: 5 }], rule: null, cachedLevels: {}, done: [] });
  const state = store.getPlanetState('123');
  assert.equal(state.mode, 'list');
  assert.equal(state.list.length, 1);
});

test('updatePlanetState merges patch into existing state', () => {
  const store = freshStore();
  store.updatePlanetState('123', { cachedLevels: { M: 5 } });
  const state = store.updatePlanetState('123', { cachedLevels: { M: 6 } });
  assert.equal(state.cachedLevels.M, 6);
  assert.equal(state.mode, 'rule'); // untouched default field (now rule mode) preserved
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

test('getRank1Points returns null when unset', () => {
  const store = freshStore();
  assert.equal(store.getRank1Points(), null);
});

test('setRank1Points / getRank1Points round-trips with a timestamp', () => {
  const store = freshStore();
  store.setRank1Points(78973266);
  const record = store.getRank1Points();
  assert.equal(record.points, 78973266);
  assert.equal(typeof record.capturedAt, 'number');
});

test('templates use a separate backend from planet/account state when one is supplied', () => {
  const mainBackend = memoryBackend();
  const templatesBackend = memoryBackend();
  const store = createStore(mainBackend, templatesBackend);

  store.setPlanetState('123', { mode: 'list', list: [{ code: 'M', level: 1 }], rule: null, cachedLevels: {}, done: [] });
  store.saveTemplate('New Colony', { mode: 'list', list: [{ code: 'M', level: 1 }] });

  // Template landed in its own backend, not the main one - so a store built
  // on the main backend alone (simulating a different server's localStorage)
  // wouldn't see planet state bleed into the shared template backend either.
  assert.ok(templatesBackend.getItem('oqueue:templates'));
  assert.equal(mainBackend.getItem('oqueue:templates'), null);

  // A second store sharing only the templates backend (simulating a
  // different server that still shares Tampermonkey's GM storage) sees the
  // same template, proving templates are reachable across "servers".
  const otherServerStore = createStore(memoryBackend(), templatesBackend);
  assert.ok(otherServerStore.getTemplates()['New Colony']);
  // Its own main backend never got a planet:123 key at all (only the
  // templates backend is shared) - a genuinely fresh key, so this is the
  // rule default, not the plain empty-list one.
  assert.equal(otherServerStore.getPlanetState('123').mode, 'rule');
});

test('templates fall back to the main backend when no separate templates backend is given (e.g. @grant none)', () => {
  const store = freshStore();
  store.saveTemplate('New Colony', { mode: 'list', list: [] });
  assert.ok(store.getTemplates()['New Colony']);
});

test('getPlanetNote returns null when unset', () => {
  const store = freshStore();
  assert.equal(store.getPlanetNote('3:145:7'), null);
});

test('setPlanetNote / getPlanetNote round-trips, keyed independently per coordinate', () => {
  const store = freshStore();
  store.setPlanetNote('3:145:7', { preset: 'farm', emoji: '🌾', text: 'weak inactive', updatedAt: 1 });
  store.setPlanetNote('3:145:8', { preset: 'defended', emoji: '⚔️', text: '', updatedAt: 2 });
  assert.equal(store.getPlanetNote('3:145:7').preset, 'farm');
  assert.equal(store.getPlanetNote('3:145:8').preset, 'defended');
});

test('deletePlanetNote clears a saved note', () => {
  const store = freshStore();
  store.setPlanetNote('3:145:7', { preset: 'watch', emoji: '⚠️', text: '', updatedAt: 1 });
  store.deletePlanetNote('3:145:7');
  assert.equal(store.getPlanetNote('3:145:7'), null);
});
