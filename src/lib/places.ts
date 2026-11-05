import { matchesAnyCuisine } from './cuisine';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TWO_LEVEL_NEEDS } from './claims';
import type { ExtractedCertificate, KosherLevel, Level, MapPoint, Need, NeedFilter, PendingClaim, Place } from './types';
import type { LatLng } from './geo';

/**
 * The current user, signing in anonymously if needed, so anyone can add and confirm
 * without registering. Each browser gets its own id, so one person = one vote per claim.
 */
export async function ensureUser(sb: SupabaseClient) {
  const { data } = await sb.auth.getUser();
  if (data.user && !data.user.is_anonymous) return data.user;
  throw new Error('Sign in with an account');
}

// Data access. Every function takes a Supabase client so it works from
// both the browser and the server.

/**
 * Vegetarian and allergy filters, as {"dairy_free": 1}. Only sent when one is on, so the site keeps
 * working with a database that doesn't have migration 0008 yet.
 */
function extraParam(filter: NeedFilter): { p_extra?: Record<string, number> } {
  const extra: Record<string, number> = {};
  for (const n of TWO_LEVEL_NEEDS) {
    const v = filter[n];
    if (v !== null && v !== undefined) extra[n] = v;
  }
  return Object.keys(extra).length ? { p_extra: extra } : {};
}

export async function fetchNearby(
  sb: SupabaseClient,
  opts: { lat: number; lng: number; radiusM?: number; filter: NeedFilter; query?: string; limit?: number; cuisine?: string[]; signal?: AbortSignal },
): Promise<Place[]> {
  const request = sb.rpc('nearby_places', {
    p_lat: opts.lat,
    p_lng: opts.lng,
    p_radius_m: opts.radiusM ?? 1500,
    p_min_kosher: opts.filter.kosher,
    p_min_vegan: opts.filter.vegan,
    p_min_gluten_free: opts.filter.gluten_free,
    p_query: opts.query?.trim() || null,
    p_limit: opts.limit ?? 500,
    ...extraParam(opts.filter),
  });
  const { data, error } = await (opts.signal ? request.abortSignal(opts.signal) : request);
  if (error) throw error;
  const rows = (data ?? []) as Place[];
  // Categories are filtered here (stored category, type or name), so it works with any database version.
  return opts.cuisine?.length ? rows.filter((p) => matchesAnyCuisine(p, opts.cuisine!)) : rows;
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
        p_query: query?.trim() || null, p_limit: 50_000, ...extraParam(filter),
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
  recent.clear();
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('okeat:pts:')) sessionStorage.removeItem(k);
  } catch { /* blocked */ }
}

/** Cached map points for these filters, if any (to draw before the network answers). */
export function cachedMapPoints(filter: NeedFilter, query?: string, cuisine?: string[]): MapPoint[] | null {
  const key = pointsKey(filter, query, cuisine);
  const held = recent.get(key);
  if (held && Date.now() - held.at < POINTS_TTL) return held.data;
  return cacheGet<MapPoint[]>(key);
}

// The last few results stay in memory, so going back and forth between filters asks the server nothing.
const recent = new Map<string, { at: number; data: MapPoint[] }>();
function remember(key: string, data: MapPoint[]) {
  recent.delete(key);
  recent.set(key, { at: Date.now(), data });
  if (recent.size > 8) recent.delete(recent.keys().next().value as string);
}
const pointsKey = (filter: NeedFilter, query?: string, cuisine?: string[]) =>
  `okeat:pts:${JSON.stringify([filter, query?.trim() || '', cuisine ?? []])}`;

