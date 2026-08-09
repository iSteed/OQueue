#!/usr/bin/env node
/*
 * Guards against exactly the bug from 2026-08-09: build.js's hardcoded
 * `// @version` line (the one Tampermonkey compares against @updateURL to
 * decide whether to re-fetch) is a manual bump with nothing enforcing it -
 * three merges to main shipped real changes (New Colony template, Reset
 * built-ins button, Done button removal) under the same 0.8.0 the Merchant
 * relocation had already shipped under, so none of it ever reached an
 * installed copy.
 *
 * Compares the tree being pushed against origin/main's merge-base: if
 * anything under src/ or build.js itself changed but @version didn't move,
 * fail loudly. Only meant to run for pushes that update refs/heads/main -
 * see githooks/pre-push, which filters to that before calling this.
 *
 * Usage: node scripts/check-version-bump.js [<from-ref> [<to-ref>]]
 *   Defaults: from-ref = origin/main, to-ref = HEAD.
 */
'use strict';
const { execFileSync } = require('child_process');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function versionAt(ref) {
  const text = git(['show', `${ref}:build.js`]);
  const match = /^\/\/ @version\s+(\S+)/m.exec(text);
  if (!match) throw new Error(`Could not find "// @version" in build.js at ${ref}`);
  return match[1];
}

function main() {
  const fromRef = process.argv[2] || 'origin/main';
  const toRef = process.argv[3] || 'HEAD';

  let mergeBase;
  try {
    mergeBase = git(['merge-base', fromRef, toRef]);
  } catch (e) {
    // No common history yet (e.g. origin/main not fetched, or a brand new
    // repo) - nothing to compare against, so don't block on it.
    console.log(`check-version-bump: couldn't find a merge-base for ${fromRef}..${toRef}, skipping.`);
    return;
  }

  const changed = git(['diff', '--name-only', mergeBase, toRef])
    .split('\n')
    .filter(Boolean)
    .filter((f) => f === 'build.js' || f.startsWith('src/'));

  if (changed.length === 0) {
    console.log('check-version-bump: no src/ or build.js changes, skipping.');
    return;
  }

  const oldVersion = versionAt(mergeBase);
  const newVersion = versionAt(toRef);

  if (oldVersion === newVersion) {
    console.error(
      `\ncheck-version-bump: src/build.js changed (${changed.length} file(s): ${changed.join(', ')})\n` +
        `but // @version in build.js is still "${oldVersion}".\n\n` +
        `Tampermonkey only re-fetches from @updateURL when @version changes - an\n` +
        `unbumped version means this update silently never reaches anyone who\n` +
        `already has the script installed. Bump // @version in build.js, run\n` +
        `"npm run build", and commit the result before pushing to main.\n`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`check-version-bump: OK (${oldVersion} -> ${newVersion}).`);
}

main();
