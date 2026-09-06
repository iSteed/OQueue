/*
 * Galaxy-view planet tagging: finds each planet row on the Galaxy page
 * (component=galaxy) and its coordinate, and hands them to noteOverlay.js
 * for the actual marker/popup - see that file for the shared UI, and
 * dom.js's Galaxy-page comment block for the confirmed markup this reads.
 *
 * The marker is appended into the row's existing `.cellAction` cell
 * (alongside the espionage/message/buddy/missile icons), falling back to
 * the row itself if that cell is ever missing.
 *
 * CONFIRMED (2026-09, live Chrome session): `.cellAction` actually has
 * an explicit CSS width (~101px, sized for exactly its 5 native icons,
 * not content-derived despite appearances - verified by removing the
 * marker and watching the cell's width stay unchanged). `flex-shrink: 0`
 * alone (an earlier version of this fix) only stops the *row* from
 * shrinking the cell as a whole; it does nothing about that fixed width
 * being too small once a 6th child (the marker) is appended, so the
 * cell's own internal flex layout was still squeezing something to fit
 * within it - specifically the leftmost "search for lifeforms" icon
 * (`.planetDiscoverIcons`), crushed from its natural 17px down to 9px,
 * since apparently only that icon (not the 4 `<a>` action icons next to
 * it) lacks its own flex-shrink:0 protection in the game's CSS. Fixed by
 * also overriding `width: auto !important` on `.cellAction` - confirmed
 * live across all 15 rows that this restores every native icon
 * (including the discover one) to its natural width while the cell
 * grows by ~8-9px to fit, with no row overflow. (An even earlier version
 * scoped this with `:has(.oqueue-note-cell)` to only affect tagged rows,
 * but `:has()` support isn't universal - an unsupported pseudo-class
 * invalidates the whole selector rather than degrading gracefully, so
 * the rule silently did nothing on a browser without it. Applying both
 * rules unconditionally to every `.cellAction` avoids that trap; it's
 * harmless on untagged rows too since we only inject this stylesheet on
 * the Galaxy page.)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./planetNotes') : root.OQueue.PlanetNotes,
      typeof require !== 'undefined' ? require('./dom') : root.OQueue.Dom,
      typeof require !== 'undefined' ? require('./noteOverlay') : root.OQueue.NoteOverlay
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.GalaxyOverlay = factory(root.OQueue.PlanetNotes, root.OQueue.Dom, root.OQueue.NoteOverlay);
  }
})(typeof self !== 'undefined' ? self : this, function (PlanetNotes, Dom, NoteOverlay) {
  'use strict';

  const STYLE_ID = 'oqueue-galaxy-style';

  function ensureGalaxyStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${Dom.SELECTORS.galaxyActionCell} { flex-shrink: 0; width: auto !important; }`;
    (doc.head || doc.documentElement).appendChild(style);
  }

  // doc: live document. options:
  //   getNote(coordKey) -> note|null    - looks up a saved note
  //   onSave(coordKey, note)            - persist a note (preset/emoji/text)
  //   onClear(coordKey)                 - delete a note
  function render(doc, options) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    const coords = Dom.currentGalaxyCoords(doc);
    if (!coords) return;
    NoteOverlay.ensureStyle(doc);
    ensureGalaxyStyle(doc);

    Dom.readGalaxyRows(doc).forEach(({ position, row }) => {
      const coordKey = PlanetNotes.coordKey(coords.galaxy, coords.system, position);
      const container = row.querySelector(Dom.SELECTORS.galaxyActionCell) || row;
      NoteOverlay.renderMarker(doc, container, coordKey, options);
    });
  }

  return { render, remove: NoteOverlay.remove };
});
