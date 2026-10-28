import type { Metadata } from 'next';
import MapScreen from '@/components/MapScreen';
import type { Need } from '@/lib/types';

export const metadata: Metadata = { title: 'Okeat' };

interface Props {
  searchParams: Promise<{ place?: string; auth_error?: string; need?: string; add?: string }>;
}

const NEEDS: Need[] = ['kosher', 'vegan', 'gluten_free'];

export default async function MapPage({ searchParams }: Props) {
  const { place, auth_error, need, add } = await searchParams;
  return (
    <MapScreen
      initialPlaceId={place ?? null}
      authError={auth_error === '1'}
      initialNeed={NEEDS.includes(need as Need) ? (need as Need) : null}
      addOnLoad={add === '1'}
    />
  );
}
