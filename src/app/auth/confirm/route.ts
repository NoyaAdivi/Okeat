import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// The link in the sign-in email lands here. Unlike a code exchange, it works in any browser,
// so it also works when a mail app opens the link somewhere else.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');

  if (tokenHash) {
    const sb = await createClient();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (!error) return NextResponse.redirect(`${origin}/map`);
  }

  return NextResponse.redirect(`${origin}/map?auth_error=1`);
}
