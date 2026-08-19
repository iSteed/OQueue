/*
 * The 18 lifeform research slots' assignment map - straight transcription of
 * BuildOrder.md section 6, not live-verified DOM data. Read-only reference
 * for the Lifeform Development page (component=lfresearch): OQueue doesn't
 * track slot picks as a queue (they're one-time choices, not a sequential
 * build order), so this just renders the guide's plan for all 18 slots at
 * once so it's visible without leaving the page.
 *
 * `native: false` means the pick isn't the slot's own species' default
 * option (BuildOrder.md's "Bold = non-native, may need artefacts").
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.LifeformResearch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TIERS = [
    {
      tier: 1,
      order: [5, 4, 2, 6, 3, 1],
      slots: [
        { slot: 1, pick: 'Catalyser Technology', lf: 'Mecha', category: 'Deut +0.08%/lvl', native: false },
        { slot: 2, pick: 'High-Performance Extractors', lf: 'Humans', category: 'All-res +0.06%/lvl', native: false },
        { slot: 3, pick: 'High Energy Pump Systems', lf: "Rock'tal", category: 'Deut', native: true },
        { slot: 4, pick: 'Telekinetic Tractor Beam', lf: 'Kaelesh', category: 'Expo fleet finds +0.2%/lvl', native: false },
        { slot: 5, pick: 'Enhanced Sensor Technology', lf: 'Kaelesh', category: 'Expo res finds +0.2%/lvl', native: false },
        { slot: 6, pick: 'Automated Transport Lines', lf: 'Mecha', category: 'All-res +0.06%/lvl', native: false },
      ],
    },
    {
      tier: 2,
      order: [11, 8, 12, 10, 7, 9],
      slots: [
        { slot: 7, pick: 'Depth Sounding', lf: "Rock'tal", category: 'Metal +0.06%/lvl', native: true },
        { slot: 8, pick: 'Enhanced Production Technologies', lf: 'Humans', category: 'All-res +0.06%/lvl', native: false },
        { slot: 9, pick: 'Improved Stellarator', lf: "Rock'tal", category: 'Low value', native: true },
        { slot: 10, pick: 'Hardened Diamond Drill Heads', lf: "Rock'tal", category: 'Metal +0.08%/lvl', native: true },
        { slot: 11, pick: 'Sixth Sense', lf: 'Kaelesh', category: 'Expo res finds +0.2%/lvl', native: false },
        { slot: 12, pick: 'Psychoharmoniser', lf: 'Kaelesh', category: 'All-res +0.06%/lvl', native: false },
      ],
    },
    {
      tier: 3,
      order: [18, 13, 14, 15, 17, 16],
      slots: [
        { slot: 13, pick: 'Artificial Swarm Intelligence', lf: 'Mecha', category: 'All-res +0.06%/lvl', native: false },
        { slot: 14, pick: 'Overclocking: Large Cargo', lf: 'Kaelesh', category: 'LC stats', native: false },
        { slot: 15, pick: 'Gravitation Sensors', lf: 'Kaelesh', category: 'Expo DM finds +0.1%/lvl', native: false },
        { slot: 16, pick: 'Obsidian Shield Reinforcement', lf: "Rock'tal", category: 'Defence +0.5%/lvl', native: true },
        { slot: 17, pick: 'Robot Assistants', lf: 'Humans', category: 'Research time −0.2%/lvl (cap 99%)', native: false },
        { slot: 18, pick: 'Kaelesh Discoverer Enhancement', lf: 'Kaelesh', category: 'Discoverer class bonus +0.2%/lvl', native: false },
      ],
    },
  ];

  // Flat 1-18 list, for callers that don't care about tier grouping.
  const ALL_SLOTS = TIERS.reduce((acc, t) => acc.concat(t.slots), []);

  const LEGEND =
    '★ non-native: accept if it rolls free; spend artefacts only if it never does (T1 200 / T2 400 / T3 600 - BuildOrder.md §6)';

  // Renders the whole map into panel rows: a legend line, then per tier a
  // heading (with its build order) followed by two lines per slot - the
  // pick's name, then an indented "species — category" line - rather than
  // one long run-on line. The panel is a fixed 240px wide, and cramming
  // slot + star + pick + species + category onto a single line wrapped
  // wherever the browser felt like it, mid-datum, which read as a jumble;
  // splitting at the name/details boundary wraps (if it wraps at all) at a
  // sane point instead. Non-native picks starred to match the doc's "Bold =
  // non-native, may need artefacts" convention (plain text in the panel has
  // no bold, so a star stands in for it).
  //   [{ heading: string } | { text: string }, ...]
  function toPanelRows() {
    const rows = [{ text: LEGEND }];
    TIERS.forEach((t) => {
      rows.push({ heading: `Tier ${t.tier} (order: ${t.order.join('→')})` });
      t.slots.forEach((s) => {
        const star = s.native ? '' : '★';
        rows.push({ text: `${s.slot}. ${star}${s.pick}` });
        rows.push({ text: `↳ ${s.lf} — ${s.category}` });
      });
    });
    return rows;
  }

  return { TIERS, ALL_SLOTS, LEGEND, toPanelRows };
});