/** Every matching place in the country. Pages are fetched 4 at a time. */
export async function fetchMapPoints(sb: SupabaseClient, filter: NeedFilter, query?: string, cuisine?: string[], signal?: AbortSignal): Promise<MapPoint[]> {
  const PAGE = 1000;
  const PARALLEL = 4;
  const page = async (from: number) => {
    const request = sb
      .rpc('map_points', {
        p_min_kosher: filter.kosher,
        p_min_vegan: filter.vegan,
        p_min_gluten_free: filter.gluten_free,
        p_query: query?.trim() || null,
        ...extraParam(filter),
      })
      .range(from, from + PAGE - 1);
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    if (error) throw error;
    return (data ?? []) as MapPoint[];
  };
  const out: MapPoint[] = [];
  for (let from = 0; from < 100_000; from += PAGE * PARALLEL) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(from + i * PAGE)));
    for (const rows of batch) out.push(...rows);
    if (batch.some((rows) => rows.length < PAGE)) break;
    if (signal?.aborted) throw new Error('Cancelled');
  }
  const result = cuisine?.length ? out.filter((p) => matchesAnyCuisine(p, cuisine)) : out;
  remember(pointsKey(filter, query, cuisine), result);
  // The whole map is big: only the plain version survives a reload.
  if (!query?.trim() && !cuisine?.length && Object.values(filter).every((v) => v === null || v === undefined)) cacheSet(pointsKey(filter, query, cuisine), result);
  return result;
}

export interface SiteStats { places: number; kosher: number; vegan: number; gluten_free: number }

/** One number per need. Empty on a database without migration 0009; the fallback below then counts the main ones. */
export async function fetchAllStats(sb: SupabaseClient): Promise<{ places: number } & Partial<Record<Need, number>>> {
  const { data, error } = await sb.rpc('site_stats_full');
  if (!error && data) return data as { places: number } & Partial<Record<Need, number>>;
  return fetchStats(sb);
}

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

/** Any claim without a photo (kosher too, since migration 0008). A kosher certificate photo goes through proposeKosherClaim. */
export async function proposeClaim(
  sb: SupabaseClient,
  claim: { placeId: string; need: Need; level: Level; note?: string },
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

// ---------------------------------------------------------------- community (migration 0008)

export interface PlaceMeta {
  createdAt: string;
  creator: { id: string; name: string; avatar: string | null } | null;
  ownerVerified: boolean;
  flagged: boolean;
  reports: number;
  iReported: boolean;
  iRequestedOwner: boolean;
  canModerate: boolean;
  isAdmin: boolean;
}

/** Who added the place, owner badge, reports. null when the database doesn't have migration 0008 yet. */
export async function fetchPlaceMeta(sb: SupabaseClient, placeId: string): Promise<PlaceMeta | null> {
  const { data, error } = await sb.rpc('place_meta', { p_id: placeId });
  if (error) return null;
  return data as PlaceMeta | null;
}

export async function reportPlace(sb: SupabaseClient, placeId: string, reason: string) {
  const { data } = await sb.auth.getUser();
  if (!data.user || data.user.is_anonymous) throw new Error('Sign in with an account to report a place');
  const { error } = await sb.from('place_reports').insert({ place_id: placeId, user_id: data.user.id, reason: reason.slice(0, 300) || null });
  if (error) throw error;
}

export async function requestOwnership(sb: SupabaseClient, placeId: string): Promise<string> {
  const { data, error } = await sb.rpc('request_ownership', { p_place: placeId });
  if (error) throw error;
  return data as string;
}

export async function submitOwnershipProof(sb: SupabaseClient, placeId: string, url: string, note: string) {
  const { error } = await sb.rpc('submit_ownership_proof', { p_place: placeId, p_url: url, p_note: note || null });
  if (error) throw error;
}

export interface PublicProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'trusted' | 'admin';
  joined_at: string;
  places_added: number;
  info_added: number;
  confirmations: number;
  favorite_food: string | null;
  reviews: number;
}

/** Site admins only: put a place at its real location, and keep it there. */
export async function fixPlaceLocation(sb: SupabaseClient, id: string, point: LatLng, address: string | null): Promise<void> {
  const { error } = await sb.rpc('admin_fix_place', { p_place: id, p_lat: point.lat, p_lng: point.lng, p_address: address });
  if (error) throw error;
}

