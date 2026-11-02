import Link from 'next/link';
import Logo from '@/components/Logo';
import { serverL } from '@/lib/lang-server';

export default async function NotFound() {
  const L = await serverL();
  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty">
          <p>{L('לא מצאנו את הדף הזה. ייתכן שהמקום נמחק או שהקישור שגוי.', "We couldn't find this page. The place may have been removed, or the link is wrong.")}</p>
          <Link className="btn primary" href="/map">{L('למפה', 'To the map')}</Link>
        </div>
      </div>
    </div>
  );
}
