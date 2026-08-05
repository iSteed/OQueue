#!/usr/bin/env node
/*
 * Concatenates src/*.js (in dependency order) plus a Tampermonkey metadata
 * block and bootstrap call into the single distributable
 * ogame-build-queue.user.js. No bundler - each src file is a UMD-style module
 * attaching itself to a shared `OQueue` global, so straight concatenation works.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUT_FILE = path.join(__dirname, 'ogame-build-queue.user.js');

// Order matters: each file depends only on ones listed before it.
const FILES = [
  'buildings.js',
  'technologies.js',
  'lifeformBuildings.js',
  'ships.js',
  'formulas.js',
  'buildorder.js',
  'expeditions.js',
  'storage.js',
  'import.js',
  'rules.js',
  'templates.js',
  'panel.js',
  'dom.js',
  'notify.js',
  'cleanup.js',
  'main.js',
];

const REPO_RAW_BASE = 'https://raw.githubusercontent.com/iSteed/OQueue/main';

const METADATA = `// ==UserScript==
// @name         OQueue - OGame Build Queue
// @namespace    https://github.com/iSteed/OQueue
// @version      0.6.0
// @description  Floating build-queue panel for OGame: manual checklist, DOM auto-detection, multi-planet, import, templates, and a rule-based planner.
// @match        https://*.ogame.gameforge.com/game/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @updateURL    ${REPO_RAW_BASE}/ogame-build-queue.user.js
// @downloadURL  ${REPO_RAW_BASE}/ogame-build-queue.user.js
// ==/UserScript==
`;

const BOOTSTRAP = `
(function () {
  'use strict';
  function boot() {
    const app = OQueue.App.createApp();
    app.start();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
`;

function build() {
  // Each src file is already a self-contained UMD module attaching to the
  // shared `OQueue` global, so we just concatenate them - no extra wrapping needed.
  const parts = [METADATA];
  for (const file of FILES) {
    parts.push(`\n// ---- ${file} ` + '-'.repeat(Math.max(0, 60 - file.length)) + '\n');
    parts.push(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'));
  }
  parts.push(BOOTSTRAP);
  fs.writeFileSync(OUT_FILE, parts.join(''));
  console.log(`Wrote ${OUT_FILE}`);
}

build();
