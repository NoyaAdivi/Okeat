import type { Need } from './types';
import { cuisineEmoji, placeFoods } from './cuisine';

export const PLACE_EMOJI: Record<string, string> = {
  restaurant: '🍴',
  cafe: '☕',
  bakery: '🥐',
  pizza: '🍕',
  ice_cream: '🍦',
  hummus: '🧆',
  sushi: '🍣',
  grill: '🍔',
  vegan_restaurant: '🥗',
  stand: '🌯',
  other: '📍',
};

export const placeEmoji = (type: string) => PLACE_EMOJI[type] ?? '🍴';

/** The emoji beside a place's name: its main kind of food (falafel, schnitzel, Yemeni…), else its type. */
export function placeIcon(p: { name: string; place_type: string; cuisine?: string[] | null }): string {
  const food = placeFoods(p, 1)[0];
  return food ? cuisineEmoji(food) : placeEmoji(p.place_type);
}

export const NEED_EMOJI: Record<Need, string> = {
  kosher: '🍽️',
  vegan: '🌱',
  gluten_free: '🌾',
  vegetarian: '🥦',
  dairy_free: '🥛',
  egg_free: '🥚',
  peanut_free: '🥜',
  nut_free: '🌰',
  sesame_free: '🫓',
  soy_free: '🫘',
};
