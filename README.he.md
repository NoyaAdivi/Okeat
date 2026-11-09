<div dir="rtl">

<p align="center">
  <a href="https://okeat.vercel.app"><img src="public/icon-192.png" width="96" alt="Okeat"></a>
</p>

<h1 align="center">Okeat</h1>

<p align="center"><a href="README.md">English</a> · <b>עברית</b></p>

<p align="center">
  <b>OK to eat · אוכלים בראש שקט.</b><br>
  מפה דו-לשונית של מקומות אוכל כשרים, טבעוניים, צמחוניים וללא גלוטן בישראל,<br>
  שבה הקהילה מאשרת את המידע ומסד הנתונים אוכף את הכללים.
</p>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="https://img.shields.io/badge/Open live site-FFD5C9?style=for-the-badge&logo=vercel&logoColor=A8483A" alt="Open live site"></a>
</p>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="okeat.png" width="820" alt="המפה ודף הבית של Okeat"></a>
</p>

<p align="center">
  🗺️ <b>20,000+</b> מקומות אוכל &nbsp;·&nbsp; ✅ <b>3</b> אישורים לכל טענה &nbsp;·&nbsp; 🌍 עברית ואנגלית &nbsp;·&nbsp; 🧪 בדיקות בכל עדכון
</p>

## ✨ מה מיוחד באתר

### 🗺️ למצוא מקום שאפשר לאכול בו
- **מפה ארצית** של יותר מ-20,000 מקומות אוכל, עם קיבוץ נקודות כדי שתישאר מהירה
- **סינון לפי מה שחשוב:** רמת כשרות וגוף משגיח, טבעוני, צמחוני, ללא גלוטן ואלרגיות
- **חיפוש חכם:** "פיצה כשרה פתוחה עכשיו ברמת גן" הופך לסינונים ולעיר
- **ניווט צעד אחר צעד** בתוך האתר, עם הנחיה קולית בעברית

### 🤝 מידע שהקהילה יכולה לסמוך עליו
- **כל טענה צריכה 3 אישורים,** ואי אפשר לאשר טענה של עצמך
- **תעודות כשרות** אפשר להוסיף כתמונה, והן נקראות ב-OCR
- **הכללים נמצאים במסד הנתונים** (RLS וטריגרים), כך שהם נשמרים גם בלי האתר
- **מנהלי קהילה** שהמנהל ממנה מטפלים במקומות שדווחו

### 💛 בנוי כמו מוצר אמיתי
- **ביקורות, מקומות שמורים, רשימות לשיתוף** והעלאת תמונות באישור
- **בעלי עסקים** מוכיחים בעלות עם קוד ומעדכנים את הפרטים שלהם
- **אזור ניהול** שמסמן לבד שמות חשודים, כפילויות ומיקומים לא מדויקים
- **תפריט נגישות מלא,** מצב כהה, תמיכה מימין לשמאל ואפשרות להתקין כאפליקציה
- **בדיקות אוטומטיות** ובדיקות מסך בדפדפן אמיתי ב-GitHub Actions

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
│   ├── app/                 pages: home, map, place/[id], cities, city/[slug], topic/[slug], u/[id], about, contact, legal pages, API routes
│   ├── components/          MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/                 data access, types, food types, filters, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/          0001 … 0051
│   ├── RUN-ME-IN-SUPABASE.sql … RUN-ME-44-IN-SUPABASE.sql   אותם עדכונים, מוכנים להדבקה ב-SQL Editor
│   └── TEST-SETUP-IN-NEW-SUPABASE.sql   הכול בקובץ אחד, לפרויקט בדיקה חדש
├── tests/                   בדיקות אוטומטיות (npm test)
└── scripts/
    ├── import-osm.mjs       ייבוא מ-OpenStreetMap
    ├── import-overture.mjs  ייבוא מ-Overture Maps
    ├── classify-ai.mjs      סיווג סוגי אוכל עם Claude
    ├── classify-free.mjs    סיווג סוגי אוכל לפי השם, בלי מפתח
    ├── classify-diet.mjs    השערות טבעוני, צמחוני וללא גלוטן, מסומנות כלא מאושרות
    ├── fix-locations.mjs    מציאה ותיקון של מיקומים שגויים
    ├── backup.mjs           גיבוי של מסד הנתונים
    └── screenshots.mjs      צילומי מסך של האתר
```

</div>

## 💻 הרצה על המחשב

1. פותחים חשבונות חינמיים ב-[Supabase](https://supabase.com), ב-[Mapbox](https://mapbox.com) וב-[Anthropic](https://console.anthropic.com).
2. ב-Supabase, ב-SQL Editor, מריצים לפי הסדר את הקבצים בתיקייה `supabase/migrations/`.
3. מעתיקים את `.env.example` לקובץ בשם `.env.local` וממלאים את המפתחות.
4. מתקינים ומפעילים:

<div dir="ltr">

```bash
npm install
npm run dev
```

</div>

בדיקת הקוד: `npm run typecheck` ו-`npm test`.

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
