import { matchesCuisine } from './cuisine';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCertificate, KosherLevel, Level, MapPoint, Need, NeedFilter, PendingClaim, Place } from './types';
import type { LatLng } from './geo';

/**
 * The current user, signing in anonymously if needed, so anyone can add and confirm
 * without registering. Each browser gets its own id, so one person = one vote per claim.
 */
export async function ensureUser(sb: SupabaseClient) {
  const { data } = await sb.auth.getUser();
  if (data.user) return data.user;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error('anonymous sign-in failed');
  return anon.user;
}

// Data access. Every function takes a Supabase client so it works from
// both the browser and the server.

export async function fetchNearby(
  sb: SupabaseClient,
  opts: { lat: number; lng: number; radiusM?: number; filter: NeedFilter; query?: string; limit?: number; cuisine?: string | null },
): Promise<Place[]> {
  const { data, error } = await sb.rpc('nearby_places', {
    p_lat: opts.lat,
    p_lng: opts.lng,
    p_radius_m: opts.radiusM ?? 1500,
    p_min_kosher: opts.filter.kosher,
    p_min_vegan: opts.filter.vegan,
    p_min_gluten_free: opts.filter.gluten_free,
    p_query: opts.query?.trim() || null,
    p_limit: opts.limit ?? 500,
  });
  if (error) throw error;
  const rows = (data ?? []) as Place[];
  // Categories are filtered here (stored category, type or name), so it works with any database version.
  return opts.cuisine ? rows.filter((p) => matchesCuisine(p, opts.cuisine!)) : rows;
}

/**
 * Backup for the whole-country map when map_points isn't in the database yet (migration 0005 not run):
 * every place in Israel through nearby_places, 1000 at a time.
 */
export async function fetchAllPlacesFallback(sb: SupabaseClient, filter: NeedFilter, query?: string): Promise<Place[]> {
  const out: Place[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await sb
      .rpc('nearby_places', {
        p_lat: 31.4, p_lng: 35.0, p_radius_m: 450_000,
        p_min_kosher: filter.kosher, p_min_vegan: filter.vegan, p_min_gluten_free: filter.gluten_free,
        p_query: query?.trim() || null, p_limit: 50_000,
      })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Place[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Every place in the country matching the filters, for the clustered map. Loaded in pages of 1000. */
const POINTS_TTL = 10 * 60 * 1000; // 10 minutes

/** Session cache, so going back to the map (or reloading) shows the dots immediately. */
function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - at < POINTS_TTL ? data : null;
  } catch {
    return null;
  }
}
function cacheSet(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* full or blocked */ }
}
export function clearPointsCache() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('okeat:pts:')) sessionStorage.removeItem(k);
  } catch { /* blocked */ }
}

/** Cached map points for these filters, if any (to draw before the network answers). */
export function cachedMapPoints(filter: NeedFilter, query?: string, cuisine?: string | null): MapPoint[] | null {
  return cacheGet<MapPoint[]>(pointsKey(filter, query, cuisine));
}
const pointsKey = (filter: NeedFilter, query?: string, cuisine?: string | null) =>
  `okeat:pts:${JSON.stringify([filter, query?.trim() || '', cuisine ?? ''])}`;

/** Every matching place in the country. Pages are fetched 4 at a time. */
export async function fetchMapPoints(sb: SupabaseClient, filter: NeedFilter, query?: string, cuisine?: string | null): Promise<MapPoint[]> {
  const PAGE = 1000;
  const PARALLEL = 4;
  const page = async (from: number) => {
    const { data, error } = await sb
      .rpc('map_points', {
        p_min_kosher: filter.kosher,
        p_min_vegan: filter.vegan,
        p_min_gluten_free: filter.gluten_free,
        p_query: query?.trim() || null,
      })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    return (data ?? []) as MapPoint[];
  };
  const out: MapPoint[] = [];
  for (let from = 0; from < 100_000; from += PAGE * PARALLEL) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(from + i * PAGE)));
    for (const rows of batch) out.push(...rows);
    if (batch.some((rows) => rows.length < PAGE)) break;
  }
  const result = cuisine ? out.filter((p) => matchesCuisine(p, cuisine)) : out;
  cacheSet(pointsKey(filter, query, cuisine), result);
  return result;
}

export interface SiteStats { places: number; kosher: number; vegan: number; gluten_free: number }

export async function fetchStats(sb: SupabaseClient): Promise<SiteStats> {
  const { data, error } = await sb.rpc('site_stats');
  if (error) {
    // older database without site_stats: count directly
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
    const need = (n: Need) => count(sb.from('claims').select('id', { count: 'exact', head: true }).eq('need', n).eq('status', 'verified'));
    const [places, kosher, vegan, gluten_free] = await Promise.all([
      count(sb.from('places').select('id', { count: 'exact', head: true })),
      need('kosher'), need('vegan'), need('gluten_free'),
    ]);
    return { places, kosher, vegan, gluten_free };
  }
  const row = ((data ?? []) as SiteStats[])[0];
  return {
    places: Number(row?.places ?? 0),
    kosher: Number(row?.kosher ?? 0),
    vegan: Number(row?.vegan ?? 0),
    gluten_free: Number(row?.gluten_free ?? 0),
  };
}

