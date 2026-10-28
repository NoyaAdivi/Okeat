import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchPlace } from '@/lib/places';
import { NEED_LABELS, levelInfo, placeTypeLabel } from '@/lib/types';
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
  // "כשר למהדרין, ללא גלוטן: מטבח נפרד" — what was verified, for link previews
  const verified = NEED_ORDER.map((n) => verifiedClaim(place, n))
    .filter((c) => c !== null && !c.certificate?.expired)
    .map((c) => (c!.need === 'kosher' ? levelInfo('kosher', c!.level)?.label : `${NEED_LABELS[c!.need].label}: ${levelInfo(c!.need, c!.level)?.label}`));
  const description = verified.length
    ? `${placeTypeLabel(place.place_type)}. ${verified.join(', ')}.`
    : `${placeTypeLabel(place.place_type)}. ממתין לאישור הקהילה.`;
  return {
    title: `${place.name} | Okeat`,
    description,
    openGraph: { title: place.name, description, type: 'website', locale: 'he_IL' },
  };
}

export default async function PlacePage({ params }: Props) {
  const place = await load((await params).id);
  if (!place) notFound();
  return <SharedPlace place={place} />;
}
