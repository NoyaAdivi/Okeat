#!/usr/bin/env node
// Fill the map with real places from OpenStreetMap.
//
//   npm run import:osm                 (every eatery in Israel)
//   npm run import:osm -- --dry-run    (only print what it found)
//   npm run import:osm -- --bbox 32.06,34.77,32.10,34.84   (south,west,north,east)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
//
// Every restaurant, cafe, fast-food place, ice cream shop and bakery is imported, so the
// map isn't empty. Most have no dietary information yet; people can add it on the site.
// Where OSM has dietary tags, they're imported too, shown and labelled "from OpenStreetMap",
// so people know nobody from the community has confirmed it yet:
// * diet:vegan / diet:gluten_free  -> vegan / gluten-free claims
// * diet:kosher                    -> kosher level "marked" (no certificate photo)
// Re-running is safe: places match on osm_id and existing claims are kept.

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---------- env ----------
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && (!url || !key || key.includes('your-'))) {
  console.error('\nחסר SUPABASE_SERVICE_ROLE_KEY בקובץ .env.local (המפתח הסודי מ-Supabase, שמתחיל ב-sb_secret_).\n');
  process.exit(1);
}

// Default: all of Israel (by country boundary). --bbox south,west,north,east limits it.
const argIdx = process.argv.indexOf('--bbox');
const bbox = argIdx > -1 ? process.argv[argIdx + 1] : null;
const scope = bbox ? `(${bbox})` : '(area.il)';
const header = bbox ? '' : 'area["ISO3166-1"="IL"][admin_level=2]->.il;';

