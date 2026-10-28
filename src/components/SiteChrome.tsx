'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

const LINKS = [
  { href: '/', label: 'בית', emoji: '🏠' },
  { href: '/map', label: 'המפה', emoji: '🗺️' },
  { href: '/about', label: 'איך זה עובד', emoji: '💡' },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-head">
      <Link href="/" className="brand-link" aria-label="Okeat, דף הבית">
        <Logo size={40} />
        <span>okeat</span>
      </Link>
      <nav aria-label="ניווט ראשי">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={path === l.href ? 'page' : undefined}>
            <span aria-hidden="true">{l.emoji}</span> {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="foot-brand">
        <Logo size={32} />
        <span>okeat</span>
        <span className="foot-tag">OK to eat: איפה באמת אפשר לאכול</span>
      </div>
      <nav aria-label="קישורים">
        <Link href="/map">המפה</Link>
        <Link href="/about">איך זה עובד</Link>
        <Link href="/accessibility">הצהרת נגישות</Link>
        <Link href="/terms">תנאי שימוש</Link>
        <Link href="/privacy">מדיניות פרטיות</Link>
        <Link href="/contact">צור קשר</Link>
      </nav>
      <p className="foot-note">
        חלק מהמידע על המקומות מגיע מ-
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        {' '}ומתפרסם ברישיון ODbL, וחלק מ-
        <a href="https://overturemaps.org" target="_blank" rel="noopener noreferrer">Overture Maps</a>
        {' '}(CDLA Permissive 2.0). המידע נבדק על ידי הקהילה ואינו מחליף בדיקה במקום.
      </p>
    </footer>
  );
}
