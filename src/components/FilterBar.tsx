'use client';

import { NEED_LABELS, type Need, type NeedFilter } from '@/lib/types';
import { NEED_CLASS, NEED_ORDER } from '@/lib/claims';
import { CUISINES, CUISINE_FILTERS } from '@/lib/cuisine';

// Minimum-rank options per need. Ranks mirror level_rank() in SQL.
export const FILTER_OPTIONS: Record<Need, { label: string; min: number }[]> = {
  kosher: [
    { label: 'כל השגחה', min: 0 },
    { label: 'רבנות ומעלה', min: 1 },
    { label: 'מהדרין ומעלה', min: 2 },
    { label: 'בד״ץ', min: 3 },
  ],
  vegan: [
    { label: 'יש מנות', min: 1 },
    { label: 'טבעוני לגמרי', min: 2 },
  ],
  gluten_free: [
    { label: 'יש תפריט', min: 1 },
    { label: 'מטבח נפרד', min: 2 },
  ],
};

interface Props {
  filter: NeedFilter;
  openNow: boolean;
  onFilter: (f: NeedFilter) => void;
  onOpenNow: (v: boolean) => void;
  cuisine: string | null;
  onCuisine: (c: string | null) => void;
}

export default function FilterBar({ filter, openNow, onFilter, onOpenNow, cuisine, onCuisine }: Props) {
  const toggle = (n: Need) =>
    onFilter({ ...filter, [n]: filter[n] === null ? FILTER_OPTIONS[n][0].min : null });

  return (
    <div className="filters">
      <div className="cuisines" role="radiogroup" aria-label="סוג אוכל">
        <button type="button" role="radio" aria-checked={cuisine === null} className="cuisine" onClick={() => onCuisine(null)}>
          <span className="ce" aria-hidden="true">🍽️</span>
          <span>הכול</span>
        </button>
        {CUISINE_FILTERS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cuisine === c} className="cuisine" onClick={() => onCuisine(cuisine === c ? null : c)}>
            <span className="ce" aria-hidden="true">{CUISINES[c].emoji}</span>
            <span>{CUISINES[c].label}</span>
          </button>
        ))}
      </div>
      <div className="chips">
        {NEED_ORDER.map((n) => (
          <button key={n} type="button" className={`chip ${NEED_CLASS[n]}`} aria-pressed={filter[n] !== null} onClick={() => toggle(n)}>
            <span className="mini" aria-hidden="true">{NEED_LABELS[n].letter}</span>
            {NEED_LABELS[n].label}
          </button>
        ))}
        <button type="button" className="chip o" aria-pressed={openNow} onClick={() => onOpenNow(!openNow)}>
          <span className="dot" aria-hidden="true" />
          פתוח עכשיו <span aria-hidden="true">🕐</span>
        </button>
      </div>

      {NEED_ORDER.filter((n) => filter[n] !== null).map((n) => (
        <div className="seg-row" key={n}>
          <span className="lbl" id={`lvl-${n}`}>{NEED_LABELS[n].label}</span>
          <div className="seg" role="group" aria-labelledby={`lvl-${n}`}>
            {FILTER_OPTIONS[n].map((o) => (
              <button key={o.min} type="button" aria-pressed={filter[n] === o.min} onClick={() => onFilter({ ...filter, [n]: o.min })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
