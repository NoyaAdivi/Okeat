'use client';

import Link from 'next/link';
import { useL } from './LangProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllStats } from '@/lib/places';
import { motionAllowed } from '@/lib/prefs';
import { EXTRA_NEEDS, MAIN_NEEDS, NEED_CLASS } from '@/lib/claims';
import { NEED_EMOJI } from '@/lib/emoji';
import { needLabel, needLetter, type Need } from '@/lib/types';

type Counts = { places: number } & Partial<Record<Need, number>>;

const REFRESH_MS = 60_000;
/** An allergy gets its own tile once this many places have it. */
const ALLERGY_MIN = 40;

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

  const hints: Partial<Record<Need, string>> = {
    kosher: L('מי משגיח, ועד מתי התעודה', 'Who supervises, and until when'),
    vegan: L('טבעוני לגמרי, או יש מנות', 'Fully vegan, or some dishes'),
    vegetarian: L('הכול צמחוני, או יש מנות', 'All vegetarian, or some dishes'),
    gluten_free: L('תפריט, או מטבח נפרד', 'A menu, or a separate kitchen'),
  };
  const shown = [...MAIN_NEEDS, ...EXTRA_NEEDS.filter((n) => (counts?.[n] ?? 0) >= ALLERGY_MIN)];

  return (
    <div className="need-cards" aria-label={L('המספרים במפה', 'The map in numbers')}>
      <Link href="/map" className="need-card p">
        <span className="nc-top"><span className="nc-emoji" aria-hidden="true">📍</span></span>
        <CountUp value={counts?.places ?? null} />
        <span className="nc-title">{L('כל המקומות', 'All places')}</span>
      </Link>
      {shown.map((n, i) => (
        <Link key={n} href={`/map?need=${n}`} className={`need-card ${NEED_CLASS[n]}`} style={{ '--i': i + 1 } as React.CSSProperties}>
          <span className="nc-top">
            <span className="nc-emoji" aria-hidden="true">{NEED_EMOJI[n]}</span>
            <span className="seal small-seal" aria-hidden="true"><span>{needLetter(n, L.lang)}</span></span>
          </span>
          <CountUp value={counts?.[n] ?? (counts ? 0 : null)} />
          <span className="nc-title">{needLabel(n, L.lang)}</span>
          {hints[n] && <span className="nc-text">{hints[n]}</span>}
        </Link>
      ))}
    </div>
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
