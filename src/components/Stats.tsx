'use client';

import { useL } from './LangProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchStats } from '@/lib/places';
import { motionAllowed } from '@/lib/prefs';

type Counts = { places: number; kosher: number; vegan: number; gluten_free: number };

/** Live numbers from the database, counting up once when they arrive. */
export default function Stats() {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    fetchStats(sb).then(setCounts).catch(() => setCounts(null));
  }, [sb]);

  const items: { key: keyof Counts; label: string; emoji: string; cls: string }[] = [
    { key: 'places', label: L('מקומות במפה', 'Places on the map'), emoji: '📍', cls: 'p' },
    { key: 'kosher', label: L('כשרים', 'Kosher'), emoji: '🍽️', cls: 'k' },
    { key: 'vegan', label: L('טבעוניים', 'Vegan'), emoji: '🌱', cls: 'v' },
    { key: 'gluten_free', label: L('ללא גלוטן', 'Gluten-free'), emoji: '🌾', cls: 'g' },
  ];

  return (
    <ul className="stats" aria-label={L('המספרים במפה', 'The map in numbers')}>
      {items.map((it) => (
        <li key={it.key} className={`stat ${it.cls}`}>
          <span className="stat-emoji" aria-hidden="true">{it.emoji}</span>
          <CountUp value={counts?.[it.key] ?? null} />
          <span className="stat-label">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function CountUp({ value }: { value: number | null }) {
  const [shown, setShown] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (value === null) return;
    if (!motionAllowed()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1200);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // background tabs pause animations: make sure the real number shows anyway
    const done = setTimeout(() => setShown(value), 1400);
    return () => { cancelAnimationFrame(raf.current); clearTimeout(done); };
  }, [value]);
  return <b className="stat-num">{value === null ? '…' : shown.toLocaleString('en-US')}</b>;
}
