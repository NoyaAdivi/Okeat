'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAdminOverview, fetchDashboard, fetchVisits, type AdminKind, type AdminOverview, type Dashboard, type Visits } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';
import AdminFeed, { KIND_LOOK } from './AdminFeed';

const duration = (s: number, L: ReturnType<typeof useL>) => {
  if (s < 60) return L(`${s} שנ׳`, `${s} sec`);
  const m = Math.round(s / 60);
  return m < 60 ? L(`${m} דק׳`, `${m} min`) : L(`${(m / 60).toFixed(1)} שע׳`, `${(m / 60).toFixed(1)} hr`);
};

/** For the admin: what needs attention, who visits, what people add, and what they look for. */
export default function DashboardPanel({ sb, onOpen }: { sb: SupabaseClient; onOpen: (tab: 'reports' | 'photos') => void }) {
  const L = useL();
  const [data, setData] = useState<Dashboard | null>(null);
  const [over, setOver] = useState<AdminOverview | null>(null);
  const [visits, setVisits] = useState<Visits | null>(null);
  const [range, setRange] = useState(7);
  const [kind, setKind] = useState<AdminKind | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard(sb).then(setData).catch((e) => setError(friendly(e, L.lang)));
    fetchAdminOverview(sb).then(setOver).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVisits(sb, range).then(setVisits); }, [sb, range]);

  const names: Record<AdminKind, string> = {
    user: L('נרשמו', 'Signed up'),
    place: L('מקומות חדשים', 'New places'),
    claim: L('מידע', 'Information'),
    vote: L('אישורים', 'Confirmations'),
    review: L('ביקורות', 'Reviews'),
    photo: L('תמונות', 'Photos'),
    report: L('דיווחים', 'Reports'),
    suggestion: L('הצעות סיווג', 'Type suggestions'),
    list: L('רשימות', 'Lists'),
    message: L('הודעות', 'Messages'),
  };
  const a = over?.attention;
  const todo = a ? [
    { n: a.reports, emoji: '🚩', text: L('מקומות שדווחו', 'Reported places'), go: () => onOpen('reports') },
    { n: a.disputed, emoji: '⚖️', text: L('מידע במחלוקת', 'Disputed details'), go: () => onOpen('reports') },
    { n: a.suggestions, emoji: '🏷️', text: L('הצעות סיווג', 'Type suggestions'), go: () => onOpen('reports') },
    { n: a.photos, emoji: '📷', text: L('תמונות לאישור', 'Photos to approve'), go: () => onOpen('photos') },
    { n: a.waiting, emoji: '⏳', text: L('מידע שמחכה לקהילה', 'Waiting for the community'), go: () => setKind('claim') },
    { n: a.expiring, emoji: '📜', text: L('תעודות שמסתיימות בחודש הקרוב', 'Certificates ending this month'), go: () => setKind('claim') },
  ].filter((t) => t.n > 0) : [];
  const peak = Math.max(1, ...(visits?.days ?? []).map((d) => d.visits));
  const few = [...(data?.cities ?? [])].sort((x, y) => x.places - y.places);

  return (
    <>
      <h2>{L('לוח נתונים', 'Dashboard')}</h2>
      {error && <p className="warnbox">{error}</p>}

      {todo.length > 0 && (
        <section className="dash-block">
          <h3>{L('מה מחכה לך', 'Waiting for you')}</h3>
          <div className="dash-todo">
            {todo.map((t) => (
              <button key={t.text} type="button" onClick={t.go}>
                <span aria-hidden="true">{t.emoji}</span> <b>{t.n.toLocaleString()}</b> {t.text}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="dash-block">
        <div className="dash-head">
          <h3>{L('כניסות לאתר', 'Visits')}</h3>
          <div className="dash-range" role="group" aria-label={L('טווח זמן', 'Time range')}>
            {[[1, L('היום', 'Today')], [7, L('שבוע', 'Week')], [30, L('חודש', 'Month')]].map(([d, label]) => (
              <button key={d} type="button" aria-pressed={range === d} onClick={() => setRange(d as number)}>{label}</button>
            ))}
          </div>
        </div>
        {!visits ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
          <>
            <ul className="dash-numbers">
              <li><b>{visits.visits.toLocaleString()}</b><span>{L('כניסות', 'Visits')}</span></li>
              <li><b>{duration(visits.avgSeconds, L)}</b><span>{L('זמן ממוצע', 'Average time')}</span></li>
              <li><b>{duration(visits.totalSeconds, L)}</b><span>{L('זמן כולל באתר', 'Total time')}</span></li>
              <li><b>{visits.avgPages}</b><span>{L('דפים לכניסה', 'Pages per visit')}</span></li>
              <li><b>{visits.signedIn.toLocaleString()}</b><span>{L('כניסות של מחוברים', 'Signed-in visits')}</span></li>
              <li><b>{visits.signups.toLocaleString()}</b><span>{L('נרשמו בטווח', 'Signed up')}</span></li>
            </ul>
            {visits.days.length > 1 && (
              <div className="dash-bars" role="img" aria-label={L('כניסות לפי יום', 'Visits by day')}>
                {visits.days.map((d) => (
                  <span key={d.day} title={`${d.day}: ${d.visits}`} style={{ blockSize: `${Math.max(4, (d.visits / peak) * 100)}%` }} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="dash-block">
        <h3>{L('מה קורה באתר', 'What people are doing')}</h3>
        <div className="dash-kinds">
          <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)}>
            <span className="feed-icon" aria-hidden="true">✨</span><b>{L('הכול', 'All')}</b>
          </button>
          {(Object.keys(names) as AdminKind[]).filter((k) => k !== 'message').map((k) => {
            const c = over?.kinds[k];
            return (
              <button key={k} type="button" className={KIND_LOOK[k].cls} aria-pressed={kind === k} onClick={() => setKind(k)}>
                <span className="feed-icon" aria-hidden="true">{KIND_LOOK[k].emoji}</span>
                <b>{(c?.all ?? 0).toLocaleString()}</b>
                <span>{names[k]}</span>
                {!!c?.today && <em>{L(`+${c.today} היום`, `+${c.today} today`)}</em>}
              </button>
            );
          })}
        </div>
        <AdminFeed sb={sb} kind={kind} />
      </section>

      {over && over.topUsers.length > 0 && (
        <section className="dash-block">
          <h3>{L('הכי פעילים החודש', 'Most active this month')}</h3>
          <ul className="dash-terms">
            {over.topUsers.map((u) => <li key={u.id}><Link href={`/u/${u.id}`}>{u.name ?? L('משתמש/ת', 'A user')} <b>{u.actions}</b></Link></li>)}
          </ul>
        </section>
      )}
      {over && over.topPlaces.length > 0 && (
        <section className="dash-block">
          <h3>{L('המקומות עם הכי הרבה ביקורות', 'Places with the most reviews')}</h3>
          <ul className="dash-terms">
            {over.topPlaces.map((p) => <li key={p.id}><Link href={`/map?place=${p.id}`}>{p.name} <b>★ {p.rating}</b></Link></li>)}
          </ul>
        </section>
      )}

      {data && (
        <>
          <section className="dash-block">
            <h3>{L('מה מחפשים', 'What people search for')}</h3>
            {data.searches.length === 0 ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
              <ul className="dash-terms">
                {data.searches.map((s) => <li key={s.term}><Link href={`/map?q=${encodeURIComponent(s.term)}`}>{s.term} <b>{s.times}</b></Link></li>)}
              </ul>
            )}
          </section>
          <section className="dash-block">
            <h3>{L('ערים שמחפשים, מהכי מעט מקומות', 'Cities people look for, fewest places first')}</h3>
            {few.length === 0 ? <p className="muted">{L('עוד אין נתונים.', 'No data yet.')}</p> : (
              <ul className="profile-places">
                {few.map((c) => (
                  <li key={c.name}>
                    <Link href={`/map?q=${encodeURIComponent(c.name)}`} className="dash-city">
                      <span><b>{c.name}</b> <small>{L(`${c.places} מקומות, ${c.times} חיפושים`, `${c.places} places, ${c.times} searches`)}</small></span>
                      <i aria-hidden="true" style={{ inlineSize: `${Math.max(4, (c.places / Math.max(1, ...few.map((x) => x.places))) * 100)}%` }} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
