import type { Metadata } from 'next';
import ListView from '@/components/ListView';
import { getLang } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'A list of places | Okeat' : 'רשימת מקומות | Okeat', robots: { index: false } };
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListView id={id} />;
}
