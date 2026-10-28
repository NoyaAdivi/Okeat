<div dir="rtl">

<p align="center">
  <img src="src/app/icon.svg" width="72" alt="הלוגו של Okeat">
</p>

<h1 align="center">Okeat</h1>

<p align="center"><a href="README.md">English</a> · <b>עברית</b></p>

<p align="center"><b>OK to eat</b> · מפה של מקומות אוכל כשרים, טבעוניים וללא גלוטן בישראל,<br>שבה כל פרט מאושר על ידי אנשים שהיו במקום בעצמם.</p>

<p align="center"><a href="https://okeat.vercel.app"><b>🌐 לאתר עצמו: okeat.vercel.app</b></a></p>

---

## מה יש באתר

- **מפה של כל הארץ** עם אלפי מקומות אוכל, מקובצים כדי שתיטען מהר, רק ישראל ושמות בעברית
- **סינון** לפי צורך ורמה (למשל "מהדרין ומעלה", "מטבח נפרד ללא גלוטן"), לפי סוג אוכל (פיצה, סושי, בית קפה…) ו"פתוח עכשיו" לפי שעון ישראל
- **אישור קהילתי**: כל פרט צריך 3 אישורים, אי אפשר לאשר את מה שהוספת בעצמך, ואפשר לדווח על מידע שכבר לא נכון
- **תעודות כשרות**: כשרות נוספת רק עם צילום תעודה. Claude קורא ממנה את הגוף המשגיח, הרמה ותאריך התוקף (כולל תאריך עברי), ותעודה שפג תוקפה מסומנת לבד
- **ניווט בתוך האתר** ברגל, באופניים או ברכב, עם הנחיות קוליות בעברית, חישוב מסלול מחדש ובחירת מיקום ידנית
- **בלי הרשמה**: חשבון אנונימי אוטומטי, ואפשר גם להתחבר עם Google או מייל
- **נגישות**: גודל טקסט, ניגודיות גבוהה, מצב כהה, הקראה, עצירת אנימציות, גופן קריא ותמיכה מלאה במקלדת
- **מידע חי מגוגל** (לא חובה): סוג המקום, שעות, דירוג ושירותים, מוצג רק כשפותחים מקום ולא נשמר
- טופס יצירת קשר, תנאי שימוש, מדיניות פרטיות והצהרת נגישות

## טכנולוגיות

| חלק | טכנולוגיה |
|---|---|
| מסגרת | Next.js 15, React 19, TypeScript |
| מסד נתונים | Supabase: Postgres עם PostGIS, הרשאות ברמת שורה, התחברות ואחסון תמונות |
| מפות | Mapbox GL JS, מסלולים וחיפוש כתובות של Mapbox |
| בינה מלאכותית | Claude API: קריאת תעודות וסיווג סוגי אוכל |
| מידע | OpenStreetMap ו-Overture Maps (מאגרים פתוחים) |

## כללי המידע (נאכפים במסד הנתונים)

| כלל | איפה |
|---|---|
| 3 אישורים: מאושר. 3 דחיות: נדחה | `apply_vote()` |
| אי אפשר להצביע על פרט שהצעת | `apply_vote()` |
| פרט מאושר חדש מחליף את הקודם | `apply_vote()` |
| 3 דיווחים של "כבר לא נכון": במחלוקת | `apply_vote()` |
| כשרות רק עם צילום של תעודה בתוקף | `propose_kosher_claim()` |
| מידע מיובא או אוטומטי מסומן ככזה ולא נחשב מאושר | `claims.source` |
| הגבלת קצב לקריאת תעודות ולהודעות | `log_extraction()`, `feedback_rate_limit()` |

## מבנה הפרויקט

<div dir="ltr">

```
├── src/
│   ├── app/                 pages: home, map, place/[id], about, contact, legal pages, API routes
│   ├── components/          MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/                 data access, types, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/          0001 … 0007
│   └── RUN-ME-IN-SUPABASE.sql
└── scripts/
    ├── import-osm.mjs       ייבוא מ-OpenStreetMap
    ├── import-overture.mjs  ייבוא מ-Overture Maps
    └── classify-ai.mjs      סיווג סוגי אוכל עם Claude
```

</div>

## הרצה על המחשב

1. פותחים חשבונות חינמיים ב-[Supabase](https://supabase.com), ב-[Mapbox](https://mapbox.com) וב-[Anthropic](https://console.anthropic.com).
2. ב-Supabase, ב-SQL Editor, מריצים לפי הסדר את הקבצים בתיקייה `supabase/migrations/`, ומפעילים **Anonymous sign-ins** (תחת Authentication ואז Providers).
3. מעתיקים את `.env.example` לקובץ בשם `.env.local` וממלאים את המפתחות.
4. מתקינים ומפעילים:

<div dir="ltr">

```bash
npm install
npm run dev
```

</div>

5. ממלאים את המפה במקומות:

<div dir="ltr">

```bash
npm run import:osm
npm install @duckdb/node-api && npm run import:overture
npm run classify
```

</div>

> את המפתח `SUPABASE_SERVICE_ROLE_KEY` משתמשים רק בסקריפטים של הייבוא, על המחשב שלך. אסור לשים אותו בדפדפן או בהגדרות של שירות האחסון.

## קרדיטים

מידע על מקומות: © התורמים של [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) ו-[Overture Maps Foundation](https://overturemaps.org) (CDLA Permissive 2.0). מפה: © Mapbox.

</div>
