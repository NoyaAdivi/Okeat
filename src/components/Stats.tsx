'use client';

import { useL } from './LangProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllStats } from '@/lib/places';
import { motionAllowed } from '@/lib/prefs';
import { EXTRA_NEEDS, MAIN_NEEDS, NEED_CLASS } from '@/lib/claims';
import { NEED_EMOJI } from '@/lib/emoji';
import { needLabel, type Need } from '@/lib/types';

type Counts = { places: number } & Partial<Record<Need, number>>;

const REFRESH_MS = 60_000;

/** Live numbers from the database. They refresh by themselves, so a new place shows up in them. */
export default function Stats() {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const load = () => { fetchAllStats(sb).then(setCounts).catch(() => undefined); };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [sb]);

  // all the allergies in one tile; it appears once there is enough to show
  const allergies = EXTRA_NEEDS.reduce((sum, n) => sum + (counts?.[n] ?? 0), 0);

  return (
    <ul className="stats" aria-label={L('המספרים במפה', 'The map in numbers')}>
      <li className="stat p">
        <span className="stat-emoji" aria-hidden="true">📍</span>
        <CountUp value={counts?.places ?? null} />
        <span className="stat-label">{L('מקומות במפה', 'Places on the map')}</span>
      </li>
      {MAIN_NEEDS.map((n) => (
        <li key={n} className={`stat ${NEED_CLASS[n]}`}>
          <span className="stat-emoji" aria-hidden="true">{NEED_EMOJI[n]}</span>
          <CountUp value={counts?.[n] ?? (counts ? 0 : null)} />
          <span className="stat-label">{needLabel(n, L.lang)}</span>
        </li>
      ))}
      {allergies >= 50 && (
        <li className="stat e">
          <span className="stat-emoji" aria-hidden="true">🥜</span>
          <CountUp value={allergies} />
          <span className="stat-label">{L('מידע על אלרגיות', 'Allergy details')}</span>
        </li>
      )}
    </ul>
  );
}

/** Just the total, for the home page. */
export function PlacesCount() {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const [places, setPlaces] = useState<number | null>(null);
  useEffect(() => { fetchAllStats(sb).then((c) => setPlaces(c.places)).catch(() => undefined); }, [sb]);
  return <p className="places-count">{places ? L(`${places.toLocaleString('he-IL')} מקומות במפה`, `${places.toLocaleString('en-US')} places on the map`) : '\u00a0'}</p>;
}

function CountUp({ value }: { value: number | null }) {
  const [shown, setShown] = useState(0);
  const raf = useRef(0);
  const last = useRef(0); // a refresh continues from the old number instead of counting from zero
  useEffect(() => {
    if (value === null) return;
    const from = last.current;
    last.current = value;
    if (!motionAllowed()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1200);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // background tabs pause animations: make sure the real number shows anyway
    const done = setTimeout(() => setShown(value), 1400);
    return () => { cancelAnimationFrame(raf.current); clearTimeout(done); };
  }, [value]);
  return <b className="stat-num">{value === null ? '…' : shown.toLocaleString('en-US')}</b>;
}