// ---------- Overpass ----------
const AM = 'restaurant|cafe|fast_food|ice_cream|bakery|food_court';
const SHOP = 'bakery|pastry|deli|confectionery';
// Also: pubs and beer gardens, and bars that serve food. A place counts if it has a name in any
// language (name, name:he, name:en, name:ar).
const NAMED = ['name', 'name:he', 'name:en', 'name:ar'];
const sel = (base) => NAMED.map((n) => `  nwr${base}["${n}"]${scope};`).join('\n');
const query = `[out:json][timeout:900];${header}(
${sel(`["amenity"~"^(${AM}|pub|biergarten)$"]`)}
${sel(`["shop"~"^(${SHOP})$"]`)}
${sel('["amenity"="bar"]["food"~"^(yes|only)$"]')}
);out center tags;`;

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function overpass() {
  for (const s of SERVERS) {
    try {
      console.log(`מוריד מקומות מ-OpenStreetMap (${new URL(s).host})…`);
      const res = await fetch(s, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'okeat-import/1.0' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(620_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).elements;
    } catch (e) {
      console.log(`  לא הצליח (${e.message}), מנסה שרת אחר…`);
    }
  }
  console.error('\nאף שרת של OpenStreetMap לא ענה. נסו שוב בעוד כמה דקות.\n');
  process.exit(1);
}

// ---------- OSM -> our model ----------
const osmId = (el) => el.id * 10 + ({ node: 0, way: 1, relation: 2 }[el.type] ?? 9);

// ---------- food categories ----------
// OSM cuisine values we keep, after folding synonyms.
const CUISINE_ALIASES = {
  coffee: 'coffee_shop', cafe: 'coffee_shop', 'coffee shop': 'coffee_shop',
  burgers: 'burger', hamburger: 'burger', steak: 'steak_house', grill: 'meat', barbecue: 'meat', bbq: 'meat', kebab: 'middle_eastern',
  israeli: 'middle_eastern', arab: 'middle_eastern', lebanese: 'middle_eastern', mediterranean: 'middle_eastern', turkish: 'middle_eastern',
  shawarma: 'shawarma', falafel: 'falafel', hummus: 'hummus', ice_cream: 'ice_cream', gelato: 'ice_cream', frozen_yogurt: 'ice_cream',
  pastry: 'dessert', cake: 'dessert', donut: 'dessert', chocolate: 'dessert', crepe: 'dessert', waffle: 'dessert',
  seafood: 'fish', sandwiches: 'sandwich', bagels: 'bagel', noodle: 'asian', ramen: 'japanese', thai: 'asian', vietnamese: 'asian', wok: 'asian',
  tex_mex: 'mexican', tacos: 'mexican', juice: 'juice', smoothie: 'juice', bubble_tea: 'juice',
};
const KNOWN_CUISINES = new Set([
  'pizza', 'burger', 'sushi', 'japanese', 'chinese', 'asian', 'indian', 'italian', 'mexican', 'middle_eastern', 'hummus', 'falafel',
  'shawarma', 'meat', 'steak_house', 'fish', 'coffee_shop', 'breakfast', 'sandwich', 'bagel', 'dessert', 'ice_cream', 'bakery',
  'salad', 'juice', 'vegan', 'vegetarian', 'french', 'georgian', 'ethiopian', 'yemeni', 'moroccan', 'american', 'chicken',
]);

// Guesses from the name, in Hebrew and English. These are marked as automatic, not confirmed.
const NAME_RULES = [
  [/פיצ|pizz/i, 'pizza'], [/סושי|sushi/i, 'sushi'], [/בורגר|burger/i, 'burger'], [/שו?ו?ארמה|shawarma/i, 'shawarma'],
  [/פלאפל|falafel/i, 'falafel'], [/חומוס|hummus/i, 'hummus'], [/גלידה|גלידריה|gelat|ice ?cream/i, 'ice_cream'],
  [/מאפ(י|ה)|לחם|bakery|boulanger|בייקרי/i, 'bakery'], [/פסטה|pasta|איטלק|trattoria|osteria|italian/i, 'italian'],
  [/נודלס|noodle|ווק|wok|ראמן|ramen|תאי(לנדי)?\b|thai|אסיי?את/i, 'asian'], [/סיני|chinese/i, 'chinese'],
  [/יפני|japan/i, 'japanese'], [/הודי|india/i, 'indian'], [/מקסיק|טאקו|taco|burrito|בוריטו/i, 'mexican'],
  [/גריל|grill|סטייק|steak|בשרים|אסאדו|asado|שיפוד/i, 'meat'], [/דגים|fish|ים\b|sea ?food/i, 'fish'],
  [/קפה|caf[eé]|coffee|espresso|אספרסו/i, 'coffee_shop'], [/ארוחת בוקר|breakfast|brunch|בראנץ/i, 'breakfast'],
  [/סנדוויץ|כריך|sandwich|טוסט|toast/i, 'sandwich'], [/בייגל|bagel/i, 'bagel'],
  [/קונדיטור|שוקולד|קינוח|עוגות|dessert|patisserie|chocolat|cake|וופל|waffle|קרפ|crepe/i, 'dessert'],
  [/סלט|salad/i, 'salad'], [/מיץ|מיצים|juice|smoothie|שייק/i, 'juice'], [/עוף|chicken|שניצל|schnitzel/i, 'chicken'],
  [/תימני|yemen|מלאווח|ג'חנון/i, 'yemeni'], [/מרוקא|morocc/i, 'moroccan'], [/גאורג|ג'ורג'|georgia|חצ'פורי|khachapuri/i, 'georgian'],
  [/אתיופ|ethiop/i, 'ethiopian'], [/טבעונ|vegan/i, 'vegan'], [/צמחונ|vegetarian/i, 'vegetarian'],
];

function normalizeCuisine(t) {
  const out = new Set();
  for (const raw of (t.cuisine ?? '').toLowerCase().split(/[;,]\s*/)) {
    const c = CUISINE_ALIASES[raw.trim()] ?? raw.trim();
    if (KNOWN_CUISINES.has(c)) out.add(c);
  }
  return [...out];
}

function guessCuisineFromName(name) {
  const out = new Set();
  for (const [re, c] of NAME_RULES) if (re.test(name)) out.add(c);
  return [...out];
}

function placeType(t, cuisine) {
  const has = (c) => cuisine.includes(c);
  if (has('pizza')) return 'pizza';
  if (has('sushi') || has('japanese')) return 'sushi';
  if (has('hummus') || has('falafel') || has('shawarma') || has('middle_eastern')) return 'hummus';
  if (has('burger') || has('meat') || has('steak_house')) return 'grill';
  if (t['diet:vegan'] === 'only') return 'vegan_restaurant';
  if (t.amenity === 'ice_cream' || has('ice_cream')) return 'ice_cream';
  if (t.amenity === 'cafe' || has('coffee_shop')) return 'cafe';
  if (t.amenity === 'bakery' || t.shop === 'bakery' || t.shop === 'pastry' || t.shop === 'confectionery' || has('bakery')) return 'bakery';
  if (t.amenity === 'fast_food') return 'stand';
  return 'restaurant';
}

/** Dietary info from OSM tags (source 'osm'), or guessed from the name (source 'auto'). */
function claimsFor(t, name) {
  const out = [];
  const add = (need, level, source) => { if (!out.some((c) => c.need === need)) out.push({ need, level, source }); };
  if (t['diet:kosher'] === 'yes' || t['diet:kosher'] === 'only' || t.kosher === 'yes') add('kosher', 'marked', 'osm');
  const veganCuisine = /(^|;)\s*vegan\s*(;|$)/.test(t.cuisine ?? '');
  if (t['diet:vegan'] === 'only' || (veganCuisine && !t['diet:vegan'])) add('vegan', 'full', 'osm');
  else if (t['diet:vegan'] === 'yes') add('vegan', 'options', 'osm');
  // "only": the whole place is gluten free, the closest OSM has to "separate kitchen"
  if (t['diet:gluten_free'] === 'only') add('gluten_free', 'kitchen', 'osm');
  else if (t['diet:gluten_free'] === 'yes') add('gluten_free', 'menu', 'osm');

  if (/טבעונ|vegan/i.test(name)) add('vegan', 'full', 'auto');
  if (/ללא גלוטן|נטול גלוטן|gluten.?free/i.test(name)) add('gluten_free', 'menu', 'auto');
  if (/כשר|kosher|מהדרין|glatt|בד"?ץ/i.test(name)) add('kosher', 'marked', 'auto');
  return out;
}

const cleanUrl = (u) => {
  if (!u) return null;
  const v = u.trim().startsWith('http') ? u.trim() : `https://${u.trim()}`;
  try { return new URL(v).toString().slice(0, 300); } catch { return null; }
};
const cleanPhone = (p) => (p ? p.split(';')[0].trim().slice(0, 40) : null);

// opening_hours parser for the common forms:
//   "Su-Th 08:00-22:00; Fr 08:00-14:00; Sa off", "Mo-Su 09:00-17:00", "08:00-22:00", "24/7".
// Rules for public holidays (PH/SH) are skipped; anything else unusual leaves hours unknown.
const DAY = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
function parseHours(s) {
  if (!s) return null;
  if (s.trim() === '24/7') return Object.fromEntries(ALL_DAYS.map((d) => [d, [['00:00', '23:59']]]));
  const out = {};
  for (const rule of s.split(/;|\|\|/).map((r) => r.trim()).filter(Boolean)) {
    if (/^(PH|SH)\b/.test(rule)) continue;
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?(?:,\s*PH)?\s*(.+)$/);
    if (!m) return null;
    const days = [];
    if (!m[1]) days.push(...ALL_DAYS);
    else for (const seg of m[1].split(/,\s*/)) {
      const [a, b] = seg.split('-');
      if (!b) days.push(DAY[a]);
      else for (let d = DAY[a]; ; d = (d + 1) % 7) { days.push(d); if (d === DAY[b]) break; }
    }
    const ranges = [];
    const spec = m[2].trim();
    if (spec !== 'off' && spec !== 'closed') {
      for (const r of spec.split(/,\s*/)) {
        const t = r.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\+?$/);
        if (!t) return null;
        let [a, b] = [t[1].padStart(5, '0'), t[2].padStart(5, '0')];
        if (b === '24:00' || b < a) b = '23:59'; // past midnight: close at end of day
        ranges.push([a, b]);
      }
    }
    for (const d of days) out[d] = ranges;
  }
  return Object.keys(out).length ? out : null;
}

