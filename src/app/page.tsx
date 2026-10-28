import Link from 'next/link';
import Logo from '@/components/Logo';
import Stats from '@/components/Stats';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

// Food emoji drifting behind the hero. Positions are percentages of the hero box.
const FLOATERS = [
  { e: '🥗', x: 8, y: 18, d: 0 }, { e: '🌱', x: 86, y: 14, d: 1.2 }, { e: '🍕', x: 92, y: 62, d: 2.1 },
  { e: '🧆', x: 4, y: 70, d: 0.6 }, { e: '🥐', x: 22, y: 88, d: 1.8 }, { e: '☕', x: 74, y: 86, d: 0.3 },
  { e: '🌾', x: 64, y: 8, d: 2.6 }, { e: '🍣', x: 38, y: 6, d: 1.5 }, { e: '🥑', x: 96, y: 36, d: 0.9 },
  { e: '🍦', x: 14, y: 44, d: 2.3 },
];

const NEEDS = [
  {
    key: 'kosher', cls: 'k', letter: 'כ', emoji: '🍽️', title: 'כשר',
    text: 'רואים את תעודת הכשרות עצמה, מי משגיח ועד מתי היא בתוקף. תעודה שפגה מסומנת מיד.',
    levels: ['רבנות', 'מהדרין', 'בד״ץ'],
  },
  {
    key: 'vegan', cls: 'v', letter: 'ט', emoji: '🌱', title: 'טבעוני',
    text: 'יודעים אם המקום טבעוני לגמרי, או שיש בו כמה מנות טבעוניות.',
    levels: ['יש מנות', 'טבעוני לגמרי'],
  },
  {
    key: 'gluten_free', cls: 'g', letter: 'ג', emoji: '🌾', title: 'ללא גלוטן',
    text: 'ההבדל שחשוב לצליאקים: תפריט ללא גלוטן במטבח משותף, או מטבח נפרד באמת.',
    levels: ['תפריט ללא גלוטן', 'מטבח נפרד'],
  },
];

const STEPS = [
  { emoji: '📍', title: 'מוצאים', text: 'פותחים את המפה, בוחרים מה חשוב לכם, ורואים מה פתוח עכשיו בסביבה.' },
  { emoji: '🧭', title: 'מגיעים', text: 'ניווט מהמקום שלכם עד הדלת, ברגל, באופניים או ברכב, גם עם הנחיות קוליות.' },
  { emoji: '✅', title: 'מאשרים', text: 'הייתם שם? לחיצה אחת מאשרת שהמידע נכון. ככה כולם יודעים שאפשר לסמוך עליו.' },
];

export default function Home() {
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
            <h1>מוצאים איפה לאכול, <span className="nowrap">בלי לנחש</span></h1>
            <p className="lead">מפה של מקומות כשרים, טבעוניים וללא גלוטן, שאנשים כמוכם בדקו ואישרו.</p>
            <div className="cta-row">
              <Link href="/map" className="cta primary"><span aria-hidden="true">🗺️</span> לפתוח את המפה</Link>
              <Link href="/about" className="cta">איך זה עובד</Link>
            </div>
          </div>
        </section>

        <section className="band" aria-labelledby="stats-h">
          <h2 id="stats-h" className="vh">המספרים</h2>
          <Stats />
        </section>

        <section className="section" aria-labelledby="needs-h">
          <h2 id="needs-h" className="section-title">מה חשוב לכם?</h2>
          <p className="section-sub">בוחרים צורך אחד, או כמה ביחד. למשל כשר וגם ללא גלוטן, בשביל כל המשפחה.</p>
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
                <span className="nc-go">למקומות {n.title === 'כשר' ? 'הכשרים' : n.title === 'טבעוני' ? 'הטבעוניים' : 'ללא גלוטן'}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="how-h">
          <h2 id="how-h" className="section-title">שלושה צעדים, וזהו</h2>
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
              <h2 className="section-title">מכירים מקום שחסר?</h2>
              <p>מוסיפים אותו בחצי דקה, בלי הרשמה. אם יש שם תעודת כשרות, מצלמים אותה והפרטים נקראים לבד.</p>
              <Link href="/map?add=1" className="cta primary"><span aria-hidden="true">➕</span> הוספת מקום</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
