import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getLang } from '@/lib/lang-server';
import { SITE } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Terms of use | Okeat' : 'תנאי שימוש | Okeat' };
}

// Draft. Have a lawyer review it before the site goes live.
export default async function Terms() {
  const lang = await getLang();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        {lang === 'en' ? <TermsEn /> : <TermsHe />}
      </main>
      <SiteFooter />
    </div>
  );
}

function TermsHe() {
  return (
    <>
          <h1>תנאי שימוש</h1>
          <p className="muted">עודכן ב-{SITE.updated}</p>
  
          <p>ברוכים הבאים ל-{SITE.name} (&quot;האתר&quot;, &quot;אנחנו&quot;). השימוש באתר מהווה הסכמה לתנאים האלה. אם אינכם מסכימים להם, אנא אל תשתמשו באתר. התנאים כתובים בלשון רבים ומתייחסים לכל המגדרים.</p>
  
          <h2>מה האתר עושה</h2>
          <p>{SITE.name} מציג מפה של מקומות אוכל בישראל, ומידע על כשרות, טבעונות, צמחונות, מזון ללא גלוטן ואלרגיות. האתר מופעל על ידי נויה אדיבי באופן פרטי. המידע מגיע משלושה מקורות: משתמשים שמוסיפים ומאשרים מידע, המאגרים הפתוחים OpenStreetMap ו-Overture Maps, וסיווג אוטומטי לפי שם המקום וסוגו. ליד כל פרט מצוין מה מקורו והאם הוא אושר.</p>
  
          <h2>המידע אינו מחליף בדיקה</h2>
          <ul>
            <li>אנחנו לא בודקים את המקומות בעצמנו, ולא מתחייבים שהמידע מדויק, מלא או עדכני. מקומות משנים תפריטים, השגחה ושעות פתיחה.</li>
            <li>האתר אינו גוף כשרות ואינו מעניק תעודות. תעודה שמוצגת היא צילום שהעלה משתמש. לפני שסומכים על כשרות, יש לבדוק את התעודה במקום.</li>
            <li>אם יש לכם אלרגיה, צליאקיה או רגישות אחרת, בדקו תמיד מול בית העסק. אל תסתמכו על האתר בלבד.</li>
            <li>&quot;סיווג אוטומטי&quot; הוא ניחוש של מחשב לפי שם המקום וסוגו, ועלול להיות שגוי. המיקום על המפה מגיע ממאגרים פתוחים וגם הוא עלול להיות לא מדויק.</li>
            <li>בעל עסק שמצא מידע שגוי על העסק שלו יכול לפנות אלינו בטופס יצירת הקשר, ונבדוק ונתקן או נסיר את המידע בהקדם.</li>
            <li>הניווט ניתן לעזרה בלבד. שימו לב לתנועה ולשלטים, וצייתו לחוק.</li>
          </ul>
  
          <h2>מה מותר ומה אסור כשמוסיפים מידע</h2>
          <p>כשאתם מוסיפים מקום, מאשרים מידע או מעלים תמונה, אתם מצהירים שהמידע נכון למיטב ידיעתכם ושהתמונה צולמה על ידיכם או שיש לכם זכות להעלות אותה. אסור:</p>
          <ul>
            <li>להעלות מידע שקרי או מטעה, או לנסות להשפיע על הדירוג של מקום בדרכים לא הוגנות.</li>
            <li>להעלות תמונות של אנשים, תוכן פוגעני, או תוכן שמפר זכויות של אחרים.</li>
            <li>לפגוע באתר, לאסוף ממנו מידע באופן אוטומטי, או להשתמש בו לפרסום.</li>
          </ul>
          <p>אנחנו רשאים להסיר מידע או לחסום שימוש שמפר את התנאים, בלי הודעה מוקדמת.</p>
  
          <h2>רישיון לתוכן שאתם מעלים</h2>
          <p>התוכן שאתם מעלים נשאר שלכם. כשאתם מעלים אותו, אתם נותנים לנו רישיון חינמי, לא בלעדי ולכל העולם להציג אותו באתר ולשתף אותו עם משתמשים אחרים.</p>
  
          <h2>מידע של צד שלישי</h2>
          <p>חלק מנתוני המפה והמקומות © תורמי OpenStreetMap, ברישיון ODbL. המפה מוצגת באמצעות Mapbox. קישורים לאתרים אחרים, כמו Waze או אתר של מסעדה, הם לנוחותכם, ואיננו אחראים לתוכן שלהם.</p>
  
          <h2>אחריות</h2>
          <p>האתר ניתן כמות שהוא (AS IS). במידה המרבית שהחוק מתיר, לא נהיה אחראים לנזק שנגרם משימוש באתר או מהסתמכות על המידע בו.</p>
  
          <h2>פרטיות</h2>
          <p>איך אנחנו משתמשים במידע מוסבר ב<Link href="/privacy">מדיניות הפרטיות</Link>.</p>
  
          <h2>שינויים, דין וסמכות שיפוט</h2>
          <p>נוכל לעדכן את התנאים מעת לעת. המשך השימוש אחרי עדכון מהווה הסכמה לתנאים המעודכנים. על התנאים חל הדין הישראלי, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>
  
          <h2>יצירת קשר</h2>
          <p>שאלות, תלונות או בקשה להסרת תוכן: <Link href="/contact?topic=report">טופס יצירת הקשר</Link>, או <a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">נויה אדיבי בלינקדאין</a>.</p>
    </>
  );
}

