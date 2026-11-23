import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { LANG_COOKIE, isLang } from '@/lib/lang';

export async function middleware(request: NextRequest) {
  // ?lang=en or ?lang=he picks the language from a link (used for the Google review links too).
  const q = request.nextUrl.searchParams.get('lang');
  const lang = isLang(q) ? q : null;
  if (lang) request.cookies.set(LANG_COOKIE, lang);
  const response = await updateSession(request);
  if (lang) response.cookies.set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export const config = {
  // everything except static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
