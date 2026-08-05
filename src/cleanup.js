/*
 * Cosmetic page cleanup: hides premium-upsell nav items and the ad banner.
 * Pure CSS injection - a single <style> tag added once to <head>, not a DOM
 * removal, so it can't break anything the game's own JS expects to find.
 *
 * CONFIRMED (2026-08-05, server s276-en):
 *   - Merchant/Recruit Officers/Shop/Rewards nav items: each is an
 *     `<a class="... premiumHighligt ...">` inside an `<li>` under
 *     #menuTable - hiding the `<li>` via :has() removes exactly those four,
 *     since no other nav item carries that class.
 *   - Ad banner: #bannerSkyscrapercomponent, a sibling of #planetbarcomponent
 *     inside #right.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Cleanup = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STYLE_ID = 'oqueue-cleanup-style';
  const CSS = [
    '#menuTable li:has(a.premiumHighligt) { display: none !important; }',
    '#bannerSkyscrapercomponent { display: none !important; }',
  ].join('\n');

  // Idempotent - safe to call every time the app starts, only inserts once
  // per document (a fresh page load gets a fresh document anyway).
  function apply(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  return { apply, CSS, STYLE_ID };
});
