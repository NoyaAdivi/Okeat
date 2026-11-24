import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import ContactForm from '@/components/ContactForm';
import { LINKEDIN_URL } from '@/components/SiteChrome';
import { getLang, serverL } from '@/lib/lang-server';
import { SITE } from '@/lib/site';

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
          {L('אפשר גם לפנות ישירות ל', 'You can also reach out directly to ')}
          <a className="foot-linkedin" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label={L('נויה אדיבי בלינקדאין', 'Noya Adivi on LinkedIn')}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" style={{ verticalAlign: '-3px' }}>
              <rect width="24" height="24" rx="4" fill="#fff" />
              <path fill="#0a66c2" d="M7.1 9.5H4.6V19h2.5V9.5zM5.85 5.2a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9zM19.4 13.6c0-2.6-1.4-4.3-3.6-4.3-1.3 0-2.1.7-2.5 1.3V9.5h-2.4V19h2.5v-5c0-1.2.5-2.2 1.7-2.2s1.6 1 1.6 2.3V19h2.6v-5.4z" />
            </svg>{' '}
            {L('נויה אדיבי', 'Noya Adivi')}
          </a>
          {SITE.email && <>{L(' או במייל ', ' or by email at ')}<a className="contact-mail" href={`mailto:${SITE.email}`} dir="ltr"><span aria-hidden="true">✉️</span> {SITE.email}</a></>}
        </p>
        <ContactForm initialTopic={topic} />
      </main>
      <SiteFooter />
    </div>
  );
}
