/*
 * Technology shorthand -> stable OGame research ID map. Mirrors buildings.js
 * exactly (same shape, same byCode/byId functions) since the research page
 * uses the same `data-technology`-based level pattern as buildings/facilities.
 *
 * NEEDS VERIFICATION: these ids are from public OGame knowledge, not yet
 * confirmed against a live research page the way buildings.js's ids were
 * confirmed against supplies/facilities. Confirm the same way once possible:
 * read real `data-technology` attributes on the research page.
 *
 * Shorthand codes were chosen to not collide with any building code in
 * buildings.js, so the same import/edit textarea works for both.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Technologies = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TECHNOLOGIES = {
    EP: { id: 108, name: 'Espionage Technology' },
    CT: { id: 109, name: 'Computer Technology' },
    WT: { id: 110, name: 'Weapons Technology' },
    ST: { id: 111, name: 'Shielding Technology' },
    AT: { id: 112, name: 'Armour Technology' },
    EN: { id: 113, name: 'Energy Technology' },
    HT: { id: 114, name: 'Hyperspace Technology' },
    CD: { id: 115, name: 'Combustion Drive' },
    ID: { id: 117, name: 'Impulse Drive' },
    HD: { id: 118, name: 'Hyperspace Drive' },
    LT: { id: 120, name: 'Laser Technology' },
    IT: { id: 121, name: 'Ion Technology' },
    PT: { id: 122, name: 'Plasma Technology' },
    IRN: { id: 123, name: 'Intergalactic Research Network' },
    AP: { id: 124, name: 'Astrophysics' },
    GT: { id: 199, name: 'Graviton Technology' },
  };

  const BY_ID = {};
  for (const code in TECHNOLOGIES) {
    BY_ID[TECHNOLOGIES[code].id] = { code, name: TECHNOLOGIES[code].name };
  }

  function byCode(code) {
    const entry = TECHNOLOGIES[code.toUpperCase()];
    if (!entry) throw new Error(`Unknown technology shorthand: ${code}`);
    return { code: code.toUpperCase(), id: entry.id, name: entry.name };
  }

  function byId(id) {
    const entry = BY_ID[id];
    if (!entry) throw new Error(`Unknown technology id: ${id}`);
    return { code: entry.code, id, name: entry.name };
  }

  return { TECHNOLOGIES, byCode, byId };
});
