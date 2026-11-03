<div dir="rtl">

<p align="center">
  <img src="src/app/icon.svg" width="72" alt="הלוגו של Okeat">
</p>

<h1 align="center">Okeat</h1>

<p align="center"><a href="https://github.com/NoyaAdivi/Okeat#readme">English</a> · <b>עברית</b></p>

<p align="center"><b>OK to eat</b> · מפה של מקומות אוכל כשרים, טבעוניים, צמחוניים וללא גלוטן בישראל,<br>שבה כל פרט מאושר על ידי אנשים שהיו במקום בעצמם.</p>

<p align="center"><a href="https://okeat.vercel.app"><b>🌐 לאתר עצמו: okeat.vercel.app</b></a></p>

<p align="center"><img src="okeat.png" alt="Okeat screenshot" width="800"></p>

---

## ✨ מה יש באתר

- **מפה של כל הארץ** עם יותר מ-20,000 מקומות אוכל, מקובצים כדי שתיטען מהר, רק ישראל, בעברית ובאנגלית, עם מצב בהיר, כהה ואוטומטי
- **סינון** לפי צורך ורמה (למשל "מהדרין ומעלה", "מטבח נפרד ללא גלוטן"), צמחוני ואלרגיות (חלב, ביצים, בוטנים, אגוזים, שומשום, סויה), לפי סוג אוכל (פיצה, סושי, בית קפה…) ו"פתוח עכשיו" לפי שעון ישראל
- **אישור קהילתי**: כל פרט צריך 3 אישורים, אי אפשר לאשר את מה שהוספת בעצמך, ואפשר לדווח על מידע שכבר לא נכון
- **פרטי כשרות**: בוחרים גוף משגיח (כולל צהר או "לא ידוע"), וצילום תעודה הוא לא חובה ורק מחזק את המידע. האתר קורא ממנה את הגוף המשגיח, הרמה ותאריך התוקף (כולל תאריך עברי), ותעודה שפג תוקפה מסומנת לבד
- **ניווט בתוך האתר** ברגל, באופניים או ברכב, עם הנחיות קוליות בעברית, חישוב מסלול מחדש ובחירת מיקום ידנית
- **בלי הרשמה**: חשבון אנונימי אוטומטי, ואפשר גם להתחבר עם Google או מייל
- **נגישות**: גודל טקסט, ניגודיות גבוהה, מצב כהה, הקראה, עצירת אנימציות, גופן קריא ותמיכה מלאה במקלדת
- **מידע חי מגוגל** (לא חובה): סוג המקום, שעות, דירוג ושירותים, מוצג רק כשפותחים מקום ולא נשמר
- **ביקורות, מועדפים ותמונות**: דירוג של 1 עד 5 כוכבים עם תגובה קצרה, רשימה פרטית של מקומות שמורים בפרופיל, ותמונות של מקומות שמופיעות אחרי אישור מנהל.
- **בדיקות**: בדיקות אוטומטיות רצות ב-GitHub בכל העלאה, ושגיאות מהדפדפן נאספות באופן פרטי למנהלת.
- **ניהול קהילתי**: 3 דיווחים שולחים מקום למנהלים. מנהלים ממונים על ידי מנהלת האתר, מידע שהיא מוסיפה מאושר מיד, ואנשים יכולים לתקן סיווגים אוטומטיים
- **פרופילים ציבוריים**: תאריך הצטרפות, מקומות שנוספו ואישורים, בלי כתובת מייל
- **אישור בעל עסק**: בעל העסק מוכיח בעלות עם קוד, ומנהל מאשר
- טופס יצירת קשר, תנאי שימוש, מדיניות פרטיות והצהרת נגישות

📐 איך הכל מתחבר: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🛠️ טכנולוגיות

| חלק | טכנולוגיה |
|---|---|
| מסגרת | Next.js 15, React 19, TypeScript |
| מסד נתונים | Supabase: Postgres עם PostGIS, הרשאות ברמת שורה, התחברות ואחסון תמונות |
| מפות | Mapbox GL JS, מסלולים וחיפוש כתובות של Mapbox |
| קריאת תעודות | Tesseract OCR בדפדפן, ו-Claude API כשמוגדר מפתח |
| סיווג | כללים לפי שם וסוג מקום, ו-Claude API כשמוגדר מפתח |
| מידע | OpenStreetMap ו-Overture Maps (מאגרים פתוחים) |

## 🔒 כללי המידע (נאכפים במסד הנתונים)

| כלל | איפה |
|---|---|
| 3 אישורים: מאושר. 3 דחיות: נדחה | `apply_vote()` |
| אי אפשר להצביע על פרט שהצעת | `apply_vote()` |
| פרט מאושר חדש מחליף את הקודם | `apply_vote()` |
| 3 דיווחים של "כבר לא נכון": במחלוקת | `apply_vote()` |
| כשרות עם תמונה או בלעדיה, ותעודה שפג תוקפה לא נספרת | `effective_claims` |
| 3 דיווחים על מקום: המנהלים מחליטים | `after_report()`, `moderate_place()` |
| מנהלים ממונים על ידי מנהלת האתר, ואי אפשר לשנות לעצמך הרשאה | הרשאות עמודות |
| אישור בעל עסק דורש מנהל | `decide_ownership()` |
| מידע מיובא או אוטומטי מסומן ככזה ולא נחשב מאושר | `claims.source` |
| הגבלת קצב לקריאת תעודות ולהודעות | `log_extraction()`, `feedback_rate_limit()` |

## 📂 מבנה הפרויקט

<div dir="ltr">

```
├── src/
│   ├── app/                 pages: home, map, place/[id], about, contact, legal pages, API routes
│   ├── components/          MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/                 data access, types, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/          0001 … 0012
│   ├── RUN-ME-IN-SUPABASE.sql
│   ├── RUN-ME-2-IN-SUPABASE.sql
│   └── RUN-ME-3-IN-SUPABASE.sql
└── scripts/
    ├── import-osm.mjs       ייבוא מ-OpenStreetMap
    ├── import-overture.mjs  ייבוא מ-Overture Maps
    ├── classify-ai.mjs      סיווג סוגי אוכל עם Claude
    └── classify-diet.mjs    השערות טבעוני, צמחוני וללא גלוטן, מסומנות כלא מאושרות
```

</div>

## 💻 הרצה על המחשב

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
npm run classify:diet
```

</div>

> את המפתח `SUPABASE_SERVICE_ROLE_KEY` משתמשים רק בסקריפטים של הייבוא, על המחשב שלך. אסור לשים אותו בדפדפן או בהגדרות של שירות האחסון.

## 🙏 קרדיטים

מידע על מקומות: © התורמים של [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) ו-[Overture Maps Foundation](https://overturemaps.org) (CDLA Permissive 2.0). מפה: © Mapbox.

</div>
