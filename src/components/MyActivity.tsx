'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteReview, fetchMyActivity, fetchPublicActivity, updateMyClaim, withdrawClaim, withdrawVote, type MyActivity as Activity } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { LEVELS, levelInfo, levelText, needLabel, type Level } from '@/lib/types';
import { useL } from './LangProvider';
import ReviewEditor from './ReviewEditor';

interface Props {
  sb: SupabaseClient;
  /** Your own account: everything can be changed. */
  userId?: string;
  /** Someone else's profile: read only, and only what is public. */
  publicId?: string;
  show: 'info' | 'votes' | 'reviews';
  /** The numbers on the profile changed. */
  onChanged: () => void;
}

/** Your own information, confirmations and reviews, opened from the numbers on your profile. */
export default function MyActivity({ sb, userId, publicId, show, onChanged }: Props) {
  const L = useL();
  const lang = L.lang;
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [editing, setEditing] = useState<{ id: string; level: string } | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [review, setReview] = useState<Activity['reviews'][number] | null>(null);

  const load = () => (publicId ? fetchPublicActivity(sb, publicId) : fetchMyActivity(sb)).then(setData).catch((e) => setError(friendly(e, lang)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const levelName = (need: Activity['claims'][number]['need'], level: string) => {
    const info = levelInfo(need, level as Level);
    return info ? levelText(info, lang) : needLabel(need, lang);
  };
  const statusName = (status: string) => ({
    pending: L('מחכה לאישור', 'Waiting for confirmation'),
    verified: L('אושר', 'Confirmed'),
    rejected: L('הוסר', 'Removed'),
    disputed: L('בבדיקה', 'Under review'),
  } as Record<string, string>)[status] ?? status;

  const act = async (work: () => Promise<unknown>, message: string) => {
    setError('');
    setDone('');
    try {
      await work();
      await load();
      onChanged();
      setEditing(null);
      setSure(null);
      setDone(message);
    } catch (e) { setError(friendly(e, lang)); }
  };
  const remove = (key: string, work: () => Promise<unknown>) => (
    sure === key
      ? <button type="button" className="btn small ghost danger" onClick={() => act(work, L('נמחק.', 'Deleted.'))}>{L('למחוק?', 'Delete?')}</button>
      : <button type="button" className="link" onClick={() => setSure(key)}>{L('מחיקה', 'Delete')}</button>
  );
  const note = (
    <>
      {error && <p className="warnbox" role="alert">{error}</p>}
      {done && <p className="my-done" role="status">{done}</p>}
    </>
  );

  if (!data && error) return <p className="warnbox">{error}</p>;
  if (!data) return <p className="muted">{L('טוען…', 'Loading…')}</p>;
  const empty = (text: string) => <p className="muted">{text}</p>;

  if (show === 'info') {
    return (
      <section className="sec">
        <h2>{publicId ? L('מידע שהוסיף/ה', 'Information added') : L('המידע שהוספתי', 'Information I added')}</h2>
        {note}
        {data.claims.length === 0 ? empty(publicId ? L('עוד אין.', 'None yet.') : L('עוד אין. בכל מקום אפשר להוסיף מידע.', 'None yet. You can add information on any place.')) : (
          <ul className="my-rows">
            {data.claims.map((c) => (
              <li key={c.id}>
                <Link href={`/map?place=${c.placeId}`}><b>{c.place}</b><small>{levelName(c.need, c.level)}, {statusName(c.status)}</small></Link>
                {!publicId && <span className="my-acts">
                  {LEVELS[c.need].filter((l) => l.value !== 'marked').length > 1 && (
                    <button type="button" className="link" onClick={() => setEditing({ id: c.id, level: c.level })}>{L('עריכה', 'Edit')}</button>
                  )}
                  {remove(c.id, () => withdrawClaim(sb, c.id))}
                </span>}
                {editing?.id === c.id && (
                  <form className="my-edit" onSubmit={(e) => { e.preventDefault(); act(() => updateMyClaim(sb, c.id, editing.level), L('נשמר ונשלח שוב לאישור.', 'Saved and sent for confirmation again.')); }}>
                    <label htmlFor={`level-${c.id}`}>{needLabel(c.need, lang)}</label>
                    <select id={`level-${c.id}`} value={editing.level} onChange={(e) => setEditing({ id: c.id, level: e.target.value })}>
                      {LEVELS[c.need].filter((l) => l.value !== 'marked').map((l) => <option key={l.value} value={l.value}>{levelText(l, lang)}</option>)}
                    </select>
                    <div>
                      <button type="submit" className="btn small primary">{L('שמירה', 'Save')}</button>
                      <button type="button" className="btn small" onClick={() => setEditing(null)}>{L('ביטול', 'Cancel')}</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  if (show === 'votes') {
    return (
      <section className="sec">
        <h2>{publicId ? L('מה שאישר/ה', 'What they confirmed') : L('מה שאישרתי', 'What I confirmed')}</h2>
        {note}
        {data.votes.length === 0 ? empty(publicId ? L('עוד אין.', 'None yet.') : L('עוד אין. הייתם במקום? אפשר לאשר את המידע עליו.', "None yet. Been to a place? You can confirm what's written.")) : (
          <ul className="my-rows">
            {data.votes.map((v, i) => (
              <li key={`${v.placeId}-${i}`}>
                <Link href={`/map?place=${v.placeId}`}><b>{v.place}</b><small>{levelName(v.need, v.level)}, {v.vote === 1 ? (publicId ? L('אישר/ה', 'Confirmed') : L('אישרת', 'You confirmed')) : (publicId ? L('דיווח/ה שלא נכון', 'Reported it') : L('דיווחת שלא נכון', 'You reported it'))}</small></Link>
                {!publicId && <span className="my-acts">{sure === v.claimId
                  ? <button type="button" className="btn small ghost danger" onClick={() => act(() => withdrawVote(sb, v.claimId), L('האישור בוטל.', 'Your confirmation was removed.'))}>{L('לבטל?', 'Remove?')}</button>
                  : <button type="button" className="link" onClick={() => setSure(v.claimId)}>{L('ביטול', 'Undo')}</button>}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  return (
    <section className="sec">
      <h2>{publicId ? L('ביקורות', 'Reviews') : L('הביקורות שלי', 'My reviews')}</h2>
      {note}
      {review && userId && (
        <ReviewEditor sb={sb} userId={userId} placeId={review.placeId} placeName={review.place} rating={review.rating} comment={review.comment}
          onClose={() => setReview(null)} onSaved={() => { setReview(null); setDone(L('הביקורת עודכנה.', 'Review updated.')); load(); }} />
      )}
      {data.reviews.length === 0 ? empty(publicId ? L('עוד אין.', 'None yet.') : L('עוד אין. אפשר לכתוב ביקורת בדף של מקום.', 'None yet. You can write a review on a place page.')) : (
        <ul className="my-rows">
          {data.reviews.map((r) => (
            <li key={r.placeId}>
              <Link href={`/map?place=${r.placeId}`}><b>{r.place}</b><small><span aria-label={L(`${r.rating} מתוך 5`, `${r.rating} of 5`)}>{'★'.repeat(r.rating)}</span>{r.comment ? ` ${r.comment}` : ''}</small></Link>
              {!publicId && <span className="my-acts">
                <button type="button" className="link" onClick={() => setReview(r)}>{L('עריכה', 'Edit')}</button>
                {remove(r.placeId, () => deleteReview(sb, r.placeId, userId!))}
              </span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
