'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import AccountButton from './AccountButton';
import AuthDialog from './AuthDialog';
import Logo from './Logo';
import DisplayToggles from './DisplayToggles';
import { useL } from './LangProvider';

export const LINKEDIN_URL = 'https://www.linkedin.com/in/noya-adivi';

export function SiteHeader() {
  const path = usePathname();
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const { user, ready } = useUser(sb);
  const [signingIn, setSigningIn] = useState(false);
  const links = [
    { href: '/', label: L('בית', 'Home'), emoji: '🏠' },
    { href: '/map', label: L('המפה', 'Map'), emoji: '🗺️' },
    { href: '/about', label: L('איך זה עובד', 'How it works'), emoji: '💡' },
  ];
  return (
    <>
    <header className="site-head">
      <Link href="/" className="brand-link" aria-label={L('Okeat, דף הבית', 'Okeat, home page')}>
        <Logo size={40} />
        <span>okeat</span>
      </Link>
      <nav aria-label={L('ניווט ראשי', 'Main navigation')}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={path === l.href ? 'page' : undefined}>
            <span aria-hidden="true">{l.emoji}</span> {l.label}
          </Link>
        ))}
      </nav>
      <div className="site-tools">
        <DisplayToggles />
        <AccountButton sb={sb} user={user} ready={ready} onSignIn={() => setSigningIn(true)} onSignedOut={() => undefined} />
      </div>
    </header>
    {signingIn && <AuthDialog sb={sb} onClose={() => setSigningIn(false)} />}
    </>
  );
}

export function SiteFooter() {
  const L = useL();
  return (
    <footer className="site-foot">
      <div className="foot-brand">
        <Logo size={32} />
        <span>okeat</span>
      </div>
      <nav aria-label={L('קישורים', 'Links')}>
        <Link href="/map">{L('המפה', 'Map')}</Link>
        <Link href="/about">{L('איך זה עובד', 'How it works')}</Link>
        <Link href="/cities">{L('מקומות לפי עיר', 'Places by city')}</Link>
        <Link href="/accessibility">{L('הצהרת נגישות', 'Accessibility statement')}</Link>
        <Link href="/terms">{L('תנאי שימוש', 'Terms of use')}</Link>
        <Link href="/privacy">{L('מדיניות פרטיות', 'Privacy policy')}</Link>
        <Link href="/contact">{L('צור קשר', 'Contact')}</Link>
      </nav>
      <p className="foot-credit">
        <span>{L('האתר נבנה על ידי', 'Built by')}</span>
        <a className="foot-name" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label={L('נויה אדיבי בלינקדאין', 'Noya Adivi on LinkedIn')}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" /></svg>
          {L('נויה אדיבי', 'Noya Adivi')}
        </a>
      </p>
      <p className="foot-note">
        {L('חלק מהמידע על המקומות מגיע מ-', 'Some of the place information comes from ')}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        {L(' ומתפרסם ברישיון ODbL, וחלק מ-', ' and is published under the ODbL licence, and some from ')}
        <a href="https://overturemaps.org" target="_blank" rel="noopener noreferrer">Overture Maps</a>
        {L(' (CDLA Permissive 2.0). המידע באתר אינו מחליף בדיקה במקום.', ' (CDLA Permissive 2.0). The information here does not replace checking on site.')}
      </p>
    </footer>
  );
}
