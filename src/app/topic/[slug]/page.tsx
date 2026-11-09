import type { Metadata } from 'next';
import Link from 'next/link';
import Badges from '@/components/Badges';
import PlaceTile from '@/components/PlaceTile';
import { notFound, redirect } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { TOPICS } from '@/lib/cities';
import { NEED_CLASS, NEED_ORDER, withoutPending } from '@/lib/claims';
import { placeIcon } from '@/lib/emoji';
import { FILTER_OPTIONS } from '@/lib/filters';
import { getLang, serverL } from '@/lib/lang-server';
import { fetchNearby } from '@/lib/places';
import { createPublicClient } from '@/lib/supabase/server';
import { placeTypeLabel, type NeedFilter } from '@/lib/types';
import { CUISINES, cuisineLabel, placeFoods } from '@/lib/cuisine';
import ListFilters from '@/components/ListFilters';
import { cleanName } from '@/lib/text';

interface Props { params: Promise<{ slug: string }>; searchParams: Promise<{ level?: string; food?: string }> }

const NO_FILTER = Object.fromEntries(NEED_ORDER.map((n) => [n, null])) as NeedFilter;
const ISRAEL = { lat: 32.0853, lng: 34.7818, radiusM: 400000 };
/** addresses from before these pages opened by level */
const MOVED: Record<string, string> = { mehadrin: '/topic/kosher?level=2', celiac: '/topic/gluten-free?level=2' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) return { title: 'Okeat' };
  return { title: `${(await getLang()) === 'en' ? topic.en : topic.he} | Okeat` };
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { level, food: foodParam } = await searchParams;
  const food = foodParam && CUISINES[foodParam] ? foodParam : null;
  if (MOVED[slug]) redirect(MOVED[slug]);
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) notFound();
  const options = FILTER_OPTIONS[topic.need];
  const chosen = options.find((o) => String(o.min) === level) ?? options[0];
  const L = await serverL();
  const lang = (await getLang()) === 'en' ? 'en' : 'he';
  const sb = createPublicClient();
  const places = await fetchNearby(sb, { ...ISRAEL, filter: { ...NO_FILTER, [topic.need]: chosen.min }, limit: food ? 600 : 40, cuisine: food ? [food] : undefined })
    .then((list) => list.slice(0, 60)).catch(() => []);
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">{topic.emoji}</span>
          <div>
            <h1>{lang === 'en' ? topic.en : topic.he}</h1>
            <p>{L('מקומות ברחבי הארץ. החותמת מראה מה כבר אושר.', 'Places around the country. The seal shows what is already confirmed.')}</p>
          </div>
        </header>
        <nav className={`level-pills ${NEED_CLASS[topic.need]}`} aria-label={L('סינון לפי רמה', 'Filter by level')}>
          {options.map((o, i) => (
            <Link key={o.min} href={`/topic/${topic.slug}?level=${o.min}${food ? `&food=${food}` : ''}`} scroll={false} aria-current={o.min === chosen.min ? 'true' : undefined} style={{ '--i': i } as React.CSSProperties}>
              {lang === 'en' ? o.en : o.label}
            </Link>
          ))}
        </nav>
        <ListFilters base={`/topic/${topic.slug}`} need={null} food={food} lang={lang} needs={false} keep={{ level: String(chosen.min) }} />
        {places.length === 0 && <p className="muted">{L('עוד אין כאן מקומות מאושרים. מכירים מקום? אפשר להוסיף אותו במפה.', 'No confirmed places here yet. Know one? You can add it on the map.')}</p>}
        <ul className="tiles" key={`${chosen.min}-${food}`}>
          {places.map((p, i) => (
            <PlaceTile key={p.id} index={i} href={`/place/${p.id}`} emoji={placeIcon(p)} name={cleanName(p.name)} sub={placeFoods(p, 2).map((c) => cuisineLabel(c, lang)).join(', ') || placeTypeLabel(p.place_type, lang)} seals={<Badges place={withoutPending(p)} />} />
          ))}
        </ul>
        <p className="center"><Link className="btn primary" href="/map">{L('לפתוח את המפה', 'Open the map')}</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
