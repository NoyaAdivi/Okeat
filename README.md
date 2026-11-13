<p align="center">
  <a href="https://okeat.vercel.app"><img src="docs/readme/banner-en.svg" width="100%" alt="Okeat: a bilingual, community-verified map of kosher, vegan, vegetarian and gluten-free eateries across Israel"></a>
</p>

<p align="center"><a href="README.he.md"><img src="docs/readme/lang-he.svg" height="44" alt="לגרסה בעברית"></a></p>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="https://img.shields.io/badge/Open_live_site-FFD5C9?style=for-the-badge&logo=googlechrome&logoColor=A8483A" alt="Open live site"></a>
  <a href="https://okeat.vercel.app/map"><img src="https://img.shields.io/badge/Explore_the_map-D9F3E7?style=for-the-badge&logo=mapbox&logoColor=1F7350" alt="Explore the map"></a>
  <a href="docs/ARCHITECTURE.md"><img src="https://img.shields.io/badge/Architecture-DAD5FF?style=for-the-badge&logo=databricks&logoColor=5548C8" alt="Architecture"></a>
</p>

<p align="center">
  <a href="https://github.com/NoyaAdivi/Okeat/actions/workflows/tests.yml"><img src="https://github.com/NoyaAdivi/Okeat/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/NoyaAdivi/Okeat?color=DAD5FF&labelColor=5548C8" alt="License"></a>
  <a href="https://github.com/NoyaAdivi/Okeat/commits/main"><img src="https://img.shields.io/github/last-commit/NoyaAdivi/Okeat?color=FFD5C9&labelColor=A8483A" alt="Last commit"></a>
  <a href="https://github.com/NoyaAdivi/Okeat"><img src="https://img.shields.io/github/languages/top/NoyaAdivi/Okeat?color=D9F3E7&labelColor=1F7350" alt="Top language"></a>
</p>

<h3 align="center">OK to eat. Find where you can really eat, without guessing.</h3>

<p align="center">
  Okeat is a bilingual map of <b>20,000+</b> kosher, vegan, vegetarian and gluten-free eateries across Israel.<br>
  Locals add places, other locals confirm them, and the database itself enforces every rule.
</p>

<table align="center">
  <tr>
    <td align="center" width="25%"><a href="https://okeat.vercel.app/map"><b>🗺️ 20,000+</b></a><br><sub>eateries on the map</sub></td>
    <td align="center" width="25%"><a href="#-how-trust-works"><b>✅ 3</b></a><br><sub>confirmations per claim</sub></td>
    <td align="center" width="25%"><a href="https://okeat.vercel.app/cities"><b>🌍 HE · EN</b></a><br><sub>fully bilingual, RTL ready</sub></td>
    <td align="center" width="25%"><a href="https://github.com/NoyaAdivi/Okeat/actions/workflows/tests.yml"><b>🧪 CI</b></a><br><sub>tests on every push</sub></td>
  </tr>
</table>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="docs/images/Banner.png" width="100%" alt="Okeat: a bilingual, community-verified map of kosher, vegan, vegetarian and gluten-free eateries across Israel"></a>
</p>

<a name="highlights"></a>
<p align="center"><a href="#see-it-in-action"><img src="docs/readme/highlights-en.svg" width="100%" alt="Highlights"></a></p>

<table>
  <tr valign="top">
    <td valign="top" width="33%">
      <p><b>🗺️ Find a place to eat</b></p>
      <ul>
        <li><a href="https://okeat.vercel.app/map"><b>Nationwide map</b></a>, clustered so it stays fast</li>
        <li><b>Filters that matter:</b> kosher level and supervising body, vegan, vegetarian, gluten-free, allergies</li>
        <li><b>Smart search:</b> "kosher pizza open now in Ramat Gan" becomes filters and a city</li>
        <li><b>Turn-by-turn navigation</b> with Hebrew voice guidance</li>
      </ul>
    </td>
    <td valign="top" width="33%">
      <p><b>🤝 Information you can trust</b></p>
      <ul>
        <li><b>Every claim needs 3 confirmations</b>, and nobody can confirm their own</li>
        <li><b>Kosher certificates</b> are added as photos and read with OCR</li>
        <li><b>Rules live in the database</b> (Row Level Security and triggers)</li>
        <li><b>Moderators</b> appointed by the admin handle reported places</li>
      </ul>
    </td>
    <td valign="top" width="33%">
      <p><b>💛 Built like a real product</b></p>
      <ul>
        <li><b>Reviews, saved places, shareable lists</b> and photo uploads with approval</li>
        <li><b>Business owners</b> prove ownership with a code</li>
        <li><b>Admin hub</b> that flags duplicates and rough locations by itself</li>
        <li><a href="https://okeat.vercel.app/accessibility"><b>Accessibility menu</b></a>, dark mode, RTL and an installable app</li>
      </ul>
    </td>
  </tr>
