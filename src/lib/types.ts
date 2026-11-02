// Shared domain types. Keep in sync with supabase/migrations/0001_init.sql.

import type { Lang } from './lang';

export type MainNeed = 'kosher' | 'vegan' | 'gluten_free';
/** Vegetarian and allergies. Each has the same two levels: some dishes / the whole place. */
export type ExtraNeed = 'vegetarian' | 'dairy_free' | 'egg_free' | 'peanut_free' | 'nut_free' | 'sesame_free' | 'soy_free';
export type Need = MainNeed | ExtraNeed;
export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'disputed' | 'superseded';

export type KosherLevel = 'marked' | 'unknown' | 'pikuach' | 'tzohar' | 'rabanut' | 'mehadrin' | 'badatz';
export type VeganLevel = 'options' | 'full';
/** vegetarian and allergies use the same two levels */
export type ExtraLevel = 'options' | 'full';
export type GlutenFreeLevel = 'menu' | 'kitchen';
export type Level = KosherLevel | VeganLevel | GlutenFreeLevel;

export interface LevelInfo {
  value: Level;
  label: string;
  /** English label */
  en: string;
  rank: number;
  note?: string;
  noteEn?: string;
}

const twoLevels = (some: [string, string], all: [string, string], allNote?: [string, string]): LevelInfo[] => [
  { value: 'options', label: some[0], en: some[1], rank: 1, note: 'מוכן במטבח משותף. אם יש אלרגיה, כדאי לשאול במקום.', noteEn: 'Made in a shared kitchen. With an allergy, ask on site.' },
  { value: 'full', label: all[0], en: all[1], rank: 2, note: allNote?.[0], noteEn: allNote?.[1] },
];

// Mirrors level_rank() in SQL. Higher rank = stricter / safer.
export const LEVELS: Record<Need, LevelInfo[]> = {
  kosher: [
    { value: 'marked', label: 'מסומן ככשר', en: 'Marked kosher', rank: 0, note: 'מסומן ככשר ב-OpenStreetMap. עוד אין צילום של תעודה.', noteEn: 'Marked as kosher on OpenStreetMap. No photo of a certificate yet.' },
    { value: 'unknown', label: 'כשר, הגוף המשגיח לא ידוע', en: 'Kosher, supervising body unknown', rank: 0, note: 'מישהו ראה שהמקום כשר, אבל לא יודע מי נותן את ההשגחה.', noteEn: "Someone saw the place is kosher, but doesn't know who supervises it." },
    { value: 'pikuach', label: 'מפוקח (השגחה פרטית)', en: 'Supervised (private)', rank: 0, note: 'השגחה פרטית, לא של הרבנות. לפי החוק המקום לא מוצג ככשר.', noteEn: 'Private supervision, not the Rabbinate. By law the place is not presented as kosher.' },
    { value: 'tzohar', label: 'השגחת צהר', en: 'Tzohar supervision', rank: 0, note: 'השגחה פרטית של ארגון צהר. לפי החוק המקום לא מוצג ככשר.', noteEn: 'Private supervision by Tzohar. By law the place is not presented as kosher.' },
    { value: 'rabanut', label: 'כשר, רבנות', en: 'Kosher (Rabbinate)', rank: 1 },
    { value: 'mehadrin', label: 'כשר למהדרין', en: 'Kosher Mehadrin', rank: 2 },
    { value: 'badatz', label: 'בד״ץ', en: 'Badatz', rank: 3 },
  ],
  vegan: [
    { value: 'options', label: 'יש מנות טבעוניות', en: 'Vegan options', rank: 1 },
    { value: 'full', label: 'טבעוני לגמרי', en: 'Fully vegan', rank: 2, note: 'אין מוצרים מן החי בכל התפריט.', noteEn: 'No animal products anywhere on the menu.' },
  ],
  gluten_free: [
    { value: 'menu', label: 'תפריט ללא גלוטן', en: 'Gluten-free menu', rank: 1, note: 'מוכן במטבח משותף. יש סיכון לזיהום צולב.', noteEn: 'Made in a shared kitchen. There is a risk of cross-contamination.' },
    { value: 'kitchen', label: 'מטבח נפרד', en: 'Separate kitchen', rank: 2, note: 'מתאים לצליאקים.', noteEn: 'Suitable for people with celiac disease.' },
  ],
  vegetarian: [
    { value: 'options', label: 'יש מנות צמחוניות', en: 'Vegetarian options', rank: 1 },
    { value: 'full', label: 'צמחוני לגמרי', en: 'Fully vegetarian', rank: 2, note: 'אין בשר ודגים בכל התפריט.', noteEn: 'No meat or fish anywhere on the menu.' },
  ],
  dairy_free: twoLevels(['יש מנות בלי חלב', 'Dairy-free options'], ['בלי חלב בכלל', 'No dairy at all'], ['אין מוצרי חלב בכל המקום.', 'No dairy products anywhere in the place.']),
  egg_free: twoLevels(['יש מנות בלי ביצים', 'Egg-free options'], ['בלי ביצים בכלל', 'No eggs at all']),
  peanut_free: twoLevels(['יש מנות בלי בוטנים', 'Peanut-free options'], ['בלי בוטנים בכלל', 'No peanuts at all'], ['אין בוטנים בכל המטבח.', 'No peanuts anywhere in the kitchen.']),
  nut_free: twoLevels(['יש מנות בלי אגוזים', 'Nut-free options'], ['בלי אגוזים בכלל', 'No nuts at all'], ['אין אגוזים בכל המטבח.', 'No nuts anywhere in the kitchen.']),
  sesame_free: twoLevels(['יש מנות בלי שומשום', 'Sesame-free options'], ['בלי שומשום בכלל', 'No sesame at all']),
  soy_free: twoLevels(['יש מנות בלי סויה', 'Soy-free options'], ['בלי סויה בכלל', 'No soy at all']),
};

