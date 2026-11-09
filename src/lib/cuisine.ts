import type { Lang } from './lang';

// Food categories. Keys match what the importer stores in places.cuisine.

export const CUISINES: Record<string, { label: string; en: string; emoji: string }> = {
  // dishes people look for
  pizza: { label: 'פיצה', en: 'Pizza', emoji: '🍕' },
  burger: { label: 'המבורגר', en: 'Burgers', emoji: '🍔' },
  schnitzel: { label: 'שניצל', en: 'Schnitzel', emoji: '🍗' },
  falafel: { label: 'פלאפל', en: 'Falafel', emoji: '🧆' },
  hummus: { label: 'חומוס', en: 'Hummus', emoji: '🫘' },
  shawarma: { label: 'שווארמה', en: 'Shawarma', emoji: '🥙' },
  sabich: { label: 'סביח', en: 'Sabich', emoji: '🍆' },
  skewers: { label: 'שיפודים', en: 'Skewers', emoji: '🍢' },
  burekas: { label: 'בורקס', en: 'Burekas', emoji: '🥮' },
  shakshuka: { label: 'שקשוקה', en: 'Shakshuka', emoji: '🍳' },
  sandwich: { label: 'כריכים וטוסטים', en: 'Sandwiches', emoji: '🥪' },
  bagel: { label: 'בייגל', en: 'Bagels', emoji: '🥯' },
  salad: { label: 'סלטים', en: 'Salads', emoji: '🥗' },
  poke: { label: 'פוקי וקערות', en: 'Poke & bowls', emoji: '🐠' },
  sushi: { label: 'סושי', en: 'Sushi', emoji: '🍣' },
  // meat, chicken and fish
  meat: { label: 'בשרים וגריל', en: 'Meat & grill', emoji: '🔥' },
  steak_house: { label: 'סטייקיה', en: 'Steakhouse', emoji: '🥩' },
  chicken: { label: 'עוף', en: 'Chicken', emoji: '🐔' },
  fish: { label: 'דגים', en: 'Fish', emoji: '🐟' },
  seafood: { label: 'פירות ים', en: 'Seafood', emoji: '🦐' },
  // cafés and sweets
  coffee_shop: { label: 'בית קפה', en: 'Café', emoji: '☕' },
  breakfast: { label: 'ארוחת בוקר', en: 'Breakfast', emoji: '🥞' },
  bakery: { label: 'מאפים', en: 'Bakery', emoji: '🥐' },
  dessert: { label: 'קינוחים', en: 'Desserts', emoji: '🍰' },
  ice_cream: { label: 'גלידה', en: 'Ice cream', emoji: '🍦' },
  chocolate: { label: 'שוקולד', en: 'Chocolate', emoji: '🍫' },
  waffle: { label: 'וופל וקרפ', en: 'Waffles & crêpes', emoji: '🧇' },
  juice: { label: 'מיצים ושייקים', en: 'Juice & shakes', emoji: '🧃' },
  bar: { label: 'בר ופאב', en: 'Bar & pub', emoji: '🍺' },
  // Israeli home kitchens, by community
  middle_eastern: { label: 'מזרחי', en: 'Middle Eastern', emoji: '🫓' },
  moroccan: { label: 'מרוקאי', en: 'Moroccan', emoji: '🫕' },
  iraqi: { label: 'עיראקי', en: 'Iraqi', emoji: '🍲' },
  kurdish: { label: 'כורדי', en: 'Kurdish', emoji: '🥣' },
  persian: { label: 'פרסי', en: 'Persian', emoji: '🍚' },
  yemeni: { label: 'תימני', en: 'Yemeni', emoji: '🫔' },
  tripolitan: { label: 'טריפוליטאי ולובי', en: 'Libyan', emoji: '🌶️' },
  tunisian: { label: 'תוניסאי', en: 'Tunisian', emoji: '🫑' },
  ethiopian: { label: 'אתיופי', en: 'Ethiopian', emoji: '🥘' },
  georgian: { label: 'גאורגי', en: 'Georgian', emoji: '🧀' },
  bukharan: { label: 'בוכרי', en: 'Bukharan', emoji: '🥕' },
  ashkenazi: { label: 'אשכנזי', en: 'Ashkenazi', emoji: '🥔' },
  balkan: { label: 'בלקני', en: 'Balkan', emoji: '🍅' },
  russian: { label: 'רוסי', en: 'Russian', emoji: '🥟' },
  // kitchens from around the world
  italian: { label: 'איטלקי', en: 'Italian', emoji: '🍝' },
  french: { label: 'צרפתי', en: 'French', emoji: '🥖' },
  spanish: { label: 'ספרדי', en: 'Spanish', emoji: '🫒' },
  greek: { label: 'יווני', en: 'Greek', emoji: '🏛️' },
  turkish: { label: 'טורקי', en: 'Turkish', emoji: '🧿' },
  american: { label: 'אמריקאי', en: 'American', emoji: '🌭' },
  mexican: { label: 'מקסיקני', en: 'Mexican', emoji: '🌮' },
  argentinian: { label: 'ארגנטינאי', en: 'Argentinian', emoji: '🧉' },
  asian: { label: 'אסייתי', en: 'Asian', emoji: '🍜' },
  japanese: { label: 'יפני', en: 'Japanese', emoji: '🍱' },
  chinese: { label: 'סיני', en: 'Chinese', emoji: '🥡' },
  thai: { label: 'תאילנדי', en: 'Thai', emoji: '🥥' },
  vietnamese: { label: 'וייטנאמי', en: 'Vietnamese', emoji: '🌿' },
  korean: { label: 'קוריאני', en: 'Korean', emoji: '🥢' },
  indian: { label: 'הודי', en: 'Indian', emoji: '🍛' },
  // the kind of kitchen
  vegan: { label: 'טבעוני', en: 'Vegan', emoji: '🌱' },
  vegetarian: { label: 'צמחוני', en: 'Vegetarian', emoji: '🥦' },
  healthy: { label: 'בריא', en: 'Healthy', emoji: '🥑' },
};

