import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import LegalNav from '@/components/LegalNav';
import { getLang } from '@/lib/lang-server';

import { SITE } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Accessibility statement | Okeat' : 'הצהרת נגישות | Okeat' };
}

// The regulations ask for direct contact details of whoever handles accessibility: set SITE.email in src/lib/site.ts.
const UPDATED = SITE.updated;

export default async function AccessibilityStatement() {
  const lang = await getLang();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        <LegalNav />
        {lang === 'en' ? <StatementEn /> : <StatementHe />}
      </main>
      <SiteFooter />
    </div>
  );
}

function StatementHe() {
  return (
    <>
      <h1>הצהרת נגישות</h1>
      <p>אנחנו רוצים ש-Okeat יהיה נוח לכל אחד, כולל אנשים עם מוגבלות. האתר הותאם, ככל האפשר, לתקן הישראלי ת&quot;י 5568 ולהנחיות הבינלאומיות WCAG 2.1 ברמה AA, לפי תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות). האתר לא עבר בדיקה של מורשה נגישות חיצוני, ולכן ייתכן שיש בו דברים שעדיין לא נגישים. אנחנו ממשיכים לשפר אותו.</p>

      <h2>מה יש באתר</h2>
      <ul>
        <li>תפריט נגישות בצד המסך, בכל דף: הגדלת טקסט, ניגודיות גבוהה, מצב כהה או בהיר, עצירת אנימציות, הדגשת קישורים וגופן קריא.</li>
        <li>הקראה בקול של הדף, או של כל טקסט שלוחצים עליו, עם כפתור הפסקה שמופיע בזמן ההקראה.</li>
        <li>הנחיות קוליות בזמן ניווט.</li>
        <li>האתר בנוי כך שאפשר להשתמש בו עם מקלדת בלבד, ויש קישור &quot;דילוג לתוכן&quot; בתחילת כל דף.</li>
        <li>התאמה לקוראי מסך: כפתורים, טפסים ותמונות מתוארים בטקסט.</li>
        <li>עברית ואנגלית, כל אחת בכיוון הקריאה הנכון.</li>
        <li>האתר מכבד את הגדרות המכשיר: מצב כהה והפחתת תנועה.</li>
      </ul>

      <h2>מגבלות ידועות</h2>
      <ul>
        <li>המפה עצמה היא רכיב גרפי. המידע שמופיע עליה מופיע גם ברשימת המקומות, שאפשר להשתמש בה בלי המפה.</li>
        <li>ההקראה משתמשת בקולות שמותקנים במכשיר. במכשירים בלי קול בעברית ייתכן שההקראה תהיה באנגלית.</li>
        <li>תמונות שמעלים משתמשים, כמו צילומי תעודות, אינן מלוות תמיד בתיאור מלא.</li>
        <li>חלק מהמידע מגיע מ-OpenStreetMap ומהקהילה, ולכן ייתכן שלא כל המקומות מתארים את הנגישות הפיזית שלהם.</li>
      </ul>

      <h2>נתקלתם בבעיה?</h2>
      <p>אם משהו באתר לא נגיש לכם, נשמח לשמוע ולתקן. כדאי לציין באיזה דף הבעיה, מה ניסיתם לעשות, ובאיזה מכשיר ודפדפן השתמשתם.</p>
      <p><b>האחראית על הנגישות:</b> נויה אדיבי</p>
      <ul>
        {SITE.email && <li>מייל: <a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>}
        <li><Link href="/contact?topic=accessibility">טופס יצירת הקשר</Link></li>
        <li><a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">נויה אדיבי בלינקדאין</a></li>
      </ul>
      <p>נחזור אליכם תוך 14 ימי עבודה.</p>

      <p className="muted">ההצהרה עודכנה ב-{UPDATED}.</p>
    </>
  );
}

function StatementEn() {
  return (
    <>
      <h1>Accessibility statement</h1>
      <p>We want Okeat to be comfortable for everyone, including people with disabilities. The site has been adapted, as far as possible, to the Israeli standard IS 5568 and the international WCAG 2.1 guidelines at level AA, following the Israeli Equal Rights for Persons with Disabilities (Service Accessibility) Regulations. The site has not been reviewed by an outside accessibility expert, so some things may not be accessible yet. We keep improving it.</p>

      <h2>What the site offers</h2>
      <ul>
        <li>An accessibility menu on the side of the screen, on every page: larger text, high contrast, dark or light mode, stopping animations, highlighted links and a readable font.</li>
        <li>Reading the page aloud, or any text you click on, with a stop button that appears while it reads.</li>
        <li>Voice directions while navigating.</li>
        <li>The site is built to be usable with a keyboard only, and there is a &quot;Skip to content&quot; link at the top of every page.</li>
        <li>Screen reader support: buttons, forms and images are described in text.</li>
        <li>Hebrew and English, each with the right reading direction.</li>
        <li>The site respects the device settings: dark mode and reduced motion.</li>
      </ul>

      <h2>Known limitations</h2>
      <ul>
        <li>The map itself is a graphic element. The information shown on it also appears in the list of places, which can be used without the map.</li>
        <li>Reading aloud uses the voices installed on the device. On devices without a Hebrew voice, it may read in English.</li>
        <li>Photos users upload, such as certificate photos, don&apos;t always come with a full description.</li>
        <li>Some information comes from OpenStreetMap and the community, so not every place describes its physical accessibility.</li>
      </ul>

      <h2>Found a problem?</h2>
      <p>If something on the site isn&apos;t accessible to you, we&apos;d be glad to hear about it and fix it. It helps to mention which page, what you tried to do, and which device and browser you used.</p>
      <p><b>Accessibility contact:</b> Noya Adivi</p>
      <ul>
        {SITE.email && <li>Email: <a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>}
        <li><Link href="/contact?topic=accessibility">Contact form</Link></li>
        <li><a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">Noya Adivi on LinkedIn</a></li>
      </ul>
      <p>We will get back to you within 14 working days.</p>

      <p className="muted">This statement was updated on {UPDATED}.</p>
    </>
  );
}
