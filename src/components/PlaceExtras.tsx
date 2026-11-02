'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Place } from '@/lib/types';
import {
  deleteReview, fetchPlacePhotos, fetchReviews, isFavorite, saveReview, setFavorite, uploadPlacePhoto,
  type PlacePhoto, type PlaceReview,
} from '@/lib/places';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';
import Avatar from './Avatar';

interface Props {
  sb: SupabaseClient;
  place: Place;
  /** the signed-in account, null for guests */
  userId: string | null;
  isAdmin: boolean;
  onSignIn: (reason: string) => void;
  onToast: (text: string) => void;
}

const Stars = ({ value }: { value: number }) => (
  <span className="stars" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : undefined}>★</span>)}</span>
);

/** On a place: save it, photos and reviews. */
export default function PlaceExtras({ sb, place, userId, isAdmin, onSignIn, onToast }: Props) {
  const L = useL();
  const lang = L.lang;
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [saved, setSaved] = useState(false);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchReviews(sb, place.id).then(setReviews);
    fetchPlacePhotos(sb, place.id).then(setPhotos);
    if (userId) isFavorite(sb, place.id, userId).then(setSaved).catch(() => setSaved(false));
  }, [sb, place.id, userId]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { onToast(friendly(e, lang)); }
    setBusy(false);
  };
  const needAccount = (reason: string) => {
    if (userId) return false;
    onSignIn(reason);
    return true;
  };

  const mine = reviews.find((r) => r.user_id === userId);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <>
      <section className="sec extras-bar">
        <button type="button" className="btn small" aria-pressed={saved} disabled={busy} onClick={() => {
          if (needAccount(L('כדי לשמור מקומות צריך להתחבר עם חשבון.', 'To save places, sign in with an account.'))) return;
          run(async () => { await setFavorite(sb, place.id, userId!, !saved); setSaved(!saved); });
        }}>{saved ? '❤️' : '🤍'} {saved ? L('נשמר', 'Saved') : L('שמירה', 'Save')}</button>
        <button type="button" className="btn small" disabled={busy} onClick={() => {
          if (needAccount(L('כדי להעלות תמונה צריך להתחבר עם חשבון.', 'To add a photo, sign in with an account.'))) return;
          file.current?.click();
        }}>📷 {L('הוספת תמונה', 'Add a photo')}</button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) run(async () => {
            await uploadPlacePhoto(sb, place.id, userId!, f);
            onToast(L('תודה! התמונה תופיע אחרי אישור מנהל.', 'Thanks! The photo will appear after approval.'));
            load();
          });
        }} />
      </section>

      {photos.length > 0 && (
        <section className="sec">
          <div className="place-photos">
            {photos.map((p) => (
              <figure key={p.id} className={p.approved ? undefined : 'waiting'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={L(`תמונה מ${place.name}`, `A photo from ${place.name}`)} loading="lazy" />
                {!p.approved && <figcaption>{L('ממתינה לאישור', 'Waiting for approval')}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="sec reviews">
        <h3>{L('ביקורות', 'Reviews')}{reviews.length > 0 && <small> <Stars value={average} /> {average.toFixed(1)} ({reviews.length})</small>}</h3>
        {reviews.length === 0 && <p className="muted">{L('עוד אין ביקורות. היו הראשונים!', 'No reviews yet. Be the first!')}</p>}
        <ul>
          {reviews.map((r) => (
            <li key={r.user_id}>
              <Avatar name={r.name} url={r.avatar_url} size={30} />
              <div>
                <b>{r.name}</b> <Stars value={r.rating} /> <small>{formatDate(r.created_at.slice(0, 10))}</small>
                {r.comment && <p>{r.comment}</p>}
                {(r.user_id === userId || isAdmin) && (
                  <button type="button" className="link" disabled={busy} onClick={() => run(async () => { await deleteReview(sb, place.id, r.user_id); load(); })}>{L('מחיקה', 'Delete')}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {writing ? (
          <div className="mini-form">
            <div className="star-pick" role="radiogroup" aria-label={L('דירוג', 'Rating')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)}>★</button>
              ))}
            </div>
            <input type="text" maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={L('ספרו בקצרה איך היה (לא חובה)', 'Tell us briefly how it was (optional)')} aria-label={L('תגובה', 'Comment')} />
            <button type="button" className="btn small" disabled={busy || rating === 0} onClick={() => run(async () => {
              await saveReview(sb, place.id, userId!, rating, comment);
              setWriting(false);
              load();
            })}>{L('שליחה', 'Send')}</button>
          </div>
        ) : (
          <button type="button" className="btn small" onClick={() => {
            if (needAccount(L('כדי לכתוב ביקורת צריך להתחבר עם חשבון.', 'To write a review, sign in with an account.'))) return;
            setRating(mine?.rating ?? 0);
            setComment(mine?.comment ?? '');
            setWriting(true);
          }}>⭐ {mine ? L('עריכת הביקורת שלי', 'Edit my review') : L('כתיבת ביקורת', 'Write a review')}</button>
        )}
      </section>
    </>
  );
}
