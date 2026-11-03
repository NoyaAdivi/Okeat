'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Place, WeeklyHours } from '@/lib/types';
import { ownerUpdatePlace } from '@/lib/places';
import { rangesToText, textToRanges } from '@/lib/checks';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';
import Modal from './Modal';

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  sb: SupabaseClient;
  place: Place;
  menuUrl: string | null;
  onSaved: () => void;
  onClose: () => void;
}

/** For the verified owner of a place: hours, phone, website and menu. */
export default function OwnerEditDialog({ sb, place, menuUrl, onSaved, onClose }: Props) {
  const L = useL();
  const [days, setDays] = useState(() => DAY_KEYS.map((d) => rangesToText(place.hours?.[d] as [string, string][] | undefined)));
  const [phone, setPhone] = useState(place.phone ?? '');
  const [website, setWebsite] = useState(place.website ?? '');
  const [menu, setMenu] = useState(menuUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const hours: Record<string, [string, string][]> = {};
    for (let i = 0; i < 7; i += 1) {
      const ranges = textToRanges(days[i]);
      if (ranges === null) {
        setError(L(`בדקו את השעות ביום ${DAYS_HE[i]}. כתבו למשל 08:00-22:00, או "סגור".`, `Check the hours on ${DAYS_EN[i]}. Write for example 08:00-22:00, or "closed".`));
        return;
      }
      if (ranges) hours[DAY_KEYS[i]] = ranges;
    }
    const link = (v: string) => (!v.trim() ? null : /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
    setBusy(true);
    try {
      await ownerUpdatePlace(sb, place.id, {
        hours: Object.keys(hours).length ? (hours as WeeklyHours) : null,
        phone: phone.trim() || null, website: link(website), menuUrl: link(menu),
      });
      onSaved();
      onClose();
    } catch (err) { setError(friendly(err, L.lang)); }
    setBusy(false);
  };

  return (
    <Modal title={L('עדכון פרטי העסק', 'Update business details')} subtitle={place.name} onClose={onClose}>
      <form onSubmit={save} className="field" noValidate>
        <label htmlFor="own-phone">{L('טלפון', 'Phone')}</label>
        <input id="own-phone" dir="ltr" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label htmlFor="own-site">{L('אתר', 'Website')}</label>
        <input id="own-site" dir="ltr" maxLength={300} value={website} onChange={(e) => setWebsite(e.target.value)} />
        <label htmlFor="own-menu">{L('קישור לתפריט', 'Menu link')}</label>
        <input id="own-menu" dir="ltr" maxLength={300} value={menu} onChange={(e) => setMenu(e.target.value)} />
        <b className="own-hours">{L('שעות פתיחה', 'Opening hours')}</b>
        <p className="muted small">{L('למשל 08:00-22:00, או "סגור". יום ריק יוצג כלא ידוע.', 'For example 08:00-22:00, or "closed". An empty day shows as unknown.')}</p>
        {DAY_KEYS.map((d, i) => (
          <label key={d} className="own-day">
            <span>{L(DAYS_HE[i], DAYS_EN[i])}</span>
            <input dir="ltr" value={days[i]} onChange={(e) => setDays(days.map((v, j) => (j === i ? e.target.value : v)))} />
          </label>
        ))}
        {error && <div className="err" role="alert">{error}</div>}
        <div className="modal-acts">
          <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? L('שומר…', 'Saving…') : L('שמירה', 'Save')}</button>
        </div>
      </form>
    </Modal>
  );
}
