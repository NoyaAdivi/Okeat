import type { Lang } from './lang';

export interface LatLng {
  lat: number;
  lng: number;
}

// Fallback when the browser doesn't share a location.
export const RAMAT_GAN: LatLng = { lat: 32.0823, lng: 34.8106 };

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough walking estimate when no route is available: streets add ~30% over a straight line, 80 m/min. */
export function estimateWalk(meters: number) {
  const walked = meters * 1.3;
  return { meters: Math.round(walked / 10) * 10, minutes: Math.max(1, Math.round(walked / 80)) };
}

/**
 * How long a place is, for the list. Close places show the walk, a middle distance shows both,
 * and past 20 minutes on foot only the drive. A drive is never less than 5 minutes door to door.
 */
export function estimateTrip(meters: number): { walk: number | null; drive: number | null } {
  const walk = estimateWalk(meters).minutes;
  // Roads are longer than a straight line, and speed grows with the distance: town, then main roads, then highway.
  const km = (meters * 1.35) / 1000;
  const drive = Math.max(5, Math.round(2 + Math.min(km, 5) * 2.1 + Math.min(Math.max(km - 5, 0), 15) * 1.2 + Math.max(km - 20, 0) * 0.7));
  return { walk: walk <= 20 ? walk : null, drive: walk > 10 ? drive : null };
}

const HE_UNITS = {
  month: ['חודש', 'חודשיים', 'חודשים'],
  day: ['יום', 'יומיים', 'ימים'],
  hour: ['שעה', 'שעתיים', 'שעות'],
  minute: ['דקה', '2 דקות', 'דקות'],
} as const;
const EN_UNITS = { month: ['month', 'months'], day: ['day', 'days'], hour: ['hr', 'hr'], minute: ['min', 'min'] } as const;
type Unit = keyof typeof HE_UNITS;

function heCount(n: number, unit: Unit): string {
  const [one, two, many] = HE_UNITS[unit];
  return n === 1 ? one : n === 2 ? two : `${n} ${many}`;
}

/**
 * A trip's length the way people say it: "45 דקות", "4 שעות ו-21 דקות", "יומיים ו-3 שעות", "חודש ו-4 ימים".
 * Up to an hour it is minutes, up to a day hours and minutes, up to a month days and hours, then months and days.
 * Only the two biggest parts are said, and a part that is zero is left out.
 */
export function formatDuration(totalMinutes: number, lang: Lang = 'he'): string {
  const m = Math.max(1, Math.round(totalMinutes));
  const DAY = 1440, MONTH = 30 * DAY;
  let parts: [number, Unit][];
  if (m < 60) parts = [[m, 'minute']];
  else if (m < DAY) parts = [[Math.floor(m / 60), 'hour'], [m % 60, 'minute']];
  else if (m < MONTH) {
    const hours = Math.round((m % DAY) / 60);
    // 23.6 hours rounds up to a whole day
    parts = hours === 24 ? [[Math.floor(m / DAY) + 1, 'day']] : [[Math.floor(m / DAY), 'day'], [hours, 'hour']];
  } else {
    const days = Math.round((m % MONTH) / DAY);
    parts = days === 30 ? [[Math.floor(m / MONTH) + 1, 'month']] : [[Math.floor(m / MONTH), 'month'], [days, 'day']];
  }
  const shown = parts.filter(([n]) => n > 0);
  if (lang === 'en') {
    return shown.map(([n, u]) => `${n} ${EN_UNITS[u][n === 1 ? 0 : 1]}`).join(' ');
  }
  return shown.map(([n, u]) => heCount(n, u)).join(' ו-');
}

export function formatMeters(m: number, lang: Lang = 'he'): string {
  if (lang === 'en') return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  return m < 1000 ? `${Math.round(m / 10) * 10} מ׳` : `${(m / 1000).toFixed(1)} ק״מ`;
}

/** "היום", "אתמול", "לפני 3 ימים", "לפני שבועיים"... */
export function ago(iso: string | null, lang: Lang = 'he'): string {
  if (lang === 'en') return agoEn(iso);
  if (!iso) return 'לא ידוע';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return w === 1 ? 'לפני שבוע' : w === 2 ? 'לפני שבועיים' : `לפני ${w} שבועות`;
  }
  if (days < 365) {
    const m = Math.min(11, Math.round(days / 30));
    return m === 1 ? 'לפני חודש' : m === 2 ? 'לפני חודשיים' : `לפני ${m} חודשים`;
  }
  const y = Math.round(days / 365);
  return y === 1 ? 'לפני שנה' : y === 2 ? 'לפני שנתיים' : `לפני ${y} שנים`;
}

function agoEn(iso: string | null): string {
  if (!iso) return 'unknown';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) { const w = Math.round(days / 7); return w === 1 ? 'a week ago' : `${w} weeks ago`; }
  if (days < 365) { const m = Math.min(11, Math.round(days / 30)); return m === 1 ? 'a month ago' : `${m} months ago`; }
  const y = Math.round(days / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
}

export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

export const wazeUrl = (p: LatLng) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
export const googleMapsUrl = (p: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;

/** Shortest distance in meters from a point to a line of [lng, lat] coordinates (good enough for a few km). */
/** The closest point on a line to p, and the line segment it falls on. */
export function snapToLine(p: LatLng, coords: [number, number][]): { point: LatLng; index: number; meters: number } | null {
  if (coords.length < 2) return null;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const toXY = ([lng, lat]: [number, number]) => [(lng - p.lng) * 111320 * k, (lat - p.lat) * 110540] as const;
  let best: { point: LatLng; index: number; meters: number } | null = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = toXY(coords[i]);
    const [bx, by] = toXY(coords[i + 1]);
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    const meters = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || meters < best.meters) {
      best = {
        meters,
        index: i,
        point: { lng: coords[i][0] + t * (coords[i + 1][0] - coords[i][0]), lat: coords[i][1] + t * (coords[i + 1][1] - coords[i][1]) },
      };
    }
  }
  return best;
}

export function distanceToLine(p: LatLng, coords: [number, number][]): number {
  if (coords.length === 0) return Infinity;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const toXY = ([lng, lat]: [number, number]) => [(lng - p.lng) * 111320 * k, (lat - p.lat) * 110540] as const;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = toXY(coords[i]);
    const [bx, by] = toXY(coords[i + 1]);
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  if (coords.length === 1) { const [x, y] = toXY(coords[0]); best = Math.hypot(x, y); }
  return best;
}
