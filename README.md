<p align="center">
  <img src="src/app/icon.svg" width="72" alt="Okeat logo">
</p>

<h1 align="center">Okeat</h1>

<p align="center"><b>English</b> · <a href="README.he.md">עברית</a></p>

<p align="center"><b>OK to eat</b> · A map of kosher, vegan and gluten-free places to eat in Israel,<br>where every claim is confirmed by people who have actually been there.</p>

---

## Features

- **Nationwide map** of thousands of eateries, clustered for speed, Israel only, labels in Hebrew
- **Filters** by need and level (e.g. "Mehadrin and up", "separate gluten-free kitchen"), by food type (pizza, sushi, coffee…) and "open now" in Israel time
- **Community verification** – every claim needs 3 confirmations; you can't confirm your own; outdated info can be reported
- **Kosher certificates** – kosher claims require a photo of the certificate; Claude reads the supervising body, level and expiry date (including Hebrew dates). Expired certificates are flagged automatically
- **Turn-by-turn navigation** inside the site (walking, cycling, driving) with Hebrew voice guidance, rerouting and "choose my location"
- **No sign-up needed** – anonymous accounts; optional Google / email sign-in
- **Accessibility** – text size, high contrast, dark mode, read-aloud, pause animations, readable font, full keyboard support
- **Live details from Google** (optional) – type, hours, rating and services, shown on demand and never stored
- Contact form, terms of use, privacy policy and accessibility statement

## Tech stack

| Part | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Database | Supabase – Postgres + PostGIS, Row Level Security, Auth, Storage |
| Maps | Mapbox GL JS v3, Mapbox Directions & Geocoding |
| AI | Claude API (certificate reading, food-type classification) |
| Data | OpenStreetMap (ODbL), Overture Maps (CDLA Permissive 2.0) |

## Data rules (enforced in the database)

| Rule | Where |
|---|---|
| 3 confirmations → `verified`, 3 rejections → `rejected` | `apply_vote()` |
| You can't vote on a claim you proposed | `apply_vote()` |
| A newer verified claim replaces the older one | `apply_vote()` |
| 3 "no longer true" reports → `disputed` | `apply_vote()` |
| Kosher only with a valid certificate photo | `propose_kosher_claim()` + RLS |
| Imported / automatic info is labelled and never counts as community-verified | `claims.source` |
| Rate limits on certificate reading and contact messages | `log_extraction()`, `feedback_rate_limit()` |

## Project structure

```
├── src/
│   ├── app/                 pages: home, map, place/[id], about, contact, legal pages, API routes
│   ├── components/          MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/                 data access, types, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/          0001 … 0007 (schema, RLS, functions)
│   └── RUN-ME-IN-SUPABASE.sql   all recent migrations in one file
└── scripts/
    ├── import-osm.mjs       import eateries from OpenStreetMap
    ├── import-overture.mjs  import more eateries from Overture Maps
    └── classify-ai.mjs      give a food type to unclassified places with Claude
```

## Running locally

1. Create free accounts: [Supabase](https://supabase.com), [Mapbox](https://mapbox.com), [Anthropic](https://console.anthropic.com).
2. In Supabase → SQL Editor, run the files in `supabase/migrations/` in order, and enable **Anonymous sign-ins** (Authentication → Providers).
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
   ```

> `SUPABASE_SERVICE_ROLE_KEY` is only for the import scripts on your own computer. Never put it in the browser or in your hosting settings.

## Attribution

Place data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL) and [Overture Maps Foundation](https://overturemaps.org) (CDLA Permissive 2.0). Map © Mapbox.
