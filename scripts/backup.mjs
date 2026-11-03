// Saves the site's tables as JSON files in the backups folder, on this computer only.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// The folder is ignored by Git: these files hold private data and must never go online.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('\nחסרים NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY בקובץ .env.local\n');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const TABLES = ['places', 'claims', 'claim_votes', 'kosher_certificates', 'profiles', 'reviews', 'favorites', 'place_photos',
  'place_reports', 'owner_requests', 'feedback', 'lists', 'list_places', 'admin_log'];

const folder = `backups/${new Date().toISOString().slice(0, 10)}`;
mkdirSync(folder, { recursive: true });
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) { console.error(`${table}: ${error.message}`); break; }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  writeFileSync(`${folder}/${table}.json`, JSON.stringify(rows));
  console.log(`${table}: ${rows.length}`);
}
console.log(`\nהגיבוי נשמר בתיקייה ${folder}\n`);
