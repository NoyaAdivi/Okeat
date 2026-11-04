import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader, LINKEDIN_URL } from '@/components/SiteChrome';
import { getLang, serverL } from '@/lib/lang-server';
import TapSeal from '@/components/TapSeal';
import FaqList from '@/components/FaqList';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'How it works | Okeat' : 'איך זה עובד | Okeat' };
}

type T = (he: string, en: string) => string;

// The life of one piece of information, in order.
const journeyOf = (L: T) => [
  { emoji: '➕', title: L('מישהו מוסיף', 'Someone adds it'), text: L('למשל "המקום הזה טבעוני לגמרי".', 'For example "this place is fully vegan". For kosher, a photo of the certificate can be added to make it stronger.') },
  { emoji: '👀', title: L('אחרים מאשרים', 'Others confirm'), text: L('מי שהיה במקום לוחץ "נכון, הייתי שם".', 'People who were there tap "True, I saw it myself". You can\'t confirm something you added yourself.') },
  { emoji: '✅', title: L('מאושר', 'It gets confirmed'), text: L('אחרי שלושה אישורים המידע מסומן כמאושר, ומופיע בסינון.', 'After three confirmations it is marked as confirmed and shows up in the filters.') },
  { emoji: '⏰', title: L('נשאר עדכני', 'It stays up to date'), text: L('תעודה שפג תוקפה מסומנת לבד. אם שלושה אנשים מדווחים שמשהו לא נכון, זה עובר לבדיקה.', 'An expired certificate is flagged automatically, and a detail not confirmed for over a year is marked for checking. If three people report something is no longer true, it goes to the community moderators for review.') },
];

