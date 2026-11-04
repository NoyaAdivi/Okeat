'use client';

import { placeTypeLabel, type Place } from '@/lib/types';
import { placeEmoji } from '@/lib/emoji';
import { cuisineLabel } from '@/lib/cuisine';
import { openStatus } from '@/lib/hours';
import { estimateTrip } from '@/lib/geo';
import Badges from './Badges';
import { useL } from './LangProvider';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchRatings } from '@/lib/places';

interface Props {
  /** Where the minutes are counted from, when it is not the live location. */
  fromLabel?: string | null;
  /** The closest result is far from where the list is looking. */
  nothingClose?: boolean;
  places: Place[];
  loading: boolean;
  error: string | null;
  activeNeeds: number;
  onSelect: (id: string) => void;
  onReset: () => void;
}

const PAGE = 40;

export default function PlaceList({ fromLabel, nothingClose, places, loading, error, activeNeeds, onSelect, onReset }: Props) {
  const L = useL();
  const lang = L.lang;
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [places]);
  const sb = useMemo(() => createClient(), []);
  const [sort, setSort] = useState<'near' | 'rating' | 'confirmed'>('near');
  const [ratings, setRatings] = useState<Record<string, { average: number; total: number }>>({});
  useEffect(() => {
    fetchRatings(sb, places.slice(0, 200).map((p) => p.id)).then(setRatings);
  }, [sb, places]);
  const confirmed = (p: Place) => p.claims.reduce((sum, c) => sum + (c.status === 'verified' ? c.confirmCount + 1 : 0), 0);
  const sorted = useMemo(() => {
    if (sort === 'rating') return [...places].sort((a, b) => (ratings[b.id]?.average ?? 0) - (ratings[a.id]?.average ?? 0));
    if (sort === 'confirmed') return [...places].sort((a, b) => confirmed(b) - confirmed(a));
    return places;
  }, [places, sort, ratings]);

  if (error) {
    return (
      <div className="empty" role="alert">
        <p>{error}</p>
      </div>
    );
  }
  if (loading && places.length === 0) {
    return (
      <div aria-busy="true" aria-label={L('טוען מקומות', 'Loading places')}>
        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
      </div>
    );
  }

  const word = places.length === 1 ? L('מקום אחד', '1 place') : L(`${places.length} מקומות`, `${places.length} places`);
  const summary =
    activeNeeds >= 2 ? <><b>{word}</b> {L('מתאימים לכל הדרישות שבחרתם', 'match everything you chose')}</> :
    activeNeeds === 1 ? <><b>{word}</b> {L('מתאימים', 'match')}</> :
    <><b>{word}</b> {L('בסביבה', 'nearby')}</>;

  if (places.length === 0) {
    return (
      <>
        <p className="summary">{summary}</p>
        {activeNeeds > 0 ? (
          <div className="empty">
            <p>{L('אין כרגע מקום קרוב שעונה על כל הדרישות. אפשר להוריד רמה באחת מהן, או לחפש באזור אחר במפה.', 'No place nearby matches everything right now. Try a lower level for one of them, or search another area on the map.')}</p>
            <button type="button" className="btn" onClick={onReset}>{L('איפוס הסינון', 'Reset filters')}</button>
          </div>
        ) : (
          <div className="empty">
            <p>{L('עוד אין מקומות באזור הזה. מכירים מקום טוב? הוסיפו אותו, או הזיזו את המפה לאזור אחר.', 'No places in this area yet. Know a good one? Add it, or move the map to another area.')}</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="list-top">
        <p className="summary" aria-live="polite">
          {summary}
          {fromLabel && <small className="dist-from"><span aria-hidden="true">📍</span> {L(`המרחק מ: ${fromLabel}`, `Distance from: ${fromLabel}`)}</small>}
        </p>
        <label className="list-sort">
          <span className="vh">{L('מיון', 'Sort')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="near">{L('הכי קרוב', 'Nearest')}</option>
            <option value="rating">{L('הכי מדורג', 'Top rated')}</option>
            <option value="confirmed">{L('הכי מאושר', 'Most confirmed')}</option>
          </select>
        </label>
      </div>
      {nothingClose && (
        <p className="far-note">{L('אין עדיין מקומות ממש קרובים לכאן. אלה הקרובים ביותר.', 'No places very close by yet. These are the nearest.')}</p>
      )}
      <ul className="list">
        {sorted.slice(0, shown).map((p, i) => {
          const st = openStatus(p.hours, lang);
          return (
            <li key={p.id} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <button type="button" className="item" onClick={() => onSelect(p.id)}>
                <span className="av" aria-hidden="true">{placeEmoji(p.place_type)}</span>
                <span className="row1">
                  <span className="nm">{p.name}{ratings[p.id] && <span className="list-rating"> ★ {ratings[p.id].average}</span>}</span>
                  {p.distance_m !== null && (
                    <span className="dist">{(() => {
                      const t = estimateTrip(p.distance_m);
                      return (
                        <>
                          {t.walk !== null && <span>{L(`כ-${t.walk} דק׳ הליכה`, `~${t.walk} min walk`)}</span>}
                          {t.drive !== null && <span>{L(`כ-${t.drive} דק׳ נסיעה`, `~${t.drive} min drive`)}</span>}
                        </>
                      );
                    })()}</span>
                  )}
                </span>
                <span className="row2">
                  <span>{p.cuisine?.length ? p.cuisine.slice(0, 2).map((c) => cuisineLabel(c, lang)).join(', ') : placeTypeLabel(p.place_type, lang)}</span>
                  {st.text && <span className={st.open ? 'st-open' : undefined}>{st.text}</span>}
                </span>
                <Badges place={p} />
              </button>
            </li>
          );
        })}
      </ul>
      {places.length > shown && (
        <button type="button" className="btn more" onClick={() => setShown((n) => n + PAGE)}>
          {L(`עוד ${Math.min(PAGE, places.length - shown)} מקומות`, `${Math.min(PAGE, places.length - shown)} more places`)}
        </button>
      )}
    </>
  );
}
