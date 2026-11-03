'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMyPlaceFields, updateMyPlace, type MyPlaceFields } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';
import Modal from './Modal';

/** Fixing a place you added. The change waits for the admin to look at it. */
export default function EditMyPlace({ sb, id, onClose, onSaved }: { sb: SupabaseClient; id: string; onClose: () => void; onSaved: (name: string) => void }) {
  const L = useL();
  const [form, setForm] = useState<MyPlaceFields | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMyPlaceFields(sb, id).then(setForm).catch((e) => setError(friendly(e, L.lang)));
  }, [sb, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError('');
    setBusy(true);
    try {
      await updateMyPlace(sb, id, form);
      onSaved(form.name.trim());
    } catch (err) {
      setError(friendly(err, L.lang));
      setBusy(false);
    }
  };

  const fields: [keyof MyPlaceFields, string, string][] = [
    ['name', L('שם המקום', 'Place name'), 'text'],
    ['address', L('כתובת', 'Address'), 'text'],
    ['phone', L('טלפון', 'Phone'), 'tel'],
    ['website', L('אתר', 'Website'), 'url'],
  ];

  return (
    <Modal title={L('עריכת מקום', 'Edit place')} subtitle={L('השינוי יישלח לאישור.', 'The change will be sent for review.')} onClose={onClose}>
      {!form && !error && <p className="muted">{L('טוען…', 'Loading…')}</p>}
      {error && !form && <p className="warnbox">{error}</p>}
      {form && (
        <form onSubmit={save} className="my-place-form" noValidate>
          {fields.map(([key, label, type]) => (
            <div className="field" key={key}>
              <label htmlFor={`my-${key}`}>{label}</label>
              <input id={`my-${key}`} type={type} dir={type === 'text' ? undefined : 'ltr'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          {error && <div className="err" role="alert">{error}</div>}
          <div className="modal-acts">
            <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? L('שומר…', 'Saving…') : L('שמירה', 'Save')}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
