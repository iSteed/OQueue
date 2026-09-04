/*
 * localStorage wrapper. Accepts an injectable backend so the same code can run
 * under Tampermonkey (real localStorage) and under plain Node for unit tests
 * (in-memory fallback below).
 *
 * Key scheme:
 *   oqueue:planet:<planetId>    -> { mode: 'list'|'rule', list, rule, cachedLevels, done }
 *                                  A planet key that's never been written (or
 *                                  was written but never actually customized -
 *                                  empty list, no rule, no done history) reads
 *                                  back as DEFAULT_PLANET_RULE_STATE below - a
 *                                  self-sustaining Metal/Crystal/Solar rule
 *                                  rather than an empty list - so a fresh
 *                                  colony starts self-correcting immediately
 *                                  instead of showing "queue complete" with
 *                                  nothing queued.
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
 *   oqueue:note:<g>:<s>:<p>      -> { preset, emoji, text, updatedAt } - a
 *                                  galaxy-view planet tag (see planetNotes.js),
 *                                  keyed by galaxy:system:position rather than
 *                                  planet id since the whole point is tagging
 *                                  planets you've scanned, not colonized.
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
    module.exports = factory(
      typeof require !== 'undefined' ? require('./rules') : root.OQueue.Rules
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Storage = factory(root.OQueue.Rules);
  }
})(typeof self !== 'undefined' ? self : this, function (Rules) {
  'use strict';

  const PLANET_PREFIX = 'oqueue:planet:';
  const LIFEFORM_PREFIX = 'oqueue:lifeform:';
  const ACCOUNT_KEY = 'oqueue:account';
  const TEMPLATES_KEY = 'oqueue:templates';
  const RANK1_POINTS_KEY = 'oqueue:rank1points';
  const NOTE_PREFIX = 'oqueue:note:';

  // Default rule for a fresh/untouched colony: Solar always keeps pace with
  // Metal+Crystal+Deuterium's energy draw first (so a deficit never runs
  // away - Solar's own formula produces exactly 2x a mine's consumption at
  // the same level and exactly 1x a Deuterium Synthesizer's, which is where
  // the /2 + Deuterium comes from), Crystal trails Metal by a standard 2
  // levels, and Metal drives the cycle forward forever (`Metal = Metal + 1`
  // is, by construction, never satisfied by the level that just built it -
  // see rules.js - so this never goes stale/stuck the way a naive two-line
  // "Metal = Crystal + 2 / Solar >= ..." rule would once Crystal itself had
  // nothing left driving it). Verified against formulas.js#energyBalance:
  // deficit stays small and bounded (roughly 1% of throughput) rather than
  // running away, exactly the "don't want power to go excessive negative"
  // ask this was built for.
  const DEFAULT_PLANET_RULE_TEXT = `
repeat:
  Solar >= ceil((Metal + Crystal)/2 + Deuterium)
  Crystal = Metal - 2
  Metal = Metal + 1
`;
  const DEFAULT_PLANET_RULE = Rules.parseRuleText(DEFAULT_PLANET_RULE_TEXT);

  function defaultQueueState() {
    return { mode: 'list', list: [], rule: null, cachedLevels: {}, done: [] };
  }

  // Only for planet (colony) state - see DEFAULT_PLANET_RULE above.
  // Lifeform-building and account (research) queues keep the plain
  // defaultQueueState(): DEFAULT_PLANET_RULE's variables are regular
  // building codes, meaningless for a lifeform building set or research
  // techs, so defaulting those to it would silently resolve nonsense.
  function defaultPlanetQueueState() {
    return { mode: 'rule', list: [], rule: DEFAULT_PLANET_RULE, cachedLevels: {}, done: [] };
  }

  // True for a planet state that's never actually been customized - no list
  // built, no rule set, no completion history - whether that's because the
  // key was never written at all, or because it was written back (e.g. by
  // the auto-detect cachedLevels merge in main.js#refresh) while still
  // holding the plain empty defaultQueueState() shape. Used to upgrade an
  // already-existing-but-untouched key to the rule default too, not just a
  // wholly-missing one, since a colony visited even once before this default
  // existed would otherwise be stuck on the old empty-list default forever.
  function isUntouchedPlanetState(state) {
    return (
      state.mode === 'list' &&
      (!state.list || state.list.length === 0) &&
      !state.rule &&
      (!state.done || state.done.length === 0)
    );
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
      const state = readJSON(be, PLANET_PREFIX + planetId, defaultPlanetQueueState());
      if (!isUntouchedPlanetState(state)) return state;
      // Preserve any already-auto-detected levels rather than discarding
      // them - a colony visited once (cachedLevels populated) but never
      // actually queued is still "untouched" for this purpose, and the rule
      // can start resolving from real known levels immediately instead of 0.
      return Object.assign(defaultPlanetQueueState(), { cachedLevels: state.cachedLevels || {} });
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

    // coordKey: "galaxy:system:position" (see planetNotes.js#coordKey).
    function getPlanetNote(coordKey) {
      return readJSON(be, NOTE_PREFIX + coordKey, null);
    }

    function setPlanetNote(coordKey, note) {
      writeJSON(be, NOTE_PREFIX + coordKey, note);
    }

    function deletePlanetNote(coordKey) {
      be.removeItem(NOTE_PREFIX + coordKey);
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
      getPlanetNote,
      setPlanetNote,
      deletePlanetNote,
    };
  }

  return { createStore, memoryBackend };
});
