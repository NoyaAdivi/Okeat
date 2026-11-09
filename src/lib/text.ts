// Names and addresses as people should read them: tidy, and in Hebrew where Hebrew exists.

const HEBREW = /[֐-׿]/;
const LETTER = /[A-Za-zЀ-ӿ؀-ۿ֐-׿]/;
const ARABIC = /[؀-ۿ]/;

export const hasHebrew = (s: string | null | undefined) => !!s && HEBREW.test(s);
export const hasArabic = (s: string | null | undefined) => !!s && ARABIC.test(s);
/** Written with letters, but none of them Hebrew (English, Arabic, Russian…). */
export const isForeign = (s: string | null | undefined) => !!s && LETTER.test(s) && !HEBREW.test(s);

/** Parts an address never needs: the country, a postal code, "unnamed road". */
const NOISE = [
  /(^|,)\s*(ישראל|israel|إسرائيل|израиль)\s*(?=,|$)/gi,
  /(^|,)\s*\d{5,7}\s*(?=,|$)/g,
  /\b\d{7}\b/g,
  /(^|,)\s*(unnamed road|ללא שם|רחוב ללא שם|طريق بدون اسم)\s*(?=,|$)/gi,
];

/** "  הרצל 5 ,  תל אביב, ישראל, 6100000 " → "הרצל 5, תל אביב" */
export function cleanAddress(a: string | null | undefined): string {
  if (!a) return '';
  let s = a.replace(/\s+/g, ' ').trim();
  for (const r of NOISE) s = s.replace(r, '$1');
  s = s.replace(/\s*,\s*/g, ', ').replace(/(,\s*)+/g, ', ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
  // the same part twice in a row ("תל אביב, תל אביב")
  const parts = s.split(', ').filter((p, i, all) => p && p !== all[i - 1]);
  const out = parts.join(', ');
  // "123" or "5, 7" is not an address anyone can find
  return LETTER.test(out) ? out : '';
}

/** "  'PIZZA HUT'  בע\"מ " → "Pizza Hut" */
export function cleanName(n: string | null | undefined): string {
  if (!n) return '';
  let s = n.replace(/\s+/g, ' ').trim();
  s = s.replace(/^["'״׳`]+|["'״׳`]+$/g, '').trim();
  s = s.replace(/\s*(בע["״]?מ|ltd\.?|inc\.?|llc)$/i, '').trim();
  s = s.replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
  // SHOUTED English names read better in normal case
  if (/^[A-Z0-9 &'.-]{4,}$/.test(s) && /[A-Z]{3}/.test(s)) {
    s = s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return s || n.trim();
}

/** A Google search for the place, free and without a key. */
export const googleUrl = (name: string, address?: string | null) =>
  `https://www.google.com/search?q=${encodeURIComponent([name, cleanAddress(address)].filter(Boolean).join(' '))}`;

/** The place on Google Maps, by its name and address. */
export const googleMapsSearchUrl = (name: string, address: string | null | undefined, point: { lat: number; lng: number }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, cleanAddress(address)].filter(Boolean).join(' ') || `${point.lat},${point.lng}`)}`;
