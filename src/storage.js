/*
 * localStorage wrapper. Accepts an injectable backend so the same code can run
 * under Tampermonkey (real localStorage) and under plain Node for unit tests
 * (in-memory fallback below).
 *
 * Key scheme:
 *   oqueue:planet:<planetId>    -> { mode: 'list'|'rule', list, rule, cachedLevels, done }
 *   oqueue:lifeform:<planetId>  -> same shape - a planet's lifeform-building queue,
 *                                  tracked separately from its regular building queue
 *                                  (deliberately a different prefix, not a suffix on
 *                                  oqueue:planet:, so it can't be mistaken for a planet
 *                                  id by listPlanetIds)
 *   oqueue:account              -> same shape, but singular - for account-wide
 *                                  things like research, which aren't per-planet
 *   oqueue:templates            -> { [name]: { mode: 'list'|'rule', list?, rule? } }
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Storage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLANET_PREFIX = 'oqueue:planet:';
  const LIFEFORM_PREFIX = 'oqueue:lifeform:';
  const ACCOUNT_KEY = 'oqueue:account';
  const TEMPLATES_KEY = 'oqueue:templates';

  function defaultQueueState() {
    return { mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] };
  }

  function memoryBackend() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key: (i) => Array.from(map.keys())[i],
      get length() { return map.size; },
    };
  }

  function defaultBackend() {
    if (typeof localStorage !== 'undefined') return localStorage;
    return memoryBackend();
  }

  function createStore(backend) {
    const be = backend || defaultBackend();

    function readJSON(key, fallback) {
      const raw = be.getItem(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }

    function writeJSON(key, value) {
      be.setItem(key, JSON.stringify(value));
    }

    function getPlanetState(planetId) {
      return readJSON(PLANET_PREFIX + planetId, defaultQueueState());
    }

    function setPlanetState(planetId, state) {
      writeJSON(PLANET_PREFIX + planetId, state);
    }

    function updatePlanetState(planetId, patch) {
      const current = getPlanetState(planetId);
      const next = Object.assign({}, current, patch);
      setPlanetState(planetId, next);
      return next;
    }

    function getLifeformState(planetId) {
      return readJSON(LIFEFORM_PREFIX + planetId, defaultQueueState());
    }

    function setLifeformState(planetId, state) {
      writeJSON(LIFEFORM_PREFIX + planetId, state);
    }

    function updateLifeformState(planetId, patch) {
      const current = getLifeformState(planetId);
      const next = Object.assign({}, current, patch);
      setLifeformState(planetId, next);
      return next;
    }

    function getAccountState() {
      return readJSON(ACCOUNT_KEY, defaultQueueState());
    }

    function setAccountState(state) {
      writeJSON(ACCOUNT_KEY, state);
    }

    function updateAccountState(patch) {
      const current = getAccountState();
      const next = Object.assign({}, current, patch);
      setAccountState(next);
      return next;
    }

    function listPlanetIds() {
      const ids = [];
      const n = be.length;
      for (let i = 0; i < n; i++) {
        const key = be.key(i);
        if (key && key.startsWith(PLANET_PREFIX)) {
          ids.push(key.slice(PLANET_PREFIX.length));
        }
      }
      return ids;
    }

    function getTemplates() {
      return readJSON(TEMPLATES_KEY, {});
    }

    function saveTemplate(name, template) {
      const templates = getTemplates();
      templates[name] = template;
      writeJSON(TEMPLATES_KEY, templates);
      return templates;
    }

    function deleteTemplate(name) {
      const templates = getTemplates();
      delete templates[name];
      writeJSON(TEMPLATES_KEY, templates);
      return templates;
    }

    return {
      getPlanetState,
      setPlanetState,
      updatePlanetState,
      getLifeformState,
      setLifeformState,
      updateLifeformState,
      getAccountState,
      setAccountState,
      updateAccountState,
      listPlanetIds,
      getTemplates,
      saveTemplate,
      deleteTemplate,
    };
  }

  return { createStore, memoryBackend };
});
