// Okeat: suggest better pins for places far from their own street address, for a person to review.
//   node scripts/fix-locations.mjs            writes location-review.log, changes nothing
//   node scripts/fix-locations.mjs --apply    saves the rows left in location-review.log, and locks them
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key) { console.error('\nחסר מפתח בקובץ .env.local.\n'); process.exit(1); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });

/** A PostGIS point comes back as hex EWKB: 9 header bytes, then x and y. */
export function pointOf(hex) {
  const b = Buffer.from(hex, 'hex');
  return { lng: b.readDoubleLE(9), lat: b.readDoubleLE(17) };
}
const km = (a, b) => Math.hypot((a.lng - b.lng) * 111.32 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110.54);
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('places').select('id, name, address, location, location_locked').eq('removed', false).order('id').range(from, from + 999);
  if (error) { console.error('הקריאה נכשלה:', error.message); process.exit(1); }
  rows.push(...data);
  if (data.length < 1000) break;
}
const places = rows.map((p) => {
  const parts = (p.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { ...p, ...pointOf(p.location), city: parts.length ? parts[parts.length - 1] : null, street: parts.length > 1 ? parts[0] : null };
});
const byCity = new Map();
for (const p of places) if (p.city?.length >= 4) (byCity.get(p.city) ?? byCity.set(p.city, []).get(p.city)).push(p);
const center = new Map();
for (const [c, list] of byCity) if (list.length >= 5) center.set(c, { lat: median(list.map((p) => p.lat)), lng: median(list.map((p) => p.lng)) });

const REVIEW_FILE = 'location-review.log';
const LIMIT_KM = 12;

if (process.argv.includes('--apply')) {
  // Saves the rows of the reviewed list. Row: id, name, address, old point, new point, km, how found.
  const rows = readFileSync(REVIEW_FILE, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
  let saved = 0;
  for (const [id, name, , old, next] of rows) {
    const [lat, lng] = next.split(',').map(Number);
    const { error } = await sb.from('places').update({ location: `SRID=4326;POINT(${lng} ${lat})`, location_locked: true }).eq('id', id).eq('location_locked', false);
    if (error) { console.error('השמירה נכשלה:', error.message); process.exit(1); }
    appendFileSync('location-fixes.log', `${id}\t${name}\t${old}\t${next}\n`);
    saved++;
  }
  console.log(`\nנשמרו ${saved} מיקומים.\n`);
  process.exit(0);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const normal = (t) => (t ?? '').replace(/[\s\-–־]/g, '');
const cities = [...center.keys()];
const mentionsOtherCity = (p) => cities.some((c) => c !== p.city && normal(c).length >= 4 && normal(p.name).includes(normal(c)) && !normal(p.city).includes(normal(c)));
const NOT_CITY = /(השרון|מגדל|אזור|שלומי|חיפה$)/;

async function photon(p, number) {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(`${p.street} ${p.city}`)}&limit=5&bbox=34.2,29.4,35.95,33.4`, { headers: { 'User-Agent': 'okeat-fix-locations/1.0' } });
  for (const f of (await res.json()).features ?? []) {
    if (String(f.properties.housenumber ?? '').replace(/\D.*$/, '') === number) return { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], how: 'house' };
  }
  return null;
}
async function nominatim(p) {
  const q = new URLSearchParams({ street: p.street, city: p.city, countrycodes: 'il', format: 'jsonv2', limit: '3', addressdetails: '1' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'User-Agent': 'okeat-fix-locations/1.0 (okeat.vercel.app)', 'Accept-Language': 'he' } });
  const number = p.street.match(/\d+/)?.[0];
  for (const r of (await res.json()) ?? []) {
    if (String(r.address?.house_number ?? '').replace(/\D.*$/, '') === number) return { lat: Number(r.lat), lng: Number(r.lon), how: 'house' };
    if (r.address?.road) return { lat: Number(r.lat), lng: Number(r.lon), how: 'street' };
  }
  return null;
}

const todo = places.filter((p) => !p.location_locked && center.has(p.city) && /\d/.test(p.street ?? '') && km(p, center.get(p.city)) > LIMIT_KM);
console.log(`${todo.length} מקומות לבדיקה (כ-2 שניות לכל מקום)…`);
writeFileSync(REVIEW_FILE, '');
let found = 0;
for (const p of todo) {
  if (mentionsOtherCity(p) && !NOT_CITY.test(p.name)) { console.log(`  דילוג, השם מזכיר עיר אחרת: ${p.name} | ${p.address}`); continue; }
  let hit = null;
  try {
    await wait(1100);
    hit = await photon(p, p.street.match(/\d+/)[0]);
    if (!hit) { await wait(1100); hit = await nominatim(p); }
  } catch { /* skip this one */ }
  if (!hit || km(hit, center.get(p.city)) > 15) { console.log(`  לא נמצא: ${p.name} | ${p.address}`); continue; }
  const moved = km(p, hit);
  if (moved < 1) continue;
  console.log(`  מוצע: ${p.name} | ${p.address} (${Math.round(moved)} ק"מ)`);
  appendFileSync(REVIEW_FILE, [p.id, p.name.replace(/\s+/g, ' '), p.address, `${p.lat},${p.lng}`, `${hit.lat},${hit.lng}`, moved.toFixed(1), hit.how].join('\t') + '\n');
  found++;
}
console.log(`\nנמצאו ${found} הצעות מתוך ${todo.length}. שום דבר עוד לא השתנה. שלחי את הקובץ ${REVIEW_FILE}.\n`);
