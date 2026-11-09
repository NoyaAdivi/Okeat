#!/usr/bin/env node
// Sharp pictures of the live site for GitHub and LinkedIn, at twice the normal resolution, in Hebrew and in English.
//   npm install --no-save playwright
//   npx playwright install chromium
//   node scripts/screenshots.mjs
// A browser window opens and works by itself.
// Results: linkedin-images/he/, linkedin-images/en/, okeat.png (Hebrew), okeat-en.png (English), the share image.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, copyFileSync, unlinkSync } from 'node:fs';

const SITE = process.env.SITE ?? 'https://okeat.vercel.app';
const WIDE = { viewport: { width: 1260, height: 658 }, deviceScaleFactor: 2 };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const PLACE = '52b24095-fe41-483b-8b26-0526eba6df57'; // a confirmed place with full details

// Spots on the beach. The map pictures use the one whose nearby list shows the most kinds of seals
// (kosher, vegan, vegetarian, gluten-free), so the picture isn't only vegetarian places.
const BEACHES = [
  { lat: 32.0838, lng: 34.7698, he: 'חוף גורדון, תל אביב', en: 'Gordon Beach, Tel Aviv' },
  { lat: 32.0970, lng: 34.7740, he: 'נמל תל אביב', en: 'Tel Aviv Port' },
  { lat: 32.0640, lng: 34.7620, he: 'חוף צ׳רלס קלור, תל אביב', en: 'Charles Clore Beach, Tel Aviv' },
  { lat: 32.1630, lng: 34.7960, he: 'מרינה הרצליה', en: 'Herzliya Marina' },
  { lat: 32.3290, lng: 34.8510, he: 'הטיילת, נתניה', en: 'Netanya promenade' },
  { lat: 32.0170, lng: 34.7420, he: 'הטיילת, בת ים', en: 'Bat Yam promenade' },
];

const browser = await chromium.launch({ headless: false }); // a real window, so the map draws properly

// Only the finished look: no passing messages, and no row cut in half at the edge of a picture.
const TIDY = `html { scrollbar-width: none } ::-webkit-scrollbar { display: none }
  .notice, .notice-bar, .toast { display: none !important }`;

let beach = BEACHES[0];

async function open(lang, options) {
  const context = await browser.newContext({ ...options, locale: lang === 'en' ? 'en-US' : 'he-IL', colorScheme: 'light' });
  await context.addCookies([{ name: 'okeat-lang', value: lang, url: SITE }]);
  await context.addInitScript((spot) => {
    try {
      localStorage.setItem('okeat-notice-ok', '1');
      sessionStorage.setItem('okeat-location-asked', 'no');
      localStorage.setItem('okeat:my-location', JSON.stringify(spot));
    } catch { /* first page */ }
  }, { lat: beach.lat, lng: beach.lng, label: lang === 'en' ? beach.en : beach.he });
  return context.newPage();
}

