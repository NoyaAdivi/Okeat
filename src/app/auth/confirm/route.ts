import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// The link in the sign-in email lands here. Mail apps and security scanners often open links on
// their own, which would use up the one-time link, so opening it only shows a button.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  if (!tokenHash) return NextResponse.redirect(`${origin}/map?auth_error=1`);
  return NextResponse.redirect(`${origin}/auth/enter?token_hash=${encodeURIComponent(tokenHash)}`);
}

// The button on /auth/enter. It works in any browser, also when a mail app opens the link somewhere else.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = form.get('token_hash');

  if (typeof tokenHash === 'string' && tokenHash) {
    const sb = await createClient();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (!error) return NextResponse.redirect(`${origin}/map?signed_in=1`, 303);
  }
  return NextResponse.redirect(`${origin}/map?auth_error=1`, 303);
}
