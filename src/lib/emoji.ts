import type { Need } from './types';

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

export const NEED_EMOJI: Record<Need, string> = {
  kosher: '🍽️',
  vegan: '🌱',
  gluten_free: '🌾',
};
