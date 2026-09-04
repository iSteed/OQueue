const test = require('node:test');
const assert = require('node:assert/strict');
const PlanetNotes = require('../src/planetNotes');

test('coordKey joins galaxy/system/position', () => {
  assert.equal(PlanetNotes.coordKey(3, 145, 7), '3:145:7');
});

test('buildNote resolves a preset emoji when no custom emoji is given', () => {
  const note = PlanetNotes.buildNote({ presetId: 'farm', text: '' });
  assert.equal(note.preset, 'farm');
  assert.equal(note.emoji, '🌾');
  assert.equal(note.text, '');
  assert.equal(typeof note.updatedAt, 'number');
});

test('buildNote keeps free text alongside a preset', () => {
  const note = PlanetNotes.buildNote({ presetId: 'defended', text: '  6x deut moon, big fleet  ' });
  assert.equal(note.preset, 'defended');
  assert.equal(note.text, '6x deut moon, big fleet');
});

test('buildNote allows a text-only note with no preset', () => {
  const note = PlanetNotes.buildNote({ presetId: null, text: 'check again next week' });
  assert.equal(note.preset, null);
  assert.equal(note.emoji, '');
  assert.equal(note.text, 'check again next week');
});

test('buildNote returns null when there is nothing to save', () => {
  assert.equal(PlanetNotes.buildNote({ presetId: null, text: '   ' }), null);
  assert.equal(PlanetNotes.buildNote({}), null);
});

test('buildNote ignores an unknown preset id', () => {
  const note = PlanetNotes.buildNote({ presetId: 'nonsense', text: 'still saved' });
  assert.equal(note.preset, null);
  assert.equal(note.text, 'still saved');
});

test('markerFor returns the tag glyph and a prompt title when there is no note', () => {
  const marker = PlanetNotes.markerFor(null);
  assert.equal(marker.glyph, '🏷');
  assert.match(marker.title, /tag/i);
});

test('markerFor combines preset label and free text in the tooltip', () => {
  const note = PlanetNotes.buildNote({ presetId: 'weak', text: 'only mines, no fleet' });
  const marker = PlanetNotes.markerFor(note);
  assert.equal(marker.glyph, '💤');
  assert.equal(marker.title, 'Weak inactive - not worth it - only mines, no fleet');
});

test('markerFor falls back to the tag glyph for a text-only note', () => {
  const note = PlanetNotes.buildNote({ presetId: null, text: 'revisit later' });
  const marker = PlanetNotes.markerFor(note);
  assert.equal(marker.glyph, '🏷');
  assert.equal(marker.title, 'revisit later');
});
