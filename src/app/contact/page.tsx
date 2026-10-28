import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = { title: 'צור קשר | Okeat' };

interface Props {
  searchParams: Promise<{ topic?: string }>;
}

export default async function Contact({ searchParams }: Props) {
  const { topic } = await searchParams;
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        <h1>צור קשר</h1>
        <p>שאלה, הצעה, מידע שגוי על מקום, בעיית נגישות או בקשה בנושא פרטיות: כתבו לנו כאן. אנחנו קוראים כל הודעה.</p>
        <ContactForm initialTopic={topic} />
      </main>
      <SiteFooter />
    </div>
  );
}
