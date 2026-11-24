import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import LegalNav from '@/components/LegalNav';
import { getLang } from '@/lib/lang-server';
import { SITE } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Terms of use | Okeat' : 'תנאי שימוש | Okeat' };
}

// Written carefully, but it is not legal advice. A lawyer's review is still recommended.
export default async function Terms() {
  const lang = await getLang();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        <LegalNav />
        {lang === 'en' ? <TermsEn /> : <TermsHe />}
      </main>
      <SiteFooter />
    </div>
  );
}

function Mail() {
  return SITE.email ? <>, במייל <a href={`mailto:${SITE.email}`}>{SITE.email}</a></> : null;
}
function MailEn() {
  return SITE.email ? <>, by email at <a href={`mailto:${SITE.email}`}>{SITE.email}</a></> : null;
}

function TermsHe() {
  return (
    <>
      <h1>תנאי שימוש</h1>
      <p className="muted">עודכן ב-{SITE.updated}</p>

      <p>ברוכים הבאים ל-{SITE.name} (&quot;האתר&quot;, &quot;אנחנו&quot;). השימוש באתר מהווה הסכמה לתנאים האלה. אם אינכם מסכימים להם, אנא אל תשתמשו באתר. התנאים כתובים בלשון רבים ומתייחסים לכל המגדרים.</p>

      <h2>מה האתר עושה</h2>
      <p>{SITE.name} הוא שירות חינמי שמציג מפה של מקומות אוכל בישראל, ומידע על כשרות, טבעונות, צמחונות, מזון ללא גלוטן ואלרגיות. האתר מופעל על ידי נויה אדיבי באופן פרטי. המידע מגיע מכמה מקורות: משתמשים שמוסיפים ומאשרים מידע, המאגרים הפתוחים OpenStreetMap ו-Overture Maps, פרטים מ-Google Maps (כמו שעות פתיחה ודירוג), וסיווג אוטומטי לפי שם המקום וסוגו. ליד כל פרט מצוין מה מקורו והאם הוא אושר.</p>

      <h2>המידע אינו מחליף בדיקה</h2>
      <ul>
        <li>אנחנו לא בודקים את המקומות בעצמנו, ולא מתחייבים שהמידע מדויק, מלא או עדכני. מקומות משנים תפריטים, השגחה ושעות פתיחה.</li>
        <li>האתר אינו גוף כשרות, אינו נותן הכשר ואינו מעניק תעודות. סימון של מקום ככשר באתר הוא מידע שמשתמשים דיווחו עליו, ולא תעודת כשרות. תעודה שמוצגת היא צילום שהעלה משתמש. לפני שסומכים על כשרות, יש לבדוק את התעודה בתוקף במקום עצמו.</li>
        <li>אם יש לכם אלרגיה, צליאקיה או רגישות אחרת, בדקו תמיד מול בית העסק. אל תסתמכו על האתר בלבד. המידע באתר אינו ייעוץ רפואי או תזונתי.</li>
        <li>&quot;סיווג אוטומטי&quot; הוא ניחוש של מחשב לפי שם המקום וסוגו, ועלול להיות שגוי. המיקום על המפה מגיע ממאגרים פתוחים וגם הוא עלול להיות לא מדויק.</li>
        <li>בעל עסק שמצא מידע שגוי על העסק שלו יכול לפנות אלינו בטופס יצירת הקשר, ונבדוק ונתקן או נסיר את המידע בהקדם.</li>
        <li>הניווט ניתן לעזרה בלבד. שימו לב לתנועה ולשלטים, וצייתו לחוק.</li>
      </ul>

      <h2>מה מותר ומה אסור כשמוסיפים מידע</h2>
      <p>כשאתם מוסיפים מקום, מאשרים מידע, כותבים ביקורת, יוצרים רשימה או מעלים תמונה, אתם מצהירים שהמידע נכון למיטב ידיעתכם, שהביקורת מבוססת על ביקור שלכם, ושהתמונה צולמה על ידיכם או שיש לכם זכות להעלות אותה. ביקורות, רשימות ותמונות הן דעת הכותבים ולא של האתר, והאחריות עליהן היא של מי שהעלה אותן. מנהלים רשאים להסיר אותן. אסור:</p>
      <ul>
        <li>להעלות מידע שקרי או מטעה, או לנסות להשפיע על הדירוג של מקום בדרכים לא הוגנות, למשל ביקורות על עסק שלכם או של מתחרים.</li>
        <li>לפרסם לשון הרע, השמצות, איומים או הטרדה, כלפי אדם או עסק.</li>
        <li>להעלות תמונות של אנשים, פרטים אישיים של אחרים (כמו טלפון או כתובת), תוכן פוגעני, או תוכן שמפר זכויות של אחרים.</li>
        <li>להתחזות לאדם אחר או לבעל עסק שאינכם.</li>
        <li>לפגוע באתר, לאסוף ממנו מידע באופן אוטומטי, או להשתמש בו לפרסום.</li>
      </ul>
      <p>אנחנו רשאים להסיר מידע, לחסום חשבון או למנוע שימוש שמפר את התנאים, בלי הודעה מוקדמת.</p>

      <h2>רישיון לתוכן שאתם מעלים</h2>
      <p>התוכן שאתם מעלים נשאר שלכם. כשאתם מעלים אותו, אתם נותנים לנו רישיון חינמי, לא בלעדי ולכל העולם להציג אותו באתר, לשתף אותו עם משתמשים אחרים ולהתאים אותו לתצוגה (למשל להקטין תמונה). תוכן שמחקתם יוסר מהאתר, למעט עותקי גיבוי שנמחקים עם הזמן.</p>

      <h2>הזכויות באתר</h2>
      <p>השם {SITE.name}, הלוגו והעיצוב של האתר שייכים לנויה אדיבי. אין להשתמש בהם בלי רשות.</p>

      <h2>מידע של צד שלישי</h2>
      <p>חלק מנתוני המפה והמקומות © תורמי OpenStreetMap, ברישיון ODbL, וחלק מגיעים מ-Overture Maps Foundation. פרטים שמסומנים &quot;מגוגל&quot; מגיעים מ-Google Maps. המפה מוצגת באמצעות Mapbox. קישורים לאתרים אחרים, כמו Waze, Google Maps או אתר של מסעדה, הם לנוחותכם, ואיננו אחראים לתוכן שלהם.</p>

      <h2>זמינות השירות</h2>
      <p>האתר ניתן בחינם. ייתכן שיהיו בו תקלות או הפסקות, ואנחנו רשאים לשנות, להשהות או להפסיק אותו או חלק ממנו בכל עת.</p>

      <h2>אחריות</h2>
      <p>האתר ניתן כמות שהוא (AS IS) וכפי שהוא זמין. במידה המרבית שהחוק מתיר, לא נהיה אחראים לנזק ישיר או עקיף שנגרם משימוש באתר, מהסתמכות על המידע בו, או מתוכן שהעלו משתמשים אחרים. אין בתנאים האלה כדי לשלול אחריות שלפי הדין אי אפשר לשלול.</p>
      <p>אתם מתחייבים לפצות אותנו על נזק או הוצאה סבירה, כולל שכר טרחת עורך דין, שייגרמו בגלל תוכן שהעליתם או שימוש שלכם באתר בניגוד לתנאים האלה או לחוק.</p>

      <h2>גיל</h2>
      <p>אפשר לגלוש באתר בכל גיל. כדי לפתוח חשבון ולהוסיף תוכן צריך להיות בני 16 ומעלה. מי שמתחת לגיל 18 צריך לפתוח חשבון בידיעת הורה ובהסכמתו.</p>

      <h2>הסרת תוכן</h2>
      <p>חושבים שתוכן באתר פוגע בכם, שגוי, מהווה לשון הרע, או מפר זכויות יוצרים או פרטיות? פנו אלינו ב<Link href="/contact?topic=report">טופס יצירת הקשר</Link> עם קישור לתוכן ותיאור קצר של הבעיה, ונבדוק ונסיר אותו בהקדם במידת הצורך.</p>

      <h2>פרטיות</h2>
      <p>איך אנחנו משתמשים במידע מוסבר ב<Link href="/privacy">מדיניות הפרטיות</Link>.</p>

      <h2>שינויים, דין וסמכות שיפוט</h2>
      <p>נוכל לעדכן את התנאים מעת לעת, והתאריך בראש הדף יתעדכן. על שינוי מהותי נודיע באתר. המשך השימוש אחרי עדכון מהווה הסכמה לתנאים המעודכנים. על התנאים חל הדין הישראלי, וסמכות השיפוט נתונה לבתי המשפט המוסמכים בישראל. אם סעיף כלשהו יימצא לא תקף, שאר הסעיפים ימשיכו לחול.</p>

      <h2>יצירת קשר</h2>
      <p>שאלות, תלונות או בקשה להסרת תוכן: <Link href="/contact?topic=report">טופס יצירת הקשר</Link><Mail />, או <a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">נויה אדיבי בלינקדאין</a>.</p>
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
      <p>{SITE.name} is a free service that shows a map of places to eat in Israel, with information about kosher, vegan, vegetarian and gluten-free food and allergies. The site is run privately by Noya Adivi. The information comes from several sources: users who add and confirm it, the open databases OpenStreetMap and Overture Maps, details from Google Maps (such as opening hours and rating), and an automatic guess based on the place&apos;s name and type. Every detail shows where it came from and whether it was confirmed.</p>

      <h2>The information does not replace checking</h2>
      <ul>
        <li>We don&apos;t check the places ourselves, and we don&apos;t promise that the information is accurate, complete or up to date. Places change their menus, supervision and opening hours.</li>
        <li>The site is not a kashrut authority, does not give kosher supervision and does not issue certificates. A place marked as kosher on the site is information users reported, not a kosher certificate. A certificate shown is a photo a user uploaded. Before relying on kashrut, check for a valid certificate at the place itself.</li>
        <li>If you have an allergy, celiac disease or another sensitivity, always check with the business. Don&apos;t rely on the site alone. The information on the site is not medical or nutritional advice.</li>
        <li>An &quot;automatic guess&quot; is a computer&apos;s guess from the place&apos;s name and type, and may be wrong. Map locations come from open databases and may also be inaccurate.</li>
        <li>A business owner who finds wrong information about their business can reach us through the contact form, and we will check and correct or remove it promptly.</li>
        <li>Navigation is only an aid. Pay attention to traffic and signs, and obey the law.</li>
      </ul>

      <h2>What is and isn&apos;t allowed when adding information</h2>
      <p>When you add a place, confirm information, write a review, create a list or upload a photo, you declare that the information is correct to the best of your knowledge, that the review is based on your own visit, and that you took the photo or have the right to upload it. Reviews, lists and photos are the opinion of their authors, not of the site, and the person who uploaded them is responsible for them. Moderators may remove them. It is not allowed to:</p>
      <ul>
        <li>Upload false or misleading information, or try to influence a place&apos;s standing unfairly, for example reviewing your own business or a competitor&apos;s.</li>
        <li>Post defamation, smears, threats or harassment against a person or a business.</li>
        <li>Upload photos of people, other people&apos;s personal details (such as a phone number or address), offensive content, or content that infringes other people&apos;s rights.</li>
        <li>Pretend to be someone else, or the owner of a business you don&apos;t own.</li>
        <li>Harm the site, collect information from it automatically, or use it for advertising.</li>
      </ul>
      <p>We may remove information, block an account or stop use that breaks these terms, without notice.</p>

      <h2>Licence for content you upload</h2>
      <p>The content you upload stays yours. By uploading it, you give us a free, non-exclusive, worldwide licence to show it on the site, share it with other users and adapt it for display (for example, resize a photo). Content you delete is removed from the site, except for backup copies that are deleted over time.</p>

      <h2>Rights in the site</h2>
      <p>The name {SITE.name}, the logo and the site&apos;s design belong to Noya Adivi. Please don&apos;t use them without permission.</p>

      <h2>Third-party information</h2>
      <p>Some map and place data © OpenStreetMap contributors, under the ODbL licence, and some comes from the Overture Maps Foundation. Details marked &quot;from Google&quot; come from Google Maps. The map is shown using Mapbox. Links to other sites, such as Waze, Google Maps or a restaurant&apos;s website, are for your convenience, and we are not responsible for their content.</p>

      <h2>Availability</h2>
      <p>The site is free. It may have faults or downtime, and we may change, pause or stop it, or any part of it, at any time.</p>

      <h2>Liability</h2>
      <p>The site is provided as is and as available. To the fullest extent the law allows, we are not liable for any direct or indirect damage caused by using the site, by relying on its information, or by content other users uploaded. Nothing in these terms removes liability that cannot be removed by law.</p>
      <p>You agree to compensate us for any damage or reasonable expense, including legal fees, caused by content you uploaded or by your use of the site against these terms or the law.</p>

      <h2>Age</h2>
      <p>Anyone can browse the site. To open an account and add content you must be 16 or older. If you are under 18, open an account only with a parent&apos;s knowledge and consent.</p>

      <h2>Removing content</h2>
      <p>Think something on the site harms you, is wrong, is defamatory, or infringes copyright or privacy? Contact us through the <Link href="/contact?topic=report">contact form</Link> with a link to it and a short description of the problem, and we will check and remove it quickly if needed.</p>

      <h2>Privacy</h2>
      <p>How we use information is explained in the <Link href="/privacy">privacy policy</Link>.</p>

      <h2>Changes, law and jurisdiction</h2>
      <p>We may update these terms from time to time, and the date at the top will change. We will announce substantial changes on the site. Continuing to use the site after an update means you agree to the updated terms. These terms are governed by Israeli law, and the competent courts in Israel have jurisdiction. If any part of these terms is found invalid, the rest still applies.</p>

      <h2>Contact</h2>
      <p>Questions, complaints or a request to remove content: the <Link href="/contact?topic=report">contact form</Link><MailEn />, or <a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">Noya Adivi on LinkedIn</a>.</p>
    </>
  );
}
