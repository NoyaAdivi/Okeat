// Small rules with no outside dependencies, covered by the tests in /tests.

const DAY = 86_400_000;

/** After this long without a new confirmation, the page asks people to check again. */
export const STALE_AFTER_DAYS = 365;
/** A certificate this close to its end gets a notice. */
export const EXPIRES_SOON_DAYS = 30;

export function isStale(lastConfirmedAt: string | null, now = new Date()): boolean {
  if (!lastConfirmedAt) return false;
  return now.getTime() - new Date(lastConfirmedAt).getTime() > STALE_AFTER_DAYS * DAY;
}

/** True when a certificate is still valid but ends within a month. validUntil is YYYY-MM-DD. */
export function expiresSoon(validUntil: string, now = new Date()): boolean {
  const left = (new Date(`${validUntil}T23:59:59`).getTime() - now.getTime()) / DAY;
  return left >= 0 && left <= EXPIRES_SOON_DAYS;
}

const clean = (text: string) => text.trim().toLowerCase().replace(/["'׳״]/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ');

/** Did the person type the name of this city? "תל אביב" counts for "תל אביב-יפו". */
export function isCityName(typed: string, city: string): boolean {
  const q = clean(typed);
  return q.length > 1 && (q === clean(city) || q === clean(city.split(/[-–]/)[0]));
}

export interface SmartSearch { needs: string[]; openNow: boolean; city: string | null; rest: string }

const NEED_WORDS: [RegExp, string][] = [
  [/(^|\s)(ללא גלוטן|בלי גלוטן|gluten[ -]free)(?=\s|$)/i, 'gluten_free'],
  [/(^|\s)(כשרה|כשר|כשרים|kosher)(?=\s|$)/i, 'kosher'],
  [/(^|\s)(טבעונית|טבעוני|טבעוניים|vegan)(?=\s|$)/i, 'vegan'],
  [/(^|\s)(צמחונית|צמחוני|צמחוניים|vegetarian)(?=\s|$)/i, 'vegetarian'],
];

/** "פיצה כשרה פתוחה עכשיו ברמת גן" becomes a kosher filter, open now, Ramat Gan and "פיצה". */
export function parseSearch(text: string): SmartSearch {
  let rest = ` ${text.trim()} `;
  const needs: string[] = [];
  for (const [pattern, need] of NEED_WORDS) {
    if (pattern.test(rest)) {
      needs.push(need);
      rest = rest.replace(pattern, ' ');
    }
  }
  const open = /(^|\s)(פתוחה עכשיו|פתוח עכשיו|פתוחים עכשיו|open now)(?=\s|$)/i;
  const openNow = open.test(rest);
  rest = rest.replace(open, ' ');
  // The city comes last, after "ב" or "in". The caller checks that it's a real city.
  const place = rest.match(/\s(?:ב|in\s+)([א-תa-z][א-תa-z"'׳״ -]{1,30})\s*$/i);
  const before = place ? rest.slice(0, place.index).trim() : rest.trim();
  const hasOther = needs.length > 0 || openNow || before.length > 0;
  const city = place && hasOther ? place[1].trim() : null;
  return { needs, openNow, city, rest: (city ? before : rest).trim().replace(/\s+/g, ' ') };
}

export interface BadgeStats { places_added: number; info_added: number; confirmations: number; reviews: number }

/** Earned by helping others. The keys are translated where they are shown. */
export function earnedBadges(s: BadgeStats): string[] {
  const badges: string[] = [];
  if (s.confirmations >= 10) badges.push('confirmer');
  if (s.places_added >= 5) badges.push('explorer');
  if (s.info_added >= 10) badges.push('informer');
  if (s.reviews >= 5) badges.push('critic');
  return badges;
}

type Ranges = [string, string][];

export const rangesToText = (ranges: Ranges | undefined) =>
  ranges === undefined ? '' : ranges.length === 0 ? 'סגור' : ranges.map(([a, b]) => `${a}-${b}`).join(', ');

/** "08:00-14:00, 17:00-22:00" or "סגור". Empty means unknown, and anything else is a mistake (null). */
export function textToRanges(text: string): Ranges | undefined | null {
  const clean = text.trim();
  if (!clean) return undefined;
  if (/^(סגור|closed)$/i.test(clean)) return [];
  const parts = clean.split(/\s*,\s*/).map((part) => part.match(/^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/));
  if (parts.some((m) => !m)) return null;
  return parts.map((m) => [`${m![1].padStart(2, '0')}:${m![2]}`, `${m![3].padStart(2, '0')}:${m![4]}`]);
}
