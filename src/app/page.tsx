import Link from 'next/link';
import Logo from '@/components/Logo';
import Stats from '@/components/Stats';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { serverL } from '@/lib/lang-server';

// Food emoji drifting behind the hero. Positions are percentages of the hero box.
const FLOATERS = [
  { e: '🥗', x: 8, y: 18, d: 0 }, { e: '🌱', x: 86, y: 14, d: 1.2 }, { e: '🍕', x: 92, y: 62, d: 2.1 },
  { e: '🧆', x: 4, y: 70, d: 0.6 }, { e: '🥐', x: 22, y: 88, d: 1.8 }, { e: '☕', x: 74, y: 86, d: 0.3 },
  { e: '🌾', x: 64, y: 8, d: 2.6 }, { e: '🍣', x: 38, y: 6, d: 1.5 }, { e: '🥑', x: 96, y: 36, d: 0.9 },
  { e: '🍦', x: 14, y: 44, d: 2.3 },
];

type T = (he: string, en: string) => string;

const needsOf = (L: T) => [
  {
    key: 'kosher', cls: 'k', letter: L('כ', 'K'), emoji: '🍽️', title: L('כשר', 'Kosher'),
    text: L('רואים מי משגיח, וכשיש תעודה גם עד מתי היא בתוקף. תעודה שפגה מסומנת מיד.', 'See who supervises and, when there is a certificate, until when it is valid. An expired certificate is flagged right away.'),
    levels: [L('רבנות', 'Rabbinate'), L('מהדרין', 'Mehadrin'), L('בד״ץ', 'Badatz')],
    go: L('למקומות הכשרים', 'Kosher places'),
  },
  {
    key: 'vegan', cls: 'v', letter: L('ט', 'V'), emoji: '🌱', title: L('טבעוני', 'Vegan'),
    text: L('יודעים אם המקום טבעוני לגמרי, או שיש בו כמה מנות טבעוניות.', 'Know whether a place is fully vegan, or just has a few vegan dishes.'),
    levels: [L('יש מנות', 'Vegan options'), L('טבעוני לגמרי', 'Fully vegan')],
    go: L('למקומות הטבעוניים', 'Vegan places'),
  },
  {
    key: 'vegetarian', cls: 'h', letter: L('צ', 'Vg'), emoji: '🥦', title: L('צמחוני', 'Vegetarian'),
    text: L('מקומות בלי בשר ודגים, או מקומות עם מנות צמחוניות, כדי שתדעו מראש מה מחכה לכם.', 'Places with no meat or fish, or with vegetarian dishes, so you know what to expect.'),
    levels: [L('יש מנות', 'Has dishes'), L('הכול צמחוני', 'All vegetarian')],
    go: L('למקומות הצמחוניים', 'Vegetarian places'),
  },
  {
    key: 'gluten_free', cls: 'g', letter: L('ג', 'G'), emoji: '🌾', title: L('ללא גלוטן', 'Gluten-free'),
    text: L('ההבדל שחשוב לצליאקים: תפריט ללא גלוטן במטבח משותף, או מטבח נפרד באמת.', 'The difference that matters for celiacs: a gluten-free menu in a shared kitchen, or a truly separate kitchen.'),
    levels: [L('תפריט ללא גלוטן', 'Gluten-free menu'), L('מטבח נפרד', 'Separate kitchen')],
    go: L('למקומות ללא גלוטן', 'Gluten-free places'),
  },
];

const stepsOf = (L: T) => [
  { emoji: '📍', title: L('מוצאים', 'Find'), text: L('פותחים את המפה, בוחרים מה חשוב לכם, ורואים מה פתוח עכשיו בסביבה.', "Open the map, choose what matters to you, and see what's open nearby right now.") },
  { emoji: '🧭', title: L('מגיעים', 'Go'), text: L('ניווט מהמקום שלכם עד הדלת, ברגל, באופניים או ברכב, גם עם הנחיות קוליות.', 'Directions from where you are to the door, on foot, by bike or by car, with voice guidance too.') },
  { emoji: '✅', title: L('מאשרים', 'Confirm'), text: L('הייתם שם? לחיצה אחת מאשרת שהמידע נכון. ככה כולם יודעים שאפשר לסמוך עליו.', 'Been there? One tap confirms the information is right, so everyone knows they can trust it.') },
];

export default async function Home() {
  const L = await serverL();
  const NEEDS = needsOf(L);
  const STEPS = stepsOf(L);
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

        <section className="band" aria-labelledby="stats-h">
          <h2 id="stats-h" className="vh">{L('המספרים', 'The numbers')}</h2>
          <Stats />
        </section>

        <section className="section" aria-labelledby="needs-h">
          <h2 id="needs-h" className="section-title">{L('מה חשוב לכם?', 'What matters to you?')}</h2>
          <p className="section-sub">{L('בוחרים צורך אחד, או כמה ביחד. למשל כשר וגם ללא גלוטן, בשביל כל המשפחה.', 'Choose one need, or several together. For example kosher and gluten-free, for the whole family.')}</p>
          <div className="need-cards">
            {NEEDS.map((n, i) => (
              <Link key={n.key} href={`/map?need=${n.key}`} className={`need-card ${n.cls}`} style={{ '--i': i } as React.CSSProperties}>
                <span className="nc-top">
                  <span className="seal big" aria-hidden="true"><span>{n.letter}</span></span>
                  <span className="nc-emoji" aria-hidden="true">{n.emoji}</span>
                </span>
                <span className="nc-title">{n.title}</span>
                <span className="nc-text">{n.text}</span>
                <span className="nc-levels">
                  {n.levels.map((l) => <span key={l}>{l}</span>)}
                </span>
                <span className="nc-go">{n.go}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="how-h">
          <h2 id="how-h" className="section-title">{L('שלושה צעדים, וזהו', "Three steps, that's it")}</h2>
          <ol className="steps-row">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step-card" style={{ '--i': i } as React.CSSProperties}>
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <span className="step-emoji" aria-hidden="true">{s.emoji}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section">
          <div className="join">
            <div className="join-art" aria-hidden="true">📸</div>
            <div>
              <h2 className="section-title">{L('מכירים מקום שחסר?', 'Know a place that is missing?')}</h2>
              <p>{L('מתחברים, ומוסיפים אותו בחצי דקה. אם יש שם תעודת כשרות, מצלמים אותה והפרטים נקראים לבד.', 'Sign in and add it in half a minute. If there is a kosher certificate, take a photo and the details are read for you.')}</p>
              <Link href="/map?add=1" className="cta primary"><span aria-hidden="true">➕</span> {L('הוספת מקום', 'Add a place')}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
