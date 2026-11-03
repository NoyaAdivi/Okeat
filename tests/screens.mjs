// Opens the live site in a real browser and checks the main screens.
// GitHub runs this after installing the browser. See .github/workflows/tests.yml.
import { chromium } from 'playwright';

const site = 'https://okeat.vercel.app';
const browser = await chromium.launch();
const fail = (message) => { console.error(`failed: ${message}`); process.exitCode = 1; };

for (const [name, viewport] of [['computer', { width: 1280, height: 800 }], ['phone', { width: 390, height: 800 }]]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // The location question comes first on a new visit.
  const notNow = () => page.getByRole('button', { name: 'לא עכשיו' }).click({ timeout: 4000 }).catch(() => undefined);

  await page.goto(site);
  await notNow();
  if (await page.locator('h1').count() === 0) fail(`${name}: the home page has no title`);

  await page.goto(`${site}/map`);
  await notNow();
  await page.waitForSelector('.mapboxgl-canvas', { timeout: 20000 }).catch(() => fail(`${name}: the map did not appear`));
  await page.waitForSelector('.panel-body li button.item', { timeout: 20000 }).catch(() => fail(`${name}: the list is empty`));

  // The map has this button twice, one for each layout, and shows only one.
  await page.locator('.account-in:visible').first().click().catch(() => fail(`${name}: no sign-in button`));
  await page.waitForSelector('#auth-email', { timeout: 5000 }).catch(() => fail(`${name}: the sign-in window did not open`));

  await page.goto(`${site}/cities`);
  if (await page.locator('.city-grid a').count() < 12) fail(`${name}: cities are missing`);

  if (errors.length) fail(`${name}: ${errors[0]}`);
  await page.close();
}
await browser.close();
console.log(process.exitCode ? 'Some screens failed.' : 'All screens are fine.');
