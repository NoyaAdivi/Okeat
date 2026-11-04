import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import LegalNav from '@/components/LegalNav';
import { getLang } from '@/lib/lang-server';
import { SITE } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'en' ? 'Privacy policy | Okeat' : 'מדיניות פרטיות | Okeat' };
}

// Draft, written with the Israeli Privacy Protection Law in mind. Have a lawyer review it before going live.
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

function PrivacyHe() {
  return (
    <>
          <h1>מדיניות פרטיות</h1>
          <p className="muted">עודכן ב-{SITE.updated}</p>
  
          <p>האתר מופעל על ידי נויה אדיבי, שאחראית על המידע שנאסף בו. אנחנו אוספים כמה שפחות מידע עליכם, ומשתמשים בו רק כדי שהאתר יעבוד. בדף הזה מוסבר מה נאסף, למה, ומה הזכויות שלכם.</p>
  
          <h2>מה אנחנו אוספים</h2>
          <ul>
            <li><b>חשבון, אם בחרתם להתחבר.</b> כתובת המייל, ואם התחברתם עם Google גם השם. משמשים לשמירת מה שהוספתם ואישרתם.</li>
            <li><b>פרופיל ציבורי.</b> אם התחברתם עם חשבון, אחרים רואים את השם ותמונת הפרופיל שלו, את האוכל האהוב אם כתבתם אותו, מתי הצטרפתם ומה הוספתם ואישרתם. כתובת המייל לא מוצגת למשתמשים אחרים, ורק מנהלת האתר רואה אותה.</li>
            <li><b>מה שהוספתם.</b> מקומות, אישורים, ביקורות ותמונות של תעודות כשרות ושל המקומות. התוכן הזה מוצג לכל המשתמשים, יחד עם השם של מי שהוסיף אותו. תמונה של מקום מוצגת רק אחרי אישור של מנהל.</li>
            <li><b>מקומות ששמרתם.</b> רשימת המקומות ששמרתם גלויה רק לכם. רשימה שיצרתם גלויה לכל מי שיש לו את הקישור, יחד עם השם שלכם.</li>
            <li><b>סינון קבוע.</b> אם בחרתם לזכור סינון, הוא נשמר רק בדפדפן שלכם, ולא אצלנו.</li>
            <li><b>מילות חיפוש.</b> אנחנו שומרים אילו מילים וערים מחפשים ובאיזו תדירות, כדי לשפר את האתר, בלי קשר למי שחיפש.</li>
            <li><b>הודעות יצירת קשר.</b> ההודעה ומה שהשארתם לחזרה אליכם נשמרים, ורק מנהלת האתר קוראת אותם.</li>
            <li><b>מדידת ביקורים.</b> אנחנו סופרים כניסות, כמה דפים נפתחו וכמה זמן נשארו, תחת מספר אקראי שנמחק כשסוגרים את הלשונית. אין בזה שום פרט שמזהה אתכם, והנתונים נמחקים אחרי חצי שנה.</li>
          <li><b>תקלות באתר.</b> אם משהו נשבר, נשמרים הודעת השגיאה והעמוד שבו קרתה, בלי פרטים עליכם.</li>
            <li><b>מיקום.</b> אם אישרתם בדפדפן, המיקום משמש כדי להראות מקומות קרובים ולנווט. הוא לא נשמר אצלנו. מיקום שבחרתם בעצמכם נשמר רק בדפדפן שלכם.</li>
            <li><b>הגדרות באתר.</b> העדפות נגישות, תצוגה ושפה נשמרות בדפדפן שלכם.</li>
          </ul>
  
          <h2>עוגיות (Cookies) ואחסון בדפדפן</h2>
          <p>אנחנו משתמשים רק בעוגיות ובאחסון שנחוצים כדי שהאתר יעבוד: שמירת ההתחברות, השפה, והעדפות התצוגה והנגישות. איננו משתמשים בעוגיות פרסום או מעקב.</p>
  
          <h2>עם מי המידע משותף</h2>
          <p>אנחנו לא מוכרים מידע. המידע מאוחסן אצל ספקי שירות שעוזרים לנו להפעיל את האתר:</p>
          <ul>
            <li><b>Supabase</b>: מסד הנתונים, ההתחברות ואחסון התמונות.</li>
            <li><b>Mapbox</b>: הצגת המפה וחישוב מסלולים. כשאתם מבקשים מסלול, נקודת ההתחלה והיעד נשלחות ל-Mapbox.</li>
              <li><b>חיפוש של OpenStreetMap (Photon, של Komoot)</b>: כשאתם מקלידים כתובת כדי לקבוע את המיקום שלכם, הטקסט שהקלדתם נשלח אליו.</li>
              <li><b>Vercel</b>: אחסון האתר. כמו בכל אתר, השרת מקבל פרטים טכניים כמו כתובת IP.</li>
              <li><b>Google</b>: התחברות עם חשבון Google, רק אם בחרתם בה.</li>
          <li><b>שירות שליחת מיילים</b>: כתובת המייל שלכם עוברת דרכו כדי לשלוח את קישור וקוד ההתחברות.</li>
            <li><b>jsDelivr</b>: טעינת כלי קריאת התעודות לדפדפן. התמונה עצמה נקראת בתוך הדפדפן שלכם.</li>
          </ul>
          <p>חלק מהספקים פועלים מחוץ לישראל, והמידע עשוי להיות מאוחסן שם.</p>
  
          <h2>הזכויות שלכם</h2>
          <p>את רוב מה שהוספתם אפשר לערוך ולמחוק בעצמכם בחשבון, תחת &quot;הפעילות שלי&quot;. אתם גם רשאים לבקש לעיין במידע שנשמר עליכם, לתקן אותו או למחוק אותו. כתבו לנו ב<Link href="/contact?topic=privacy">טופס יצירת הקשר</Link> ונטפל בבקשה תוך 30 יום.</p>
  
          <h2>אבטחה</h2>
          <p>אנחנו נוקטים אמצעים סבירים להגנה על המידע: החיבור לאתר מוצפן (HTTPS), באתר אין סיסמאות כי ההתחברות היא עם Google או קוד במייל, וכל משתמש מקבל גישה רק למה שמותר לו. שום מערכת אינה מוגנת לגמרי.</p>
  
          <h2>קטינים</h2>
          <p>האתר מיועד לקהל הרחב. אם אתם מתחת לגיל 18, היעזרו בהורה כשאתם יוצרים חשבון.</p>
  
          <h2>שינויים</h2>
          <p>נעדכן את הדף הזה כשהמדיניות משתנה. ראו גם את <Link href="/terms">תנאי השימוש</Link>.</p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
          <h1>Privacy policy</h1>
          <p className="muted">Updated on {SITE.updated}</p>

          <p>The site is run by Noya Adivi, who is responsible for the information collected here. We collect as little information about you as possible, and use it only to make the site work. This page explains what is collected, why, and what your rights are.</p>

          <h2>What we collect</h2>
          <ul>
            <li><b>An account, if you choose to sign in.</b> Your email address, and if you sign in with Google, also your name. Used to keep what you added and confirmed.</li>
            <li><b>A public profile.</b> If you signed in with an account, others see its name and picture, your favorite food if you added it, when you joined, and what you added and confirmed. Your e-mail address is not shown to other users, and only the site admin can see it.</li>
            <li><b>What you added.</b> Places, confirmations, reviews, and photos of kosher certificates and of places. This content is shown to all users, together with the name of whoever added it. A photo of a place is shown only after a moderator approves it.</li>
            <li><b>Places you saved.</b> Your saved places are visible only to you. A list you create is visible to anyone with the link, together with your name.</li>
            <li><b>Saved filter.</b> If you choose to remember a filter, it stays only in your browser and not with us.</li>
            <li><b>Search words.</b> We keep which words and cities people search for and how often, to improve the site, with no link to who searched.</li>
            <li><b>Contact messages.</b> Your message and what you left for us to reply are kept, and only the site admin reads them.</li>
            <li><b>Visit counts.</b> We count visits, how many pages were opened and how long people stayed, under a random number that is gone when you close the tab. Nothing in it identifies you, and it is deleted after six months.</li>
          <li><b>Site errors.</b> If something breaks, we keep the error message and the page it happened on, with no details about you.</li>
            <li><b>Location.</b> If you allow it in your browser, your location is used to show nearby places and to navigate. We don&apos;t store it. A location you choose yourself stays only in your browser.</li>
            <li><b>Site settings.</b> Accessibility, display and language preferences are kept in your browser.</li>
          </ul>

          <h2>Cookies and browser storage</h2>
          <p>We only use the cookies and storage the site needs to work: keeping you signed in, your language, and your display and accessibility preferences. We don&apos;t use advertising or tracking cookies.</p>

          <h2>Who the information is shared with</h2>
          <p>We don&apos;t sell information. It is stored with service providers that help us run the site:</p>
          <ul>
            <li><b>Supabase</b>: the database, sign-in and photo storage.</li>
            <li><b>Mapbox</b>: showing the map and working out routes. When you ask for a route, the start and the destination are sent to Mapbox.</li>
            <li><b>OpenStreetMap search (Photon, by Komoot)</b>: when you type an address to set your location, the text you type is sent to it.</li>
            <li><b>Vercel</b>: hosting the site. As with any site, the server receives technical details such as your IP address.</li>
            <li><b>Google</b>: signing in with a Google account, only if you choose it.</li>
          <li><b>An email service</b>: your email address goes through it so we can send your sign-in link and code.</li>
            <li><b>jsDelivr</b>: loading the certificate reader into your browser. The photo itself is read inside your browser.</li>
          </ul>
          <p>Some providers operate outside Israel, and the information may be stored there.</p>

          <h2>Your rights</h2>
          <p>You can edit and delete most of what you added yourself, on your account under &quot;My activity&quot;. You may also ask to see, correct or delete the information stored about you. Write to us using the <Link href="/contact?topic=privacy">contact form</Link> and we will handle it within 30 days.</p>

          <h2>Security</h2>
          <p>We take reasonable measures to protect the information: the connection to the site is encrypted (HTTPS), the site has no passwords because you sign in with Google or an email code, and each user can reach only what they are allowed to. No system is completely secure.</p>

          <h2>Minors</h2>
          <p>The site is meant for the general public. If you are under 18, ask a parent to help when you create an account.</p>

          <h2>Changes</h2>
          <p>We will update this page when the policy changes. See also the <Link href="/terms">terms of use</Link>.</p>
    </>
  );
}
