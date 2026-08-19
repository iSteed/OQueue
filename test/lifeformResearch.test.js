const test = require('node:test');
const assert = require('node:assert/strict');
const { TIERS, ALL_SLOTS, LEGEND, toPanelRows } = require('../src/lifeformResearch');

test('TIERS covers all 18 slots exactly once, in order, across the 3 tiers', () => {
  assert.equal(TIERS.length, 3);
  const slotNumbers = ALL_SLOTS.map((s) => s.slot);
  assert.deepEqual(slotNumbers, Array.from({ length: 18 }, (_, i) => i + 1));
});

test('each tier\'s build order references exactly its own 6 slots', () => {
  TIERS.forEach((t) => {
    const ownSlots = t.slots.map((s) => s.slot).sort((a, b) => a - b);
    const orderSorted = t.order.slice().sort((a, b) => a - b);
    assert.deepEqual(orderSorted, ownSlots);
  });
});

test('every slot has a non-empty pick, lf, and category', () => {
  ALL_SLOTS.forEach((s) => {
    assert.ok(s.pick, `slot ${s.slot} missing pick`);
    assert.ok(s.lf, `slot ${s.slot} missing lf`);
    assert.ok(s.category, `slot ${s.slot} missing category`);
    assert.equal(typeof s.native, 'boolean', `slot ${s.slot} missing native flag`);
  });
});

test('toPanelRows: a legend line, then one heading per tier, each followed by 2 lines per slot', () => {
  const rows = toPanelRows();
  // 1 legend + 3 headings + (18 slots x 2 lines) = 40.
  assert.equal(rows.length, 40);

  assert.equal(rows[0].text, LEGEND);
  assert.equal(rows[1].heading, 'Tier 1 (order: 5→4→2→6→3→1)');
  assert.equal(rows[14].heading, 'Tier 2 (order: 11→8→12→10→7→9)');
  assert.equal(rows[27].heading, 'Tier 3 (order: 18→13→14→15→17→16)');

  // Slot 1's two lines (first slot rows after the Tier 1 heading).
  assert.match(rows[2].text, /^1\. .*Catalyser Technology$/);
  assert.equal(rows[3].text, '↳ Mecha — Deut +0.08%/lvl');
});

test('toPanelRows: non-native picks are starred, native picks are not', () => {
  const rows = toPanelRows();
  const bySlot = (n) => rows.find((r) => r.text && r.text.startsWith(`${n}. `));

  // Slot 3 (High Energy Pump Systems, Rock'tal) is native.
  assert.doesNotMatch(bySlot(3).text, /★/);
  // Slot 1 (Catalyser Technology, Mecha on a Rock'tal-native slot) is not.
  assert.match(bySlot(1).text, /★/);
});
