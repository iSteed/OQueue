/*
 * Import/export for shorthand queue text, e.g.:
 *   M10
 *   C8
 *   S10
 *   R2
 *   SY1
 * -> list-mode queue: [{code:'M', id:1, name:'Metal Mine', level:10}, ...]
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
    root.OQueue.Import = factory(root.OQueue.Buildings, root.OQueue.Technologies, root.OQueue.LifeformBuildings);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings, Technologies, LifeformBuildings) {
  'use strict';

  const TOKEN_RE = /^([A-Za-z]+)\s*(\d+)$/;

  // Buildings, then technologies, then lifeform buildings - lets the same
  // shorthand syntax work across the per-planet building queue, the
  // account-wide research queue, and the per-planet lifeform queue.
  // species defaults to HUMANS for backward compatibility, but callers on a
  // lifeform page should pass the planet's actual active species (see
  // dom.js#activeLifeformSpecies) so e.g. Rock'tal codes resolve correctly.
  function resolveCode(code, species) {
    try {
      return Buildings.byCode(code);
    } catch (e) {
      try {
        return Technologies.byCode(code);
      } catch (e2) {
        return LifeformBuildings.byCode(species || 'HUMANS', code);
      }
    }
  }

  function parseImportText(text, species) {
    const tokens = text
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const list = [];
    const errors = [];

    for (const token of tokens) {
      const match = TOKEN_RE.exec(token);
      if (!match) {
        errors.push(`Could not parse "${token}"`);
        continue;
      }
      const [, code, levelStr] = match;
      try {
        const item = resolveCode(code, species);
        list.push({
          code: item.code,
          id: item.id,
          name: item.name,
          level: parseInt(levelStr, 10),
        });
      } catch (e) {
        errors.push(`Unknown shorthand: ${code}`);
      }
    }

    return { list, errors };
  }

  function serializeList(list) {
    return list.map((item) => `${item.code}${item.level}`).join('\n');
  }

  return { parseImportText, serializeList };
});
