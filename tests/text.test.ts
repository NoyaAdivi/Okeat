import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAddress, cleanName, isForeign, hasHebrew } from '../src/lib/text.ts';

test('addresses lose the country, postal code and repeats', () => {
  assert.equal(cleanAddress('  הרצל 5 ,  תל אביב, ישראל, 6100000 '), 'הרצל 5, תל אביב');
  assert.equal(cleanAddress('Herzl 5, Tel Aviv, Israel'), 'Herzl 5, Tel Aviv');
  assert.equal(cleanAddress('Unnamed Road, נצרת'), 'נצרת');
  assert.equal(cleanAddress('תל אביב, תל אביב'), 'תל אביב');
  assert.equal(cleanAddress('דרך מנחם בגין 132'), 'דרך מנחם בגין 132');
  assert.equal(cleanAddress(null), '');
});

test('names are tidied without changing what they say', () => {
  assert.equal(cleanName('  "PIZZA HUT"  '), 'Pizza Hut');
  assert.equal(cleanName('פלאפל הזקן בע"מ'), 'פלאפל הזקן');
  assert.equal(cleanName('BBB'), 'BBB');
  assert.equal(cleanName("McDonald's"), "McDonald's");
});

test('foreign means letters, but no Hebrew ones', () => {
  assert.equal(isForeign('مطعم الشرق'), true);
  assert.equal(isForeign('Cafe Joe'), true);
  assert.equal(isForeign('קפה ג׳ו Cafe'), false);
  assert.equal(isForeign('123'), false);
  assert.equal(hasHebrew('שלום'), true);
});

test('an address that is only numbers is no address', () => {
  assert.equal(cleanAddress('123'), '');
  assert.equal(cleanAddress('5, 7'), '');
});
