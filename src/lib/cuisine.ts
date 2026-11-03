import type { Lang } from './lang';

// Food categories. Keys match what the importer stores in places.cuisine.

export const CUISINES: Record<string, { label: string; en: string; emoji: string }> = {
  pizza: { label: 'פיצה', en: 'Pizza', emoji: '🍕' },
  burger: { label: 'המבורגר', en: 'Burgers', emoji: '🍔' },
  sushi: { label: 'סושי', en: 'Sushi', emoji: '🍣' },
  japanese: { label: 'יפני', en: 'Japanese', emoji: '🍱' },
  chinese: { label: 'סיני', en: 'Chinese', emoji: '🥡' },
  asian: { label: 'אסייתי', en: 'Asian', emoji: '🍜' },
  indian: { label: 'הודי', en: 'Indian', emoji: '🍛' },
  italian: { label: 'איטלקי', en: 'Italian', emoji: '🍝' },
  mexican: { label: 'מקסיקני', en: 'Mexican', emoji: '🌮' },
  middle_eastern: { label: 'מזרחי', en: 'Middle Eastern', emoji: '🥙' },
  hummus: { label: 'חומוס', en: 'Hummus', emoji: '🧆' },
  falafel: { label: 'פלאפל', en: 'Falafel', emoji: '🧆' },
  shawarma: { label: 'שווארמה', en: 'Shawarma', emoji: '🥙' },
  meat: { label: 'בשרים וגריל', en: 'Meat & grill', emoji: '🥩' },
  steak_house: { label: 'סטייקיה', en: 'Steakhouse', emoji: '🥩' },
  chicken: { label: 'עוף', en: 'Chicken', emoji: '🍗' },
  fish: { label: 'דגים', en: 'Fish', emoji: '🐟' },
  coffee_shop: { label: 'בית קפה', en: 'Café', emoji: '☕' },
  breakfast: { label: 'ארוחת בוקר', en: 'Breakfast', emoji: '🍳' },
  sandwich: { label: 'כריכים', en: 'Sandwiches', emoji: '🥪' },
  bagel: { label: 'בייגל', en: 'Bagels', emoji: '🥯' },
  bakery: { label: 'מאפים', en: 'Bakery', emoji: '🥐' },
  dessert: { label: 'קינוחים', en: 'Desserts', emoji: '🍰' },
  ice_cream: { label: 'גלידה', en: 'Ice cream', emoji: '🍦' },
  salad: { label: 'סלטים', en: 'Salads', emoji: '🥗' },
  juice: { label: 'מיצים ושייקים', en: 'Juice & shakes', emoji: '🧃' },
  vegan: { label: 'טבעוני', en: 'Vegan', emoji: '🌱' },
  vegetarian: { label: 'צמחוני', en: 'Vegetarian', emoji: '🥕' },
  french: { label: 'צרפתי', en: 'French', emoji: '🥖' },
  georgian: { label: 'גאורגי', en: 'Georgian', emoji: '🫓' },
  ethiopian: { label: 'אתיופי', en: 'Ethiopian', emoji: '🍲' },
  yemeni: { label: 'תימני', en: 'Yemeni', emoji: '🫓' },
  moroccan: { label: 'מרוקאי', en: 'Moroccan', emoji: '🍲' },
  american: { label: 'אמריקאי', en: 'American', emoji: '🌭' },
};

/** The category chips in the filter bar, in order. */
export const CUISINE_FILTERS = [
  'pizza', 'burger', 'sushi', 'coffee_shop', 'hummus', 'shawarma', 'meat', 'asian', 'italian',
  'bakery', 'dessert', 'ice_cream', 'breakfast', 'fish', 'mexican', 'indian',
];

export const cuisineLabel = (c: string, lang: Lang = 'he') => (lang === 'en' ? CUISINES[c]?.en : CUISINES[c]?.label) ?? c;
export const cuisineEmoji = (c: string) => CUISINES[c]?.emoji ?? '🍴';