const faqOf = (L: T) => [
  {
    group: 'data',
    q: L('מאיפה מגיע המידע?', 'Where does the information come from?'),
    a: L('משלושה מקורות: אנשים שמוסיפים ומאשרים מידע באתר, המאגרים הפתוחים OpenStreetMap ו-Overture Maps, וסיווג אוטומטי לפי שם המקום וסוגו. מידע שעוד לא אושר באתר מסומן במפורש.',
      'Three sources: people who add and confirm information on the site, the open databases OpenStreetMap and Overture Maps, and automatic classification by the name and type of each place. Anything not yet confirmed on the site is clearly labelled.'),
  },
  {
    group: 'data',
    q: L('למה אין כאן את כל המסעדות שיש בגוגל או באיזי?', "Why aren't all the restaurants from Google or other apps here?"),
    a: L('המידע באתרים האלה שייך להם, ואסור להעתיק אותו. לכן אנחנו בונים מאגר משלנו, פתוח וקהילתי. כל מקום שאתם מוסיפים עוזר לכולם.',
      'That information belongs to them and may not be copied. So we are building our own open, community database. Every place you add helps everyone.'),
  },
  {
    group: 'kosher',
    q: L('מה ההבדל בין "כשר" ל"מפוקח"?', 'What is the difference between "kosher" and "supervised"?'),
    a: L('לפי החוק בישראל, רק עסק עם תעודה מהרבנות מוצג ככשר. עסק עם השגחה פרטית, כמו צהר, מוצג כ"מפוקח". אנחנו מציגים את שניהם, וכותבים בבירור מה ההבדל.',
      'By Israeli law, only a business with a Rabbinate certificate is presented as kosher. A business with private supervision, such as Tzohar, is shown as "supervised". We show both and say clearly what the difference is.'),
  },
  {
    group: 'kosher',
    q: L('מה זה "מסומן ככשר"?', 'What does "marked kosher" mean?'),
    a: L('מקום שמופיע ככשר במאגר פתוח, אבל עוד אין באתר צילום של התעודה שלו. אם אתם שם, צלמו את התעודה ועזרו לכולם.',
      "A place listed as kosher in an open database, but with no photo of its certificate on the site yet. If you're there, photograph the certificate and help everyone."),
  },
  {
    group: 'data',
    q: L('מה זה "סיווג אוטומטי"?', 'What is an "automatic guess"?'),
    a: L('כשאין עדיין מידע על מקום, המחשב מנחש לפי השם שלו: "פיצה" בשם הופך לפיצרייה, "טבעוני" לטבעוני וכן הלאה. ליד כל ניחוש כזה כתוב שהוא לא מאושר, עד שאנשים שהיו במקום יאשרו אותו.',
      'When there is no information about a place yet, the computer guesses from its name: "pizza" in the name makes it a pizzeria, "vegan" makes it vegan, and so on. Every guess like this says it is not confirmed until people who were there confirm it.'),
  },
  {
    group: 'kosher',
    q: L('צריך צילום של תעודת הכשרות?', 'Do I need a photo of the kosher certificate?'),
    a: L('לא. אפשר לסמן כשרות ולבחור מי נותן את ההשגחה: רבנות, מהדרין, בד״ץ, צהר, השגחה פרטית, או "לא ידוע". צילום של התעודה לא חובה, אבל הוא מחזק את המידע, והפרטים נקראים ממנו אוטומטית.',
      'No. You can mark a place kosher and choose who supervises it: Rabbinate, Mehadrin, Badatz, Tzohar, private supervision, or "unknown". A photo of the certificate is optional, but it makes the information stronger, and the details are read from it automatically.'),
  },
  {
    group: 'kosher',
    q: L('יש גם מידע על אלרגיות?', 'Is there allergy info too?'),
    a: L('כן. אפשר לסנן ולהוסיף מידע על בלי חלב, בלי ביצים, בלי בוטנים, בלי אגוזים, בלי שומשום ובלי סויה. באלרגיה חמורה תמיד כדאי לשאול גם במקום.',
      'Yes. You can filter and add information about dairy-free, egg-free, peanut-free, nut-free, sesame-free and soy-free. With a serious allergy, always ask on site too.'),
  },
  {
    group: 'trust',
    q: L('מה קורה אם מישהו מוסיף מקום שגוי?', 'What if someone adds a wrong place?'),
    a: L('מקום חדש מופיע במפה מיד, עם סימון "ממתין לאישור". כל משתמש מחובר יכול לדווח עליו. דיווח שהמקום נסגר, לא קיים, בכתובת לא נכונה או לא קשור לאוכל מגיע ישר למנהלים, ודיווח אחר אחרי שלושה דיווחים. רק מאשר קהילה או מנהל יכולים להסיר מקום. מאשרי קהילה ממונים אישית על ידי מנהלת האתר.',
      'A new place appears on the map right away, marked "waiting for confirmation". Any signed-in user can report it. A report that it closed, does not exist, has a wrong address or is not a food place goes straight to the moderators, and other reports after three. Only a community moderator or an admin can remove a place. Community moderators are appointed personally by the site admin.'),
  },
  {
    group: 'trust',
    q: L('מה זה "אושר על ידי בעל העסק"?', 'What does "confirmed by the business owner" mean?'),
    a: L('בעל עסק יכול לאמת את המקום שלו: הוא מקבל קוד, מפרסם אותו לזמן קצר באתר או בעמוד הרשמי של העסק ברשתות, ומנהל בודק שהקוד באמת שם. כך אי אפשר להתחזות לבעל העסק. בעל עסק מאומת יכול גם לעדכן שעות, טלפון, אתר וקישור לתפריט.',
      "A business owner can verify their place: they get a code, post it for a short while on the business's website or official social page, and an admin checks the code is really there. That way nobody can pretend to be the owner. A verified owner can also update hours, phone, website and a menu link."),
  },
  {
    group: 'use',
    q: L('למה האתר שואל על המיקום שלי?', 'Why does the site ask for my location?'),
    a: L('כדי להראות מה קרוב אליכם ולחשב כמה זמן לוקח להגיע. השאלה מופיעה רק כשנכנסים למפה, והמיקום לא נשמר אצלנו. בלי מיקום אפשר לבחור עיר או כתובת ב-📍, ואם בחרתם מקום, המרחק נמדד ממנו.',
      'To show what is near you and how long it takes to get there. It is asked only on the map, and we do not store your location. Without it you can choose a city or an address with 📍, and the distance is then measured from there.'),
  },
  {
    group: 'account',
    q: L('אפשר לערוך או למחוק את מה שהוספתי?', 'Can I edit or delete what I added?'),
    a: L('כן. בחשבון, תחת "הפעילות שלי", מופיע כל מה שהוספתם, ואפשר לערוך או למחוק משם. מידע שנערך חוזר לאישור מההתחלה, ועריכה של מקום נשלחת לבדיקה של מנהל. גם אישור שנתתם אפשר לבטל. מקום שאחרים כבר הוסיפו לו מידע אי אפשר למחוק, אבל אפשר לכתוב לנו.',
      'Yes. On your account, under "My activity", you will find everything you added, and you can edit or delete it from there. Edited information starts its confirmation again, and an edited place goes to an admin for review. You can also take back a confirmation. A place others have already added to cannot be deleted, but you can write to us.'),
  },
  {
    group: 'account',
    q: L('מה רואים אחרים בפרופיל שלי?', 'What can others see on my profile?'),
    a: L('את השם ותמונת הפרופיל, האוכל האהוב אם כתבת אותו, מתי הצטרפת, ומה הוספת, אישרת וכתבת. ביקורת שכתבת מוצגת עם השם שלך. כתובת המייל לא מוצגת למשתמשים אחרים, ורק מנהלת האתר רואה אותה. המקומות ששמרת גלויים רק לך.',
      'Your name and picture, your favorite food if you added it, when you joined, and what you added, confirmed and wrote. A review you write is shown with your name. Your e-mail address is not shown to other users, and only the site admin can see it. Your saved places are visible only to you.'),
  },
  {
    group: 'account',
    q: L('צריך להירשם?', 'Do I need to sign up?'),
    a: L('כדי לחפש ולראות מידע לא צריך להירשם. כדי להוסיף, לאשר, לתקן או לדווח צריך להתחבר עם Google או מייל, וכך המידע באתר נשאר אמין. ההתחברות גם שומרת את מה שעשיתם, כשנכנסים ממכשיר אחר.',
      'To search and see information, no account is needed. To add, confirm, fix or report, sign in with Google or email, which keeps the site reliable. Signing in also keeps what you did when you use another device.'),
  },
  {
    group: 'use',
    q: L('מה אפשר לעשות חוץ מלאשר מידע?', 'What else can I do besides confirming?'),
    a: L('אפשר לכתוב ביקורת עם דירוג של 1 עד 5 כוכבים, לשמור מקומות שאהבתם, ליצור רשימות ולשתף אותן בקישור, להעלות תמונות, ולהציע שינוי אם סוג המקום לא נכון. תמונה והצעת סיווג מופיעות אחרי אישור של מנהל, ואם ביקורת פוגענית אפשר לדווח עליה.',
      'You can write a review with a rating of 1 to 5 stars, save places you like, make lists and share them with a link, add photos, and suggest a change if the type of place is wrong. Photos and suggestions appear after a moderator approves them, and an offensive review can be reported.'),
  },
  {
    group: 'use',
    q: L('אפשר להתקין את Okeat בטלפון?', 'Can I install Okeat on my phone?'),
    a: L('כן. באייפון, ב-Safari או ב-Chrome: לוחצים על כפתור השיתוף ואז על "הוספה למסך הבית". באנדרואיד, ב-Chrome או בדפדפן של סמסונג: פותחים את התפריט ולוחצים על "התקנת אפליקציה" או "הוספה למסך הבית".',
      'Yes. On iPhone, in Safari or Chrome: tap the Share button, then "Add to Home Screen". On Android, in Chrome or Samsung Internet: open the menu, then tap "Install app" or "Add to Home screen".'),
  },
  {
    group: 'use',
    q: L('איך מחפשים נכון?', 'How do I search?'),
    a: L('אפשר לכתוב שם של מקום, או משפט שלם כמו "בא לי פיצה כשרה שפתוחה עכשיו", והאתר מסנן לבד. אם כתבתם גם עיר, מופיע כפתור שמעביר אתכם אליה. סינון שאתם משתמשים בו תמיד אפשר לשמור, והוא נשאר רק במכשיר שלכם.',
      'Type the name of a place, or a whole sentence like "kosher pizza open now", and the site filters by itself. If you also name a city, a button takes you there. A filter you always use can be saved, and it stays only on your device.'),
  },
  {
    group: 'account',
    q: L('אילו התראות אקבל?', 'What notifications will I get?'),
    a: L('בפרופיל תראו כשמישהו אישר מידע שהוספתם, כשהמידע אושר, וכשתעודת כשרות שהעליתם עומדת להסתיים. ההתראות מופיעות באתר, ולא נשלחות במייל.',
      "On your profile you'll see when someone confirms what you added, when your information is confirmed, and when a kosher certificate you added is about to end. Notifications appear on the site and aren't sent by email."),
  },
  {
    group: 'account',
    q: L('מה אומרים התגים בפרופיל?', 'What do the profile badges mean?'),
    a: L('תגים הם סמלים קטנים בפרופיל, שמופיעים לבד כשעוזרים לאחרים. יש ארבעה: מאשר/ת פעיל/ה אחרי 10 אישורים, מגלה מקומות אחרי 5 מקומות שהוספתם, מוסיף/ה מידע אחרי 10 פרטי מידע, ומבקר/ת אחרי 5 ביקורות.',
      'Badges are small marks on your profile that appear by themselves when you help others. There are four: active confirmer after 10 confirmations, place finder after 5 places you added, info helper after 10 details, and reviewer after 5 reviews.'),
  },
  {
    group: 'use',
    q: L('איך עובד הניווט?', 'How does navigation work?'),
    a: L('פותחים מקום, בוחרים איך מגיעים: ברגל, באופניים או ברכב, ולוחצים "יציאה לדרך". המפה עוקבת אחריכם ומקריאה בקול כל פנייה, ואפשר להשתיק אותה בכל רגע. אפשר גם לפתוח את הדרך ב-Waze או ב-Google Maps.',
      'Open a place, choose how you are getting there: walking, cycling or driving, and tap "Start". The map follows you and reads every turn aloud, and you can mute it at any time. You can also open the way in Waze or Google Maps.'),
  },
  {
    group: 'trust',
    q: L('אפשר לסמוך על זה לגמרי?', 'Can I rely on it completely?'),
    a: L('מידע שהקהילה אישרה מוצג יחד עם התאריך ומספר המאשרים, ומידע שעוד לא אושר מסומן בחותמת בהירה. ובכל זאת, ברגישות גבוהה כמו צליאקיה או כשרות מחמירה, כדאי תמיד לוודא גם במקום.',
      'Information the community confirmed is shown with the date and the number of people who confirmed it, and anything not yet confirmed has a pale seal. Still, for high sensitivity such as celiac disease or strict kashrut, always double-check on site.'),
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
            <p className="lead">{L('חותמת מלאה: אנשים אישרו. חותמת בהירה: עוד לא.', 'A full seal: people confirmed it. A pale seal: not yet.')}</p>
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
            <li><TapSeal cls="k">{L('כ', 'K')}</TapSeal><span><b>{L('כשר:', 'Kosher:')}</b> {L('יש השגחת כשרות, עם תעודה או בלי.', 'Under kosher supervision, with or without a certificate photo.')}</span></li>
            <li><TapSeal cls="v">{L('ט', 'V')}</TapSeal><span><b>{L('טבעוני:', 'Vegan:')}</b> {L('מנות בלי מוצרים מן החי, בכל המקום או בחלק מהתפריט.', 'Dishes with no animal products, in the whole place or part of the menu.')}</span></li>
            <li><TapSeal cls="h">{L('צ', 'Vg')}</TapSeal><span><b>{L('צמחוני:', 'Vegetarian:')}</b> {L('בלי בשר ודגים, בכל המקום או בחלק מהתפריט.', 'No meat or fish, in the whole place or part of the menu.')}</span></li>
            <li><TapSeal cls="g">{L('ג', 'G')}</TapSeal><span><b>{L('ללא גלוטן:', 'Gluten-free:')}</b> {L('תפריט ללא גלוטן או מטבח נפרד.', 'A gluten-free menu or a separate kitchen.')}</span></li>
            <li><TapSeal cls="e">{L('א', 'A')}</TapSeal><span><b>{L('אלרגיות:', 'Allergies:')}</b> {L('בלי חלב, ביצים, בוטנים, אגוזים, שומשום או סויה. באלרגיה חמורה תמיד כדאי לשאול במקום.', 'Free of dairy, egg, peanuts, nuts, sesame or soy. With a serious allergy, always ask on site.')}</span></li>
            <li><TapSeal cls="k soft">{L('כ', 'K')}</TapSeal><span><b>{L('חותמת בהירה:', 'Light seal:')}</b> {L('מידע ממאגר פתוח או סיווג אוטומטי, שעוד לא אושר על ידי הקהילה.', 'From an open database or an automatic guess, not yet confirmed by the community.')}</span></li>
            <li><TapSeal cls="x pending">{L('?', '?')}</TapSeal><span><b>{L('ממתין לאישור:', 'Waiting for confirmation:')}</b> {L('מישהו הוסיף את המידע, ועכשיו מחכים לאישור של הקהילה.', 'Someone added this, and it is waiting for the community to confirm it.')}</span></li>
          </ul>
        </section>

        <section className="section" aria-labelledby="faq-h">
          <h2 id="faq-h" className="section-title">{L('שאלות נפוצות', 'Frequently asked questions')}</h2>
          <FaqList items={FAQ} groups={[
            { id: 'use', emoji: '🧭', label: L('שימוש באתר', 'Using the site') },
            { id: 'kosher', emoji: '🍽️', label: L('כשרות ואלרגיות', 'Kosher and allergies') },
            { id: 'data', emoji: '🗺️', label: L('מאיפה המידע', 'Where the info comes from') },
            { id: 'trust', emoji: '✅', label: L('אמינות ועסקים', 'Trust and businesses') },
            { id: 'account', emoji: '👤', label: L('חשבון ופרופיל', 'Account and profile') },
          ]} />
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

        </main>
      <SiteFooter />
    </div>
  );
}
