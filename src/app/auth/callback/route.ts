import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Google sign-in and email magic links both land here with ?code=...
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';
  // only same-site paths, never "//evil.com"
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const sep = next.includes('?') ? '&' : '?';
  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}${sep}signed_in=1`);
  }

  // Google said no or the person went back: the map explains it and offers to try again.
  return NextResponse.redirect(`${origin}/map?auth_error=1&why=google`);
}
