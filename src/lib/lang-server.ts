import { cookies } from 'next/headers';
import { LANG_COOKIE, isLang, pick, type Lang } from './lang';

/** The visitor's language on the server (from the cookie the language switch sets). Hebrew by default. */
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : 'he';
}

/** For server pages: const L = await serverL(); L('שלום', 'Hello') */
export async function serverL() {
  const lang = await getLang();
  const L = (he: string, en: string) => pick(lang, he, en);
  return Object.assign(L, { lang });
}
