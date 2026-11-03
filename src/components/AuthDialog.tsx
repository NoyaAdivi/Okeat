'use client';

import { useL } from './LangProvider';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import { friendly } from '@/lib/errors';
import GoogleButton, { GOOGLE_CLIENT_ID } from './GoogleButton';
import { announceSignedIn } from './SignedInNote';

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
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [googleOld, setGoogleOld] = useState(false);
  const [mailBusy, setMailBusy] = useState<'hour' | 'day' | null>(null);

  // The shared email service allows only a few messages an hour.
  const authMessage = (e: Error) => {
    if (/only request this after/i.test(e.message)) return L('כבר שלחנו לכם מייל. בדקו בתיבה ובספאם, או נסו שוב בעוד דקה.', 'We already sent you an email. Check your inbox and spam, or try again in a minute.');
    if (/not authorized/i.test(e.message)) return L('כניסה במייל לא זמינה כרגע. אפשר להמשיך עם Google.', "Email sign-in isn't available right now. Please continue with Google.");
    return friendly(e, L.lang);
  };

  // A code works in any browser, unlike a link that opens somewhere else.
  const checkCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setChecking(true);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setChecking(false);
    if (error) setError(L('הקוד לא נכון או שפג תוקפו. אפשר לבקש קוד חדש.', 'That code is wrong or has expired. You can ask for a new one.'));
    else { announceSignedIn(); onClose(); }
  };

  const google = async () => {
    setError('');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
    if (error) setError(friendly(error, L.lang));
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMailBusy(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(L('כתובת המייל לא נראית תקינה.', "That email address doesn't look right."));
      return;
    }
    setState('sending');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callbackUrl() } });
    if (error) {
      setState('idle');
      // The hourly limit, or sending failed on the mail side (a used-up daily quota looks the same as other failures).
      const hourly = /rate limit|over_email/i.test(error.message) && !/only request this after/i.test(error.message);
      const daily = /error sending|smtp|unexpected/i.test(error.message) || (error as Error & { status?: number }).status === 500;
      if (hourly || daily) setMailBusy(hourly ? 'hour' : 'day');
      else setError(authMessage(error));
    } else {
      setCode('');
      setState('sent');
    }
  };

  if (state === 'sent') {
    return (
      <Modal title={L('בדקו את המייל', 'Check your email')} onClose={onClose}>
        <p style={{ margin: 0 }}>
          {L('שלחנו מייל התחברות ל-', 'We sent a sign-in email to ')}<b dir="ltr">{email.trim()}</b>{L('. לחצו על הכפתור שבמייל, או כתבו כאן את הקוד.', '. Press the button in the email, or enter the code here.')}
        </p>
        <p className="muted small" style={{ margin: '8px 0 0' }}>{L('לא מוצאים את המייל? בדקו בספאם ובקידומי מכירות. לפעמים הוא מגיע אחרי דקה או שתיים.', "Can't find the email? Check your spam and promotions folders. It can take a minute or two.")}</p>
        <form onSubmit={checkCode} className="field" noValidate>
          <label htmlFor="auth-code">{L('אם קיבלתם קוד במייל, כתבו אותו כאן', 'If the email has a code, enter it here')}</label>
          <input id="auth-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          {error && <div className="err" role="alert">{error}</div>}
          <div className="modal-acts">
            <button type="button" className="btn" onClick={() => { setError(''); setState('idle'); }}>{L('שליחה מחדש', 'Send again')}</button>
            <button type="submit" className="btn primary" disabled={checking || code.length < 6}>{checking ? L('בודק…', 'Checking…') : L('כניסה', 'Sign in')}</button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal title={L('התחברות', 'Sign in')} subtitle={reason ?? L('כדי להוסיף, לאשר או לדווח צריך חשבון. ההתחברות גם שומרת את מה שעשית, בכל מכשיר.', 'You need an account to add, confirm or report. It also keeps what you did, on any device.')} onClose={onClose}>
      {GOOGLE_CLIENT_ID && !googleOld ? (
        <GoogleButton sb={sb} onDone={() => { announceSignedIn(); onClose(); }} onError={(e) => setError(friendly(e, L.lang))} onUnavailable={() => setGoogleOld(true)} />
      ) : (
        <button type="button" className="btn google" onClick={google}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          {L('המשך עם Google', 'Continue with Google')}
        </button>
      )}
      <div className="or"><span>{L('או', 'or')}</span></div>
      <form onSubmit={sendLink} className="field" noValidate>
        <label htmlFor="auth-email">{L('קישור התחברות למייל', 'Sign-in link by email')}</label>
        <input id="auth-email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <div className="err" role="alert">{error}</div>}
        {mailBusy && (
          <div className="mail-busy" role="status">
            <span className="mail-busy-emoji" aria-hidden="true">💌</span>
            <div>
              <b>{mailBusy === 'hour' ? L('איזה ביקוש! תיבת המיילים שלנו מלאה', 'So many of you! Our mailbox is full') : L('המייל שלנו לוקח הפסקה קצרה', 'Our email is taking a short break')}</b>
              <p>{mailBusy === 'hour'
                ? L('נשלחו המון מיילים בשעה האחרונה. אפשר להיכנס עכשיו עם Google, או לנסות שוב בעוד שעה.', 'We sent a lot of emails in the last hour. You can continue with Google now, or try again in an hour.')
                : L('לא הצלחנו לשלוח מייל כרגע. אפשר להיכנס עכשיו עם Google, או לנסות שוב מאוחר יותר. נשמח לראות אתכם!', "We couldn't send an email right now. You can continue with Google now, or try again later. We'd love to see you!")}</p>
            </div>
          </div>
        )}
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
