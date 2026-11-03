'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminRestorePlace, adminSearchPlaces, moderatePlace, type AdminPlace } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { placeEmoji } from '@/lib/emoji';
import { placeTypeLabel } from '@/lib/types';
import { useL } from './LangProvider';
import AdminPlaceDialog from './AdminPlaceDialog';

/** For the admin: find any place, fix it, hide it or bring it back. */
export default function PlacesPanel({ sb }: { sb: SupabaseClient }) {
  const L = useL();
  const lang = L.lang;
  const [query, setQuery] = useState('');
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [rows, setRows] = useState<AdminPlace[] | null>(null);
  const [editing, setEditing] = useState<AdminPlace | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    if (!hiddenOnly && query.trim().length < 2) { setRows(null); return; }
    adminSearchPlaces(sb, query, hiddenOnly).then(setRows).catch((e) => setError(friendly(e, lang)));
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [query, hiddenOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = (fn: () => Promise<void>) => fn().then(load).catch((e) => setError(friendly(e, lang)));

  return (
    <>
      <h2>{L('מקומות', 'Places')}</h2>
      <div className="mini-form">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('חיפוש מקום לפי שם', 'Find a place by name')} aria-label={L('חיפוש מקום', 'Find a place')} />
        <button type="button" className="btn small" aria-pressed={hiddenOnly} onClick={() => setHiddenOnly(!hiddenOnly)}>
          {hiddenOnly ? L('כל המקומות', 'All places') : L('רק מוסתרים', 'Hidden only')}
        </button>
      </div>
      {error && <p className="warnbox">{error}</p>}
      {!rows && <p className="muted">{L('כתבו לפחות 2 אותיות, או הציגו את המקומות המוסתרים.', 'Type at least 2 letters, or show the hidden places.')}</p>}
      {rows?.length === 0 && <p className="muted">{L('לא נמצאו מקומות.', 'No places found.')}</p>}
      {rows?.map((p) => (
        <div key={p.id} className="admin-row">
          <div>
            <a href={`/map?place=${p.id}`}><span aria-hidden="true">{placeEmoji(p.place_type)}</span> <b>{p.name}</b></a>
            <div className="muted small">{placeTypeLabel(p.place_type, lang)}{p.address ? `, ${p.address}` : ''}{p.removed ? ` (${L('מוסתר', 'hidden')})` : ''}</div>
          </div>
          <div className="admin-row-tools">
            <button type="button" className="btn small" onClick={() => setEditing(p)}>{L('עריכה', 'Edit')}</button>
            {p.removed
              ? <button type="button" className="btn small" onClick={() => act(() => adminRestorePlace(sb, p.id))}>{L('החזרה למפה', 'Back on the map')}</button>
              : <button type="button" className="btn small ghost" onClick={() => act(() => moderatePlace(sb, p.id, true))}>{L('הסתרה', 'Hide')}</button>}
          </div>
        </div>
      ))}
      {editing && <AdminPlaceDialog sb={sb} place={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}
