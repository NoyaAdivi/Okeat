import type { Metadata } from 'next';
import AdminView from '@/components/AdminView';

export const metadata: Metadata = { title: 'Okeat · ניהול', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminView />;
}
