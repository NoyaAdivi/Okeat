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

export function formatMeters(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} מ׳` : `${(m / 1000).toFixed(1)} ק״מ`;
}

/** "היום", "אתמול", "לפני 3 ימים", "לפני שבועיים"... */
export function ago(iso: string | null): string {
  if (!iso) return 'לא ידוע';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return w === 1 ? 'לפני שבוע' : w === 2 ? 'לפני שבועיים' : `לפני ${w} שבועות`;
  }
  const m = Math.round(days / 30);
  return m === 1 ? 'לפני חודש' : m === 2 ? 'לפני חודשיים' : `לפני ${m} חודשים`;
}

export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

export const wazeUrl = (p: LatLng) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
export const googleMapsUrl = (p: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;

/** Shortest distance in meters from a point to a line of [lng, lat] coordinates (good enough for a few km). */
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
