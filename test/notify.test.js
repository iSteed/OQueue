const test = require('node:test');
const assert = require('node:assert/strict');
const { notifyBuildComplete } = require('../src/notify');

test('notifyBuildComplete builds title/body with next item', () => {
  const { title, body } = notifyBuildComplete('Metal Mine', 'Crystal Mine 8');
  assert.equal(title, 'Metal Mine complete');
  assert.equal(body, 'Next: Crystal Mine 8');
});

test('notifyBuildComplete builds body for empty queue', () => {
  const { body } = notifyBuildComplete('Metal Mine', null);
  assert.equal(body, 'Queue complete');
});
