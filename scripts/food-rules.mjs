// Food type from a place's name and type. Order doesn't matter; a place can get up to 3 types.
const RULES = [
  [/ארומה|aroma|קפה קפה|cafe cafe|caf[eé] caf[eé]|גרג|greg|לנדוור|landwer|קפה ג'?ו|cofix|קופיקס|קפה נטו|ארקפה|arcaffe|קפה|caf[eé]|coffee|אספרסו|espresso/i, 'coffee_shop'],
  [/רולדין|roladin|ביגה|לחם ארז|לחמים|מאפ(ה|י)|בורקס|burekas|bakery|בייקרי|boulanger/i, 'bakery'],
  [/מקדונלד|mcdonald|בורגר|burger|אגדיר|agadir|מוזס|moses|bbb|בי בי בי/i, 'burger'],
  [/דומינו|domino|פיצה|פיצר|pizz|פאפא ג/i, 'pizza'],
  [/סושי|sushi|ג'?פניקה|japanika|יפני/i, 'sushi'],
  [/שווארמ|שוארמ|shawarma|shwarma/i, 'shawarma'],
  [/פלאפל|falafel/i, 'falafel'],
  [/חומוס|hummus|humus/i, 'hummus'],
  [/שיפוד|גריל|grill|סטייק|steak|בשרים|מעשנה|bbq|אסאדו|asado/i, 'meat'],
  [/שניצל|schnitzel|עוף|chicken|wings/i, 'chicken'],
  [/גלידה|גלידר|gelat|ice ?cream|גולדה|golda|וניליה|vaniglia/i, 'ice_cream'],
  [/קונדיטור|שוקולד|מקס ברנר|max brenner|קפולסקי|קינוח|עוגות|ממתק|חלויות|sweets|dessert|patisserie|וופל|waffle|כנאפה|knafeh/i, 'dessert'],
  [/דגים|פירות ים|fish|sea ?food/i, 'fish'],
  [/בייגל|bagel/i, 'bagel'],
  [/טוסט|כריך|סנדוויץ|sandwich|סביח|sabich/i, 'sandwich'],
  [/סלט|salad/i, 'salad'],
  [/מיץ|מיצים|שייק|juice|smoothie/i, 'juice'],
  [/נודלס|noodle|ווק|wok|ראמן|ramen|תאילנד|thai|גירף|giraffe/i, 'asian'],
  [/פסטה|pasta|איטלק|ital|trattoria|osteria/i, 'italian'],
  [/הודי|india|טנדור|tandoor|curry|קארי/i, 'indian'],
  [/מקסיק|טאקו|taco|burrito|בוריטו/i, 'mexican'],
  [/מזרח|מסעדה ערבית|lebanese|לבנונ/i, 'middle_eastern'],
  [/טבעונ|vegan/i, 'vegan'],
  [/צמחונ|vegetarian/i, 'vegetarian'],
];
const BY_TYPE = { cafe: 'coffee_shop', bakery: 'bakery', pizza: 'pizza', ice_cream: 'ice_cream', sushi: 'sushi', hummus: 'hummus', grill: 'meat', vegan_restaurant: 'vegan' };

export function foodTypes(place) {
  const out = new Set();
  for (const [re, type] of RULES) if (re.test(place.name)) out.add(type);
  if (BY_TYPE[place.place_type]) out.add(BY_TYPE[place.place_type]);
  return [...out].slice(0, 3);
}
