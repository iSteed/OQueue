/*
 * Injects a small "18h"-style payback badge onto each mine tile
 * (Metal/Crystal Mine, Deuterium Synthesizer) on the Supplies page - see
 * roi.js for the math. Writes directly into the game's own DOM (not the
 * shadow-DOM panel), since the badge has to sit inside OGame's own building
 * tiles rather than float separately.
 *
 * UNCONFIRMED like roi.js's formulas: badge placement assumes each
 * `li.technology` tile can take `position: relative` without breaking the
 * page's own layout - reasonable for a floated/absolute badge, but not yet
 * checked against a live Supplies page.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./roi') : root.OQueue.Roi,
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings,
      typeof require !== 'undefined' ? require('./dom') : root.OQueue.Dom
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.RoiOverlay = factory(root.OQueue.Roi, root.OQueue.Buildings, root.OQueue.Dom);
  }
})(typeof self !== 'undefined' ? self : this, function (Roi, Buildings, Dom) {
  'use strict';

  const BADGE_CLASS = 'oqueue-roi-badge';
  const STYLE_ID = 'oqueue-roi-style';
  const MINE_CODES = ['M', 'C', 'D'];

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BADGE_CLASS} {
        position: absolute;
        bottom: 2px;
        left: 2px;
        font: 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(20, 24, 28, 0.85);
        color: #ffd479;
        pointer-events: none;
        z-index: 5;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function formatHours(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
    if (hours < 48) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  }

  // doc: live document. levels: { M, C, D } current mine levels (e.g. from
  // Dom.readBuildingLevels). options: passed through to Roi.paybackHours -
  // { speed, temperature }.
  function render(doc, levels, options) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    levels = levels || {};
    ensureStyle(doc);

    MINE_CODES.forEach((code) => {
      const level = levels[code];
      const building = Buildings.byCode(code);
      const row = doc.querySelector(Dom.SELECTORS.buildingRow(building.id));
      if (!row) return;

      const hours = level == null ? null : Roi.paybackHours(code, level, options);
      let badge = row.querySelector(`.${BADGE_CLASS}`);

      if (hours == null) {
        if (badge) badge.remove();
        return;
      }

      if (!badge) {
        const view = doc.defaultView;
        const position = view ? view.getComputedStyle(row).position : row.style.position;
        if (!position || position === 'static') row.style.position = 'relative';
        badge = doc.createElement('span');
        badge.className = BADGE_CLASS;
        row.appendChild(badge);
      }
      badge.textContent = formatHours(hours);
      badge.title =
        "OQueue: estimated time for this mine's own production increase to earn back this upgrade's cost";
    });
  }

  function remove(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    doc.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
  }

  return { render, remove };
});
