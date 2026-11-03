import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES } from '@/lib/cities';
import { NEED_ORDER } from '@/lib/claims';
import { placeEmoji } from '@/lib/emoji';
import { getLang, serverL } from '@/lib/lang-server';
import { fetchNearby } from '@/lib/places';
import { createClient } from '@/lib/supabase/server';
import { placeTypeLabel, type NeedFilter } from '@/lib/types';

interface Props { params: Promise<{ slug: string }> }

const NO_FILTER = Object.fromEntries(NEED_ORDER.map((n) => [n, null])) as NeedFilter;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) return { title: 'Okeat' };
  const en = (await getLang()) === 'en';
  return {
    title: en ? `Where to eat in ${city.en} | Okeat` : `איפה לאכול ב${city.he} | Okeat`,
    description: en ? `Kosher, vegan, vegetarian and gluten-free places in ${city.en}.` : `מקומות כשרים, טבעוניים, צמחוניים וללא גלוטן ב${city.he}.`,
  };
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const found = CITIES.find((c) => c.slug === slug);
  if (!found) notFound();
  const L = await serverL();
  const lang = (await getLang()) === 'en' ? 'en' : 'he';
  const sb = await createClient();
  const places = await fetchNearby(sb, { lat: found.lat, lng: found.lng, radiusM: 4000, filter: NO_FILTER, limit: 40 }).catch(() => []);
  const name = lang === 'en' ? found.en : found.he;
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">🍽️</span>
          <div>
            <h1>{L(`איפה לאכול ב${name}`, `Where to eat in ${name}`)}</h1>
            <p>{L('מקומות כשרים, טבעוניים, צמחוניים וללא גלוטן', 'Kosher, vegan, vegetarian and gluten-free places')}</p>
          </div>
        </header>
        <ul className="profile-places">
          {places.map((p) => (
            <li key={p.id}>
              <Link href={`/place/${p.id}`}>
                <span aria-hidden="true">{placeEmoji(p.place_type)}</span> <b>{p.name}</b>
                <small> {placeTypeLabel(p.place_type, lang)}</small>
              </Link>
            </li>
          ))}
        </ul>
        <p className="center"><Link className="btn primary" href="/map">{L('לפתוח את המפה', 'Open the map')}</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