</table>

<a name="see-it-in-action"></a>
<p align="center"><a href="#-how-trust-works"><img src="docs/readme/screens-en.svg" width="100%" alt="See it in action"></a></p>

<p align="center">
  <a href="https://okeat.vercel.app/map"><img src="docs/images/okeat-en.png" width="100%" alt="Okeat map with the place list and the home page"></a>
</p>

<p align="center">
  <a href="https://okeat.vercel.app"><b>Home</b></a> ·
  <a href="https://okeat.vercel.app/map"><b>Map</b></a> ·
  <a href="https://okeat.vercel.app/cities"><b>Cities</b></a> ·
  <a href="https://okeat.vercel.app/about"><b>How it works</b></a> ·
  <a href="https://okeat.vercel.app/accessibility"><b>Accessibility</b></a>
</p>

<a name="-how-trust-works"></a>
<p align="center"><a href="#tech-stack"><img src="docs/readme/trust-en.svg" width="100%" alt="How trust works"></a></p>

```mermaid
flowchart LR
  A([Someone adds a claim<br/>kosher · vegan · gluten-free]) --> B{Community votes}
  B -->|3 confirmations| C([✅ Verified])
  B -->|3 rejections| D([❌ Rejected])
  C -->|3 'no longer true' reports| E([⚠️ Disputed])
  C -->|a newer claim is verified| F([🔄 Replaced])
  style A fill:#E8E4FF,stroke:#6F60F0,color:#2C2668
  style B fill:#FFE6DE,stroke:#E36E57,color:#2C2668
  style C fill:#D9F3E7,stroke:#1F7350,color:#1F4D38
  style D fill:#FBD5E0,stroke:#A03A5C,color:#5C1F33
  style E fill:#FFF1C9,stroke:#B98A1E,color:#5C4410
  style F fill:#DAD5FF,stroke:#5548C8,color:#2C2668
```

<p align="center"><sub>You can't vote on a claim you proposed. Imported and automatic info is labelled and never counts as community-verified.</sub></p>

<a name="tech-stack"></a>
<p align="center"><a href="#data-rules"><img src="docs/readme/stack-en.svg" width="100%" alt="Tech Stack"></a></p>

<p align="center"><b>App</b><br>
<a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js_15-DAD5FF?style=for-the-badge&logo=nextdotjs&logoColor=5548C8" alt="Next.js 15"></a>
<a href="https://react.dev"><img src="https://img.shields.io/badge/React_19-DAD5FF?style=for-the-badge&logo=react&logoColor=5548C8" alt="React 19"></a>
<a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-DAD5FF?style=for-the-badge&logo=typescript&logoColor=5548C8" alt="TypeScript"></a>
</p>

<p align="center"><b>Data</b><br>
<a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-FBD5E0?style=for-the-badge&logo=supabase&logoColor=A03A5C" alt="Supabase"></a>
<a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-FBD5E0?style=for-the-badge&logo=postgresql&logoColor=A03A5C" alt="PostgreSQL"></a>
<a href="https://postgis.net"><img src="https://img.shields.io/badge/PostGIS-FBD5E0?style=for-the-badge&logo=postgresql&logoColor=A03A5C" alt="PostGIS"></a>
<a href="https://www.openstreetmap.org"><img src="https://img.shields.io/badge/OpenStreetMap-FBD5E0?style=for-the-badge&logo=openstreetmap&logoColor=A03A5C" alt="OpenStreetMap"></a>
</p>

<p align="center"><b>Maps &amp; AI</b><br>
<a href="https://www.mapbox.com"><img src="https://img.shields.io/badge/Mapbox_GL-D9F3E7?style=for-the-badge&logo=mapbox&logoColor=1F7350" alt="Mapbox GL"></a>
<a href="https://tesseract-ocr.github.io"><img src="https://img.shields.io/badge/Tesseract_OCR-D9F3E7?style=for-the-badge&logo=googlelens&logoColor=1F7350" alt="Tesseract OCR"></a>
<a href="https://www.anthropic.com/claude"><img src="https://img.shields.io/badge/Claude_API-D9F3E7?style=for-the-badge&logo=anthropic&logoColor=1F7350" alt="Claude API"></a>
</p>

<p align="center"><b>Ship</b><br>
<a href="https://vercel.com"><img src="https://img.shields.io/badge/Vercel-FFD5C9?style=for-the-badge&logo=vercel&logoColor=A8483A" alt="Vercel"></a>
<a href="https://github.com/NoyaAdivi/Okeat/actions"><img src="https://img.shields.io/badge/GitHub_Actions-FFD5C9?style=for-the-badge&logo=githubactions&logoColor=A8483A" alt="GitHub Actions"></a>
<a href="https://playwright.dev"><img src="https://img.shields.io/badge/Playwright-FFD5C9?style=for-the-badge&logo=playwright&logoColor=A8483A" alt="Playwright"></a>
</p>

