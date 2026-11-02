import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader, LINKEDIN_URL } from '@/components/SiteChrome';
import { getLang, serverL } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'How it works | Okeat' : 'איך זה עובד | Okeat' };
}

type T = (he: string, en: string) => string;

// The life of one piece of information, in order.
const journeyOf = (L: T) => [
  { emoji: '➕', title: L('מישהו מוסיף', 'Someone adds it'), text: L('למשל "המקום הזה טבעוני לגמרי". בכשרות אפשר לצרף צילום של התעודה כדי לחזק את המידע.', 'For example "this place is fully vegan". For kosher, a photo of the certificate can be added to make it stronger.') },
  { emoji: '👀', title: L('אחרים מאשרים', 'Others confirm'), text: L('אנשים שהיו במקום לוחצים "נכון, ראיתי בעצמי". אי אפשר לאשר משהו שהוספתם בעצמכם.', 'People who were there tap "True, I saw it myself". You can\'t confirm something you added yourself.') },
  { emoji: '✅', title: L('מאושר', 'It gets confirmed'), text: L('אחרי שלושה אישורים המידע מסומן כמאושר, ומופיע בסינון.', 'After three confirmations it is marked as confirmed and shows up in the filters.') },
  { emoji: '⏰', title: L('נשאר עדכני', 'It stays up to date'), text: L('תעודה שפג תוקפה מסומנת לבד. אם שלושה אנשים מדווחים שמשהו כבר לא נכון, הוא יורד.', 'An expired certificate is flagged automatically. If three people report something is no longer true, it comes down.') },
];

