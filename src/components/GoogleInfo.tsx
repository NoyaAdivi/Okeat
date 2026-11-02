'use client';

import { useEffect, useState } from 'react';
import { useL } from './LangProvider';

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
const PRICE_EN: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: '₪ Cheap', PRICE_LEVEL_MODERATE: '₪₪ Moderate',
  PRICE_LEVEL_EXPENSIVE: '₪₪₪ Expensive', PRICE_LEVEL_VERY_EXPENSIVE: '₪₪₪₪ Very expensive',
};

/**
 * Live details from Google (type, hours, rating, services), shown only while the panel is open.
 * Hidden completely when no Google key is set up.
 */
export default function GoogleInfo({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const L = useL();
  const lang = L.lang;
  const [info, setInfo] = useState<GInfo | null>(null);
  const [state, setState] = useState<'loading' | 'off' | 'error' | 'ok'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setInfo(null);
    fetch(`/api/google-place?${new URLSearchParams({ name, lat: String(lat), lng: String(lng), lang })}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) return setState('off');
        if (!r.ok) return setState('error');
        setInfo(await r.json());
        setState('ok');
      })
      .catch(() => !cancelled && setState('error'));
    return () => { cancelled = true; };
  }, [name, lat, lng, lang]);

  if (state === 'off') return null;
  if (state === 'loading') return <section className="sec ginfo"><h3>{L('מידע נוסף מגוגל', 'More from Google')}</h3><p className="muted">{L('טוען…', 'Loading…')}</p></section>;
  if (state === 'error') return null;
  if (!info?.found) return <section className="sec ginfo"><h3>{L('מידע נוסף מגוגל', 'More from Google')}</h3><p className="muted">{L('לא מצאנו את המקום בגוגל.', "We couldn't find this place on Google.")}</p></section>;

  const services = [
    info.dineIn && L('ישיבה במקום', 'Dine-in'), info.takeout && L('טייק אוויי', 'Takeaway'), info.delivery && L('משלוחים', 'Delivery'),
    info.breakfast && L('ארוחות בוקר', 'Breakfast'), info.vegetarian && L('יש מנות צמחוניות', 'Vegetarian dishes'),
  ].filter(Boolean) as string[];

  return (
    <section className="sec ginfo" aria-labelledby="g-h">
      <h3 id="g-h">{L('מידע נוסף מגוגל', 'More from Google')}</h3>
      {info.closed && <p className="g-closed">{info.closed === 'permanent' ? L('⚠️ לפי גוגל המקום נסגר.', '⚠️ According to Google this place has closed.') : L('⚠️ לפי גוגל המקום סגור זמנית.', '⚠️ According to Google this place is temporarily closed.')}</p>}
      <div className="g-row">
        {info.type && <span className="food-chip">{info.type}</span>}
        {info.rating != null && <span className="food-chip">⭐ {info.rating.toFixed(1)}{info.ratings ? ` (${info.ratings.toLocaleString(lang === 'en' ? 'en-US' : 'he-IL')})` : ''}</span>}
        {info.price && PRICE[info.price] && <span className="food-chip">{(lang === 'en' ? PRICE_EN : PRICE)[info.price]}</span>}
        {info.openNow != null && <span className={`food-chip ${info.openNow ? 'g-open' : 'g-shut'}`}>{info.openNow ? L('פתוח עכשיו', 'Open now') : L('סגור עכשיו', 'Closed now')}</span>}
      </div>
      {services.length > 0 && <p className="g-services">{services.join(' · ')}</p>}
      {info.hours && info.hours.length > 0 && (
        <details className="g-hours">
          <summary>{L('שעות פתיחה לפי גוגל', 'Opening hours from Google')}</summary>
          <ul>{info.hours.map((h) => <li key={h}>{h}</li>)}</ul>
        </details>
      )}
      <p className="g-links">
        {info.phone && <a href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>📞 {info.phone}</a>}
        {info.mapsUrl && <a href={info.mapsUrl} target="_blank" rel="noopener noreferrer">{L('פתיחה בגוגל מפות', 'Open in Google Maps')}</a>}
      </p>
      <p className="src-note">{L('המידע מגיע מ-Google ברגע שפותחים את המקום, ולא נשמר אצלנו.', "This comes from Google when you open the place, and we don't keep it.")}</p>
    </section>
  );
}
