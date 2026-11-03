import assert from 'node:assert/strict';
import { test } from 'node:test';

// These check the live site, so they run only on GitHub, where CI is set.
const site = 'https://okeat.vercel.app';
const live = { skip: !process.env.CI };

test('the main pages open', live, async () => {
  for (const path of ['/', '/map', '/about', '/terms', '/privacy', '/contact', '/accessibility']) {
    const res = await fetch(site + path);
    assert.equal(res.status, 200, path);
  }
});

test('the map page has the app inside it', live, async () => {
  const html = await fetch(`${site}/map`).then((r) => r.text());
  assert.match(html, /<title>[^<]*Okeat/);
});

test('a broken sign-in link ends with a clear error', live, async () => {
  for (const path of ['/auth/confirm', '/auth/callback']) {
    const res = await fetch(site + path, { redirect: 'manual' });
    assert.ok(res.status >= 300 && res.status < 400, path);
    assert.match(res.headers.get('location') ?? '', /auth_error=1/, path);
  }
});
