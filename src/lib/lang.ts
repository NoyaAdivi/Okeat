// Two languages: Hebrew (default, right-to-left) and English.
// The choice is kept in a cookie so the server renders the right language on the first paint.

export type Lang = 'he' | 'en';

export const LANG_COOKIE = 'okeat-lang';

export const isLang = (v: unknown): v is Lang => v === 'he' || v === 'en';

export const dirOf = (lang: Lang) => (lang === 'he' ? 'rtl' : 'ltr');

/** The text in the current language: L(lang, 'שלום', 'Hello'). */
export const pick = (lang: Lang, he: string, en: string) => (lang === 'en' ? en : he);
