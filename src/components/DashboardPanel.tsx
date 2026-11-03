'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { fetchDashboard, fetchStatDetails, type Dashboard, type StatKind, type StatRow } from '@/lib/places';
import { levelInfo, levelText, needLabel, type Level } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';

/** For the admin: how the site is doing, what people look for, and where places are missing. */
export default function DashboardPanel({ sb }: { sb: SupabaseClient }) {
  const L = useL();
  const [data, setData] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<StatKind | null>(null);
  const [rows, setRows] = useState<StatRow[] | null>(null);
  const [rowsError, setRowsError] = useState('');

  const toggle = async (kind: StatKind) => {
    setRowsError('');
    setRows(null);
    if (open === kind) { setOpen(null); return; }
    setOpen(kind);
    try {
      const found = await fetchStatDetails(sb, kind);
      setRows(found);
    } catch (e) { setRowsError(friendly(e, L.lang)); }
  };

  const load = async () => {
    setBusy(true);
    setError('');
    try { setData(await fetchDashboard(sb)); } catch (e) { setError(friendly(e, L.lang)); }
    setBusy(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = data ? [
    ['users', L('נרשמו', 'Signed up'), data.users], ['newUsers', L('חדשים השבוע', 'New this week'), data.newUsers],
    [null, L('מקומות', 'Places'), data.places], ['verified', L('פרטים מאושרים', 'Confirmed details'), data.verified],
    ['reviews', L('ביקורות', 'Reviews'), data.reviews], ['lists', L('רשימות', 'Lists'), data.lists],
  ] as const : [];
  const openTile = tiles.find(([kind]) => kind === open);
  const when = (at: string | null) => (at ? new Date(at).toLocaleDateString(L.lang === 'he' ? 'he-IL' : 'en-GB') : '');
  const rowLine = (r: StatRow) => {
    const parts: string[] = [];
    if (r.need) {
      const info = levelInfo(r.need, r.level as Level);
      parts.push(info ? levelText(info, L.lang) : needLabel(r.need, L.lang));
    }
    if (r.rating) parts.push('★'.repeat(r.rating));
    if (open === 'verified' && r.count) parts.push(L(`${r.count} אישורים`, `${r.count} confirmations`));
    if (open === 'lists') parts.push(L(`${r.count ?? 0} מקומות`, `${r.count ?? 0} places`));
    if (r.by) parts.push(r.by);
    if (r.sub) parts.push(r.sub);
    return parts.join(', ');
  };
  const few = [...(data?.cities ?? [])].sort((a, b) => a.places - b.places);

  return (
    <>
      <h2>{L('לוח נתונים', 'Dashboard')}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!data && !error && <p className="muted">{busy ? L('טוען…', 'Loading…') : ''}</p>}
      {data && (
        <>
          <ul className="profile-stats dash-stats">
            {tiles.map(([kind, label, value]) => (
              <li key={label}>
                {kind ? (
                  <button type="button" aria-expanded={open === kind} aria-controls="dash-details" onClick={() => toggle(kind)}>
                    <b>{value.toLocaleString()}</b><span>{label}</span>
                  </button>
                ) : <><b>{value.toLocaleString()}</b><span>{label}</span></>}
              </li>
            ))}
          </ul>
          <div id="dash-details" aria-live="polite">
            {open && (
              <section className="dash-details">
                <h3>{openTile?.[1]}</h3>
                {rowsError && <p className="warnbox">{rowsError}</p>}
                {!rows && !rowsError && <p className="muted">{L('טוען…', 'Loading…')}</p>}
                {rows?.length === 0 && <p className="muted">{L('עוד אין כאן כלום.', 'Nothing here yet.')}</p>}
                {rows && rows.length > 0 && (
                  <ul>
                    {rows.map((r) => {
                      const body = <><b>{r.title}</b><small>{rowLine(r)}</small></>;
                      return (
                        <li key={r.id}>
                          {r.placeId ? <Link href={`/map?place=${r.placeId}`}>{body}</Link> : <div>{body}</div>}
                          <time>{when(r.at)}</time>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rows?.length === 200 && <p className="muted">{L('מוצגים 200 האחרונים.', 'Showing the latest 200.')}</p>}
              </section>
            )}
          </div>
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
