import type { LatLng } from './geo';
import { MAPBOX_TOKEN } from './mapboxToken';

export interface GeoResult { name: string; detail: string; point: LatLng }

// Israel, as [west, south, east, north]
const IL_BBOX = '34.2,29.4,35.95,33.4';

/** things people don't mean when they type an address or a place name */
const NOISE = new Set(['bus_stop', 'platform', 'stop_position', 'station', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway', 'motorway_link', 'trunk_link', 'service', 'track', 'path', 'footway', 'cycleway']);

const meters = (a: LatLng, b: LatLng) => {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * 111320 * k, (a.lat - b.lat) * 110540);
};

interface PhotonProps {
  name?: string; street?: string; housenumber?: string; city?: string; district?: string; locality?: string;
  county?: string; state?: string; type?: string; osm_key?: string; osm_value?: string;
}

/**
 * Photon (OpenStreetMap, made for search-as-you-type): much better than Mapbox for Israeli
 * street addresses in Hebrew, and it understands house numbers. Results are biased to `near`.
 */
async function photon(q: string, near: LatLng, lang: 'he' | 'en', signal: AbortSignal): Promise<GeoResult[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lat=${near.lat.toFixed(4)}&lon=${near.lng.toFixed(4)}&bbox=${IL_BBOX}${lang === 'en' ? '&lang=en' : ''}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('photon ' + res.status);
  const json = (await res.json()) as { features?: { properties: PhotonProps; geometry: { coordinates: [number, number] } }[] };
  const wantsNumber = /\d/.test(q);
  return (json.features ?? [])
    .filter((f) => !NOISE.has(f.properties.osm_value ?? ''))
    .map((f) => {
      const p = f.properties;
      const street = p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street;
      const name = p.name && p.type !== 'house' ? p.name : street || p.name || q;
      const city = p.city || p.locality || p.district || p.county || '';
      const detail = [p.name && p.type !== 'house' && street ? street : '', city].filter(Boolean).join(', ');
      return {
        result: { name, detail, point: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } },
        // an address with a number first when the person typed a number
        score: (wantsNumber && p.housenumber ? 0 : 1),
      };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.result);
}

/** Mapbox geocoding, used only when Photon is unreachable or finds nothing. */
async function mapbox(q: string, near: LatLng, lang: 'he' | 'en', signal: AbortSignal): Promise<GeoResult[]> {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=il&language=${lang}&limit=6`
    + `&proximity=${near.lng.toFixed(4)},${near.lat.toFixed(4)}&types=address,street,neighborhood,locality,place&access_token=${MAPBOX_TOKEN}`;
  const json = await (await fetch(url, { signal })).json();
  return (json.features ?? []).map((f: { properties: { name?: string; place_formatted?: string; full_address?: string }; geometry: { coordinates: [number, number] } }) => ({
    name: f.properties.name ?? q,
    detail: f.properties.place_formatted ?? f.properties.full_address ?? '',
    point: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
  }));
}

/** Addresses, streets, cities and named places in Israel, closest-to-you first among equals, no duplicates. */
export async function searchPlaces(q: string, near: LatLng, lang: 'he' | 'en', signal: AbortSignal): Promise<GeoResult[]> {
  let results: GeoResult[] = [];
  try { results = await photon(q, near, lang, signal); } catch (e) { if (signal.aborted) throw e; }
  if (results.length === 0) {
    try { results = await mapbox(q, near, lang, signal); } catch (e) { if (signal.aborted) throw e; }
  }
  const unique: GeoResult[] = [];
  for (const r of results) {
    if (!unique.some((u) => meters(u.point, r.point) < 60)) unique.push(r);
    if (unique.length === 6) break;
  }
  return unique;
}
