/*
 * DOM integration: reads building levels/planet info from the live OGame page
 * and watches for construction completion.
 *
 * CONFIRMED against a live OGame session (2026-08-03, server s276-en):
 *   - Building rows: `li.technology[data-technology="<id>"]`, level lives on
 *     the child `.level` element's `data-value` attribute (not page text).
 *     Lifeform building rows on the `lfbuildings` page use this exact same
 *     markup - no separate selectors needed.
 *   - Planet sidebar: `#planetList .smallplanet` (one div per planet, id
 *     `planet-<id>`), containing `a.planetlink` (gets `.active` on the
 *     current planet) and a `.planet-name` text node.
 *   - Construction widget: `#productionboxbuildingcomponent`, a
 *     `table.construction` that gains/loses the `active` class and whose
 *     `tbody` holds a row per queued item while building; countdown lives in
 *     a `<time class="countdown ...">` element inside it (confirmed via the
 *     equivalent `#productionboxshipyardcomponent` widget, same template).
 *
 * CONFIRMED (2026-08-05, server s276-en): the active lifeform species shows
 * up as `#lifeform .lifeform-item-icon`, which carries a `lifeformN` class
 * (N = 1 Humans, 2 Rock'tal, per LifeformBuildings.SPECIES_BY_INDEX) -
 * that's how activeLifeformSpecies() below tells planets on different
 * species apart without guessing from the page's building ids.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings,
      typeof require !== 'undefined' ? require('./technologies') : root.OQueue.Technologies,
      typeof require !== 'undefined' ? require('./lifeformBuildings') : root.OQueue.LifeformBuildings
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Dom = factory(root.OQueue.Buildings, root.OQueue.Technologies, root.OQueue.LifeformBuildings);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings, Technologies, LifeformBuildings) {
  'use strict';

  const SELECTORS = {
    buildingRow: (id) => `li.technology[data-technology="${id}"]`,
    buildingLevel: '.level',
    constructionBox: '#productionboxbuildingcomponent',
    constructionTable: 'table.construction',
    constructionCountdown: 'time.countdown',
    planetList: '#planetList',
    planetItem: '.smallplanet',
    planetLink: 'a.planetlink',
    planetName: '.planet-name',
    lifeformIndicator: '#lifeform .lifeform-item-icon',
  };

  function currentPlanetId(loc) {
    loc = loc || (typeof location !== 'undefined' ? location : null);
    if (!loc) return null;
    const params = new URLSearchParams(loc.search);
    return params.get('cp');
  }

  function currentPage(loc) {
    loc = loc || (typeof location !== 'undefined' ? location : null);
    if (!loc) return null;
    const params = new URLSearchParams(loc.search);
    return params.get('component') || params.get('page');
  }

  // Shared by readBuildingLevels/readTechLevels: walks a registry's {code:
  // {id}} entries and reads whichever ones have a matching row on the
  // current page (buildings and technologies share the same row/level markup).
  function readLevelsFor(doc, registry) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return {};
    const levels = {};
    for (const code in registry) {
      const { id } = registry[code];
      const row = doc.querySelector(SELECTORS.buildingRow(id));
      if (!row) continue;
      const levelEl = row.querySelector(SELECTORS.buildingLevel);
      const value = levelEl ? levelEl.getAttribute('data-value') : null;
      if (value != null) levels[code] = parseInt(value, 10);
    }
    return levels;
  }

  // doc: Document to read from. Returns { [buildingCode]: level }.
  function readBuildingLevels(doc) {
    return readLevelsFor(doc, Buildings.BUILDINGS);
  }

  // doc: Document to read from (the research page). Returns { [techCode]: level }.
  function readTechLevels(doc) {
    return readLevelsFor(doc, Technologies.TECHNOLOGIES);
  }

  // doc: Document to read from (the lfbuildings page). species: e.g. 'HUMANS'.
  // Returns { [lifeformBuildingCode]: level }.
  function readLifeformBuildingLevels(doc, species) {
    return readLevelsFor(doc, LifeformBuildings.SPECIES[species] || {});
  }

  // Reads the current planet's active lifeform species (e.g. 'HUMANS',
  // 'ROCKTAL') from the toolbar indicator. Returns null if the indicator
  // isn't present (not logged in, page not loaded yet) or its index isn't
  // one of the confirmed species in SPECIES_BY_INDEX - callers should fall
  // back to a sane default rather than throw.
  function activeLifeformSpecies(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    const el = doc.querySelector(SELECTORS.lifeformIndicator);
    if (!el) return null;
    const match = /\blifeform(\d+)\b/.exec(el.className);
    if (!match) return null;
    return LifeformBuildings.SPECIES_BY_INDEX[match[1]] || null;
  }

  // The `cp` URL param is only present when you've just switched planets -
  // for the common case of staying on one planet across page loads, the
  // active planet has to be read from the sidebar instead.
  function activePlanetId(doc) {
    const planets = readPlanetList(doc);
    const active = planets.find((p) => p.active);
    return active ? active.id : currentPlanetId();
  }

  function readPlanetList(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return [];
    const container = doc.querySelector(SELECTORS.planetList);
    if (!container) return [];
    return Array.from(container.querySelectorAll(SELECTORS.planetItem)).map((el) => {
      const link = el.querySelector(SELECTORS.planetLink);
      const nameEl = el.querySelector(SELECTORS.planetName);
      return {
        id: el.id.replace(/^planet-/, ''),
        name: nameEl ? nameEl.textContent.trim() : null,
        active: link ? link.classList.contains('active') : false,
      };
    });
  }

  // Returns true while a building is actively under construction.
  function isBuildingActive(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return false;
    const box = doc.querySelector(SELECTORS.constructionBox);
    if (!box) return false;
    const table = box.querySelector(SELECTORS.constructionTable);
    return !!(table && table.classList.contains('active'));
  }

  // Fires callback() whenever the construction box's content changes -
  // used as the "build completed" signal (caller re-reads levels to confirm).
  function watchConstructionBox(doc, callback) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return { disconnect() {} };
    const target = doc.querySelector(SELECTORS.constructionBox);
    if (!target) return { disconnect() {} };
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  function highlightBuilding(doc, buildingId, className) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    doc.querySelectorAll(`.${className}`).forEach((el) => el.classList.remove(className));
    const row = doc.querySelector(SELECTORS.buildingRow(buildingId));
    if (row) row.classList.add(className);
  }

  return {
    SELECTORS,
    currentPlanetId,
    activePlanetId,
    currentPage,
    readBuildingLevels,
    readTechLevels,
    readLifeformBuildingLevels,
    activeLifeformSpecies,
    readPlanetList,
    isBuildingActive,
    watchConstructionBox,
    highlightBuilding,
  };
});
