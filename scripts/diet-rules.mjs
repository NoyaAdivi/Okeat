// Which vegan / vegetarian guesses follow from what we already know about a place.
// Allergies are never guessed: a wrong "no peanuts" can hurt someone.
const VEGETARIAN_DISHES = new Set(['pizza', 'hummus', 'falafel', 'coffee_shop', 'salad', 'juice', 'ice_cream', 'dessert', 'bakery', 'bagel', 'breakfast', 'italian', 'indian']);
const VEGAN_DISHES = new Set(['hummus', 'falafel']);

/** @returns {{need: string, level: string}[]} guesses, strongest first */
export function dietRules(place, claims = {}) {
  const c = place.cuisine ?? [];
  const out = [];
  const veganFull = claims.vegan === 'full' || c.includes('vegan') || place.place_type === 'vegan_restaurant';
  if (veganFull) out.push({ need: 'vegan', level: 'full' });
  else if (c.some((x) => VEGAN_DISHES.has(x))) out.push({ need: 'vegan', level: 'options' });

  if (veganFull || c.includes('vegetarian')) out.push({ need: 'vegetarian', level: 'full' });
  else if (claims.vegan === 'options' || c.some((x) => VEGETARIAN_DISHES.has(x))) out.push({ need: 'vegetarian', level: 'options' });
  return out;
}