/** The same kinds of food in groups, so picking one is quick: look at the group, tap the food. */
export const CUISINE_GROUPS: { id: string; label: string; en: string; items: string[] }[] = [
  { id: 'dishes', label: 'מנות אהובות', en: 'Favorite dishes', items: ['pizza', 'burger', 'schnitzel', 'falafel', 'hummus', 'shawarma', 'sabich', 'skewers', 'burekas', 'shakshuka', 'sandwich', 'bagel', 'salad', 'poke', 'sushi'] },
  { id: 'meat', label: 'בשר, עוף ודגים', en: 'Meat, chicken and fish', items: ['meat', 'steak_house', 'chicken', 'fish', 'seafood'] },
  { id: 'sweet', label: 'בתי קפה ומתוקים', en: 'Cafés and sweets', items: ['coffee_shop', 'breakfast', 'bakery', 'dessert', 'ice_cream', 'chocolate', 'waffle', 'juice', 'bar'] },
  { id: 'home', label: 'מטבחי העדות', en: 'Community kitchens', items: ['middle_eastern', 'moroccan', 'iraqi', 'kurdish', 'persian', 'yemeni', 'tripolitan', 'tunisian', 'ethiopian', 'georgian', 'bukharan', 'ashkenazi', 'balkan', 'russian'] },
  { id: 'world', label: 'מטבחים מהעולם', en: 'World kitchens', items: ['italian', 'french', 'spanish', 'greek', 'turkish', 'american', 'mexican', 'argentinian', 'asian', 'japanese', 'chinese', 'thai', 'vietnamese', 'korean', 'indian'] },
  { id: 'diet', label: 'סגנון', en: 'Style', items: ['vegan', 'vegetarian', 'healthy'] },
];

