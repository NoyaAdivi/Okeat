'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cachedMapPoints, certificateUrl, clearPointsCache, fetchAllPlacesFallback, fetchMapPoints, fetchProfile, fixPlaceLocation, fetchMyVotes, fetchNearby, fetchPlace, fetchQueue, vote } from '@/lib/places';
import { NEED_ORDER, placeToPoint, withoutPending } from '@/lib/claims';
import { matchesAnyCuisine } from '@/lib/cuisine';
import type { MapPoint, Need, NeedFilter, PendingClaim, Place } from '@/lib/types';
import { isOpen } from '@/lib/hours';
import { snapToLine, RAMAT_GAN, distanceToLine, haversine, type LatLng } from '@/lib/geo';
import { fetchDirections, type Directions, type TravelMode } from '@/lib/directions';
import { friendly } from '@/lib/errors';
import { MAPBOX_TOKEN } from '@/lib/mapboxToken';
import { useUser } from '@/lib/useUser';
import { speak, speechSupported, stopSpeaking } from '@/lib/speech';
import { formatMeters } from '@/lib/geo';
import Logo from './Logo';
import FilterBar from './FilterBar';
import LocationHelp from './LocationHelp';
import LocationAsk, { readAsked, saveAsked, takeRetry } from './LocationAsk';
import PlaceList from './PlaceList';
import PlaceDetail from './PlaceDetail';
import NavPanel, { NavBanner } from './NavPanel';
import CommunityQueue from './CommunityQueue';
import AccountButton from './AccountButton';
import AuthDialog from './AuthDialog';
import { logClientError } from '@/lib/errorLog';
import AddPlaceDialog from './AddPlaceDialog';
import CertificateDialog from './CertificateDialog';
import AddInfoDialog from './AddInfoDialog';
import PlaceCommunity from './PlaceCommunity';
import LocationPicker from './LocationPicker';
import PlaceExtras from './PlaceExtras';
import { findCity } from '@/lib/geocode';
import { logCity, logSearch } from '@/lib/places';
import { isCityName, parseSearch } from '@/lib/checks';
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
const FILTER_KEY = 'okeat-my-filter';
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
  initialQuery?: string;
  /** From /map?add=1: start by picking a spot for a new place. */
  addOnLoad?: boolean;
}

