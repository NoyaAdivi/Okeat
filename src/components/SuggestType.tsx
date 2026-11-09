'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { suggestPlaceType } from '@/lib/places';
import { friendly } from '@/lib/errors';
import CuisinePicker from './CuisinePicker';
import { PLACE_TYPES, PLACE_TYPES_EN } from '@/lib/types';
import { useL } from './LangProvider';
import Modal from './Modal';

interface Props {
  sb: SupabaseClient;
  place: { id: string; name: string; place_type: string; cuisine?: string[] | null };
  onClose: () => void;
  onSent: () => void;
}

/** Anyone signed in can say what kind of place this really is. A moderator approves it. */
export default function SuggestType({ sb, place, onClose, onSent }: Props) {
  const L = useL();
  const lang = L.lang;
  const [type, setType] = useState(place.place_type);
  const [foods, setFoods] = useState<string[]>(place.cuisine ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);


  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await suggestPlaceType(sb, place.id, type, foods);
      onSent();
    } catch (err) {
      setError(friendly(err, lang));
      setBusy(false);
    }
  };

  return (
    <Modal title={L('מה יש כאן באמת?', 'What is this place really?')} subtitle={L(`${place.name}. נבדוק ונעדכן.`, `${place.name}. We will check and update it.`)} onClose={onClose}>
      <form className="admin-edit" onSubmit={send}>
        <div className="field">
          <label htmlFor="sg-type">{L('סוג המקום', 'Type of place')}</label>
          <select id="sg-type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.keys(PLACE_TYPES).map((t) => <option key={t} value={t}>{lang === 'en' ? PLACE_TYPES_EN[t] : PLACE_TYPES[t]}</option>)}
          </select>
        </div>
        <CuisinePicker value={foods} onChange={setFoods} />
        {error && <div className="err" role="alert">{error}</div>}
        <div className="modal-acts">
          <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? L('שולח…', 'Sending…') : L('שליחה לאישור', 'Send for approval')}</button>
        </div>
      </form>
    </Modal>
  );
}
