// Okeat: fix places whose pin is far from their own street address.
// A pin moves only if ALL of these hold: the address has a street number, it is over 20 km from
// the middle of its city's places, the geocoder (Photon, OpenStreetMap) finds that exact house
// number, and the found spot is inside the city. Anything else is left as it is.
// Fixed places are locked, so imports don't move them back. Old and new points go to location-fixes.log.
//
//   node scripts/fix-locations.mjs            (add --dry-run to only show the list)
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, and FIX-WEMEAT-LOCATION.sql.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const dryRun = process.argv.includes('--dry-run');
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

const todo = places.filter((p) => !p.location_locked && center.has(p.city) && /\d/.test(p.street ?? '') && km(p, center.get(p.city)) > 20);
console.log(`${todo.length} מקומות לבדיקה (שנייה לכל מקום)…`);

let fixed = 0;
for (const p of todo) {
  await new Promise((r) => setTimeout(r, 1100));
  let hit = null;
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(`${p.street} ${p.city}`)}&limit=5&bbox=34.2,29.4,35.95,33.4`, { headers: { 'User-Agent': 'okeat-fix-locations/1.0' } });
    const number = p.street.match(/\d+/)[0];
    for (const f of (await res.json()).features ?? []) {
      const point = { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
      if (String(f.properties.housenumber ?? '').replace(/\D.*$/, '') === number && km(point, center.get(p.city)) <= 15) { hit = point; break; }
    }
  } catch { /* skip this one */ }
  if (!hit) { console.log(`  דילוג: ${p.name} | ${p.address}`); continue; }
  console.log(`  תיקון: ${p.name} | ${p.address} (${Math.round(km(p, hit))} ק"מ)`);
  if (dryRun) continue;
  const { error } = await sb.from('places').update({ location: `SRID=4326;POINT(${hit.lng} ${hit.lat})`, location_locked: true }).eq('id', p.id);
  if (error) { console.error('השמירה נכשלה:', error.message); process.exit(1); }
  appendFileSync('location-fixes.log', `${p.id}\t${p.name}\t${p.lat},${p.lng}\t${hit.lat},${hit.lng}\n`);
  fixed++;
}
console.log(`\nתוקנו ${fixed} מקומות מתוך ${todo.length}.\n`);