/** Site admins only; the database refuses anyone else. */
export async function setUserRole(sb: SupabaseClient, id: string, role: PublicProfile['role']): Promise<void> {
  const { error } = await sb.rpc('set_user_role', { p_user: id, p_role: role });
  if (error) throw error;
}

export async function fetchProfile(sb: SupabaseClient, id: string): Promise<PublicProfile | null> {
  const { data, error } = await sb.rpc('public_profile', { p_id: id });
  if (error) throw error;
  return ((data ?? []) as PublicProfile[])[0] ?? null;
}

export async function fetchPlacesAddedBy(sb: SupabaseClient, id: string): Promise<{ id: string; name: string; place_type: string; created_at: string }[]> {
  const { data, error } = await sb.rpc('places_added_by', { p_id: id });
  if (error) throw error;
  return data ?? [];
}

export interface ModerationQueue {
  reported: { id: string; name: string; address: string | null; reports: number; reasons: string[] | null }[];
  claims: { id: string; placeId: string; placeName: string; need: Need; level: Level; status: string; source: string; confirm: number; reject: number }[];
  owners: { id: string; placeId: string; placeName: string; code: string; proofUrl: string; note: string | null; user: string; createdAt: string }[];
}

export async function fetchModerationQueue(sb: SupabaseClient): Promise<ModerationQueue> {
  const { data, error } = await sb.rpc('moderation_queue');
  if (error) throw error;
  return data as ModerationQueue;
}

export async function moderatePlace(sb: SupabaseClient, placeId: string, remove: boolean) {
  const { error } = await sb.rpc('moderate_place', { p_place: placeId, p_remove: remove });
  if (error) throw error;
}

export async function moderateClaim(sb: SupabaseClient, claimId: string, verify: boolean) {
  const { error } = await sb.rpc('moderate_claim', { p_claim: claimId, p_verify: verify });
  if (error) throw error;
}

export async function decideOwnership(sb: SupabaseClient, requestId: string, approve: boolean) {
  const { error } = await sb.rpc('decide_ownership', { p_request: requestId, p_approve: approve });
  if (error) throw error;
}

// ---------- reviews, saved places and photos ----------
export interface PlaceReview { user_id: string; name: string; avatar_url: string | null; rating: number; comment: string | null; created_at: string }
export interface PlacePhoto { id: string; url: string; approved: boolean }
export interface PendingPhoto { id: string; place_id: string; place_name: string; path: string }

export const placePhotoUrl = (sb: SupabaseClient, path: string) => sb.storage.from('place-photos').getPublicUrl(path).data.publicUrl;

export async function fetchReviews(sb: SupabaseClient, placeId: string): Promise<PlaceReview[]> {
  const { data, error } = await sb.rpc('place_reviews', { p_id: placeId });
  if (error) return [];
  return data as PlaceReview[];
}

export async function saveReview(sb: SupabaseClient, placeId: string, userId: string, rating: number, comment: string) {
  const { error } = await sb.from('reviews').upsert({ place_id: placeId, user_id: userId, rating, comment: comment.trim().slice(0, 300) || null });
  if (error) throw error;
}

export async function deleteReview(sb: SupabaseClient, placeId: string, userId: string) {
  const { error } = await sb.from('reviews').delete().eq('place_id', placeId).eq('user_id', userId);
  if (error) throw error;
}

