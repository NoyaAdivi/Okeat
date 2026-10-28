'use client';

import { placeTypeLabel, type Place } from '@/lib/types';
import { placeEmoji } from '@/lib/emoji';
import { cuisineLabel } from '@/lib/cuisine';
import { openStatus } from '@/lib/hours';
import { estimateWalk } from '@/lib/geo';
import Badges from './Badges';
import { useEffect, useState } from 'react';

interface Props {
  places: Place[];
  loading: boolean;
  error: string | null;
  activeNeeds: number;
  onSelect: (id: string) => void;
  onReset: () => void;
}

const PAGE = 40;

export default function PlaceList({ places, loading, error, activeNeeds, onSelect, onReset }: Props) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [places]);

  if (error) {
    return (
      <div className="empty" role="alert">
        <p>{error}</p>
      </div>
    );
  }
  if (loading && places.length === 0) {
    return (
      <div aria-busy="true" aria-label="טוען מקומות">
        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
      </div>
    );
  }

  const word = places.length === 1 ? 'מקום אחד' : `${places.length} מקומות`;
  const summary =
    activeNeeds >= 2 ? <><b>{word}</b> מתאימים לכל הדרישות שבחרתם</> :
    activeNeeds === 1 ? <><b>{word}</b> מתאימים</> :
    <><b>{word}</b> בסביבה</>;

  if (places.length === 0) {
    return (
      <>
        <p className="summary">{summary}</p>
        {activeNeeds > 0 ? (
          <div className="empty">
            <p>אין כרגע מקום קרוב שעונה על כל הדרישות. אפשר להוריד רמה באחת מהן, או לחפש באזור אחר במפה.</p>
            <button type="button" className="btn" onClick={onReset}>איפוס הסינון</button>
          </div>
        ) : (
          <div className="empty">
            <p>עוד אין מקומות באזור הזה. מכירים מקום טוב? הוסיפו אותו, או הזיזו את המפה לאזור אחר.</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <p className="summary" aria-live="polite">{summary}</p>
      <ul className="list">
        {places.slice(0, shown).map((p, i) => {
          const st = openStatus(p.hours);
          return (
            <li key={p.id} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <button type="button" className="item" onClick={() => onSelect(p.id)}>
                <span className="av" aria-hidden="true">{placeEmoji(p.place_type)}</span>
                <span className="row1">
                  <span className="nm">{p.name}</span>
                  {p.distance_m !== null && (
                    <span className="dist">{estimateWalk(p.distance_m).minutes} דק׳ הליכה</span>
                  )}
                </span>
                <span className="row2">
                  <span>{p.cuisine?.length ? p.cuisine.slice(0, 2).map(cuisineLabel).join(', ') : placeTypeLabel(p.place_type)}</span>
                  <span className={st.open ? 'st-open' : undefined}>{st.text}</span>
                </span>
                <Badges place={p} />
              </button>
            </li>
          );
        })}
      </ul>
      {places.length > shown && (
        <button type="button" className="btn more" onClick={() => setShown((n) => n + PAGE)}>
          עוד {Math.min(PAGE, places.length - shown)} מקומות
        </button>
      )}
    </>
  );
}
