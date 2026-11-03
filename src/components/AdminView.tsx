'use client';

import Link from 'next/link';
import { decideSuggestion, fetchPendingSuggestions, type PlaceSuggestion } from '@/lib/places';
import { placeTypeLabel } from '@/lib/types';
import { cuisineLabel } from '@/lib/cuisine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import {
  decideOwnership, fetchModerationQueue, moderateClaim, moderatePlace, type ModerationQueue, fetchPendingPhotos, moderatePhoto, placePhotoUrl, type PendingPhoto,
  clearClientError, deleteReview, fetchAdminMessages, dismissReviewReports, fetchClientErrors, fetchReportedReviews, type ClientError, type ReportedReview,
} from '@/lib/places';
import { levelInfo, levelText, needLabel } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { useL } from './LangProvider';
import DuplicatesPanel from './DuplicatesPanel';
import UsersPanel from './UsersPanel';
import MessagesPanel from './MessagesPanel';
import DashboardPanel from './DashboardPanel';
import LimitsPanel from './LimitsPanel';
import LogPanel from './LogPanel';
import PlacesPanel from './PlacesPanel';

type TabId = 'home' | 'places' | 'limits' | 'log' | 'messages' | 'reports' | 'photos' | 'owners' | 'users' | 'dupes' | 'errors';

