'use client';

import { needLabel, needLetter, type Need, type NeedFilter } from '@/lib/types';
import { useL } from './LangProvider';
import { useState } from 'react';
import { EXTRA_NEEDS, MAIN_NEEDS, NEED_CLASS, NEED_ORDER, TWO_LEVEL_NEEDS } from '@/lib/claims';
import { CUISINES, CUISINE_FILTERS } from '@/lib/cuisine';
import { NEED_EMOJI } from '@/lib/emoji';
import { FILTER_OPTIONS } from '@/lib/filters';

export { FILTER_OPTIONS };

interface Props {
  filter: NeedFilter;
  openNow: boolean;
  onFilter: (f: NeedFilter) => void;
  onOpenNow: (v: boolean) => void;
  cuisine: string[];
  onCuisine: (c: string[]) => void;
}

export default function FilterBar({ filter, openNow, onFilter, onOpenNow, cuisine, onCuisine }: Props) {
  const L = useL();
  const lang = L.lang;
  const toggle = (n: Need) =>
    onFilter({ ...filter, [n]: (filter[n] ?? null) === null ? FILTER_OPTIONS[n][0].min : null });
  const extraOn = EXTRA_NEEDS.filter((n) => (filter[n] ?? null) !== null).length;
  const [more, setMore] = useState(extraOn > 0);
  const hidden = extraOn + (openNow ? 1 : 0) + (cuisine.length > 0 ? 1 : 0);
  const [open, setOpen] = useState(hidden > 0);

  return (
    <div className="filters">
      <div className="chips main-chips">
        {MAIN_NEEDS.map((n) => (
          <button key={n} type="button" className={`chip ${NEED_CLASS[n]}`} aria-pressed={filter[n] !== null} onClick={() => toggle(n)}>
            <span className="mini" aria-hidden="true">{needLetter(n, lang)}</span>
            {needLabel(n, lang)}
          </button>
        ))}
      </div>
      <button type="button" className="more-filters" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">🎛️</span> {L('עוד סינונים', 'More filters')}{hidden > 0 && <span className="count">{hidden}</span>}
        <span className="more-arrow" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="filters-more">
      <div className="cuisines" role="group" aria-label={L('סוג אוכל, אפשר לבחור כמה', 'Type of food, choose as many as you like')}>
        <button type="button" aria-pressed={cuisine.length === 0} className="cuisine" onClick={() => onCuisine([])}>
          <span className="ce" aria-hidden="true">🍽️</span>
          <span>{L('הכול', 'All')}</span>
        </button>
        {CUISINE_FILTERS.map((c) => (
          <button key={c} type="button" aria-pressed={cuisine.includes(c)} className="cuisine" onClick={() => onCuisine(cuisine.includes(c) ? cuisine.filter((x) => x !== c) : [...cuisine, c])}>
            <span className="ce" aria-hidden="true">{CUISINES[c].emoji}</span>
            <span>{lang === 'en' ? CUISINES[c].en : CUISINES[c].label}</span>
          </button>
        ))}
      </div>
          <div className="chips">
        <button type="button" className="chip o" aria-pressed={openNow} onClick={() => onOpenNow(!openNow)}>
          <span className="dot" aria-hidden="true" />
          {L('פתוח עכשיו', 'Open now')} <span aria-hidden="true">🕐</span>
        </button>
        <button type="button" className="chip more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          <span aria-hidden="true">🥜</span> {L('אלרגיות', 'Allergies')}{extraOn > 0 && <span className="count">{extraOn}</span>}
        </button>
          </div>
      {more && (
        <>
        <p className="allergy-note">{L('המידע לא מחליף בדיקה. באלרגיה תמיד שאלו במקום לפני שאוכלים.', 'This does not replace checking. With an allergy, always ask on site before eating.')}</p>
        <div className="chips extra-chips">
          {EXTRA_NEEDS.map((n) => (
            <button key={n} type="button" className={`chip ${NEED_CLASS[n]}`} aria-pressed={(filter[n] ?? null) !== null} onClick={() => toggle(n)}>
              <span aria-hidden="true">{NEED_EMOJI[n]}</span> {needLabel(n, lang)}
            </button>
          ))}
        </div>
        </>
      )}
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
