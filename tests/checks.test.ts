import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expiresSoon, isCityName, isStale } from '../src/lib/checks.ts';

const now = new Date('2026-11-02T12:00:00');

test('information confirmed over a year ago is stale', () => {
  assert.equal(isStale('2025-10-01T10:00:00Z', now), true);
  assert.equal(isStale('2026-06-01T10:00:00Z', now), false);
  assert.equal(isStale(null, now), false);
});

test('a certificate is flagged only in its last month', () => {
  assert.equal(expiresSoon('2026-11-20', now), true);
  assert.equal(expiresSoon('2027-03-01', now), false);
  assert.equal(expiresSoon('2026-10-01', now), false);
});

test('city names match exactly, not by the first letters', () => {
  assert.equal(isCityName('חיפה', 'חיפה'), true);
  assert.equal(isCityName('תל אביב', 'תל אביב-יפו'), true);
  assert.equal(isCityName(' haifa ', 'Haifa'), true);
  assert.equal(isCityName('אור', 'אור יהודה'), false);
  assert.equal(isCityName('פיצה', 'חיפה'), false);
});
