'use client';

import { useState } from 'react';
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
      {!data && <button type="button" className="btn small" disabled={busy} onClick={load}>{busy ? L('טוען…', 'Loading…') : L('הצגת הנתונים', 'Show the numbers')}</button>}
      {data && (
        <>
          <ul className="profile-stats dash-stats">
            {tiles.map(([label, value]) => <li key={label}><b>{value.toLocaleString()}</b><span>{label}</span></li>)}
          </ul>
          <h3>{L('מה מחפשים', 'What people search for')}</h3>
          {data.searches.length === 0 ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
            <p>{data.searches.map((s) => `${s.term} (${s.times})`).join(' · ')}</p>
          )}
          <h3>{L('ערים שמחפשים, מהכי מעט מקומות', 'Cities people look for, fewest places first')}</h3>
          {few.length === 0 ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
            <ul className="profile-places">
              {few.map((c) => <li key={c.name}><span className="dash-city"><b>{c.name}</b> <small>{L(`${c.places} מקומות · ${c.times} חיפושים`, `${c.places} places · ${c.times} searches`)}</small></span></li>)}
            </ul>
          )}
        </>
      )}
    </>
  );
}
