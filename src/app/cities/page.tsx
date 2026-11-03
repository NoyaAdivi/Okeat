import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES } from '@/lib/cities';
import { getLang, serverL } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Cities | Okeat' : 'ערים | Okeat' };
}

export default async function CitiesPage() {
  const L = await serverL();
  const en = (await getLang()) === 'en';
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">🗺️</span>
          <div><h1>{L('מקומות לפי עיר', 'Places by city')}</h1><p>{L('בחרו עיר וראו איפה אפשר לאכול', 'Choose a city and see where you can eat')}</p></div>
        </header>
        <ul className="city-grid">
          {CITIES.map((c) => <li key={c.slug}><Link href={`/city/${c.slug}`}>{en ? c.en : c.he}</Link></li>)}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
