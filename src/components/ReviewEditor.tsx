'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveReview } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';
import Modal from './Modal';

interface Props {
  sb: SupabaseClient;
  userId: string;
  placeId: string;
  placeName: string;
  rating: number;
  comment: string | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Fixing your own review from your profile, without going back to the place. */
export default function ReviewEditor({ sb, userId, placeId, placeName, rating: startRating, comment: startComment, onClose, onSaved }: Props) {
  const L = useL();
  const [rating, setRating] = useState(startRating);
  const [comment, setComment] = useState(startComment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setBusy(true);
    setError('');
    try {
      await saveReview(sb, placeId, userId, rating, comment);
      onSaved();
    } catch (err) {
      setError(friendly(err, L.lang));
      setBusy(false);
    }
  };

  return (
    <Modal title={L('עריכת הביקורת', 'Edit your review')} subtitle={placeName} onClose={onClose}>
      <form onSubmit={save} className="review-edit" noValidate>
        <div className="star-pick big" role="radiogroup" aria-label={L('דירוג', 'Rating')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)}>★</button>
          ))}
        </div>
        <label htmlFor="rv-comment">{L('מה כתבת (לא חובה)', 'What you wrote (optional)')}</label>
        <textarea id="rv-comment" maxLength={300} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <div className="err" role="alert">{error}</div>}
        <div className="modal-acts">
          <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
          <button type="submit" className="btn primary" disabled={busy || !rating}>{busy ? L('שומר…', 'Saving…') : L('שמירה', 'Save')}</button>
        </div>
      </form>
    </Modal>
  );
}
