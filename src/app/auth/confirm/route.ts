import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const COOKIE = 'okeat_login';

// The link in the sign-in email lands here. Mail apps and security scanners often open links on
// their own, which would use up the one-time link, so opening it only shows a button. The token
// moves to a short private cookie, so it stays out of the address bar and the browser history.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  if (!tokenHash) return NextResponse.redirect(`${origin}/map?auth_error=1`);
  const res = NextResponse.redirect(`${origin}/auth/enter`);
  res.cookies.set(COOKIE, tokenHash, { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth', maxAge: 600 });
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

// The button on /auth/enter.
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const tokenHash = request.cookies.get(COOKIE)?.value;
  let target = `${origin}/map?auth_error=1&why=no_cookie`;

  if (tokenHash) {
    const sb = await createClient();
    // first-time and returning accounts get different kinds of token
    for (const type of ['email', 'magiclink', 'signup'] as const) {
      const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) { target = `${origin}/map?signed_in=1`; break; }
      target = `${origin}/map?auth_error=1&why=${encodeURIComponent(error.code ?? error.message.slice(0, 60))}`;
    }
  }
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(COOKIE, '', { path: '/auth', maxAge: 0 });
  return res;
}
