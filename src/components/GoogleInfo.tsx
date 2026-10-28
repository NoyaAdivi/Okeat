'use client';

import { useEffect, useState } from 'react';

interface GInfo {
  found: boolean;
  type?: string | null;
  hours?: string[] | null;
  openNow?: boolean | null;
  rating?: number | null;
  ratings?: number | null;
  price?: string | null;
  phone?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  closed?: 'permanent' | 'temporary' | null;
  vegetarian?: boolean | null;
  breakfast?: boolean | null;
  dineIn?: boolean | null;
  takeout?: boolean | null;
  delivery?: boolean | null;
}

const PRICE: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: '₪ זול', PRICE_LEVEL_MODERATE: '₪₪ בינוני',
  PRICE_LEVEL_EXPENSIVE: '₪₪₪ יקר', PRICE_LEVEL_VERY_EXPENSIVE: '₪₪₪₪ יקר מאוד',
};

/**
 * Live details from Google (type, hours, rating, services), shown only while the panel is open.
 * Hidden completely when no Google key is set up.
 */
export default function GoogleInfo({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const [info, setInfo] = useState<GInfo | null>(null);
  const [state, setState] = useState<'loading' | 'off' | 'error' | 'ok'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setInfo(null);
    fetch(`/api/google-place?${new URLSearchParams({ name, lat: String(lat), lng: String(lng) })}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) return setState('off');
        if (!r.ok) return setState('error');
        setInfo(await r.json());
        setState('ok');
      })
      .catch(() => !cancelled && setState('error'));
    return () => { cancelled = true; };
  }, [name, lat, lng]);

  if (state === 'off') return null;
  if (state === 'loading') return <section className="sec ginfo"><h3>מידע נוסף מגוגל</h3><p className="muted">טוען…</p></section>;
  if (state === 'error') return null;
  if (!info?.found) return <section className="sec ginfo"><h3>מידע נוסף מגוגל</h3><p className="muted">לא מצאנו את המקום בגוגל.</p></section>;

  const services = [
    info.dineIn && 'ישיבה במקום', info.takeout && 'טייק אוויי', info.delivery && 'משלוחים',
    info.breakfast && 'ארוחות בוקר', info.vegetarian && 'יש מנות צמחוניות',
  ].filter(Boolean) as string[];

  return (
    <section className="sec ginfo" aria-labelledby="g-h">
      <h3 id="g-h">מידע נוסף מגוגל</h3>
      {info.closed && <p className="g-closed">{info.closed === 'permanent' ? '⚠️ לפי גוגל המקום נסגר.' : '⚠️ לפי גוגל המקום סגור זמנית.'}</p>}
      <div className="g-row">
        {info.type && <span className="food-chip">{info.type}</span>}
        {info.rating != null && <span className="food-chip">⭐ {info.rating.toFixed(1)}{info.ratings ? ` (${info.ratings.toLocaleString('he-IL')})` : ''}</span>}
        {info.price && PRICE[info.price] && <span className="food-chip">{PRICE[info.price]}</span>}
        {info.openNow != null && <span className={`food-chip ${info.openNow ? 'g-open' : 'g-shut'}`}>{info.openNow ? 'פתוח עכשיו' : 'סגור עכשיו'}</span>}
      </div>
      {services.length > 0 && <p className="g-services">{services.join(' · ')}</p>}
      {info.hours && info.hours.length > 0 && (
        <details className="g-hours">
          <summary>שעות פתיחה לפי גוגל</summary>
          <ul>{info.hours.map((h) => <li key={h}>{h}</li>)}</ul>
        </details>
      )}
      <p className="g-links">
        {info.phone && <a href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>📞 {info.phone}</a>}
        {info.mapsUrl && <a href={info.mapsUrl} target="_blank" rel="noopener noreferrer">פתיחה בגוגל מפות</a>}
      </p>
      <p className="src-note">המידע מגיע מ-Google ברגע שפותחים את המקום, ולא נשמר אצלנו.</p>
    </section>
  );
}
