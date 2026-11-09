'use client';

import { useState } from 'react';
import { CUISINES, CUISINE_GROUPS } from '@/lib/cuisine';
import { useL } from './LangProvider';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  /** most kinds one place can have */
  max?: number;
}

/**
 * Picking the kind of food without thinking twice: the groups people know (dishes, meat, sweets,
 * community kitchens, world kitchens), big emoji chips, and a search box for the one you have in mind.
 */
export default function CuisinePicker({ value, onChange, max = 6 }: Props) {
  const L = useL();
  const lang = L.lang;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string>('dishes');
  const label = (c: string) => (lang === 'en' ? CUISINES[c].en : CUISINES[c].label);
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : value.length < max ? [...value, c] : value);
  const term = q.trim().toLowerCase();
  const found = term ? Object.keys(CUISINES).filter((c) => CUISINES[c].label.includes(term) || CUISINES[c].en.toLowerCase().includes(term)) : [];

  const chip = (c: string) => (
    <button key={c} type="button" className="cz-chip" aria-pressed={value.includes(c)} onClick={() => toggle(c)} disabled={!value.includes(c) && value.length >= max}>
      <span className="cz-emoji" aria-hidden="true">{CUISINES[c].emoji}</span>
      <span>{label(c)}</span>
    </button>
  );

  return (
    <fieldset className="cz">
      <legend>{L(`סוג האוכל, אפשר לבחור עד ${max}`, `Kind of food, up to ${max}`)}</legend>
      {value.length > 0 && (
        <div className="cz-picked" aria-label={L('נבחרו', 'Chosen')}>
          {value.map((c) => CUISINES[c] && (
            <button key={c} type="button" className="cz-tag" onClick={() => toggle(c)} aria-label={L(`הסרת ${label(c)}`, `Remove ${label(c)}`)}>
              <span aria-hidden="true">{CUISINES[c].emoji}</span> {label(c)} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
      <input type="search" className="cz-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('חיפוש: שניצל, תימני, סושי…', 'Search: schnitzel, Yemeni, sushi…')} aria-label={L('חיפוש סוג אוכל', 'Search a kind of food')} />
      {term ? (
        <div className="cz-chips">{found.length ? found.map(chip) : <p className="muted small">{L('לא מצאנו. נסו מילה אחרת.', 'Nothing found. Try another word.')}</p>}</div>
      ) : (
        <>
          <div className="cz-groups" role="tablist" aria-label={L('קבוצות', 'Groups')}>
            {CUISINE_GROUPS.map((g) => {
              const n = g.items.filter((c) => value.includes(c)).length;
              return (
                <button key={g.id} type="button" role="tab" aria-selected={open === g.id} onClick={() => setOpen(g.id)}>
                  {lang === 'en' ? g.en : g.label}{n > 0 && <b>{n}</b>}
                </button>
              );
            })}
          </div>
          <div className="cz-chips" role="tabpanel">{CUISINE_GROUPS.find((g) => g.id === open)!.items.map(chip)}</div>
        </>
      )}
    </fieldset>
  );
}
