#!/usr/bin/env node
// Press pictures of the live site (for the Mako article): very sharp, in Hebrew, nothing cut.
//
//   Easiest: double-click tools\MAKO-SCREENSHOTS.bat
//   Or by hand:
//     npm install --no-save playwright
//     npx playwright install chromium
//     node scripts/mako-screenshots.mjs
//
// A browser window opens and works by itself for a few minutes. Don't touch it.
// Results: mako-images/ (desktop pictures are 5760x3240, a 16:9 computer screen drawn 4 times sharper;
// phone pictures are 1290x2796, an iPhone screen at 3x), plus mako-images/report.txt.

import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const SITE = process.env.SITE ?? 'https://okeat.vercel.app';
// Pages are laid out exactly as on a common laptop (1920x1080 screen at Windows' 125% setting = 1536x864),
// so the menu and the text are the same size as people really see them, then drawn sharper: 5760x3240.
// SCALE=2.5 gives 3840x2160 (4K), smaller files.
const SCALE = Number(process.env.SCALE ?? 3.75);
const OUT = 'mako-images';
// קפה גן סיפור: confirmed by the community as kosher (mehadrin), vegan, vegetarian and gluten-free, so its page shows every seal
const PLACE = process.env.PLACE ?? '08fc3d20-ed1f-4605-b20a-8d62254606f1';
// אמורה מיו, אבן גבירול 100: a short walk from the map spot, for the picture with the walking route
const ROUTE_PLACE = process.env.ROUTE_PLACE ?? '52b24095-fe41-483b-8b26-0526eba6df57';
// Spots in central Tel Aviv, all about the same distance from the beach, so every map picture shows the sea
// the same way (about a third of the map). The first one was checked by hand: the nearest places in the list
// show kosher, vegan and vegetarian seals. If that changes, the script moves to the next spot.
const SPOTS = [
  { lat: 32.0770, lng: 34.7760, label: 'כיכר דיזנגוף, תל אביב' },
  { lat: 32.0774, lng: 34.7742, label: 'כיכר דיזנגוף, תל אביב' },
  { lat: 32.0766, lng: 34.7759, label: 'כיכר דיזנגוף, תל אביב' },
  { lat: 32.0780, lng: 34.7740, label: 'כיכר דיזנגוף, תל אביב' },
];
let SPOT = SPOTS[0];

const DESKTOP = { viewport: { width: 1536, height: 864 }, deviceScaleFactor: SCALE };
// Map pictures: the same laptop screen as the pages, so the panel and the menu are exactly the size people see.
const MAP_DESKTOP = DESKTOP;
const PHONE = {
  viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
// the report is saved after every line, so even if something stops the run, it says how far it got and why
const log = (s) => { console.log(s); report.push(s); try { writeFileSync(`${OUT}/report.txt`, report.join('\n') + '\n'); } catch { /* folder not made yet */ } };

/** Runs one picture. If it fails, the reason goes in the report and the other pictures still get taken. */
async function step(name, fn) {
  console.log(`מצלם ${name}...`);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      // one picture never takes more than 3 minutes: if it does, it's stuck, and the run moves on
      let timer;
      const limit = new Promise((_, no) => { timer = setTimeout(() => no(new Error('נתקע יותר מ-3 דקות')), 180_000); });
      try { await Promise.race([fn(), limit]); } finally { clearTimeout(timer); }
      return;
    } catch (e) {
      log(`  ! ${name}: ${attempt === 1 ? 'נכשל, מנסה שוב' : 'נכשל'} (${String(e?.message ?? e).split('\n')[0].slice(0, 160)})`);
    }
  }
}

// Only the finished look: no cookie notice, no passing messages, no scrollbars, no floating accessibility tab.
const TIDY = `html { scrollbar-width: none } ::-webkit-scrollbar { display: none }
  .notice, .notice-bar, .toast, .a11y-tab { display: none !important }
  *, *::before, *::after { caret-color: transparent !important }
  [data-cut] { visibility: hidden !important }`;

rmSync(OUT, { recursive: true, force: true }); // every run starts clean, so no old picture is left behind
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false }); // a real window, so the map draws properly