async function visit(page, path, wait) {
  await page.goto(`${SITE}${path}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: TIDY }).catch(() => undefined);
  await pause(wait);
}

/** How many different seals the visible list shows. */
const sealKinds = (page) => page.evaluate(() => {
  const panel = document.querySelector('.panel');
  if (!panel) return 0;
  const edge = panel.getBoundingClientRect().bottom;
  const kinds = new Set();
  for (const b of panel.querySelectorAll('.badge')) {
    if (b.getBoundingClientRect().top > edge) continue;
    const kind = [...b.classList].find((c) => !['badge', 'soft', 'pend', 'bad'].includes(c));
    if (kind) kinds.add(kind);
  }
  return kinds.size;
});

// Pick the beach once, in Hebrew, and use it for both languages.
{
  let best = -1;
  for (const spot of BEACHES) {
    beach = spot;
    const page = await open('he', WIDE);
    await visit(page, '/map', 8000);
    const n = await sealKinds(page);
    console.log(`${spot.he}: ${n} סוגי חותמות`);
    await page.context().close();
    if (n > best) { best = n; var chosen = spot; }
    if (n >= 4) break;
  }
  beach = chosen;
  console.log('נבחר:', beach.he);
}

for (const lang of ['he', 'en']) {
  const en = lang === 'en';
  const T = (he, eng) => (en ? eng : he);
  const OUT = `linkedin-images/${lang}`;
  mkdirSync(OUT, { recursive: true });
  const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`נשמר (${lang}):`, name); };

  const wide = await open(lang, WIDE);

  // Home: the title, the big number and the number for each need, all on one screen.
  const home = await open(lang, { viewport: { width: 1600, height: 836 }, deviceScaleFactor: 1.575 });
  await visit(home, '/', 500);
  await home.addStyleTag({ content: `.hero { padding: 22px 24px 28px } .hero-inner { gap: 10px }
    .hero-logo .logo-mark { width: 84px } .section { padding-top: 22px } .need-cards { gap: 10px }
    .need-cards .need-card { padding: 12px 16px }` });
  await pause(3500);
  await home.evaluate(() => {
    const bottom = Math.max(...[...document.querySelectorAll('.need-cards > *')].map((c) => c.getBoundingClientRect().bottom));
    const room = innerHeight - 14;
    if (bottom > room) document.body.style.zoom = String(room / bottom);
    document.querySelector('footer')?.style.setProperty('display', 'none');
  });
  await pause(900);
  await shot(home, '2-home');

  // For the main picture: only the top of the home page, without the cards.
  const top = await open(lang, WIDE);
  await visit(top, '/', 2500);
  await top.addStyleTag({ content: '.a11y-tab { display: none !important }' });
  const heroEnd = await top.evaluate(() => Math.round(document.querySelector('.hero').getBoundingClientRect().bottom));
  await top.screenshot({ path: `${OUT}/hero.png`, clip: { x: 0, y: 0, width: 1260, height: Math.min(heroEnd, 658) } });

  const far = await open(lang, { viewport: { width: 1838, height: 960 }, deviceScaleFactor: 1.37 });
  await visit(far, '/cities', 3000);
  await shot(far, '4-cities');

  // Place: its details fill the panel, and nothing is cut by the bottom edge.
  await visit(wide, `/map?place=${PLACE}`, 9000);
  await wide.evaluate((pickText) => {
    const detail = document.querySelector('.detail');
    [...detail.querySelectorAll('button')].find((b) => b.innerText.includes(pickText))?.parentElement?.style.setProperty('display', 'none');
    const edge = (document.querySelector('.panel') ?? detail).getBoundingClientRect().bottom - 8;
    const trim = (el) => {
      for (const c of el.children) {
        const r = c.getBoundingClientRect();
        if (r.top >= edge) c.style.visibility = 'hidden';
        else if (r.bottom > edge) { if (c.children.length) trim(c); else c.style.visibility = 'hidden'; }
      }
    };
    trim(detail);
  }, T('בחירת המיקום', 'Choose'));
  await pause(500);
  await shot(wide, '5-place');

  // Map: by the sea, a wider screen so the map takes most of the picture, a little further out so more places show.
  const big = await open(lang, { viewport: { width: 1600, height: 836 }, deviceScaleFactor: 1.575 });
  await visit(big, '/map', 8000);
  await big.mouse.move(600, 420);
  for (let i = 0; i < 2; i += 1) { await big.mouse.wheel(0, 240); await pause(900); }
  await pause(6000);
  await big.evaluate(() => {
    const edge = document.querySelector('.panel').getBoundingClientRect().bottom - 8;
    for (const li of document.querySelectorAll('.panel li')) if (li.getBoundingClientRect().bottom > edge) li.style.visibility = 'hidden';
  });
  await pause(400);
  await shot(big, '3-map');

  // ---------- the main picture: the map, with the home page on top of it ----------
  const data = (f) => `data:image/png;base64,${readFileSync(`${OUT}/${f}.png`).toString('base64')}`;
  const collage = await open(lang, WIDE);
  const side = en ? 'right:24px' : 'left:24px'; // the card covers the map, not the list
  await collage.setContent(`<!doctype html><body style="margin:0;width:1260px;height:658px;overflow:hidden;position:relative">
    <img src="${data('3-map')}" style="position:absolute;inset:0;width:1260px;height:658px">
    <img src="${data('hero')}" style="position:absolute;${side};top:110px;width:760px;border-radius:18px;box-shadow:0 18px 50px rgba(43,33,64,.34)">
  </body>`);
  await pause(800);
  await shot(collage, '1-combined');
  unlinkSync(`${OUT}/hero.png`);

  if (en) {
    copyFileSync(`${OUT}/1-combined.png`, 'okeat-en.png');
  } else {
    // The Hebrew picture at normal size is what shows up when someone shares the link.
    const small = await browser.newContext({ viewport: { width: 1200, height: 627 }, deviceScaleFactor: 1 });
    const share = await small.newPage();
    await share.setContent(`<body style="margin:0"><img src="${data('1-combined')}" style="width:1200px;display:block"></body>`);
    await pause(500);
    await share.screenshot({ path: 'src/app/opengraph-image.png' });
    copyFileSync(`${OUT}/1-combined.png`, 'okeat.png');
  }
}

await browser.close();
console.log('\nסיימנו. התמונות בתיקיות linkedin-images/he ו-linkedin-images/en');
