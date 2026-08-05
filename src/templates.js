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

  // First-run bootstrap only: if the store has zero templates, seed the
  // curated presets so a fresh install has something usable in the dropdown.
  // Never overwrites - if the user already has any templates (including
  // having deleted one), this does nothing.
  function seedDefaultTemplates(store) {
    if (Object.keys(store.getTemplates()).length > 0) return;
    for (const name in BuildOrder.PRESETS) {
      store.saveTemplate(name, { mode: 'list', list: BuildOrder.PRESETS[name] });
    }
  }

  return {
    applyTemplate,
    saveCurrentAsTemplate,
    applyTemplateToAccount,
    saveAccountStateAsTemplate,
    seedDefaultTemplates,
  };
});
