import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'הצהרת נגישות | Okeat' };

// The law requires a way to reach whoever handles accessibility: fill in src/lib/site.ts.
const UPDATED = SITE.updated;

export default function AccessibilityStatement() {
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        <h1>הצהרת נגישות</h1>
        <p>אנחנו רוצים ש-Okeat יהיה נוח לכל אחד, כולל אנשים עם מוגבלות. האתר נבנה לפי התקן הישראלי 5568 וההנחיות הבינלאומיות WCAG 2.1 ברמה AA, במידה האפשרית.</p>

        <h2>מה יש באתר</h2>
        <ul>
          <li>תפריט נגישות בצד המסך, בכל דף: הגדלת טקסט, ניגודיות גבוהה, מצב כהה או בהיר, עצירת אנימציות, הדגשת קישורים וגופן קריא.</li>
          <li>הקראה בקול של הדף, או של כל טקסט שלוחצים עליו.</li>
          <li>הנחיות קוליות בזמן ניווט.</li>
          <li>אפשר להשתמש בכל האתר עם מקלדת בלבד. יש קישור "דילוג לתוכן" בתחילת כל דף.</li>
          <li>תמיכה בקוראי מסך: כפתורים, טפסים ותמונות מתוארים בטקסט.</li>
          <li>האתר מכבד את הגדרות המכשיר: מצב כהה והפחתת תנועה.</li>
        </ul>

        <h2>מגבלות ידועות</h2>
        <ul>
          <li>המפה עצמה היא רכיב גרפי. כל המידע שמופיע עליה מופיע גם ברשימה שליד המפה, שנגישה לגמרי.</li>
          <li>ההקראה משתמשת בקולות שמותקנים במכשיר. במכשירים בלי קול בעברית ייתכן שההקראה תהיה באנגלית.</li>
          <li>חלק מהמידע מגיע מ-OpenStreetMap ומהקהילה, ולכן ייתכן שלא כל המקומות מתארים את הנגישות הפיזית שלהם.</li>
        </ul>

        <h2>נתקלתם בבעיה?</h2>
        <p>נשמח לשמוע ולתקן. אפשר לכתוב לנו ב<Link href="/contact?topic=accessibility">טופס יצירת הקשר</Link>. נחזור אליכם תוך 14 ימי עבודה.</p>

        <p className="muted">ההצהרה עודכנה ב-{UPDATED}.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