async function open(options, { dark = false, here = true } = {}) {
  const context = await browser.newContext({ ...options, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: dark ? 'dark' : 'light' });
  await context.addCookies([{ name: 'okeat-lang', value: 'he', url: SITE }]);
  await context.addInitScript(({ spot, dark }) => {
    try {
      localStorage.setItem('okeat-notice-ok', '1');
      sessionStorage.setItem('okeat-location-asked', 'no');
      // without a location, a place page shows its details instead of walking directions
      if (spot) localStorage.setItem('okeat:my-location', JSON.stringify(spot));
      else localStorage.removeItem('okeat:my-location');
      localStorage.removeItem('okeat-my-filter');
      localStorage.setItem('okeat-prefs', JSON.stringify({ theme: dark ? 'dark' : 'light' }));
    } catch { /* first page */ }
  }, { spot: here ? SPOT : null, dark });
  return context.newPage();
}

/** Opens a page and waits until it is really finished: fonts, pictures, and map tiles. */
async function visit(page, path, extra = 0) {
  await page.goto(`${SITE}${path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined);
  await page.addStyleTag({ content: TIDY }).catch(() => undefined);
  // Fonts and pictures, but never more than 10 seconds: a picture set to load only when scrolled into view
  // never finishes on its own, and waiting for it made the run hang on the place page.
  await page.evaluate(async () => {
    const all = Promise.all([
      document.fonts.ready,
      ...[...document.images].filter((i) => !i.complete && i.loading !== 'lazy').map((i) => new Promise((r) => { i.onload = i.onerror = r; })),
    ]);
    await Promise.race([all, new Promise((r) => setTimeout(r, 10_000))]);
  }).catch(() => undefined);
  // the map keeps loading tiles after the page itself is done
  if (path.startsWith('/map')) await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await pause(2500 + extra);
}

/** Hides whole list rows (and other parts) that the bottom of a panel or of the screen would cut in half. */
async function trimPanels(page) {
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.panel, .detail, .sheet')];
    for (const el of document.querySelectorAll('.panel *, .detail *')) {
      const o = getComputedStyle(el).overflowY;
      if (o === 'auto' || o === 'scroll') boxes.push(el);
    }
    for (const box of boxes) {
      const edge = Math.min(box.getBoundingClientRect().bottom, innerHeight) - 6;
      // a row, a seal line or a box is shown whole or not at all
      for (const el of box.querySelectorAll('li, .claim, .warnbox, .pendbox, .sec > div, .sec > p')) {
        if (el.getBoundingClientRect().bottom > edge) el.setAttribute('data-cut', '');
      }
      const walk = (el) => {
        for (const c of el.children) {
          const r = c.getBoundingClientRect();
          if (r.height === 0 || c.hasAttribute('data-cut')) continue;
          if (r.top >= edge) c.setAttribute('data-cut', '');
          else if (r.bottom > edge) { if (c.children.length) walk(c); else c.setAttribute('data-cut', ''); }
        }
      };
      walk(box);
    }
    // a title whose content is all hidden goes too, so no title stands alone at the bottom
    for (const sec of document.querySelectorAll('.detail .sec')) {
      const rest = [...sec.children].filter((c) => !/^H[1-6]$/.test(c.tagName));
      if (rest.length && rest.every((c) => c.hasAttribute('data-cut') || c.getBoundingClientRect().height === 0)) sec.setAttribute('data-cut', '');
    }
  }).catch(() => undefined);
}

// A little less empty space around the big title, so more of the page fits.
const SNUG = `.hero { padding-top: 30px !important; padding-bottom: 34px !important } .hero-inner { gap: 10px !important }
  .section { padding-top: 26px !important }`;

/**
 * Shows one stretch of a page, from the part that holds `from` (or the top) to the part that holds `to`,
 * whole: the parts before and after it are hidden, so nothing is cut at the bottom edge.
 * The site's menu always stays at its real size. Only if the stretch is still taller than the screen,
 * the content under the menu (never the menu) is shrunk a little to fit.
 */
async function showRange(page, from, to) {
  await page.addStyleTag({ content: SNUG }).catch(() => undefined);
  // scroll down and back up once, so cards that appear on scroll are shown
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await pause(1500);
  const zoom = await page.evaluate(({ from, to }) => {
    document.querySelector('footer')?.style.setProperty('display', 'none');
    const main = document.querySelector('main');
    if (!main) return 1;
    const kids = [...main.children];
    const holds = (sel) => kids.findIndex((k) => k.matches(sel) || k.querySelector(sel));
    const a = from ? Math.max(0, holds(from)) : 0;
    const b = holds(to);
    if (b < 0) return 1;
    kids.forEach((k, i) => { if (i < a || i > b) k.style.setProperty('display', 'none'); });
    scrollTo(0, 0);
    const top = main.getBoundingClientRect().top;
    const target = main.querySelector(to) ?? kids[b];
    const bottom = target.getBoundingClientRect().bottom + 28;
    if (bottom <= innerHeight) return 1;
    const z = (innerHeight - top) / (bottom - top);
    main.style.zoom = String(z);
    return z;
  }, { from, to }).catch(() => 1);
  if (zoom < 1) log(`  (התוכן מתחת לתפריט הוקטן ל-${Math.round(zoom * 100)}% כדי שייכנס שלם)`);
  await pause(2500); // the cards finish their entrance animation
}

/** Text that doesn't fit its box (cut with "..." or hidden), written to the report. */
async function checkCutText(page, name) {
  const cut = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
      if (el.closest('[data-cut]') || ['INPUT', 'SELECT', 'OPTION', 'LABEL'].includes(el.tagName)) continue;
      if (cs.position === 'absolute' && cs.clip !== 'auto') continue; // text only for screen readers
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ');
      if (!text) continue;
      const clips = cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis' || (!!cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
      if (clips && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) out.push(text.slice(0, 60));
    }
    return out.slice(0, 8);
  }).catch(() => []);
  if (cut.length) log(`  ! ${name}: טקסט שאולי נחתך: ${cut.join(' | ')}`);
}

/**
 * A place marker that sits right next to one of the map's own round buttons (+, location, route)
 * looks like another button in a picture, so it is hidden. The selected place's marker always stays.
 */
async function clearButtons(page) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button, a')].filter((b) => {
      if (b.closest('.panel, .detail, .mk, .mapboxgl-marker')) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.width < 90 && r.height < 90;
    }).map((b) => b.getBoundingClientRect());
    const near = (a, b, m = 14) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
    for (const mk of document.querySelectorAll('.mapboxgl-marker')) {
      if (mk.querySelector('.sel') || mk.textContent.includes('המיקום שלי')) continue;
      const r = mk.getBoundingClientRect();
      if (buttons.some((b) => near(r, b))) mk.setAttribute('data-cut', '');
    }
  }).catch(() => undefined);
}

async function shot(page, name) {
  await clearButtons(page);
  await trimPanels(page);
  await pause(400);
  await trimPanels(page); // again, in case the list redrew itself in the meantime
  await checkCutText(page, name);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled', timeout: 120_000 });
  const v = page.viewportSize();
  const s = await page.evaluate(() => devicePixelRatio);
  log(`נשמר ${name}.png (${Math.round(v.width * s)}x${Math.round(v.height * s)})`);
}

async function openPlace(page, id = PLACE) {
  await visit(page, `/map?place=${id}`, 6000);
  if (await page.locator('.detail').count()) return;
  // the place is gone: open the first place in the list instead
  log('  המקום שנבחר לא נמצא, נפתח המקום הראשון ברשימה');
  await visit(page, '/map', 6000);
  await page.locator('.panel li button, .panel li a').first().click().catch(() => undefined);
  await pause(4000);
}

/**
 * A place page for a picture: the name, the seals and what is known about the place come first.
 * Hidden: the "choose your location" box, the save/photo/list buttons and the "tap a part" hint,
 * which only mean something to someone using the site.
 */
const hideLocationBox = (page, full = true) => page.evaluate((full) => {
  const d = document.querySelector('.detail');
  if (!d) return;
  const hide = (el) => el?.style.setProperty('display', 'none');
  const btn = (t) => [...d.querySelectorAll('button')].find((b) => b.innerText.includes(t));
  hide(btn('בחירת המיקום')?.closest('section, div'));
  hide(btn('שמירה')?.parentElement);
  hide([...d.querySelectorAll('p, div')].find((e) => e.children.length === 0 && e.innerText.trim().startsWith('לחצו על חלק')));
  // on a phone: the place card pulled all the way up, so the seals fit on the screen
  if (full && innerWidth < 768) document.querySelector('.app[data-sheet]')?.setAttribute('data-sheet', 'full');
}, full).catch(() => undefined);


log(`צילומי מסך של Okeat לכתבה, ${new Date().toLocaleString('he-IL')}, אתר ${SITE}`);

// ---------- computer screen ----------
const d = await open(DESKTOP);

await visit(d, '/', 1000);
await showRange(d, null, '.need-cards'); // the title, the big number and all the colored cards
await shot(d, '01-home');

await visit(d, '/cities', 1000);
await showRange(d, null, '.city-grid'); // all the cities
await shot(d, '07-cities');

await visit(d, '/about', 1000);
await showRange(d, null, '.journey'); // the title and the journey of a piece of information
await shot(d, '08-about');

await visit(d, '/about', 1000);
await showRange(d, '#journey-h', '#seals-h ~ *'); // the journey and what the seals mean
await shot(d, '09-about-seals');

await d.context().close();

// ---------- choosing the spot for the map pictures ----------
/** Which seals (k = kosher, v = vegan, h = vegetarian) show in the picture: on the map and in the list rows that fit. */
const sealsOnMap = (page) => page.evaluate(() => {
  const panelEl = document.querySelector('.panel');
  const panel = panelEl?.getBoundingClientRect();
  const kinds = new Set();
  if (panelEl) {
    const edge = Math.min(panel.bottom, innerHeight);
    for (const b of panelEl.querySelectorAll('li .badge')) {
      if (b.getBoundingClientRect().bottom > edge) continue;
      for (const c of ['k', 'v', 'h']) if (b.classList.contains(c)) kinds.add(c);
    }
  }
  for (const s of document.querySelectorAll('.mk-seal')) {
    const r = s.getBoundingClientRect();
    if (r.width === 0 || r.top < 0 || r.bottom > innerHeight || r.left < 0) continue;
    if (panel && r.right > panel.left - 4) continue;
    for (const c of ['k', 'v', 'h']) if (s.classList.contains(c) && !s.classList.contains('x')) kinds.add(c);
  }
  return [...kinds];
}).catch(() => []);

{
  let best = { spot: SPOTS[0], n: -1 };
  for (const spot of SPOTS) {
    SPOT = spot;
    const t = await open(MAP_DESKTOP);
    await visit(t, '/map', 6000);
    const kinds = await sealsOnMap(t);
    await t.context().close();
    log(`  ${spot.label}: ${kinds.length ? kinds.map((k) => ({ k: 'כשר', v: 'טבעוני', h: 'צמחוני' })[k]).join(', ') : 'אין חותמות'}`);
    if (kinds.length > best.n) best = { spot, n: kinds.length };
    if (kinds.length === 3) break;
  }
  SPOT = best.spot;
  log(`נבחר למפות: ${SPOT.label}${best.n < 3 ? ' (לא נמצא מקום שרואים בו את שלושת סוגי החותמות)' : ''}`);
}

// the map pictures: all from the same spot and at the same zoom, so they match
const m = await open(MAP_DESKTOP);
await visit(m, '/map', 6000);
await shot(m, '02-map-tel-aviv');


await visit(m, '/map?need=kosher', 6000);
await shot(m, '04-map-kosher');

await visit(m, '/map?need=vegan', 6000);
await shot(m, '05-map-vegan');

await visit(m, '/map?food=sushi', 6000);
await shot(m, '06-map-sushi');

await m.context().close();

// a place page
await step('03-place', async () => {
  const pl = await open(MAP_DESKTOP, { here: false });
  try {
    await openPlace(pl);
    await hideLocationBox(pl);
    await pause(800);
    await shot(pl, '03-place');
  } finally { await pl.context().close().catch(() => undefined); }
});

// the way there: the same place page with the walking route from the map spot
await step('14-place-route', async () => {
  const pr = await open(MAP_DESKTOP);
  try {
    await openPlace(pr, ROUTE_PLACE);
    await hideLocationBox(pr);
    // the folded "8 steps on the way" line goes, so "what we know about the place" and its first seal fit under the tabs
    await pr.evaluate(() => {
      const b = [...document.querySelectorAll('.detail summary, .detail button')].find((x) => x.innerText.includes('שלבים בדרך'));
      (b?.closest('details') ?? b)?.style.setProperty('display', 'none');
      // and the section tabs, so both seals that the map marker shows (ח and ב) also show in the panel
      for (const el of document.querySelectorAll('.detail .place-tabs, .detail .place-tabs-hint')) el.style.setProperty('display', 'none');
    }).catch(() => undefined);
    await pause(2500); // the route line is drawn
    await shot(pr, '14-place-route');
  } finally { await pr.context().close().catch(() => undefined); }
});

// dark mode
await step('10-map-dark', async () => {
  const dark = await open(MAP_DESKTOP, { dark: true });
  try {
    await visit(dark, '/map', 6000);
    await shot(dark, '10-map-dark');
  } finally { await dark.context().close().catch(() => undefined); }
});

// ---------- phone ----------
await step('11-phone-home', async () => {
  const p = await open(PHONE);
  try {
    await visit(p, '/', 1000);
    // on a phone the four small cards come two by two: the screen ends after the first two (kosher, vegan)
    await p.evaluate(() => {
      for (const c of document.querySelectorAll('.need-cards > .need-card.h, .need-cards > .need-card.g')) c.style.setProperty('display', 'none');
    }).catch(() => undefined);
    await showRange(p, null, '.need-cards');
    await shot(p, '11-phone-home');
  } finally { await p.context().close().catch(() => undefined); }
});

await step('12-phone-map', async () => {
  const p = await open(PHONE);
  try {
    await visit(p, '/map', 6000);
    await shot(p, '12-phone-map');
  } finally { await p.context().close().catch(() => undefined); }
});

await step('13-phone-place', async () => {
  const pp = await open(PHONE, { here: false });
  try {
    await openPlace(pp);
    await hideLocationBox(pp);
    await pause(800);
    await shot(pp, '13-phone-place');
  } finally { await pp.context().close().catch(() => undefined); }
});

await step('15-phone-route', async () => {
  const pr = await open(PHONE);
  try {
    await openPlace(pr, ROUTE_PLACE);
    await hideLocationBox(pr, false); // the card stays half way, so the route on the map shows
    // as on the computer: no folded steps line and no tabs, so the seals of the place fit under the route box
    await pr.evaluate(() => {
      const b = [...document.querySelectorAll('.detail summary, .detail button')].find((x) => x.innerText.includes('שלבים בדרך'));
      (b?.closest('details') ?? b)?.style.setProperty('display', 'none');
      for (const el of document.querySelectorAll('.detail .place-tabs, .detail .place-tabs-hint')) el.style.setProperty('display', 'none');
    }).catch(() => undefined);
    // On a phone the route reaches under the site's top bar: zoom out a little, step by step,
    // until the place's marker with its seals is fully below the bar (and the start is above the card).
    const clear = () => pr.evaluate(() => {
      const mk = document.querySelector('.mk.sel')?.getBoundingClientRect();
      const bar = document.querySelector('header, .panel-head')?.getBoundingClientRect();
      return !mk || !bar || mk.top >= bar.bottom + 8;
    }).catch(() => true);
    for (let i = 0; i < 12 && !(await clear()); i += 1) {
      await pr.mouse.move(215, 240);
      await pr.mouse.wheel(0, 60);
      await pause(700);
    }
    await pr.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await pause(2500);
    await shot(pr, '15-phone-route');
  } finally { await pr.context().close().catch(() => undefined); }
});

await browser.close().catch(() => undefined);
log('הסתיים.');
console.log(`\nסיימנו. התמונות בתיקייה ${OUT}, והדוח בקובץ ${OUT}/report.txt`);