<details>
<summary><b>🏗️ Architecture at a glance</b></summary>
<br>

```mermaid
flowchart LR
  U[Browser] -->|pages| V[Next.js on Vercel]
  U -->|data, sign-in, photos| S[(Supabase<br/>PostgreSQL + PostGIS)]
  U -->|map, routes| M[Mapbox]
  V -->|sessions| S
  I[Import scripts] -->|OpenStreetMap, Overture Maps| S
```

The browser talks to the database directly, so access rules live in PostgreSQL and hold even without the site. Full write-up in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
</details>

<a name="data-rules"></a>
<p align="center"><a href="#run-locally"><img src="docs/readme/rules-en.svg" width="100%" alt="Data rules"></a></p>

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

<a name="run-locally"></a>
<p align="center"><a href="#contact"><img src="docs/readme/run-en.svg" width="100%" alt="Run it locally"></a></p>

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

> [!IMPORTANT]
> `SUPABASE_SERVICE_ROLE_KEY` is only for the import scripts on your own computer. Never put it in the browser or in your hosting settings.

<details>
<summary><b>📂 Project structure</b></summary>

```
├── src/
│   ├── app/          pages: home, map, place/[id], cities, city/[slug], topic/[slug], u/[id], about, legal pages, API routes
│   ├── components/   MapScreen, MapView, NavPanel, PlaceDetail, FilterBar, dialogs, A11yMenu…
│   └── lib/          data access, types, food types, filters, geo, hours, speech, Supabase clients
├── supabase/
│   ├── migrations/   0001 … 0051 (schema, RLS, functions)
│   └── TEST-SETUP-IN-NEW-SUPABASE.sql   everything in one file, for a fresh test project
├── tests/            automated tests (npm test)
├── tools/            one-click Windows helpers (start, backup, import)
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
</details>

<details>
<summary><b>🙏 Attribution</b></summary>
<br>
Place data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL) and <a href="https://overturemaps.org">Overture Maps Foundation</a> (CDLA Permissive 2.0). Map © Mapbox.
</details>

<a name="contact"></a>
<p align="center"><a href="https://www.linkedin.com/in/noya-adivi/"><img src="docs/readme/footer-en.svg" width="100%" alt="Built by Noya Adivi"></a></p>

<p align="center">
  <a href="https://okeat.vercel.app"><img src="https://img.shields.io/badge/Open_Okeat-FFD5C9?style=for-the-badge&logo=googlechrome&logoColor=A8483A" alt="Open Okeat"></a>
  <a href="https://www.linkedin.com/in/noya-adivi/"><img src="https://img.shields.io/badge/LinkedIn-DAD5FF?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzU1NDhDOCIgZD0iTTIwLjQ1IDIwLjQ1aC0zLjU2di01LjU3YzAtMS4zMy0uMDMtMy4wNC0xLjg1LTMuMDQtMS44NiAwLTIuMTQgMS40NS0yLjE0IDIuOTR2NS42N0g5LjM1VjloMy40MXYxLjU2aC4wNWMuNDgtLjkgMS42NC0xLjg1IDMuMzctMS44NSAzLjYgMCA0LjI3IDIuMzcgNC4yNyA1LjQ2djYuMjh6TTUuMzQgNy40M2EyLjA2IDIuMDYgMCAxIDEgMC00LjEzIDIuMDYgMi4wNiAwIDAgMSAwIDQuMTN6TTcuMTIgMjAuNDVIMy41NlY5aDMuNTZ2MTEuNDV6TTIyLjIyIDBIMS43N0MuNzkgMCAwIC43NyAwIDEuNzN2MjAuNTRDMCAyMy4yMy43OSAyNCAxLjc3IDI0aDIwLjQ1Yy45OCAwIDEuNzgtLjc3IDEuNzgtMS43M1YxLjczQzI0IC43NyAyMy4yIDAgMjIuMjIgMHoiLz48L3N2Zz4=" alt="LinkedIn"></a>
  <a href="https://noyaadivi.github.io/noya-website"><img src="https://img.shields.io/badge/Portfolio-D9F3E7?style=for-the-badge&logo=githubpages&logoColor=1F7350" alt="Portfolio"></a>
  <a href="https://github.com/NoyaAdivi"><img src="https://img.shields.io/badge/More_projects-FBD5E0?style=for-the-badge&logo=github&logoColor=A03A5C" alt="More projects"></a>
</p>
