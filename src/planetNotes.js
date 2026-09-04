/*
 * Galaxy-view planet notes: the small "leave alone / not worth it / farm
 * this" tags a player leaves on planets while scanning the galaxy view, so
 * the verdict is visible at a glance next time without re-scanning.
 *
 * Pure logic only - no DOM/storage access (see galaxyOverlay.js for the
 * DOM injection, storage.js for the persistence, both of which use this
 * module for the shared vocabulary/shape).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.PlanetNotes = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Order is display order in the popup's preset row.
  const PRESETS = [
    { id: 'defended', emoji: '⚔️', label: 'Defended - leave alone' },
    { id: 'weak', emoji: '💤', label: 'Weak inactive - not worth it' },
    { id: 'farm', emoji: '🌾', label: 'Juicy farm target' },
    { id: 'watch', emoji: '⚠️', label: 'Watch' },
  ];

  function presetById(id) {
    return PRESETS.find((p) => p.id === id) || null;
  }

  // galaxy/system/position are the three numbers that pin a planet slot in
  // the galaxy view (position 1-15). Stringified and joined rather than kept
  // as a nested object so it drops straight into a flat storage key.
  function coordKey(galaxy, system, position) {
    return `${galaxy}:${system}:${position}`;
  }

  // Builds the note object that gets persisted, from what the popup form
  // collected. presetId may be null (free-text-only note). A custom emoji
  // (typed instead of picked from a preset) wins over the preset's default.
  function buildNote({ presetId, emoji, text }) {
    const preset = presetById(presetId);
    const resolvedEmoji = (emoji || (preset && preset.emoji) || '').trim();
    const resolvedText = (text || '').trim();
    if (!resolvedEmoji && !resolvedText) return null;
    return {
      preset: preset ? preset.id : null,
      emoji: resolvedEmoji,
      text: resolvedText,
      updatedAt: Date.now(),
    };
  }

  // What the galaxy-row marker shows when a note exists: the emoji (or a
  // generic tag glyph if the note is text-only) plus a tooltip combining the
  // preset label and free text.
  function markerFor(note) {
    if (!note) return { glyph: '🏷', title: 'Tag this planet' };
    const preset = presetById(note.preset);
    const glyph = note.emoji || '🏷';
    const parts = [];
    if (preset) parts.push(preset.label);
    if (note.text) parts.push(note.text);
    return { glyph, title: parts.join(' - ') || 'Tagged planet' };
  }

  return { PRESETS, presetById, coordKey, buildNote, markerFor };
});
