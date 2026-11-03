'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMyActivity, withdrawClaim, type MyActivity as Activity } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { levelInfo, levelText, needLabel, type Level } from '@/lib/types';
import { useL } from './LangProvider';

interface Props {
  sb: SupabaseClient;
  show: 'info' | 'votes' | 'reviews';
  /** The numbers on the profile changed. */
  onChanged: () => void;
}

/** Your own information, confirmations and reviews, opened from the numbers on your profile. */
export default function MyActivity({ sb, show, onChanged }: Props) {
  const L = useL();
  const lang = L.lang;
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState('');

  const load = () => fetchMyActivity(sb).then(setData).catch((e) => setError(friendly(e, lang)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const levelName = (need: Activity['claims'][number]['need'], level: string) => {
    const info = levelInfo(need, level as Level);
    return info ? levelText(info, lang) : needLabel(need, lang);
  };
  const statusName = (status: string) => ({
    pending: L('מחכה לאישור', 'Waiting for confirmation'),
    verified: L('אושר', 'Confirmed'),
    rejected: L('הוסר', 'Removed'),
    disputed: L('בבדיקה', 'Under review'),
  } as Record<string, string>)[status] ?? status;

  const withdraw = async (id: string) => {
    setError('');
    try {
      await withdrawClaim(sb, id);
      await load();
      onChanged();
    } catch (e) { setError(friendly(e, lang)); }
  };

  if (error) return <p className="warnbox">{error}</p>;
  if (!data) return <p className="muted">{L('טוען…', 'Loading…')}</p>;
  const empty = (text: string) => <p className="muted">{text}</p>;

  if (show === 'info') {
    return (
      <section className="sec">
        <h2>{L('המידע שהוספתי', 'Information I added')}</h2>
        {data.claims.length === 0 ? empty(L('עוד אין. בכל מקום אפשר להוסיף מידע.', 'None yet. You can add information on any place.')) : (
          <ul className="my-rows">
            {data.claims.map((c) => (
              <li key={c.id}>
                <Link href={`/map?place=${c.placeId}`}><b>{c.place}</b><small>{levelName(c.need, c.level)}, {statusName(c.status)}</small></Link>
                {c.status === 'pending' && c.confirmCount === 0 && (
                  <button type="button" className="btn small ghost" onClick={() => withdraw(c.id)}>{L('מחיקה', 'Delete')}</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  if (show === 'votes') {
    return (
      <section className="sec">
        <h2>{L('מה שאישרתי', 'What I confirmed')}</h2>
        {data.votes.length === 0 ? empty(L('עוד אין. הייתם במקום? אפשר לאשר את המידע עליו.', "None yet. Been to a place? You can confirm what's written.")) : (
          <ul className="my-rows">
            {data.votes.map((v, i) => (
              <li key={`${v.placeId}-${i}`}>
                <Link href={`/map?place=${v.placeId}`}><b>{v.place}</b><small>{levelName(v.need, v.level)}, {v.vote === 1 ? L('אישרת', 'You confirmed') : L('דיווחת שלא נכון', 'You reported it')}</small></Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  return (
    <section className="sec">
      <h2>{L('הביקורות שלי', 'My reviews')}</h2>
      {data.reviews.length === 0 ? empty(L('עוד אין. אפשר לכתוב ביקורת בדף של מקום.', 'None yet. You can write a review on a place page.')) : (
        <ul className="my-rows">
          {data.reviews.map((r) => (
            <li key={r.placeId}>
              <Link href={`/map?place=${r.placeId}`}><b>{r.place}</b><small><span aria-label={L(`${r.rating} מתוך 5`, `${r.rating} of 5`)}>{'★'.repeat(r.rating)}</span>{r.comment ? ` ${r.comment}` : ''}</small></Link>
              <Link className="btn small" href={`/map?place=${r.placeId}`}>{L('עריכה', 'Edit')}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
