'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'okeat-notice-ok';

/** One-time notice about essential cookies and terms. Only essential storage is used, so there's nothing to opt out of. */
export default function CookieNotice() {
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
    <div className="notice-bar" role="region" aria-label="הודעה על עוגיות ותנאי שימוש">
      <span aria-hidden="true" className="nb-cookie">🍪</span>
      <p>
        אנחנו משתמשים רק בעוגיות שנחוצות כדי שהאתר יעבוד, כמו שמירת ההתחברות וההעדפות שלכם. השימוש באתר כפוף ל<Link href="/terms">תנאי השימוש</Link> ול<Link href="/privacy">מדיניות הפרטיות</Link>.
      </p>
      <button type="button" className="btn primary small" onClick={ok}>הבנתי</button>
    </div>
  );
}
