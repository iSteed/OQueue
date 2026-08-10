/*
 * Cosmetic page cleanup: hides premium-upsell nav items and the ad banner,
 * and relocates the Merchant link out of that hidden group into the account
 * header bar. Mostly CSS injection - a single <style> tag added once to
 * <head>, not a DOM removal, so it can't break anything the game's own JS
 * expects to find - plus one small, guarded DOM insertion for Merchant.
 *
 * CONFIRMED (2026-08-05, server s276-en / s275-en):
 *   - Merchant/Recruit Officers/Shop/Rewards nav items: each is an
 *     `<a class="... premiumHighligt ...">` inside an `<li>` under
 *     #menuTable - hiding the `<li>` via :has() removes exactly those four,
 *     since no other nav item carries that class.
 *   - Ad banner: #bannerSkyscrapercomponent, a sibling of #planetbarcomponent
 *     inside #right.
 *   - Account header bar: `#headerBarLinks` holds one `<span>` per link
 *     (Profile, Highscore, Notes, Buddies, Search, Options, Support, Log
 *     out) with no separator markup between them (spacing/dividers are
 *     pure CSS) - so a plain `<span><a>...</a></span>` dropped in front of
 *     the Log out span matches the existing items with no extra styling.
 *     The user asked for Merchant specifically (not Recruit
 *     Officers/Shop/Rewards) moved there, since they still want to use it
 *     despite it being a premium-upsell-styled nav item.
 *
 * CORRECTED (2026-08-10, server s275-en, real page source): the Merchant
 * `<a class="menubutton premiumHighligt ...">` under #menuTable actually
 * has `href=".../index.php?page=ingame&component=trader"` - the original
 * selector below looked for `component=traderOverview` instead, which is
 * the CSS class (`menuImage traderOverview`) on a *different*, smaller
 * icon-link next to it, not a URL parameter that ever existed. That typo
 * meant relocateMerchantLink's querySelector always missed and silently
 * no-op'd (by design, for accounts where the item genuinely isn't there -
 * indistinguishable from "selector is just wrong" without live HTML,
 * which is what it took to catch this).
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
  const HEADER_MERCHANT_ID = 'oqueue-header-merchant';
  const CSS = [
    '#menuTable li:has(a.premiumHighligt) { display: none !important; }',
    '#bannerSkyscrapercomponent { display: none !important; }',
  ].join('\n');

  // Merchant's sidebar entry stays hidden by the CSS above along with the
  // other three premium items - this just gives it a second, visible way in
  // via the header bar rather than un-hiding the sidebar one in place.
  function relocateMerchantLink(doc) {
    if (doc.getElementById(HEADER_MERCHANT_ID)) return;
    const headerLinks = doc.getElementById('headerBarLinks');
    if (!headerLinks) return;
    const merchantLink = doc.querySelector('#menuTable a.premiumHighligt[href*="component=trader"]');
    if (!merchantLink) return;
    const logoutSpan = Array.from(headerLinks.children).find((span) => /log ?out/i.test(span.textContent));
    if (!logoutSpan) return;

    const span = doc.createElement('span');
    span.id = HEADER_MERCHANT_ID;
    const link = doc.createElement('a');
    link.href = merchantLink.href;
    link.textContent = 'Merchant';
    span.appendChild(link);

    headerLinks.insertBefore(span, logoutSpan);
  }

  // Idempotent - safe to call every time the app starts, only inserts once
  // per document (a fresh page load gets a fresh document anyway).
  function apply(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(style);
    }
    relocateMerchantLink(doc);
  }

  return { apply, CSS, STYLE_ID, HEADER_MERCHANT_ID };
});