export default function MapScreen({ initialPlaceId = null, authError = false, initialNeed = null, addOnLoad = false, initialQuery = '' }: Props) {
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
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [cuisine, setCuisine] = useState<string[]>([]);
  const [viewCenter, setViewCenter] = useState<LatLng | null>(null);
  const centerGetter = useRef<(() => LatLng) | null>(null);

  // Phone: touching anywhere outside the search box closes the keyboard (iPhone keeps it open otherwise).
  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.matches('.panel-head input') && !(e.target as HTMLElement).closest('.panel-head input')) active.blur();
    };
    // iPhone pushes the page up for the keyboard and doesn't always bring it back.
    const onBlur = () => setTimeout(() => window.scrollTo(0, 0), 60);
    document.addEventListener('touchstart', onTouch, { passive: true });
    document.addEventListener('focusout', onBlur);
    return () => { document.removeEventListener('touchstart', onTouch); document.removeEventListener('focusout', onBlur); };
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
  const [turned, setTurned] = useState(false);
  const [strayed, setStrayed] = useState(false);
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
  const [auth, setAuth] = useState<{ reason?: string; startWithCode?: boolean } | null>(null);
  const [picking, setPicking] = useState(false);
  /** "where am I" menu, and picking my own location on the map */
  const [locOpen, setLocOpen] = useState(false);
  const [pickingMe, setPickingMe] = useState(false);
  const [manualLabel, setManualLabel] = useState<string | null>(null);
  const [addAt, setAddAt] = useState<LatLng | null>(null);
  const [addAddress, setAddAddress] = useState('');
  const [addSearch, setAddSearch] = useState(false);
  const [locHelp, setLocHelp] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [ask, setAsk] = useState(false);
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
    if (authError) {
      const failedGoogle = new URLSearchParams(window.location.search).get('why') === 'google';
      if (failedGoogle) {
        showToast(L('ההתחברות עם Google לא הושלמה. אפשר לנסות שוב, או להיכנס במייל.', "Signing in with Google didn't finish. Try again, or use your email."));
        setAuth({});
      } else {
        showToast(L('הקישור במייל כבר לא תקף. אפשר לכתוב את הקוד מהמייל, או לבקש חדש.', 'The link in the email no longer works. Enter the code from the email, or ask for a new one.'));
        setAuth({ startWithCode: true });
      }
      const url = new URL(window.location.href);
      const why = url.searchParams.get('why');
      if (why) logClientError(`sign-in link failed: ${why}`);
      // Otherwise the next email link brings this error back after a good sign-in.
      url.searchParams.delete('auth_error');
      url.searchParams.delete('why');
      window.history.replaceState(window.history.state, '', url);
    }
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
    const askFirst = () => { fallback(); if (!authError) setAsk(true); };
    const go = () => navigator.geolocation.getCurrentPosition(
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
      (err) => {
        fallback();
        if (retried && err.code === err.PERMISSION_DENIED) setLocHelp(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
    const retried = takeRetry();
    const asked = readAsked();
    if (asked === 'yes') return go();
    if (asked === 'no') return fallback();
    const query = navigator.permissions?.query({ name: 'geolocation' });
    if (query) query.then((p) => (p.state === 'granted' ? go() : askFirst())).catch(askFirst);
    else askFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Debounce typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // What the search means: a sentence narrows the results right away, without pressing anything.
  const heard = useMemo(() => parseSearch(debouncedQuery), [debouncedQuery]);
  const openFilter = openNow || heard.openNow;
  const wanted = useMemo(() => ({
    filter: heard.needs.length ? { ...filter, ...Object.fromEntries(heard.needs.map((n) => [n, filter[n as Need] ?? (n === 'kosher' ? 0 : 1)])) } as NeedFilter : filter,
    query: heard.city && !heard.needs.length && !heard.openNow ? debouncedQuery : heard.rest,
    cuisine,
  }), [filter, cuisine, heard, debouncedQuery]);

  // Fast taps must not each load the whole country: wait for a short pause, and only the last choice counts.
  const [settled, setSettled] = useState(wanted);
  useEffect(() => {
    const t = setTimeout(() => setSettled(wanted), 220);
    return () => clearTimeout(t);
  }, [wanted]);

  // 3. Places around the search center.
  useEffect(() => {
    if (located === 'pending') return;
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    // No fixed radius: start close by, and widen step by step until there is enough to show.
    (async () => {
      let rows: Place[] = [];
      for (const radiusM of RADII_M) {
        rows = await fetchNearby(sb, { ...searchCenter, radiusM, ...settled, limit: radiusM > 50_000 ? 1000 : 500, signal: ctrl.signal });
        if (cancelled || rows.length >= 25) break;
      }
      return rows;
    })()
      .then((rows) => !cancelled && setPlaces(rows))
      .catch(() => !cancelled && setError(L('לא הצלחנו לטעון מקומות. בדקו את החיבור ונסו שוב.', "We couldn't load places. Check your connection and try again.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [sb, located, searchCenter, settled, refreshKey]);

  // 3b. Every matching place in the country, for the clustered map.
  // null = not available (e.g. migration 0004 not run yet): fall back to the nearby list
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const { filter: f, query: q, cuisine: c } = settled;
    const cached = refreshKey === 0 ? cachedMapPoints(f, q, c) : null;
    if (cached) { setPoints(cached); return; }
    fetchMapPoints(sb, f, q, c, ctrl.signal)
      .then((rows) => !cancelled && setPoints(rows))
      // older database: still show the whole country, not just the area around you
      .catch(() => {
        if (cancelled) return;
        fetchAllPlacesFallback(sb, f, q)
          .then((rows) => {
            if (cancelled) return;
            const pts = rows.map(placeToPoint);
            setPoints(c.length ? pts.filter((p) => matchesAnyCuisine(p, c)) : pts);
          })
          .catch(() => !cancelled && setPoints(null));
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [sb, settled, refreshKey]);

  // The list follows the map: after the person pans, show what's near the new center.
  useEffect(() => {
    if (selectedId || haversine(mapCenter, searchCenter) < 400) return;
    const t = setTimeout(() => setSearchCenter(mapCenter), 450);
    return () => clearTimeout(t);
  }, [mapCenter, searchCenter, selectedId]);

  // 4. Community queue, for signed-in people.
  useEffect(() => {
    if (located === 'pending') return;
    if (!user || user.is_anonymous) { setQueue([]); setQueueLoading(false); return; }
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

  const signedIn = !!user && !user.is_anonymous;
  const visible = useMemo(() => {
    const open = openFilter ? places.filter((p) => isOpen(p.hours)) : places;
    const shown = signedIn ? open : open.map(withoutPending);
    // Minutes are from where you are, not from wherever the map happens to be. Unknown location: no minutes.
    if (!me) return shown.map((p) => ({ ...p, distance_m: null }));
    return shown.map((p) => ({ ...p, distance_m: Math.round(haversine(me, p)) })).sort((a, b) => a.distance_m - b.distance_m);
  }, [places, openFilter, signedIn, me]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return places.find((p) => p.id === selectedId) ?? (selectedFallback?.id === selectedId ? selectedFallback : null);
  }, [places, selectedId, selectedFallback]);

  // While navigating, only the destination stays on the map.
  const mapPlaces = useMemo(() => {
    if (navigating && selected) return [placeToPoint(selected)];
    // when "open now" is on, the map shows only what's open in the list
    const base = openFilter || !points ? visible.map(placeToPoint) : points;
    return selected && !base.some((p) => p.id === selected.id) ? [...base, placeToPoint(selected)] : base;
  }, [points, visible, selected, navigating, openFilter]);

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
      setSheet((s) => (s === 'full' ? 'full' : 'half'));
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
    setMapCenter(loc); // or the list follows the old map position straight back
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
    const found = (pos: GeolocationPosition) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(loc);
        setLocated('ok');
        setSearchCenter(loc);
        setMapCenter(loc);
        setFocus({ key: Date.now(), points: [loc] });
        setFollowPaused(false);
        if (pos.coords.accuracy > 1500) showToast(L('המיקום לא מדויק (כנראה לפי האינטרנט). בטלפון הוא יהיה מדויק יותר.', 'The location is not accurate (probably from your internet connection). It will be more accurate on a phone.'));
        else setToast('');
      };
    const failed = (err: GeolocationPositionError) => {
      setToast('');
      if (err.code === err.PERMISSION_DENIED) setLocHelp(true);
      else showToast(L('לא הצלחנו למצוא את המיקום. נסו שוב, או בחרו מיקום בעצמכם.', "We couldn't find your location. Try again, or choose one yourself."));
    };
    // GPS first. Indoors it can time out, so the rougher answer from the network is the second try.
    navigator.geolocation.getCurrentPosition(found, (err) => {
      if (err.code === err.PERMISSION_DENIED) return failed(err);
      navigator.geolocation.getCurrentPosition(found, failed, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  };

  // Our question first. If the browser already allowed it, there is nothing to ask.
  const askForGps = () => {
    setLocOpen(false);
    const query = navigator.permissions?.query({ name: 'geolocation' });
    if (query) query.then((p) => (p.state === 'granted' ? locateMe() : setAsk(true))).catch(() => setAsk(true));
    else setAsk(true);
  };

  const changeMode = (m: TravelMode) => {
    modeChosen.current = true;
    setMode(m);
    if (selected && me) loadRoute(selected, me, m);
  };

  // The route waits for the location, and gets one more try if the network failed.
  const routeTried = useRef('');
  useEffect(() => {
    if (!selected || !me || directions || dirLoading || navigating) return;
    if (haversine(me, selected) > 60000) return;
    const m = modeChosen.current ? mode : modeFor(haversine(me, selected));
    const key = `${selected.id}-${m}`;
    if (routeTried.current === key) return;
    routeTried.current = key;
    loadRoute(selected, me, m);
  }, [selected, me, directions, dirLoading, navigating, mode, loadRoute]);

  // The dot stays live before navigation starts too. Small GPS wobble is ignored.
  const liveMe = useRef<LatLng | null>(null);
  liveMe.current = me;
  useEffect(() => {
    if (located !== 'ok' || manualLabel || navigating || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > 100) return;
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!liveMe.current || haversine(liveMe.current, next) >= 12) setMe(next);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [located, manualLabel, navigating]);

  // A better fix can land away from the route preview: draw it again from there.
  useEffect(() => {
    if (navigating || !selected || !me || !directions || dirLoading || manualLabel) return;
    if (distanceToLine(me, directions.geometry.coordinates) <= OFF_ROUTE_M[mode]) return;
    if (Date.now() - lastReroute.current < 12000) return;
    lastReroute.current = Date.now();
    loadRoute(selected, me, mode, true);
  }, [me, navigating, selected, directions, dirLoading, manualLabel, mode, loadRoute]);

  // After moving the map by hand, the view returns to the person by itself.
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pauseFollow = () => {
    setFollowPaused(true);
    clearTimeout(followTimer.current);
    followTimer.current = setTimeout(() => setFollowPaused(false), 10000);
  };

  const startNav = () => {
    if (!directions || !selected) return;
    setNavigating(true);
    weakGpsWarned.current = false;
    setFollowPaused(false);
    // The first GPS fix on a phone is rough, so the next one may fix the route right away.
    lastReroute.current = 0;
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
  const askedToAdd = useRef(false);
  useEffect(() => {
    if (!addOnLoad || addedOnLoad.current || located === 'pending' || !ready) return;
    // Sign in comes first, so nobody fills in the whole form for nothing.
    if (!user || user.is_anonymous) {
      if (!askedToAdd.current) { askedToAdd.current = true; needAccount(); }
      return;
    }
    addedOnLoad.current = true;
    setPicking(true);
    setFocus({ key: Date.now(), points: [viewCenter ?? mapCenter], exact: true });
    // drop ?add=1 so a reload doesn't start adding again
    window.history.replaceState(null, '', '/map');
  }, [addOnLoad, located, ready, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // A phone has no pointer to hover with. The first tap on a button shows its name, the second uses it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e as PointerEvent).pointerType === 'mouse') return;
      const button = (e.target as HTMLElement).closest?.('.map-tool.wide, .fab');
      if (!button) return;
      if (button.classList.contains('show-name')) {
        button.classList.remove('show-name');
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.show-name').forEach((b) => b.classList.remove('show-name'));
      button.classList.add('show-name');
      setTimeout(() => button.classList.remove('show-name'), 3500);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

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
  // Typing a city moves the map there. A close match only offers to.
  const [cityHit, setCityHit] = useState<{ name: string; point: LatLng } | null>(null);
  useEffect(() => {
    const text = debouncedQuery.trim();
    setCityHit(null);
    if (text.length < 2) return;
    if (heard.rest !== text && !heard.city) return; // a sentence, not the name of a city
    const ctrl = new AbortController();
    findCity(text, lang, ctrl.signal).then((hit) => {
      if (!hit) return;
      if (!isCityName(text, hit.name) || selectedId) { setCityHit(hit); return; }
      setFocus({ key: Date.now(), points: [hit.point], zoom: 13 });
      setMapCenter(hit.point);
      setSearchCenter(hit.point);
      logCity(sb, hit.name, hit.point.lat, hit.point.lng);
      setQuery('');
      setSheet('peek');
      showToast(L(`עברנו ל${hit.name}`, `Moved to ${hit.name}`));
    }).catch(() => undefined);
    return () => ctrl.abort();
  }, [debouncedQuery, lang]);
  // Words the map understands, like a need, "open now" or a city. Used on Enter or by the button, never while typing.
  const smart = useMemo(() => {
    const parsed = parseSearch(query);
    return parsed.needs.length > 0 || parsed.openNow || parsed.city ? parsed : null;
  }, [query]);
  const applySmart = async () => {
    if (!smart) return;
    setFilter((f) => ({ ...f, ...Object.fromEntries(smart.needs.map((n) => [n, n === 'kosher' ? 0 : 1])) }));
    if (smart.openNow) setOpenNow(true);
    const hit = smart.city ? await findCity(smart.city, lang, new AbortController().signal).catch(() => null) : null;
    const isCity = !!hit && isCityName(smart.city!, hit.name);
    setQuery(isCity || !smart.city ? smart.rest : L(`${smart.rest} ב${smart.city}`, `${smart.rest} in ${smart.city}`).trim());
    if (isCity) {
      setFocus({ key: Date.now(), points: [hit.point], zoom: 13 });
      setMapCenter(hit.point);
      setSearchCenter(hit.point);
      logCity(sb, hit.name, hit.point.lat, hit.point.lng);
    }
    setSheet('half');
  };

  // Remember what people look for, without remembering who: the settled text only, after a pause.
  useEffect(() => {
    const term = debouncedQuery.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => logSearch(sb, term), 2500);
    return () => clearTimeout(t);
  }, [sb, debouncedQuery]);

  // A filter someone always uses stays on this device, and nowhere else: dietary needs can be personal.
  const [myFilter, setMyFilter] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY);
      if (!saved) return;
      setMyFilter(true);
      if (!initialNeed) setFilter({ ...NO_FILTER, ...JSON.parse(saved) });
    } catch { /* blocked storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleMyFilter = () => {
    try {
      if (myFilter) localStorage.removeItem(FILTER_KEY);
      else localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
      setMyFilter(!myFilter);
      showToast(myFilter ? L('הסינון הקבוע בוטל', 'Your saved filter was removed') : L('שמרנו. הסינון יופעל כאן בכל כניסה', "Saved. This filter will be on every time you come back"));
    } catch { /* blocked storage */ }
  };
  // The community queue is for people who are signed in.
  useEffect(() => { if ((!user || user.is_anonymous) && tab === 'queue') setTab('near'); }, [user, tab]);
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

  // Looking is open to everyone. Changing what's on the site needs an account.
  const needAccount = () => {
    if (user && !user.is_anonymous) return false;
    setAuth({ reason: L('כדי להוסיף, לאשר או לתקן מידע צריך להתחבר. כך המידע באתר נשאר אמין.', 'To add, confirm or fix information, please sign in. This keeps the site reliable.') });
    return true;
  };

  const onVote = useCallback(
    async (claimId: string, value: 1 | -1) => {
      if (needAccount()) return;
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
    [sb, user, showToast, refreshSelected],
  );

  const startAdd = () => {
    if (needAccount()) return;
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

  const clearFilters = () => {
    setFilter(NO_FILTER);
    setOpenNow(false);
    setCuisine([]);
  };
  const resetFilters = () => {
    clearFilters();
    setQuery('');
  };

  const snapped = useMemo(() => {
    if (!navigating || !me || !directions) return null;
    const s = snapToLine(me, directions.geometry.coordinates);
    return s && s.meters <= OFF_ROUTE_M[mode] ? s : null;
  }, [navigating, me, directions, mode]);

  // Roads rarely pass exactly through a point, so the line is joined to the person and to the place.
  const route = useMemo(() => {
    if (!directions) return dirLoading ? straight : null;
    const line = directions.geometry.coordinates;
    // On the way the dot rides the line and the part already walked disappears.
    const coordinates: [number, number][] = snapped
      ? [[snapped.point.lng, snapped.point.lat], ...line.slice(snapped.index + 1)]
      : me ? [[me.lng, me.lat], ...line] : [...line];
    if (selected) coordinates.push([selected.lng, selected.lat]);
    return { ...directions.geometry, coordinates };
  }, [directions, dirLoading, straight, me, snapped, selected]);
  const activeNeeds = Object.values(filter).filter((v) => v !== null && v !== undefined).length;
  const showSearchHere = false;
  const swipe = useRef<{ x: number; y: number; t: number; scrolled: boolean } | null>(null);
  const cycleSheet = () => {
    if (dragged.current) { dragged.current = false; return; }
    setSheet((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
  };

  // Phone: the list follows the finger on the handle and the header, then settles on the closest size.
  const appRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; t: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  // On a phone this sits at the top of the screen; beside the list it stays in the panel.
  const brandBar = (
      <div className="brand">
        <Link href="/" className="brand-home" aria-label={L('Okeat, לדף הבית', 'Okeat, home page')}>
          <Logo size={44} />
          <span className="brand-text">
            <span className="h1">okeat</span>
            <span className="tag">{L('איפה באמת אפשר לאכול', 'Where you can really eat')}</span>
          </span>
        </Link>
        <Link href="/" className="dt-btn map-home" aria-label={L('לדף הבית', 'To the home page')} title={L('לדף הבית', 'To the home page')}>
          <span aria-hidden="true">🏠</span>
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
  );

  // A sheet pulled all the way up stops under the top bar.
  const sheetMax = () => window.innerHeight - (document.querySelector('.map-top')?.getBoundingClientRect().height ?? 0);

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
      const h = Math.min(sheetMax(), Math.max(150, d.h + dy));
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
      const sizes: [Sheet, number][] = [['peek', 200], ['half', vh * 0.56], ['full', sheetMax()]];
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
    <div className="app" data-sheet={sheet} data-panel={panelClosed ? 'closed' : 'open'} data-place={selected ? 'open' : undefined} ref={appRef}>
      <button type="button" className="panel-toggle" aria-expanded={!panelClosed} aria-label={panelClosed ? L('פתיחת התפריט', 'Open the menu') : L('קיפול התפריט', 'Fold the menu')} onClick={() => setPanelClosed((v) => !v)}>
        <span aria-hidden="true">{panelClosed ? '☰' : '✕'}</span>
      </button>
      <div className="map-wrap">
        {!TOKEN ? (
          <div className="map-msg">{L('המפה לא זמינה כרגע. נסו שוב בעוד רגע.', 'The map is not available right now. Please try again soon.')}</div>
        ) : located === 'pending' ? (
          <div className="map-msg"><Logo size={64} /><span>{L('מאתרים את המיקום שלך…', 'Finding your location…')}</span></div>
        ) : (
          <MapView
            initialCenter={searchCenter}
            user={snapped?.point ?? me}
            places={mapPlaces}
            selectedId={selectedId}
            route={route}
            focus={focus}
            onSelect={select}
            onUserMove={setMapCenter}
            onTurned={setTurned}
            picking={picking || pickingMe || fixingPin}
            onCenter={setViewCenter}
            centerGetter={centerGetter}
            follow={navigating && !followPaused}
            onUserDrag={() => { setStrayed(true); if (navigating) pauseFollow(); }}
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
        ) : located === 'fallback' && !selected ? (
          <div className="notice">{L('מוצגת רמת גן. אפשר להזיז את המפה.', 'Showing Ramat Gan. Move the map to look elsewhere.')}</div>
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
            onGps={askForGps}
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
                <span aria-hidden="true">📍</span> <span className="tool-label">{manualLabel ? L('המיקום שבחרתי', 'My chosen location') : L('המיקום שלי', 'My location')}</span>
              </button>
            )}
            {!navigating && (
              <button type="button" className={`map-tool wide back${turned || (strayed && me) ? '' : ' idle'}`} onClick={() => { setStrayed(false); setFocus({ key: Date.now(), points: [me ?? viewCenter ?? mapCenter], straight: true }); }}>
                <span aria-hidden="true">🧭</span> <span className="tool-label">{me ? L('חזרה אליי', 'Back to me') : L('יישור המפה', 'Straighten the map')}</span>
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
            <span className="tool-label">{L('הוספת מקום', 'Add a place')}</span>
          </button>
        )}
      </div>

      <header className="map-top">{brandBar}</header>
      <aside className="panel" aria-label={L('מקומות', 'Places')} id="main" data-read-root
        onTouchStart={(e) => { if ((e.target as HTMLElement).closest('.sheet-handle, .panel-head')) return; swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), scrolled: (bodyRef.current?.scrollTop ?? 0) > 0 }; }}
        onTouchEnd={(e) => {
          const s0 = swipe.current;
          swipe.current = null;
          if (!s0 || Date.now() - s0.t > 700) return;
          const dy = e.changedTouches[0].clientY - s0.y;
          if (Math.abs(e.changedTouches[0].clientX - s0.x) > Math.abs(dy)) return; // sideways, like a row of filters
          // Scrolling the list must not resize the sheet. Only the smallest size grows from here.
          if (dy < -40) setSheet((v) => (v === 'peek' ? 'half' : v));
          else if (dy > 40 && !s0.scrolled) setSheet((v) => (v === 'full' ? 'half' : 'peek'));
        }}>
        <button type="button" className="sheet-handle" {...sheetDrag} onClick={cycleSheet} aria-label={L('הגדלה או הקטנה של הרשימה', 'Make the list bigger or smaller')}>
          <span />
        </button>
        <div className="panel-head" {...sheetDrag}>
          {brandBar}
          <div className="search">
            <svg viewBox="0 0 24 24" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <label className="vh" htmlFor="q">{L('חיפוש מקום', 'Search for a place')}</label>
            <input
              id="q"
              type="search"
              placeholder={L('מה בא לך לאכול?', 'What do you feel like eating?')}
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTab('near');
                if (selectedId) deselect();
              }}
              onFocus={() => sheet === 'peek' && setSheet('half')}
              onBlur={() => setTimeout(() => window.scrollTo(0, 0), 60)}
              enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); applySmart(); } }}
            />
            {query && (
              <button type="button" className="search-clear" aria-label={L('ניקוי החיפוש', 'Clear the search')} onClick={() => { setQuery(''); if (selectedId) deselect(); }}>
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
          {user && !user.is_anonymous && <div className="tabs" role="tablist">
            <button type="button" role="tab" className="tab" aria-selected={tab === 'near'} onClick={() => { setTab('near'); if (sheet === 'peek') setSheet('half'); }}>
              {L('בסביבה', 'Nearby')}
            </button>
            <button type="button" role="tab" className="tab" aria-selected={tab === 'queue'} onClick={() => { setTab('queue'); deselect(); if (sheet === 'peek') setSheet('half'); }}>
              {L('לאישור הקהילה', 'For the community to confirm')} {queue.length > 0 && <span className="count">{queue.length}</span>}
            </button>
          </div>}
        </div>

        <button type="button" className="to-map" onClick={() => setSheet('peek')}>
          <span aria-hidden="true">🗺️</span> {L('למפה', 'To the map')}
        </button>
        <div className="panel-body" ref={bodyRef} onScroll={(e) => {
          const far = e.currentTarget.scrollTop > 320;
          if (far !== showTop) setShowTop(far);
        }}>
          {smart?.city && !selected && (
            <button type="button" className="city-jump" onClick={applySmart}>
              <span aria-hidden="true">✨</span> {L('הבנו! לחצו כדי לסנן לפי החיפוש', 'Got it! Tap to filter by your search')}
            </button>
          )}
          {cityHit && !smart?.city && !selected && (
            <button type="button" className="city-jump" onClick={() => {
              setFocus({ key: Date.now(), points: [cityHit.point], zoom: 13 });
              setMapCenter(cityHit.point);
              setSearchCenter(cityHit.point);
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
              signedIn={signedIn}
              onSignIn={() => setAuth({ reason: L('כדי להוסיף, לאשר או לתקן מידע צריך להתחבר. כך המידע באתר נשאר אמין.', 'To add, confirm or fix information, please sign in. It keeps the site reliable.') })}
              onFixLocation={isAdmin ? () => setFixOpen(true) : undefined}
              goPanel={
                <NavPanel
                  place={selected}
                  hasLocation={!!me || located === 'pending'}
                  mode={mode}
                  directions={directions}
                  loading={dirLoading || located === 'pending'}
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
              onBack={() => {
                deselect();
                // one result means they looked up that place, so the list opens again; several stay to compare
                if (visible.length <= 1) setQuery('');
              }}
              onVote={onVote}
              onAddCertificate={() => { if (!needAccount()) setCertFor(selected); }}
              onAddInfo={(need) => { if (!needAccount()) setInfoFor({ place: selected, need }); }}
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
                  onChanged={() => { setRefreshKey((k) => k + 1); refreshSelected(); }}
                />
                <PlaceCommunity
                  key={selected.id}
                  sb={sb}
                  place={selected}
                  isAdmin={isAdmin} signedIn={!!user && !user.is_anonymous}
                  onSignIn={(reason) => setAuth({ reason })}
                  onToast={showToast}
                  onChanged={() => { setRefreshKey((k) => k + 1); refreshSelected(); }}
                />
                </>
              }
            />
          ) : (
            <>
              <FilterBar filter={filter} openNow={openNow} onFilter={setFilter} onOpenNow={setOpenNow} cuisine={cuisine} onCuisine={setCuisine} onClear={clearFilters} />
              {(myFilter || activeNeeds > 0) && (
                <button type="button" className="link more-needs" onClick={toggleMyFilter}>
                  {myFilter ? L('⭐ הסינון הקבוע שלך פעיל. לביטול', '⭐ Your saved filter is on. Remove it') : L('⭐ לזכור את הסינון הזה במכשיר הזה', '⭐ Remember this filter on this device')}
                </button>
              )}
              <PlaceList
                fromLabel={manualLabel}
                nothingClose={(places[0]?.distance_m ?? 0) > 5000}
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
        {showTop && (
          <button type="button" className="to-top" aria-label={L('חזרה למעלה', 'Back to top')} title={L('חזרה למעלה', 'Back to top')} onClick={() => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span aria-hidden="true">↑</span>
          </button>
        )}
      </aside>

      {ask && <LocationAsk onNo={() => { saveAsked('no'); setAsk(false); }} onYes={() => { saveAsked('yes'); setAsk(false); locateMe(); }} />}
      {locHelp && <LocationHelp onClose={() => setLocHelp(false)} onPick={() => { setLocHelp(false); setLocOpen(true); }} onRetry={() => { setLocHelp(false); locateMe(); }} />}
      {auth && <AuthDialog sb={sb} reason={auth.reason} startWithCode={auth.startWithCode} onClose={() => setAuth(null)} />}

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
