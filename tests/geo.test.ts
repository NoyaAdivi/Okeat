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

test('a long walk becomes a drive', () => {
  assert.deepEqual(estimateTrip(800), { mode: 'walk', minutes: 13 });
  assert.equal(estimateTrip(1500).mode, 'drive');
  assert.equal(estimateTrip(3000).mode, 'drive');
  assert.equal(estimateTrip(3000).minutes, 8);
});
