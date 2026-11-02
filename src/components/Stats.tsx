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
  const [all, setAll] = useState(false);

  useEffect(() => {
    const load = () => { fetchAllStats(sb).then(setCounts).catch(() => undefined); };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [sb]);

  // allergies are counted only on a database that has them
  const allergies = EXTRA_NEEDS.filter((n) => counts?.[n] !== undefined);

  return (
    <>
      <ul className="stats" aria-label={L('המספרים במפה', 'The map in numbers')}>
        <li className="stat p">
          <span className="stat-emoji" aria-hidden="true">📍</span>
          <CountUp value={counts?.places ?? null} />
          <span className="stat-label">{L('מקומות במפה', 'Places on the map')}</span>
        </li>
        {[...MAIN_NEEDS, ...(all ? allergies : [])].map((n) => (
          <li key={n} className={`stat ${NEED_CLASS[n]}`}>
            <span className="stat-emoji" aria-hidden="true">{NEED_EMOJI[n]}</span>
            <CountUp value={counts?.[n] ?? (counts ? 0 : null)} />
            <span className="stat-label">{needLabel(n, L.lang)}</span>
          </li>
        ))}
      </ul>
      {allergies.length > 0 && (
        <button type="button" className="stats-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? L('הצגת פחות', 'Show less') : L('הצגת הכול', 'Show all')}
        </button>
      )}
    </>
  );
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
