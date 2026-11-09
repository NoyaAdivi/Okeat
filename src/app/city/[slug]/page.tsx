import type { Metadata } from 'next';
import Link from 'next/link';
import Badges from '@/components/Badges';
import PlaceTile from '@/components/PlaceTile';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { CITIES } from '@/lib/cities';
import { MAIN_NEEDS, NEED_ORDER, hasAnyVerified, withoutPending } from '@/lib/claims';
import { placeIcon } from '@/lib/emoji';
import { getLang, serverL } from '@/lib/lang-server';
import { fetchNearby } from '@/lib/places';
import { createPublicClient } from '@/lib/supabase/server';
import { placeTypeLabel, type Need, type NeedFilter } from '@/lib/types';
import { FILTER_OPTIONS } from '@/lib/filters';
import { CUISINES, cuisineLabel, placeFoods } from '@/lib/cuisine';
import ListFilters from '@/components/ListFilters';
import { cleanName } from '@/lib/text';

interface Props { params: Promise<{ slug: string }>; searchParams: Promise<{ need?: string; food?: string }> }

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

export default async function CityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const need = (MAIN_NEEDS as string[]).includes(sp.need ?? '') ? (sp.need as Need) : null;
  const food = sp.food && CUISINES[sp.food] ? sp.food : null;
  const found = CITIES.find((c) => c.slug === slug);
  if (!found) notFound();
  const L = await serverL();
  const lang = (await getLang()) === 'en' ? 'en' : 'he';
  const sb = createPublicClient();
  const filter = need ? { ...NO_FILTER, [need]: FILTER_OPTIONS[need][0].min } : NO_FILTER;
  // with a filter the search goes wider, so a small town still shows something
  const places = await fetchNearby(sb, { lat: found.lat, lng: found.lng, radiusM: need || food ? 8000 : 4000, filter, limit: need || food ? 300 : 40, cuisine: food ? [food] : undefined })
    .then((list) => list.slice(0, 60)).catch(() => []);
  // places with information come first, so the page opens with something useful
  places.sort((a, b) => Number(hasAnyVerified(b)) - Number(hasAnyVerified(a)));
  const name = lang === 'en' ? found.en : found.he;
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">{found.emoji}</span>
          <div>
            <h1>{L(`איפה לאכול ב${name}`, `Where to eat in ${name}`)}</h1>
            <p>{L('מקומות כשרים, טבעוניים, צמחוניים וללא גלוטן', 'Kosher, vegan, vegetarian and gluten-free places')}</p>
          </div>
        </header>
        <ListFilters base={`/city/${found.slug}`} need={need} food={food} lang={lang} />
        {places.length === 0 && <p className="muted center">{L('לא מצאנו כאן מקומות כאלה. אפשר לנקות את הסינון או לחפש במפה.', "We didn't find such places here. Clear the filter or look on the map.")}</p>}
        <ul className="tiles" key={`${need}-${food}`}>
          {places.map((p, i) => (
            <PlaceTile key={p.id} index={i} href={`/place/${p.id}`} emoji={placeIcon(p)} name={cleanName(p.name)} sub={placeFoods(p, 2).map((c) => cuisineLabel(c, lang)).join(', ') || placeTypeLabel(p.place_type, lang)} seals={<Badges place={withoutPending(p)} />} />
          ))}
        </ul>
        <p className="center"><Link className="btn primary" href={`/map${need || food ? `?${[need && `need=${need}`, food && `food=${food}`].filter(Boolean).join('&')}` : ''}`}>{L('לפתוח את המפה', 'Open the map')}</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
