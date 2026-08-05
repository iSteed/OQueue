const test = require('node:test');
const assert = require('node:assert/strict');
const { apply, STYLE_ID, CSS } = require('../src/cleanup');

// Minimal fake Document - just enough surface for apply() to work against,
// consistent with how the rest of the DOM-adjacent code in this project
// isn't tested against a real browser (see dom.js, untested for the same
// reason) but this one's plain enough to fake without jsdom.
function fakeDoc() {
  const created = [];
  const head = { appendChild: (el) => created.push(el) };
  const byId = {};
  return {
    head,
    created,
    getElementById: (id) => byId[id],
    createElement: (tag) => ({ tag, id: '', textContent: '' }),
    _register(el) {
      byId[el.id] = el;
    },
  };
}

test('apply inserts exactly one style tag with the expected id and CSS', () => {
  const doc = fakeDoc();
  apply(doc);
  assert.equal(doc.created.length, 1);
  assert.equal(doc.created[0].id, STYLE_ID);
  assert.equal(doc.created[0].textContent, CSS);
});

test('apply is idempotent - does nothing if the style tag already exists', () => {
  const doc = fakeDoc();
  doc._register({ id: STYLE_ID });
  apply(doc);
  assert.equal(doc.created.length, 0);
});

test('CSS targets the premium nav items and the ad banner by their confirmed selectors', () => {
  assert.match(CSS, /#menuTable li:has\(a\.premiumHighligt\)/);
  assert.match(CSS, /#bannerSkyscrapercomponent/);
});
