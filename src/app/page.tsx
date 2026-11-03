import Link from 'next/link';
import Logo from '@/components/Logo';
import Stats from '@/components/Stats';
import { HomeLocationAsk } from '@/components/LocationAsk';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { serverL } from '@/lib/lang-server';

// Food emoji drifting behind the hero. Positions are percentages of the hero box.
const FLOATERS = [
  { e: '🥗', x: 8, y: 18, d: 0 }, { e: '🌱', x: 86, y: 14, d: 1.2 }, { e: '🍕', x: 92, y: 62, d: 2.1 },
  { e: '🧆', x: 4, y: 70, d: 0.6 }, { e: '🥐', x: 22, y: 88, d: 1.8 }, { e: '☕', x: 74, y: 86, d: 0.3 },
  { e: '🌾', x: 64, y: 8, d: 2.6 }, { e: '🍣', x: 38, y: 6, d: 1.5 }, { e: '🥑', x: 96, y: 36, d: 0.9 },
  { e: '🍦', x: 14, y: 44, d: 2.3 },
];

export default async function Home() {
  const L = await serverL();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root>
        <section className="hero">
          <div className="floaters" aria-hidden="true">
            {FLOATERS.map((f, i) => (
              <span key={i} className="floater" style={{ insetInlineStart: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.d}s` }}>{f.e}</span>
            ))}
          </div>
          <div className="hero-inner">
            <div className="hero-logo"><Logo size={132} /></div>
            <h1>{L('מוצאים איפה לאכול, ', 'Find where to eat, ')}<span className="nowrap">{L('בלי לנחש', 'without guessing')}</span></h1>
            <p className="lead">{L('מפה של מקומות כשרים, טבעוניים, צמחוניים וללא גלוטן, עם חותמת שמראה מה אנשים כמוכם כבר אישרו.', 'A map of kosher, vegan, vegetarian and gluten-free places, with a seal that shows what people like you have already confirmed.')}</p>
            <div className="cta-row">
              <Link href="/map" className="cta primary"><span aria-hidden="true">🗺️</span> {L('לפתוח את המפה', 'Open the map')}</Link>
              <Link href="/about" className="cta">{L('איך זה עובד', 'How it works')}</Link>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="needs-h">
          <h2 id="needs-h" className="section-title">{L('מה חשוב לכם?', 'What matters to you?')}</h2>
          <Stats />
        </section>

        <section className="section">
          <div className="join">
            <div className="join-art" aria-hidden="true">📸</div>
            <div>
              <h2 className="section-title">{L('מכירים מקום שחסר?', 'Know a place that is missing?')}</h2>
                            <Link href="/map?add=1" className="cta primary"><span aria-hidden="true">➕</span> {L('הוספת מקום', 'Add a place')}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <HomeLocationAsk />
    </div>
  );
}
