import { NextResponse, type NextRequest } from 'next/server';

// Live details from Google Places for one place, shown in the place panel only.
// Nothing from Google is saved in our database (Google's terms don't allow keeping it).
// Needs GOOGLE_PLACES_API_KEY in .env.local; without it this route answers 404 and the panel hides the section.

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIELDS = [
  'places.id', 'places.displayName', 'places.location', 'places.primaryTypeDisplayName', 'places.types',
  'places.regularOpeningHours', 'places.rating', 'places.userRatingCount', 'places.priceLevel',
  'places.nationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri', 'places.businessStatus',
  'places.servesVegetarianFood', 'places.servesBreakfast', 'places.dineIn', 'places.takeout', 'places.delivery',
].join(',');

// Small memory cache so opening the same place again doesn't cost another request (per server run, 6 hours).
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 6 * 3600 * 1000;
const hits = new Map<string, number[]>();

const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * 111320 * k, (a.lat - b.lat) * 110540);
};

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'not configured' }, { status: 404 });
  const p = req.nextUrl.searchParams;
  const name = (p.get('name') ?? '').trim().slice(0, 120);
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lng'));
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  // protect the monthly free quota: at most 120 lookups an hour from one address
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 120) return NextResponse.json({ error: 'slow down' }, { status: 429 });
  recent.push(now);
  hits.set(ip, recent);

  const ck = `${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      textQuery: name,
      languageCode: 'he',
      regionCode: 'IL',
      pageSize: 3,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 250 } },
    }),
  }).catch(() => null);
  if (!res || !res.ok) {
    const msg = res ? await res.text().catch(() => '') : 'network';
    console.error('Google Places error', res?.status, msg.slice(0, 300));
    return NextResponse.json({ error: 'google failed' }, { status: 502 });
  }
  const json = (await res.json()) as { places?: GPlace[] };
  // Only accept a result that is really this place: close by.
  const match = (json.places ?? []).find((g) => g.location && meters({ lat, lng }, { lat: g.location.latitude, lng: g.location.longitude }) < 250) ?? null;

  const data = match
    ? {
        found: true,
        type: match.primaryTypeDisplayName?.text ?? null,
        types: match.types ?? [],
        hours: match.regularOpeningHours?.weekdayDescriptions ?? null,
        openNow: match.regularOpeningHours?.openNow ?? null,
        rating: match.rating ?? null,
        ratings: match.userRatingCount ?? null,
        price: match.priceLevel ?? null,
        phone: match.nationalPhoneNumber ?? null,
        website: match.websiteUri ?? null,
        mapsUrl: match.googleMapsUri ?? null,
        closed: match.businessStatus === 'CLOSED_PERMANENTLY' ? 'permanent' : match.businessStatus === 'CLOSED_TEMPORARILY' ? 'temporary' : null,
        vegetarian: match.servesVegetarianFood ?? null,
        breakfast: match.servesBreakfast ?? null,
        dineIn: match.dineIn ?? null,
        takeout: match.takeout ?? null,
        delivery: match.delivery ?? null,
      }
    : { found: false };
  cache.set(ck, { at: Date.now(), data });
  return NextResponse.json(data);
}

interface GPlace {
  location?: { latitude: number; longitude: number };
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  servesVegetarianFood?: boolean;
  servesBreakfast?: boolean;
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
}