/** For community moderators and admins: reported places, disputed info, business owners. */
export default function AdminView() {
  const L = useL();
  const lang = L.lang;
  const sb = useMemo(() => createClient(), []);
  const { user, ready } = useUser(sb);
  const [q, setQ] = useState<ModerationQueue | null>(null);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [badReviews, setBadReviews] = useState<ReportedReview[]>([]);
  const [siteErrors, setSiteErrors] = useState<ClientError[]>([]);
  const [admin, setAdmin] = useState(false);
  const [openMessages, setOpenMessages] = useState(0);
  const [tab, setTab] = useState<TabId>('reports');

  const opened = useRef(false);
  const load = useCallback(() => {
    fetchModerationQueue(sb).then(setQ).catch((e) => setError(friendly(e, lang)));
    fetchPendingPhotos(sb).then(setPhotos);
    fetchPendingSuggestions(sb).then(setSuggestions);
    fetchReportedReviews(sb).then(setBadReviews);
    fetchClientErrors(sb).then(setSiteErrors);
    fetchAdminMessages(sb).then((m) => {
      setAdmin(true);
      setOpenMessages(m.filter((x) => !x.handled).length);
      setTab((t) => (t === 'reports' && !opened.current ? 'home' : t));
    }).catch(() => setAdmin(false));
  }, [sb, lang]);
  useEffect(() => { if (ready && user && !user.is_anonymous) load(); }, [ready, user, load]);

  const act = (fn: () => Promise<void>) => fn().then(() => { opened.current = true; load(); }).catch((e) => setError(friendly(e, lang)));

  const reports = (q?.reported.length ?? 0) + (q?.claims.length ?? 0) + badReviews.length + suggestions.length;
  const owners = q?.owners.length ?? 0;
  const waiting = reports + owners + photos.length + openMessages;
  const everyone: { id: TabId; cls: string; emoji: string; label: string; count: number }[] = [
    { id: 'reports', cls: 'k', emoji: '🚩', label: L('דיווחים', 'Reports'), count: reports },
    { id: 'photos', cls: 'v', emoji: '📷', label: L('תמונות', 'Photos'), count: photos.length },
    { id: 'owners', cls: 'g', emoji: '🏪', label: L('בעלי עסקים', 'Owners'), count: owners },
  ];
  const adminOnly: typeof everyone = [
    { id: 'home', cls: 'h', emoji: '📊', label: L('סקירה', 'Overview'), count: 0 },
    { id: 'messages', cls: 'e', emoji: '💌', label: L('הודעות', 'Messages'), count: openMessages },
    { id: 'places', cls: 'g', emoji: '🍽️', label: L('מקומות', 'Places'), count: 0 },
    { id: 'users', cls: 'v', emoji: '👥', label: L('משתמשים', 'Users'), count: 0 },
    { id: 'limits', cls: 'k', emoji: '⏳', label: L('מכסות', 'Limits'), count: 0 },
    { id: 'dupes', cls: 'g', emoji: '🔁', label: L('כפילויות', 'Duplicates'), count: 0 },
    { id: 'log', cls: 'h', emoji: '📜', label: L('יומן', 'Log'), count: 0 },
    { id: 'errors', cls: 'x', emoji: '🛠️', label: L('שגיאות', 'Errors'), count: siteErrors.length },
  ];
  const tabs = admin ? [adminOnly[0], adminOnly[1], ...everyone, ...adminOnly.slice(2)] : everyone;

  return (
    <div className="page">
      <SiteHeader />
      <main id="main" className="admin-page">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">{waiting > 0 ? '🌿' : '🌸'}</span>
          <div>
            <h1>{L('ניהול הקהילה', 'Community moderation')}</h1>
            <p>{q ? (waiting === 1 ? L('דבר אחד מחכה לך היום', 'One thing is waiting for you today') : waiting > 0 ? L(`${waiting} דברים מחכים לך היום`, `${waiting} things are waiting for you today`) : L('הכל מטופל. אפשר לנוח', "You're all caught up")) : L('רגע, בודקים מה חדש…', 'Checking what is new…')}</p>
          </div>
        </header>
        {ready && (!user || user.is_anonymous) && <p>{L('צריך להתחבר עם חשבון של מנהל.', 'Sign in with a moderator account.')}</p>}
        {error && <div className="err admin-error" role="alert">{error.includes('Moderators only') ? L('הדף הזה רק למאשרי קהילה ולמנהלים.', 'This page is only for moderators and admins.') : error}</div>}

        {q && (
          <div className="admin-layout">
            <div className="admin-tabs" role="tablist" aria-label={L('אזורי הניהול', 'Admin areas')}>
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="admin-panel" className={`admin-tab ${t.cls}`} onClick={() => setTab(t.id)}>
                  <span className="seal soft admin-tab-seal" aria-hidden="true"><span>{t.emoji}</span></span>
                  <span className="admin-tab-name">{t.label}</span>
                  {t.count > 0 && <span className="admin-count">{t.count}</span>}
                </button>
              ))}
            </div>
            <div id="admin-panel" key={tab} className="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
            {tab === 'home' && admin && <DashboardPanel sb={sb} />}
            {tab === 'messages' && admin && <MessagesPanel sb={sb} onChange={setOpenMessages} />}
            {tab === 'places' && admin && <PlacesPanel sb={sb} />}
            {tab === 'users' && admin && user && <UsersPanel sb={sb} meId={user.id} />}
            {tab === 'dupes' && admin && <DuplicatesPanel sb={sb} />}
            {tab === 'limits' && admin && <LimitsPanel sb={sb} />}
            {tab === 'log' && admin && <LogPanel sb={sb} />}
            {tab === 'photos' && (<>
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

            </>)}
            {tab === 'reports' && (<>
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

            <h2>{L('הצעות לסיווג', 'Suggested types')} ({suggestions.length})</h2>
            {suggestions.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {suggestions.map((s) => (
              <div key={s.id} className="admin-row">
                <div>
                  <Link href={`/map?place=${s.placeId}`}><b>{s.name}</b></Link>
                  <div className="muted small">
                    {placeTypeLabel(s.oldType, lang)} ← {placeTypeLabel(s.newType, lang)}
                    {s.newCuisine.length > 0 && `, ${s.newCuisine.map((c) => cuisineLabel(c, lang)).join(', ')}`}
                    {s.by && ` (${s.by})`}
                  </div>
                </div>
                <div className="acts">
                  <button type="button" className="btn small" onClick={() => act(() => decideSuggestion(sb, s.id, true))}>{L('אישור', 'Approve')}</button>
                  <button type="button" className="btn small ghost danger" onClick={() => act(() => decideSuggestion(sb, s.id, false))}>{L('דחייה', 'Reject')}</button>
                </div>
              </div>
            ))}

            <h2>{L('מקומות שדווחו', 'Reported places')} ({q.reported.length})</h2>
            {q.reported.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
            {q.reported.map((p) => (
              <div key={p.id} className="admin-row">
                <div>
                  <Link href={`/map?place=${p.id}`}><b>{p.name}</b></Link> <small>{p.address}</small>
                  <div className="muted small">{p.reports === 0 ? L('מי שהוסיף/ה את המקום ערך/ה אותו', 'Edited by the person who added it') : L(`${p.reports} דיווחים`, `${p.reports} reports`)}{p.reasons?.length ? ': ' + p.reasons.join(' · ') : ''}</div>
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

            </>)}
            {tab === 'owners' && (<>
            {q.owners.length === 0 && <p className="muted">{L('אין כרגע בקשות של בעלי עסקים.', 'No business owner requests right now.')}</p>}
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

            </>)}
            {tab === 'errors' && (<>
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
            </>)}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
