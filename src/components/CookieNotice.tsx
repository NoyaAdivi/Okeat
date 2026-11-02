'use client';

import { useL } from './LangProvider';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'okeat-notice-ok';

/** One-time notice about essential cookies and terms. Only essential storage is used, so there's nothing to opt out of. */
export default function CookieNotice() {
  const L = useL();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== '1');
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  const ok = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* fine: shows again next visit */
    }
    setShow(false);
  };

  return (
    <div className="notice-bar" role="region" aria-label={L('הודעה על עוגיות ותנאי שימוש', 'About cookies and terms of use')}>
      <span aria-hidden="true" className="nb-cookie">🍪</span>
      <p>
        {L('אנחנו משתמשים רק בעוגיות שנחוצות כדי שהאתר יעבוד, כמו שמירת ההתחברות, השפה וההעדפות שלכם. השימוש באתר כפוף ל', 'We only use cookies the site needs to work, like keeping you signed in and remembering your language and settings. Using the site is subject to the ')}<Link href="/terms">{L('תנאי השימוש', 'terms of use')}</Link>{L(' ול', ' and the ')}<Link href="/privacy">{L('מדיניות הפרטיות', 'privacy policy')}</Link>.
      </p>
      <button type="button" className="btn primary small" onClick={ok}>{L('הבנתי', 'Got it')}</button>
    </div>
  );
}
