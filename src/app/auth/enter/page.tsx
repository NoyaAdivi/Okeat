import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { serverL } from '@/lib/lang-server';
import AutoEnter from './AutoEnter';

export const metadata: Metadata = { title: 'Okeat', robots: { index: false } };

/** Finishes the sign-in from the email; the button is there if it doesn't happen by itself. */
export default async function EnterPage() {
  // Coming back here after signing in: the one-time token is already gone.
  if (!(await cookies()).get('okeat_login')) redirect('/map');
  const L = await serverL();
  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty lost">
          <span className="lost-pin" aria-hidden="true">💌</span>
          <h1>{L('מחברים אותך…', 'Signing you in…')}</h1>
          <p>{L('אם זה לא קורה מיד, לוחצים על הכפתור.', 'If nothing happens, press the button.')}</p>
          <AutoEnter>
            <button type="submit" className="btn primary">{L('כניסה ל-Okeat', 'Sign in to Okeat')}</button>
          </AutoEnter>
        </div>
      </div>
    </div>
  );
}
