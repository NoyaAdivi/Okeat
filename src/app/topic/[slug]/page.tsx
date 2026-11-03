import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { TOPICS } from '@/lib/cities';
import { NEED_ORDER } from '@/lib/claims';
import { placeEmoji } from '@/lib/emoji';
import { getLang, serverL } from '@/lib/lang-server';
import { fetchNearby } from '@/lib/places';
import { createClient } from '@/lib/supabase/server';
import { placeTypeLabel, type NeedFilter } from '@/lib/types';

interface Props { params: Promise<{ slug: string }> }

const NO_FILTER = Object.fromEntries(NEED_ORDER.map((n) => [n, null])) as NeedFilter;
const ISRAEL = { lat: 32.0853, lng: 34.7818, radiusM: 400000 };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) return { title: 'Okeat' };
  return { title: `${(await getLang()) === 'en' ? topic.en : topic.he} | Okeat` };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) notFound();
  const L = await serverL();
  const lang = (await getLang()) === 'en' ? 'en' : 'he';
  const sb = await createClient();
  const places = await fetchNearby(sb, { ...ISRAEL, filter: { ...NO_FILTER, [topic.need]: topic.min }, limit: 40 }).catch(() => []);
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        <header className="admin-hero">
          <span className="admin-hero-mark" aria-hidden="true">{topic.emoji}</span>
          <div>
            <h1>{lang === 'en' ? topic.en : topic.he}</h1>
            <p>{L('מקומות שהקהילה אישרה ברחבי הארץ', 'Places the community confirmed around the country')}</p>
          </div>
        </header>
        {places.length === 0 && <p className="muted">{L('עוד אין כאן מקומות מאושרים. מכירים מקום? אפשר להוסיף אותו במפה.', 'No confirmed places here yet. Know one? You can add it on the map.')}</p>}
        <ul className="profile-places city-places">
          {places.map((p, i) => (
            <li key={p.id} style={{ '--i': Math.min(i, 14) } as React.CSSProperties}>
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
