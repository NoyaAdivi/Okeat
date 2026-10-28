// Okeat: give a food category to places that don't have one yet, using Claude.
// Claude reads the name, type and address of each place (it knows many Israeli chains and
// common words) and picks categories from our list. The result is saved as an automatic
// classification, shown on the site as "not confirmed" until people confirm it.
//
//   npm run classify            (all places without a category)
//   npm run classify -- --dry-run --limit 100
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
// Run after migration 0005. Cost: roughly a few cents per thousand places.

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const dryRun = process.argv.includes('--dry-run');
const li = process.argv.indexOf('--limit');
const LIMIT = li > -1 ? Number(process.argv[li + 1]) : Infinity;
const MODEL = process.env.CLASSIFY_MODEL ?? 'claude-haiku-5-5';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.includes('your-')) {
  console.error('\nחסר SUPABASE_SERVICE_ROLE_KEY בקובץ .env.local.\n');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('...')) {
  console.error('\nחסר ANTHROPIC_API_KEY בקובץ .env.local (המפתח של Claude, שמתחיל ב-sk-ant-).\n');
  process.exit(1);
}

const CATS = {
  pizza: 'פיצה', burger: 'המבורגר', sushi: 'סושי', japanese: 'יפני', chinese: 'סיני', asian: 'אסייתי (תאי, וייטנאמי, נודלס)',
  indian: 'הודי', italian: 'איטלקי', mexican: 'מקסיקני', middle_eastern: 'מזרחי/ישראלי', hummus: 'חומוסייה', falafel: 'פלאפל',
  shawarma: 'שווארמה', meat: 'בשרים וגריל', steak_house: 'סטייקיה', chicken: 'עוף ושניצל', fish: 'דגים ופירות ים',
  coffee_shop: 'בית קפה', breakfast: 'ארוחות בוקר', sandwich: 'כריכים וטוסטים', bagel: 'בייגל', bakery: 'מאפייה',
  dessert: 'קינוחים ועוגות', ice_cream: 'גלידה', salad: 'סלטים', juice: 'מיצים ושייקים', vegan: 'טבעוני', vegetarian: 'צמחוני',
  french: 'צרפתי', georgian: 'גאורגי', ethiopian: 'אתיופי', yemeni: 'תימני', moroccan: 'מרוקאי', american: 'אמריקאי',
};
const KNOWN = new Set(Object.keys(CATS));

const sb = createClient(url, key, { auth: { persistSession: false } });
const claude = new Anthropic();

// ---------- places without a category ----------
const todo = [];
for (let from = 0; todo.length < LIMIT; from += 1000) {
  const { data, error } = await sb.from('places').select('id, name, place_type, address').is('cuisine', null).order('id').range(from, from + 999);
  if (error) {
    console.error('קריאת המקומות נכשלה:', error.message);
    if (error.message.includes('cuisine')) console.error('צריך להריץ קודם ב-Supabase את קובץ העדכון (0005).');
    process.exit(1);
  }
  todo.push(...data);
  if (data.length < 1000) break;
}
todo.splice(LIMIT);
console.log(`${todo.length} מקומות בלי סוג אוכל. מסווג עם Claude…`);
if (todo.length === 0) process.exit(0);

const prompt = (batch) => `You classify eateries in Israel into food categories.
Allowed category keys (key: meaning):
${Object.entries(CATS).map(([k, v]) => `${k}: ${v}`).join('\n')}

For each place below, choose 0 to 3 keys that you are fairly confident about, based on the name
(you may recognise Israeli chains, e.g. "ארומה" = coffee_shop, "בורגרים" = burger, "גרג" = coffee_shop, "שיפודי התקווה" = meat),
the type and the address. If you can't tell, return an empty list. Do not guess wildly.

Answer with JSON only, one object: {"<n>": ["key", ...], ...} using the numbers below.

${batch.map((p, i) => `${i}. ${p.name} | type: ${p.place_type} | ${p.address ?? ''}`).join('\n')}`;

function parse(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

const results = new Map(); // id -> cuisines
const BATCH = 120;
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  process.stdout.write(`\rמסווג… ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  let out = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const msg = await claude.messages.create({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt(batch) }] });
      out = parse(msg.content.map((c) => (c.type === 'text' ? c.text : '')).join(''));
      break;
    } catch (e) {
      if (attempt === 2) { console.error('\nClaude לא ענה:', e.message); process.exit(1); }
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  batch.forEach((p, j) => {
    const cats = [...new Set((out[j] ?? out[String(j)] ?? []).filter((c) => KNOWN.has(c)))].slice(0, 3);
    if (cats.length) results.set(p.id, cats);
  });
}
console.log(`\nClaude סיווג ${results.size} מתוך ${todo.length} מקומות (השאר לא היה ברור מספיק).`);

if (dryRun) {
  for (const p of todo.slice(0, 40)) console.log('  ', p.name, '→', (results.get(p.id) ?? []).map((c) => CATS[c]).join(', ') || '-');
  process.exit(0);
}

// ---------- save, grouped by identical category lists (few big updates instead of thousands) ----------
const groups = new Map();
for (const [id, cats] of results) {
  const k = cats.slice().sort().join(',');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(id);
}
let saved = 0;
for (const [k, ids] of groups) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb.from('places').update({ cuisine: k.split(','), cuisine_source: 'auto' }).in('id', ids.slice(i, i + 200)).is('cuisine', null);
    if (error) { console.error('\nהשמירה נכשלה:', error.message); process.exit(1); }
    saved += Math.min(200, ids.length - i);
  }
}
console.log(`נשמר סיווג ל-${saved} מקומות. אפשר לרענן את האתר. 🎉\n`);
