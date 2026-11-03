'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchActivity, type ActivityRow } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';

/** For the admin: who removed, approved or changed what. */
export default function LogPanel({ sb }: { sb: SupabaseClient }) {
  const L = useL();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetchActivity(sb).then(setRows).catch((e) => setError(friendly(e, L.lang))); }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (action: string) => ({
    claim_verified: L('אישר/ה מידע', 'confirmed information'), claim_rejected: L('הסיר/ה מידע', 'removed information'),
    claim_superseded: L('החליף/ה מידע', 'replaced information'), place_removed: L('הסיר/ה מקום', 'removed a place'),
    place_restored: L('החזיר/ה מקום', 'restored a place'), review_deleted: L('מחק/ה ביקורת', 'deleted a review'),
    user_deleted: L('מחק/ה משתמש', 'deleted a user'), role_user: L('שינה/תה תפקיד לרגיל', 'set a role to regular'),
    role_trusted: L('מינה/תה מאשר/ת קהילה', 'made a moderator'), role_admin: L('מינה/תה מנהל/ת', 'made an admin'),
  } as Record<string, string>)[action] ?? action;

  return (
    <>
      <h2>{L('יומן פעולות', 'Activity log')}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!rows && !error && <p className="muted">{L('טוען…', 'Loading…')}</p>}
      {rows?.length === 0 && <p className="muted">{L('עוד אין פעולות. מכאן והלאה הן יירשמו כאן.', 'Nothing yet. From now on, actions appear here.')}</p>}
      {rows?.map((r) => (
        <div key={r.id} className="admin-row">
          <div><b>{r.actor}</b> {label(r.action)}{r.detail && `: ${r.detail}`}</div>
          <small className="muted">{formatDate(r.at.slice(0, 10))}</small>
        </div>
      ))}
    </>
  );
}
