import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES, TOPICS } from '@/lib/cities';
import { getLang, serverL } from '@/lib/lang-server';
import ListFilters from '@/components/ListFilters';
import { CUISINES } from '@/lib/cuisine';
import type { Need } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Cities | Okeat' : 'ערים | Okeat' };
}

const NEEDS: Need[] = ['kosher', 'vegan', 'vegetarian', 'gluten_free'];

export default async function CitiesPage({ searchParams }: { searchParams: Promise<{ need?: string; food?: string }> }) {
  const sp = await searchParams;
  const need = NEEDS.includes(sp.need as Need) ? (sp.need as Need) : null;
  const food = sp.food && CUISINES[sp.food] ? sp.food : null;
  const query = [need && `need=${need}`, food && `food=${food}`].filter(Boolean).join('&');
  const L = await serverL();
  const en = (await getLang()) === 'en';
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">🗺️</span>
          <div><h1>{L('לאן הולכים לאכול?', 'Where are we eating?')}</h1><p>{L('בחרו מה חשוב לכם, ואז עיר', 'Choose what matters to you, then a city')}</p></div>
        </header>
        <ListFilters base="/cities" need={need} food={food} lang={en ? 'en' : 'he'} />
        <ul className="city-grid">
          {CITIES.map((c, i) => (
            <li key={c.slug} style={{ '--i': i } as React.CSSProperties}>
              <Link href={`/city/${c.slug}${query ? `?${query}` : ''}`}>
                <span className="city-emoji" aria-hidden="true">{c.emoji}</span>
                <b>{en ? c.en : c.he}</b>
              </Link>
            </li>
          ))}
        </ul>
        <h2 className="topics-title">{L('או לפי מה שחשוב לכם', 'Or by what matters to you')}</h2>
        <ul className="city-grid topic-grid">
          {TOPICS.map((t, i) => (
            <li key={t.slug} style={{ '--i': CITIES.length + i } as React.CSSProperties}>
              <Link href={`/topic/${t.slug}`}>
                <span className="city-emoji" aria-hidden="true">{t.emoji}</span>
                <b>{en ? t.en : t.he}</b>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
