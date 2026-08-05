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
 *   oqueue:rank1points          -> { points, capturedAt } - last-seen rank-1
 *                                  Points-category score, cached whenever the
 *                                  player visits that highscore tab so the
 *                                  expedition cargo advisory (see
 *                                  expeditions.js) has a number to work with
 *                                  even on pages that aren't the highscore page.
 *
 * Templates use a separate backend from everything else above. Every other
 * key is legitimately per-server (planet/tech levels don't mean anything
 * across servers), so plain localStorage (scoped per-origin, i.e. per
 * subdomain like s276-en vs s275-en) is correct for those. Templates are
 * just saved rule/list definitions with no server-specific data in them, so
 * a player who plays multiple universes reasonably expects to reuse them
 * across servers - that needs storage scoped to the whole script, not to one
 * origin. Tampermonkey's GM_getValue/GM_setValue (grant added in build.js)
 * provide exactly that, and are synchronous like everything else here, so
 * they drop in without changing any calling code's shape. Falls back to the
 * regular backend when GM_* isn't available (Node tests, @grant none).
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
  const RANK1_POINTS_KEY = 'oqueue:rank1points';

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

  // Cross-server backend for templates - see file header. Returns null (not
  // a fallback) when GM_getValue/GM_setValue aren't in scope, so callers can
  // tell "no GM support" apart from "GM support that happens to be empty".
  function gmBackend() {
    if (typeof GM_getValue !== 'function' || typeof GM_setValue !== 'function') return null;
    return {
      getItem: (k) => {
        const v = GM_getValue(k);
        return v === undefined || v === null ? null : v;
      },
      setItem: (k, v) => GM_setValue(k, v),
      removeItem: (k) => {
        if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
      },
    };
  }

  function createStore(backend, templatesBackend) {
    const be = backend || defaultBackend();
    const tbe = templatesBackend || gmBackend() || be;

    function readJSON(store, key, fallback) {
      const raw = store.getItem(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }

    function writeJSON(store, key, value) {
      store.setItem(key, JSON.stringify(value));
    }

    function getPlanetState(planetId) {
      return readJSON(be, PLANET_PREFIX + planetId, defaultQueueState());
    }

    function setPlanetState(planetId, state) {
      writeJSON(be, PLANET_PREFIX + planetId, state);
    }

    function updatePlanetState(planetId, patch) {
      const current = getPlanetState(planetId);
      const next = Object.assign({}, current, patch);
      setPlanetState(planetId, next);
      return next;
    }

    function getLifeformState(planetId) {
      return readJSON(be, LIFEFORM_PREFIX + planetId, defaultQueueState());
    }

    function setLifeformState(planetId, state) {
      writeJSON(be, LIFEFORM_PREFIX + planetId, state);
    }

    function updateLifeformState(planetId, patch) {
      const current = getLifeformState(planetId);
      const next = Object.assign({}, current, patch);
      setLifeformState(planetId, next);
      return next;
    }

    function getAccountState() {
      return readJSON(be, ACCOUNT_KEY, defaultQueueState());
    }

    function setAccountState(state) {
      writeJSON(be, ACCOUNT_KEY, state);
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
      return readJSON(tbe, TEMPLATES_KEY, {});
    }

    function saveTemplate(name, template) {
      const templates = getTemplates();
      templates[name] = template;
      writeJSON(tbe, TEMPLATES_KEY, templates);
      return templates;
    }

    function deleteTemplate(name) {
      const templates = getTemplates();
      delete templates[name];
      writeJSON(tbe, TEMPLATES_KEY, templates);
      return templates;
    }

    function getRank1Points() {
      return readJSON(be, RANK1_POINTS_KEY, null);
    }

    function setRank1Points(points) {
      const record = { points, capturedAt: Date.now() };
      writeJSON(be, RANK1_POINTS_KEY, record);
      return record;
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
      getRank1Points,
      setRank1Points,
    };
  }

  return { createStore, memoryBackend };
});
