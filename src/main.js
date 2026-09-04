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
        LifeformResearch: require('./lifeformResearch'),
        Storage: require('./storage'),
        Import: require('./import'),
        Rules: require('./rules'),
        Formulas: require('./formulas'),
        Templates: require('./templates'),
        Panel: require('./panel'),
        Dom: require('./dom'),
        Cleanup: require('./cleanup'),
        Roi: require('./roi'),
        RoiOverlay: require('./roiOverlay'),
        PlanetNotes: require('./planetNotes'),
        GalaxyOverlay: require('./galaxyOverlay'),
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

  // A live deficit past this fraction of your *current* Solar Plant output
  // counts as "excessive" rather than the small, expected dip a
  // formula-only rule (which only models Metal/Crystal Mine + Deuterium
  // Synthesizer against Solar/Fusion) naturally runs - see needsEnergyOverride.
  const EXCESS_ENERGY_DEFICIT_RATIO = 0.2;

  // True when the live, ground-truth energy balance (see dom.js#readEnergyBalance
  // - reflects every energy-affecting building, including ones OQueue's
  // formulas don't model, like lifeform buildings) is negative enough that
  // rule mode should insist on Solar Plant next regardless of what the rule
  // itself asked for. energyBalance/solarLevel may be null/undefined
  // (non-planet scopes, or the element not found yet) - both fail safe to "no
  // override".
  function needsEnergyOverride(energyBalance, solarLevel) {
    if (energyBalance == null || energyBalance >= 0) return false;
    const solarProduction = OQueue.Formulas.energyProductionSolarPlant(solarLevel || 0);
    if (solarProduction <= 0) return true; // negative balance with no Solar built yet at all
    return Math.abs(energyBalance) > solarProduction * EXCESS_ENERGY_DEFICIT_RATIO;
  }

  // Resolves the next target for a planet's queue (list or rule mode) given
  // current levels, without mutating anything - pure derivation from stored
  // state. energyBalance (planet-queue rule mode only - null elsewhere) is
  // the live number from dom.js#readEnergyBalance, used as a safety net on
  // top of the rule's own formula-based Solar pacing - see needsEnergyOverride.
  function computeView(state, currentLevels, energyBalance) {
    const levels = Object.assign({}, state.cachedLevels, currentLevels);

    if (state.mode === 'rule' && state.rule) {
      let next = OQueue.Rules.resolveRule(state.rule, levels);
      let energyOverride = false;
      if ((!next || next.code !== 'S') && needsEnergyOverride(energyBalance, levels.S)) {
        next = OQueue.Buildings.byCode('S');
        next = Object.assign({}, next, { level: (levels.S || 0) + 1 });
        energyOverride = true;
      }
      return {
        current: next ? { label: labelFor(next) } : null,
        upcoming: [],
        doneItems: (state.done || []).map((label) => ({ label })),
        energyOverride,
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
    if (pageComponent === 'lfresearch') {
      return { scope: 'lifeformResearch' };
    }
    if (pageComponent === 'fleetdispatch') {
      return { scope: 'fleet' };
    }
    if (pageComponent === 'highscore') {
      return { scope: 'highscore' };
    }
    if (pageComponent === 'galaxy') {
      return { scope: 'galaxy' };
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
    const isLifeformResearch = context.scope === 'lifeformResearch';
    const isFleet = context.scope === 'fleet';
    const isHighscore = context.scope === 'highscore';
    const isGalaxy = context.scope === 'galaxy';
    const isPlanetQueue = context.scope === 'planet';
    const isSupplies = OQueue.Dom.currentPage(doc.location) === 'supplies';
    const planetId =
      isResearch || isLifeformResearch || isFleet || isHighscore || isGalaxy
        ? null
        : OQueue.Dom.activePlanetId(doc) || 'default';
    const title = isResearch
      ? 'Research Queue'
      : isLifeform
        ? `Lifeform Queue - ${planetId}`
        : isLifeformResearch
          ? 'Lifeform Research Slots'
          : isFleet
            ? 'Fleet - Expeditions'
            : isHighscore
              ? 'Highscore'
              : isGalaxy
                ? 'Galaxy Scan'
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
        // Assumes the top bracket outright for now instead of depending on
        // the Highscore-page rank-1 scrape (see Expeditions.
        // ASSUMED_MAX_RANK1_POINTS) - nothing forces a visit to that page
        // first, so relying on it left the advisor silently suggestion-less
        // until the user happened to go cache it.
        const shipCounts = OQueue.Dom.readShipCounts(doc);
        advisory = OQueue.Expeditions.buildAdvisory(slots, OQueue.Expeditions.ASSUMED_MAX_RANK1_POINTS, shipCounts);
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

    // Lifeform Development (component=lfresearch) isn't a queue either - the
    // 18 slots are one-time picks, not a sequential build order, so there's
    // nothing to track/complete. Just renders BuildOrder.md section 6's
    // assignment map as a static reference so it's visible without leaving
    // the page. Not tied to live DOM state at all (no selectors confirmed
    // for this page yet - see lifeformResearch.js).
    function refreshLifeformResearch() {
      panel.render({ title, showQueue: false, lifeformSlotPlan: OQueue.LifeformResearch.toPanelRows(), toast });
      toast = null;
    }

    // Galaxy page (component=galaxy) isn't a queue either - see
    // galaxyOverlay.js for the actual feature (a clickable tag marker on
    // each planet row). The panel here just shows a one-line reminder;
    // getNote/onSave/onClear are thin wrappers over the store so the DOM
    // layer never touches storage directly (same separation as
    // getState/setState above).
    function refreshGalaxy() {
      OQueue.GalaxyOverlay.render(doc, {
        getNote: (coordKey) => store.getPlanetNote(coordKey),
        onSave: (coordKey, note) => store.setPlanetNote(coordKey, note),
        onClear: (coordKey) => store.deletePlanetNote(coordKey),
      });
      panel.render({
        title,
        showQueue: false,
        statusMessage: 'Click the 🏷 next to a planet to tag it (defended / weak / farm target / watch).',
        toast,
      });
      toast = null;
    }

    function refresh() {
      if (isFleet) return refreshFleet();
      if (isHighscore) return refreshHighscore();
      if (isLifeformResearch) return refreshLifeformResearch();
      if (isGalaxy) return refreshGalaxy();

      const state = getState();
      const domLevels = readLevels();
      if (Object.keys(domLevels).length) {
        state.cachedLevels = Object.assign({}, state.cachedLevels, domLevels);
        setState(state);
      }

      // Only meaningful for the regular colony building queue - "S" (Solar
      // Plant) isn't even a valid key in the research/lifeform level
      // namespaces, so this stays null there and needsEnergyOverride no-ops.
      const energyBalance = isPlanetQueue ? OQueue.Dom.readEnergyBalance(doc) : null;
      const view = computeView(state, domLevels, energyBalance);
      const templates =
        isPlanetQueue || isResearch || isLifeform ? Object.keys(store.getTemplates()) : [];
      const { doneItems, moreDoneCount } = capDoneItems(view.doneItems, DONE_HISTORY_LIMIT);

      // Don't clobber an explicit toast already pending from a user action
      // (Imported, Applied template, ...) - this is just informational.
      if (view.energyOverride && !toast) {
        toast = `⚡ Energy balance ${energyBalance} - prioritizing Solar Plant over the rule's own pacing`;
      }

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

      if (isSupplies) OQueue.RoiOverlay.render(doc, domLevels);
    }

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

    // The template store is shared across scopes, so one handler covers
    // planet/research/lifeform panels alike.
    if (isPlanetQueue || isResearch || isLifeform) {
      panel.on('resetTemplates', () => {
        const names = OQueue.Templates.resetDefaultTemplates(store);
        toast = `Reset ${names.length} built-in template${names.length === 1 ? '' : 's'} to default`;
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
