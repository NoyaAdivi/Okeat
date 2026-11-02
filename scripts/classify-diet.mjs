// Okeat: add vegan, vegetarian and gluten-free information to places that don't have it.
// 1. Rules, free: a fully vegan place is vegetarian, a falafel stand has vegetarian dishes, and so on.
// 2. Claude, only for specific places or chains it knows. Most places stay unknown, on purpose.
// Everything is saved as automatic (source 'auto') and shown as "not confirmed" until people
// confirm it. Kosher and allergies are never guessed here. Anything a person already
// added or rejected is left alone. Safe to run again.
//
//   npm run classify:diet
//   npm run classify:diet -- --dry-run --limit 500      (only shows what it would do)
//   npm run classify:diet -- --no-ai                    (rules only, free)
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
// Run after migration 0008, and after classify.

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { dietRules } from './diet-rules.mjs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const dryRun = process.argv.includes('--dry-run');
const useAi = !process.argv.includes('--no-ai');
const li = process.argv.indexOf('--limit');
const LIMIT = li > -1 ? Number(process.argv[li + 1]) : Infinity;
const MODEL = process.env.CLASSIFY_MODEL ?? 'claude-haiku-5-5';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.includes('your-')) {
  console.error('\nחסר SUPABASE_SERVICE_ROLE_KEY בקובץ .env.local.\n');
  process.exit(1);
}
if (useAi && (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('...'))) {
  console.error('\nחסר ANTHROPIC_API_KEY בקובץ .env.local. אפשר להריץ בלי Claude עם --no-ai.\n');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function readAll(table, columns, build = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select(columns)).order('id').range(from, from + 999);
    if (error) {
      console.error(`קריאה מ-${table} נכשלה:`, error.message);
      if (error.message.includes('removed')) console.error('צריך להריץ קודם ב-Supabase את RUN-ME-2-IN-SUPABASE.sql.');
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// ---------- what we already know ----------
const places = (await readAll('places', 'id, name, place_type, address, cuisine', (q) => q.eq('removed', false))).slice(0, LIMIT);
const known = new Map(); // place id -> { need: level } (any status: a rejected claim is never re-added)
for (const c of await readAll('claims', 'id, place_id, need, level', (q) => q.in('need', ['vegan', 'vegetarian', 'gluten_free']))) {
  if (!known.has(c.place_id)) known.set(c.place_id, {});
  known.get(c.place_id)[c.need] = c.level;
}
console.log(`${places.length} מקומות. בודק מה אפשר להשלים…`);

const newClaims = new Map(); // `${id}:${need}` -> claim
const add = (id, need, level) => {
  if (known.get(id)?.[need] || newClaims.has(`${id}:${need}`)) return;
  newClaims.set(`${id}:${need}`, { place_id: id, need, level });
};
for (const p of places) for (const g of dietRules(p, known.get(p.id))) add(p.id, g.need, g.level);
console.log(`לפי כללים: ${newClaims.size} פרטים חדשים.`);

// ---------- Claude: only places it really knows ----------
const GUESSES = {
  vegan_full: ['vegan', 'full'], vegan_options: ['vegan', 'options'],
  vegetarian_full: ['vegetarian', 'full'], gluten_free_menu: ['gluten_free', 'menu'],
};
if (useAi) {
  const claude = new Anthropic();
  const todo = places.filter((p) => !known.get(p.id)?.vegan && !newClaims.has(`${p.id}:vegan`));
  const BATCH = 120;
  const prompt = (batch) => `Below are eateries in Israel. Mark ONLY places where you specifically know this
place or chain, or where the name states it outright. Never infer from the food type alone. Most places must be left out.
Labels: vegan_full (entirely vegan), vegan_options (known for a vegan menu), vegetarian_full (no meat or fish at all),
gluten_free_menu (known for a gluten-free menu).
Answer with JSON only, listing just the marked places: {"<n>": ["label", ...]}. If none, answer {}.

${batch.map((p, i) => `${i}. ${p.name} | ${p.place_type} | ${p.address ?? ''}`).join('\n')}`;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    process.stdout.write(`\rClaude בודק… ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    let out = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const msg = await claude.messages.create({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt(batch) }] });
        const m = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('').match(/\{[\s\S]*\}/);
        out = m ? JSON.parse(m[0]) : {};
        break;
      } catch (e) {
        if (attempt === 2) console.error('\nדילוג על קבוצה:', e.message);
        else await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
    for (const [n, labels] of Object.entries(out)) {
      const p = batch[Number(n)];
      if (!p || !Array.isArray(labels)) continue;
      for (const l of labels) {
        if (!GUESSES[l]) continue;
        add(p.id, ...GUESSES[l]);
        if (l === 'vegan_full') add(p.id, 'vegetarian', 'full');
        if (l === 'vegan_options') add(p.id, 'vegetarian', 'options');
      }
    }
  }
  console.log('');
}

// ---------- save ----------
const rows = [...newClaims.values()];
const count = rows.reduce((m, r) => { const k = `${r.need} / ${r.level}`; m[k] = (m[k] ?? 0) + 1; return m; }, {});
console.log(`סך הכול ${rows.length} פרטים חדשים:`, count);
if (dryRun) {
  const names = new Map(places.map((p) => [p.id, p.name]));
  for (const r of rows.slice(0, 40)) console.log('  ', names.get(r.place_id), '→', r.need, r.level);
  console.log('זו הייתה בדיקה בלבד. שום דבר לא נשמר.');
  process.exit(0);
}
const now = new Date().toISOString();
for (let i = 0; i < rows.length; i += 300) {
  const { error } = await sb.from('claims').insert(rows.slice(i, i + 300).map((r) => ({ ...r, status: 'verified', source: 'auto', verified_at: now })));
  if (error) { console.error('\nהשמירה נכשלה:', error.message); process.exit(1); }
}
console.log('נשמר. אפשר לרענן את האתר. 🎉\n');
