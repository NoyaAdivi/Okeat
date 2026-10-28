import Link from 'next/link';
import Logo from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head"><Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link></div>
        <div className="empty">
          <p>לא מצאנו את הדף הזה. ייתכן שהמקום נמחק או שהקישור שגוי.</p>
          <Link className="btn primary" href="/map">למפה</Link>
        </div>
      </div>
    </div>
  );
}
