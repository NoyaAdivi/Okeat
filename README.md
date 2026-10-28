# Okeat

![](src/app/icon.svg)

מפה של מקומות לאכול: כשר, טבעוני וללא גלוטן, כשכל טענה מאומתת על ידי אנשים שהיו במקום. לכשרות מצרפים צילום תעודה, והפרטים נקראים ממנה אוטומטית עם Claude.

## עדכון: גרסה 2

- שם ולוגו חדשים (Okeat, "OK to eat"), ועיצוב פסטל לפי הלוגו
- הוספה ואישור בלי הרשמה: אנונימי אוטומטי דרך Supabase (צריך להפעיל Allow anonymous sign-ins)
- ניווט בתוך האתר: ברגל, באופניים או ברכב, עם הוראות פנייה וזמן הגעה
- מיגרציה `0003_sources.sql`: מקור המידע (`community` / `osm`) ורמת כשרות `marked` למקומות מיובאים
- `npm run import:osm` ממלא את המפה במקומות אמיתיים מגוש דן, ירושלים וחיפה

## מה יש באתר

- **מפה** עם סמני חותמת (כ׳, ט׳, ג׳), מסלול הליכה מונפש, ניווט ב-Waze או ב-Google Maps
- **סינון משולב** לפי רמה לכל צורך ("מהדרין ומעלה" + "מטבח נפרד"), ו"פתוח עכשיו" לפי שעון ישראל, כולל מוצאי שבת
- **התחברות** עם Google או קישור במייל
- **אישור קהילתי**: כל טענה צריכה 3 אישורים. אי אפשר לאשר את מה שהצעת בעצמך
- **הוספת מקום**: לוחצים על המפה, ממלאים פרטים. כשרות נוספת רק עם צילום תעודה
- **קריאת תעודות**: Claude מחלץ גוף משגיח, רמה ותוקף (כולל המרה מתאריך עברי), והמשתמש בודק ומתקן
- **תעודה שפגה** מסומנת ולא נחשבת בסינון, עם כפתור לצילום תעודה עדכנית
- **דף לכל מקום** (`/place/<id>`) עם תצוגה מקדימה לשיתוף בוואטסאפ
- **ייבוא מ-OpenStreetMap** כדי שהמפה לא תתחיל ריקה
- **מצב כהה**, מותאם לטלפון (רשימה שנפתחת מלמטה), נגיש מהמקלדת

## סטאק

Next.js 15 (App Router) · Supabase (Postgres + PostGIS, Auth, Storage) · Mapbox GL JS · Claude API

## מבנה

```
meushar/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql          טבלאות, רמות, RLS, טריגר האישורים, nearby_places
│   │   └── 0002_app.sql           place_by_id, הגבלת קצב לקריאת תעודות
│   └── seed.sql                   מקומות דוגמה לפיתוח בלבד
├── scripts/import-osm.mjs         ייבוא מ-OpenStreetMap
└── src/
    ├── middleware.ts              רענון ה-session בכל בקשה
    ├── app/
    │   ├── page.tsx               המסך הראשי (תומך ב-?place=<id>)
    │   ├── place/[id]/page.tsx    דף מקום לשיתוף
    │   ├── auth/callback/route.ts חזרה מ-Google ומקישור המייל
    │   ├── api/extract-certificate/route.ts   קריאת תעודה עם Claude
    │   ├── layout.tsx, globals.css, not-found.tsx
    ├── components/
    │   ├── MapScreen.tsx          כל מצב המסך: מיקום, סינון, בחירה, טאבים, דיאלוגים
    │   ├── MapView.tsx            Mapbox, סמנים, מסלול, בחירת מיקום
    │   ├── FilterBar, PlaceList, Badges, PlaceDetail, CertificateCard
    │   ├── CommunityQueue.tsx     טאב "לאישור הקהילה"
    │   ├── AddPlaceDialog.tsx, CertificateDialog.tsx, CertificateCapture.tsx
    │   ├── AuthDialog.tsx, AccountButton.tsx, Modal.tsx, SharedPlace.tsx
    └── lib/
        ├── types.ts               טיפוסים ורמות (תואם ל-level_rank ב-SQL)
        ├── places.ts              כל הגישה לנתונים
        ├── claims.ts, geo.ts, hours.ts, errors.ts, useUser.ts
        └── supabase/              client, server, middleware
```

## כללי הנתונים (נאכפים בבסיס הנתונים)

