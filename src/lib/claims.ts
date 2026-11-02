import { levelInfo, type Claim, type MapPoint, type Need, type Place } from './types';

export const MAIN_NEEDS: Need[] = ['kosher', 'vegan', 'vegetarian', 'gluten_free'];
/** The allergies, behind their own button in the filters. */
export const EXTRA_NEEDS: Need[] = ['dairy_free', 'egg_free', 'peanut_free', 'nut_free', 'sesame_free', 'soy_free'];
export const NEED_ORDER: Need[] = [...MAIN_NEEDS, ...EXTRA_NEEDS];
/** Needs with the two levels some dishes / the whole place, sent to the database as p_extra. */
export const TWO_LEVEL_NEEDS: Need[] = ['vegetarian', ...EXTRA_NEEDS];
/** colour class: k / v / g for the main needs (vegetarian shares vegan's green), e (pastel lilac) for allergies */
export const NEED_CLASS: Record<Need, 'k' | 'v' | 'g' | 'e'> = {
  kosher: 'k', vegan: 'v', gluten_free: 'g',
  vegetarian: 'v', dairy_free: 'e', egg_free: 'e', peanut_free: 'e', nut_free: 'e', sesame_free: 'e', soy_free: 'e',
};
export const isMainNeed = (n: Need) => MAIN_NEEDS.includes(n);

export const rankOf = (c: Claim) => levelInfo(c.need, c.level)?.rank ?? -1;

/** The verified claim that counts for this need (one per need, enforced in SQL). */
export function verifiedClaim(place: Place, need: Need): Claim | null {
  return place.claims.find((c) => c.need === need && c.status === 'verified') ?? null;
}

export const pendingClaims = (place: Place) => place.claims.filter((c) => c.status === 'pending');

export const hasAnyVerified = (place: Place) => place.claims.some((c) => c.status === 'verified');

/** Kosher that shouldn't be shown as kosher: expired certificate or private supervision. */
export function isWeakKosher(c: Claim): boolean {
  return c.need === 'kosher' && (c.level === 'pikuach' || c.level === 'tzohar' || c.level === 'unknown' || !!c.certificate?.expired);
}

/** Imported from OpenStreetMap or guessed automatically, and not confirmed by anyone yet. */
export const isImported = (c: Claim) => c.source !== 'community' && c.confirmCount === 0;

/** The map-marker shape of a fully loaded place. */
export function placeToPoint(p: Place): MapPoint {
  return {
    id: p.id,
    name: p.name,
    place_type: p.place_type,
    lat: p.lat,
    lng: p.lng,
    cuisine: p.cuisine,
    pending: p.claims.some((c) => c.status === 'pending'),
    seals: NEED_ORDER.map((n) => verifiedClaim(p, n))
      .filter((c): c is Claim => c !== null)
      .map((c) => ({ need: c.need, level: c.level, imported: isImported(c), expired: !!c.certificate?.expired })),
  };
}