const faqOf = (L: T) => [
  {
    q: L('מאיפה מגיע המידע?', 'Where does the information come from?'),
    a: L('משני מקורות. הראשון הוא אנשים שמוסיפים ומאשרים מקומות באתר. השני הוא OpenStreetMap, מפה פתוחה שמתנדבים מעדכנים. ליד מידע שהגיע מ-OpenStreetMap ועוד לא אושר באתר כתוב את זה במפורש.',
      'Two sources. The first is people who add and confirm places on the site. The second is OpenStreetMap, an open map kept up to date by volunteers. Information from OpenStreetMap that has not been confirmed on the site yet is clearly labelled.'),
  },
  {
    q: L('למה אין כאן את כל המסעדות שיש בגוגל או באיזי?', "Why aren't all the restaurants from Google or other apps here?"),
    a: L('המידע באתרים האלה שייך להם, ואסור להעתיק אותו. לכן אנחנו בונים מאגר משלנו, פתוח וקהילתי. כל מקום שאתם מוסיפים עוזר לכולם.',
      'That information belongs to them and may not be copied. So we are building our own open, community database. Every place you add helps everyone.'),
  },
  {
    q: L('מה ההבדל בין "כשר" ל"מפוקח"?', 'What is the difference between "kosher" and "supervised"?'),
    a: L('לפי החוק בישראל, רק עסק עם תעודה מהרבנות מוצג ככשר. עסק עם השגחה פרטית, כמו צהר, מוצג כ"מפוקח". אנחנו מציגים את שניהם, וכותבים בבירור מה ההבדל.',
      'By Israeli law, only a business with a Rabbinate certificate is presented as kosher. A business with private supervision, such as Tzohar, is shown as "supervised". We show both and say clearly what the difference is.'),
  },
  {
    q: L('מה זה "מסומן ככשר"?', 'What does "marked kosher" mean?'),
    a: L('מקום שסומן ככשר ב-OpenStreetMap, אבל עוד אין באתר צילום של התעודה שלו. אם אתם שם, צלמו את התעודה ועזרו לכולם.',
      "A place marked as kosher on OpenStreetMap, but with no photo of its certificate on the site yet. If you're there, photograph the certificate and help everyone."),
  },
  {
    q: L('מה זה "סיווג אוטומטי"?', 'What is an "automatic guess"?'),
    a: L('כשאין עדיין מידע על מקום, המחשב מנחש לפי השם שלו: "פיצה" בשם הופך לפיצרייה, "טבעוני" לטבעוני וכן הלאה. ליד כל ניחוש כזה כתוב שהוא לא מאושר, עד שאנשים שהיו במקום יאשרו אותו.',
      'When there is no information about a place yet, the computer guesses from its name: "pizza" in the name makes it a pizzeria, "vegan" makes it vegan, and so on. Every guess like this says it is not confirmed until people who were there confirm it.'),
  },
  {
    q: L('צריך צילום של תעודת הכשרות?', 'Do I need a photo of the kosher certificate?'),
    a: L('לא. אפשר לסמן כשרות ולבחור מי נותן את ההשגחה: רבנות, מהדרין, בד״ץ, צהר, השגחה פרטית, או "לא ידוע". צילום של התעודה לא חובה, אבל הוא מחזק את המידע, והפרטים נקראים ממנו אוטומטית.',
      'No. You can mark a place kosher and choose who supervises it: Rabbinate, Mehadrin, Badatz, Tzohar, private supervision, or "unknown". A photo of the certificate is optional, but it makes the information stronger, and the details are read from it automatically.'),
  },
  {
    q: L('יש גם מידע על אלרגיות?', 'Is there allergy info too?'),
    a: L('כן. אפשר לסנן ולהוסיף מידע על בלי חלב, בלי ביצים, בלי בוטנים, בלי אגוזים, בלי שומשום ובלי סויה. באלרגיה חמורה תמיד כדאי לשאול גם במקום.',
      'Yes. You can filter and add information about dairy-free, egg-free, peanut-free, nut-free, sesame-free and soy-free. With a serious allergy, always ask on site too.'),
  },
  {
    q: L('מה קורה אם מישהו מוסיף מקום שגוי?', 'What if someone adds a wrong place?'),
    a: L('מקום חדש מופיע במפה מיד, עם סימון "ממתין לאישור". כל אחד יכול לדווח עליו. אחרי שלושה דיווחים הוא עובר לבדיקה, ורק מאשר קהילה או מנהל יכולים להסיר אותו. מי שהוסיף יותר מ-5 מקומות או אישר יותר מ-10 דברים הופך למאשר קהילה.',
      'A new place appears on the map right away, marked "waiting for confirmation". Anyone can report it. After three reports it goes to review, and only a community moderator or an admin can remove it. Someone who added more than 5 places or confirmed more than 10 things becomes a community moderator.'),
  },
  {
    q: L('מה זה "אושר על ידי בעל העסק"?', 'What does "confirmed by the business owner" mean?'),
    a: L('בעל עסק יכול לאמת את המקום שלו: הוא מקבל קוד, מפרסם אותו לזמן קצר באתר או בעמוד הרשמי של העסק ברשתות, ומנהל בודק שהקוד באמת שם. כך אי אפשר להתחזות לבעל העסק.',
      "A business owner can verify their place: they get a code, post it for a short while on the business's website or official social page, and an admin checks the code is really there. That way nobody can pretend to be the owner."),
  },
  {
    q: L('מה רואים אחרים בפרופיל שלי?', 'What can others see on my profile?'),
    a: L('את השם ותמונת הפרופיל מהחשבון שהתחברת איתו, מתי הצטרפת, ומה הוספת ואישרת. כתובת המייל לא מופיעה אף פעם.',
      'The name and picture from the account you signed in with, when you joined, and what you added and confirmed. Your e-mail address is never shown.'),
  },
  {
    q: L('צריך להירשם?', 'Do I need to sign up?'),
    a: L('לא. אפשר להוסיף ולאשר בלי חשבון. ההתחברות רק שומרת את מה שעשיתם, גם כשנכנסים ממכשיר אחר.',
      'No. You can add and confirm without an account. Signing in just keeps what you did, even on another device.'),
  },
  {
    q: L('איך עובד הניווט?', 'How does navigation work?'),
    a: L('בוחרים מקום, בוחרים ברגל, באופניים או ברכב, ולוחצים "יציאה לדרך". המפה עוקבת אחריכם ומקריאה בקול כל פנייה. אפשר להשתיק את הקול בכל רגע.',
      'Choose a place, choose walking, cycling or driving, and tap "Start". The map follows you and reads every turn aloud. You can mute it at any time.'),
  },
  {
    q: L('אפשר לסמוך על זה לגמרי?', 'Can I rely on it completely?'),
    a: L('המידע נבדק על ידי הקהילה, ומוצג יחד עם התאריך ומספר המאשרים. ובכל זאת, ברגישות גבוהה כמו צליאקיה או כשרות מחמירה, כדאי תמיד לוודא גם במקום.',
      'The information is checked by the community and shown with the date and the number of people who confirmed it. Still, for high sensitivity such as celiac disease or strict kashrut, always double-check on site.'),
  },
];

