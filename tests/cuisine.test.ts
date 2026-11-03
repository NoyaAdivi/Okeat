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
