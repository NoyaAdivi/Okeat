import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import LegalNav from '@/components/LegalNav';
import { getLang } from '@/lib/lang-server';
import { SITE } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Privacy policy | Okeat' : 'מדיניות פרטיות | Okeat' };
}

// Written with the Israeli Privacy Protection Law (including Amendment 13) in mind. Not legal advice; a lawyer's review is still recommended.
export default async function Privacy() {
  const lang = await getLang();
  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="prose">
        <LegalNav />
        {lang === 'en' ? <PrivacyEn /> : <PrivacyHe />}
      </main>
      <SiteFooter />
    </div>
  );
}

const PPA = 'https://www.gov.il/he/departments/the_privacy_protection_authority';

function PrivacyHe() {
  return (
    <>
      <h1>מדיניות פרטיות</h1>
      <p className="muted">עודכן ב-{SITE.updated}</p>

      <p>האתר מופעל על ידי נויה אדיבי, שהיא בעלת השליטה במידע שנאסף בו ואחראית עליו. אפשר לפנות אליה ב<Link href="/contact?topic=privacy">טופס יצירת הקשר</Link>{SITE.email && <>, או במייל <a href={`mailto:${SITE.email}`}>{SITE.email}</a></>}. אנחנו אוספים כמה שפחות מידע עליכם, ומשתמשים בו רק כדי שהאתר יעבוד. בדף הזה מוסבר מה נאסף, למה, למי הוא מועבר, ומה הזכויות שלכם.</p>

      <h2>אין חובה למסור מידע</h2>
      <p>אין חובה חוקית למסור לנו מידע, והמסירה תלויה ברצונכם ובהסכמתכם. אפשר לגלוש ולחפש באתר בלי חשבון. בלי כתובת מייל או חשבון Google לא ניתן לפתוח חשבון, ולכן לא ניתן להוסיף מקומות, ביקורות או תמונות.</p>

      <h2>מה אנחנו אוספים ולמה</h2>
      <ul>
        <li><b>חשבון, אם בחרתם להתחבר.</b> כתובת המייל, ואם התחברתם עם Google גם השם ותמונת הפרופיל. משמשים לזיהוי החשבון ולשמירת מה שהוספתם ואישרתם.</li>
        <li><b>פרופיל ציבורי.</b> אם התחברתם עם חשבון, אחרים רואים את השם ותמונת הפרופיל שלו, את האוכל האהוב אם כתבתם אותו, מתי הצטרפתם ומה הוספתם ואישרתם. כתובת המייל לא מוצגת למשתמשים אחרים, ורק מנהלת האתר רואה אותה.</li>
        <li><b>מה שהוספתם.</b> מקומות, אישורים, ביקורות ותמונות של תעודות כשרות ושל המקומות. התוכן הזה מוצג לכל המשתמשים, יחד עם השם של מי שהוסיף אותו. תמונה של מקום מוצגת רק אחרי אישור של מנהל.</li>
        <li><b>מקומות ששמרתם.</b> רשימת המקומות ששמרתם גלויה רק לכם. רשימה שיצרתם גלויה לכל מי שיש לו את הקישור, יחד עם השם שלכם.</li>
        <li><b>סינון קבוע.</b> אם בחרתם לזכור סינון, הוא נשמר רק בדפדפן שלכם, ולא אצלנו.</li>
        <li><b>מילות חיפוש.</b> אנחנו שומרים אילו מילים וערים מחפשים ובאיזו תדירות, כדי לשפר את האתר, בלי קשר למי שחיפש.</li>
        <li><b>הודעות יצירת קשר.</b> ההודעה ומה שהשארתם לחזרה אליכם (מייל או טלפון) נשמרים כדי שנוכל לענות, ורק מנהלת האתר קוראת אותם.</li>
        <li><b>מדידת ביקורים.</b> אנחנו סופרים כניסות, כמה דפים נפתחו, כמה זמן נשארו והאם הגולש מחובר, תחת מספר אקראי שנמחק כשסוגרים את הלשונית. אין בזה שום פרט שמזהה אתכם.</li>
        <li><b>תקלות באתר.</b> אם משהו נשבר, נשמרים הודעת השגיאה והעמוד שבו קרתה, בלי פרטים עליכם.</li>
        <li><b>מיקום.</b> אם אישרתם בדפדפן, המיקום משמש כדי להראות מקומות קרובים ולנווט. הוא לא נשמר אצלנו. מיקום שבחרתם בעצמכם נשמר רק בדפדפן שלכם.</li>
        <li><b>הגדרות באתר.</b> העדפות נגישות, תצוגה ושפה נשמרות בדפדפן שלכם.</li>
      </ul>
      <p>אנחנו לא משתמשים במידע לפרסום, לא שולחים דיוור שיווקי, ולא בונים פרופיל עליכם.</p>

      <h2>כמה זמן המידע נשמר</h2>
      <ul>
        <li>החשבון ומה שהוספתם נשמרים כל עוד החשבון קיים, ונמחקים כשמבקשים למחוק אותו. תוכן שהוספתם יכול להישאר באתר בלי השם שלכם, אם ביקשתם זאת או אם הוא חלק ממידע על מקום שאחרים אישרו.</li>
        <li>נתוני ביקורים נמחקים אחרי חצי שנה.</li>
        <li>הודעות יצירת קשר ודיווחי תקלות נשמרים רק כל עוד הם נחוצים לטיפול, ונמחקים מעת לעת.</li>
        <li>עותקי גיבוי נמחקים עם הזמן לפי מחזור הגיבוי.</li>
      </ul>

      <h2>מידע שמגיע מחשבון Google</h2>
      <p>ההתחברות עם Google היא בחירה שלכם. אם בחרתם בה, Okeat מקבל מ-Google רק את השם, כתובת המייל ותמונת הפרופיל שלכם (ההרשאות openid, email ו-profile). איננו מקבלים גישה לאנשי קשר, למיילים, לקבצים או לכל מידע אחר בחשבון Google שלכם.</p>
      <ul>
        <li><b>למה.</b> השם והתמונה מוצגים בפרופיל הציבורי שלכם וליד מה שהוספתם. המייל משמש לזיהוי החשבון שלכם בלבד ולא מוצג לאחרים.</li>
        <li><b>איפה נשמר.</b> במסד הנתונים של האתר אצל Supabase, בחיבור מוצפן.</li>
        <li><b>שיתוף.</b> איננו מוכרים, משכירים או מעבירים את המידע הזה לאף אחד, איננו משתמשים בו לפרסום, ואיננו משתמשים בו לאימון מודלים של בינה מלאכותית. השימוש במידע שמתקבל מ-Google APIs עומד ב<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">מדיניות נתוני המשתמש של Google API Services</a>, כולל דרישות ה-Limited Use.</li>
        <li><b>מחיקה.</b> אפשר לבקש למחוק את החשבון וכל המידע שקיבלנו מ-Google דרך <Link href="/contact?topic=privacy">טופס יצירת הקשר</Link>, ונמחק אותו תוך 30 יום. אפשר גם לבטל בכל רגע את הגישה של Okeat בעמוד <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">ההרשאות של חשבון Google</a>.</li>
      </ul>

      <h2>עוגיות (Cookies) ואחסון בדפדפן</h2>
      <p>אנחנו משתמשים רק בעוגיות ובאחסון שנחוצים כדי שהאתר יעבוד: שמירת ההתחברות, השפה, והעדפות התצוגה והנגישות. איננו משתמשים בעוגיות פרסום או מעקב, ולכן אין צורך לבחור אילו עוגיות לאשר.</p>

      <h2>למי המידע מועבר</h2>
      <p>אנחנו לא מוכרים מידע. המידע עובר רק לספקי שירות שעוזרים לנו להפעיל את האתר, ורק במידה הנחוצה:</p>
      <ul>
        <li><b>Supabase</b>: מסד הנתונים, ההתחברות ואחסון התמונות.</li>
        <li><b>Mapbox</b>: הצגת המפה וחישוב מסלולים. כשאתם מבקשים מסלול, נקודת ההתחלה והיעד נשלחות ל-Mapbox.</li>
        <li><b>חיפוש של OpenStreetMap (Photon, של Komoot)</b>: כשאתם מקלידים כתובת כדי לקבוע את המיקום שלכם, הטקסט שהקלדתם נשלח אליו.</li>
        <li><b>Vercel</b>: אחסון האתר. כמו בכל אתר, השרת מקבל פרטים טכניים כמו כתובת IP וסוג הדפדפן.</li>
        <li><b>Google Maps</b>: כשפותחים מקום, השם והמיקום של המקום (לא שלכם) נשלחים ל-Google כדי להציג שעות פתיחה ודירוג. Google מקבלת גם פרטים טכניים כמו כתובת IP.</li>
        <li><b>Anthropic</b>: כשמצלמים תעודת כשרות, התמונה נשלחת לקריאה אוטומטית של הפרטים שעליה (שם העסק, הגוף המשגיח ותוקף). התמונה לא משמשת לאימון מודלים, כפוף ל<a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות של Anthropic</a>.</li>
        <li><b>jsDelivr</b>: אם הקריאה האוטומטית לא הצליחה, נטען לדפדפן כלי שקורא את התעודה בתוך הדפדפן שלכם, והתמונה לא נשלחת אליו.</li>
        <li><b>Google</b>: התחברות עם חשבון Google, רק אם בחרתם בה. כפוף ל<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות של Google</a>.</li>
        <li><b>שירות שליחת מיילים</b>: כתובת המייל שלכם עוברת דרכו כדי לשלוח את קישור וקוד ההתחברות.</li>
      </ul>
      <p>חלק מהספקים פועלים מחוץ לישראל, והמידע עשוי להיות מאוחסן שם. נמסור מידע לרשויות רק אם נחויב לכך לפי דין.</p>

      <h2>הזכויות שלכם</h2>
      <p>את רוב מה שהוספתם אפשר לערוך ולמחוק בעצמכם בחשבון, תחת &quot;הפעילות שלי&quot;. לפי חוק הגנת הפרטיות, אתם גם רשאים לבקש לעיין במידע שנשמר עליכם, לתקן אותו אם הוא שגוי, או למחוק אותו. כתבו לנו ב<Link href="/contact?topic=privacy">טופס יצירת הקשר</Link>{SITE.email && <> או במייל <a href={`mailto:${SITE.email}`}>{SITE.email}</a></>} ונטפל בבקשה תוך 30 יום. אם אינכם מרוצים מהטיפול, אפשר לפנות ל<a href={PPA} target="_blank" rel="noopener noreferrer">רשות להגנת הפרטיות</a>.</p>

      <h2>אבטחה</h2>
      <p>אנחנו נוקטים אמצעים סבירים להגנה על המידע: החיבור לאתר מוצפן (HTTPS), באתר אין סיסמאות כי ההתחברות היא עם Google או קוד במייל, וכל משתמש מקבל גישה רק למה שמותר לו. שום מערכת אינה מוגנת לגמרי. אם יקרה אירוע אבטחה חמור, נפעל כפי שהחוק דורש.</p>

      <h2>קטינים</h2>
      <p>פתיחת חשבון מותרת מגיל 16. מי שמתחת לגיל 18 צריך לפתוח חשבון בידיעת הורה ובהסכמתו. אם נודע לנו שנפתח חשבון של מי שמתחת לגיל 16, נמחק אותו.</p>

      <h2>שינויים</h2>
      <p>נעדכן את הדף הזה כשהמדיניות משתנה, והתאריך בראש הדף יתעדכן. ראו גם את <Link href="/terms">תנאי השימוש</Link>.</p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="muted">Updated on {SITE.updated}</p>

      <p>The site is run by Noya Adivi, who controls and is responsible for the information collected here. You can reach her through the <Link href="/contact?topic=privacy">contact form</Link>{SITE.email && <>, or by email at <a href={`mailto:${SITE.email}`}>{SITE.email}</a></>}. We collect as little information about you as possible, and use it only to make the site work. This page explains what is collected, why, who receives it, and what your rights are.</p>

      <h2>You don&apos;t have to give us information</h2>
      <p>There is no legal duty to give us information; it is up to you and your consent. You can browse and search the site without an account. Without an email address or a Google account you can&apos;t open an account, so you can&apos;t add places, reviews or photos.</p>

      <h2>What we collect and why</h2>
      <ul>
        <li><b>An account, if you choose to sign in.</b> Your email address, and if you sign in with Google, also your name and profile picture. Used to identify your account and keep what you added and confirmed.</li>
        <li><b>A public profile.</b> If you signed in with an account, others see its name and picture, your favorite food if you added it, when you joined, and what you added and confirmed. Your email address is not shown to other users, and only the site admin can see it.</li>
        <li><b>What you added.</b> Places, confirmations, reviews, and photos of kosher certificates and of places. This content is shown to all users, together with the name of whoever added it. A photo of a place is shown only after a moderator approves it.</li>
        <li><b>Places you saved.</b> Your saved places are visible only to you. A list you create is visible to anyone with the link, together with your name.</li>
        <li><b>Saved filter.</b> If you choose to remember a filter, it stays only in your browser and not with us.</li>
        <li><b>Search words.</b> We keep which words and cities people search for and how often, to improve the site, with no link to who searched.</li>
        <li><b>Contact messages.</b> Your message and what you left for us to reply (email or phone) are kept so we can answer, and only the site admin reads them.</li>
        <li><b>Visit counts.</b> We count visits, how many pages were opened, how long people stayed and whether the visitor is signed in, under a random number that is gone when you close the tab. Nothing in it identifies you.</li>
        <li><b>Site errors.</b> If something breaks, we keep the error message and the page it happened on, with no details about you.</li>
        <li><b>Location.</b> If you allow it in your browser, your location is used to show nearby places and to navigate. We don&apos;t store it. A location you choose yourself stays only in your browser.</li>
        <li><b>Site settings.</b> Accessibility, display and language preferences are kept in your browser.</li>
      </ul>
      <p>We don&apos;t use information for advertising, we don&apos;t send marketing email, and we don&apos;t build a profile about you.</p>

      <h2>How long information is kept</h2>
      <ul>
        <li>Your account and what you added are kept as long as the account exists, and deleted when you ask to delete it. Content you added may stay on the site without your name, if you asked for that or if it is part of place information others confirmed.</li>
        <li>Visit counts are deleted after six months.</li>
        <li>Contact messages and error reports are kept only as long as they are needed, and deleted from time to time.</li>
        <li>Backup copies are deleted over time, following the backup cycle.</li>
      </ul>

      <h2>Google user data</h2>
      <p>Signing in with Google is optional. If you choose it, Okeat receives from Google only your name, email address and profile picture (the openid, email and profile scopes). We do not get access to your contacts, emails, files or any other data in your Google account.</p>
      <ul>
        <li><b>How we use it.</b> Your name and picture are shown on your public profile and next to what you added. Your email is used only to identify your account and is never shown to other users.</li>
        <li><b>Where it is stored.</b> In the site&apos;s database at Supabase, over an encrypted connection.</li>
        <li><b>Sharing.</b> We do not sell, rent or transfer this data to anyone, we do not use it for advertising, and we do not use it to train AI models. Okeat&apos;s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</li>
        <li><b>Deletion.</b> You can ask us to delete your account and all data we received from Google using the <Link href="/contact?topic=privacy">contact form</Link>, and we will delete it within 30 days. You can also remove Okeat&apos;s access at any time on your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account permissions page</a>.</li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>We only use the cookies and storage the site needs to work: keeping you signed in, your language, and your display and accessibility preferences. We don&apos;t use advertising or tracking cookies, so there is nothing to choose or opt out of.</p>

      <h2>Who receives the information</h2>
      <p>We don&apos;t sell information. It goes only to service providers that help us run the site, and only as much as needed:</p>
      <ul>
        <li><b>Supabase</b>: the database, sign-in and photo storage.</li>
        <li><b>Mapbox</b>: showing the map and working out routes. When you ask for a route, the start and the destination are sent to Mapbox.</li>
        <li><b>OpenStreetMap search (Photon, by Komoot)</b>: when you type an address to set your location, the text you type is sent to it.</li>
        <li><b>Vercel</b>: hosting the site. As with any site, the server receives technical details such as your IP address and browser type.</li>
        <li><b>Google Maps</b>: when you open a place, the place&apos;s name and location (not yours) are sent to Google to show opening hours and rating. Google also receives technical details such as your IP address.</li>
        <li><b>Anthropic</b>: when you photograph a kosher certificate, the photo is sent for automatic reading of its details (business name, supervising body and expiry). It is not used to train models, subject to the <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">Anthropic Privacy Policy</a>.</li>
        <li><b>jsDelivr</b>: if the automatic reading fails, a tool that reads the certificate inside your own browser is loaded from it. The photo is not sent to it.</li>
        <li><b>Google</b>: signing in with a Google account, only if you choose it. Subject to the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</li>
        <li><b>An email service</b>: your email address goes through it so we can send your sign-in link and code.</li>
      </ul>
      <p>Some providers operate outside Israel, and the information may be stored there. We will give information to authorities only if the law requires us to.</p>

      <h2>Your rights</h2>
      <p>You can edit and delete most of what you added yourself, on your account under &quot;My activity&quot;. Under the Israeli Privacy Protection Law you may also ask to see the information stored about you, correct it if it is wrong, or delete it. Write to us using the <Link href="/contact?topic=privacy">contact form</Link>{SITE.email && <> or by email at <a href={`mailto:${SITE.email}`}>{SITE.email}</a></>} and we will handle it within 30 days. If you are not satisfied, you can contact the <a href={PPA} target="_blank" rel="noopener noreferrer">Israeli Privacy Protection Authority</a>.</p>

      <h2>Security</h2>
      <p>We take reasonable measures to protect the information: the connection to the site is encrypted (HTTPS), the site has no passwords because you sign in with Google or an email code, and each user can reach only what they are allowed to. No system is completely secure. If a serious security incident happens, we will act as the law requires.</p>

      <h2>Minors</h2>
      <p>You can open an account from age 16. If you are under 18, open an account only with a parent&apos;s knowledge and consent. If we learn that someone under 16 opened an account, we will delete it.</p>

      <h2>Changes</h2>
      <p>We will update this page when the policy changes, and the date at the top will change. See also the <Link href="/terms">terms of use</Link>.</p>
    </>
  );
}
