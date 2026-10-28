'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { NEED_LABELS, type MapPoint } from '@/lib/types';
import type { LatLng } from '@/lib/geo';
import { MAPBOX_TOKEN } from '@/lib/mapboxToken';
import { isDarkNow, motionAllowed } from '@/lib/prefs';
import { NEED_CLASS } from '@/lib/claims';
import { placeEmoji } from '@/lib/emoji';

export type RouteLine = { type: 'LineString'; coordinates: [number, number][] };
/** Change `key` to make the map frame these points. */
export type FocusRequest = { key: number; points: LatLng[] };

interface Props {
  initialCenter: LatLng;
  user: LatLng | null;
  /** every place to draw (clustered) */
  places: MapPoint[];
  selectedId: string | null;
  route: RouteLine | null;
  focus: FocusRequest | null;
  onSelect: (id: string) => void;
  /** Fired only after the person pans or zooms, not after programmatic moves. */
  onUserMove: (center: LatLng) => void;
  /** When true, a click on the map picks a location instead of doing nothing. */
  picking?: boolean;
  onPick?: (point: LatLng) => void;
  /** Keep the camera on the person (turn-by-turn navigation). */
  follow?: boolean;
  /** Center of the map after any move (used to place a new spot under the center pin). */
  onCenter?: (center: LatLng) => void;
  /** The person started dragging the map by hand. */
  onUserDrag?: () => void;
}

const STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
};
const RTL_PLUGIN = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

// The map only covers Israel: from Eilat to the Golan, with a little margin. [west, south], [east, north]
export const ISRAEL_BOUNDS: [[number, number], [number, number]] = [[34.05, 29.35], [36.05, 33.5]];

// Pastel map palette, matched to the logo. Applied over Mapbox's light/dark styles.
const MAP_COLORS = {
  light: { land: '#FFF7F3', water: '#C7E4F4', park: '#D6F2E1', building: '#F7E7EC', road: '#FFFFFF', label: '#6E5C7E' },
  dark: { land: '#1D1729', water: '#24324A', park: '#1F3329', building: '#2A2238', road: '#3A3150', label: '#B8A9CC' },
};

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const reducedMotion = () => !motionAllowed();

function safe(fn: () => void) {
  try { fn(); } catch { /* layer may not have this property in every style version */ }
}

const HIDDEN_LAYERS = /(rail|transit|path|steps|pedestrian|ferry|aeroway|admin|boundary|shield|poi-label|construction|golf|ski|aerialway|gate|turning)/;

// Map labels in Hebrew only: the Hebrew name if the map has one, else the local name when it's
// written in Hebrew. Names in Arabic, English or anything else are left blank.
const HEB_LETTERS = 'אבגדהוזחטיכךלמםנןסעפףצץקרשת';
const HEBREW_ONLY: mapboxgl.ExpressionSpecification = [
  'case',
  ['has', 'name_he'], ['get', 'name_he'],
  ['==', ['get', 'name_script'], 'Hebrew'], ['get', 'name'],
  ['in', ['slice', ['to-string', ['get', 'name']], 0, 1], HEB_LETTERS], ['get', 'name'],
  '',
];

/** Hebrew labels and the pastel palette. */
function styleMap(map: mapboxgl.Map, dark: boolean) {
  const c = dark ? MAP_COLORS.dark : MAP_COLORS.light;
  for (const layer of map.getStyle()?.layers ?? []) {
    const id: string = layer.id;
    // Clutter that doesn't help find food: rail and light-rail lines, paths and steps,
    // ferries, runways, boundaries, transit stops, road shields and other businesses' labels.
    if (HIDDEN_LAYERS.test(id)) {
      safe(() => map.setLayoutProperty(id, 'visibility', 'none'));
      continue;
    }
    if (layer.type === 'symbol' && /country-label/.test(id)) {
      safe(() => map.setFilter(id, ['==', ['get', 'iso_3166_1'], 'IL']));
    }
    if (layer.type === 'symbol') {
      const field = map.getLayoutProperty(id, 'text-field');
      if (field && JSON.stringify(field).includes('name')) {
        safe(() => map.setLayoutProperty(id, 'text-field', HEBREW_ONLY));
      }
      if (/(road|street|place|settlement|poi)/.test(id)) safe(() => map.setPaintProperty(id, 'text-color', c.label));
      continue;
    }
    if (layer.type === 'background') safe(() => map.setPaintProperty(id, 'background-color', c.land));
    if (layer.type === 'fill') {
      if (/water/.test(id)) safe(() => map.setPaintProperty(id, 'fill-color', c.water));
      else if (/(park|landuse|landcover|national)/.test(id)) safe(() => map.setPaintProperty(id, 'fill-color', c.park));
      else if (/building/.test(id)) safe(() => map.setPaintProperty(id, 'fill-color', c.building));
      else if (/^land/.test(id)) safe(() => map.setPaintProperty(id, 'fill-color', c.land));
    }
    if (layer.type === 'line' && /^(road|bridge|tunnel)-(street|minor|secondary|primary|major|motorway|trunk)/.test(id) && !/case/.test(id)) {
      safe(() => map.setPaintProperty(id, 'line-color', c.road));
    }
  }
}

