// Food categories. Keys match what the importer stores in places.cuisine.

export const CUISINES: Record<string, { label: string; emoji: string }> = {
  pizza: { label: 'פיצה', emoji: '🍕' },
  burger: { label: 'המבורגר', emoji: '🍔' },
  sushi: { label: 'סושי', emoji: '🍣' },
  japanese: { label: 'יפני', emoji: '🍱' },
  chinese: { label: 'סיני', emoji: '🥡' },
  asian: { label: 'אסייתי', emoji: '🍜' },
  indian: { label: 'הודי', emoji: '🍛' },
  italian: { label: 'איטלקי', emoji: '🍝' },
  mexican: { label: 'מקסיקני', emoji: '🌮' },
  middle_eastern: { label: 'מזרחי', emoji: '🥙' },
  hummus: { label: 'חומוס', emoji: '🧆' },
  falafel: { label: 'פלאפל', emoji: '🧆' },
  shawarma: { label: 'שווארמה', emoji: '🥙' },
  meat: { label: 'בשרים וגריל', emoji: '🥩' },
  steak_house: { label: 'סטייקיה', emoji: '🥩' },
  chicken: { label: 'עוף', emoji: '🍗' },
  fish: { label: 'דגים', emoji: '🐟' },
  coffee_shop: { label: 'בית קפה', emoji: '☕' },
  breakfast: { label: 'ארוחת בוקר', emoji: '🍳' },
  sandwich: { label: 'כריכים', emoji: '🥪' },
  bagel: { label: 'בייגל', emoji: '🥯' },
  bakery: { label: 'מאפים', emoji: '🥐' },
  dessert: { label: 'קינוחים', emoji: '🍰' },
  ice_cream: { label: 'גלידה', emoji: '🍦' },
  salad: { label: 'סלטים', emoji: '🥗' },
  juice: { label: 'מיצים ושייקים', emoji: '🧃' },
  vegan: { label: 'טבעוני', emoji: '🌱' },
  vegetarian: { label: 'צמחוני', emoji: '🥕' },
  french: { label: 'צרפתי', emoji: '🥖' },
  georgian: { label: 'גאורגי', emoji: '🫓' },
  ethiopian: { label: 'אתיופי', emoji: '🍲' },
  yemeni: { label: 'תימני', emoji: '🫓' },
  moroccan: { label: 'מרוקאי', emoji: '🍲' },
  american: { label: 'אמריקאי', emoji: '🌭' },
};

/** The category chips in the filter bar, in order. */
export const CUISINE_FILTERS = [
  'pizza', 'burger', 'sushi', 'coffee_shop', 'hummus', 'shawarma', 'meat', 'asian', 'italian',
  'bakery', 'dessert', 'ice_cream', 'breakfast', 'fish', 'mexican', 'indian',
];

export const cuisineLabel = (c: string) => CUISINES[c]?.label ?? c;
export const cuisineEmoji = (c: string) => CUISINES[c]?.emoji ?? '🍴';

// Words in a place's name (Hebrew / English) that point to a category. Used together with the
// stored categories, so a filter still finds places whose category wasn't recorded yet.
const NAME_HINTS: Record<string, RegExp> = {
  pizza: /פיצ|pizz/i,
  burger: /בורגר|burger/i,
  sushi: /סושי|sushi/i,
  japanese: /יפנ|ראמן|ramen|japan|sushi|סושי/i,
  chinese: /סינ|china|chinese|wok|ווק/i,
  asian: /אסי|תאי|וייטנאמ|נודל|ווק|ראמן|asia|thai|wok|noodle|ramen|sushi|סושי|pho|פו /i,
  indian: /הודי|india|curry|קארי|טנדור|tandoor/i,
  italian: /איטלק|פסטה|ital|pasta|trattoria|pizz|פיצ/i,
  mexican: /מקסיק|טאקו|בוריטו|mexic|taco|burrito/i,
  middle_eastern: /חומוס|פלאפל|שווארמה|שווארמ|hummus|falafel|shawarma|מזרח/i,
  hummus: /חומוס|hummus|humus/i,
  falafel: /פלאפל|falafel/i,
  shawarma: /שווארמ|שוורמ|shawarma|shwarma/i,
  meat: /בשר|גריל|סטייק|אסאדו|מעשנה|grill|steak|meat|bbq|asado|smoke/i,
  steak_house: /סטייק|steak/i,
  chicken: /עוף|שניצל|chicken|schnitzel|wings/i,
  fish: /דג|פירות ים|fish|sea ?food/i,
  coffee_shop: /קפה|caf[eé]|coffee|espresso|אספרסו|ארומה|aroma|קפה ג'ו|cofix|קופיקס/i,
  breakfast: /בוקר|בראנץ|breakfast|brunch/i,
  sandwich: /כריך|סנדוויץ|sandwich|טוסט/i,
  bagel: /בייגל|bagel/i,
  bakery: /מאפ|לחם|קונדיטור|bakery|bread|boulanger|patisserie/i,
  dessert: /קינוח|עוגה|עוגות|שוקולד|וופל|קרפ|dessert|cake|chocolate|waffle|crepe|sweet/i,
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
export function matchesCuisine(p: { name: string; place_type?: string | null; cuisine?: string[] | null }, c: string): boolean {
  if (p.cuisine?.includes(c)) return true;
  if (c === 'middle_eastern' && p.cuisine?.some((x) => ['hummus', 'falafel', 'shawarma'].includes(x))) return true;
  if (c === 'asian' && p.cuisine?.some((x) => ['sushi', 'japanese', 'chinese', 'thai', 'vietnamese'].includes(x))) return true;
  if (p.place_type && TYPE_HINTS[c]?.includes(p.place_type)) return true;
  return NAME_HINTS[c]?.test(p.name) ?? false;
}
