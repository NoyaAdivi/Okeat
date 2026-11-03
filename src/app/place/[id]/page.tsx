import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchPlace } from '@/lib/places';
import { levelInfo, levelText, needLabel, placeTypeLabel } from '@/lib/types';
import { getLang } from '@/lib/lang-server';
import { NEED_ORDER, verifiedClaim } from '@/lib/claims';
import SharedPlace from '@/components/SharedPlace';

interface Props {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const sb = await createClient();
  return fetchPlace(sb, id).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await load((await params).id);
  if (!place) return { title: 'Okeat' };
  const lang = await getLang();
  // "כשר למהדרין, ללא גלוטן: מטבח נפרד" — what was verified, for link previews
  const verified = NEED_ORDER.map((n) => verifiedClaim(place, n))
    .filter((c) => c !== null && !c.certificate?.expired)
    .map((c) => {
      const info = levelInfo(c!.need, c!.level);
      const lvl = info ? levelText(info, lang) : '';
      return c!.need === 'kosher' ? lvl : `${needLabel(c!.need, lang)}: ${lvl}`;
    });
  const type = placeTypeLabel(place.place_type, lang);
  const description = verified.length
    ? `${type}. ${verified.join(', ')}.`
    : `${type}. ${lang === 'en' ? 'No confirmed information yet.' : 'עוד אין מידע מאושר.'}`;
  return {
    title: `${place.name} | Okeat`,
    description,
    openGraph: { title: place.name, description, type: 'website', locale: lang === 'en' ? 'en_US' : 'he_IL' },
  };
}

export default async function PlacePage({ params }: Props) {
  const place = await load((await params).id);
  if (!place) notFound();
  return <SharedPlace place={place} />;
}
