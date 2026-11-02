'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cachedMapPoints, certificateUrl, clearPointsCache, fetchAllPlacesFallback, fetchMapPoints, fetchProfile, fixPlaceLocation, fetchMyVotes, fetchNearby, fetchPlace, fetchQueue, vote } from '@/lib/places';
import { NEED_ORDER, placeToPoint } from '@/lib/claims';
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
import PlaceCommunity from './PlaceCommunity';
import LocationPicker from './LocationPicker';
import PlaceExtras from './PlaceExtras';
import { findCity } from '@/lib/geocode';
import DisplayToggles from './DisplayToggles';
import { useL } from './LangProvider';
import type { FocusRequest, RouteLine } from './MapView';

// Mapbox touches `window`, so the map renders on the client only.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const L = useL();
  return <div className="map-msg">{L('טוען מפה…', 'Loading the map…')}</div>;
}

const NO_FILTER = Object.fromEntries(NEED_ORDER.map((n) => [n, null])) as NeedFilter;
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
  const L = useL();
  const lang = L.lang;
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
  const centerGetter = useRef<(() => LatLng) | null>(null);

  // Phone: touching anywhere outside the search box closes the keyboard (iPhone keeps it open otherwise).
  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.matches('.panel-head input') && !(e.target as HTMLElement).closest('.panel-head input')) active.blur();
    };
    document.addEventListener('touchstart', onTouch, { passive: true });
    return () => document.removeEventListener('touchstart', onTouch);
  }, []);
  /** The exact point under the pin at this moment. */
  const pinPoint = () => centerGetter.current?.() ?? viewCenter ?? mapCenter;

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
  const [addAddress, setAddAddress] = useState('');
  const [addSearch, setAddSearch] = useState(false);
  const [certFor, setCertFor] = useState<Place | null>(null);
  const [infoFor, setInfoFor] = useState<{ place: Place; need: Need } | null>(null);

  const [toast, setToast] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3600);
  }, []);

  useEffect(() => {
    if (authError) showToast(L('ההתחברות לא הצליחה. נסו שוב.', 'Sign-in failed. Please try again.'));
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
      .catch(() => !cancelled && setError(L('לא הצלחנו לטעון מקומות. בדקו את החיבור ונסו שוב.', "We couldn't load places. Check your connection and try again.")))
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
      const d = await fetchDirections(TOKEN, m, from, place, lang).catch(() => null);
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
        showToast(L('לא מצאנו את המקום הזה. ייתכן שהוא נמחק.', "We couldn't find this place. It may have been removed."));
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
    showToast(L(`המיקום שלך עודכן: ${label}`, `Your location was updated: ${label}`));
  };

  const locateMe = () => {
    setLocOpen(false);
    setManualLabel(null);
    saveManual(null);
    if (!('geolocation' in navigator)) return showToast(L('הדפדפן הזה לא תומך במיקום.', "This browser doesn't support location."));
    showToast(L('מאתרים אותך…', 'Finding you…'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(loc);
        setLocated('ok');
        setSearchCenter(loc);
        setFocus({ key: Date.now(), points: [loc] });
        setFollowPaused(false);
        if (pos.coords.accuracy > 1500) showToast(L('המיקום לא מדויק (כנראה לפי האינטרנט). בטלפון הוא יהיה מדויק יותר.', 'The location is not accurate (probably from your internet connection). It will be more accurate on a phone.'));
        else setToast('');
      },
      () => showToast(L('לא קיבלנו את המיקום. בדקו שהרשיתם לאתר לראות מיקום.', "We didn't get your location. Check that the site is allowed to see it.")),
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
    if (voice && speechSupported()) speak(L(`יוצאים לדרך ל${selected.name}. ${directions.minutes} דקות. ${directions.steps[0]?.instruction ?? ''}`, `Starting the route to ${selected.name}. ${directions.minutes} minutes. ${directions.steps[0]?.instruction ?? ''}`));
    setSheet('peek');
    // A chosen location is not live GPS: the person moves through the turns with the buttons.
    if (manualLabel) {
      showToast(L('הניווט מתחיל מהמיקום שבחרת. לחצו "הבא" בכל פנייה.', 'Navigation starts from your chosen location. Press "Next" at each turn.'));
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        // A rough fix (computers guess by internet address, kilometers off) would make the
        // route jump around or "arrive" by mistake, so only accurate readings move you.
        if (pos.coords.accuracy > 150) {
          if (!weakGpsWarned.current) { weakGpsWarned.current = true; showToast(L('המיקום במכשיר הזה לא מדויק. הניווט עובד הכי טוב בטלפון.', 'The location on this device is not accurate. Navigation works best on a phone.')); }
          return;
        }
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { if (!weakGpsWarned.current) { weakGpsWarned.current = true; showToast(L('אין גישה למיקום. אפשרו מיקום בהגדרות הדפדפן, או בחרו מיקום ידנית בכפתור "המיקום שלי".', 'No access to your location. Allow location in your browser settings, or choose it with the "My location" button.')); } },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  };

  /** With a chosen location: go to the next or previous turn by hand. */
  const moveStep = (delta: number) => {
    if (!directions) return;
    const steps = directions.steps;
    const i = Math.max(1, Math.min(steps.length - 1, stepIndex + delta));
    setStepIndex(i);
    setMe(steps[i - 1].location);
  };

  // Follow progress: distance to the next turn, advance steps, detect arrival.
  useEffect(() => {
    if (!navigating || !me || !directions || !selected) return;
    const steps = directions.steps;
    if (haversine(me, selected) < NEAR_M[mode] + 10) {
      stopNav();
      showToast(L(`הגעת ל${selected.name}! בתיאבון 🎉`, `You've arrived at ${selected.name}! Enjoy your meal 🎉`));
      if (voice) speak(L(`הגעת ל${selected.name}. בתיאבון!`, `You've arrived at ${selected.name}. Enjoy your meal!`));
      return;
    }
    // Left the route: ask for a new one from here (at most every 12 seconds).
    if (distanceToLine(me, directions.geometry.coordinates) > OFF_ROUTE_M[mode] && Date.now() - lastReroute.current > 12000) {
      lastReroute.current = Date.now();
      showToast(L('מחשבים מסלול חדש…', 'Finding a new route…'));
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
    speak(toNext > 40
      ? (lang === 'en' ? `In ${formatMeters(toNext, 'en').replace(' km', ' kilometers').replace(' m', ' meters')}, ${step.instruction}` : `בעוד ${formatMeters(toNext).replace('מ׳', 'מטר').replace('ק״מ', 'קילומטר')}, ${step.instruction}`)
      : step.instruction, { interrupt: false });
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
    setFocus({ key: Date.now(), points: [viewCenter ?? mapCenter], exact: true });
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

  // Site admins can put a place at its real location.
  const [isAdmin, setIsAdmin] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixingPin, setFixingPin] = useState(false);
  // Desktop: the side panel can fold away. Opening a place brings it back.
  const [panelClosed, setPanelClosed] = useState(false);
  useEffect(() => { if (selectedId) setPanelClosed(false); }, [selectedId]);
  // Typing a city offers to move the map there.
  const [cityHit, setCityHit] = useState<{ name: string; point: LatLng } | null>(null);
  useEffect(() => {
    const text = debouncedQuery.trim();
    setCityHit(null);
    if (text.length < 2) return;
    const ctrl = new AbortController();
    findCity(text, lang, ctrl.signal).then(setCityHit).catch(() => undefined);
    return () => ctrl.abort();
  }, [debouncedQuery, lang]);
  const fixAddress = useRef<string | null>(null);
  useEffect(() => {
    if (!user || user.is_anonymous) { setIsAdmin(false); return; }
    fetchProfile(sb, user.id).then((p) => setIsAdmin(p?.role === 'admin')).catch(() => setIsAdmin(false));
  }, [sb, user]);
  const saveFix = async (point: LatLng, address: string | null) => {
    if (!selectedId) return;
    setFixOpen(false);
    setFixingPin(false);
    try {
      await fixPlaceLocation(sb, selectedId, point, address);
      await refreshSelected();
      setFocus({ key: Date.now(), points: [point] });
      showToast(L('המיקום של המקום עודכן', "The place's location was updated"));
    } catch {
      showToast(L('השינוי לא נשמר. נסו שוב.', "The change wasn't saved. Please try again."));
    }
  };

  const onVote = useCallback(
    async (claimId: string, value: 1 | -1) => {
      try {
        await vote(sb, claimId, value);
        setVoted((m) => new Map(m).set(claimId, value));
        setQueue((q) => q.filter((x) => x.claim_id !== claimId));
        showToast(value === 1 ? L('תודה, האישור נרשם', 'Thanks, your confirmation was saved') : L('תודה. הדיווח נשלח לבדיקה של הקהילה', 'Thanks. Your report was sent for the community to check'));
        refreshSelected();
      } catch (e) {
        showToast(friendly(e, lang));
      }
    },
    [sb, showToast, refreshSelected],
  );

  const startAdd = () => {
    deselect();
    setPicking(true);
    setSheet('peek');
    // start the pin on the spot in the middle of what the person is looking at
    setFocus({ key: Date.now(), points: [viewCenter ?? mapCenter], exact: true });
  };

  const share = async (place: Place) => {
    const url = `${window.location.origin}/place/${place.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(L('הקישור הועתק', 'Link copied'));
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
  const activeNeeds = Object.values(filter).filter((v) => v !== null && v !== undefined).length;
  const showSearchHere = false;
  const swipe = useRef<{ y: number; t: number; scrolled: boolean } | null>(null);
  const cycleSheet = () => {
    if (dragged.current) { dragged.current = false; return; }
    setSheet((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
  };

  // Phone: the list follows the finger on the handle and the header, then settles on the closest size.
  const appRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; t: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const sheetDrag = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const panel = e.currentTarget.closest('.panel') as HTMLElement | null;
      if (!panel || !panel.querySelector<HTMLElement>('.sheet-handle')?.offsetParent) return; // desktop
      if ((e.target as HTMLElement).closest('input, a, [role="tab"], button:not(.sheet-handle)')) return;
      drag.current = { y: e.clientY, h: panel.getBoundingClientRect().height, t: Date.now(), moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      const dy = d.y - e.clientY;
      if (!d.moved && Math.abs(dy) < 6) return;
      d.moved = true;
      appRef.current?.classList.add('sheet-dragging');
      const h = Math.min(window.innerHeight * 0.9, Math.max(150, d.h + dy));
      appRef.current?.style.setProperty('--sheet-h', `${h}px`);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      dragged.current = true;
      setTimeout(() => { dragged.current = false; }, 300);
      const vh = window.innerHeight;
      const dy = d.y - e.clientY;
      const end = d.h + dy;
      const sizes: [Sheet, number][] = [['peek', 236], ['half', vh * 0.56], ['full', vh * 0.9]];
      // a quick flick goes one size further in that direction
      const flick = Math.abs(dy) / Math.max(1, Date.now() - d.t) > 0.5;
      const aim = flick ? end + Math.sign(dy) * vh * 0.2 : end;
      const next = sizes.reduce((a, b) => (Math.abs(b[1] - aim) < Math.abs(a[1] - aim) ? b : a))[0];
      appRef.current?.classList.remove('sheet-dragging');
      appRef.current?.style.removeProperty('--sheet-h');
      setSheet(next);
    },
    onPointerCancel: () => {
      drag.current = null;
      appRef.current?.classList.remove('sheet-dragging');
      appRef.current?.style.removeProperty('--sheet-h');
    },
  };
  const currentStep = navigating && directions ? directions.steps[Math.min(stepIndex, directions.steps.length - 1)] : null;

  return (
    <div className="app" data-sheet={sheet} data-panel={panelClosed ? 'closed' : 'open'} ref={appRef}>
      <button type="button" className="panel-toggle" aria-expanded={!panelClosed} aria-label={panelClosed ? L('פתיחת התפריט', 'Open the menu') : L('קיפול התפריט', 'Fold the menu')} onClick={() => setPanelClosed((v) => !v)}>
        <span aria-hidden="true">{panelClosed ? '☰' : '✕'}</span>
      </button>
      <div className="map-wrap">
        {!TOKEN ? (
          <div className="map-msg">חסר NEXT_PUBLIC_MAPBOX_TOKEN בקובץ ‎.env.local</div>
        ) : located === 'pending' ? (
          <div className="map-msg"><Logo size={64} /><span>{L('מאתרים את המיקום שלך…', 'Finding your location…')}</span></div>
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
            picking={picking || pickingMe || fixingPin}
            onCenter={setViewCenter}
            centerGetter={centerGetter}
            follow={navigating && !followPaused}
            onUserDrag={() => navigating && setFollowPaused(true)}
            lang={lang}
          />
        )}

        {currentStep ? (
          <NavBanner step={currentStep} toNext={toNext} onStop={stopNav} onPrev={manualLabel ? () => moveStep(-1) : undefined} onNext={manualLabel ? () => moveStep(1) : undefined} voice={voice} onVoice={speechSupported() ? () => { setVoice((v) => !v); stopSpeaking(); } : undefined} />
        ) : fixingPin ? (
          <>
            <PickPin emoji="🍴" />
            <div className="pickbar" role="dialog" aria-label={L('תיקון מיקום המקום', "Fix the place's location")}>
              <span>{L('הזיזו את המפה או לחצו עליה, עד שחוד הסיכה נמצא בדיוק על המקום', 'Move or click the map until the tip of the pin is exactly on the place')}</span>
              <span className="pick-acts">
                <button type="button" className="ok" onClick={() => saveFix(pinPoint(), fixAddress.current)}>{L('זה המקום', "That's the place")}</button>
                <button type="button" onClick={() => setFixingPin(false)}>{L('ביטול', 'Cancel')}</button>
              </span>
            </div>
          </>
        ) : pickingMe ? (
          <>
            <PickPin emoji="🧍" />
            <div className="pickbar" role="dialog" aria-label={L('בחירת המיקום שלי', 'Choose my location')}>
              <span>{L('הזיזו את המפה או לחצו עליה, עד שחוד הסיכה נמצא במקום שבו אתם נמצאים', 'Move or click the map until the tip of the pin is where you are')}</span>
              <span className="pick-acts">
                <button type="button" className="ok" onClick={() => setMyLocation(pinPoint(), L('נבחר על המפה', 'Picked on the map'))}>{L('אני כאן', "I'm here")}</button>
                <button type="button" onClick={() => setPickingMe(false)}>{L('ביטול', 'Cancel')}</button>
              </span>
            </div>
          </>
        ) : picking ? (
          <>
            <PickPin emoji="🍴" />
            <div className="pickbar" role="dialog" aria-label={L('בחירת מיקום למקום חדש', 'Choose the spot for a new place')}>
              <span>{L('הזיזו את המפה או לחצו עליה, עד שחוד הסיכה נמצא בדיוק על המקום', 'Move or click the map until the tip of the pin is exactly on the place')}</span>
              <span className="pick-acts">
                <button type="button" className="ok" onClick={() => { const p = pinPoint(); setPicking(false); setAddAddress(''); setAddAt(p); }}>{L('זה המקום', "That's the place")}</button>
                <button type="button" onClick={() => setAddSearch(true)}>{L('לפי כתובת', 'By address')}</button>
                <button type="button" onClick={() => { setPicking(false); setAddSearch(false); }}>{L('ביטול', 'Cancel')}</button>
              </span>
            </div>
          </>
        ) : showSearchHere ? (
          <button type="button" className="search-here" onClick={() => setSearchCenter(mapCenter)}>
            {L('חיפוש באזור הזה', 'Search this area')}
          </button>
        ) : located === 'fallback' ? (
          <div className="notice">{L('לא קיבלנו את המיקום שלך, אז מוצגת רמת גן. אפשר להזיז את המפה ולחפש באזור אחר.', "We didn't get your location, so Ramat Gan is shown. You can move the map and search another area.")}</div>
        ) : null}

        {addSearch && (
          <LocationPicker
            adding
            manualLabel={null}
            near={viewCenter ?? me ?? mapCenter}
            onGps={() => undefined}
            onPickOnMap={() => setAddSearch(false)}
            onChoose={(point, label) => { setAddSearch(false); setPicking(false); setAddAddress(label); setAddAt(point); }}
            onClose={() => setAddSearch(false)}
          />
        )}
        {fixOpen && selected && (
          <LocationPicker
            fixing
            manualLabel={null}
            near={selected}
            onGps={() => undefined}
            onPickOnMap={(typed) => { fixAddress.current = typed || null; setFixOpen(false); setFixingPin(true); setSheet('peek'); setFocus({ key: Date.now(), points: [selected], exact: true }); }}
            onChoose={(point, label) => saveFix(point, label)}
            onClose={() => setFixOpen(false)}
          />
        )}
        {locOpen && (
          <LocationPicker
            manualLabel={manualLabel}
            near={viewCenter ?? me ?? mapCenter}
            onGps={locateMe}
            onPickOnMap={() => { setLocOpen(false); stopNav(); setPickingMe(true); setSheet('peek'); setFocus({ key: Date.now(), points: [me ?? viewCenter ?? mapCenter], exact: true }); }}
            onChoose={setMyLocation}
            onClose={() => setLocOpen(false)}
          />
        )}

        {TOKEN && located !== 'pending' && !picking && !pickingMe && (
          <div className="map-tools">
            {navigating && followPaused ? (
              <button type="button" className="map-tool wide" onClick={() => setFollowPaused(false)}>🧭 {L('חזרה למסלול', 'Back to the route')}</button>
            ) : (
              <button type="button" className={`map-tool wide${manualLabel ? ' manual' : ''}`} onClick={() => setLocOpen((o) => !o)} aria-expanded={locOpen} aria-haspopup="dialog">
                📍 {manualLabel ? L('המיקום שבחרתי', 'My chosen location') : L('המיקום שלי', 'My location')}
              </button>
            )}
            {route && !navigating && (
              <button type="button" className="map-tool wide" onClick={clearRoute}>✕ {L('הסתרת המסלול', 'Hide the route')}</button>
            )}
          </div>
        )}

        {!picking && !pickingMe && !navigating && TOKEN && located !== 'pending' && (
          <button type="button" className="fab" onClick={startAdd}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {L('הוספת מקום', 'Add a place')}
          </button>
        )}
      </div>

      <aside className="panel" aria-label={L('מקומות', 'Places')} id="main" data-read-root
        onTouchStart={(e) => { if ((e.target as HTMLElement).closest('.sheet-handle, .panel-head')) return; swipe.current = { y: e.touches[0].clientY, t: Date.now(), scrolled: (bodyRef.current?.scrollTop ?? 0) > 0 }; }}
        onTouchEnd={(e) => {
          const s0 = swipe.current;
          swipe.current = null;
          if (!s0 || Date.now() - s0.t > 700) return;
          const dy = e.changedTouches[0].clientY - s0.y;
          // swipe up: bigger; swipe down (when the list is at its top): smaller
          if (dy < -40) setSheet((v) => (v === 'peek' ? 'half' : 'full'));
          else if (dy > 40 && !s0.scrolled) setSheet((v) => (v === 'full' ? 'half' : 'peek'));
        }}>
        <button type="button" className="sheet-handle" {...sheetDrag} onClick={cycleSheet} aria-label={L('הגדלה או הקטנה של הרשימה', 'Make the list bigger or smaller')}>
          <span />
        </button>
        <div className="panel-head" {...sheetDrag}>
          <div className="brand">
            <Link href="/" className="brand-home" aria-label={L('Okeat, לדף הבית', 'Okeat, home page')}>
              <Logo size={44} />
              <span className="brand-text">
                <span className="h1">okeat</span>
                <span className="tag">{L('איפה באמת אפשר לאכול', 'Where you can really eat')}</span>
              </span>
            </Link>
            <DisplayToggles compact />
            <AccountButton
              sb={sb}
              user={user}
              ready={ready}
              onSignIn={() => setAuth({})}
              onSignedOut={() => showToast(L('התנתקת', 'You signed out'))}
            />
          </div>
          <div className="search">
            <svg viewBox="0 0 24 24" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <label className="vh" htmlFor="q">{L('חיפוש מקום', 'Search for a place')}</label>
            <input
              id="q"
              type="search"
              placeholder={L('חיפוש לפי שם או סוג מקום', 'Search by name or type of place')}
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTab('near');
                if (selectedId) deselect();
              }}
              onFocus={() => sheet === 'peek' && setSheet('half')}
              enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            />
          </div>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" className="tab" aria-selected={tab === 'near'} onClick={() => { setTab('near'); if (sheet === 'peek') setSheet('half'); }}>
              {L('בסביבה', 'Nearby')}
            </button>
            <button type="button" role="tab" className="tab" aria-selected={tab === 'queue'} onClick={() => { setTab('queue'); deselect(); if (sheet === 'peek') setSheet('half'); }}>
              {L('לאישור הקהילה', 'For the community to confirm')} {queue.length > 0 && <span className="count">{queue.length}</span>}
            </button>
          </div>
        </div>

        <div className="panel-body" ref={bodyRef}>
          {cityHit && !selected && (
            <button type="button" className="city-jump" onClick={() => {
              setFocus({ key: Date.now(), points: [cityHit.point], zoom: 13 });
              setQuery('');
              setSheet('peek');
            }}>
              <span aria-hidden="true">📍</span> {L(`הצגת האזור של ${cityHit.name} במפה`, `Show ${cityHit.name} on the map`)}
            </button>
          )}
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
              onFixLocation={isAdmin ? () => setFixOpen(true) : undefined}
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
              extra={
                <>
                <PlaceExtras
                  key={`extras-${selected.id}`}
                  sb={sb}
                  place={selected}
                  userId={user && !user.is_anonymous ? user.id : null}
                  isAdmin={isAdmin}
                  onSignIn={(reason) => setAuth({ reason })}
                  onToast={showToast}
                />
                <PlaceCommunity
                  key={selected.id}
                  sb={sb}
                  place={selected}
                  signedIn={!!user && !user.is_anonymous}
                  onSignIn={(reason) => setAuth({ reason })}
                  onToast={showToast}
                  onChanged={() => { setRefreshKey((k) => k + 1); refreshSelected(); }}
                />
                </>
              }
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
          initialAddress={addAddress}
          onClose={() => setAddAt(null)}
          onDone={(id, warning) => {
            setAddAt(null);
            showToast(warning ?? L('תודה! המקום כבר במפה, ומסומן "ממתין לאישור" עד ששלושה אנשים יאשרו', 'Thanks! The place is on the map now, marked "waiting" until three people confirm it'));
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
            showToast(L('תודה! זה יופיע אחרי ששלושה אנשים יאשרו', 'Thanks! This will appear after three people confirm it'));
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
            showToast(L('התעודה נשלחה לאישור הקהילה', 'The certificate was sent for the community to confirm'));
            refreshSelected();
          }}
        />
      )}

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

/** The tip of the pin is exactly the middle of the map, the point that gets saved. */
function PickPin({ emoji }: { emoji: string }) {
  return (
    <>
      <div className="pick-pin" aria-hidden="true">
        <svg viewBox="0 0 40 52" width="40" height="52">
          <path className="pin-body" d="M20 52C20 52 2 31 2 19a18 18 0 1 1 36 0c0 12-18 33-18 33Z" />
          <circle className="pin-face" cx="20" cy="19" r="13" />
          <text x="20" y="25" textAnchor="middle" fontSize="16">{emoji}</text>
        </svg>
      </div>
      <span className="pick-dot" aria-hidden="true" />
    </>
  );
}
