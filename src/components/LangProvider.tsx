'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, dirOf, pick, type Lang } from '@/lib/lang';

interface LangState { lang: Lang; setLang: (l: Lang) => void }

const LangContext = createContext<LangState>({ lang: 'he', setLang: () => {} });

/** Holds the language for client components. Switching saves a cookie and re-renders the server parts. */
export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const router = useRouter();
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
    setLangState(l);
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** const L = useL(); L('שלום', 'Hello') — L.lang is the current language */
export function useL() {
  const { lang } = useLang();
  return useMemo(() => Object.assign((he: string, en: string) => pick(lang, he, en), { lang }), [lang]);
}
