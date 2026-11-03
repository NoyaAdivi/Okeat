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
  { emoji: '⏰', title: L('נשאר עדכני', 'It stays up to date'), text: L('תעודה שפג תוקפה מסומנת לבד, ופרט שלא אושר יותר משנה מסומן לבדיקה. אם שלושה אנשים מדווחים שמשהו כבר לא נכון, הוא יורד.', 'An expired certificate is flagged automatically, and a detail not confirmed for over a year is marked for checking. If three people report something is no longer true, it comes down.') },
];

const faqOf = (L: T) => [
  {
    q: L('מאיפה מגיע המידע?', 'Where does the information come from?'),
    a: L('משלושה מקורות: אנשים שמוסיפים ומאשרים מידע באתר, המאגרים הפתוחים OpenStreetMap ו-Overture Maps, וסיווג אוטומטי לפי שם המקום וסוגו. מידע שעוד לא אושר באתר מסומן במפורש.',
      'Three sources: people who add and confirm information on the site, the open databases OpenStreetMap and Overture Maps, and automatic classification by the name and type of each place. Anything not yet confirmed on the site is clearly labelled.'),
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
    a: L('מקום חדש מופיע במפה מיד, עם סימון "ממתין לאישור". כל אחד יכול לדווח עליו. אחרי שלושה דיווחים הוא עובר לבדיקה, ורק מאשר קהילה או מנהל יכולים להסיר אותו. מאשרי קהילה ממונים אישית על ידי מנהלת האתר.',
      'A new place appears on the map right away, marked "waiting for confirmation". Anyone can report it. After three reports it goes to review, and only a community moderator or an admin can remove it. Community moderators are appointed personally by the site admin.'),
  },
  {
    q: L('מה זה "אושר על ידי בעל העסק"?', 'What does "confirmed by the business owner" mean?'),
    a: L('בעל עסק יכול לאמת את המקום שלו: הוא מקבל קוד, מפרסם אותו לזמן קצר באתר או בעמוד הרשמי של העסק ברשתות, ומנהל בודק שהקוד באמת שם. כך אי אפשר להתחזות לבעל העסק. בעל עסק מאומת יכול גם לעדכן שעות, טלפון, אתר וקישור לתפריט.',
      "A business owner can verify their place: they get a code, post it for a short while on the business's website or official social page, and an admin checks the code is really there. That way nobody can pretend to be the owner. A verified owner can also update hours, phone, website and a menu link."),
  },
  {
    q: L('מה רואים אחרים בפרופיל שלי?', 'What can others see on my profile?'),
    a: L('את השם ותמונת הפרופיל, האוכל האהוב אם כתבת אותו, מתי הצטרפת, ומה הוספת ואישרת. ביקורת שכתבת מוצגת עם השם שלך. כתובת המייל לא מוצגת למשתמשים אחרים, ורק מנהלת האתר רואה אותה. רשימת המקומות ששמרת גלויה רק לך.',
      'Your name and picture, your favorite food if you added it, when you joined, and what you added and confirmed. A review you write is shown with your name. Your e-mail address is not shown to other users, and only the site admin can see it. Your saved places are visible only to you.'),
  },
  {
    q: L('צריך להירשם?', 'Do I need to sign up?'),
    a: L('כדי לחפש ולראות מידע לא צריך להירשם. כדי להוסיף, לאשר, לתקן או לדווח צריך להתחבר עם Google או מייל, וכך המידע באתר נשאר אמין. ההתחברות גם שומרת את מה שעשיתם, כשנכנסים ממכשיר אחר.',
      'To search and see information, no account is needed. To add, confirm, fix or report, sign in with Google or email, which keeps the site reliable. Signing in also keeps what you did when you use another device.'),
  },
  {
    q: L('מה אפשר לעשות חוץ מלאשר מידע?', 'What else can I do besides confirming?'),
    a: L('אפשר לכתוב ביקורת עם דירוג של 1 עד 5 כוכבים, לשמור מקומות שאהבתם, ליצור רשימות ולשתף אותן בקישור, ולהעלות תמונות של המקום. תמונה מופיעה אחרי אישור של מנהל, ואם ביקורת פוגענית אפשר לדווח עליה.',
      'You can write a review with a rating of 1 to 5 stars, save places you like, make lists and share them with a link, and add photos of the place. A photo appears after a moderator approves it, and an offensive review can be reported.'),
  },
  {
    q: L('איך מחפשים נכון?', 'How do I search?'),
    a: L('אפשר לכתוב שם של מקום או עיר, או משפט שלם כמו "פיצה כשרה פתוחה עכשיו ברמת גן". כשהאתר מבין את החיפוש, מופיע כפתור שמסנן לפיו. אפשר גם לבחור סינון קבוע, והוא יישמר רק במכשיר שלכם.',
      'Type the name of a place or a city, or a whole sentence like "kosher pizza open now in Ramat Gan". When the site understands it, a button appears that filters by it. You can also keep a filter on, and it stays only on your device.'),
  },
  {
    q: L('אילו התראות אקבל?', 'What notifications will I get?'),
    a: L('בפרופיל תראו כשמידע שהוספתם אושר, וכשתעודת כשרות שהעליתם עומדת להסתיים. ההתראות מופיעות באתר, ולא נשלחות במייל.',
      "On your profile you'll see when your information is confirmed, and when a kosher certificate you added is about to end. Notifications appear on the site and aren't sent by email."),
  },
  {
    q: L('מה אומרים התגים בפרופיל?', 'What do the profile badges mean?'),
    a: L('תגים מוענקים אוטומטית על עזרה לקהילה: 10 אישורים למאשר/ת פעיל/ה, 5 מקומות למגלה מקומות, 10 פרטי מידע למוסיף/ה מידע ו-5 ביקורות למבקר/ת.',
      'Badges are given automatically for helping the community: 10 confirmations for an active confirmer, 5 places for a place finder, 10 details for an info helper and 5 reviews for a reviewer.'),
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
            <li><span className="seal k" aria-hidden="true"><span>{L('כ', 'K')}</span></span><span><b>{L('כשר:', 'Kosher:')}</b> {L('יש השגחת כשרות, עם תעודה או בלי.', 'Under kosher supervision, with or without a certificate photo.')}</span></li>
            <li><span className="seal v" aria-hidden="true"><span>{L('ט', 'V')}</span></span><span><b>{L('טבעוני:', 'Vegan:')}</b> {L('מנות בלי מוצרים מן החי, בכל המקום או בחלק מהתפריט.', 'Dishes with no animal products, in the whole place or part of the menu.')}</span></li>
            <li><span className="seal h" aria-hidden="true"><span>{L('צ', 'Vg')}</span></span><span><b>{L('צמחוני:', 'Vegetarian:')}</b> {L('בלי בשר ודגים, בכל המקום או בחלק מהתפריט.', 'No meat or fish, in the whole place or part of the menu.')}</span></li>
            <li><span className="seal g" aria-hidden="true"><span>{L('ג', 'G')}</span></span><span><b>{L('ללא גלוטן:', 'Gluten-free:')}</b> {L('תפריט ללא גלוטן או מטבח נפרד.', 'A gluten-free menu or a separate kitchen.')}</span></li>
            <li><span className="seal e" aria-hidden="true"><span>{L('א', 'A')}</span></span><span><b>{L('אלרגיות:', 'Allergies:')}</b> {L('בלי חלב, ביצים, בוטנים, אגוזים, שומשום או סויה. באלרגיה חמורה תמיד כדאי לשאול במקום.', 'Free of dairy, egg, peanuts, nuts, sesame or soy. With a serious allergy, always ask on site.')}</span></li>
            <li><span className="seal k soft" aria-hidden="true"><span>{L('כ', 'K')}</span></span><span><b>{L('חותמת בהירה:', 'Light seal:')}</b> {L('מידע ממאגר פתוח או סיווג אוטומטי, שעוד לא אושר על ידי הקהילה.', 'From an open database or an automatic guess, not yet confirmed by the community.')}</span></li>
            <li><span className="seal x pending" aria-hidden="true"><span>{L('?', '?')}</span></span><span><b>{L('ממתין לאישור:', 'Waiting for confirmation:')}</b> {L('מישהו הוסיף את המידע, ועכשיו מחכים לאישור של הקהילה.', 'Someone added this, and it is waiting for the community to confirm it.')}</span></li>
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
