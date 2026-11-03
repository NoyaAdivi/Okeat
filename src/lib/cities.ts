// Pages for the main cities, so people can find them from a search engine.
export interface City { slug: string; he: string; en: string; lat: number; lng: number; emoji: string }

export const CITIES: City[] = [
  { slug: 'tel-aviv', he: 'תל אביב', en: 'Tel Aviv', lat: 32.0853, lng: 34.7818, emoji: '🏖️' },
  { slug: 'jerusalem', he: 'ירושלים', en: 'Jerusalem', lat: 31.7683, lng: 35.2137, emoji: '🏛️' },
  { slug: 'haifa', he: 'חיפה', en: 'Haifa', lat: 32.794, lng: 34.9896, emoji: '⛰️' },
  { slug: 'rishon-lezion', he: 'ראשון לציון', en: 'Rishon LeZion', lat: 31.973, lng: 34.7925, emoji: '🍇' },
  { slug: 'petah-tikva', he: 'פתח תקווה', en: 'Petah Tikva', lat: 32.0871, lng: 34.8878, emoji: '🌳' },
  { slug: 'ashdod', he: 'אשדוד', en: 'Ashdod', lat: 31.8014, lng: 34.6435, emoji: '⚓' },
  { slug: 'netanya', he: 'נתניה', en: 'Netanya', lat: 32.3215, lng: 34.8532, emoji: '🌊' },
  { slug: 'beer-sheva', he: 'באר שבע', en: 'Beer Sheva', lat: 31.2518, lng: 34.7913, emoji: '🐫' },
  { slug: 'holon', he: 'חולון', en: 'Holon', lat: 32.0158, lng: 34.7874, emoji: '🎈' },
  { slug: 'ramat-gan', he: 'רמת גן', en: 'Ramat Gan', lat: 32.0823, lng: 34.8106, emoji: '🏙️' },
  { slug: 'herzliya', he: 'הרצליה', en: 'Herzliya', lat: 32.1624, lng: 34.8447, emoji: '⛵' },
  { slug: 'eilat', he: 'אילת', en: 'Eilat', lat: 29.5577, lng: 34.9519, emoji: '🐠' },
];

// Lists by need, across the country.
export interface Topic { slug: string; need: 'gluten_free' | 'vegan' | 'kosher' | 'vegetarian'; he: string; en: string; emoji: string }

export const TOPICS: Topic[] = [
  { slug: 'kosher', need: 'kosher', he: 'כשר', en: 'Kosher', emoji: '🍽️' },
  { slug: 'vegan', need: 'vegan', he: 'טבעוני', en: 'Vegan', emoji: '🌱' },
  { slug: 'vegetarian', need: 'vegetarian', he: 'צמחוני', en: 'Vegetarian', emoji: '🥦' },
  { slug: 'gluten-free', need: 'gluten_free', he: 'ללא גלוטן', en: 'Gluten free', emoji: '🌾' },
];
