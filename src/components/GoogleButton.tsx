'use client';

import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useL } from './LangProvider';

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleId {
  accounts: {
    id: {
      initialize: (options: { client_id: string; nonce: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

interface Props {
  sb: SupabaseClient;
  onDone: () => void;
  onError: (error: Error) => void;
  /** Google's script didn't load: the dialog goes back to the regular sign-in button. */
  onUnavailable: () => void;
}

const SCRIPT = 'https://accounts.google.com/gsi/client';

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT}"]`)) {
      const started = Date.now();
      const check = setInterval(() => {
        if ('google' in window) { clearInterval(check); resolve(); }
        else if (Date.now() - started > 5000) { clearInterval(check); reject(new Error('Google did not load')); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google did not load'));
    document.head.append(script);
  });
}

/** Google's own button: the sign-in window names this site and not the database address behind it. */
export default function GoogleButton({ sb, onDone, onError, onUnavailable }: Props) {
  const L = useL();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The raw value goes to our sign-in service and its hash to Google, so a token can't be reused.
      const nonce = crypto.randomUUID();
      const hashed = await sha256(nonce);
      await loadScript();
      const google = (window as unknown as { google?: GoogleId }).google;
      if (cancelled || !box.current || !google || !GOOGLE_CLIENT_ID) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: hashed,
        callback: async ({ credential }) => {
          const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
          if (error) onError(error);
          else onDone();
        },
      });
      google.accounts.id.renderButton(box.current, {
        theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with',
        locale: L.lang, width: Math.min(box.current.clientWidth || 320, 400),
      });
    })().catch(() => { if (!cancelled) onUnavailable(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={box} className="gis-box" />;
}
