import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesCuisine, placeFoods } from '../src/lib/cuisine.ts';

const named = (name: string) => ({ name });

test('a word that only looks like food does not match', () => {
  for (const [name, type] of [["צ'אפו בורגר", 'asian'], ['קפה יפו ', 'asian'], ['שבתאי', 'asian'], ['מבשרת ציון', 'meat'], ['פיצוחי בועז', 'pizza'], ['המסעדה היהודית', 'indian'], ['דגנית', 'fish'], ['Meital sweet boutique', 'italian']]) {
    assert.equal(matchesCuisine(named(name), type), false, name);
  }
});

test('real names still match', () => {
  for (const [name, type] of [['וואו סושי', 'asian'], ['פו בכיכר', 'asian'], ['Wok up', 'asian'], ['הבשר של דני', 'meat'], ['פיצה רומא', 'pizza'], ['דהבה אוכל הודי', 'indian'], ['דגי הים', 'fish'], ['Trattoria Roma', 'italian']]) {
    assert.equal(matchesCuisine(named(name), type), true, name);
  }
});

test('a place shows its food, the exact type before the broad one', () => {
  assert.deepEqual(placeFoods({ name: 'וואו סושי', cuisine: ['sushi', 'asian'] }), ['sushi']);
  assert.deepEqual(placeFoods({ name: 'פיצה רומא', place_type: 'pizza' }), ['pizza']);
  assert.deepEqual(placeFoods({ name: 'מקום', place_type: 'restaurant' }), []);
});

test('every kind of food has its own emoji, and falafel is not hummus', async () => {
  const { CUISINES, CUISINE_GROUPS } = await import('../src/lib/cuisine.ts');
  const emojis = Object.values(CUISINES).map((c) => c.emoji);
  assert.equal(new Set(emojis).size, emojis.length);
  assert.notEqual(CUISINES.falafel.emoji, CUISINES.hummus.emoji);
  const grouped = CUISINE_GROUPS.flatMap((g) => g.items);
  assert.deepEqual([...grouped].sort(), Object.keys(CUISINES).sort());
});

test('new kinds of food are found by name', () => {
  for (const [name, type] of [['שניצל של סבתא', 'schnitzel'], ['סביח עובד', 'sabich'], ['השיפודייה', 'skewers'], ['מסעדה כורדית', 'kurdish'], ["ג'חנון בר", 'yemeni'], ['Thai House', 'thai']]) {
    assert.equal(matchesCuisine(named(name), type), true, name);
  }
  assert.equal(matchesCuisine(named('Turkey Sandwich'), 'turkish'), false);
});

test('a hummus place is not a falafel or shawarma place by its type alone', () => {
  assert.equal(matchesCuisine({ name: 'חומוס אליהו', place_type: 'hummus' }, 'falafel'), false);
  assert.equal(matchesCuisine({ name: 'חומוס אליהו', place_type: 'hummus' }, 'shawarma'), false);
  assert.equal(matchesCuisine({ name: 'פלאפל ושווארמה', place_type: 'hummus' }, 'falafel'), true);
});
