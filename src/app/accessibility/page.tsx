import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getLang } from '@/lib/lang-server';

import { SITE } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Accessibility statement | Okeat' : 'הצהרת נגישות | Okeat' };
}

// The law requires a way to reach whoever handles accessibility: fill in src/lib/site.ts.
const UPDATED = SITE.updated;

export default async function AccessibilityStatement() {
  const lang = await getLang();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
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
          <p>אנחנו רוצים ש-Okeat יהיה נוח לכל אחד, כולל אנשים עם מוגבלות. האתר נבנה לפי התקן הישראלי 5568 וההנחיות הבינלאומיות WCAG 2.1 ברמה AA, במידה האפשרית.</p>
  
          <h2>מה יש באתר</h2>
          <ul>
            <li>תפריט נגישות בצד המסך, בכל דף: הגדלת טקסט, ניגודיות גבוהה, מצב כהה או בהיר, עצירת אנימציות, הדגשת קישורים וגופן קריא.</li>
            <li>הקראה בקול של הדף, או של כל טקסט שלוחצים עליו, עם כפתור הפסקה שמופיע בזמן ההקראה.</li>
            <li>הנחיות קוליות בזמן ניווט.</li>
            <li>אפשר להשתמש בכל האתר עם מקלדת בלבד. יש קישור "דילוג לתוכן" בתחילת כל דף.</li>
            <li>תמיכה בקוראי מסך: כפתורים, טפסים ותמונות מתוארים בטקסט.</li>
            <li>עברית ואנגלית, כל אחת בכיוון הקריאה הנכון.</li>
              <li>האתר מכבד את הגדרות המכשיר: מצב כהה והפחתת תנועה.</li>
          </ul>
  
          <h2>מגבלות ידועות</h2>
          <ul>
            <li>המפה עצמה היא רכיב גרפי. כל המידע שמופיע עליה מופיע גם ברשימה שליד המפה, שנגישה לגמרי.</li>
            <li>ההקראה משתמשת בקולות שמותקנים במכשיר. במכשירים בלי קול בעברית ייתכן שההקראה תהיה באנגלית.</li>
            <li>חלק מהמידע מגיע מ-OpenStreetMap ומהקהילה, ולכן ייתכן שלא כל המקומות מתארים את הנגישות הפיזית שלהם.</li>
          </ul>
  
          <h2>נתקלתם בבעיה?</h2>
          <p>נשמח לשמוע ולתקן. אפשר לכתוב לנו ב<Link href="/contact?topic=accessibility">טופס יצירת הקשר</Link>, או ל<a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">נויה אדיבי בלינקדאין</a>. נחזור אליכם תוך 14 ימי עבודה.</p>
  
          <p className="muted">ההצהרה עודכנה ב-{UPDATED}.</p>
    </>
  );
}

function StatementEn() {
  return (
    <>
          <h1>Accessibility statement</h1>
          <p>We want Okeat to be comfortable for everyone, including people with disabilities. The site was built to follow the Israeli standard IS 5568 and the international WCAG 2.1 guidelines at level AA, as far as possible.</p>

          <h2>What the site offers</h2>
          <ul>
            <li>An accessibility menu on the side of the screen, on every page: larger text, high contrast, dark or light mode, stopping animations, highlighted links and a readable font.</li>
            <li>Reading the page aloud, or any text you click on, with a stop button that appears while it reads.</li>
            <li>Voice directions while navigating.</li>
            <li>The whole site can be used with a keyboard only. There is a &quot;Skip to content&quot; link at the top of every page.</li>
            <li>Screen reader support: buttons, forms and images are described in text.</li>
            <li>Hebrew and English, each with the right reading direction.</li>
            <li>The site respects the device settings: dark mode and reduced motion.</li>
          </ul>

          <h2>Known limitations</h2>
          <ul>
            <li>The map itself is a graphic element. Everything shown on it also appears in the list next to the map, which is fully accessible.</li>
            <li>Reading aloud uses the voices installed on the device.</li>
            <li>Some information comes from OpenStreetMap and the community, so not every place describes its physical accessibility.</li>
          </ul>

          <h2>Found a problem?</h2>
          <p>We&apos;d be glad to hear about it and fix it. Write to us using the <Link href="/contact?topic=accessibility">contact form</Link>, or to <a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">Noya Adivi on LinkedIn</a>. We will get back to you within 14 working days.</p>

          <p className="muted">This statement was updated on {UPDATED}.</p>
    </>
  );
}
