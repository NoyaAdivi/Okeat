import type { Metadata } from 'next';
import MapScreen from '@/components/MapScreen';
import type { Need } from '@/lib/types';
import { CUISINES } from '@/lib/cuisine';
import { getLang } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Map | Okeat' : 'המפה | Okeat' };
}

interface Props {
  searchParams: Promise<{ place?: string; auth_error?: string; need?: string; add?: string; q?: string; food?: string }>;
}

const NEEDS: Need[] = ['kosher', 'vegan', 'vegetarian', 'gluten_free'];

export default async function MapPage({ searchParams }: Props) {
  const { place, auth_error, need, add, q, food } = await searchParams;
  const en = (await getLang()) === 'en';
  return (
    <>
      {/* The map has no visible title; this one is for screen readers and search engines. */}
      <h1 className="vh">{en ? 'Map of kosher, vegan, vegetarian and gluten-free places' : 'מפת מקומות כשרים, טבעוניים, צמחוניים וללא גלוטן'}</h1>
      <MapScreen
        initialPlaceId={place ?? null}
        authError={auth_error === '1'}
        initialNeed={NEEDS.includes(need as Need) ? (need as Need) : null}
        addOnLoad={add === '1'}
        initialQuery={q ?? ''}
        initialCuisine={food && CUISINES[food] ? food : null}
      />
    </>
  );
}
