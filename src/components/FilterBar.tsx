'use client';

import { needLabel, needLetter, type Need, type NeedFilter } from '@/lib/types';
import { useL } from './LangProvider';
import { useState } from 'react';
import { EXTRA_NEEDS, MAIN_NEEDS, NEED_CLASS, NEED_ORDER } from '@/lib/claims';
import { CUISINES, CUISINE_FILTERS } from '@/lib/cuisine';
import { NEED_EMOJI } from '@/lib/emoji';

// Minimum-rank options per need. Ranks mirror level_rank() in SQL.
export const FILTER_OPTIONS = {
  kosher: [
    { label: 'כל השגחה', en: 'Any supervision', min: 0 },
    { label: 'רבנות ומעלה', en: 'Rabbinate and up', min: 1 },
    { label: 'מהדרין ומעלה', en: 'Mehadrin and up', min: 2 },
    { label: 'בד״ץ', en: 'Badatz', min: 3 },
  ],
  vegan: [
    { label: 'יש מנות', en: 'Has vegan dishes', min: 1 },
    { label: 'טבעוני לגמרי', en: 'Fully vegan', min: 2 },
  ],
  gluten_free: [
    { label: 'יש תפריט', en: 'Has a menu', min: 1 },
    { label: 'מטבח נפרד', en: 'Separate kitchen', min: 2 },
  ],
  ...Object.fromEntries(EXTRA_NEEDS.map((n) => [n, [
    { label: 'יש מנות', en: 'Has dishes', min: 1 },
    { label: 'כל המקום', en: 'The whole place', min: 2 },
  ]])),
} as Record<Need, { label: string; en: string; min: number }[]>;

interface Props {
  filter: NeedFilter;
  openNow: boolean;
  onFilter: (f: NeedFilter) => void;
  onOpenNow: (v: boolean) => void;
  cuisine: string | null;
  onCuisine: (c: string | null) => void;
}

export default function FilterBar({ filter, openNow, onFilter, onOpenNow, cuisine, onCuisine }: Props) {
  const L = useL();
  const lang = L.lang;
  const toggle = (n: Need) =>
    onFilter({ ...filter, [n]: (filter[n] ?? null) === null ? FILTER_OPTIONS[n][0].min : null });
  const extraOn = EXTRA_NEEDS.filter((n) => (filter[n] ?? null) !== null).length;
  const [more, setMore] = useState(extraOn > 0);

  return (
    <div className="filters">
      <div className="cuisines" role="radiogroup" aria-label={L('סוג אוכל', 'Type of food')}>
        <button type="button" role="radio" aria-checked={cuisine === null} className="cuisine" onClick={() => onCuisine(null)}>
          <span className="ce" aria-hidden="true">🍽️</span>
          <span>{L('הכול', 'All')}</span>
        </button>
        {CUISINE_FILTERS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cuisine === c} className="cuisine" onClick={() => onCuisine(cuisine === c ? null : c)}>
            <span className="ce" aria-hidden="true">{CUISINES[c].emoji}</span>
            <span>{lang === 'en' ? CUISINES[c].en : CUISINES[c].label}</span>
          </button>
        ))}
      </div>
      <div className="chips">
        {MAIN_NEEDS.map((n) => (
          <button key={n} type="button" className={`chip ${NEED_CLASS[n]}`} aria-pressed={filter[n] !== null} onClick={() => toggle(n)}>
            <span className="mini" aria-hidden="true">{needLetter(n, lang)}</span>
            {needLabel(n, lang)}
          </button>
        ))}
        <button type="button" className="chip o" aria-pressed={openNow} onClick={() => onOpenNow(!openNow)}>
          <span className="dot" aria-hidden="true" />
          {L('פתוח עכשיו', 'Open now')} <span aria-hidden="true">🕐</span>
        </button>
        <button type="button" className="chip more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          <span aria-hidden="true">🥜</span> {L('צמחוני ואלרגיות', 'Vegetarian & allergies')}{extraOn > 0 && <span className="count">{extraOn}</span>}
        </button>
      </div>
      {more && (
        <div className="chips extra-chips">
          {EXTRA_NEEDS.map((n) => (
            <button key={n} type="button" className={`chip ${NEED_CLASS[n]}`} aria-pressed={(filter[n] ?? null) !== null} onClick={() => toggle(n)}>
              <span aria-hidden="true">{NEED_EMOJI[n]}</span> {needLabel(n, lang)}
            </button>
          ))}
        </div>
      )}

      {NEED_ORDER.filter((n) => (filter[n] ?? null) !== null).map((n) => (
        <div className="seg-row" key={n}>
          <span className="lbl" id={`lvl-${n}`}>{needLabel(n, lang)}</span>
          <div className="seg" role="group" aria-labelledby={`lvl-${n}`}>
            {FILTER_OPTIONS[n].map((o) => (
              <button key={o.min} type="button" aria-pressed={filter[n] === o.min} onClick={() => onFilter({ ...filter, [n]: o.min })}>
                {lang === 'en' ? o.en : o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