export const NEED_LABELS: Record<Need, { label: string; letter: string; en: string; letterEn: string }> = {
  kosher: { label: 'כשר', letter: 'כ', en: 'Kosher', letterEn: 'K' },
  vegan: { label: 'טבעוני', letter: 'ט', en: 'Vegan', letterEn: 'V' },
  gluten_free: { label: 'ללא גלוטן', letter: 'ג', en: 'Gluten-free', letterEn: 'G' },
  vegetarian: { label: 'צמחוני', letter: 'צ', en: 'Vegetarian', letterEn: 'Vg' },
  dairy_free: { label: 'בלי חלב', letter: 'ח', en: 'Dairy-free', letterEn: 'D' },
  egg_free: { label: 'בלי ביצים', letter: 'ב', en: 'Egg-free', letterEn: 'E' },
  peanut_free: { label: 'בלי בוטנים', letter: 'בט', en: 'Peanut-free', letterEn: 'P' },
  nut_free: { label: 'בלי אגוזים', letter: 'א', en: 'Nut-free', letterEn: 'N' },
  sesame_free: { label: 'בלי שומשום', letter: 'ש', en: 'Sesame-free', letterEn: 'S' },
  soy_free: { label: 'בלי סויה', letter: 'ס', en: 'Soy-free', letterEn: 'Sy' },
};

/** "כשר" / "Kosher" */
export const needLabel = (need: Need, lang: Lang = 'he') => (lang === 'en' ? NEED_LABELS[need].en : NEED_LABELS[need].label);
/** the letter in a seal: כ / K */
export const needLetter = (need: Need, lang: Lang = 'he') => (lang === 'en' ? NEED_LABELS[need].letterEn : NEED_LABELS[need].letter);
/** a level's label in the language */
export const levelText = (info: LevelInfo, lang: Lang = 'he') => (lang === 'en' ? info.en : info.label);
export const levelNote = (info: LevelInfo, lang: Lang = 'he') => (lang === 'en' ? info.noteEn : info.note);

