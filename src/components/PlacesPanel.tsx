'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminRestorePlace, adminSearchPlaces, deleteHiddenPlace, moderatePlace, type AdminPlace } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { placeEmoji } from '@/lib/emoji';
import { placeTypeLabel } from '@/lib/types';
import { useL } from './LangProvider';
import AdminPlaceDialog from './AdminPlaceDialog';

/** For the admin: find any place, fix it, hide it or bring it back. */
export default function PlacesPanel({ sb, hiddenTab = false }: { sb: SupabaseClient; hiddenTab?: boolean }) {
  const L = useL();
  const lang = L.lang;
  const [query, setQuery] = useState('');
  const [hiddenOnly, setHiddenOnly] = useState(hiddenTab);
  const [sure, setSure] = useState<string | null>(null);
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
      <h2>{hiddenTab ? `${L('מקומות מוסתרים', 'Hidden places')}${rows ? ` (${rows.length})` : ''}` : L('מקומות', 'Places')}</h2>
      {hiddenTab && <p className="muted small">{L('הם לא מופיעים באתר. אפשר לערוך, להחזיר למפה או למחוק לגמרי. מקומות כפולים שמוזגו לא נמצאים כאן, כי המידע שלהם עבר למקום שנשאר.', 'They do not appear on the site. You can edit them, put them back or delete them for good. Merged duplicates are not here, since their information moved to the place that stayed.')}</p>}
      <div className="mini-form">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('חיפוש מקום לפי שם', 'Find a place by name')} aria-label={L('חיפוש מקום', 'Find a place')} />
        {!hiddenTab && (
          <button type="button" className="btn small" aria-pressed={hiddenOnly} onClick={() => setHiddenOnly(!hiddenOnly)}>
            {hiddenOnly ? L('כל המקומות', 'All places') : L('רק מוסתרים', 'Hidden only')}
          </button>
        )}
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
            {p.removed && (sure === p.id
              ? <button type="button" className="btn small ghost danger" onClick={() => act(() => deleteHiddenPlace(sb, p.id))}>{L('למחוק לגמרי?', 'Delete for good?')}</button>
              : <button type="button" className="btn small ghost danger" onClick={() => setSure(p.id)}>{L('מחיקה', 'Delete')}</button>)}
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
