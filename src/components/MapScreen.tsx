'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cachedMapPoints, certificateUrl, clearPointsCache, fetchAllPlacesFallback, fetchMapPoints, fetchMyVotes, fetchNearby, fetchPlace, fetchQueue, vote } from '@/lib/places';
import { placeToPoint } from '@/lib/claims';
import { matchesCuisine } from '@/lib/cuisine';
import type { MapPoint, Need, NeedFilter, PendingClaim, Place } from '@/lib/types';
import { isOpen } from '@/lib/hours';
import { RAMAT_GAN, distanceToLine, haversine, type LatLng } from '@/lib/geo';
import { fetchDirections, type Directions, type TravelMode } from '@/lib/directions';
import { friendly } from '@/lib/errors';
import { MAPBOX_TOKEN } from '@/lib/mapboxToken';
import { useUser } from '@/lib/useUser';
import { speak, speechSupported, stopSpeaking } from '@/lib/speech';
import { formatMeters } from '@/lib/geo';
import Logo from './Logo';
import FilterBar from './FilterBar';
import PlaceList from './PlaceList';
import PlaceDetail from './PlaceDetail';
import NavPanel, { NavBanner } from './NavPanel';
import CommunityQueue from './CommunityQueue';
import AccountButton from './AccountButton';
import AuthDialog from './AuthDialog';
import AddPlaceDialog from './AddPlaceDialog';
import CertificateDialog from './CertificateDialog';
import AddInfoDialog from './AddInfoDialog';
import LocationPicker from './LocationPicker';
import type { FocusRequest, RouteLine } from './MapView';

// Mapbox touches `window`, so the map renders on the client only.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="map-msg">טוען מפה…</div>,
});

const NO_FILTER: NeedFilter = { kosher: null, vegan: null, gluten_free: null };
/** The list grows outward until it has enough places: 3 km, 15 km, 60 km, then all of Israel. */
const RADII_M = [3000, 15_000, 60_000, 450_000];
const TOKEN = MAPBOX_TOKEN;
// how close counts as "reached" the next turn / the destination
const NEAR_M: Record<TravelMode, number> = { walking: 20, cycling: 30, driving: 45 };
/** How far from the line counts as "left the route" and triggers a new route. */
const OFF_ROUTE_M: Record<TravelMode, number> = { walking: 45, cycling: 60, driving: 90 };
/** Default way to get there, by straight-line distance. */
const MANUAL_KEY = 'okeat:my-location';
type SavedLocation = LatLng & { label: string };
function loadManual(): SavedLocation | null {
  try { const v = JSON.parse(localStorage.getItem(MANUAL_KEY) ?? 'null'); return v && typeof v.lat === 'number' ? v : null; } catch { return null; }
}
function saveManual(v: SavedLocation | null) {
  try { if (v) localStorage.setItem(MANUAL_KEY, JSON.stringify(v)); else localStorage.removeItem(MANUAL_KEY); } catch { /* blocked */ }
}
const modeFor = (meters: number): TravelMode => (meters > 2500 ? 'driving' : 'walking');
type Sheet = 'peek' | 'half' | 'full';
type Tab = 'near' | 'queue';

interface Props {
  /** From /?place=<id>: open this place on load. */
  initialPlaceId?: string | null;
  /** From /auth/callback when sign-in failed. */
  authError?: boolean;
  /** From /map?need=vegan: start with this filter on. */
  initialNeed?: Need | null;
  /** From /map?add=1: start by picking a spot for a new place. */
  addOnLoad?: boolean;
}

