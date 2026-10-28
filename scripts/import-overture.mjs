// Okeat: import more eateries in Israel from Overture Maps (https://overturemaps.org).
//
// Overture is free, open map data put together by Meta, Microsoft, Amazon, Foursquare and others,
// under open licenses (CDLA Permissive 2.0 / Apache 2.0) that allow use in apps like this one.
// It has many places OpenStreetMap is missing, with phone, website and food category.
// It has no opening hours or dietary info; those come from OSM and from the community.
//
// Run after import-osm, so places that are already on the map are skipped, not doubled:
//   npm install @duckdb/node-api        (once)
//   npm run import:overture
// Options: --dry-run (only count), --release 2026-10-21.0, --min-confidence 0.5
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, and migration 0007.

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---------- env / options ----------
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
};
const dryRun = process.argv.includes('--dry-run');
const RELEASE = arg('--release', process.env.OVERTURE_RELEASE ?? '2026-10-21.0');
const MIN_CONF = Number(arg('--min-confidence', '0.5'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dryRun && (!url || !key || key.includes('your-'))) {
  console.error('\nחסר SUPABASE_SERVICE_ROLE_KEY בקובץ .env.local (המפתח הסודי מ-Supabase, שמתחיל ב-sb_secret_).\n');
  process.exit(1);
}

let duck;
try {
  duck = await import('@duckdb/node-api');
} catch {
  console.error('\nצריך להתקין כלי אחד קודם. כתבו:  npm install @duckdb/node-api  ואז הריצו שוב.\n');
  process.exit(1);
}

// ---------- download from Overture (straight from their public storage) ----------
// Israel, by bounding box and country code.
const [W, S, E, N] = [34.2, 29.45, 35.95, 33.35];
const EAT = 'restaurant|cafe|coffee|bakery|pizza|burger|bar$|^bar_|pub|dessert|ice_cream|gelato|food_truck|food_court|deli|bistro|diner|sandwich|juice|smoothie|falafel|shawarma|hummus|sushi|steak|grill|bagel|creperie|waffle|donut|patisserie|cake_shop|chocolat|noodle|ramen|brasserie|tea_room|bubble_tea|snack|kebab|barbecue|eatery';
const NOT_EAT = 'grocery|supermarket|liquor|convenience|wholesale|farm|butcher|beverage_store|wine_store|catering|food_delivery|cooking_school|kitchen_supply|restaurant_equipment|vending|winery|brewery_tour';

const setup = ['INSTALL httpfs', 'LOAD httpfs', "SET s3_region = 'us-west-2'"];
const sql = `
SELECT
  id::VARCHAR                                   AS id,
  names.primary::VARCHAR                        AS name,
  to_json(names.common)::VARCHAR                AS common,
  coalesce(basic_category, taxonomy.primary)::VARCHAR AS cat,
  to_json(taxonomy.hierarchy)::VARCHAR          AS hier,
  websites[1]::VARCHAR                          AS website,
  phones[1]::VARCHAR                            AS phone,
  addresses[1].freeform::VARCHAR                AS street,
  addresses[1].locality::VARCHAR                AS city,
  confidence::DOUBLE                            AS confidence,
  bbox.xmin::DOUBLE                             AS lng,
  bbox.ymin::DOUBLE                             AS lat
FROM read_parquet('s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*', hive_partitioning = 1)
WHERE bbox.xmin BETWEEN ${W} AND ${E} AND bbox.ymin BETWEEN ${S} AND ${N}
  AND addresses[1].country = 'IL'
  AND coalesce(confidence, 1) >= ${MIN_CONF}
  AND coalesce(operating_status::VARCHAR, 'open') <> 'permanently_closed'
  AND names.primary IS NOT NULL
  AND regexp_matches(coalesce(basic_category, taxonomy.primary, '') || ' ' || coalesce(to_json(taxonomy.hierarchy)::VARCHAR, ''), '${EAT}')
  AND NOT regexp_matches(coalesce(basic_category, taxonomy.primary, ''), '${NOT_EAT}')
`;

console.log(`מוריד מקומות אוכל בישראל מ-Overture Maps (גרסה ${RELEASE}). זה יכול לקחת כמה דקות…`);
let raw;
try {
  const db = await duck.DuckDBInstance.create(':memory:');
  const con = await db.connect();
  for (const s of setup) await con.run(s);
  const reader = await con.runAndReadAll(sql);
  raw = reader.getRowObjectsJson ? reader.getRowObjectsJson() : reader.getRowObjects();
} catch (e) {
  console.error('\nההורדה נכשלה:', e.message);
  if (/404|No files found|does not exist/i.test(e.message)) {
    console.error('ייתכן שהגרסה הזאת כבר לא קיימת. הגרסאות מופיעות ב-https://docs.overturemaps.org/release-calendar/');
    console.error('ואז מריצים למשל:  npm run import:overture -- --release 2026-11-18.0');
  }
  process.exit(1);
}

// ---------- categories ----------
const KNOWN = new Set([
  'pizza', 'burger', 'sushi', 'japanese', 'chinese', 'asian', 'indian', 'italian', 'mexican', 'middle_eastern', 'hummus', 'falafel',
  'shawarma', 'meat', 'steak_house', 'fish', 'coffee_shop', 'breakfast', 'sandwich', 'bagel', 'dessert', 'ice_cream', 'bakery',
  'salad', 'juice', 'vegan', 'vegetarian', 'french', 'georgian', 'ethiopian', 'yemeni', 'moroccan', 'american', 'chicken',
]);
const CAT_ALIASES = {
  cafe: 'coffee_shop', coffee_shop: 'coffee_shop', coffee_roastery: 'coffee_shop', tea_room: 'coffee_shop',
  ice_cream_shop: 'ice_cream', gelato: 'ice_cream', frozen_yoghurt_shop: 'ice_cream',
  dessert_shop: 'dessert', cake_shop: 'dessert', patisserie: 'dessert', chocolatier: 'dessert', donut_shop: 'dessert', creperie: 'dessert', waffle: 'dessert',
  steakhouse: 'steak_house', barbecue: 'meat', grill: 'meat', kebab: 'shawarma',
  seafood: 'fish', fish_and_chips: 'fish', bagel_shop: 'bagel', sandwich_shop: 'sandwich', deli: 'sandwich',
  juice_bar: 'juice', smoothie_juice_bar: 'juice', breakfast_and_brunch: 'breakfast', brunch: 'breakfast',
  hamburger: 'burger', burger: 'burger', noodles: 'asian', ramen: 'japanese', thai: 'asian', vietnamese: 'asian', korean: 'asian',
  latin_american: 'mexican', tex_mex: 'mexican', israeli: 'middle_eastern', lebanese: 'middle_eastern', mediterranean: 'middle_eastern',
};
const NAME_RULES = [
  [/פיצ|pizz/i, 'pizza'], [/סושי|sushi/i, 'sushi'], [/בורגר|burger/i, 'burger'], [/שו?ו?ארמה|shawarma/i, 'shawarma'],
  [/פלאפל|falafel/i, 'falafel'], [/חומוס|hummus/i, 'hummus'], [/גלידה|גלידריה|gelat|ice ?cream/i, 'ice_cream'],
  [/מאפ(י|ה)|לחם|bakery|boulanger/i, 'bakery'], [/פסטה|pasta|איטלק|trattoria|italian/i, 'italian'],
  [/נודלס|noodle|ווק|wok|ראמן|ramen|thai|אסיי?את/i, 'asian'], [/קפה|caf[eé]|coffee|espresso/i, 'coffee_shop'],
  [/גריל|grill|סטייק|steak|בשרים|אסאדו/i, 'meat'], [/בייגל|bagel/i, 'bagel'], [/טבעונ|vegan/i, 'vegan'],
];

function cuisineFor(cat, name) {
  const out = new Set();
  if (cat) {
    const base = cat.replace(/_(restaurant|shop|place|bar|house)$/, '');
    const c = CAT_ALIASES[cat] ?? CAT_ALIASES[base] ?? base;
    if (KNOWN.has(c)) out.add(c);
  }
  const fromCat = out.size > 0;
  for (const [re, c] of NAME_RULES) if (re.test(name)) out.add(c);
  return { cuisine: [...out], source: fromCat ? 'overture' : out.size ? 'auto' : null };
}

function placeType(cat, cuisine) {
  const has = (c) => cuisine.includes(c);
  if (has('pizza')) return 'pizza';
  if (has('sushi') || has('japanese')) return 'sushi';
  if (has('hummus') || has('falafel') || has('shawarma') || has('middle_eastern')) return 'hummus';
  if (has('burger') || has('meat') || has('steak_house')) return 'grill';
  if (has('ice_cream')) return 'ice_cream';
  if (has('coffee_shop')) return 'cafe';
  if (has('bakery') || has('dessert')) return 'bakery';
  if (/fast_food|food_truck|food_stand|snack/.test(cat ?? '')) return 'stand';
  return 'restaurant';
}

function claimsFor(name) {
  const out = [];
  if (/טבעונ|vegan/i.test(name)) out.push({ need: 'vegan', level: 'full', source: 'auto' });
  if (/ללא גלוטן|נטול גלוטן|gluten.?free/i.test(name)) out.push({ need: 'gluten_free', level: 'menu', source: 'auto' });
  if (/כשר|kosher|מהדרין|glatt|בד"?ץ/i.test(name)) out.push({ need: 'kosher', level: 'marked', source: 'auto' });
  return out;
}

const cleanUrl = (u) => {
  if (!u) return null;
  const v = u.trim().startsWith('http') ? u.trim() : `https://${u.trim()}`;
  try { return new URL(v).toString().slice(0, 300); } catch { return null; }
};
// "+97231234567" -> "03-1234567"
const cleanPhone = (p) => {
  if (!p) return null;
  const d = p.replace(/[^\d+]/g, '').replace(/^\+972/, '0');
  if (/^05\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (/^0[2-9]\d{7}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return p.slice(0, 40);
};

// ---------- duplicates ----------
const norm = (s) => (s ?? '').toLowerCase().replace(/["'`׳״\-–_.,()&]/g, '').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length >= 3));
const dist = (a, b) => {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * 111320 * k, (a.lat - b.lat) * 110540);
};
const cell = (p) => `${Math.floor(p.lat * 500)}:${Math.floor(p.lng * 500)}`; // ~200 m cells
function makeIndex() {
  const grid = new Map();
  return {
    add(p) { const c = cell(p); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(p); },
    near(p) {
      const [a, b] = cell(p).split(':').map(Number);
      const out = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(`${a + i}:${b + j}`) ?? []));
      return out;
    },
  };
}
/** Same place: same name within 150 m, or a shared word in the name within 40 m. */
function isDuplicate(index, p) {
  const n = norm(p.name);
  const t = tokens(p.name);
  for (const q of index.near(p)) {
    const d = dist(p, q);
    if (d < 150 && (norm(q.name) === n || norm(q.name).includes(n) || n.includes(norm(q.name)))) return true;
    if (d < 40 && [...tokens(q.name)].some((w) => t.has(w))) return true;
  }
  return false;
}

// ---------- build rows ----------
const index = makeIndex();
const sb = dryRun ? null : createClient(url, key, { auth: { persistSession: false } });
if (sb) {
  process.stdout.write('בודק אילו מקומות כבר קיימים באתר…');
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .rpc('map_points', { p_min_kosher: null, p_min_vegan: null, p_min_gluten_free: null, p_query: null })
      .range(from, from + 999);
    if (error) {
      console.error('\nלא הצלחנו לקרוא את המקומות הקיימים:', error.message);
      console.error('ודאו שהרצתם ב-Supabase את 0005_details.sql ואת 0007_more_sources.sql.');
      process.exit(1);
    }
    for (const p of data) index.add({ name: p.name, lat: p.lat, lng: p.lng });
    if (data.length < 1000) break;
  }
  console.log(' סיום.');
}

const rows = [];
let dupes = 0;
const catCount = new Map();
for (const r of raw) {
  let common = {};
  try { common = JSON.parse(r.common ?? 'null') ?? {}; } catch { /* keep empty */ }
  const name = String(common.he ?? r.name ?? '').trim();
  const lat = Number(r.lat), lng = Number(r.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const p = { name, lat, lng };
  if (isDuplicate(index, p)) { dupes++; continue; }
  index.add(p);
  catCount.set(r.cat, (catCount.get(r.cat) ?? 0) + 1);
  const { cuisine, source } = cuisineFor(r.cat, `${name} ${r.name ?? ''}`);
  rows.push({
    place: {
      ext_id: `overture:${r.id}`,
      data_source: 'overture',
      name: name.slice(0, 120),
      place_type: placeType(r.cat, cuisine),
      cuisine: cuisine.length ? cuisine : null,
      cuisine_source: source,
      phone: cleanPhone(r.phone),
      website: cleanUrl(r.website),
      address: [r.street, r.city].filter(Boolean).join(', ').slice(0, 200) || null,
      location: `SRID=4326;POINT(${lng} ${lat})`,
    },
    claims: claimsFor(`${name} ${r.name ?? ''}`),
  });
}

console.log(`\nב-Overture נמצאו ${raw.length} מקומות אוכל בישראל. ${dupes} כבר קיימים באתר, ${rows.length} חדשים.`);
console.log('הסוגים הנפוצים:', [...catCount].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, n]) => `${c} ${n}`).join(', '));
if (dryRun) {
  for (const r of rows.slice(0, 20)) console.log('  ', r.place.name, '|', r.place.cuisine?.join(',') ?? '-', '|', r.place.phone ?? '');
  process.exit(0);
}

