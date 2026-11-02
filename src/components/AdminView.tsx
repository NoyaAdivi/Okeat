'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import {
  decideOwnership, fetchModerationQueue, moderateClaim, moderatePlace, type ModerationQueue,
} from '@/lib/places';
import { levelInfo, levelText, needLabel } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { useL } from './LangProvider';

/** For community moderators and admins: reported places, disputed info, business owners. */
export default function AdminView() {
  const L = useL();
  const lang = L.lang;
  const sb = useMemo(() => createClient(), []);
  const { user, ready } = useUser(sb);
  const [q, setQ] = useState<ModerationQueue | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchModerationQueue(sb).then(setQ).catch((e) => setError(friendly(e, lang)));
  }, [sb, lang]);
  useEffect(() => { if (ready && user && !user.is_anonymous) load(); }, [ready, user, load]);

  const act = (fn: () => Promise<void>) => fn().then(load).catch((e) => setError(friendly(e, lang)));

  return (
    <div className="page">
      <SiteHeader />
      <main id="main" className="admin-page prose">
        <h1>{L('ניהול הקהילה', 'Community moderation')}</h1>
        {ready && (!user || user.is_anonymous) && <p>{L('צריך להתחבר עם חשבון של מנהל.', 'Sign in with a moderator account.')}</p>}
        {error && <div className="err" role="alert">{error.includes('Moderators only') ? L('הדף הזה רק למאשרי קהילה ולמנהלים.', 'This page is only for moderators and admins.') : error}</div>}

        {q && (
          <>
            <h2>{L('מקומות שדווחו', 'Reported places')} ({q.reported.length})</h2>
            {q.reported.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {q.reported.map((p) => (
              <div key={p.id} className="admin-row">
                <div>
                  <Link href={`/map?place=${p.id}`}><b>{p.name}</b></Link> <small>{p.address}</small>
                  <div className="muted small">{L(`${p.reports} דיווחים`, `${p.reports} reports`)}{p.reasons?.length ? ': ' + p.reasons.join(' · ') : ''}</div>
                </div>
                <div className="acts">
                  <button type="button" className="btn small" onClick={() => act(() => moderatePlace(sb, p.id, false))}>{L('המקום בסדר', 'Keep it')}</button>
                  <button type="button" className="btn small ghost danger" onClick={() => act(() => moderatePlace(sb, p.id, true))}>{L('הסרה', 'Remove')}</button>
                </div>
              </div>
            ))}

            <h2>{L('מידע שנוי במחלוקת וסיווגים אוטומטיים שדווחו', 'Disputed info and reported automatic guesses')} ({q.claims.length})</h2>
            {q.claims.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {q.claims.map((c) => {
              const info = levelInfo(c.need, c.level);
              return (
                <div key={c.id} className="admin-row">
                  <div>
                    <Link href={`/map?place=${c.placeId}`}><b>{c.placeName}</b></Link>
                    <div className="small">{needLabel(c.need, lang)}: {info ? levelText(info, lang) : c.level}
                      <span className="muted"> · {c.source === 'auto' ? L('סיווג אוטומטי', 'automatic guess') : c.source === 'osm' ? 'OpenStreetMap' : L('קהילה', 'community')} · ✓{c.confirm} ✗{c.reject}</span>
                    </div>
                  </div>
                  <div className="acts">
                    <button type="button" className="btn small" onClick={() => act(() => moderateClaim(sb, c.id, true))}>{L('נכון', 'Correct')}</button>
                    <button type="button" className="btn small ghost danger" onClick={() => act(() => moderateClaim(sb, c.id, false))}>{L('לא נכון, להסיר', 'Wrong, remove')}</button>
                  </div>
                </div>
              );
            })}

            {q.owners.length > 0 && <h2>{L('בקשות של בעלי עסקים', 'Business owner requests')} ({q.owners.length})</h2>}
            {q.owners.map((o) => (
              <div key={o.id} className="admin-row">
                <div>
                  <Link href={`/map?place=${o.placeId}`}><b>{o.placeName}</b></Link> · {o.user}
                  <div className="small">{L('קוד', 'Code')}: <code dir="ltr">{o.code}</code> · <a href={o.proofUrl} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{o.proofUrl}</a></div>
                  {o.note && <div className="muted small">{o.note}</div>}
                  <div className="muted small">{L('בדקו שהקוד באמת מופיע בקישור, ושזה העמוד הרשמי של העסק.', 'Check that the code really appears at the link, and that it is the business’s official page.')}</div>
                </div>
                <div className="acts">
                  <button type="button" className="btn small" onClick={() => act(() => decideOwnership(sb, o.id, true))}>{L('אישור', 'Approve')}</button>
                  <button type="button" className="btn small ghost danger" onClick={() => act(() => decideOwnership(sb, o.id, false))}>{L('דחייה', 'Reject')}</button>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
