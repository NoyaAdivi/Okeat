'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import { LEVELS, NEED_LABELS, type Level } from '@/lib/types';
import { NEED_CLASS } from '@/lib/claims';
import { NEED_EMOJI } from '@/lib/emoji';
import { proposeClaim } from '@/lib/places';
import { friendly } from '@/lib/errors';

interface Props {
  sb: SupabaseClient;
  place: { id: string; name: string };
  need: 'vegan' | 'gluten_free';
  onClose: () => void;
  onDone: () => void;
}

/** "What do you know about this place?" for vegan and gluten-free. Kosher goes through a certificate photo. */
export default function AddInfoDialog({ sb, place, need, onClose, onDone }: Props) {
  const [level, setLevel] = useState<Level>(LEVELS[need][0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await proposeClaim(sb, { placeId: place.id, need, level });
      onDone();
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${NEED_EMOJI[need]} ${NEED_LABELS[need].label} ב${place.name}?`}
      subtitle="זה יופיע במפה אחרי ששלושה אנשים נוספים יאשרו."
      onClose={onClose}
    >
      <div className={`need-box on ${NEED_CLASS[need]}`}>
        <span className="lab">מה נכון לגבי המקום?</span>
        <div className="info-levels" role="radiogroup" aria-label={NEED_LABELS[need].label}>
          {LEVELS[need].map((l) => (
            <label key={l.value} className="info-level">
              <input type="radio" name="info-level" checked={level === l.value} onChange={() => setLevel(l.value)} />
              <span>
                <b>{l.label}</b>
                {l.note && <small>{l.note}</small>}
              </span>
            </label>
          ))}
        </div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <p className="consent">בשליחה אתם מאשרים שהמידע נכון למיטב ידיעתכם, ומסכימים ל<a href="/terms" target="_blank" rel="noopener noreferrer">תנאי השימוש</a>.</p>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onClose}>ביטול</button>
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>
          {busy ? 'שולח…' : 'שליחה לאישור הקהילה'}
        </button>
      </div>
    </Modal>
  );
}
