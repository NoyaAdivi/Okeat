import type { LatLng } from './geo';

export type TravelMode = 'walking' | 'driving' | 'cycling';

export const TRAVEL_MODES: { mode: TravelMode; label: string }[] = [
  { mode: 'walking', label: 'ברגל' },
  { mode: 'cycling', label: 'אופניים' },
  { mode: 'driving', label: 'רכב' },
];

export interface NavStep {
  instruction: string;
  /** meters until the next step */
  distance: number;
  type: string; // depart, turn, arrive, roundabout...
  modifier?: string; // left, right, slight left, straight, uturn...
  location: LatLng; // where this maneuver happens
}

export interface Directions {
  mode: TravelMode;
  minutes: number;
  meters: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  steps: NavStep[];
}

interface RawStep {
  distance: number;
  maneuver: { instruction: string; type: string; modifier?: string; location: [number, number] };
}

/** Route with turn-by-turn steps from the Mapbox Directions API, Hebrew instructions when available. */
export async function fetchDirections(token: string, mode: TravelMode, from: LatLng, to: LatLng): Promise<Directions | null> {
  const base =
    `https://api.mapbox.com/directions/v5/mapbox/${mode}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?geometries=geojson&overview=full&steps=true&access_token=${token}`;

  for (const lang of ['&language=he', '']) {
    const res = await fetch(base + lang);
    if (!res.ok) {
      if (lang) continue; // language not supported: retry in English
      return null;
    }
    const json = await res.json();
    const r = json.routes?.[0];
    if (!r) return null;
    const steps: NavStep[] = (r.legs?.[0]?.steps ?? []).map((s: RawStep) => ({
      instruction: s.maneuver.instruction,
      distance: s.distance,
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      location: { lng: s.maneuver.location[0], lat: s.maneuver.location[1] },
    }));
    return {
      mode,
      minutes: Math.max(1, Math.round(r.duration / 60)),
      meters: r.distance,
      geometry: r.geometry,
      steps,
    };
  }
  return null;
}

/** Arrival time as "14:52". */
export function eta(minutes: number, now = new Date()): string {
  const t = new Date(now.getTime() + minutes * 60000);
  return t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}

/** Rotation for an arrow that points up by default. */
export function arrowRotation(step: Pick<NavStep, 'type' | 'modifier'>): number {
  if (step.type === 'arrive') return 0;
  switch (step.modifier) {
    case 'left': return -90;
    case 'sharp left': return -135;
    case 'slight left': return -40;
    case 'right': return 90;
    case 'sharp right': return 135;
    case 'slight right': return 40;
    case 'uturn': return 180;
    default: return 0;
  }
}