function addRouteLayers(map: mapboxgl.Map) {
  if (!map.getSource('route')) map.addSource('route', { type: 'geojson', data: EMPTY, lineMetrics: true });
  if (!map.getLayer('route-case')) {
    map.addLayer({
      id: 'route-case', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': cssVar('--surface') || '#fff', 'line-width': 13 },
    });
  }
  if (!map.getLayer('route-line')) {
    map.addLayer({
      id: 'route-line', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': cssVar('--route') || '#8C7BFF', 'line-width': 7 },
    });
  }
}

const CLUSTER_COLORS = {
  light: { fill: '#FFB4A2', stroke: '#FFFFFF', text: '#2B2140' },
  dark: { fill: '#FF9C86', stroke: '#271F36', text: '#1D1729' },
};

/** Places as a clustered GeoJSON source. The selected place is drawn as its own marker instead. */
function placesGeoJSON(places: MapPoint[], selectedId: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: places
      .filter((p) => p.id !== selectedId)
      .map((p) => ({
        type: 'Feature' as const,
        properties: { pid: p.id },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
  };
}

function addPlaceLayers(map: mapboxgl.Map, dark: boolean) {
  const c = dark ? CLUSTER_COLORS.dark : CLUSTER_COLORS.light;
  if (!map.getSource('places')) {
    map.addSource('places', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 46, clusterMaxZoom: 16 });
  }
  if (!map.getLayer('clusters')) {
    map.addLayer({
      id: 'clusters', type: 'circle', source: 'places', filter: ['has', 'point_count'],
      paint: {
        'circle-color': c.fill,
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 23, 50, 29, 200, 36],
        'circle-stroke-width': 4,
        'circle-stroke-color': c.stroke,
        'circle-stroke-opacity': 0.9,
      },
    });
  }
  if (!map.getLayer('cluster-count')) {
    map.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'places', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 14, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true },
      paint: { 'text-color': c.text },
    });
  }
}

// Small scalloped seal, same shape as the logo.
const SCALLOP = (() => {
  let d = '';
  for (let i = 0; i < 12; i++) {
    const a = (2 * Math.PI * i) / 12;
    d += `<circle cx="${(18 + 14 * Math.cos(a)).toFixed(2)}" cy="${(18 + 14 * Math.sin(a)).toFixed(2)}" r="4.2"/>`;
  }
  return `${d}<circle cx="18" cy="18" r="14"/>`;
})();

function sealHTML(cls: string, letter: string) {
  return `<span class="mk-seal ${cls}"><svg viewBox="0 0 36 36" aria-hidden="true"><g class="sc">${SCALLOP}</g><circle class="face" cx="18" cy="18" r="11"/></svg><b>${letter}</b></span>`;
}

/**
 * Mapbox positions a marker by setting `transform` on the element it is given, so our own
 * animations (pop-in, hover, selected) must live on an inner element or they would move the marker away.
 */
function markerElement(p: MapPoint, selected: boolean, onClick: () => void): HTMLElement {
  const outer = document.createElement('div');
  outer.className = 'mk-anchor';
  outer.append(markerButton(p, selected, onClick));
  return outer;
}

