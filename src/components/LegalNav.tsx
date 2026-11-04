'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useL } from './LangProvider';

/** Jump links at the top of a long page, built from its own headings. */
export default function LegalNav() {
  const L = useL();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const title = document.querySelector('.prose > h1');
    if (!title) return;
    const box = document.createElement('div');
    title.after(box);
    setItems([...document.querySelectorAll<HTMLElement>('.prose > h2')].map((h, i) => {
      h.id ||= `part-${i + 1}`;
      return { id: h.id, text: h.textContent ?? '' };
    }));
    setHost(box);
    return () => box.remove();
  }, [L.lang]);

  if (!host || items.length < 3) return null;
  return createPortal(
    <nav className="legal-nav" aria-label={L('בדף הזה', 'On this page')}>
      {items.map((i) => <a key={i.id} href={`#${i.id}`}>{i.text}</a>)}
    </nav>,
    host,
  );
}
