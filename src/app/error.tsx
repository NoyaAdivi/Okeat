'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import Logo from '@/components/Logo';
import { logClientError } from '@/lib/errorLog';
import { useL } from '@/components/LangProvider';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const L = useL();
  useEffect(() => {
    console.error(error);
    logClientError(error.message);
  }, [error]);

  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty lost">
          <span className="lost-pin" aria-hidden="true">🥴</span>
          <p>{L('משהו השתבש בטעינת הדף. אפשר לנסות שוב, ואם זה חוזר, לחזור למפה.', 'Something went wrong loading the page. Try again, and if it keeps happening, go back to the map.')}</p>
          <div className="cta-row">
            <button type="button" className="btn primary" onClick={reset}>{L('לנסות שוב', 'Try again')}</button>
            <Link className="btn" href="/map">{L('למפה', 'To the map')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
