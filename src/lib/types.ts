// Shared domain types. Keep in sync with supabase/migrations/0001_init.sql.

export type Need = 'kosher' | 'vegan' | 'gluten_free';
export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'disputed' | 'superseded';

export type KosherLevel = 'marked' | 'pikuach' | 'rabanut' | 'mehadrin' | 'badatz';
export type VeganLevel = 'options' | 'full';
export type GlutenFreeLevel = 'menu' | 'kitchen';
export type Level = KosherLevel | VeganLevel | GlutenFreeLevel;

export interface LevelInfo {
  value: Level;
  label: string;
  rank: number;
  note?: string;
}

// Mirrors level_rank() in SQL. Higher rank = stricter / safer.
export const LEVELS: Record<Need, LevelInfo[]> = {
  kosher: [
    { value: 'marked', label: 'מסומן ככשר', rank: 0, note: 'מסומן ככשר ב-OpenStreetMap. עוד אין צילום של תעודה.' },
    { value: 'pikuach', label: 'מפוקח', rank: 0, note: 'השגחה פרטית, לא של הרבנות. לפי החוק המקום לא מוצג ככשר.' },
    { value: 'rabanut', label: 'כשר, רבנות', rank: 1 },
    { value: 'mehadrin', label: 'כשר למהדרין', rank: 2 },
    { value: 'badatz', label: 'בד״ץ', rank: 3 },
  ],
  vegan: [
    { value: 'options', label: 'יש מנות טבעוניות', rank: 1 },
    { value: 'full', label: 'טבעוני לגמרי', rank: 2, note: 'אין מוצרים מן החי בכל התפריט.' },
  ],
  gluten_free: [
    { value: 'menu', label: 'תפריט ללא גלוטן', rank: 1, note: 'מוכן במטבח משותף. יש סיכון לזיהום צולב.' },
    { value: 'kitchen', label: 'מטבח נפרד', rank: 2, note: 'מתאים לצליאקים.' },
  ],
};

export const NEED_LABELS: Record<Need, { label: string; letter: string }> = {
  kosher: { label: 'כשר', letter: 'כ' },
  vegan: { label: 'טבעוני', letter: 'ט' },
  gluten_free: { label: 'ללא גלוטן', letter: 'ג' },
};

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
export const placeTypeLabel = (slug: string) => PLACE_TYPES[slug] ?? slug;

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
