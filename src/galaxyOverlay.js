/*
 * Galaxy-view planet tagging: a small clickable marker appended to each
 * planet row on the Galaxy page (component=galaxy) showing whatever note is
 * saved for that coordinate (see planetNotes.js), and a popup for setting
 * one. Writes directly into the game's own DOM for the marker (like
 * roiOverlay.js) but uses a single shared Shadow DOM host for the popup so
 * OGame's page styles can't bleed into the editor (like panel.js).
 *
 * See dom.js's Galaxy-page comment block for the confirmed markup. The
 * marker is appended into the row's existing `.cellAction` cell (alongside
 * the espionage/message/buddy/missile icons), falling back to appending
 * directly to the row if that cell is ever missing - a markup change
 * degrades to "marker floats at the row's end" rather than throwing.
 *
 * REPORTED (2026-09, Zen/Firefox): `.cellAction` is a flex row with no
 * explicit width - it's naturally sized to fit its 5 native icons - but
 * gets flex-shrunk by the row whenever the row itself is tight on space
 * (not reproduced in the earlier Chrome check at a wider viewport), and
 * that shrink cascades down to squish the icons inside it. Fixing this
 * by literally widening the cell to a fixed pixel value isn't reliable
 * (no CSS grid backs these columns - see dom.js - so there's no shared
 * width to widen safely). Instead, `.cellAction:has(.oqueue-note-cell)`
 * gets `flex-shrink: 0`, which exempts *only* rows we've tagged with a
 * marker from the row's shrink algorithm - the cell (and everything in
 * it) simply takes whatever width its content actually needs.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./planetNotes') : root.OQueue.PlanetNotes,
      typeof require !== 'undefined' ? require('./dom') : root.OQueue.Dom
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.GalaxyOverlay = factory(root.OQueue.PlanetNotes, root.OQueue.Dom);
  }
})(typeof self !== 'undefined' ? self : this, function (PlanetNotes, Dom) {
  'use strict';

  const MARKER_CLASS = 'oqueue-note-marker';
  const CELL_CLASS = 'oqueue-note-cell';
  const STYLE_ID = 'oqueue-galaxy-style';
  const POPUP_HOST_ID = 'oqueue-note-popup-host';

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${CELL_CLASS} { display: inline-flex; vertical-align: middle; flex-shrink: 0; }
      ${Dom.SELECTORS.galaxyActionCell}:has(.${CELL_CLASS}) { flex-shrink: 0; }
      .${MARKER_CLASS} {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        min-width: 0;
        min-height: 0;
        flex-shrink: 0;
        margin: 0;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        opacity: 0.55;
        background: none;
        border: none;
        border-radius: 0;
        box-shadow: none;
        padding: 0;
      }
      .${MARKER_CLASS}.oqueue-tagged { opacity: 1; }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function el(doc, tag, attrs) {
    const node = doc.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  // One popup host, created lazily and reused across every marker click
  // (repositioned/repopulated each time) rather than one per row.
  function ensurePopup(doc) {
    let host = doc.getElementById(POPUP_HOST_ID);
    if (host) return host;
    host = doc.createElement('div');
    host.id = POPUP_HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = `
      .popup {
        position: fixed;
        width: 220px;
        background: #1b1f24;
        color: #e6e6e6;
        font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        border: 1px solid #3a4048;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        z-index: 1000000;
        padding: 8px;
      }
      .hidden { display: none; }
      .presets { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
      .preset {
        flex: 1 1 auto;
        background: #323a42;
        color: #e6e6e6;
        border: 1px solid #454e57;
        border-radius: 4px;
        padding: 4px;
        cursor: pointer;
        font-size: 13px;
      }
      .preset.selected { border-color: #ffd479; background: #3d4650; }
      input[type=text] {
        width: 100%;
        box-sizing: border-box;
        background: #12151a;
        color: #e6e6e6;
        border: 1px solid #3a4048;
        border-radius: 4px;
        padding: 4px;
        margin-bottom: 6px;
        font: 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .actions { display: flex; gap: 6px; }
      button.action {
        flex: 1 1 auto;
        background: #323a42;
        color: #e6e6e6;
        border: 1px solid #454e57;
        border-radius: 4px;
        padding: 4px 6px;
        cursor: pointer;
        font-size: 11px;
      }
      button.action:hover { background: #3d4650; }
    `;
    shadow.appendChild(style);
    const popup = doc.createElement('div');
    popup.className = 'popup hidden';
    shadow.appendChild(popup);
    doc.body.appendChild(host);
    host._popup = popup;
    host._shadow = shadow;
    return host;
  }

  function closePopup(doc) {
    const host = doc.getElementById(POPUP_HOST_ID);
    if (host && host._popup) host._popup.classList.add('hidden');
  }

  function openPopup(doc, anchorEl, coordKey, note, handlers) {
    const host = ensurePopup(doc);
    const popup = host._popup;
    popup.innerHTML = '';

    let selectedPreset = note ? note.preset : null;

    const presetsRow = el(doc, 'div', { class: 'presets' });
    PlanetNotes.PRESETS.forEach((preset) => {
      const btn = el(doc, 'button', { class: 'preset', title: preset.label, text: preset.emoji });
      if (preset.id === selectedPreset) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        selectedPreset = selectedPreset === preset.id ? null : preset.id;
        Array.from(presetsRow.children).forEach((c) => c.classList.remove('selected'));
        if (selectedPreset) btn.classList.add('selected');
      });
      presetsRow.appendChild(btn);
    });
    popup.appendChild(presetsRow);

    const textInput = el(doc, 'input', { type: 'text', placeholder: 'Note (optional)' });
    textInput.value = note ? note.text || '' : '';
    popup.appendChild(textInput);

    const actions = el(doc, 'div', { class: 'actions' });
    const saveBtn = el(doc, 'button', { class: 'action', text: 'Save' });
    const clearBtn = el(doc, 'button', { class: 'action', text: 'Clear' });
    const cancelBtn = el(doc, 'button', { class: 'action', text: 'Cancel' });
    saveBtn.addEventListener('click', () => {
      const built = PlanetNotes.buildNote({ presetId: selectedPreset, text: textInput.value });
      if (built) handlers.onSave(coordKey, built);
      else handlers.onClear(coordKey);
      popup.classList.add('hidden');
    });
    clearBtn.addEventListener('click', () => {
      handlers.onClear(coordKey);
      popup.classList.add('hidden');
    });
    cancelBtn.addEventListener('click', () => popup.classList.add('hidden'));
    actions.appendChild(saveBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(cancelBtn);
    popup.appendChild(actions);

    const rect = anchorEl.getBoundingClientRect();
    popup.style.left = `${Math.max(4, rect.left)}px`;
    popup.style.top = `${rect.bottom + 4}px`;
    popup.classList.remove('hidden');
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
    ensureStyle(doc);

    Dom.readGalaxyRows(doc).forEach(({ position, row }) => {
      const coordKey = PlanetNotes.coordKey(coords.galaxy, coords.system, position);
      const note = options.getNote(coordKey);
      const marker = markerFor(row, doc);
      const info = PlanetNotes.markerFor(note);
      marker.textContent = info.glyph;
      marker.title = `OQueue: ${info.title}`;
      marker.classList.toggle('oqueue-tagged', !!note);
      marker.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPopup(doc, marker, coordKey, note, options);
      };
    });
  }

  function markerFor(row, doc) {
    let wrapper = row.querySelector(`.${CELL_CLASS}`);
    if (!wrapper) {
      wrapper = doc.createElement('div');
      wrapper.className = CELL_CLASS;
      const actionCell = row.querySelector(Dom.SELECTORS.galaxyActionCell);
      (actionCell || row).appendChild(wrapper);
    }
    let btn = wrapper.querySelector(`.${MARKER_CLASS}`);
    if (!btn) {
      btn = doc.createElement('button');
      btn.className = MARKER_CLASS;
      btn.type = 'button';
      wrapper.appendChild(btn);
    }
    return btn;
  }

  function remove(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    doc.querySelectorAll(`.${CELL_CLASS}`).forEach((el) => el.remove());
    closePopup(doc);
  }

  return { render, remove };
});
