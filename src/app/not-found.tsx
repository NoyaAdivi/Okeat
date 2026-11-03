import Link from 'next/link';
import Logo from '@/components/Logo';
import { serverL } from '@/lib/lang-server';

export default async function NotFound() {
  const L = await serverL();
  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty lost">
          <span className="lost-pin" aria-hidden="true">🧭</span>
          <h1>{L('הדף הזה לא על המפה', 'This page is not on the map')}</h1>
          <p>{L('אולי המקום נמחק, ואולי הקישור שגוי. המפה עדיין כאן.', 'The place may have been removed, or the link may be wrong. The map is still here.')}</p>
          <div className="cta-row">
            <Link className="btn primary" href="/map">{L('למפה', 'To the map')}</Link>
            <Link className="btn" href="/">{L('לדף הבית', 'To the home page')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
