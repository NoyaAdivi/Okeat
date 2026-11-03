'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useL } from './LangProvider';

const EVENT = 'okeat-signed-in';

/** Call after a sign-in that stays on the page. A sign-in that comes back from elsewhere adds ?signed_in=1. */
export const announceSignedIn = () => window.dispatchEvent(new Event(EVENT));

/** A short, happy note after signing in. New accounts are welcomed, returning ones greeted. */
export default function SignedInNote() {
  const L = useL();
  const [note, setNote] = useState('');

  useEffect(() => {
    const show = async () => {
      const { data } = await createClient().auth.getUser();
      if (!data.user || data.user.is_anonymous) return;
      const isNew = Date.now() - new Date(data.user.created_at).getTime() < 5 * 60_000;
      setNote(isNew
        ? L('נרשמת בהצלחה! ברוכים הבאים ל-Okeat 🎉', 'You signed up! Welcome to Okeat 🎉')
        : L('התחברת בהצלחה! כיף לראות אותך שוב 🎉', 'You signed in! Good to see you again 🎉'));
      setTimeout(() => setNote(''), 4500);
    };

    const url = new URL(window.location.href);
    if (url.searchParams.has('signed_in')) {
      url.searchParams.delete('signed_in');
      window.history.replaceState(null, '', url);
      show();
    }
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return note ? <div className="signed-in-note" role="status">{note}</div> : null;
}
