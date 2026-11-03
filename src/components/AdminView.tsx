'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import {
  decideOwnership, fetchModerationQueue, moderateClaim, moderatePlace, type ModerationQueue, fetchPendingPhotos, moderatePhoto, placePhotoUrl, type PendingPhoto,
  clearClientError, deleteReview, dismissReviewReports, fetchClientErrors, fetchReportedReviews, type ClientError, type ReportedReview,
} from '@/lib/places';
import { levelInfo, levelText, needLabel } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { useL } from './LangProvider';
import DuplicatesPanel from './DuplicatesPanel';
import UsersPanel from './UsersPanel';
import MessagesPanel from './MessagesPanel';
import DashboardPanel from './DashboardPanel';

/** For community moderators and admins: reported places, disputed info, business owners. */
export default function AdminView() {
  const L = useL();
  const lang = L.lang;
  const sb = useMemo(() => createClient(), []);
  const { user, ready } = useUser(sb);
  const [q, setQ] = useState<ModerationQueue | null>(null);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [badReviews, setBadReviews] = useState<ReportedReview[]>([]);
  const [siteErrors, setSiteErrors] = useState<ClientError[]>([]);

  const load = useCallback(() => {
    fetchModerationQueue(sb).then(setQ).catch((e) => setError(friendly(e, lang)));
    fetchPendingPhotos(sb).then(setPhotos);
    fetchReportedReviews(sb).then(setBadReviews);
    fetchClientErrors(sb).then(setSiteErrors);
  }, [sb, lang]);
  useEffect(() => { if (ready && user && !user.is_anonymous) load(); }, [ready, user, load]);

  const act = (fn: () => Promise<void>) => fn().then(load).catch((e) => setError(friendly(e, lang)));

  return (
    <div className="page">
      <SiteHeader />
      <main id="main" className="admin-page prose">
        <h1>{L('ניהול הקהילה', 'Community moderation')}</h1>
        {ready && (!user || user.is_anonymous) && <p>{L('צריך להתחבר עם חשבון של מנהל.', 'Sign in with a moderator account.')}</p>}
        {error && <div className="err admin-error" role="alert">{error.includes('Moderators only') ? L('הדף הזה רק למאשרי קהילה ולמנהלים.', 'This page is only for moderators and admins.') : error}</div>}

        {q && (
          <>
            <h2>{L('תמונות לאישור', 'Photos to approve')} ({photos.length})</h2>
            {photos.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {photos.map((p) => (
              <div key={p.id} className="admin-row">
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="admin-photo" src={placePhotoUrl(sb, p.path)} alt="" />
                  <Link href={`/map?place=${p.place_id}`}><b>{p.place_name}</b></Link>
                </div>
                <div className="acts">
                  <button type="button" className="btn small" onClick={() => act(() => moderatePhoto(sb, p, true))}>{L('אישור', 'Approve')}</button>
                  <button type="button" className="btn small ghost danger" onClick={() => act(() => moderatePhoto(sb, p, false))}>{L('הסרה', 'Remove')}</button>
                </div>
              </div>
            ))}

            <h2>{L('ביקורות שדווחו', 'Reported reviews')} ({badReviews.length})</h2>
            {badReviews.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {badReviews.map((r) => (
              <div key={`${r.place_id}-${r.user_id}`} className="admin-row">
                <div>
                  <Link href={`/map?place=${r.place_id}`}><b>{r.place_name}</b></Link>
                  <p>{'★'.repeat(r.rating)} {r.author}: {r.comment ?? L('(בלי תגובה)', '(no comment)')}</p>
                  <small className="muted">{L(`${r.reports} דיווחים`, `${r.reports} reports`)}</small>
                </div>
                <div className="acts">
                  <button type="button" className="btn small ghost danger" onClick={() => act(() => deleteReview(sb, r.place_id, r.user_id))}>{L('מחיקת הביקורת', 'Delete review')}</button>
                  <button type="button" className="btn small" onClick={() => act(() => dismissReviewReports(sb, r))}>{L('הביקורת בסדר', 'Review is fine')}</button>
                </div>
              </div>
            ))}

            <h2>{L('מקומות שדווחו', 'Reported places')} ({q.reported.length})</h2>
            {q.reported.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {q.reported.map((p) => (
              <div key={p.id} className="admin-row">
                <div>
                  <Link href={`/map?place=${p.id}`}><b>{p.name}</b></Link> <small>{p.address}</small>
                  <div className="muted small">{L(`${p.reports} דיווחים`, `${p.reports} reports`)}{p.reasons?.length ? ': ' + p.reasons.join(' · ') : ''}</div>
                </div>
                <div className="acts">
                  <Link className="btn small" href={`/map?place=${p.id}`}>{L('תיקון כתובת', 'Fix address')}</Link>
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

            <DashboardPanel sb={sb} />

            <MessagesPanel sb={sb} />

            {user && <UsersPanel sb={sb} meId={user.id} />}

            <DuplicatesPanel sb={sb} />

            <h2>{L('שגיאות באתר', 'Site errors')} ({siteErrors.length})</h2>
            {siteErrors.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {siteErrors.map((e) => (
              <div key={e.message} className="admin-row">
                <div>
                  <code dir="ltr">{e.message}</code>
                  <div className="muted small">{e.path} · {e.times}×</div>
                </div>
                <div className="acts">
                  <button type="button" className="btn small" onClick={() => act(() => clearClientError(sb, e.message))}>{L('טופל', 'Handled')}</button>
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
