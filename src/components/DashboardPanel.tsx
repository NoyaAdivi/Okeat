'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchDashboard, type Dashboard } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';

/** For the admin: how the site is doing, what people look for, and where places are missing. */
export default function DashboardPanel({ sb }: { sb: SupabaseClient }) {
  const L = useL();
  const [data, setData] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    setError('');
    try { setData(await fetchDashboard(sb)); } catch (e) { setError(friendly(e, L.lang)); }
    setBusy(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = data ? [
    [L('נרשמו', 'Signed up'), data.users], [L('חדשים השבוע', 'New this week'), data.newUsers],
    [L('מקומות', 'Places'), data.places], [L('פרטים מאושרים', 'Confirmed details'), data.verified],
    [L('ביקורות', 'Reviews'), data.reviews], [L('רשימות', 'Lists'), data.lists],
  ] as const : [];
  const few = [...(data?.cities ?? [])].sort((a, b) => a.places - b.places);

  return (
    <>
      <h2>{L('לוח נתונים', 'Dashboard')}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!data && !error && <p className="muted">{busy ? L('טוען…', 'Loading…') : ''}</p>}
      {data && (
        <>
          <ul className="profile-stats dash-stats">
            {tiles.map(([label, value]) => <li key={label}><b>{value.toLocaleString()}</b><span>{label}</span></li>)}
          </ul>
          <h3>{L('מה מחפשים', 'What people search for')}</h3>
          {data.searches.length === 0 ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
            <ul className="dash-terms">
              {data.searches.map((s) => <li key={s.term}>{s.term} <b>{s.times}</b></li>)}
            </ul>
          )}
          <h3>{L('ערים שמחפשים, מהכי מעט מקומות', 'Cities people look for, fewest places first')}</h3>
          {few.length === 0 ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
            <ul className="profile-places">
              {few.map((c) => <li key={c.name} className="dash-city">
                <span><b>{c.name}</b> <small>{L(`${c.places} מקומות, ${c.times} חיפושים`, `${c.places} places, ${c.times} searches`)}</small></span>
                <i aria-hidden="true" style={{ inlineSize: `${Math.max(4, (c.places / Math.max(1, ...few.map((x) => x.places))) * 100)}%` }} />
              </li>)}
            </ul>
          )}
        </>
      )}
    </>
  );
}
