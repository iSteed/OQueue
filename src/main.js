/*
 * Orchestrator: wires storage, rule/list resolution, the panel, DOM readers,
 * and notifications together. This is the only module that touches globals
 * like `document`/`location`/`setInterval` directly at the top level.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      root.OQueue || {
        Buildings: require('./buildings'),
        LifeformBuildings: require('./lifeformBuildings'),
        Storage: require('./storage'),
        Import: require('./import'),
        Rules: require('./rules'),
        Templates: require('./templates'),
        Panel: require('./panel'),
        Dom: require('./dom'),
        Notify: require('./notify'),
        Cleanup: require('./cleanup'),
      }
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.App = factory(root.OQueue);
  }
})(typeof self !== 'undefined' ? self : this, function (OQueue) {
  'use strict';

  const POLL_INTERVAL_MS = 3000;
  const DONE_HISTORY_LIMIT = 5;
  // Fallback only - used when the live page's active-species indicator isn't
  // present/recognised yet (see dom.js#activeLifeformSpecies). Once a planet
  // is confirmed on a species, the real detection takes over.
  const DEFAULT_LIFEFORM_SPECIES = 'HUMANS';

  function labelFor(entry) {
    if (!entry) return null;
    const name = entry.name || (OQueue.Buildings.BUILDINGS[entry.code] || {}).name || entry.code;
    return `${name} ${entry.level}`;
  }

  // Resolves the next target for a planet's queue (list or rule mode) given
  // current levels, without mutating anything - pure derivation from stored state.
  function computeView(state, currentLevels) {
    const levels = Object.assign({}, state.cachedLevels, currentLevels);

    if (state.mode === 'rule' && state.rule) {
      const next = OQueue.Rules.resolveRule(state.rule, levels);
      return {
        current: next ? { label: labelFor(next) } : null,
        upcoming: [],
        doneItems: (state.done || []).map((label) => ({ label })),
      };
    }

    const list = state.list || [];
    const doneItems = [];
    let current = null;
    const upcoming = [];

    for (const item of list) {
      const have = levels[item.code] || 0;
      if (have >= item.level) {
        doneItems.push({ label: labelFor(item) });
      } else if (!current) {
        current = { label: labelFor(item) };
      } else {
        upcoming.push({ label: labelFor(item) });
      }
    }

    return { current, upcoming, doneItems };
  }

  // Keeps the panel's done-history short so the current/upcoming items stay
  // visible without scrolling once a queue has a long completed tail.
  function capDoneItems(doneItems, limit) {
    const moreDoneCount = Math.max(0, doneItems.length - limit);
    return { doneItems: doneItems.slice(-limit), moreDoneCount };
  }

  // Research is account-wide and lifeform buildings are a separate per-planet
  // queue from regular buildings, so the app needs to manage a different
  // "queue" depending on which page you're on. Pure/testable independent of
  // any real document - takes the page's `component` string.
  function resolveContext(pageComponent) {
    if (pageComponent === 'research') {
      return { scope: 'research' };
    }
    if (pageComponent === 'lfbuildings') {
      return { scope: 'lifeform' };
    }
    if (pageComponent === 'fleetdispatch') {
      return { scope: 'fleet' };
    }
    if (pageComponent === 'highscore') {
      return { scope: 'highscore' };
    }
    return { scope: 'planet' };
  }

  function createApp(opts) {
    opts = opts || {};
    const store = opts.store || OQueue.Storage.createStore();
    const doc = opts.document || (typeof document !== 'undefined' ? document : null);

    OQueue.Templates.seedDefaultTemplates(store);

    const context = resolveContext(OQueue.Dom.currentPage(doc.location));
    const isResearch = context.scope === 'research';
    const isLifeform = context.scope === 'lifeform';
    const isFleet = context.scope === 'fleet';
    const isHighscore = context.scope === 'highscore';
    const isPlanetQueue = context.scope === 'planet';
    const planetId =
      isResearch || isFleet || isHighscore ? null : OQueue.Dom.activePlanetId(doc) || 'default';
    const title = isResearch
      ? 'Research Queue'
      : isLifeform
        ? `Lifeform Queue - ${planetId}`
        : isFleet
          ? 'Fleet - Expeditions'
          : isHighscore
            ? 'Highscore'
            : `Colony Queue - ${planetId}`;

    function getState() {
      if (isResearch) return store.getAccountState();
      if (isLifeform) return store.getLifeformState(planetId);
      return store.getPlanetState(planetId);
    }
    function setState(state) {
      if (isResearch) store.setAccountState(state);
      else if (isLifeform) store.setLifeformState(planetId, state);
      else store.setPlanetState(planetId, state);
    }
    function activeSpecies() {
      return OQueue.Dom.activeLifeformSpecies(doc) || DEFAULT_LIFEFORM_SPECIES;
    }
    function readLevels() {
      if (isResearch) return OQueue.Dom.readTechLevels(doc);
      if (isLifeform) return OQueue.Dom.readLifeformBuildingLevels(doc, activeSpecies());
      return OQueue.Dom.readBuildingLevels(doc);
    }

    const panel = OQueue.Panel.createPanel(doc);
    let toast = null;

    // Fleet Dispatch and Highscore aren't queue pages - Fleet shows the
    // expedition-slot advisory, Highscore silently caches rank-1 points
    // (see storage.js) for that advisory to use elsewhere. Neither has a
    // building/research/lifeform list to track, so they skip getState/
    // setState/computeView entirely.
    function refreshFleet() {
      const slots = OQueue.Dom.readExpeditionSlots(doc);
      let advisory = null;
      let statusMessage = null;
      if (!slots) {
        statusMessage = 'Could not read expedition slots on this page.';
      } else {
        const rank1 = store.getRank1Points();
        const shipCounts = OQueue.Dom.readShipCounts(doc);
        advisory = OQueue.Expeditions.buildAdvisory(slots, rank1 ? rank1.points : null, shipCounts);
        if (!advisory) statusMessage = `All expedition slots active (${slots.used}/${slots.max}) ✓`;
      }
      panel.render({ title, showQueue: false, expeditionAdvisory: advisory, statusMessage, toast });
      toast = null;
    }

    function refreshHighscore() {
      let statusMessage = 'Switch to the Points tab to cache rank-1 data for the expedition advisor.';
      if (OQueue.Dom.currentHighscoreCategory(doc.location) === '1') {
        const points = OQueue.Dom.readRank1Points(doc);
        if (points != null) {
          store.setRank1Points(points);
          statusMessage = `Rank-1 points cached: ${points.toLocaleString()}`;
        }
      }
      panel.render({ title, showQueue: false, statusMessage, toast });
      toast = null;
    }

    function refresh() {
      if (isFleet) return refreshFleet();
      if (isHighscore) return refreshHighscore();

      const state = getState();
      const domLevels = readLevels();
      if (Object.keys(domLevels).length) {
        state.cachedLevels = Object.assign({}, state.cachedLevels, domLevels);
        setState(state);
      }

      const view = computeView(state, domLevels);
      const templates =
        isPlanetQueue || isResearch || isLifeform ? Object.keys(store.getTemplates()) : [];
      const { doneItems, moreDoneCount } = capDoneItems(view.doneItems, DONE_HISTORY_LIMIT);

      panel.render({
        title,
        mode: state.mode,
        doneItems,
        moreDoneCount,
        current: view.current,
        upcoming: view.upcoming,
        editText: OQueue.Import.serializeList(state.list || []),
        templates,
        toast,
      });
      toast = null;

      if (view.current) {
        const entry = (state.list || []).find((i) => labelFor(i) === view.current.label);
        if (entry) OQueue.Dom.highlightBuilding(doc, entry.id, 'oqueue-highlight');
      }
    }

    panel.on('done', () => {
      const state = getState();
      const list = state.list || [];
      const idx = list.findIndex((item) => (state.cachedLevels[item.code] || 0) < item.level);
      if (idx >= 0) {
        const completed = list[idx];
        state.cachedLevels[completed.code] = completed.level;
        state.done = (state.done || []).concat(labelFor(completed));
        setState(state);
        const next = list[idx + 1];
        const { body } = OQueue.Notify.notifyBuildComplete(completed.name, next ? labelFor(next) : null);
        toast = body;
      }
      refresh();
    });

    panel.on('importSave', (text) => {
      const species = isLifeform ? activeSpecies() : DEFAULT_LIFEFORM_SPECIES;
      const { list, errors } = OQueue.Import.parseImportText(text, species);
      setState(Object.assign({}, getState(), { mode: 'list', list, done: [] }));
      toast = errors.length ? `Import errors: ${errors.join('; ')}` : 'Imported';
      refresh();
    });

    // Templates work for the regular per-planet building queue, the
    // account-wide research queue, and a planet's lifeform-building queue -
    // one shared name -> template store, just applied differently depending
    // on scope.
    if (isPlanetQueue) {
      panel.on('applyTemplate', (name) => {
        OQueue.Templates.applyTemplate(store, planetId, name);
        toast = `Applied template "${name}"`;
        refresh();
      });

      panel.on('saveTemplate', (name) => {
        OQueue.Templates.saveCurrentAsTemplate(store, planetId, name);
        toast = `Saved template "${name}"`;
        refresh();
      });
    } else if (isResearch) {
      panel.on('applyTemplate', (name) => {
        OQueue.Templates.applyTemplateToAccount(store, name);
        toast = `Applied template "${name}"`;
        refresh();
      });

      panel.on('saveTemplate', (name) => {
        OQueue.Templates.saveAccountStateAsTemplate(store, name);
        toast = `Saved template "${name}"`;
        refresh();
      });
    } else if (isLifeform) {
      panel.on('applyTemplate', (name) => {
        OQueue.Templates.applyTemplateToLifeform(store, planetId, name);
        toast = `Applied template "${name}"`;
        refresh();
      });

      panel.on('saveTemplate', (name) => {
        OQueue.Templates.saveLifeformStateAsTemplate(store, planetId, name);
        toast = `Saved template "${name}"`;
        refresh();
      });
    }

    panel.on('close', () => panel.unmount());

    let pollTimer = null;
    function start() {
      OQueue.Cleanup.apply(doc);
      panel.mount(doc.body);
      refresh();
      OQueue.Dom.watchConstructionBox(doc, refresh);
      pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
    }
    function stop() {
      if (pollTimer) clearInterval(pollTimer);
      panel.unmount();
    }

    return { start, stop, refresh, panel };
  }

  return { createApp, computeView, labelFor, capDoneItems, resolveContext };
});