// ---------- save ----------
const idByExt = new Map();
for (let i = 0; i < rows.length; i += 500) {
  process.stdout.write(`\rשומר מקומות… ${Math.min(i + 500, rows.length)}/${rows.length}`);
  const { data, error } = await sb
    .from('places')
    .upsert(rows.slice(i, i + 500).map((r) => r.place), { onConflict: 'ext_id' })
    .select('id, ext_id');
  if (error) {
    console.error('\nשמירת המקומות נכשלה:', error.message);
    if (/ext_id|data_source/.test(error.message)) console.error('צריך להריץ קודם ב-Supabase את הקובץ 0007_more_sources.sql');
    process.exit(1);
  }
  for (const p of data) idByExt.set(p.ext_id, p.id);
}

const have = new Set();
const ids = [...idByExt.values()];
for (let i = 0; i < ids.length; i += 150) {
  const { data } = await sb.from('claims').select('place_id, need').in('place_id', ids.slice(i, i + 150));
  for (const c of data ?? []) have.add(`${c.place_id}:${c.need}`);
}
const now = new Date().toISOString();
const newClaims = [];
for (const r of rows) {
  const placeId = idByExt.get(r.place.ext_id);
  for (const c of r.claims) {
    if (!placeId || have.has(`${placeId}:${c.need}`)) continue;
    newClaims.push({ place_id: placeId, need: c.need, level: c.level, status: 'verified', source: c.source, verified_at: now });
  }
}
for (let i = 0; i < newClaims.length; i += 300) {
  const { error } = await sb.from('claims').insert(newClaims.slice(i, i + 300));
  if (error) { console.error('\nשמירת המידע נכשלה:', error.message); process.exit(1); }
}
console.log(`\nנוספו ${idByExt.size} מקומות חדשים. אפשר לרענן את האתר. 🎉\n`);
