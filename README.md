<p align="center">
  <a href="https://okeat.vercel.app"><img src="public/icon-192.png" width="96" alt="Okeat"></a>
</p>

<h1 align="center">Okeat</h1>

<p align="center"><b>English</b> · <a href="README.he.md">עברית</a></p>

<p align="center">
  <b>OK to eat.</b><br>
  A bilingual map of kosher, vegan, vegetarian and gluten-free eateries across Israel,<br>
  where the community confirms what is true and the database enforces the rules.
</p>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="https://img.shields.io/badge/Open_live_site-FFD5C9?style=for-the-badge&logo=vercel&logoColor=A8483A" alt="Open live site"></a>
</p>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="okeat-en.png" width="820" alt="Okeat map and home page"></a>
</p>

<p align="center">
  🗺️ <b>20,000+</b> eateries &nbsp;·&nbsp; ✅ <b>3</b> confirmations per claim &nbsp;·&nbsp; 🌍 Hebrew + English &nbsp;·&nbsp; 🧪 Tests on every push
</p>

## ✨ Highlights

### 🗺️ Find a place you can eat at
- **Nationwide map** of 20,000+ eateries across Israel, clustered so it stays fast
- **Filters that matter:** kosher level and supervising body, vegan, vegetarian, gluten-free and allergies
- **Smart search:** "kosher pizza open now in Ramat Gan" becomes filters and a city
- **Turn-by-turn navigation** inside the site with Hebrew voice guidance

### 🤝 Information the community can trust
- **Every claim needs 3 confirmations,** and nobody can confirm their own
- **Kosher certificates** can be added as photos and are read with OCR
- **Rules live in the database** (Row Level Security and triggers), so they hold even without the site
- **Moderators** appointed by the admin handle reported places

### 💛 Built like a real product
- **Reviews, saved places, shareable lists** and photo uploads with approval
- **Business owners** prove ownership with a code and update their own details
- **Admin hub** that flags suspicious names, duplicates and rough locations by itself
- **Full accessibility menu,** dark mode, right-to-left support and an installable app
- **Automated tests** and real-browser screen checks on GitHub Actions

## 🛠️ Tech stack

| Part | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Database | Supabase - Postgres + PostGIS, Row Level Security, Auth, Storage |
| Maps | Mapbox GL JS v3, Mapbox Directions & Geocoding |
| Certificate reading | Tesseract OCR in the browser; Claude API when a key is set |
| Classification | Name and type rules; Claude API when a key is set |
| Data | OpenStreetMap (ODbL), Overture Maps (CDLA Permissive 2.0) |

## 🔒 Data rules (enforced in the database)

| Rule | Where |
|---|---|
| 3 confirmations → `verified`, 3 rejections → `rejected` | `apply_vote()` |
| You can't vote on a claim you proposed | `apply_vote()` |
| A newer verified claim replaces the older one | `apply_vote()` |
| 3 "no longer true" reports → `disputed` | `apply_vote()` |
| Kosher with or without a photo; an expired certificate stops counting | `effective_claims` |
| 3 reports on a place → moderators decide | `after_report()`, `moderate_place()` |
| Moderators are appointed by the admin; people cannot change their own role | Column grants |
| Owner approval needs an admin | `decide_ownership()` |
| Imported / automatic info is labelled and never counts as community-verified | `claims.source` |
| Rate limits on certificate reading and contact messages | `log_extraction()`, `feedback_rate_limit()` |

## 📂 Project structure

```
├── src/
│   ├── app/                 pages: home, map, place/[id], cities, city/[slug], topic/[slug], u/[id], about, contact, legal pages, API routes
│   ├── components/          MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/                 data access, types, food types, filters, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/          0001 … 0051 (schema, RLS, functions)
│   ├── RUN-ME-IN-SUPABASE.sql … RUN-ME-44-IN-SUPABASE.sql   the same migrations, ready to paste into the SQL Editor
│   └── TEST-SETUP-IN-NEW-SUPABASE.sql   everything in one file, for a fresh test project
├── tests/                   automated tests (npm test)
└── scripts/
    ├── import-osm.mjs       import eateries from OpenStreetMap
    ├── import-overture.mjs  import more eateries from Overture Maps
    ├── classify-ai.mjs      give a food type to unclassified places with Claude
    ├── classify-free.mjs    give a food type by name rules, without an API key
    ├── classify-diet.mjs    add vegan, vegetarian and gluten-free guesses, labelled as not confirmed
    ├── fix-locations.mjs    find and fix places with a wrong location
    ├── backup.mjs           back up the database
    └── screenshots.mjs      take screenshots of the site
```

## 💻 Running locally

1. Create free accounts: [Supabase](https://supabase.com), [Mapbox](https://mapbox.com), [Anthropic](https://console.anthropic.com).
2. In Supabase → SQL Editor, run the files in `supabase/migrations/` in order.
3. Copy `.env.example` to `.env.local` and fill in the keys.
4. Install and start:
   ```bash
   npm install
   npm run dev
   ```
   Check the code with `npm run typecheck` and `npm test`.
5. Fill the map:
   ```bash
   npm run import:osm
   npm install @duckdb/node-api && npm run import:overture
   npm run classify
   npm run classify:diet
   ```

> `SUPABASE_SERVICE_ROLE_KEY` is only for the import scripts on your own computer. Never put it in the browser or in your hosting settings.

## 🙏 Attribution

Place data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL) and [Overture Maps Foundation](https://overturemaps.org) (CDLA Permissive 2.0). Map © Mapbox.
