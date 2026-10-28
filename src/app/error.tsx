'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import Logo from '@/components/Logo';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty">
          <span style={{ fontSize: 56 }} aria-hidden="true">🥴</span>
          <p>משהו השתבש בטעינת הדף. אפשר לנסות שוב, ואם זה חוזר, לחזור למפה.</p>
          <div className="cta-row">
            <button type="button" className="btn primary" onClick={reset}>לנסות שוב</button>
            <Link className="btn" href="/map">למפה</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
