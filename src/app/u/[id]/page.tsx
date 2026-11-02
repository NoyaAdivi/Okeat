import type { Metadata } from 'next';
import ProfileView from '@/components/ProfileView';
import { getLang } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Profile | Okeat' : 'פרופיל | Okeat', robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfileView id={id} />;
}