export default function MapScreen({ initialPlaceId = null, authError = false, initialNeed = null, addOnLoad = false }: Props) {
  const sb = useMemo(() => createClient(), []);
  const { user, ready } = useUser(sb);

  // location
  const [me, setMe] = useState<LatLng | null>(null);
  const [located, setLocated] = useState<'pending' | 'ok' | 'fallback'>('pending');
  const [searchCenter, setSearchCenter] = useState<LatLng>(RAMAT_GAN);
  const [mapCenter, setMapCenter] = useState<LatLng>(RAMAT_GAN);

  // filters
  const [filter, setFilter] = useState<NeedFilter>(() =>
    initialNeed ? { ...NO_FILTER, [initialNeed]: initialNeed === 'kosher' ? 0 : 1 } : NO_FILTER,
  );
  const [openNow, setOpenNow] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [viewCenter, setViewCenter] = useState<LatLng | null>(null);

  // data
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [voted, setVoted] = useState<Map<string, 1 | -1>>(new Map());
  const [queue, setQueue] = useState<PendingClaim[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // selection + map
  const [tab, setTab] = useState<Tab>('near');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFallback, setSelectedFallback] = useState<Place | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [sheet, setSheet] = useState<Sheet>('peek');

  // navigation
  const [mode, setMode] = useState<TravelMode>('walking');
  const [directions, setDirections] = useState<Directions | null>(null);
  const [straight, setStraight] = useState<RouteLine | null>(null);
  const [dirLoading, setDirLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [stepIndex, setStepIndex] = useState(1);
  const [toNext, setToNext] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const [voice, setVoice] = useState(true);
  const spokenStep = useRef(-1);
  /** the person dragged the map during navigation: stop pulling the camera back */
  const [followPaused, setFollowPaused] = useState(false);
  const modeChosen = useRef(false);
  const lastReroute = useRef(0);
  const weakGpsWarned = useRef(false);

  // dialogs
  const [auth, setAuth] = useState<{ reason?: string } | null>(null);
  const [picking, setPicking] = useState(false);
  /** "where am I" menu, and picking my own location on the map */
  const [locOpen, setLocOpen] = useState(false);
  const [pickingMe, setPickingMe] = useState(false);
  const [manualLabel, setManualLabel] = useState<string | null>(null);
  const [addAt, setAddAt] = useState<LatLng | null>(null);
  const [certFor, setCertFor] = useState<Place | null>(null);
  const [infoFor, setInfoFor] = useState<{ place: Place; need: 'vegan' | 'gluten_free' } | null>(null);

  const [toast, setToast] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3600);
  }, []);

  useEffect(() => {
    if (authError) showToast('ההתחברות לא הצליחה. נסו שוב.');
  }, [authError, showToast]);

  // 1. Find the person.
  useEffect(() => {
    const fallback = () => {
      setLocated('fallback');
      setSearchCenter(RAMAT_GAN);
      setMapCenter(RAMAT_GAN);
    };
    // a location the person chose by hand earlier wins over GPS
    const saved = loadManual();
    if (saved) {
      const loc = { lat: saved.lat, lng: saved.lng };
      setMe(loc);
      setSearchCenter(loc);
      setMapCenter(loc);
      setManualLabel(saved.label);
      setLocated('ok');
      return;
    }
    if (!('geolocation' in navigator)) return fallback();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // The map covers Israel only; someone abroad starts in Ramat Gan.
        const inIsrael = loc.lat > 29.4 && loc.lat < 33.4 && loc.lng > 34.2 && loc.lng < 35.95;
        if (!inIsrael) return fallback();
        setMe(loc);
        setSearchCenter(loc);
        setMapCenter(loc);
        setLocated('ok');
      },
      fallback,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  }, []);

  // 2. Debounce typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // 3. Places around the search center.
  useEffect(() => {
    if (located === 'pending') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // No fixed radius: start close by, and widen step by step until there is enough to show.
    (async () => {
      let rows: Place[] = [];
      for (const radiusM of RADII_M) {
        rows = await fetchNearby(sb, { ...searchCenter, radiusM, filter, query: debouncedQuery, cuisine, limit: radiusM > 50_000 ? 1000 : 500 });
        if (cancelled || rows.length >= 25) break;
      }
      return rows;
    })()
      .then((rows) => !cancelled && setPlaces(rows))
      .catch(() => !cancelled && setError('לא הצלחנו לטעון מקומות. בדקו את החיבור ונסו שוב.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sb, located, searchCenter, filter, debouncedQuery, cuisine, refreshKey]);

  // 3b. Every matching place in the country, for the clustered map.
  // null = not available (e.g. migration 0004 not run yet): fall back to the nearby list
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const cached = refreshKey === 0 ? cachedMapPoints(filter, debouncedQuery, cuisine) : null;
    if (cached) setPoints(cached);
    fetchMapPoints(sb, filter, debouncedQuery, cuisine)
      .then((rows) => !cancelled && setPoints(rows))
      // older database: still show the whole country, not just the area around you
      .catch(() =>
        fetchAllPlacesFallback(sb, filter, debouncedQuery)
          .then((rows) => {
            if (cancelled) return;
            const pts = rows.map(placeToPoint);
            setPoints(cuisine ? pts.filter((p) => matchesCuisine(p, cuisine)) : pts);
          })
          .catch(() => !cancelled && setPoints(null)),
      );
    return () => {
      cancelled = true;
    };
  }, [sb, filter, debouncedQuery, cuisine, refreshKey]);

  // The list follows the map: after the person pans, show what's near the new center.
  useEffect(() => {
    if (selectedId || haversine(mapCenter, searchCenter) < 400) return;
    const t = setTimeout(() => setSearchCenter(mapCenter), 450);
    return () => clearTimeout(t);
  }, [mapCenter, searchCenter, selectedId]);

  // 4. Community queue (open to everyone).
  useEffect(() => {
    if (located === 'pending') return;
    let cancelled = false;
    setQueueLoading(true);
    fetchQueue(sb, { ...(me ?? searchCenter), radiusM: 8000 })
      .then((rows) => !cancelled && setQueue(rows))
      .catch(() => !cancelled && setQueue([]))
      .finally(() => !cancelled && setQueueLoading(false));
    return () => {
      cancelled = true;
    };
    // `me` changes while navigating; the queue doesn't need to follow every step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, located, user, searchCenter, refreshKey]);

  const visible = useMemo(() => (openNow ? places.filter((p) => isOpen(p.hours)) : places), [places, openNow]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return places.find((p) => p.id === selectedId) ?? (selectedFallback?.id === selectedId ? selectedFallback : null);
  }, [places, selectedId, selectedFallback]);

  // While navigating, only the destination stays on the map.
  const mapPlaces = useMemo(() => {
    if (navigating && selected) return [placeToPoint(selected)];
    // when "open now" is on, the map shows only what's open in the list
    const base = openNow || !points ? visible.map(placeToPoint) : points;
    return selected && !base.some((p) => p.id === selected.id) ? [...base, placeToPoint(selected)] : base;
  }, [points, visible, selected, navigating, openNow]);

  // 5. My earlier votes on what's on screen, so buttons show "אישרת".
  useEffect(() => {
    if (!user) {
      setVoted(new Map());
      return;
    }
    const ids = [...places, ...(selected ? [selected] : [])].flatMap((p) => p.claims.map((c) => c.id));
    fetchMyVotes(sb, [...new Set(ids)])
      .then((mine) => setVoted((prev) => new Map([...prev, ...mine])))
      .catch(() => {});
  }, [sb, user, places, selected]);

  // 6. Route to the selected place for the chosen mode.
  const routeRequest = useRef(0);
  const loadRoute = useCallback(
    async (place: Place, from: LatLng, m: TravelMode, keepOld = false) => {
      const req = ++routeRequest.current;
      if (!keepOld) {
        setStraight({ type: 'LineString', coordinates: [[from.lng, from.lat], [place.lng, place.lat]] });
        setDirections(null);
      }
      if (!TOKEN) return;
      setDirLoading(true);
      const d = await fetchDirections(TOKEN, m, from, place).catch(() => null);
      if (req !== routeRequest.current) return; // a newer request won
      if (d || !keepOld) setDirections(d);
      setStraight(null); // the dashed guess is only shown while the real route loads
      setDirLoading(false);
    },
    [],
  );

  const stopNav = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setNavigating(false);
    setFollowPaused(false);
    setToNext(null);
    stopSpeaking();
  }, []);

  const select = useCallback(
    async (id: string) => {
      stopNav();
      let place = places.find((p) => p.id === id) ?? null;
      if (!place) place = await fetchPlace(sb, id, me ?? searchCenter).catch(() => null);
      if (!place) {
        showToast('לא מצאנו את המקום הזה. ייתכן שהוא נמחק.');
        return;
      }
      setSelectedFallback(place);
      setSelectedId(id);
      setTab('near');
      setSheet('half');
      bodyRef.current?.scrollTo({ top: 0 });

      if (!me || haversine(me, place) > 60000) {
        setStraight(null);
        setDirections(null);
        setFocus({ key: Date.now(), points: [place] });
        return;
      }
      setFocus({ key: Date.now(), points: [me, place] });
      const m = modeChosen.current ? mode : modeFor(haversine(me, place));
      setMode(m);
      loadRoute(place, me, m);
    },
    [sb, places, me, searchCenter, mode, loadRoute, stopNav, showToast],
  );

  const deselect = useCallback(() => {
    stopNav();
    routeRequest.current++;
    setSelectedId(null);
    setStraight(null);
    setDirections(null);
  }, [stopNav]);

  /** Hide the route line but keep the place open. */
  const clearRoute = () => {
    stopNav();
    routeRequest.current++;
    setStraight(null);
    setDirections(null);
    setDirLoading(false);
  };

  /** Ask for a fresh position and move the map there. */
  /** The person told us where they are (address search or the pin on the map). */
  const setMyLocation = (loc: LatLng, label: string) => {
    setLocOpen(false);
    setPickingMe(false);
    setMe(loc);
    setLocated('ok');
    setSearchCenter(loc);
    setManualLabel(label);
    saveManual({ ...loc, label });
    setFocus({ key: Date.now(), points: selected ? [loc, selected] : [loc] });
    if (selected) loadRoute(selected, loc, modeChosen.current ? mode : modeFor(haversine(loc, selected)));
    showToast(`המיקום שלך עודכן: ${label}`);
  };

  const locateMe = () => {
    setLocOpen(false);
    setManualLabel(null);
    saveManual(null);
    if (!('geolocation' in navigator)) return showToast('הדפדפן הזה לא תומך במיקום.');
    showToast('מאתרים אותך…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(loc);
        setLocated('ok');
        setSearchCenter(loc);
        setFocus({ key: Date.now(), points: [loc] });
        setFollowPaused(false);
        if (pos.coords.accuracy > 1500) showToast('המיקום לא מדויק (כנראה לפי האינטרנט). בטלפון הוא יהיה מדויק יותר.');
        else setToast('');
      },
      () => showToast('לא קיבלנו את המיקום. בדקו שהרשיתם לאתר לראות מיקום.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const changeMode = (m: TravelMode) => {
    modeChosen.current = true;
    setMode(m);
    if (selected && me) loadRoute(selected, me, m);
  };

  const startNav = () => {
    if (!directions || !selected) return;
    setNavigating(true);
    weakGpsWarned.current = false;
    setFollowPaused(false);
    lastReroute.current = Date.now();
    setStepIndex(1);
    spokenStep.current = -1;
    if (voice && speechSupported()) speak(`יוצאים לדרך ל${selected.name}. ${directions.minutes} דקות. ${directions.steps[0]?.instruction ?? ''}`);
    setSheet('peek');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        // A rough fix (computers guess by internet address, kilometers off) would make the
        // route jump around or "arrive" by mistake, so only accurate readings move you.
        if (pos.coords.accuracy > 150) {
          if (!weakGpsWarned.current) { weakGpsWarned.current = true; showToast('המיקום במכשיר הזה לא מדויק. הניווט עובד הכי טוב בטלפון.'); }
          return;
        }
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { if (!weakGpsWarned.current) { weakGpsWarned.current = true; showToast('אין גישה למיקום, אז הניווט לא יתקדם לבד. בטלפון עם מיקום מופעל הוא יעבוד.'); } },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  };

  // Follow progress: distance to the next turn, advance steps, detect arrival.
  useEffect(() => {
    if (!navigating || !me || !directions || !selected) return;
    const steps = directions.steps;
    if (haversine(me, selected) < NEAR_M[mode] + 10) {
      stopNav();
      showToast(`הגעת ל${selected.name}! בתיאבון 🎉`);
      if (voice) speak(`הגעת ל${selected.name}. בתיאבון!`);
      return;
    }
    // Left the route: ask for a new one from here (at most every 12 seconds).
    if (distanceToLine(me, directions.geometry.coordinates) > OFF_ROUTE_M[mode] && Date.now() - lastReroute.current > 12000) {
      lastReroute.current = Date.now();
      showToast('מחשבים מסלול חדש…');
      loadRoute(selected, me, mode, true).then(() => setStepIndex(1));
      return;
    }
    // Move to the next turn once we're at this one, or already past it
    // (closer to the turn after it than this turn is), so a missed GPS fix can't get us stuck.
    let i = Math.min(stepIndex, steps.length - 1);
    while (i < steps.length - 1) {
      const here = haversine(me, steps[i].location);
      const passed = haversine(me, steps[i + 1].location) < haversine(steps[i].location, steps[i + 1].location);
      if (here < NEAR_M[mode] || passed) i++;
      else break;
    }
    if (i !== stepIndex) setStepIndex(i);
    setToNext(haversine(me, steps[i].location));
  }, [me, navigating, directions, selected, mode, stepIndex, stopNav, showToast, voice, loadRoute]);

  // Voice: announce each new turn once.
  useEffect(() => {
    if (!navigating || !voice || !directions || stepIndex === spokenStep.current) return;
    const step = directions.steps[stepIndex];
    if (!step || toNext === null) return;
    spokenStep.current = stepIndex;
    speak(toNext > 40 ? `בעוד ${formatMeters(toNext).replace('מ׳', 'מטר').replace('ק״מ', 'קילומטר')}, ${step.instruction}` : step.instruction, { interrupt: false });
  }, [navigating, voice, directions, stepIndex, toNext]);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // 7. Deep link: /?place=<id>
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!initialPlaceId || openedInitial.current || located === 'pending') return;
    openedInitial.current = true;
    select(initialPlaceId);
  }, [initialPlaceId, located, select]);

  // /map?add=1
  const addedOnLoad = useRef(false);
  useEffect(() => {
    if (!addOnLoad || addedOnLoad.current || located === 'pending') return;
    addedOnLoad.current = true;
    setPicking(true);
    // drop ?add=1 so a reload doesn't start adding again
    window.history.replaceState(null, '', '/map');
  }, [addOnLoad, located]);

  // Esc: cancel picking, else close the place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pickingMe) setPickingMe(false);
      else if (picking) setPicking(false);
      else if (navigating) stopNav();
      else deselect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deselect, picking, pickingMe, navigating, stopNav]);

  const refreshSelected = useCallback(async () => {
    clearPointsCache();
    setRefreshKey((k) => k + 1);
    if (selectedId) {
      const fresh = await fetchPlace(sb, selectedId, me ?? searchCenter).catch(() => null);
      if (fresh) setSelectedFallback(fresh);
    }
  }, [sb, selectedId, me, searchCenter]);

  const onVote = useCallback(
    async (claimId: string, value: 1 | -1) => {
      try {
        await vote(sb, claimId, value);
        setVoted((m) => new Map(m).set(claimId, value));
        setQueue((q) => q.filter((x) => x.claim_id !== claimId));
        showToast(value === 1 ? 'תודה, האישור נרשם' : 'תודה. הדיווח נשלח לבדיקה של הקהילה');
        refreshSelected();
      } catch (e) {
        showToast(friendly(e));
      }
    },
    [sb, showToast, refreshSelected],
  );

  const startAdd = () => {
    deselect();
    setPicking(true);
    setSheet('peek');
  };

  const share = async (place: Place) => {
    const url = `${window.location.origin}/place/${place.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('הקישור הועתק');
    } catch {
      showToast(url);
    }
  };

  const resetFilters = () => {
    setFilter(NO_FILTER);
    setOpenNow(false);
    setCuisine(null);
    setQuery('');
  };

  const route = directions?.geometry ?? (dirLoading ? straight : null);
  const activeNeeds = Object.values(filter).filter((v) => v !== null).length;
  const showSearchHere = false;
  const cycleSheet = () => setSheet((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
  const currentStep = navigating && directions ? directions.steps[Math.min(stepIndex, directions.steps.length - 1)] : null;

  return (
    <div className="app" data-sheet={sheet}>
      <div className="map-wrap">
        {!TOKEN ? (
          <div className="map-msg">חסר NEXT_PUBLIC_MAPBOX_TOKEN בקובץ ‎.env.local</div>
        ) : located === 'pending' ? (
          <div className="map-msg"><Logo size={64} /><span>מאתרים את המיקום שלך…</span></div>
        ) : (
          <MapView
            initialCenter={searchCenter}
            user={me}
            places={mapPlaces}
            selectedId={selectedId}
            route={route}
            focus={focus}
            onSelect={select}
            onUserMove={setMapCenter}
            picking={picking || pickingMe}
            onCenter={setViewCenter}
            follow={navigating && !followPaused}
            onUserDrag={() => navigating && setFollowPaused(true)}
          />
        )}

        {currentStep ? (
          <NavBanner step={currentStep} toNext={toNext} onStop={stopNav} voice={voice} onVoice={speechSupported() ? () => { setVoice((v) => !v); stopSpeaking(); } : undefined} />
        ) : pickingMe ? (
          <>
            <div className="pick-pin" aria-hidden="true"><span className="pin-head">🧍</span><span className="pin-shadow" /></div>
            <div className="pickbar" role="dialog" aria-label="בחירת המיקום שלי">
              <span>הזיזו את המפה כך שהסימן יעמוד במקום שבו אתם נמצאים</span>
              <span className="pick-acts">
                <button type="button" className="ok" onClick={() => setMyLocation(viewCenter ?? mapCenter, 'נבחר על המפה')}>אני כאן</button>
                <button type="button" onClick={() => setPickingMe(false)}>ביטול</button>
              </span>
            </div>
          </>
        ) : picking ? (
          <>
            <div className="pick-pin" aria-hidden="true"><span className="pin-head">📍</span><span className="pin-shadow" /></div>
            <div className="pickbar" role="dialog" aria-label="בחירת מיקום למקום חדש">
              <span>הזיזו את המפה כך שהסיכה תעמוד על המקום</span>
              <span className="pick-acts">
                <button type="button" className="ok" onClick={() => { setPicking(false); setAddAt(viewCenter ?? mapCenter); }}>זה המקום</button>
                <button type="button" onClick={() => setPicking(false)}>ביטול</button>
              </span>
            </div>
          </>
        ) : showSearchHere ? (
          <button type="button" className="search-here" onClick={() => setSearchCenter(mapCenter)}>
            חיפוש באזור הזה
          </button>
        ) : located === 'fallback' ? (
          <div className="notice">לא קיבלנו את המיקום שלך, אז מוצגת רמת גן. אפשר להזיז את המפה ולחפש באזור אחר.</div>
        ) : null}

        {locOpen && (
          <LocationPicker
            manualLabel={manualLabel}
            onGps={locateMe}
            onPickOnMap={() => { setLocOpen(false); stopNav(); setPickingMe(true); setSheet('peek'); if (me) setFocus({ key: Date.now(), points: [me] }); }}
            onChoose={setMyLocation}
            onClose={() => setLocOpen(false)}
          />
        )}

        {TOKEN && located !== 'pending' && !picking && !pickingMe && (
          <div className="map-tools">
            {navigating && followPaused ? (
              <button type="button" className="map-tool wide" onClick={() => setFollowPaused(false)}>🧭 חזרה למסלול</button>
            ) : (
              <button type="button" className={`map-tool wide${manualLabel ? ' manual' : ''}`} onClick={() => setLocOpen((o) => !o)} aria-expanded={locOpen} aria-haspopup="dialog">
                📍 {manualLabel ? 'המיקום שבחרתי' : 'המיקום שלי'}
              </button>
            )}
            {route && !navigating && (
              <button type="button" className="map-tool wide" onClick={clearRoute}>✕ הסתרת המסלול</button>
            )}
          </div>
        )}

        {!picking && !pickingMe && !navigating && TOKEN && located !== 'pending' && (
          <button type="button" className="fab" onClick={startAdd}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            הוספת מקום
          </button>
        )}
      </div>

      <aside className="panel" aria-label="מקומות" id="main" data-read-root>
        <button type="button" className="sheet-handle" onClick={cycleSheet} aria-label="הגדלה או הקטנה של הרשימה">
          <span />
        </button>
        <div className="panel-head">
          <div className="brand">
            <Link href="/" className="brand-home" aria-label="Okeat, לדף הבית">
              <Logo size={44} />
              <span className="brand-text">
                <span className="h1">okeat</span>
                <span className="tag">איפה באמת אפשר לאכול</span>
              </span>
            </Link>
            <AccountButton
              sb={sb}
              user={user}
              ready={ready}
              onSignIn={() => setAuth({})}
              onSignedOut={() => showToast('התנתקת')}
            />
          </div>
          <div className="search">
            <svg viewBox="0 0 24 24" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <label className="vh" htmlFor="q">חיפוש מקום</label>
            <input
              id="q"
              type="search"
              placeholder="חיפוש לפי שם או סוג מקום"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTab('near');
                if (selectedId) deselect();
              }}
              onFocus={() => sheet === 'peek' && setSheet('half')}
            />
          </div>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" className="tab" aria-selected={tab === 'near'} onClick={() => setTab('near')}>
              בסביבה
            </button>
            <button type="button" role="tab" className="tab" aria-selected={tab === 'queue'} onClick={() => { setTab('queue'); deselect(); }}>
              לאישור הקהילה {queue.length > 0 && <span className="count">{queue.length}</span>}
            </button>
          </div>
        </div>

        <div className="panel-body" ref={bodyRef}>
          {tab === 'queue' ? (
            <CommunityQueue
              signedIn
              items={queue}
              loading={queueLoading}
              onSignIn={() => setAuth({})}
              onVote={onVote}
              onShow={select}
              onAdd={startAdd}
            />
          ) : selected ? (
            <PlaceDetail
              place={selected}
              goPanel={
                <NavPanel
                  place={selected}
                  hasLocation={!!me}
                  mode={mode}
                  directions={directions}
                  loading={dirLoading}
                  navigating={navigating}
                  stepIndex={stepIndex}
                  toNext={toNext}
                  onMode={changeMode}
                  onStart={startNav}
                  onStop={stopNav}
                  onSetLocation={() => setLocOpen(true)}
                />
              }
              voted={voted}
              certificateUrl={(path) => certificateUrl(sb, path)}
              onBack={deselect}
              onVote={onVote}
              onAddCertificate={() => setCertFor(selected)}
              onAddInfo={(need) => setInfoFor({ place: selected, need })}
              onShare={() => share(selected)}
            />
          ) : (
            <>
              <FilterBar filter={filter} openNow={openNow} onFilter={setFilter} onOpenNow={setOpenNow} cuisine={cuisine} onCuisine={setCuisine} />
              <PlaceList
                places={visible}
                loading={loading || located === 'pending'}
                error={error}
                activeNeeds={activeNeeds}
                onSelect={select}
                onReset={resetFilters}
              />
            </>
          )}
        </div>
      </aside>

      {auth && <AuthDialog sb={sb} reason={auth.reason} onClose={() => setAuth(null)} />}

      {addAt && (
        <AddPlaceDialog
          sb={sb}
          location={addAt}
          onClose={() => setAddAt(null)}
          onDone={(id, warning) => {
            setAddAt(null);
            showToast(warning ?? 'תודה! המקום יופיע אחרי ששלושה אנשים יאשרו');
            setRefreshKey((k) => k + 1);
            select(id);
          }}
        />
      )}

      {infoFor && (
        <AddInfoDialog
          sb={sb}
          place={infoFor.place}
          need={infoFor.need}
          onClose={() => setInfoFor(null)}
          onDone={() => {
            setInfoFor(null);
            showToast('תודה! זה יופיע אחרי ששלושה אנשים יאשרו');
            refreshSelected();
          }}
        />
      )}

      {certFor && (
        <CertificateDialog
          sb={sb}
          place={certFor}
          onClose={() => setCertFor(null)}
          onDone={() => {
            setCertFor(null);
            showToast('התעודה נשלחה לאישור הקהילה');
            refreshSelected();
          }}
        />
      )}

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