| כלל | איפה |
|---|---|
| 3 אישורים → `verified`, 3 דחיות → `rejected` | `apply_vote()`, `verify_threshold()` |
| אי אפשר להצביע על טענה שהצעת | `apply_vote()` |
| טענה מאומתת חדשה מחליפה את הקודמת (`superseded`) | `apply_vote()` |
| 3 דיווחי "כבר לא נכון" אחרי האישור האחרון → `disputed` | `apply_vote()` |
| כשרות רק עם תעודה, ורק תעודה בתוקף | `propose_kosher_claim()` + RLS |
| תעודה שפגה לא נחשבת בסינון | `nearby_places()` |
| תמונות רק בתיקייה של המשתמש | Storage policy |
| 20 קריאות תעודה לשעה למשתמש | `log_extraction()` |

## הרצה

### 1. חשבונות (כולם עם מסלול חינמי)

- [Supabase](https://supabase.com): פרויקט חדש
- [Mapbox](https://account.mapbox.com): טוקן ציבורי (`pk.`)
- [Anthropic Console](https://console.anthropic.com): מפתח API
- [Google Cloud](https://console.cloud.google.com): רק אם רוצים התחברות עם Google

### 2. התקנה ובסיס נתונים

```bash
npm install
npx supabase init             # יוצר supabase/config.toml, לא נוגע במיגרציות
npx supabase login
npx supabase link --project-ref <ה-ref של הפרויקט>
npx supabase db push          # מריץ את שתי המיגרציות
cp .env.example .env.local    # ומלאו את המפתחות
```

PostGIS מופעל אוטומטית על ידי המיגרציה.

### 3. הגדרות התחברות ב-Supabase

**Authentication → URL Configuration:**
- Site URL: `http://localhost:3000` (ובהמשך הדומיין שלכם)
- Redirect URLs: `http://localhost:3000/auth/callback` ו-`https://<הדומיין>/auth/callback`

**קישור במייל** עובד מיד. לפרודקשן כדאי לחבר SMTP משלכם (Authentication → Emails), כי לשרת המובנה יש מגבלת שליחה נמוכה.

**Google** (לא חובה): ב-Google Cloud צרו OAuth Client מסוג Web, עם Authorized redirect URI:
`https://<project-ref>.supabase.co/auth/v1/callback`. הדביקו את ה-Client ID וה-Secret ב-Authentication → Providers → Google.

### 4. הרצה

```bash
npm run dev
```

### 5. נתונים ראשונים

```bash
npm run import:osm -- --bbox 32.06,34.77,32.10,34.84 --dry-run   # רק מציג מה יימצא
npm run import:osm -- --bbox 32.06,34.77,32.10,34.84
```

מקומות עם `diet:vegan` או `diet:gluten_free` נכנסים עם טענה שממתינה לאישור. מקומות עם `diet:kosher` נכנסים בלי טענת כשרות, כי כשרות דורשת צילום תעודה. כדאי גם לצלם בעצמכם כמה עשרות מקומות באזור לפני שמפיצים.

לפיתוח מקומי בלבד אפשר להריץ את `supabase/seed.sql` ב-SQL Editor. אלה מקומות מומצאים.

## העלאה לאוויר (Vercel)

1. דחפו את הקוד ל-GitHub וייבאו ב-[Vercel](https://vercel.com/new)
2. הוסיפו את משתני הסביבה מ-`.env.local`, **חוץ מ-`SUPABASE_SERVICE_ROLE_KEY`**, שלא נדרש באתר
3. הוסיפו את כתובת האתר ל-Redirect URLs ב-Supabase
4. ב-Mapbox הגבילו את הטוקן לדומיין שלכם (URL restrictions)

## לפני שמתחילים

הקוד נכתב בלי אפשרות להריץ כאן `npm install`. הלוגיקה של בסיס הנתונים נבדקה על Postgres אמיתי, והקוד עבר בדיקת טיפוסים מול הגדרות חלקיות של הספריות. ייתכן שה-`npm run build` הראשון יציג שגיאה קטנה מול ה-API המדויק של אחת הספריות. אם כן, תקנו לפי ההודעה, או שלחו אותה ל-Claude.

## רעיונות להמשך

- משקל להצבעות: אישור של מי שהגדיר את עצמו צליאק שווה יותר ל"מטבח נפרד" (`profiles.own_needs` כבר קיים)
- התראה למי שהוסיף תעודה כשהיא עומדת לפוג
- שעות פתיחה: הוספה ועריכה מהממשק, וייבוא `opening_hours` מ-OSM
- חלאל, באותו מנגנון של תעודות
