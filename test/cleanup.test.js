const test = require('node:test');
const assert = require('node:assert/strict');
const { apply, STYLE_ID, HEADER_MERCHANT_ID, CSS } = require('../src/cleanup');

// Minimal fake Document - just enough surface for apply() to work against,
// consistent with how the rest of the DOM-adjacent code in this project
// isn't tested against a real browser (see dom.js, untested for the same
// reason) but this one's plain enough to fake without jsdom.
function fakeDoc() {
  const created = [];
  const head = { appendChild: (el) => created.push(el) };
  const byId = {};
  const queryMap = {};
  return {
    head,
    created,
    getElementById: (id) => byId[id],
    querySelector: (sel) => queryMap[sel],
    // Setting .id auto-registers into byId, mirroring how a real DOM's
    // getElementById sees any element in the document the moment its id is
    // set - needed so relocateMerchantLink's own idempotency check (looking
    // up HEADER_MERCHANT_ID after creating+assigning it) works in tests.
    createElement: (tag) => {
      const el = {
        tag,
        textContent: '',
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
      };
      let _id = '';
      Object.defineProperty(el, 'id', {
        get: () => _id,
        set: (v) => {
          _id = v;
          if (v) byId[v] = el;
        },
      });
      return el;
    },
    _register(el) {
      byId[el.id] = el;
    },
    _registerQuery(sel, el) {
      queryMap[sel] = el;
    },
  };
}

// Fakes just enough of #headerBarLinks (a flat list of <span> children, one
// per header link, matched by text - see cleanup.js's header-bar comment)
// for relocateMerchantLink's traversal/insertBefore to work against.
function fakeHeaderLinks(spanTexts) {
  const children = spanTexts.map((text) => ({ textContent: text }));
  const inserted = [];
  return {
    children,
    inserted,
    insertBefore(newNode, referenceNode) {
      const idx = children.indexOf(referenceNode);
      children.splice(idx, 0, newNode);
      inserted.push({ newNode, referenceNode });
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

test('apply inserts a Merchant link into the header bar, right before Log out', () => {
  const doc = fakeDoc();
  const headerLinks = fakeHeaderLinks(['Profile', 'Highscore', 'Support', 'Log out']);
  doc._register({ id: 'headerBarLinks', ...headerLinks });
  doc._registerQuery(
    '#menuTable a.premiumHighligt[href*="component=traderOverview"]',
    { href: 'https://s275-en.ogame.gameforge.com/game/index.php?page=ingame&component=traderOverview' }
  );

  apply(doc);

  const registeredHeaderLinks = doc.getElementById('headerBarLinks');
  const merchantSpan = registeredHeaderLinks.children.find((c) => c.id === HEADER_MERCHANT_ID);
  assert.ok(merchantSpan, 'Merchant span was inserted');
  assert.equal(merchantSpan.children[0].textContent, 'Merchant');
  assert.equal(merchantSpan.children[0].href, 'https://s275-en.ogame.gameforge.com/game/index.php?page=ingame&component=traderOverview');
  // Landed immediately before the Log out span, not appended at the end.
  const idx = registeredHeaderLinks.children.indexOf(merchantSpan);
  assert.equal(registeredHeaderLinks.children[idx + 1].textContent, 'Log out');
});

test('apply does not insert a Merchant link into the header bar twice', () => {
  const doc = fakeDoc();
  const headerLinks = fakeHeaderLinks(['Support', 'Log out']);
  doc._register({ id: 'headerBarLinks', ...headerLinks });
  doc._registerQuery(
    '#menuTable a.premiumHighligt[href*="component=traderOverview"]',
    { href: 'https://s275-en.ogame.gameforge.com/game/index.php?page=ingame&component=traderOverview' }
  );

  apply(doc);
  apply(doc);

  const merchantSpans = doc.getElementById('headerBarLinks').children.filter((c) => c.id === HEADER_MERCHANT_ID);
  assert.equal(merchantSpans.length, 1);
});

test('apply leaves the header bar untouched when Merchant\'s sidebar link cannot be found (e.g. already using a template account)', () => {
  const doc = fakeDoc();
  const headerLinks = fakeHeaderLinks(['Support', 'Log out']);
  doc._register({ id: 'headerBarLinks', ...headerLinks });
  // Deliberately no _registerQuery call - querySelector returns undefined.

  apply(doc);

  const merchantSpans = doc.getElementById('headerBarLinks').children.filter((c) => c.id === HEADER_MERCHANT_ID);
  assert.equal(merchantSpans.length, 0);
});