export default async function About() {
  const L = await serverL();
  const JOURNEY = journeyOf(L);
  const FAQ = faqOf(L);
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root>
        <section className="hero small">
          <div className="hero-inner">
            <span className="hero-emoji" aria-hidden="true">💡</span>
            <h1>{L('איך זה עובד', 'How it works')}</h1>
            <p className="lead">{L('Okeat (מבטאים "אוקיי-איט") בא מ-OK to eat: בטוח לי לאכול כאן? כל מידע באתר עובר בדיקה של אנשים שהיו במקום.', 'Okeat (say "okay-eat") comes from OK to eat: is it safe for me to eat here? Every piece of information is checked by people who were there.')}</p>
          </div>
        </section>

        <section className="section" aria-labelledby="journey-h">
          <h2 id="journey-h" className="section-title">{L('הדרך של כל פיסת מידע', 'The journey of every piece of information')}</h2>
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
          <h2 id="seals-h" className="section-title">{L('מה אומרות החותמות', 'What the seals mean')}</h2>
          <ul className="legend-grid">
            <li><span className="seal k" aria-hidden="true"><span>{L('כ', 'K')}</span></span><span><b>{L('כשר', 'Kosher')}</b> {L('עם צילום תעודה', 'with a certificate photo')}</span></li>
            <li><span className="seal v" aria-hidden="true"><span>{L('ט', 'V')}</span></span><span><b>{L('טבעוני', 'Vegan')}</b></span></li>
            <li><span className="seal h" aria-hidden="true"><span>{L('צ', 'Vg')}</span></span><span><b>{L('צמחוני', 'Vegetarian')}</b> {L('בלי בשר ודגים, בכל המקום או בחלק מהמנות.', 'No meat or fish, in the whole place or in some dishes.')}</span></li>
            <li><span className="seal g" aria-hidden="true"><span>{L('ג', 'G')}</span></span><span><b>{L('ללא גלוטן', 'Gluten-free')}</b></span></li>
            <li><span className="seal k soft" aria-hidden="true"><span>{L('כ', 'K')}</span></span><span><b>{L('חותמת בהירה:', 'Light seal:')}</b> {L('מ-OpenStreetMap, עוד לא אושר באתר', 'from OpenStreetMap, not confirmed on the site yet')}</span></li>
            <li><span className="seal x pending" aria-hidden="true"><span>?</span></span><span><b>{L('ממתין לאישור', 'Waiting for confirmation')}</b> {L('הקהילה', 'by the community')}</span></li>
          </ul>
        </section>

        <section className="section" aria-labelledby="faq-h">
          <h2 id="faq-h" className="section-title">{L('שאלות נפוצות', 'Frequently asked questions')}</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="who-h">
          <div className="builder">
            <span className="builder-emoji" aria-hidden="true">👩‍💻</span>
            <div>
              <h2 id="who-h" className="section-title">{L('מי בנה את האתר', 'Who built the site')}</h2>
              <p>{L('Okeat תוכנן ונבנה על ידי נויה אדיבי, סטודנטית למדעי המחשב, כפרויקט אישי: מפה קהילתית שעוזרת למצוא איפה באמת אפשר לאכול.', 'Okeat was designed and built by Noya Adivi, a computer science student, as a personal project: a community map that helps people find where they can really eat.')}</p>
              <a className="cta" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">💼</span> {L('ליצירת קשר בלינקדאין', 'Contact me on LinkedIn')}
              </a>
            </div>
          </div>
        </section>

        <section className="section center">
          <Link href="/map" className="cta primary"><span aria-hidden="true">🗺️</span> {L('למפה', 'To the map')}</Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
