'use client';

import { useEffect, useState } from 'react';

type Tone = 'ok' | 'warn' | 'info';

const OK = /תודה|נשמר|נשלח|אושר|הועתק|נוסף|נוצר|נמחק|הוסר|בוטל|טופל|התנתקת|thanks|saved|sent|approved|copied|added|created|deleted|removed|handled|signed out/i;
const WARN = /לא הצלח|לא נשמר|נכשל|שגיאה|נסו שוב|לא ניתן|אין חיבור|failed|error|couldn|try again|wasn't|not saved/i;

/** How a message feels, from its words: a thank-you is green, a problem is warm, the rest is calm. */
export const toneOf = (text: string): Tone => (WARN.test(text) ? 'warn' : OK.test(text) ? 'ok' : 'info');
const ICON: Record<Tone, string> = { ok: '✓', warn: '!', info: 'i' };

/** The short message that slides in after an action. It keeps its text while it slides away. */
export default function Toast({ text }: { text: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => { if (text) setShown(text); }, [text]);
  const tone = toneOf(shown);
  return (
    <div className={`toast ${tone}${text ? ' show' : ''}`} role="status" aria-live="polite">
      {shown && (
        <>
          <span className="toast-ic" aria-hidden="true">{ICON[tone]}</span>
          <span className="toast-text">{shown}</span>
          {text && <span key={text} className="toast-bar" aria-hidden="true" />}
        </>
      )}
    </div>
  );
}
