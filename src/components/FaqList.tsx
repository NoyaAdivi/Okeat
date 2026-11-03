'use client';

import { useMemo, useState } from 'react';
import { useL } from './LangProvider';

export interface FaqItem { q: string; a: string; group: string }
interface Props { items: FaqItem[]; groups: { id: string; emoji: string; label: string }[] }

/** Questions by topic, with a search. Opening one closes the others. */
export default function FaqList({ items, groups }: Props) {
  const L = useL();
  const [group, setGroup] = useState(groups[0].id);
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (text) return items.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(text));
    return items.filter((f) => f.group === group);
  }, [items, group, search]);

  return (
    <div className="faq-box">
      <input className="faq-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L('חיפוש בשאלות', 'Search the questions')} aria-label={L('חיפוש בשאלות', 'Search the questions')} />
      {!search.trim() && (
        <div className="faq-groups" role="tablist" aria-label={L('נושאים', 'Topics')}>
          {groups.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}><span aria-hidden="true">{g.emoji}</span> {g.label}</button>
          ))}
        </div>
      )}
      <div key={search.trim() ? 'search' : group} className="faq">
        {shown.length === 0 && <p className="muted">{L('לא מצאנו שאלה כזו. אפשר לכתוב לנו ביצירת קשר.', "We didn't find that. You can ask us through the contact form.")}</p>}
        {shown.map((f) => (
          <details key={f.q} name="faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
