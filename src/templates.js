/*
 * Templates: named, reusable queues (list or rule mode) that can be applied
 * to any planet in one click. Thin layer over Storage's template CRUD.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildorder') : root.OQueue.BuildOrder
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Templates = factory(root.OQueue.BuildOrder);
  }
})(typeof self !== 'undefined' ? self : this, function (BuildOrder) {
  'use strict';

  function applyTemplate(store, planetId, templateName) {
    const templates = store.getTemplates();
    const template = templates[templateName];
    if (!template) throw new Error(`Unknown template: ${templateName}`);

    return store.updatePlanetState(planetId, {
      mode: template.mode,
      list: template.mode === 'list' ? template.list.slice() : [],
      rule: template.mode === 'rule' ? template.rule : null,
      done: [],
    });
  }

  function saveCurrentAsTemplate(store, planetId, templateName) {
    const state = store.getPlanetState(planetId);
    const template =
      state.mode === 'list'
        ? { mode: 'list', list: state.list.slice() }
        : { mode: 'rule', rule: state.rule };
    return store.saveTemplate(templateName, template);
  }

  // Same idea as applyTemplate/saveCurrentAsTemplate above, but for the
  // account-wide research queue instead of a per-planet building queue -
  // there's only ever one research queue, so "apply" replaces it outright
  // rather than targeting a chosen planet.
  function applyTemplateToAccount(store, templateName) {
    const templates = store.getTemplates();
    const template = templates[templateName];
    if (!template) throw new Error(`Unknown template: ${templateName}`);

    return store.updateAccountState({
      mode: template.mode,
      list: template.mode === 'list' ? template.list.slice() : [],
      rule: template.mode === 'rule' ? template.rule : null,
      done: [],
    });
  }

  function saveAccountStateAsTemplate(store, templateName) {
    const state = store.getAccountState();
    const template =
      state.mode === 'list'
        ? { mode: 'list', list: state.list.slice() }
        : { mode: 'rule', rule: state.rule };
    return store.saveTemplate(templateName, template);
  }

  // Same idea again, for a planet's lifeform-building queue - a separate
  // per-planet store from the regular building queue (see storage.js's
  // oqueue:lifeform: prefix), so it needs its own apply/save pair even
  // though the shape is identical to applyTemplate/saveCurrentAsTemplate.
  function applyTemplateToLifeform(store, planetId, templateName) {
    const templates = store.getTemplates();
    const template = templates[templateName];
    if (!template) throw new Error(`Unknown template: ${templateName}`);

    return store.updateLifeformState(planetId, {
      mode: template.mode,
      list: template.mode === 'list' ? template.list.slice() : [],
      rule: template.mode === 'rule' ? template.rule : null,
      done: [],
    });
  }

  function saveLifeformStateAsTemplate(store, planetId, templateName) {
    const state = store.getLifeformState(planetId);
    const template =
      state.mode === 'list'
        ? { mode: 'list', list: state.list.slice() }
        : { mode: 'rule', rule: state.rule };
    return store.saveTemplate(templateName, template);
  }

  // Concrete, hand-verified queue snapshots the user actually ran on their
  // s276-en account (captured 2026-08-05, before that server's local
  // templates went stale from a fresh-account restart - see oqueue-roadmap
  // memory). Unlike BuildOrder.PRESETS these aren't formula-generated, so
  // they're baked in here as literal data rather than computed.
  const CURATED_TEMPLATES = {
    'Homeworld Growth': {
      mode: 'list',
      list: [
        { code: 'S', id: 4, name: 'Solar Plant', level: 1 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 3 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 4 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 5 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 5 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 4 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 6 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 7 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 8 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 8 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 7 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 9 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 3 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 2 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 2 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 10 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 11 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 12 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 12 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 10 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 2 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 13 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 6 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 4 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 14 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 15 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 16 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 16 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 17 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 14 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 5 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 5 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 3 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 4 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 9 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 4 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 18 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 19 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 20 },
        { code: 'S', id: 4, name: 'Solar Plant', level: 20 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 18 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 6 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 12 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 6 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 8 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 8 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 6 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 24 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 22 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 8 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 1 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 15 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 6 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 8 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 28 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 25 },
        { code: 'R', id: 14, name: 'Robotics Factory', level: 10 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 2 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 18 },
        { code: 'T', id: 33, name: 'Terraformer', level: 1 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 12 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 12 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 9 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 32 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 29 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 8 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 10 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 21 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 3 },
        { code: 'T', id: 33, name: 'Terraformer', level: 3 },
        { code: 'M', id: 1, name: 'Metal Mine', level: 35 },
        { code: 'C', id: 2, name: 'Crystal Mine', level: 32 },
        { code: 'D', id: 3, name: 'Deuterium Synthesizer', level: 24 },
        { code: 'SY', id: 21, name: 'Shipyard', level: 9 },
        { code: 'RL', id: 31, name: 'Research Lab', level: 12 },
        { code: 'NF', id: 15, name: 'Nanite Factory', level: 4 },
        { code: 'T', id: 33, name: 'Terraformer', level: 5 },
        { code: 'MS', id: 22, name: 'Metal Storage', level: 15 },
        { code: 'CS', id: 23, name: 'Crystal Storage', level: 15 },
        { code: 'DS', id: 24, name: 'Deuterium Tank', level: 12 },
      ],
    },
    'Core Research': {
      mode: 'list',
      list: [
        { code: 'EN', id: 113, name: 'Energy Technology', level: 1 },
        { code: 'CD', id: 115, name: 'Combustion Drive', level: 1 },
        { code: 'CD', id: 115, name: 'Combustion Drive', level: 2 },
        { code: 'EP', id: 106, name: 'Espionage Technology', level: 1 },
        { code: 'EP', id: 106, name: 'Espionage Technology', level: 4 },
        { code: 'CT', id: 108, name: 'Computer Technology', level: 1 },
        { code: 'CT', id: 108, name: 'Computer Technology', level: 2 },
        { code: 'ID', id: 117, name: 'Impulse Drive', level: 1 },
        { code: 'ID', id: 117, name: 'Impulse Drive', level: 2 },
        { code: 'ID', id: 117, name: 'Impulse Drive', level: 3 },
        { code: 'AP', id: 124, name: 'Astrophysics', level: 1 },
        { code: 'AP', id: 124, name: 'Astrophysics', level: 3 },
        { code: 'AP', id: 124, name: 'Astrophysics', level: 4 },
        { code: 'CD', id: 115, name: 'Combustion Drive', level: 6 },
        { code: 'ST', id: 110, name: 'Shielding Technology', level: 2 },
        { code: 'ST', id: 110, name: 'Shielding Technology', level: 5 },
        { code: 'HT', id: 114, name: 'Hyperspace Technology', level: 3 },
        { code: 'HD', id: 118, name: 'Hyperspace Drive', level: 2 },
        { code: 'CT', id: 108, name: 'Computer Technology', level: 8 },
        { code: 'HT', id: 114, name: 'Hyperspace Technology', level: 8 },
        { code: 'IRN', id: 123, name: 'Intergalactic Research Network', level: 1 },
        { code: 'EN', id: 113, name: 'Energy Technology', level: 8 },
        { code: 'LT', id: 120, name: 'Laser Technology', level: 10 },
        { code: 'PT', id: 122, name: 'Plasma Technology', level: 1 },
      ],
    },
    "Rock'tal Growth": {
      mode: 'list',
      list: [
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 21 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 23 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 1 },
        { code: 'MEG', id: 12108, name: 'Megalith', level: 3 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 5 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 25 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 27 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 28 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 30 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 31 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 33 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 8 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 37 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 39 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 42 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 44 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 6 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 12 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 6 },
        { code: 'MF', id: 12106, name: 'Magma Forge', level: 20 },
        { code: 'CR', id: 12109, name: 'Crystal Refinery', level: 20 },
        { code: 'DSY', id: 12110, name: 'Deuterium Synthesiser', level: 20 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 8 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 15 },
        { code: 'ME', id: 12101, name: 'Meditation Enclave', level: 50 },
        { code: 'CF', id: 12102, name: 'Crystal Farm', level: 52 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 10 },
        { code: 'MEG', id: 12108, name: 'Megalith', level: 8 },
        { code: 'MEG', id: 12108, name: 'Megalith', level: 10 },
        { code: 'ORI', id: 12105, name: 'Oriktorium', level: 3 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 10 },
        { code: 'RF', id: 12104, name: 'Rune Forge', level: 12 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 15 },
        { code: 'ORI', id: 12105, name: 'Oriktorium', level: 5 },
        { code: 'DC', id: 12107, name: 'Disruption Chamber', level: 20 },
        { code: 'MF', id: 12106, name: 'Magma Forge', level: 25 },
        { code: 'CR', id: 12109, name: 'Crystal Refinery', level: 25 },
        { code: 'DSY', id: 12110, name: 'Deuterium Synthesiser', level: 25 },
        { code: 'RT', id: 12103, name: 'Rune Technologium', level: 20 },
      ],
    },
  };

  // name -> template shape, for every built-in default regardless of which
  // of the two sources above it came from. Shared by seedDefaultTemplates
  // (only fills in what's missing) and resetDefaultTemplates (forces every
  // default back to this content) so the two can't drift out of sync.
  function defaultTemplateEntries() {
    const entries = {};
    for (const name in BuildOrder.PRESETS) entries[name] = { mode: 'list', list: BuildOrder.PRESETS[name] };
    for (const name in CURATED_TEMPLATES) entries[name] = CURATED_TEMPLATES[name];
    return entries;
  }

  // First-run bootstrap: backfills any curated default (BuildOrder.PRESETS
  // plus the hand-verified CURATED_TEMPLATES above) that's missing by name,
  // without touching one that already exists. Deliberately per-name rather
  // than "only if the store is totally empty" - the old all-or-nothing check
  // meant a store that had already auto-seeded Balanced Economy/Rusher once
  // would never pick up newly-added curated templates like these on a later
  // script update. Never overwrites an existing template under the same
  // name (including one the user edited or deliberately deleted - deletion
  // isn't distinguishable from "never existed" here, which matches the old
  // behavior's intent of not fighting the user's own edits).
  function seedDefaultTemplates(store) {
    const existing = store.getTemplates();
    const defaults = defaultTemplateEntries();
    for (const name in defaults) {
      if (!existing[name]) store.saveTemplate(name, defaults[name]);
    }
  }

  // The opposite of seedDefaultTemplates' caution: unconditionally overwrites
  // every built-in template with its shipped content, for when a script
  // update changes a default (like New Colony growing from 22 to 69 steps)
  // and a locally-saved copy from before that update needs to actually pick
  // it up. Names that aren't a built-in default (the user's own saved
  // templates) are left untouched. Returns the list of names reset, so
  // callers can report how many changed.
  function resetDefaultTemplates(store) {
    const defaults = defaultTemplateEntries();
    const names = Object.keys(defaults);
    for (const name of names) store.saveTemplate(name, defaults[name]);
    return names;
  }

  return {
    applyTemplate,
    saveCurrentAsTemplate,
    applyTemplateToAccount,
    saveAccountStateAsTemplate,
    applyTemplateToLifeform,
    saveLifeformStateAsTemplate,
    seedDefaultTemplates,
    resetDefaultTemplates,
    CURATED_TEMPLATES,
  };
});