// ---------- run ----------
const elements = await overpass();
const seen = new Set();
const rows = [];
for (const el of elements) {
  const t = el.tags ?? {};
  const name = (t['name:he'] ?? t.name ?? t['name:en'] ?? t['name:ar'] ?? '').trim();
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const id = osmId(el);
  if (!name || lat == null || lon == null || seen.has(id)) continue;
  seen.add(id);
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const fromOsm = normalizeCuisine(t);
  const guessed = fromOsm.length ? [] : guessCuisineFromName(`${name} ${t.name ?? ''}`);
  const cuisine = fromOsm.length ? fromOsm : guessed;
  const claims = claimsFor(t, `${name} ${t.name ?? ''} ${t['name:en'] ?? ''}`);
  rows.push({
    place: {
      osm_id: id,
      name: name.slice(0, 120),
      place_type: placeType(t, cuisine),
      cuisine: cuisine.length ? cuisine : null,
      cuisine_source: fromOsm.length ? 'osm' : guessed.length ? 'auto' : null,
      phone: cleanPhone(t.phone ?? t['contact:phone']),
      website: cleanUrl(t.website ?? t['contact:website']),
      address: [street, t['addr:city']].filter(Boolean).join(', ') || null,
      location: `SRID=4326;POINT(${lon} ${lat})`,
      hours: parseHours(t.opening_hours),
    },
    claims,
  });
}

