'use client';

import { useEffect, useMemo } from 'react';
import { useL } from '@/components/LangProvider';
import { takeGoogleState } from '@/components/GoogleButton';
import { createClient } from '@/lib/supabase/client';

/** Google sends the phone back here with a signed note saying who this is. */
export default function GoogleReturn() {
  const L = useL();
  const sb = useMemo(() => createClient(), []);

  useEffect(() => {
    const failed = () => location.replace('/map?auth_error=1&why=google');
    const token = new URLSearchParams(location.hash.slice(1)).get('id_token');
    const saved = takeGoogleState();
    if (!token || !saved) return failed();
    history.replaceState(null, '', location.pathname); // the note should not stay in the address bar
    sb.auth.signInWithIdToken({ provider: 'google', token, nonce: saved.nonce }).then(({ error }) => {
      if (error) return failed();
      const next = saved.next.startsWith('/') && !saved.next.startsWith('//') ? saved.next : '/';
      location.replace(`${next}${next.includes('?') ? '&' : '?'}signed_in=1`);
    }, failed);
  }, [sb]);

  return <p className="center muted" style={{ padding: '30vh 16px' }}>{L('מתחברים…', 'Signing in…')}</p>;
}
