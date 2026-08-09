/*
 * Floating panel UI. Renders into a Shadow DOM host so OGame's page styles
 * can't bleed in and vice versa. No framework - plain DOM + template strings.
 *
 * Usage:
 *   const panel = OQueue.Panel.createPanel(document);
 *   panel.mount(document.body);
 *   panel.render(viewModel);
 *
 * viewModel shape:
 *   {
 *     title: string,            // header text, e.g. "Colony Queue - <planet>" or "Research Queue"
 *     mode: 'list' | 'rule',
 *     doneItems: [{ label }],
 *     current: { label } | null,
 *     upcoming: [{ label }],
 *     editText: string,        // current raw text for the Edit textarea
 *     templates: string[],     // known template names
 *     toast: string | null,    // transient message, e.g. "Metal Mine complete"
 *   }
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Panel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STYLES = `
    :host { all: initial; }
    .panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 240px;
      background: #1b1f24;
      color: #e6e6e6;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border: 1px solid #3a4048;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      z-index: 999999;
      user-select: none;
    }
    .header {
      padding: 6px 10px;
      background: #262b31;
      border-bottom: 1px solid #3a4048;
      border-radius: 6px 6px 0 0;
      font-weight: 600;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .body { padding: 8px 10px; max-height: 320px; overflow-y: auto; }
    .done { color: #6fbf73; margin: 2px 0; }
    .more-done { color: #6a7078; font-style: italic; margin: 2px 0 4px; }
    .current { color: #ffd479; margin: 6px 0; font-weight: 600; }
    .upcoming-label { margin-top: 8px; color: #9aa4af; font-weight: 600; }
    .upcoming { margin: 2px 0; color: #cfd6dc; }
    .toast {
      margin-top: 6px;
      padding: 4px 6px;
      background: #2f3a2f;
      border: 1px solid #4a6a4a;
      border-radius: 4px;
      color: #bfe6bf;
    }
    .actions { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid #3a4048; flex-wrap: wrap; }
    button {
      flex: 1 1 auto;
      background: #323a42;
      color: #e6e6e6;
      border: 1px solid #454e57;
      border-radius: 4px;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 11px;
    }
    button:hover { background: #3d4650; }
    textarea {
      width: 100%;
      box-sizing: border-box;
      background: #12151a;
      color: #e6e6e6;
      border: 1px solid #3a4048;
      border-radius: 4px;
      font: 11px/1.3 monospace;
      min-height: 100px;
    }
    select { width: 100%; margin-bottom: 6px; }
    .close { cursor: pointer; opacity: 0.7; }
    .close:hover { opacity: 1; }
    .hidden { display: none; }
  `;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function createPanel(doc) {
    doc = doc || document;
    const host = doc.createElement('div');
    host.id = 'oqueue-panel-host';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = doc.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const listeners = {};
    function emit(name, payload) {
      (listeners[name] || []).forEach((fn) => fn(payload));
    }
    function on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    }

    const root = el('div', { class: 'panel' });
    shadow.appendChild(root);

    let editMode = false;
    let lastViewModel = null;
    let lastRenderKey = null;

    function makeDragHandlers(headerEl, panelEl) {
      let dragging = false;
      let offsetX = 0;
      let offsetY = 0;
      headerEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('close')) return;
        dragging = true;
        const rect = panelEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      });
      doc.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        panelEl.style.left = `${e.clientX - offsetX}px`;
        panelEl.style.top = `${e.clientY - offsetY}px`;
        panelEl.style.right = 'auto';
      });
      doc.addEventListener('mouseup', () => { dragging = false; });
    }

    function renderChrome(vm, body) {
      // Preserve scroll position across a rebuild - the body is torn down
      // and recreated below, which would otherwise snap an in-progress
      // scroll back to the top every time.
      const prevBody = root.querySelector('.body');
      const scrollTop = prevBody ? prevBody.scrollTop : 0;

      root.innerHTML = '';
      const header = el('div', { class: 'header' }, [
        el('span', { text: vm.title || 'Colony Queue' }),
        el('span', { class: 'close', text: '✕' }),
      ]);
      header.lastChild.addEventListener('click', () => emit('close'));
      root.appendChild(header);
      makeDragHandlers(header, root);
      root.appendChild(body);
      body.scrollTop = scrollTop;
    }

    // Builds the edit view once, on entry - never rebuilt by a background
    // render() call, so a poll tick mid-typing/pasting can't wipe it out.
    function renderEditMode(vm) {
      const body = el('div', { class: 'body' });
      const textarea = el('textarea');
      textarea.value = vm.editText || '';
      body.appendChild(textarea);
      const saveRow = el('div', { class: 'actions' }, [
        el('button', { text: 'Save' }),
        el('button', { text: 'Cancel' }),
      ]);
      saveRow.children[0].addEventListener('click', () => {
        editMode = false;
        lastRenderKey = null;
        emit('importSave', textarea.value);
      });
      saveRow.children[1].addEventListener('click', () => {
        editMode = false;
        lastRenderKey = null;
        render(lastViewModel);
      });
      body.appendChild(saveRow);
      renderChrome(vm, body);
    }

    function render(vm) {
      lastViewModel = vm;
      // Skip re-rendering while the user is actively editing - nothing in the
      // edit view depends on live data, and rebuilding it on every poll tick
      // would wipe out whatever they're mid-typing/pasting.
      if (editMode) return;

      // The construction-box MutationObserver fires on every countdown tick
      // (roughly once a second) even though the queue itself hasn't changed.
      // Rebuilding the whole panel on each of those calls would reset scroll
      // position and interrupt clicks/selection, so skip the rebuild when the
      // view model is identical to what's already on screen.
      const renderKey = JSON.stringify(vm);
      if (renderKey === lastRenderKey) return;
      lastRenderKey = renderKey;

      const body = el('div', { class: 'body' });

      // Fleet/Highscore pages aren't queue pages - no done/current/upcoming
      // list, no templates, no Edit/Save buttons. Just an advisory line (or
      // status message) and whatever toast is pending.
      if (vm.showQueue === false) {
        if (vm.expeditionAdvisory) {
          const a = vm.expeditionAdvisory;
          const slotWord = a.freeSlots === 1 ? 'slot' : 'slots';
          if (a.ready) {
            body.appendChild(
              el('div', { class: 'current', text: `🚀 Launch expedition (${a.freeSlots}/${a.maxSlots} ${slotWord} free)` })
            );
            if (a.suggestion) {
              body.appendChild(el('div', { class: 'upcoming', text: a.suggestion }));
            }
          } else {
            body.appendChild(
              el('div', { class: 'upcoming-label', text: `${a.freeSlots}/${a.maxSlots} ${slotWord} free` })
            );
            body.appendChild(el('div', { class: 'upcoming', text: `Still need: ${a.missing.join(', ')}` }));
          }
        } else if (vm.statusMessage) {
          body.appendChild(el('div', { class: 'upcoming', text: vm.statusMessage }));
        }
        if (vm.toast) {
          body.appendChild(el('div', { class: 'toast', text: vm.toast }));
        }
        renderChrome(vm, body);
        return;
      }

      if (vm.moreDoneCount) {
        body.appendChild(el('div', { class: 'more-done', text: `+${vm.moreDoneCount} earlier` }));
      }
      (vm.doneItems || []).forEach((item) => {
        body.appendChild(el('div', { class: 'done', text: `✓ ${item.label}` }));
      });

      if (vm.current) {
        body.appendChild(el('div', { class: 'current', text: `➡ ${vm.current.label}` }));
      } else {
        body.appendChild(el('div', { class: 'current', text: 'Queue complete' }));
      }

      if ((vm.upcoming || []).length) {
        body.appendChild(el('div', { class: 'upcoming-label', text: 'Next' }));
        vm.upcoming.forEach((item) => {
          body.appendChild(el('div', { class: 'upcoming', text: item.label }));
        });
      }

      if (vm.toast) {
        body.appendChild(el('div', { class: 'toast', text: vm.toast }));
      }

      if ((vm.templates || []).length) {
        const select = el('select');
        select.appendChild(el('option', { value: '', text: 'Apply template...' }));
        vm.templates.forEach((name) => select.appendChild(el('option', { value: name, text: name })));
        select.addEventListener('change', () => {
          if (select.value) emit('applyTemplate', select.value);
          select.value = '';
        });
        // Resets any built-in template (Balanced Economy, New Colony, etc.)
        // back to its shipped content, overwriting a locally-saved copy that
        // predates a script update - the only way to pick up a changed
        // default otherwise is to know its new content and re-save it by
        // hand. No-op for templates you made up yourself (not a default).
        const resetBtn = el('button', { text: '↻ Reset built-ins', title: 'Reset built-in templates to their shipped defaults' });
        resetBtn.addEventListener('click', () => emit('resetTemplates'));
        body.appendChild(el('div', { class: 'actions' }, [select, resetBtn]));
      }

      const actions = el('div', { class: 'actions' }, [
        el('button', { text: 'Edit' }),
        el('button', { text: 'Save as Template' }),
      ]);
      actions.children[0].addEventListener('click', () => {
        editMode = true;
        renderEditMode(vm);
      });
      actions.children[1].addEventListener('click', () => {
        const name = prompt('Template name?');
        if (name) emit('saveTemplate', name);
      });
      body.appendChild(actions);

      renderChrome(vm, body);
    }

    return {
      host,
      // Removes any stray '#oqueue-panel-host' left behind by another script
      // instance before mounting this one - guards against exactly the
      // failure mode seen when two Tampermonkey copies of OQueue end up
      // installed at once (e.g. a @namespace change on update) and both
      // inject a panel into the same page, stacking two independent
      // instances (one stale/broken) on top of each other.
      mount(parent) {
        parent = parent || doc.body;
        const stray = parent.querySelector(`#${host.id}`);
        if (stray && stray !== host) stray.remove();
        parent.appendChild(host);
      },
      unmount() { if (host.parentNode) host.parentNode.removeChild(host); },
      render,
      on,
    };
  }

  return { createPanel };
});