const count = (need) => rows.filter((r) => r.claims.some((c) => c.need === need)).length;
const withHours = rows.filter((r) => r.place.hours).length;
const withCuisine = rows.filter((r) => r.place.cuisine).length;
console.log(`\nנמצאו ${rows.length} מקומות לאכול: ${withCuisine} עם סוג אוכל, ${withHours} עם שעות פתיחה, ${count('kosher')} כשרים, ${count('vegan')} טבעוניים, ${count('gluten_free')} ללא גלוטן.`);
if (dryRun) {
  for (const r of rows.slice(0, 25)) console.log('  ', r.place.name, '|', r.place.cuisine?.join(',') ?? '-', '|', r.claims.map((c) => `${c.need}:${c.level}:${c.source}`).join(' '));
  process.exit(0);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const idByOsm = new Map();
for (let i = 0; i < rows.length; i += 500) {
  process.stdout.write(`\rשומר מקומות… ${Math.min(i + 500, rows.length)}/${rows.length}`);
  const { data, error } = await sb
    .from('places')
    .upsert(rows.slice(i, i + 500).map((r) => r.place), { onConflict: 'osm_id' })
    .select('id, osm_id');
  if (error) {
    console.error('\nשמירת המקומות נכשלה:', error.message);
    if (error.message.includes('Invalid API key')) console.error('בדקו את SUPABASE_SERVICE_ROLE_KEY בקובץ .env.local');
    process.exit(1);
  }
  for (const p of data) idByOsm.set(Number(p.osm_id), p.id);
}

const placeIds = [...idByOsm.values()];
const have = new Set();
console.log('');
for (let i = 0; i < placeIds.length; i += 150) {
  const { data, error } = await sb.from('claims').select('place_id, need').in('place_id', placeIds.slice(i, i + 150));
  if (error) {
    console.error('קריאת המידע הקיים נכשלה:', error.message);
    process.exit(1);
  }
  for (const c of data) have.add(`${c.place_id}:${c.need}`);
}

const now = new Date().toISOString();
const newClaims = [];
for (const r of rows) {
  const placeId = idByOsm.get(r.place.osm_id);
  for (const c of r.claims) {
    if (!placeId || have.has(`${placeId}:${c.need}`)) continue;
    newClaims.push({ place_id: placeId, need: c.need, level: c.level, status: 'verified', source: c.source, verified_at: now });
  }
}
for (let i = 0; i < newClaims.length; i += 300) {
  const { error } = await sb.from('claims').insert(newClaims.slice(i, i + 300));
  if (error) {
    console.error('\nשמירת המידע נכשלה:', error.message);
    process.exit(1);
  }
}
console.log(`\nנשמרו ${idByOsm.size} מקומות ו-${newClaims.length} פרטים חדשים. אפשר לרענן את האתר. 🎉\n`);
