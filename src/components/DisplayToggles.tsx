'use client';

import { useEffect, useState } from 'react';
import { applyPrefs, isDarkNow, loadPrefs, savePrefs } from '@/lib/prefs';
import { useLang } from './LangProvider';

/** Language switch (עברית / English) and light / dark mode, shown in the headers. */
export default function DisplayToggles({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDarkNow());
    const sync = () => setDark(isDarkNow());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('okeat-prefs', sync);
    mq.addEventListener('change', sync);
    return () => { window.removeEventListener('okeat-prefs', sync); mq.removeEventListener('change', sync); };
  }, []);

  const toggleTheme = () => {
    const next = { ...loadPrefs(), theme: isDarkNow() ? 'light' as const : 'dark' as const };
    savePrefs(next);
    applyPrefs(next);
    setDark(next.theme === 'dark');
  };

  const other = lang === 'he' ? 'en' : 'he';
  return (
    <div className={`display-toggles${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className="dt-btn"
        onClick={() => setLang(other)}
        lang={other}
        aria-label={lang === 'he' ? 'Switch to English' : 'מעבר לעברית'}
        title={lang === 'he' ? 'Switch to English' : 'מעבר לעברית'}
      >
        <span aria-hidden="true">🌐</span>{!compact && <span>{lang === 'he' ? 'EN' : 'עב'}</span>}
      </button>
      <button
        type="button"
        className="dt-btn theme"
        onClick={toggleTheme}
        aria-pressed={dark}
        aria-label={lang === 'he' ? 'מצב כהה' : 'Dark mode'}
        title={lang === 'he' ? (dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה') : (dark ? 'Switch to light mode' : 'Switch to dark mode')}
      >
        <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
      </button>
    </div>
  );
}