/** The category chips in the filter bar, in order. The first ones show at once, the rest under "more". */
export const CUISINE_FILTERS = [
  'pizza', 'burger', 'sushi', 'coffee_shop', 'hummus', 'falafel', 'shawarma', 'schnitzel', 'meat', 'asian', 'italian',
  'bakery', 'dessert', 'ice_cream', 'breakfast', 'fish', 'mexican', 'indian',
];
/** Every kind of food the filters can find, for "more kinds". */
export const ALL_CUISINE_FILTERS = CUISINE_GROUPS.flatMap((g) => g.items);

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
  schnitzel: /שניצל|schnitzel/i,
  sabich: /סביח|sabich/i,
  skewers: /שיפוד|shipud|skewer|kebab|קבב/i,
  burekas: /בורקס|burek/i,
  shakshuka: /שקשוק|shakshuk/i,
  poke: /פוקי|פוקה|(?:^|\s)poke\b|bowl/i,
  seafood: /פירות ים|sea ?food|shrimp|שרימפ/i,
  chocolate: /שוקולד|chocolat/i,
  waffle: /וופל|(?:^|\s)קרפ|waffle|cr[eê]pe/i,
  bar: /פאב|\bpub\b|בירה|\bbeer/i,
  moroccan: /מרוקא|maroc|morocc/i,
  iraqi: /עיראק|iraq|קובה|kubb/i,
  kurdish: /כורד|kurd/i,
  persian: /(?:^|\s)[הו]?פרסי(?:ת)?(?=\s|$)|persia|\biran/i,
  yemeni: /תימנ|yemen|ג['׳]?חנון|מלאווח|jachnun|malawach/i,
  tripolitan: /טריפול|לוב(?:י|ית)|tripol|libya/i,
  tunisian: /תוניס|tunis/i,
  ethiopian: /אתיופ|ethiop|אינג'רה|injera/i,
  georgian: /גאורג|גרוזינ|georgia|חצ['׳]?פורי|khachapuri|חינקלי|khinkali/i,
  bukharan: /בוכר|bukhar|פלוב|plov/i,
  ashkenazi: /אשכנז|ashkenaz/i,
  balkan: /בלקנ|בולגר|רומני|balkan|bulgar|romania/i,
  russian: /רוסי(?:ת)?(?=\s|$)|russia|פלמני|pelmeni/i,
  french: /צרפת|french|bistro|ביסטרו|brasserie/i,
  spanish: /spanish|espa[ñn]ol|tapas|טאפאס|paella|פאייה/i,
  greek: /יוונ|greek|gyro|souvlaki|סובלקי/i,
  turkish: /טורק|\bturk(?!ey)|kebap|lahmacun|לחמג['׳]?ון/i,
  american: /אמריקא|american|diner|דיינר|hot ?dog|נקניקי/i,
  argentinian: /ארגנטינ|argentin|parrilla|פריז'ה/i,
  thai: /תאילנד|\bthai/i,
  vietnamese: /וייטנאמ|vietnam|\bpho\b|באן מי|banh mi/i,
  korean: /קוריא|korea/i,
  healthy: /בריא|healthy|organic|אורגני/i,
  vegan: /טבעונ|vegan/i,
  vegetarian: /צמחונ|vegetarian|veggie/i,
};

/** Place types that count as a category on their own. */
const TYPE_HINTS: Record<string, string[]> = {
  pizza: ['pizza'], sushi: ['sushi'], japanese: ['sushi'], asian: ['sushi'],
  hummus: ['hummus'], middle_eastern: ['hummus'],
  burger: [], meat: ['grill'], steak_house: ['grill'],
  coffee_shop: ['cafe'], bakery: ['bakery'], ice_cream: ['ice_cream'], dessert: ['ice_cream', 'bakery'],
};

/** Several kinds of food together: a place fits if it is any of them. */
export const matchesAnyCuisine = (p: { name: string; place_type?: string | null; cuisine?: string[] | null }, list: string[]) =>
  list.some((c) => matchesCuisine(p, c));

/** Does this place belong to the category? Stored categories first, then type, then the name. */
export function matchesCuisine(p: { name: string; place_type?: string | null; cuisine?: string[] | null }, c: string): boolean {
  if (p.cuisine?.includes(c)) return true;
  if (c === 'middle_eastern' && p.cuisine?.some((x) => ['hummus', 'falafel', 'shawarma'].includes(x))) return true;
  if (c === 'asian' && p.cuisine?.some((x) => ['sushi', 'japanese', 'chinese', 'thai', 'vietnamese', 'korean', 'poke'].includes(x))) return true;
  if (p.place_type && TYPE_HINTS[c]?.includes(p.place_type)) return true;
  return NAME_HINTS[c]?.test(p.name) ?? false;
}

/** Broad types that say less than a more exact one next to them. */
const COVERED_BY: Record<string, string[]> = {
  asian: ['sushi', 'japanese', 'chinese', 'thai', 'vietnamese', 'korean'],
  chicken: ['schnitzel'],
  japanese: ['sushi'],
  italian: ['pizza'],
  middle_eastern: ['hummus', 'falafel', 'shawarma'],
  steak_house: ['meat'],
};

/** The food a place serves, the same way the filters see it. A few at most, the exact ones first. */
export function placeFoods(p: { name: string; place_type?: string | null; cuisine?: string[] | null }, max = 3): string[] {
  const stored = (p.cuisine ?? []).filter((c) => CUISINES[c]);
  const found = [...new Set([...stored, ...ALL_CUISINE_FILTERS.filter((c) => matchesCuisine(p, c))])];
  return found.filter((c) => !COVERED_BY[c]?.some((x) => found.includes(x))).slice(0, max);
}
