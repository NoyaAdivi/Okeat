<p align="center">
  <img src="src/app/icon.svg" width="72" alt="Okeat logo">
</p>

<h1 align="center">Okeat</h1>

<p align="center"><b>English</b> · <a href="README.he.md">עברית</a></p>

<p align="center"><b>OK to eat</b> · A map of kosher, vegan, vegetarian and gluten-free places to eat in Israel,<br>where every claim is confirmed by people who have actually been there.</p>

<p align="center"><a href="https://okeat.vercel.app"><b>🌐 Open the live site: okeat.vercel.app</b></a></p>

<p align="center"><img src="okeat.png" alt="Okeat screenshot" width="800"></p>

---

## ✨ Features

- **Nationwide map** of over 20,000 eateries, clustered for speed, Israel only, in Hebrew and English, with light, dark and automatic themes
- **Filters** by need and level (e.g. "Mehadrin and up", "separate gluten-free kitchen"), vegetarian and allergies (dairy, egg, peanuts, nuts, sesame, soy), by food type (pizza, sushi, coffee…) and "open now" in Israel time
- **Community verification** – every claim needs 3 confirmations; you can't confirm your own; outdated info can be reported
- **Kosher details** – choose the supervising body (including Tzohar or "unknown"); a certificate photo is optional and strengthens the claim. The site reads the supervising body, level and expiry date (including Hebrew dates). Expired certificates are flagged automatically
- **Turn-by-turn navigation** inside the site (walking, cycling, driving) with Hebrew voice guidance, rerouting and "choose my location"
- **Open to read, accounts to contribute** – anyone can search; adding, confirming and reporting need Google or email sign-in
- **Accessibility** – text size, high contrast, dark mode, read-aloud, pause animations, readable font, full keyboard support
- **Live details from Google** (optional) – type, hours, rating and services, shown on demand and never stored
- **Reviews, saved places and photos** – 1–5 star reviews with a short comment, a private saved list on your profile, and place photos that appear after moderator approval
- **Tests** – automated tests run on GitHub on every push, and browser errors are collected privately for the admin
- **Smart search** – "kosher pizza open now in Ramat Gan" becomes filters and a city; a filter can be kept on the device
- **Lists and notifications** – shareable lists, similar places, badges, and on-site notifications when information is confirmed or a certificate is ending
- **Business owners** – verified owners update hours, phone, website and a menu link
- **Admin tools** – dashboard, limits, activity log, users and roles, contact messages, photo approval and merging duplicates
- **City pages and installable app** – a page for each main city, and an app icon for the phone home screen
- **Community moderation** – 3 reports send a place to moderators; moderators are appointed by the admin, and details the admin adds are confirmed right away; automatic guesses can be corrected by people
- **Public profiles** – join date, places added and confirmations, never an e-mail address
- **Business owner approval** – owners prove ownership with a code and an admin approves them
- Contact form, terms of use, privacy policy and accessibility statement

📐 How it fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🛠️ Tech stack

| Part | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Database | Supabase – Postgres + PostGIS, Row Level Security, Auth, Storage |
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
│   ├── app/                 pages: home, map, place/[id], about, contact, legal pages, API routes
│   ├── components/          MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/                 data access, types, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/          0001 … 0028 (schema, RLS, functions)
│   ├── RUN-ME-IN-SUPABASE.sql   migrations 0003 – 0007 in one file
│   ├── RUN-ME-2-IN-SUPABASE.sql same as 0008
│   ├── RUN-ME-3-IN-SUPABASE.sql same as 0009
│   └── RUN-ME-4 … 10-IN-SUPABASE.sql same as the later migrations
└── scripts/
    ├── import-osm.mjs       import eateries from OpenStreetMap
    ├── import-overture.mjs  import more eateries from Overture Maps
    ├── classify-ai.mjs      give a food type to unclassified places with Claude
    └── classify-diet.mjs    add vegan, vegetarian and gluten-free guesses, labelled as not confirmed
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
