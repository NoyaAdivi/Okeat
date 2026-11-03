import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { serverL } from '@/lib/lang-server';

export const metadata: Metadata = { title: 'Okeat', robots: { index: false } };

/** One tap to finish signing in from the email. */
export default async function EnterPage() {
  const L = await serverL();
  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty lost">
          <span className="lost-pin" aria-hidden="true">💌</span>
          <h1>{L('כמעט שם', 'Almost there')}</h1>
          <p>{L('לחיצה אחת ואתם מחוברים.', 'One tap and you are signed in.')}</p>
          <form method="post" action="/auth/confirm">
            <button type="submit" className="btn primary">{L('כניסה ל-Okeat', 'Sign in to Okeat')}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
