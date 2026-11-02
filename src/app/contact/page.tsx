import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import ContactForm from '@/components/ContactForm';
import { LINKEDIN_URL } from '@/components/SiteChrome';
import { getLang, serverL } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Contact | Okeat' : 'צור קשר | Okeat' };
}

interface Props {
  searchParams: Promise<{ topic?: string }>;
}

export default async function Contact({ searchParams }: Props) {
  const { topic } = await searchParams;
  const L = await serverL();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        <h1>{L('צור קשר', 'Contact')}</h1>
        <p>{L('שאלה, הצעה, מידע שגוי על מקום, בעיית נגישות או בקשה בנושא פרטיות: כתבו לנו כאן. אנחנו קוראים כל הודעה.', 'A question, a suggestion, wrong information about a place, an accessibility problem or a privacy request: write to us here. We read every message.')}</p>
        <p className="contact-linkedin">
          {L('אפשר גם לפנות ישירות לנויה אדיבי, שבנתה את האתר: ', 'You can also reach Noya Adivi, who built the site, directly: ')}
          <a className="foot-linkedin" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">💼</span> LinkedIn</a>
        </p>
        <ContactForm initialTopic={topic} />
      </main>
      <SiteFooter />
    </div>
  );
}