function TermsEn() {
  return (
    <>
          <h1>Terms of use</h1>
          <p className="muted">Updated on {SITE.updated}</p>

          <p>Welcome to {SITE.name} (&quot;the site&quot;, &quot;we&quot;). Using the site means you agree to these terms. If you don&apos;t agree to them, please don&apos;t use the site.</p>

          <h2>What the site does</h2>
          <p>{SITE.name} shows a map of places to eat in Israel, with information about kosher, vegan, vegetarian and gluten-free food and allergies. The site is run privately by Noya Adivi. The information comes from three sources: users who add and confirm it, the open databases OpenStreetMap and Overture Maps, and an automatic guess based on the place&apos;s name and type. Every detail shows where it came from and whether it was confirmed.</p>

          <h2>The information does not replace checking</h2>
          <ul>
            <li>We don&apos;t check the places ourselves, and we don&apos;t promise that the information is accurate, complete or up to date. Places change their menus, supervision and opening hours.</li>
            <li>The site is not a kashrut authority and does not issue certificates. A certificate shown is a photo a user uploaded. Before relying on kashrut, check the certificate on site.</li>
            <li>If you have an allergy, celiac disease or another sensitivity, always check with the business. Don&apos;t rely on the site alone.</li>
            <li>An &quot;automatic guess&quot; is a computer&apos;s guess from the place&apos;s name and type, and may be wrong. Map locations come from open databases and may also be inaccurate.</li>
            <li>A business owner who finds wrong information about their business can reach us through the contact form, and we will check and correct or remove it promptly.</li>
            <li>Navigation is only an aid. Pay attention to traffic and signs, and obey the law.</li>
          </ul>

          <h2>What is and isn&apos;t allowed when adding information</h2>
          <p>When you add a place, confirm information or upload a photo, you declare that the information is correct to the best of your knowledge and that you took the photo or have the right to upload it. It is not allowed to:</p>
          <ul>
            <li>Upload false or misleading information, or try to influence a place&apos;s standing unfairly.</li>
            <li>Upload photos of people, offensive content, or content that infringes other people&apos;s rights.</li>
            <li>Harm the site, collect information from it automatically, or use it for advertising.</li>
          </ul>
          <p>We may remove information or block use that breaks these terms, without notice.</p>

          <h2>Licence for content you upload</h2>
          <p>The content you upload stays yours. By uploading it, you give us a free, non-exclusive, worldwide licence to show it on the site and share it with other users.</p>

          <h2>Third-party information</h2>
          <p>Some map and place data © OpenStreetMap contributors, under the ODbL licence. The map is shown using Mapbox. Links to other sites, such as Waze or a restaurant&apos;s website, are for your convenience, and we are not responsible for their content.</p>

          <h2>Liability</h2>
          <p>The site is provided as is. To the fullest extent the law allows, we are not liable for damage caused by using the site or relying on its information.</p>

          <h2>Privacy</h2>
          <p>How we use information is explained in the <Link href="/privacy">privacy policy</Link>.</p>

          <h2>Changes, law and jurisdiction</h2>
          <p>We may update these terms from time to time. Continuing to use the site after an update means you agree to the updated terms. These terms are governed by Israeli law, and the competent courts in Israel have exclusive jurisdiction.</p>

          <h2>Contact</h2>
          <p>Questions, complaints or a request to remove content: the <Link href="/contact?topic=report">contact form</Link>, or <a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">Noya Adivi on LinkedIn</a>.</p>
    </>
  );
}
