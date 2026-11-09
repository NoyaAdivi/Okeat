'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminUpdatePlace, deleteHiddenPlace, moderateClaim, moderatePlace, type AdminPlace } from '@/lib/places';
import { googleUrl } from '@/lib/text';
import CuisinePicker from './CuisinePicker';
import { friendly } from '@/lib/errors';
import { PLACE_TYPES, PLACE_TYPES_EN, levelInfo, levelText, type Claim } from '@/lib/types';
import { useL } from './LangProvider';
import Modal from './Modal';

interface Props {
  sb: SupabaseClient;
  place: AdminPlace;
  /** What the map says about the place, so a wrong seal can come off here. */
  claims?: Claim[];
  onClose: () => void;
  onSaved: () => void;
}

/** For the admin: correct a place by hand, including its type and food. */
export default function AdminPlaceDialog({ sb, place, claims = [], onClose, onSaved }: Props) {
  const L = useL();
  const lang = L.lang;
  const [form, setForm] = useState<AdminPlace>(place);
  const [seals, setSeals] = useState(claims.filter((c) => c.status === 'verified' || c.status === 'pending'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const foods = form.cuisine ?? [];
  const field = (key: 'name' | 'address' | 'phone' | 'website', value: string) => setForm({ ...form, [key]: value });
  const [sure, setSure] = useState<'hide' | 'delete' | null>(null);
  const drop = async (work: () => Promise<void>) => {
    setError('');
    try { await work(); onSaved(); } catch (e) { setError(friendly(e, lang)); }
  };

  const removeSeal = async (claim: Claim) => {
    setError('');
    try {
      await moderateClaim(sb, claim.id, false);
      setSeals(seals.filter((c) => c.id !== claim.id));
    } catch (e) { setError(friendly(e, lang)); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminUpdatePlace(sb, form);
      onSaved();
    } catch (err) {
      setError(friendly(err, lang));
      setBusy(false);
    }
  };

  return (
    <Modal title={L('עריכת מקום', 'Edit place')} subtitle={place.name} onClose={onClose}>
      <form className="admin-edit" onSubmit={save}>
        <div className="field">
          <label htmlFor="ap-name">{L('שם המקום', 'Place name')}</label>
          <input id="ap-name" value={form.name} maxLength={120} onChange={(e) => field('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ap-type">{L('סוג המקום', 'Type of place')}</label>
          <select id="ap-type" value={form.place_type} onChange={(e) => setForm({ ...form, place_type: e.target.value })}>
            {Object.keys(PLACE_TYPES).map((t) => <option key={t} value={t}>{lang === 'en' ? PLACE_TYPES_EN[t] : PLACE_TYPES[t]}</option>)}
          </select>
        </div>
        <CuisinePicker value={foods} onChange={(cuisine) => setForm({ ...form, cuisine })} max={8} />
        {seals.length > 0 && (
          <div className="admin-seals">
            <p className="field-title">{L('המידע שמוצג על המקום', 'Information shown on the place')}</p>
            <ul>
              {seals.map((c) => {
                const info = levelInfo(c.need, c.level);
                return (
                  <li key={c.id}>
                    <span>{info ? levelText(info, lang) : c.level}</span>
                    <button type="button" className="link" onClick={() => removeSeal(c)}>{L('הסרה', 'Remove')}</button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="field">
          <label htmlFor="ap-address">{L('כתובת', 'Address')}</label>
          <input id="ap-address" value={form.address ?? ''} onChange={(e) => field('address', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ap-phone">{L('טלפון', 'Phone')}</label>
          <input id="ap-phone" dir="ltr" value={form.phone ?? ''} onChange={(e) => field('phone', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ap-site">{L('אתר', 'Website')}</label>
          <input id="ap-site" dir="ltr" value={form.website ?? ''} onChange={(e) => field('website', e.target.value)} />
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="admin-dialog-tools">
          <a className="chip-act" href={googleUrl(form.name, form.address)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔎</span> {L('חיפוש בגוגל', 'Search on Google')}</a>
          {!place.removed && (sure === 'hide'
            ? <button type="button" className="btn small ghost danger" onClick={() => drop(() => moderatePlace(sb, place.id, true))}>{L('להסתיר מהמפה?', 'Hide from the map?')}</button>
            : <button type="button" className="chip-act danger" onClick={() => setSure('hide')}><span aria-hidden="true">🙈</span> {L('הסתרה', 'Hide')}</button>)}
          {place.removed && (sure === 'delete'
            ? <button type="button" className="btn small ghost danger" onClick={() => drop(() => deleteHiddenPlace(sb, place.id))}>{L('למחוק לגמרי?', 'Delete for good?')}</button>
            : <button type="button" className="chip-act danger" onClick={() => setSure('delete')}><span aria-hidden="true">🗑️</span> {L('מחיקה', 'Delete')}</button>)}
        </div>
        <div className="cta-row">
          <button type="submit" className="btn primary" disabled={busy}>{busy ? L('שומר…', 'Saving…') : L('שמירה', 'Save')}</button>
          <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}
