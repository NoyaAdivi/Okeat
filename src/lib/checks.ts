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