// places.place_type slugs -> what people read
export const PLACE_TYPES: Record<string, string> = {
  restaurant: 'מסעדה',
  cafe: 'בית קפה',
  bakery: 'מאפייה',
  pizza: 'פיצרייה',
  ice_cream: 'גלידרייה',
  hummus: 'חומוסייה',
  sushi: 'סושייה',
  grill: 'גריל בשרים',
  vegan_restaurant: 'מסעדה טבעונית',
  stand: 'דוכן',
  other: 'אחר',
};
export const PLACE_TYPES_EN: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  bakery: 'Bakery',
  pizza: 'Pizzeria',
  ice_cream: 'Ice cream',
  hummus: 'Hummus place',
  sushi: 'Sushi bar',
  grill: 'Grill',
  vegan_restaurant: 'Vegan restaurant',
  stand: 'Stand',
  other: 'Other',
};
export const placeTypeLabel = (slug: string, lang: Lang = 'he') => (lang === 'en' ? PLACE_TYPES_EN[slug] : PLACE_TYPES[slug]) ?? slug;

export function levelInfo(need: Need, level: Level): LevelInfo | undefined {
  return LEVELS[need].find((l) => l.value === level);
}

// Weekly hours keyed by JS getDay() (0 = Sunday). Missing key = unknown, [] = closed.
export type WeeklyHours = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', [string, string][]>>;

export interface Certificate {
  imagePath: string;
  supervisingBody: string;
  validUntil: string; // YYYY-MM-DD
  photographedAt: string;
  expired: boolean;
}

export type ClaimSource = 'community' | 'osm' | 'auto';

export interface Claim {
  id: string;
  /** 'osm' = imported from OpenStreetMap, not yet confirmed by people */
  source: ClaimSource;
  need: Need;
  level: Level;
  status: ClaimStatus;
  note: string | null;
  confirmCount: number;
  lastConfirmedAt: string | null;
  proposedAt: string;
  certificate: Certificate | null;
}

// Row returned by the nearby_places() RPC.
export interface Place {
  id: string;
  name: string;
  place_type: string;
  address: string | null;
  lat: number;
  lng: number;
  /** null from place_by_id() when no reference point was given */
  distance_m: number | null;
  hours: WeeklyHours | null;
  /** food categories, e.g. ['pizza', 'italian'] (keys of CUISINES) */
  cuisine: string[] | null;
  /** 'osm' = from OpenStreetMap, 'auto' = guessed from the name (unconfirmed) */
  cuisine_source: 'osm' | 'auto' | 'community' | 'overture' | null;
  phone: string | null;
  website: string | null;
  claims: Claim[];
}

// Row returned by the pending_claims_near() RPC.
export interface PendingClaim {
  claim_id: string;
  place_id: string;
  place_name: string;
  need: Need;
  level: Level;
  confirm_count: number;
  proposed_at: string;
  has_certificate: boolean;
  distance_m: number;
}

// Minimum rank per need; null = not filtering on that need.
export type NeedFilter = Record<Need, number | null>;

// What the certificate reader returns to the client.
export interface ExtractedCertificate {
  isKosherCertificate: boolean;
  businessName: string | null;
  supervisingBody: string | null;
  level: KosherLevel | 'unknown';
  validUntil: string | null; // YYYY-MM-DD, converted from a Hebrew date if needed
  confidence: number; // 0..1
  issues: string[]; // things the user should double-check, in Hebrew
}

/** A place as drawn on the whole-country map (row of map_points()). Details load on open. */
export interface MapSeal {
  need: Need;
  level: Level;
  imported: boolean;
  expired: boolean;
}
export interface MapPoint {
  id: string;
  name: string;
  place_type: string;
  lat: number;
  lng: number;
  cuisine: string[] | null;
  seals: MapSeal[];
  pending: boolean;
}
