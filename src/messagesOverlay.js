/*
 * Messages-page planet tagging: finds each message's coordinate (see
 * dom.js#readMessageRows) and hands it to noteOverlay.js for the actual
 * marker/popup - same tag you'd set from the Galaxy page (galaxyOverlay.js),
 * just reachable straight from an espionage report/combat report without
 * switching pages to look the coordinate up in the galaxy view first.
 *
 * The marker is appended into the message's collapsed-row icon strip
 * (`.msgFilteredHeaderCell_actions` - star/reply/forward/...), falling back
 * to the message's own container if that cell is ever missing.
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
    root.OQueue.MessagesOverlay = factory(root.OQueue.PlanetNotes, root.OQueue.Dom, root.OQueue.NoteOverlay);
  }
})(typeof self !== 'undefined' ? self : this, function (PlanetNotes, Dom, NoteOverlay) {
  'use strict';

  // doc: live document. options:
  //   getNote(coordKey) -> note|null    - looks up a saved note
  //   onSave(coordKey, note)            - persist a note (preset/emoji/text)
  //   onClear(coordKey)                 - delete a note
  function render(doc, options) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    NoteOverlay.ensureStyle(doc);

    Dom.readMessageRows(doc).forEach(({ galaxy, system, position, row }) => {
      const coordKey = PlanetNotes.coordKey(galaxy, system, position);
      const container = row.querySelector(Dom.SELECTORS.messageActionsCell) || row;
      NoteOverlay.renderMarker(doc, container, coordKey, options);
    });
  }

  return { render, remove: NoteOverlay.remove };
});
