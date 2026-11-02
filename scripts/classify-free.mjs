// Okeat: give a food type to places without one, for free, from their name and type.
// Knows common Israeli chains and food words. Saved as automatic, shown as not confirmed.
//   node scripts/classify-free.mjs            (add --dry-run to only count)

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { foodTypes } from './food-rules.mjs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key) { console.error('\nחסר מפתח בקובץ .env.local.\n'); process.exit(1); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });

const todo = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('places').select('id, name, place_type').is('cuisine', null).eq('removed', false).order('id').range(from, from + 999);
  if (error) { console.error('הקריאה נכשלה:', error.message); process.exit(1); }
  todo.push(...data);
  if (data.length < 1000) break;
}
const groups = new Map();
for (const p of todo) {
  const cats = foodTypes(p);
  if (!cats.length) continue;
  const k = cats.join(',');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(p.id);
}
const found = [...groups.values()].reduce((n, ids) => n + ids.length, 0);
console.log(`זוהו ${found} מתוך ${todo.length} מקומות בלי סוג אוכל.`);
if (!process.argv.includes('--dry-run')) {
  for (const [k, ids] of groups) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from('places').update({ cuisine: k.split(','), cuisine_source: 'auto' }).in('id', ids.slice(i, i + 200)).is('cuisine', null);
      if (error) { console.error('השמירה נכשלה:', error.message); process.exit(1); }
    }
  }
  console.log('נשמר.\n');
}
