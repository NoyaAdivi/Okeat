import assert from 'node:assert/strict';
import { test } from 'node:test';
import { earnedBadges, expiresSoon, isCityName, isStale, parseSearch, textToRanges } from '../src/lib/checks.ts';

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

test('a smart search is split into its parts', () => {
  const s = parseSearch('פיצה כשרה פתוחה עכשיו ברמת גן');
  assert.deepEqual(s.needs, ['kosher']);
  assert.equal(s.openNow, true);
  assert.equal(s.city, 'רמת גן');
  assert.equal(s.rest, 'פיצה');
});

test('a whole sentence keeps only what matters', () => {
  const s = parseSearch('בא לי מסעדה שפתוחה עכשיו');
  assert.equal(s.openNow, true);
  assert.equal(s.rest, '');
  assert.equal(parseSearch('אני מחפש פיצה טובה').rest, 'פיצה');
  assert.equal(parseSearch('מקום טוב').rest, 'מקום טוב');
});

test('a regular word is left alone', () => {
  const s = parseSearch('בורגר');
  assert.deepEqual(s.needs, []);
  assert.equal(s.city, null);
  assert.equal(s.rest, 'בורגר');
});

test('gluten-free is understood in both languages', () => {
  assert.deepEqual(parseSearch('מאפה ללא גלוטן').needs, ['gluten_free']);
  assert.deepEqual(parseSearch('gluten free cake').needs, ['gluten_free']);
});

test('badges are earned by helping', () => {
  assert.deepEqual(earnedBadges({ places_added: 0, info_added: 0, confirmations: 0, reviews: 0 }), []);
  assert.deepEqual(earnedBadges({ places_added: 5, info_added: 0, confirmations: 10, reviews: 0 }), ['confirmer', 'explorer']);
});

test('opening hours can be typed as text', () => {
  assert.deepEqual(textToRanges('8:00-14:00, 17:00-22:30'), [['08:00', '14:00'], ['17:00', '22:30']]);
  assert.deepEqual(textToRanges('סגור'), []);
  assert.equal(textToRanges(''), undefined);
  assert.equal(textToRanges('בוקר'), null);
});