function markerButton(p: MapPoint, selected: boolean, onClick: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'mk' + (selected ? ' sel' : '');

  const verified = p.seals;
  el.setAttribute(
    'aria-label',
    `${p.name}${verified.length ? ', ' + verified.map((c) => NEED_LABELS[c.need].label).join(', ') : ', ממתין לאישור'}`,
  );

  if (verified.length === 0) {
    // No confirmed info yet: a small emoji dot. The name shows on hover / when selected.
    el.className = 'mk plain' + (selected ? ' sel' : '') + (p.pending ? ' has-pending' : '');
    el.innerHTML = `<span class="mk-dot" aria-hidden="true">${placeEmoji(p.place_type)}</span>`;
    const label = document.createElement('span');
    label.className = 'mk-label';
    label.textContent = p.name;
    el.append(label);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return el;
  }

  const seals = verified.length
    ? verified
        .map((c) => {
          const cls = [
            (c.need === 'kosher' && (c.level === 'pikuach' || c.expired)) ? 'x' : NEED_CLASS[c.need],
            c.expired ? 'expired' : '',
            c.imported || c.level === 'marked' ? 'soft' : '',
          ].join(' ');
          return sealHTML(cls, NEED_LABELS[c.need].letter);
        })
        .join('')
    : sealHTML('x pending', '?');

  const label = document.createElement('span');
  label.className = 'mk-label';
  label.textContent = p.name;

  const wrap = document.createElement('span');
  wrap.className = 'mk-seals';
  wrap.innerHTML = seals;

  el.append(wrap, label);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

export default function MapView({
  initialCenter, user, places, selectedId, route, focus, onSelect, onUserMove, picking = false, onPick, follow = false, onCenter, onUserDrag,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const routeRef = useRef<RouteLine | null>(route);
  const onSelectRef = useRef(onSelect);
  const onUserMoveRef = useRef(onUserMove);
  const pickingRef = useRef(picking);
  const onPickRef = useRef(onPick);
  const onCenterRef = useRef(onCenter);
  onCenterRef.current = onCenter;
  const onUserDragRef = useRef(onUserDrag);
  onUserDragRef.current = onUserDrag;
  onSelectRef.current = onSelect;
  onUserMoveRef.current = onUserMove;
  pickingRef.current = picking;
  onPickRef.current = onPick;

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    // Older mapbox-gl needs the right-to-left plugin for Hebrew; newer versions removed
    // these functions and handle it themselves, so call them only if they exist.
    const rtl = mapboxgl as unknown as {
      getRTLTextPluginStatus?: () => string;
      setRTLTextPlugin?: (url: string, callback?: unknown, lazy?: boolean) => void;
    };
    if (rtl.getRTLTextPluginStatus?.() === 'unavailable') rtl.setRTLTextPlugin?.(RTL_PLUGIN, undefined, true);

    const map = new mapboxgl.Map({
      container: container.current,
      style: isDarkNow() ? STYLES.dark : STYLES.light,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 14.5,
      minZoom: 7,
      maxBounds: ISRAEL_BOUNDS,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');
    mapRef.current = map;
    // handy for debugging in the browser console (development only)
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __okeatMap?: unknown }).__okeatMap = map;

    // style.load fires on first load and after every setStyle (theme switch).
    map.on('style.load', () => {
      styleMap(map, isDarkNow());
      addRouteLayers(map);
      drawRoute(map, routeRef.current, false);
    });
    map.on('dragstart', () => onUserDragRef.current?.());
    map.on('moveend', (e) => {
      const center = map.getCenter();
      onCenterRef.current?.({ lat: center.lat, lng: center.lng });
      if (!('originalEvent' in e) || !e.originalEvent) return;
      const c = map.getCenter();
      onUserMoveRef.current({ lat: c.lat, lng: c.lng });
    });

    // Follow the theme: the system setting, or the choice in the accessibility menu.
    let dark = isDarkNow();
    const onTheme = () => {
      if (isDarkNow() === dark) return;
      dark = isDarkNow();
      map.setStyle(dark ? STYLES.dark : STYLES.light);
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onTheme);
    window.addEventListener('okeat-prefs', onTheme);

    return () => {
      mq.removeEventListener('change', onTheme);
      window.removeEventListener('okeat-prefs', onTheme);
      map.remove();
      mapRef.current = null;
    };
    // initialCenter is only the starting point; later moves go through `focus`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Place markers: clusters are drawn by Mapbox; single places get HTML seal markers.
  const placesRef = useRef<MapPoint[]>(places);
  const selectedRef = useRef<string | null>(selectedId);
  const live = useRef(new Map<string, mapboxgl.Marker>());
  const syncQueued = useRef(false);

  const syncMarkers = () => {
    const map = mapRef.current;
    if (!map || !map.getSource('places')) return;
    const byId = new Map(placesRef.current.map((p) => [p.id, p]));
    const want = new Set<string>();
    for (const f of map.querySourceFeatures('places', { filter: ['!', ['has', 'point_count']] })) {
      const pid = f.properties?.pid as string | undefined;
      if (pid && byId.has(pid)) want.add(pid);
    }
    if (selectedRef.current && byId.has(selectedRef.current)) want.add(selectedRef.current);
    for (const [id, m] of live.current) {
      if (!want.has(id)) {
        m.remove();
        live.current.delete(id);
      }
    }
    for (const id of want) {
      if (live.current.has(id)) continue;
      const p = byId.get(id)!;
      const sel = id === selectedRef.current;
      const m = new mapboxgl.Marker({ element: markerElement(p, sel, () => onSelectRef.current(p.id)), anchor: p.seals.length ? 'bottom' : 'center' })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      if (sel) m.getElement().style.zIndex = '3';
      live.current.set(id, m);
    }
  };

  const queueSync = () => {
    if (syncQueued.current) return;
    syncQueued.current = true;
    requestAnimationFrame(() => {
      syncQueued.current = false;
      syncMarkers();
    });
  };

  // Wire the cluster layers once the map exists (and again after a theme switch).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setup = () => {
      addPlaceLayers(map, isDarkNow());
      (map.getSource('places') as mapboxgl.GeoJSONSource).setData(placesGeoJSON(placesRef.current, selectedRef.current));
      queueSync();
    };
    if (map.isStyleLoaded()) setup();
    map.on('style.load', setup);
    map.on('render', queueSync);
    const onCluster = (e: mapboxgl.MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
      if (!f) return;
      const src = map.getSource('places') as mapboxgl.GeoJSONSource;
      const center = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
      src.getClusterExpansionZoom(f.properties?.cluster_id, (err: unknown, zoom?: number | null) => {
        if (err || zoom == null) return;
        map.easeTo({ center, zoom: zoom + 0.3, duration: reducedMotion() ? 0 : 600 });
      });
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const unpointer = () => { map.getCanvas().style.cursor = pickingRef.current ? 'crosshair' : ''; };
    map.on('click', 'clusters', onCluster);
    map.on('mouseenter', 'clusters', pointer);
    map.on('mouseleave', 'clusters', unpointer);
    return () => {
      map.off('style.load', setup);
      map.off('render', queueSync);
      map.off('click', 'clusters', onCluster);
      map.off('mouseenter', 'clusters', pointer);
      map.off('mouseleave', 'clusters', unpointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New data or a new selection: rebuild markers.
  useEffect(() => {
    placesRef.current = places;
    selectedRef.current = selectedId;
    for (const m of live.current.values()) m.remove();
    live.current.clear();
    const map = mapRef.current;
    const src = map?.getSource('places') as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(placesGeoJSON(places, selectedId));
    queueSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selectedId]);

  // "You are here".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !user) return;
    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'me-dot';
      el.setAttribute('aria-label', 'המיקום שלך');
      userMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(map);
    } else {
      userMarker.current.setLngLat([user.lng, user.lat]);
    }
    if (follow) {
      map.easeTo({
        center: [user.lng, user.lat],
        zoom: Math.max(map.getZoom(), 16.5),
        padding: { top: 140, bottom: isPhone() ? Math.round(window.innerHeight * 0.4) : 60, left: 40, right: 40 },
        duration: reducedMotion() ? 0 : 600,
      });
    }
  }, [user, follow]);

  // Route.
  useEffect(() => {
    routeRef.current = route;
    const map = mapRef.current;
    if (map && map.isStyleLoaded() && map.getSource('route')) drawRoute(map, route, true);
  }, [route]);

  // Crosshair while picking a location; markers stop taking clicks so the map gets them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = picking ? 'crosshair' : '';
    container.current?.classList.toggle('picking', picking);
  }, [picking]);

  // Frame requested points.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || focus.points.length === 0) return;
    const padding = {
      top: 90,
      left: 70,
      right: isPhone() ? 70 : 470, // desktop: keep clear of the floating panel on the right
      bottom: isPhone() ? Math.round(window.innerHeight * 0.56) : 90,
    };
    if (focus.points.length === 1) {
      const [p] = focus.points;
      map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15.5), padding, duration: reducedMotion() ? 0 : 700 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    focus.points.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding, maxZoom: 17, duration: reducedMotion() ? 0 : 800 });
  }, [focus]);

  // Inline position: mapbox-gl.css gives .mapboxgl-map `position: relative`, which would collapse the map to 0 height.
  return <div ref={container} className="map" style={{ position: 'absolute', inset: 0 }} />;
}

/** Sets the route data and reveals it from start to end. */
function drawRoute(map: mapboxgl.Map, route: RouteLine | null, animate: boolean) {
  const src = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData(route ? { type: 'Feature', properties: {}, geometry: route } : EMPTY);
  if (!route || !animate || reducedMotion()) {
    safe(() => map.setPaintProperty('route-line', 'line-trim-offset', [0, 0]));
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / 900);
    const eased = 1 - Math.pow(1 - k, 3);
    safe(() => map.setPaintProperty('route-line', 'line-trim-offset', [eased, 1]));
    if (k < 1) requestAnimationFrame(step);
    else safe(() => map.setPaintProperty('route-line', 'line-trim-offset', [0, 0]));
  };
  requestAnimationFrame(step);
}