export async function isFavorite(sb: SupabaseClient, placeId: string, userId: string): Promise<boolean> {
  const { data } = await sb.from('favorites').select('place_id').eq('place_id', placeId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function setFavorite(sb: SupabaseClient, placeId: string, userId: string, on: boolean) {
  const q = sb.from('favorites');
  const { error } = on ? await q.insert({ place_id: placeId, user_id: userId }) : await q.delete().eq('place_id', placeId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchMyFavorites(sb: SupabaseClient): Promise<{ id: string; name: string; place_type: string }[]> {
  const { data, error } = await sb.rpc('my_favorites');
  if (error) return [];
  return data ?? [];
}

export async function fetchPlacePhotos(sb: SupabaseClient, placeId: string): Promise<PlacePhoto[]> {
  const { data, error } = await sb.from('place_photos').select('id, path, approved').eq('place_id', placeId).order('created_at', { ascending: false }).limit(12);
  if (error) return [];
  return (data ?? []).map((p) => ({ id: p.id, approved: p.approved, url: placePhotoUrl(sb, p.path) }));
}

/** Photos are made smaller in the browser, to keep the free storage for longer. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('שמירת התמונה נכשלה'))), 'image/jpeg', 0.82));
}

export async function uploadPlacePhoto(sb: SupabaseClient, placeId: string, userId: string, file: File) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const blob = await shrinkPhoto(file);
  const { error } = await sb.storage.from('place-photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { error: rowError } = await sb.from('place_photos').insert({ place_id: placeId, user_id: userId, path });
  if (rowError) throw rowError;
}

export async function fetchPendingPhotos(sb: SupabaseClient): Promise<PendingPhoto[]> {
  const { data, error } = await sb.rpc('pending_photos');
  if (error) return [];
  return data as PendingPhoto[];
}

export async function moderatePhoto(sb: SupabaseClient, photo: PendingPhoto, approve: boolean) {
  const { error } = await sb.rpc('moderate_photo', { p_photo: photo.id, p_approve: approve });
  if (error) throw error;
  if (!approve) await sb.storage.from('place-photos').remove([photo.path]);
}

// ---------- reported reviews and site errors ----------
export interface ReportedReview { place_id: string; place_name: string; user_id: string; author: string; rating: number; comment: string | null; reports: number }
export interface ClientError { message: string; path: string | null; times: number; last_seen: string }

export async function reportReview(sb: SupabaseClient, placeId: string, reviewUser: string, reporter: string) {
  const { error } = await sb.from('review_reports').upsert(
    { place_id: placeId, review_user: reviewUser, reporter },
    { ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function fetchReportedReviews(sb: SupabaseClient): Promise<ReportedReview[]> {
  const { data, error } = await sb.rpc('reported_reviews');
  if (error) return [];
  return data as ReportedReview[];
}

export async function dismissReviewReports(sb: SupabaseClient, r: ReportedReview) {
  const { error } = await sb.from('review_reports').delete().eq('place_id', r.place_id).eq('review_user', r.user_id);
  if (error) throw error;
}

export async function fetchClientErrors(sb: SupabaseClient): Promise<ClientError[]> {
  const { data, error } = await sb.from('client_errors').select('*').order('last_seen', { ascending: false }).limit(50);
  if (error) return [];
  return data as ClientError[];
}

export async function clearClientError(sb: SupabaseClient, message: string) {
  const { error } = await sb.from('client_errors').delete().eq('message', message);
  if (error) throw error;
}

// ---------- places that appear twice ----------
export interface DuplicatePair { a_id: string; a_name: string; a_address: string | null; b_id: string; b_name: string; b_address: string | null; meters: number }

export async function fetchDuplicatePairs(sb: SupabaseClient): Promise<DuplicatePair[]> {
  const { data, error } = await sb.rpc('duplicate_pairs');
  if (error) throw error;
  return data as DuplicatePair[];
}

export async function mergePair(sb: SupabaseClient, pair: DuplicatePair) {
  const { error } = await sb.rpc('admin_merge_pair', { p_a: pair.a_id, p_b: pair.b_id });
  if (error) throw error;
}

export async function dismissPair(sb: SupabaseClient, pair: DuplicatePair) {
  const { error } = await sb.rpc('dismiss_duplicate', { p_a: pair.a_id, p_b: pair.b_id });
  if (error) throw error;
}

// ---------- the admin's list of users ----------
export interface AdminUser { id: string; name: string | null; email: string | null; role: PublicProfile['role']; joined: string; last_seen: string | null }

export async function fetchAdminUsers(sb: SupabaseClient): Promise<AdminUser[]> {
  const { data, error } = await sb.rpc('admin_users');
  if (error) throw error;
  return data as AdminUser[];
}

export async function deleteUser(sb: SupabaseClient, id: string) {
  const { error } = await sb.rpc('admin_delete_user', { p_user: id });
  if (error) throw error;
}

// ---------- contact messages, for the admin ----------
export interface AdminMessage { id: number; topic: string; message: string; reply_to: string | null; account_email: string | null; created_at: string; handled: boolean }

export async function fetchAdminMessages(sb: SupabaseClient): Promise<AdminMessage[]> {
  const { data, error } = await sb.rpc('admin_messages');
  if (error) throw error;
  return data as AdminMessage[];
}

export async function markMessage(sb: SupabaseClient, id: number, handled: boolean) {
  const { error } = await sb.rpc('admin_mark_message', { p_id: id, p_handled: handled });
  if (error) throw error;
}

// ---------- notifications ----------
export interface MyNotification { kind: 'approved' | 'expiring' | 'confirmed'; place_id: string; place_name: string; need: string; happened_at: string; is_new: boolean }

export async function fetchNotifications(sb: SupabaseClient): Promise<MyNotification[]> {
  const { data, error } = await sb.rpc('my_notifications');
  if (error) return [];
  return data as MyNotification[];
}

export const markNotificationsSeen = (sb: SupabaseClient) => sb.rpc('mark_notifications_seen').then(() => undefined);

// ---------- lists ----------
export interface MyList { id: string; title: string; list_places: { count: number }[] }
export interface ListDetails {
  id: string; title: string; ownerId: string; ownerName: string;
  places: { id: string; name: string; placeType: string; address: string | null }[];
}

export async function fetchMyLists(sb: SupabaseClient, userId: string): Promise<MyList[]> {
  const { data, error } = await sb.from('lists').select('id, title, list_places(count)').eq('owner_id', userId).order('created_at', { ascending: false });
  if (error) return [];
  return data as MyList[];
}

export async function createList(sb: SupabaseClient, userId: string, title: string): Promise<string> {
  const { data, error } = await sb.from('lists').insert({ owner_id: userId, title: title.trim() }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function renameList(sb: SupabaseClient, id: string, title: string) {
  const { error } = await sb.from('lists').update({ title: title.trim() }).eq('id', id);
  if (error) throw error;
}

export async function deleteList(sb: SupabaseClient, id: string) {
  const { error } = await sb.from('lists').delete().eq('id', id);
  if (error) throw error;
}

export async function addToList(sb: SupabaseClient, listId: string, placeId: string) {
  const { error } = await sb.from('list_places').upsert({ list_id: listId, place_id: placeId }, { ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFromList(sb: SupabaseClient, listId: string, placeId: string) {
  const { error } = await sb.from('list_places').delete().eq('list_id', listId).eq('place_id', placeId);
  if (error) throw error;
}

export async function fetchList(sb: SupabaseClient, id: string): Promise<ListDetails | null> {
  const { data, error } = await sb.rpc('list_view', { p_id: id });
  if (error) return null;
  return data as ListDetails | null;
}

// ---------- similar places and business details ----------
export interface SimilarPlace { id: string; name: string; place_type: string; meters: number }

export async function fetchSimilarPlaces(sb: SupabaseClient, id: string): Promise<SimilarPlace[]> {
  const { data, error } = await sb.rpc('similar_places', { p_id: id });
  if (error) return [];
  return data as SimilarPlace[];
}

export async function fetchPlaceBusiness(sb: SupabaseClient, id: string): Promise<{ menuUrl: string | null; isOwner: boolean }> {
  const { data, error } = await sb.rpc('place_business', { p_id: id });
  if (error || !data) return { menuUrl: null, isOwner: false };
  return data;
}

export async function ownerUpdatePlace(sb: SupabaseClient, id: string, details: { hours: unknown; phone: string | null; website: string | null; menuUrl: string | null }) {
  const { error } = await sb.rpc('owner_update_place', { p_id: id, p_hours: details.hours, p_phone: details.phone, p_website: details.website, p_menu_url: details.menuUrl });
  if (error) throw error;
}

// ---------- search insights and the dashboard ----------
export const logSearch = (sb: SupabaseClient, term: string) => sb.rpc('log_search', { p_term: term }).then(() => undefined, () => undefined);
export const logCity = (sb: SupabaseClient, name: string, lat: number, lng: number) =>
  sb.rpc('log_city', { p_name: name, p_lat: lat, p_lng: lng }).then(() => undefined, () => undefined);

export interface Dashboard {
  users: number; newUsers: number; places: number; verified: number; reviews: number; lists: number;
  searches: { term: string; times: number }[];
  cities: { name: string; times: number; places: number }[];
}

export async function fetchDashboard(sb: SupabaseClient): Promise<Dashboard> {
  const { data, error } = await sb.rpc('admin_dashboard');
  if (error) throw error;
  return data as Dashboard;
}

export type StatKind = 'users' | 'newUsers' | 'verified' | 'reviews' | 'lists';

export interface StatRow {
  id: string; title: string; at: string | null;
  sub?: string | null; by?: string | null; placeId?: string;
  need?: Need; level?: string; rating?: number; count?: number;
}

export async function fetchStatDetails(sb: SupabaseClient, kind: StatKind): Promise<StatRow[]> {
  const { data, error } = await sb.rpc('admin_stat_details', { p_kind: kind });
  if (error) throw error;
  return (data ?? []) as StatRow[];
}

// ---------- limits, for the admin ----------
export interface Limits {
  mailHour: number; mailDay: number; mailWeek: number; mailMonth: number;
  signInsToday: number; signInsWeek: number; signUpsToday: number; activeMonth: number;
  dbBytes: number; storageBytes: number;
}

export async function fetchLimits(sb: SupabaseClient): Promise<Limits> {
  const { data, error } = await sb.rpc('admin_limits');
  if (error) throw error;
  return data as Limits;
}

// ---------- ratings and the activity log ----------
export async function fetchRatings(sb: SupabaseClient, ids: string[]): Promise<Record<string, { average: number; total: number }>> {
  if (ids.length === 0) return {};
  const { data, error } = await sb.rpc('place_ratings', { p_ids: ids });
  if (error) return {};
  return Object.fromEntries((data as { place_id: string; average: number; total: number }[]).map((r) => [r.place_id, { average: Number(r.average), total: Number(r.total) }]));
}

export interface ActivityRow { id: number; actor: string; action: string; detail: string | null; at: string }

export async function fetchActivity(sb: SupabaseClient): Promise<ActivityRow[]> {
  const { data, error } = await sb.rpc('admin_activity');
  if (error) throw error;
  return data as ActivityRow[];
}

export interface AdminPlace {
  id: string; name: string; place_type: string; cuisine: string[] | null;
  address: string | null; phone: string | null; website: string | null; removed?: boolean;
}

/** Admin: find any place by name, hidden ones too. Up to 50. */
export async function adminSearchPlaces(sb: SupabaseClient, query: string, hiddenOnly: boolean): Promise<AdminPlace[]> {
  const { data, error } = await sb.rpc('admin_search_places', { p_query: query, p_hidden_only: hiddenOnly });
  if (error) throw error;
  return (data ?? []) as AdminPlace[];
}

export async function adminUpdatePlace(sb: SupabaseClient, place: AdminPlace) {
  const { error } = await sb.rpc('admin_update_place', {
    p_place: place.id, p_name: place.name, p_type: place.place_type, p_cuisine: place.cuisine ?? [],
    p_address: place.address, p_phone: place.phone, p_website: place.website,
  });
  if (error) throw error;
}

export type SuspectReason = 'hand' | 'new' | 'butcher' | 'catering' | 'hall' | 'shop' | 'service' | 'health' | 'other' | 'spot';
export type Suspect = AdminPlace & { reason: SuspectReason; note: string | null };

/** Admin: places that look wrong, found by their name, by being new, or by a crowded spot. */
export async function fetchSuspects(sb: SupabaseClient): Promise<Suspect[]> {
  const { data, error } = await sb.rpc('admin_suspects');
  if (error) throw error;
  return (data ?? []) as Suspect[];
}

export async function markPlacesOk(sb: SupabaseClient, ids: string[]) {
  const { error } = await sb.rpc('admin_places_ok', { p_ids: ids });
  if (error) throw error;
}

export async function hidePlaces(sb: SupabaseClient, ids: string[]) {
  const { error } = await sb.rpc('admin_hide_places', { p_ids: ids });
  if (error) throw error;
}

/** Admin: delete a hidden place for good. */
export async function deleteHiddenPlace(sb: SupabaseClient, id: string) {
  const { error } = await sb.rpc('admin_delete_place', { p_place: id });
  if (error) throw error;
}

export async function fetchVisitsBegan(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb.rpc('admin_visits_began');
  return error ? null : (data as string | null);
}

export async function adminRestorePlace(sb: SupabaseClient, id: string) {
  const { error } = await sb.rpc('admin_restore_place', { p_place: id });
  if (error) throw error;
}

// ---------- what you did, on your own profile ----------
export interface MyActivity {
  claims: { id: string; placeId: string; place: string; need: Need; level: string; status: string; confirmCount: number }[];
  votes: { claimId: string; placeId: string; place: string; need: Need; level: string; vote: number }[];
  reviews: { placeId: string; place: string; rating: number; comment: string | null }[];
}

export async function fetchMyActivity(sb: SupabaseClient): Promise<MyActivity> {
  const { data, error } = await sb.rpc('my_activity');
  if (error) throw error;
  return data as MyActivity;
}

export async function withdrawClaim(sb: SupabaseClient, id: string) {
  const { error } = await sb.rpc('withdraw_claim', { p_claim: id });
  if (error) throw error;
}

export type FeedKind = 'place' | 'claim' | 'vote' | 'review' | 'photo' | 'list' | 'saved' | 'suggestion';

export interface FeedRow {
  kind: FeedKind; id: string; place_id: string | null; title: string; at: string;
  status: string | null; need: Need | null; level: string | null; rating: number | null;
  comment: string | null; vote: number | null; path: string | null;
}

export async function fetchMyFeed(sb: SupabaseClient): Promise<FeedRow[]> {
  const { data, error } = await sb.rpc('my_feed');
  if (error) throw error;
  return (data ?? []) as FeedRow[];
}

export async function deleteMyPhoto(sb: SupabaseClient, id: string, path: string) {
  const { error } = await sb.from('place_photos').delete().eq('id', id);
  if (error) throw error;
  await sb.storage.from('place-photos').remove([path]);
}

export async function suggestPlaceType(sb: SupabaseClient, placeId: string, type: string, cuisine: string[]) {
  const { error } = await sb.rpc('suggest_place_type', { p_place: placeId, p_type: type, p_cuisine: cuisine });
  if (error) throw error;
}

export interface PlaceSuggestion {
  id: string; placeId: string; name: string; oldType: string; oldCuisine: string[] | null;
  newType: string; newCuisine: string[]; by: string | null; at: string;
}

export async function fetchPendingSuggestions(sb: SupabaseClient): Promise<PlaceSuggestion[]> {
  const { data, error } = await sb.rpc('pending_suggestions');
  if (error) return []; // the database may not have this yet
  return (data ?? []) as PlaceSuggestion[];
}

export async function decideSuggestion(sb: SupabaseClient, id: string, approve: boolean) {
  const { error } = await sb.rpc('decide_suggestion', { p_id: id, p_approve: approve });
  if (error) throw error;
}

export type AdminKind = 'user' | 'place' | 'claim' | 'vote' | 'review' | 'photo' | 'report' | 'suggestion' | 'list' | 'message';

export interface AdminEvent {
  kind: AdminKind; id: string; at: string; user_id: string | null; user_name: string | null;
  place_id: string | null; title: string | null; need: Need | null; level: string | null;
  rating: number | null; detail: string | null; path: string | null; status: string | null;
}

export async function fetchAdminFeed(sb: SupabaseClient, kind: AdminKind | null): Promise<AdminEvent[]> {
  const { data, error } = await sb.rpc('admin_feed', { p_kind: kind, p_limit: 100 });
  if (error) throw error;
  return (data ?? []) as AdminEvent[];
}

export interface AdminOverview {
  kinds: Partial<Record<AdminKind, { all: number; week: number; today: number }>>;
  attention: { reports: number; photos: number; suggestions: number; waiting: number; disputed: number; expiring: number };
  topUsers: { id: string; name: string | null; actions: number }[];
  topPlaces: { id: string; name: string; reviews: number; rating: number }[];
}

export async function fetchAdminOverview(sb: SupabaseClient): Promise<AdminOverview> {
  const { data, error } = await sb.rpc('admin_overview');
  if (error) throw error;
  return data as AdminOverview;
}

export interface Visits {
  visits: number; avgSeconds: number; totalSeconds: number; avgPages: number; signedIn: number; signups: number;
  days: { day: string; visits: number; avgSeconds: number }[];
}

export async function fetchVisits(sb: SupabaseClient, days: number): Promise<Visits | null> {
  const { data, error } = await sb.rpc('admin_visits', { p_days: days });
  return error ? null : (data as Visits);
}

/** Admin: remove anything a user added, from the feed. */
export async function adminDeleteItem(sb: SupabaseClient, r: AdminEvent) {
  const { error } = await sb.rpc('admin_delete_item', { p_kind: r.kind, p_id: r.id, p_place: r.place_id, p_user: r.user_id });
  if (error) throw error;
}

export const logVisit = (sb: SupabaseClient, sid: string, seconds: number, pages: number, signed: boolean) =>
  sb.rpc('log_visit', { p_sid: sid, p_seconds: seconds, p_pages: pages, p_signed: signed }).then(() => undefined, () => undefined);

export async function adminNewCount(sb: SupabaseClient, since: string): Promise<number> {
  const { data, error } = await sb.rpc('admin_new_count', { p_since: since });
  return error ? 0 : (data as number);
}

export async function fetchPublicActivity(sb: SupabaseClient, id: string): Promise<MyActivity> {
  const { data, error } = await sb.rpc('public_activity', { p_id: id });
  if (error) throw error;
  return data as MyActivity;
}

export async function withdrawVote(sb: SupabaseClient, claimId: string) {
  const { error } = await sb.rpc('withdraw_vote', { p_claim: claimId });
  if (error) throw error;
}

export async function updateMyClaim(sb: SupabaseClient, id: string, level: string) {
  const { error } = await sb.rpc('update_my_claim', { p_claim: id, p_level: level });
  if (error) throw error;
}

export interface MyPlaceFields { name: string; address: string; phone: string; website: string }

export async function fetchMyPlaceFields(sb: SupabaseClient, id: string): Promise<MyPlaceFields> {
  const { data, error } = await sb.from('places').select('name, address, phone, website').eq('id', id).single();
  if (error) throw error;
  return { name: data.name ?? '', address: data.address ?? '', phone: data.phone ?? '', website: data.website ?? '' };
}

export async function updateMyPlace(sb: SupabaseClient, id: string, f: MyPlaceFields) {
  const { error } = await sb.rpc('update_my_place', { p_place: id, p_name: f.name, p_address: f.address, p_phone: f.phone, p_website: f.website });
  if (error) throw error;
}

export async function withdrawPlace(sb: SupabaseClient, id: string) {
  const { error } = await sb.rpc('withdraw_place', { p_place: id });
  if (error) throw error;
}