// Words in a place's name (Hebrew / English) that point to a category. Used together with the
// stored categories, so a filter still finds places whose category wasn't recorded yet.
const NAME_HINTS: Record<string, RegExp> = {
  pizza: /פיצה|פיצר|פיצת|פיצל|pizz/i,
  burger: /בורגר|burger/i,
  sushi: /סושי|sushi/i,
  japanese: /יפנ|ראמן|ramen|japan|sushi|סושי/i,
  chinese: /סינית|סיני(?=\s|$)|china|chinese|wok|ווק/i,
  asian: /תאילנד|אסיה|אסיית|וייטנאמ|נודל|ווק|ראמן|\basian?\b|\bthai|wok|noodle|ramen|sushi|סושי|(?:^|\s)פו(?=\s|$)|\bpho\b/i,
  indian: /(?:^|\s)[הו]?הודי(?:ת)?(?=\s|$)|\bindian?\b|curry|(?:^|\s)קארי(?=\s|$)|טנדור|tandoor/i,
  italian: /איטלק|פסטה|italia|italy|pasta|trattoria|osteria|pizz|פיצה|פיצר|פיצת|פיצל/i,
  mexican: /מקסיק|טאקו|בוריטו|mexic|taco|burrito/i,
  middle_eastern: /חומוס|פלאפל|שווארמה|שווארמ|hummus|falafel|shawarma|מזרח/i,
  hummus: /חומוס|hummus|humus/i,
  falafel: /פלאפל|falafel/i,
  shawarma: /שווארמ|שוורמ|shawarma|shwarma/i,
  meat: /(?<!מ)בשר(?!ון)|גריל|סטייק|אסאדו|מעשנה|grill|steak|meat|bbq|asado|smoke(?:house|d)/i,
  steak_house: /סטייק|steak/i,
  chicken: /עוף|שניצל|chicken|schnitzel|wings/i,
  fish: /(?:^|\s)[הו]?דג(?:ים|י)?(?=\s|$)|פירות ים|fish|sea ?food/i,
  coffee_shop: /קפה|caf[eé]|coffee|espresso|אספרסו|ארומה|\baroma\b|קפה ג'ו|cofix|קופיקס/i,
  breakfast: /(?:^|\s)[הו]?בוקר(?=\s|$)|בראנץ|breakfast|brunch/i,
  sandwich: /כריך|סנדוויץ|sandwich|טוסט/i,
  bagel: /בייגל|bagel/i,
  bakery: /מאפ(?:ה|י)|(?:^|\s)[הו]?לחם|קונדיטור|bakery|bread|boulanger|patisserie/i,
  dessert: /קינוח|עוגה|עוגות|שוקולד|וופל|(?:^|\s)קרפ|dessert|cake|chocolate|waffle|crepe|sweet/i,
  ice_cream: /גלידה|גלידר|ice ?cream|gelat|frozen|יוגורט/i,
  salad: /סלט|salad/i,
  juice: /מיץ|מיצים|שייק|juice|smoothie|shake/i,
};

/** Place types that count as a category on their own. */
const TYPE_HINTS: Record<string, string[]> = {
  pizza: ['pizza'], sushi: ['sushi'], japanese: ['sushi'], asian: ['sushi'],
  hummus: ['hummus'], middle_eastern: ['hummus'], falafel: ['hummus'], shawarma: ['hummus'],
  burger: [], meat: ['grill'], steak_house: ['grill'],
  coffee_shop: ['cafe'], bakery: ['bakery'], ice_cream: ['ice_cream'], dessert: ['ice_cream', 'bakery'],
};

/** Does this place belong to the category? Stored categories first, then type, then the name. */
/** Several kinds of food together: a place fits if it is any of them. */
export const matchesAnyCuisine = (p: { name: string; place_type?: string | null; cuisine?: string[] | null }, list: string[]) =>
  list.some((c) => matchesCuisine(p, c));

export function matchesCuisine(p: { name: string; place_type?: string | null; cuisine?: string[] | null }, c: string): boolean {
  if (p.cuisine?.includes(c)) return true;
  if (c === 'middle_eastern' && p.cuisine?.some((x) => ['hummus', 'falafel', 'shawarma'].includes(x))) return true;
  if (c === 'asian' && p.cuisine?.some((x) => ['sushi', 'japanese', 'chinese', 'thai', 'vietnamese'].includes(x))) return true;
  if (p.place_type && TYPE_HINTS[c]?.includes(p.place_type)) return true;
  return NAME_HINTS[c]?.test(p.name) ?? false;
}

/** Broad types that say less than a more exact one next to them. */
const COVERED_BY: Record<string, string[]> = {
  asian: ['sushi', 'japanese', 'chinese'],
  japanese: ['sushi'],
  italian: ['pizza'],
  middle_eastern: ['hummus', 'falafel', 'shawarma'],
  steak_house: ['meat'],
};

/** The food a place serves, the same way the filters see it. A few at most, the exact ones first. */
export function placeFoods(p: { name: string; place_type?: string | null; cuisine?: string[] | null }, max = 3): string[] {
  const stored = (p.cuisine ?? []).filter((c) => CUISINES[c]);
  const found = [...new Set([...stored, ...CUISINE_FILTERS.filter((c) => matchesCuisine(p, c))])];
  return found.filter((c) => !COVERED_BY[c]?.some((x) => found.includes(x))).slice(0, max);
}
