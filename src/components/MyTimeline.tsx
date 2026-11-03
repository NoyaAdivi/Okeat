'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteMyPhoto, fetchMyFeed, placePhotoUrl, type FeedKind, type FeedRow } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { levelInfo, levelText, needLabel, type Level } from '@/lib/types';
import { useL } from './LangProvider';

type Filter = FeedKind | 'all';

const LOOK: Record<FeedKind, { emoji: string; cls: string }> = {
  place: { emoji: '📍', cls: 'k' },
  claim: { emoji: '📝', cls: 'v' },
  vote: { emoji: '👍', cls: 'h' },
  review: { emoji: '⭐', cls: 'g' },
  photo: { emoji: '📷', cls: 'e' },
  list: { emoji: '📋', cls: 'x' },
  saved: { emoji: '❤️', cls: 'k' },
};

/** Everything you added, newest first. Comes back up to date whenever you return to the page. */
export default function MyTimeline({ sb, onManage }: { sb: SupabaseClient; onManage: (section: 'added' | 'info') => void }) {
  const L = useL();
  const lang = L.lang;
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [sure, setSure] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyFeed(sb).then((r) => { setRows(r); setError(''); }).catch((e) => setError(friendly(e, lang)));
  }, [sb, lang]);

  useEffect(() => {
    load();
    const again = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('focus', again);
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again); };
  }, [load]);

  if (!rows) return error ? <p className="warnbox">{error}</p> : <p className="muted">{L('טוען…', 'Loading…')}</p>;

  const names: Record<Filter, string> = {
    all: L('הכול', 'All'),
    place: L('מקומות', 'Places'),
    claim: L('מידע', 'Info'),
    vote: L('אישורים', 'Confirmed'),
    review: L('ביקורות', 'Reviews'),
    photo: L('תמונות', 'Photos'),
    list: L('רשימות', 'Lists'),
    saved: L('שמורים', 'Saved'),
  };
  const present = (Object.keys(LOOK) as FeedKind[]).filter((k) => rows.some((r) => r.kind === k));
  const shown = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);

  const dayKey = (at: string) => new Date(at).toDateString();
  const dayName = (at: string) => {
    const days = Math.round((new Date(new Date().toDateString()).getTime() - new Date(dayKey(at)).getTime()) / 86400000);
    if (days === 0) return L('היום', 'Today');
    if (days === 1) return L('אתמול', 'Yesterday');
    return new Date(at).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const levelName = (r: FeedRow) => {
    if (!r.need) return '';
    const info = levelInfo(r.need, r.level as Level);
    return info ? levelText(info, lang) : needLabel(r.need, lang);
  };
  const what = (r: FeedRow) => ({
    place: L('הוספת מקום', 'You added a place'),
    claim: levelName(r),
    vote: r.vote === 1 ? L(`אישרת: ${levelName(r)}`, `You confirmed: ${levelName(r)}`) : L(`דיווחת שלא נכון: ${levelName(r)}`, `You said this is wrong: ${levelName(r)}`),
    review: r.comment || L('כתבת ביקורת', 'You wrote a review'),
    photo: L('הוספת תמונה', 'You added a photo'),
    list: L('יצרת רשימה', 'You made a list'),
    saved: L('שמרת מקום', 'You saved a place'),
  })[r.kind];
  const pill = (r: FeedRow) => {
    if (r.status === 'pending') return <span className="feed-pill wait">{L('מחכה לאישור', 'Waiting')}</span>;
    if (r.status === 'verified' || r.status === 'approved') return <span className="feed-pill ok">{L('אושר', 'Confirmed')}</span>;
    if (r.status === 'disputed') return <span className="feed-pill wait">{L('בבדיקה', 'Under review')}</span>;
    return null;
  };
  const href = (r: FeedRow) => (r.kind === 'list' ? `/list/${r.id}` : `/map?place=${r.place_id}`);

  const removePhoto = async (r: FeedRow) => {
    try {
      await deleteMyPhoto(sb, r.id, r.path!);
      setSure(null);
      setRows(rows.filter((x) => !(x.kind === 'photo' && x.id === r.id)));
    } catch (e) { setError(friendly(e, lang)); }
  };
  const photoActions = (r: FeedRow) => (
    sure === r.id
      ? <button type="button" className="btn small ghost danger" onClick={() => removePhoto(r)}>{L('למחוק?', 'Delete?')}</button>
      : <button type="button" className="link" onClick={() => setSure(r.id)}>{L('מחיקה', 'Delete')}</button>
  );

  if (rows.length === 0) {
    return (
      <div className="feed-empty">
        <span aria-hidden="true">🌱</span>
        <p>{L('עוד אין כאן כלום. כל מה שתוסיפו יופיע כאן.', 'Nothing here yet. Everything you add will show up here.')}</p>
        <Link className="btn primary" href="/map">{L('למפה', 'To the map')}</Link>
      </div>
    );
  }

  let lastDay = '';
  return (
    <section className="feed">
      <div className="feed-filters" role="group" aria-label={L('סינון הפעילות', 'Filter your activity')}>
        {(['all', ...present] as Filter[]).map((k) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k !== 'all' && <span aria-hidden="true">{LOOK[k].emoji}</span>} {names[k]}
            <b>{k === 'all' ? rows.length : rows.filter((r) => r.kind === k).length}</b>
          </button>
        ))}
      </div>
      {error && <p className="warnbox" role="alert">{error}</p>}

      {filter === 'photo' ? (
        <ul key="photos" className="feed-photos">
          {shown.map((r, i) => (
            <li key={r.id} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <Link href={href(r)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={placePhotoUrl(sb, r.path!)} alt={L(`תמונה מ${r.title}`, `A photo from ${r.title}`)} loading="lazy" />
                {pill(r)}
              </Link>
              <div><b>{r.title}</b>{photoActions(r)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <ol key={filter} className="feed-line">
          {shown.map((r, i) => {
            const day = dayKey(r.at);
            const head = day !== lastDay;
            lastDay = day;
            return (
              <li key={`${r.kind}-${r.id}`} className={LOOK[r.kind].cls} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
                {head && <h3>{dayName(r.at)}</h3>}
                <div className="feed-row">
                  <span className="feed-icon" aria-hidden="true">{LOOK[r.kind].emoji}</span>
                  <div className="feed-body">
                    <Link href={href(r)}><b>{r.title}</b></Link>
                    <small>{r.rating ? <span className="feed-stars" aria-label={L(`${r.rating} מתוך 5`, `${r.rating} of 5`)}>{'★'.repeat(r.rating)} </span> : null}{what(r)}</small>
                    <span className="feed-meta">
                      {pill(r)}
                      {r.kind === 'claim' && <button type="button" className="link" onClick={() => onManage('info')}>{L('עריכה', 'Edit')}</button>}
                      {r.kind === 'place' && <button type="button" className="link" onClick={() => onManage('added')}>{L('עריכה', 'Edit')}</button>}
                      {r.kind === 'review' && <Link className="link" href={href(r)}>{L('עריכה', 'Edit')}</Link>}
                      {r.kind === 'photo' && photoActions(r)}
                    </span>
                  </div>
                  {r.path && (
                    <Link href={href(r)} className="feed-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={placePhotoUrl(sb, r.path)} alt="" loading="lazy" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
