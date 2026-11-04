#!/usr/bin/env node
// Sharp pictures of the live site for GitHub and LinkedIn, at twice the normal resolution.
//   npm install --no-save playwright
//   npx playwright install chromium
//   node scripts/screenshots.mjs
// A browser window opens and works by itself. Results: linkedin-images/, okeat.png, the share image.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, copyFileSync } from 'node:fs';

const SITE = process.env.SITE ?? 'https://okeat.vercel.app';
const OUT = 'linkedin-images';
mkdirSync(OUT, { recursive: true });
const WIDE = { viewport: { width: 1260, height: 658 }, deviceScaleFactor: 2 };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: false }); // a real window, so the map draws properly

async function open(options, darkOff = true) {
  const context = await browser.newContext({
    ...options, locale: 'he-IL', colorScheme: darkOff ? 'light' : 'dark',
    geolocation: { latitude: 32.0795, longitude: 34.7806 }, permissions: ['geolocation'],
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('okeat-notice-ok', '1');
      sessionStorage.setItem('okeat-location-asked', 'yes');
    } catch { /* first page */ }
  });
  return context.newPage();
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('נשמר:', name);
}

// ---------- computer ----------
const wide = await open(WIDE);

// A little further back, so the home page shows the big card under the title too.
const far = await open({ viewport: { width: 1600, height: 836 }, deviceScaleFactor: 1.5 });
await far.goto(SITE, { waitUntil: 'networkidle' });
await pause(2500);
await shot(far, '2-home');

await wide.goto(`${SITE}/cities`, { waitUntil: 'networkidle' });
await pause(1500);
await shot(wide, '4-cities');

await wide.goto(`${SITE}/city/tel-aviv`, { waitUntil: 'networkidle' });
await pause(1500);
await shot(wide, '5-places');

await wide.goto(`${SITE}/map`, { waitUntil: 'load' });
await pause(9000); // the map and its places
await shot(wide, '3-map');

await wide.locator('.panel li button, .panel li a').first().click({ timeout: 5000 }).catch(() => undefined);
await pause(3500);
await shot(wide, '6-place');

// ---------- the main picture: the map, with the home page on top of it ----------
const data = (f) => `data:image/png;base64,${readFileSync(`${OUT}/${f}.png`).toString('base64')}`;
const collage = await open(WIDE);
await collage.setContent(`<!doctype html><body style="margin:0;width:1260px;height:658px;overflow:hidden;position:relative">
  <img src="${data('3-map')}" style="position:absolute;inset:0;width:1260px;height:658px">
  <img src="${data('2-home')}" style="position:absolute;left:26px;top:122px;width:790px;border-radius:18px;box-shadow:0 18px 50px rgba(43,33,64,.34)">
</body>`);
await pause(800);
await shot(collage, '1-combined');

// The same picture at normal size is what shows up when someone shares the link.
const small = await browser.newContext({ viewport: { width: 1200, height: 627 }, deviceScaleFactor: 1 });
const share = await small.newPage();
await share.setContent(`<body style="margin:0"><img src="${data('1-combined')}" style="width:1200px;display:block"></body>`);
await pause(500);
await share.screenshot({ path: 'src/app/opengraph-image.png' });
copyFileSync(`${OUT}/1-combined.png`, 'okeat.png');

await browser.close();
console.log('\nסיימנו. התמונות בתיקייה linkedin-images');
