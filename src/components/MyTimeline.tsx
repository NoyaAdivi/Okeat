'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteMyPhoto, deleteReview, fetchMyFeed, placePhotoUrl, replaceMyPhoto, setFavorite, withdrawClaim, withdrawPlace, withdrawSuggestion, withdrawVote, type FeedKind, type FeedRow } from '@/lib/places';
import EditMyPlace from './EditMyPlace';
import ReviewEditor from './ReviewEditor';
import SuggestType from './SuggestType';
import { friendly } from '@/lib/errors';
import { levelInfo, levelText, needLabel, placeTypeLabel, type Level } from '@/lib/types';
import { useL } from './LangProvider';
import ScrollRow from './ScrollRow';

type Filter = FeedKind | 'all';

const LOOK: Record<FeedKind, { emoji: string; cls: string }> = {
  place: { emoji: '📍', cls: 'k' },
  claim: { emoji: '📝', cls: 'v' },
  vote: { emoji: '👍', cls: 'h' },
  review: { emoji: '⭐', cls: 'g' },
  photo: { emoji: '📷', cls: 'e' },
  list: { emoji: '📋', cls: 'x' },
  saved: { emoji: '❤️', cls: 'k' },
  suggestion: { emoji: '🏷️', cls: 'g' },
};

/** Everything you added, newest first. Comes back up to date whenever you return to the page. */
export default function MyTimeline({ sb, userId, onManage }: { sb: SupabaseClient; userId: string; onManage: (section: 'added' | 'info' | 'votes' | 'lists' | 'saved') => void }) {
  const L = useL();
  const lang = L.lang;
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [sure, setSure] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const [editPlace, setEditPlace] = useState<string | null>(null);
  const [editReview, setEditReview] = useState<FeedRow | null>(null);
  const [editSuggestion, setEditSuggestion] = useState<FeedRow | null>(null);
  const [replacing, setReplacing] = useState<FeedRow | null>(null);
  const photoFile = useRef<HTMLInputElement>(null);

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
    suggestion: L('הצעות', 'Suggestions'),
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
    suggestion: L(`הצעת סיווג: ${placeTypeLabel(r.level ?? '', lang)}`, `You suggested: ${placeTypeLabel(r.level ?? '', lang)}`),
  })[r.kind];
  const pill = (r: FeedRow) => {
    if (r.status === 'pending') return <span className="feed-pill wait">{L('מחכה לאישור', 'Waiting')}</span>;
    if (r.status === 'verified' || r.status === 'approved') return <span className="feed-pill ok">{L('אושר', 'Confirmed')}</span>;
    if (r.status === 'rejected') return <span className="feed-pill wait">{L('לא אושר', 'Not approved')}</span>;
    if (r.status === 'disputed') return <span className="feed-pill wait">{L('בבדיקה', 'Under review')}</span>;
    return null;
  };
  const href = (r: FeedRow) => (r.kind === 'list' ? `/list/${r.id}` : `/map?place=${r.place_id}`);

  // Anything you added can be taken back. A change to something already approved goes to the admin again.
  const run = async (work: () => Promise<unknown>, message: string) => {
    setError('');
    setDone('');
    try {
      await work();
      setSure(null);
      setDone(message);
      load();
    } catch (e) { setError(friendly(e, lang)); }
  };
  const remove = (r: FeedRow) => ({
    place: () => withdrawPlace(sb, r.id),
    claim: () => withdrawClaim(sb, r.id),
    vote: () => withdrawVote(sb, r.id),
    review: () => deleteReview(sb, r.id, userId),
    photo: () => deleteMyPhoto(sb, r.id, r.path!),
    suggestion: () => withdrawSuggestion(sb, r.id),
    saved: () => setFavorite(sb, r.id, userId, false),
    list: async () => { onManage('lists'); },
  })[r.kind];
  const deleteButton = (r: FeedRow, label = L('מחיקה', 'Delete'), ask = L('למחוק?', 'Delete?')) => {
    const key = `${r.kind}-${r.id}`;
    return sure === key
      ? <button type="button" className="btn small ghost danger" onClick={() => run(remove(r), L('נמחק.', 'Deleted.'))}>{ask}</button>
      : <button type="button" className="chip-act danger" onClick={() => setSure(key)}><span aria-hidden="true">🗑️</span> {label}</button>;
  };
  const editButton = (onClick: () => void, label = L('עריכה', 'Edit')) => (
    <button type="button" className="chip-act" onClick={onClick}><span aria-hidden="true">✏️</span> {label}</button>
  );
  const photoActions = (r: FeedRow) => (
    <>
      <button type="button" className="chip-act" onClick={() => { setReplacing(r); photoFile.current?.click(); }}><span aria-hidden="true">🔄</span> {L('החלפה', 'Replace')}</button>
      {deleteButton(r)}
    </>
  );
  const actions = (r: FeedRow) => {
    switch (r.kind) {
      case 'place': return <>{editButton(() => setEditPlace(r.id))}{deleteButton(r)}</>;
      case 'claim': return <>{editButton(() => onManage('info'))}{deleteButton(r)}</>;
      case 'vote': return deleteButton(r, L('ביטול האישור', 'Undo'), L('לבטל?', 'Undo?'));
      case 'review': return <>{editButton(() => setEditReview(r))}{deleteButton(r)}</>;
      case 'photo': return photoActions(r);
      case 'suggestion': return r.status === 'pending' ? <>{editButton(() => setEditSuggestion(r))}{deleteButton(r)}</> : null;
      case 'list': return editButton(() => onManage('lists'));
      case 'saved': return deleteButton(r, L('הסרה מהשמורים', 'Unsave'), L('להסיר?', 'Remove?'));
    }
  };
  const editors = (
    <>
      <input ref={photoFile} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const old = replacing;
        setReplacing(null);
        if (file && old?.path && old.place_id) {
          run(() => replaceMyPhoto(sb, { id: old.id, path: old.path!, placeId: old.place_id! }, userId, file), L('התמונה הוחלפה. החדשה מחכה לאישור מנהל.', 'Photo replaced. The new one is waiting for approval.'));
        }
      }} />
      {editPlace && (
        <EditMyPlace sb={sb} id={editPlace} onClose={() => setEditPlace(null)} onSaved={() => {
          setEditPlace(null);
          setDone(L('נשמר. השינוי נשלח לאישור מנהל.', 'Saved. The change was sent to the admin.'));
          load();
        }} />
      )}
      {editReview && editReview.place_id && (
        <ReviewEditor sb={sb} userId={userId} placeId={editReview.place_id} placeName={editReview.title} rating={editReview.rating ?? 0} comment={editReview.comment}
          onClose={() => setEditReview(null)} onSaved={() => { setEditReview(null); setDone(L('הביקורת עודכנה.', 'Review updated.')); load(); }} />
      )}
      {editSuggestion && editSuggestion.place_id && (
        <SuggestType sb={sb} place={{ id: editSuggestion.place_id, name: editSuggestion.title, place_type: editSuggestion.level ?? 'restaurant' }}
          onClose={() => setEditSuggestion(null)} onSent={() => { setEditSuggestion(null); setDone(L('ההצעה עודכנה ונשלחה שוב לאישור.', 'Your suggestion was updated and sent again.')); load(); }} />
      )}
    </>
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
      <ScrollRow className="feed-filters" role="group" aria-label={L('סינון הפעילות', 'Filter your activity')}>
        {(['all', ...present] as Filter[]).map((k) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k !== 'all' && <span aria-hidden="true">{LOOK[k].emoji}</span>} {names[k]}
            <b>{k === 'all' ? rows.length : rows.filter((r) => r.kind === k).length}</b>
          </button>
        ))}
      </ScrollRow>
      {error && <p className="warnbox" role="alert">{error}</p>}
      {done && <p className="my-done" role="status"><span aria-hidden="true">✓</span> {done}</p>}
      {editors}

      {filter === 'photo' ? (
        <ul key="photos" className="feed-photos">
          {shown.map((r, i) => (
            <li key={r.id} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <Link href={href(r)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={placePhotoUrl(sb, r.path!)} alt={L(`תמונה מ${r.title}`, `A photo from ${r.title}`)} loading="lazy" />
                {pill(r)}
              </Link>
              <div><b>{r.title}</b><span className="feed-acts">{photoActions(r)}</span></div>
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
                      <span className="feed-acts">{actions(r)}</span>
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
