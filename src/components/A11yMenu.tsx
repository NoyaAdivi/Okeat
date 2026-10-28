'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PREFS, applyPrefs, loadPrefs, savePrefs, type Prefs, type ThemePref } from '@/lib/prefs';
import { readableText, speak, speechSupported, stopSpeaking } from '@/lib/speech';

const SIZES = [1, 1.15, 1.3, 1.5];

/** Accessibility menu, available on every page from a tab on the side of the screen. */
export default function A11yMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [clickToRead, setClickToRead] = useState(false);
  const [reading, setReading] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setPrefs(loadPrefs()), []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
    applyPrefs(next);
  };

  // Close on Esc and on outside click.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // "Read on click": read the text of whatever the person clicks.
  useEffect(() => {
    if (!clickToRead) return;
    document.documentElement.setAttribute('data-click-read', '');
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.a11y')) return;
      const el = t.closest('h1, h2, h3, h4, p, li, button, a, label, dd, dt, summary, .nm, .lv, .note, .badge, .chip, span') as HTMLElement | null;
      if (el) speak(readableText(el));
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.documentElement.removeAttribute('data-click-read');
      document.removeEventListener('click', onClick, true);
    };
  }, [clickToRead]);

  const readPage = () => {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    const root = document.querySelector('[data-read-root]') ?? document.querySelector('main') ?? document.body;
    speak(readableText(root));
    setReading(true);
    const poll = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setReading(false);
        clearInterval(poll);
      }
    }, 500);
  };

  const sizeIndex = Math.max(0, SIZES.indexOf(prefs.scale));
  const themes: { v: ThemePref; label: string; icon: string }[] = [
    { v: 'auto', label: 'אוטומטי', icon: '🌗' },
    { v: 'light', label: 'בהיר', icon: '☀️' },
    { v: 'dark', label: 'כהה', icon: '🌙' },
  ];

  return (
    <div className="a11y">
      <button
        ref={button}
        type="button"
        className="a11y-tab"
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((o) => !o)}
        aria-label="תפריט נגישות"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2" /><path d="M5 8l7 1.5L19 8M12 9.5V14l-3 7M12 14l3 7" /></svg>
      </button>

      {open && (
        <div id="a11y-panel" ref={panel} className="a11y-panel" role="dialog" aria-label="הגדרות נגישות">
          <div className="a11y-head">
            <h2>נגישות</h2>
            <button type="button" className="link" onClick={() => setOpen(false)} aria-label="סגירה">✕</button>
          </div>

          <div className="a11y-group">
            <span className="a11y-label">גודל טקסט</span>
            <div className="a11y-row">
              <button type="button" className="a11y-btn" onClick={() => update({ scale: SIZES[Math.max(0, sizeIndex - 1)] })} disabled={sizeIndex === 0} aria-label="הקטנת טקסט">א-</button>
              <span className="a11y-val" aria-live="polite">{Math.round(prefs.scale * 100)}%</span>
              <button type="button" className="a11y-btn" onClick={() => update({ scale: SIZES[Math.min(SIZES.length - 1, sizeIndex + 1)] })} disabled={sizeIndex === SIZES.length - 1} aria-label="הגדלת טקסט">א+</button>
            </div>
          </div>

          <div className="a11y-group">
            <span className="a11y-label">מצב תצוגה</span>
            <div className="a11y-row" role="radiogroup" aria-label="מצב תצוגה">
              {themes.map((t) => (
                <button key={t.v} type="button" role="radio" aria-checked={prefs.theme === t.v} className="a11y-btn" onClick={() => update({ theme: t.v })}>
                  <span aria-hidden="true">{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {speechSupported() && (
            <div className="a11y-group">
              <span className="a11y-label">הקראה</span>
              <div className="a11y-row">
                <button type="button" className="a11y-btn" aria-pressed={reading} onClick={readPage}>
                  <span aria-hidden="true">{reading ? '⏹️' : '🔊'}</span> {reading ? 'עצירה' : 'הקראת הדף'}
                </button>
                <button type="button" className="a11y-btn" aria-pressed={clickToRead} onClick={() => { setClickToRead((v) => !v); stopSpeaking(); }}>
                  <span aria-hidden="true">👆</span> הקראה בלחיצה
                </button>
              </div>
            </div>
          )}

          <div className="a11y-toggles">
            <Toggle label="ניגודיות גבוהה" icon="◐" on={prefs.contrast} onChange={(v) => update({ contrast: v })} />
            <Toggle label="עצירת אנימציות" icon="⏸️" on={prefs.stillMotion} onChange={(v) => update({ stillMotion: v })} />
            <Toggle label="הדגשת קישורים" icon="🔗" on={prefs.underline} onChange={(v) => update({ underline: v })} />
            <Toggle label="גופן קריא" icon="🔤" on={prefs.readableFont} onChange={(v) => update({ readableFont: v })} />
          </div>

          <div className="a11y-foot">
            <button type="button" className="link" onClick={() => { update(DEFAULT_PREFS); setClickToRead(false); stopSpeaking(); }}>איפוס הגדרות</button>
            <Link className="link" href="/accessibility">הצהרת נגישות</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, icon, on, onChange }: { label: string; icon: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="a11y-toggle" onClick={() => onChange(!on)}>
      <span className="ic" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <span className="sw" aria-hidden="true" />
    </button>
  );
}
