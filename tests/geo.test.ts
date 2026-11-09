import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateTrip, formatDate, haversine } from '../src/lib/geo.ts';

test('distance from a point to itself is zero', () => {
  const p = { lat: 32.08, lng: 34.78 };
  assert.equal(haversine(p, p), 0);
});

test('Tel Aviv to Haifa is about 80 km', () => {
  const km = haversine({ lat: 32.0853, lng: 34.7818 }, { lat: 32.794, lng: 34.9896 }) / 1000;
  assert.ok(km > 75 && km < 90, `got ${km}`);
});

test('dates are written day first', () => {
  assert.match(formatDate('2026-11-02'), /^0?2[./]/);
});

test('close places show the walk, then both, then the drive', () => {
  assert.deepEqual(estimateTrip(300), { walk: 5, drive: null });
  assert.deepEqual(estimateTrip(1000), { walk: 16, drive: 5 });
  assert.deepEqual(estimateTrip(3000), { walk: null, drive: 11 });
  assert.equal(estimateTrip(19000).drive, 34);
  assert.equal(estimateTrip(60000).drive, 73);
});

test('a trip longer than an hour is said in hours and minutes, then days, then months', async () => {
  const { formatDuration } = await import('../src/lib/geo.ts');
  assert.equal(formatDuration(45), '45 דקות');
  assert.equal(formatDuration(1), 'דקה');
  assert.equal(formatDuration(60), 'שעה');
  assert.equal(formatDuration(65), 'שעה ו־5 דקות');
  assert.equal(formatDuration(120), 'שעתיים');
  assert.equal(formatDuration(261), '4 שעות ו־21 דקות');
  assert.equal(formatDuration(1439), '23 שעות ו־59 דקות');
  assert.equal(formatDuration(1440), 'יום');
  assert.equal(formatDuration(1440 + 180), 'יום ו־3 שעות');
  assert.equal(formatDuration(2 * 1440 + 1435), '3 ימים');
  assert.equal(formatDuration(30 * 1440), 'חודש');
  assert.equal(formatDuration(64 * 1440), 'חודשיים ו־4 ימים');
  assert.equal(formatDuration(261, 'en'), '4 hr 21 min');
  assert.equal(formatDuration(1440 * 3, 'en'), '3 days');
});
