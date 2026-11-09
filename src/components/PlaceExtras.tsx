'use client';

import Link from 'next/link';
import PlaceTile from './PlaceTile';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Place } from '@/lib/types';
import {
  addToList, createList, deleteReview, fetchMyLists, fetchPlaceBusiness, fetchPlacePhotos, fetchReviews, fetchSimilarPlaces, isFavorite,
  reportReview, saveReview, setFavorite, uploadPlacePhoto,
  type MyList, type PlacePhoto, type PlaceReview, type SimilarPlace,
} from '@/lib/places';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';
import Avatar from './Avatar';
import OwnerEditDialog from './OwnerEditDialog';
import { placeIcon } from '@/lib/emoji';

interface Props {
  sb: SupabaseClient;
  place: Place;
  /** the signed-in account, null for guests */
  userId: string | null;
  isAdmin: boolean;
  onSignIn: (reason: string) => void;
  onToast: (text: string) => void;
  /** the place's details changed */
  onChanged: () => void;
}

const Stars = ({ value }: { value: number }) => (
  <span className="stars" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : undefined}>★</span>)}</span>
);

/** On a place: save it, photos and reviews. */
export default function PlaceExtras({ sb, place, userId, isAdmin, onSignIn, onToast, onChanged }: Props) {
  const L = useL();
  const lang = L.lang;
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [saved, setSaved] = useState(false);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<string[]>([]);
  const [similar, setSimilar] = useState<SimilarPlace[]>([]);
  const [business, setBusiness] = useState<{ menuUrl: string | null; isOwner: boolean }>({ menuUrl: null, isOwner: false });
  const [editing, setEditing] = useState(false);
  // The save, photo and list buttons stay above the place's tabs.
  const [actions, setActions] = useState<HTMLElement | null>(null);
  // Photos show at the top of the place, and "you might also like" comes last, after the report buttons.
  const [photoSlot, setPhotoSlot] = useState<HTMLElement | null>(null);
  const [similarSlot, setSimilarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setActions(document.getElementById('place-actions'));
    setPhotoSlot(document.getElementById('place-photos'));
    setSimilarSlot(document.getElementById('place-similar'));
  }, []);
  const [lists, setLists] = useState<MyList[] | null>(null);
  const [newList, setNewList] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchReviews(sb, place.id).then(setReviews);
    fetchPlacePhotos(sb, place.id).then(setPhotos);
    fetchSimilarPlaces(sb, place.id).then(setSimilar);
    fetchPlaceBusiness(sb, place.id).then(setBusiness);
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
  const photoStrip = () => (
    <section className="sec photos-top" aria-label={L('תמונות מהמקום', 'Photos of the place')}>
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
  );
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <>
      {actions && createPortal(<>
      <div className="extras-bar">
        <button type="button" className="btn small" aria-pressed={saved} disabled={busy} onClick={() => {
          if (needAccount(L('כדי לשמור מקומות צריך להתחבר עם חשבון.', 'To save places, sign in with an account.'))) return;
          run(async () => {
            await setFavorite(sb, place.id, userId!, !saved);
            setSaved(!saved);
            if (!saved) onToast(L('נשמר. אפשר למצוא אותו בפרופיל, תחת שמורים.', 'Saved. You can find it on your profile, under Saved.'));
          });
        }}>{saved ? '❤️' : '🤍'} {saved ? L('נשמר', 'Saved') : L('שמירה', 'Save')}</button>
        <button type="button" className="btn small" disabled={busy} onClick={() => {
          if (needAccount(L('כדי להעלות תמונה צריך להתחבר עם חשבון.', 'To add a photo, sign in with an account.'))) return;
          file.current?.click();
        }}>📷 {L('הוספת תמונה', 'Add a photo')}</button>
        <button type="button" className="btn small" disabled={busy} onClick={() => {
          if (needAccount(L('כדי ליצור רשימות צריך להתחבר עם חשבון.', 'To make lists, sign in with an account.'))) return;
          if (lists) setLists(null);
          else fetchMyLists(sb, userId!).then(setLists);
        }}>📋 {L('הוספה לרשימה', 'Add to a list')}</button>
        {business.menuUrl && <a className="btn small" href={business.menuUrl} target="_blank" rel="noopener noreferrer">📖 {L('תפריט', 'Menu')}</a>}
        {business.isOwner && <button type="button" className="btn small" onClick={() => setEditing(true)}>✏️ {L('עדכון פרטי העסק', 'Update business details')}</button>}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) run(async () => {
            await uploadPlacePhoto(sb, place.id, userId!, f);
            onToast(L('תודה! התמונה מחכה לאישור מנהל. כבר עכשיו רואים אותה למעלה בדף המקום ובאזור האישי, ואחרי האישור כולם יראו אותה.', 'Thanks! The photo is waiting for approval. You can already see it at the top of this place and in your profile, and everyone will see it once approved.'));
            load();
          });
        }} />
      </div>
      {lists && (
        <section className="list-picker" aria-label={L('הוספה לרשימה', 'Add to a list')}>
          <p className="list-picker-title">{L('לאיזו רשימה?', 'Which list?')}</p>
            <div className="list-picker-chips">
            {lists.map((l) => (
              <button key={l.id} type="button" className="btn small" disabled={busy} onClick={() => run(async () => {
                await addToList(sb, l.id, place.id);
                onToast(L(`נוסף לרשימה ${l.title}`, `Added to ${l.title}`));
                setLists(null);
              })}>{l.title}</button>
            ))}
          </div>
          <div className="list-picker-new">
            <input maxLength={60} value={newList} onChange={(e) => setNewList(e.target.value)} placeholder={L('שם לרשימה חדשה', 'Name a new list')} aria-label={L('שם לרשימה חדשה', 'Name a new list')} />
            <button type="button" className="btn small" disabled={busy || newList.trim().length < 2} onClick={() => run(async () => {
              const id = await createList(sb, userId!, newList);
              await addToList(sb, id, place.id);
              onToast(L(`נוצרה הרשימה ${newList.trim()}`, `Created ${newList.trim()}`));
              setNewList('');
              setLists(null);
            })}>{L('יצירה והוספה', 'Create and add')}</button>
          </div>
        </section>
      )}
      </>, actions)}

      {photos.length > 0 && (photoSlot ? createPortal(photoStrip(), photoSlot) : photoStrip())}

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
                {r.user_id !== userId && !isAdmin && (
                  <button type="button" className="link" disabled={busy || reported.includes(r.user_id)} onClick={() => {
                    if (needAccount(L('כדי לדווח צריך להתחבר עם חשבון.', 'To report, sign in with an account.'))) return;
                    run(async () => {
                      await reportReview(sb, place.id, r.user_id, userId!);
                      setReported((list) => [...list, r.user_id]);
                      onToast(L('תודה, הדיווח נשלח למנהלים.', 'Thanks, moderators will take a look.'));
                    });
                  }}>{reported.includes(r.user_id) ? L('דווח', 'Reported') : L('דיווח על הביקורת', 'Report this review')}</button>
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

      {similar.length > 0 && similarSlot && createPortal(
        <section className="sec similar">
          <h3>{L('אולי יעניין אותך גם…', 'You might also like…')}</h3>
          <ul className="tiles tiles-row">
            {similar.map((s, i) => (
              <PlaceTile key={s.id} index={i} href={`/map?place=${s.id}`} emoji={placeIcon(s)} name={s.name} sub={s.meters < 1000 ? L(`${s.meters} מ׳`, `${s.meters} m`) : L(`${(s.meters / 1000).toFixed(1)} ק״מ`, `${(s.meters / 1000).toFixed(1)} km`)} />
            ))}
          </ul>
        </section>, similarSlot,
      )}

      {editing && <OwnerEditDialog sb={sb} place={place} menuUrl={business.menuUrl} onSaved={() => { onChanged(); load(); onToast(L('הפרטים נשמרו', 'Details saved')); }} onClose={() => setEditing(false)} />}
    </>
  );
}