/** One place, with distance from `from` when given. Null if it doesn't exist. */
export async function fetchPlace(sb: SupabaseClient, id: string, from?: LatLng | null): Promise<Place | null> {
  const { data, error } = await sb.rpc('place_by_id', {
    p_id: id,
    p_lat: from?.lat ?? null,
    p_lng: from?.lng ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as Place[])[0] ?? null;
}

/** The signed-in user's votes on these claims. */
export async function fetchMyVotes(sb: SupabaseClient, claimIds: string[]): Promise<Map<string, 1 | -1>> {
  const out = new Map<string, 1 | -1>();
  if (claimIds.length === 0) return out;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return out;
  const { data, error } = await sb
    .from('claim_votes')
    .select('claim_id, vote')
    .eq('user_id', auth.user.id)
    .in('claim_id', claimIds);
  if (error) throw error;
  for (const row of data ?? []) out.set(row.claim_id as string, row.vote as 1 | -1);
  return out;
}

/** Ask the server to read an uploaded certificate photo. */
export async function extractCertificate(imagePath: string): Promise<ExtractedCertificate> {
  const res = await fetch('/api/extract-certificate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagePath }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'לא הצלחנו לקרוא את התעודה');
  return json as ExtractedCertificate;
}

export async function fetchQueue(
  sb: SupabaseClient,
  opts: { lat: number; lng: number; radiusM?: number },
): Promise<PendingClaim[]> {
  const { data, error } = await sb.rpc('pending_claims_near', {
    p_lat: opts.lat,
    p_lng: opts.lng,
    p_radius_m: opts.radiusM ?? 3000,
  });
  if (error) throw error;
  return (data ?? []) as PendingClaim[];
}

/** +1 = "true / still true", -1 = "wrong / no longer true". */
export async function vote(sb: SupabaseClient, claimId: string, value: 1 | -1) {
  const auth = { user: await ensureUser(sb) };
  const { error } = await sb.from('claim_votes').insert({ claim_id: claimId, user_id: auth.user.id, vote: value });
  if (error) {
    if (error.code === '23505') throw new Error('כבר הצבעת על זה');
    throw error;
  }
}

export async function addPlace(
  sb: SupabaseClient,
  place: { name: string; placeType: string; address?: string; lat: number; lng: number },
): Promise<string> {
  const auth = { user: await ensureUser(sb) };
  const { data, error } = await sb
    .from('places')
    .insert({
      name: place.name,
      place_type: place.placeType,
      address: place.address ?? null,
      // PostGIS accepts WKT for geography columns
      location: `SRID=4326;POINT(${place.lng} ${place.lat})`,
      created_by: auth.user.id,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Vegan and gluten-free claims. Kosher goes through proposeKosherClaim. */
export async function proposeClaim(
  sb: SupabaseClient,
  claim: { placeId: string; need: Exclude<Need, 'kosher'>; level: Level; note?: string },
) {
  const auth = { user: await ensureUser(sb) };
  const { error } = await sb.from('claims').insert({
    place_id: claim.placeId,
    need: claim.need,
    level: claim.level,
    note: claim.note ?? null,
    proposed_by: auth.user.id,
  });
  if (error) throw error;
}

/** Uploads to certificates/<uid>/<random>.<ext> and returns the storage path. */
export async function uploadCertificatePhoto(sb: SupabaseClient, file: File): Promise<string> {
  const auth = { user: await ensureUser(sb) };
  if (file.size > 5 * 1024 * 1024) throw new Error('התמונה גדולה מ-5MB. נסו לצלם שוב.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('certificates').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function proposeKosherClaim(
  sb: SupabaseClient,
  c: {
    placeId: string;
    level: KosherLevel;
    imagePath: string;
    supervisingBody: string;
    validUntil: string;
    businessName?: string | null;
    extracted?: unknown;
    confidence?: number;
  },
): Promise<string> {
  const { data, error } = await sb.rpc('propose_kosher_claim', {
    p_place_id: c.placeId,
    p_level: c.level,
    p_image_path: c.imagePath,
    p_supervising_body: c.supervisingBody,
    p_valid_until: c.validUntil,
    p_business_name: c.businessName ?? null,
    p_extracted: c.extracted ?? null,
    p_confidence: c.confidence ?? null,
  });
  if (error) throw error;
  return data as string;
}

export function certificateUrl(sb: SupabaseClient, imagePath: string): string {
  return sb.storage.from('certificates').getPublicUrl(imagePath).data.publicUrl;
}
