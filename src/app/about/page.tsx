import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'איך זה עובד | Okeat' };

// The life of one piece of information, in order.
const JOURNEY = [
  { emoji: '➕', title: 'מישהו מוסיף', text: 'למשל "המקום הזה טבעוני לגמרי". בכשרות חייבים לצרף צילום של התעודה.' },
  { emoji: '👀', title: 'אחרים מאשרים', text: 'אנשים שהיו במקום לוחצים "נכון, ראיתי בעצמי". אי אפשר לאשר משהו שהוספתם בעצמכם.' },
  { emoji: '✅', title: 'מופיע במפה', text: 'אחרי שלושה אישורים המידע מסומן כמאושר, ומופיע בסינון.' },
  { emoji: '⏰', title: 'נשאר עדכני', text: 'תעודה שפג תוקפה מסומנת לבד. אם שלושה אנשים מדווחים שמשהו כבר לא נכון, הוא יורד.' },
];

const FAQ = [
  {
    q: 'מאיפה מגיע המידע?',
    a: 'משני מקורות. הראשון הוא אנשים שמוסיפים ומאשרים מקומות באתר. השני הוא OpenStreetMap, מפה פתוחה שמתנדבים מעדכנים. ליד מידע שהגיע מ-OpenStreetMap ועוד לא אושר באתר כתוב את זה במפורש.',
  },
  {
    q: 'למה אין כאן את כל המסעדות שיש בגוגל או באיזי?',
    a: 'המידע באתרים האלה שייך להם, ואסור להעתיק אותו. לכן אנחנו בונים מאגר משלנו, פתוח וקהילתי. כל מקום שאתם מוסיפים עוזר לכולם.',
  },
  {
    q: 'מה ההבדל בין "כשר" ל"מפוקח"?',
    a: 'לפי החוק בישראל, רק עסק עם תעודה מהרבנות מוצג ככשר. עסק עם השגחה פרטית, כמו צהר, מוצג כ"מפוקח". אנחנו מציגים את שניהם, וכותבים בבירור מה ההבדל.',
  },
  {
    q: 'מה זה "מסומן ככשר"?',
    a: 'מקום שסומן ככשר ב-OpenStreetMap, אבל עוד אין באתר צילום של התעודה שלו. אם אתם שם, צלמו את התעודה ועזרו לכולם.',
  },
  {
    q: 'מה זה "סיווג אוטומטי"?',
    a: 'כשאין עדיין מידע על מקום, המחשב מנחש לפי השם שלו: "פיצה" בשם הופך לפיצרייה, "טבעוני" לטבעוני וכן הלאה. ליד כל ניחוש כזה כתוב שהוא לא מאושר, עד שאנשים שהיו במקום יאשרו אותו.',
  },
  {
    q: 'צריך להירשם?',
    a: 'לא. אפשר להוסיף ולאשר בלי חשבון. ההתחברות רק שומרת את מה שעשיתם, גם כשנכנסים ממכשיר אחר.',
  },
  {
    q: 'איך עובד הניווט?',
    a: 'בוחרים מקום, בוחרים ברגל, באופניים או ברכב, ולוחצים "יציאה לדרך". המפה עוקבת אחריכם ומקריאה בקול כל פנייה. אפשר להשתיק את הקול בכל רגע.',
  },
  {
    q: 'אפשר לסמוך על זה לגמרי?',
    a: 'המידע נבדק על ידי הקהילה, ומוצג יחד עם התאריך ומספר המאשרים. ובכל זאת, ברגישות גבוהה כמו צליאקיה או כשרות מחמירה, כדאי תמיד לוודא גם במקום.',
  },
];

export default function About() {
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root>
        <section className="hero small">
          <div className="hero-inner">
            <span className="hero-emoji" aria-hidden="true">💡</span>
            <h1>איך זה עובד</h1>
            <p className="lead">Okeat (מבטאים "אוקיי-איט") בא מ-OK to eat: בטוח לי לאכול כאן? כל מידע באתר עובר בדיקה של אנשים שהיו במקום.</p>
          </div>
        </section>

        <section className="section" aria-labelledby="journey-h">
          <h2 id="journey-h" className="section-title">הדרך של כל פיסת מידע</h2>
          <ol className="journey">
            {JOURNEY.map((j, i) => (
              <li key={j.title} style={{ '--i': i } as React.CSSProperties}>
                <span className="j-dot" aria-hidden="true">{j.emoji}</span>
                <div>
                  <h3>{j.title}</h3>
                  <p>{j.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="seals-h">
          <h2 id="seals-h" className="section-title">מה אומרות החותמות</h2>
          <ul className="legend-grid">
            <li><span className="seal k" aria-hidden="true"><span>כ</span></span><span><b>כשר</b> עם צילום תעודה</span></li>
            <li><span className="seal v" aria-hidden="true"><span>ט</span></span><span><b>טבעוני</b></span></li>
            <li><span className="seal g" aria-hidden="true"><span>ג</span></span><span><b>ללא גלוטן</b></span></li>
            <li><span className="seal k soft" aria-hidden="true"><span>כ</span></span><span><b>חותמת בהירה:</b> מ-OpenStreetMap, עוד לא אושר באתר</span></li>
            <li><span className="seal x pending" aria-hidden="true"><span>?</span></span><span><b>ממתין לאישור</b> הקהילה</span></li>
          </ul>
        </section>

        <section className="section" aria-labelledby="faq-h">
          <h2 id="faq-h" className="section-title">שאלות נפוצות</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section center">
          <Link href="/map" className="cta primary"><span aria-hidden="true">🗺️</span> למפה</Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
