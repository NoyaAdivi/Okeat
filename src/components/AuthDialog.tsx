'use client';

import { useL } from './LangProvider';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import { friendly } from '@/lib/errors';

interface Props {
  sb: SupabaseClient;
  /** Why we're asking, e.g. "כדי לאשר מידע צריך להתחבר." */
  reason?: string;
  onClose: () => void;
}

const callbackUrl = () =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;

export default function AuthDialog({ sb, reason, onClose }: Props) {
  const L = useL();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const google = async () => {
    setError('');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
    if (error) setError(friendly(error, L.lang));
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(L('כתובת המייל לא נראית תקינה.', "That email address doesn't look right."));
      return;
    }
    setState('sending');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callbackUrl() } });
    if (error) {
      setState('idle');
      setError(friendly(error, L.lang));
    } else {
      setState('sent');
    }
  };

  if (state === 'sent') {
    return (
      <Modal title={L('בדקו את המייל', 'Check your email')} onClose={onClose}>
        <p style={{ margin: 0 }}>
          {L('שלחנו קישור התחברות ל-', 'We sent a sign-in link to ')}<b dir="ltr">{email.trim()}</b>{L('. לחיצה עליו תחזיר אתכם לכאן, מחוברים.', '. Clicking it brings you back here, signed in.')}
        </p>
        <div className="modal-acts">
          <button type="button" className="btn" onClick={() => setState('idle')}>{L('שליחה לכתובת אחרת', 'Send to another address')}</button>
          <button type="button" className="btn primary" onClick={onClose}>{L('סגירה', 'Close')}</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={L('התחברות', 'Sign in')} subtitle={reason ?? L('ההתחברות לא חובה. היא שומרת את מה שהוספת ואישרת, גם כשנכנסים ממכשיר אחר.', "Signing in is optional. It keeps what you added and confirmed, even on another device.")} onClose={onClose}>
      <button type="button" className="btn google" onClick={google}>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        {L('המשך עם Google', 'Continue with Google')}
      </button>
      <div className="or"><span>{L('או', 'or')}</span></div>
      <form onSubmit={sendLink} className="field" noValidate>
        <label htmlFor="auth-email">{L('קישור התחברות למייל', 'Sign-in link by email')}</label>
        <input id="auth-email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <div className="err" role="alert">{error}</div>}
        <div className="modal-acts">
          <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
          <button type="submit" className="btn primary" disabled={state === 'sending'}>
            {state === 'sending' ? L('שולח…', 'Sending…') : L('שליחת קישור', 'Send link')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
