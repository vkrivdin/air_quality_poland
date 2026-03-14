# Powietrze — Air Quality Web App
### Project Description Document
**Version:** 1.1 | **Date:** March 2026 | **Status:** Planning

---

## 1. Project Overview

**Powietrze** (Polish for *air*) is a consumer-facing web application that provides real-time and historical air quality data for Poland, with a strong focus on Kraków. The app is designed to be immediately useful to everyday users — no installation, no account required — and visually compelling enough to stand on its own as a portfolio piece demonstrating real data engineering and frontend skills.

The app opens directly in any web browser on desktop or mobile. Users can check the current air quality in their city at a glance, explore historical pollution trends over time, compare sensor stations across Poland, and receive clear in-app warnings when air quality reaches dangerous levels.

---

## 2. Goals

### Primary Goals
- Give Kraków residents and the broader Polish public an easy, beautiful way to understand the air they breathe
- Display real-time AQI (Air Quality Index) readings from multiple sensor networks
- Show historical trend data through interactive, self-sufficient charts
- Warn users clearly when pollution exceeds safe thresholds

### Secondary Goals
- Serve as a strong portfolio piece for a data analytics engineer — showcasing real data pipeline work, clean SQL schema design, API integration, and production-grade frontend code
- Be extensible: the architecture should allow future additions (email notifications, more data sources, city expansion) without major rewrites

---

## 3. Target Audience

| Segment | What they need |
|---|---|
| **Kraków residents** (primary) | Quick daily AQ check, danger warnings, context for smog seasons |
| **General Polish public** | Station map, compare cities, understand national AQ situation |
| **Data / research enthusiasts** | Historical data exploration, trend charts, raw index values |

---

## 4. Core Features (MVP)

### 4.1 Current Air Quality Dashboard
- Prominent AQI display for Kraków (and selected city) on page load
- Color-coded index levels following the Polish/European standard (Bardzo dobry → Bardzo zły)
- Key pollutant breakdown: PM2.5, PM10, NO₂, O₃, SO₂, CO
- Last updated timestamp, station name

### 4.2 In-App Warning System
- Sticky banner or modal when AQI exceeds "Zły" (Bad) threshold
- Color and iconography scale with severity (yellow → orange → red → dark red)
- Dismissible, but reappears on next visit if conditions persist
- No external services required — purely client-side logic based on API data
- Integrates official exceedance / alert information from GIOŚ APIs and advisory text from Airly indexes where available

### 4.3 Interactive Historical Charts
- Time-series charts for any selected pollutant and station
- Selectable time ranges: 24h, 7 days, 30 days, 90 days
- Recharts for standard charts (line, bar); D3.js for custom visuals (heatmaps, gauges)
- Data stored in Supabase from scheduled fetching — not dependent on live API uptime

### 4.4 Poland Station Map
- Interactive map showing all active GIOŚ monitoring stations
- Color-coded markers by current AQI level to make regional patterns immediately visible
- Click a station to see its current readings, AQI level and any active alerts, plus a link to its history
- Ability to zoom and pan to quickly locate cities / regions of interest
- Airly sensor overlay for Kraków and other supported cities (denser coverage, interpolated view optional)

### 4.5 Station Comparison
- Select 2–4 stations and compare their readings side by side
- Useful for researchers and data-curious users

### 4.6 Language Switcher (PL / EN)
- Polish as default language
- Full English translation available via toggle
- Stored in browser (localStorage) — persists across visits

---

## 5. Data Sources

### 5.1 GIOŚ (Główny Inspektorat Ochrony Środowiska)
- **URL:** https://api.gios.gov.pl/pjp-api/
- **Type:** Official Polish government air quality monitoring network
- **Coverage:** ~150 stations across Poland
- **Data:** Current sensor readings, AQI indexes, station metadata
- **Update frequency:** Hourly
- **Cost:** Free, no authentication required
- **Limitations:** No SLA, occasional downtime, limited historical depth via API

### 5.2 Airly
- **URL:** https://airly.org/api/
- **Type:** Commercial IoT sensor network, Kraków-born startup
- **Coverage:** Dense sensor network in Kraków and major Polish cities
- **Data:** Real-time PM1/PM2.5/PM10, temperature, humidity, historical data
- **Update frequency:** Every few minutes
- **Cost:** Free tier available for non-commercial projects
- **Limitations:** Requires API key registration (free), rate limits apply

### Data Strategy
Both APIs will be proxied and cached through the backend. A scheduled job (cron) fetches readings every 30–60 minutes and stores them in Supabase. This provides:
- Historical data depth beyond what either API natively exposes
- Resilience to API downtime (serve last known good data)
- A clean, unified data model regardless of source

---

## 6. Technical Architecture

### 6.1 Stack Overview

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (React) | Full-stack framework, API routes built-in, Vercel-native |
| **Backend API** | Next.js API Routes | No separate server needed; serverless functions on Vercel |
| **Database** | Supabase (PostgreSQL) | Free tier, built-in REST API, excellent SQL tooling |
| **Data Fetcher** | Vercel Cron Jobs | Scheduled fetching without a separate server |
| **Charts** | Recharts + D3.js | Recharts for standard charts; D3 for custom visuals |
| **Map** | Leaflet.js + React-Leaflet | Open source, no API key, OpenStreetMap tiles |
| **Styling** | Tailwind CSS | Utility-first, fast to build, consistent design system |
| **Hosting** | Vercel (free tier) | Zero-config Next.js deployment, free SSL, global CDN |
| **Version Control** | Git + GitHub | Portfolio-visible, documented commit history |

### 6.2 Architecture Diagram (simplified)

```
Browser (Next.js Frontend)
        │
        ▼
Next.js API Routes  ◄──── Vercel Cron Job (every 30min)
        │                         │
        ▼                         ▼
   Supabase DB  ◄─────────  GIOŚ API + Airly API
  (PostgreSQL)
```

### 6.3 Data Flow
1. Cron job fires every 30 minutes → fetches GIOŚ + Airly → normalises to unified schema → upserts into Supabase
2. User opens the app → Next.js page loads → API route queries Supabase → returns clean JSON
3. Frontend renders charts, map, AQI widgets from the JSON response
4. If Supabase query is fast, the user sees data in under 1 second

### 6.4 Local Development First
All development and testing happens locally before anything is deployed. The sequence is always:

1. Build and test the feature locally (`npm run dev`)
2. Confirm it works as expected in the browser
3. Commit to Git
4. Deploy to Vercel only when the feature is complete and stable

Vercel deployment is the **last phase** of the project, not an ongoing concern during development.

---

## 7. Dependency Management

Reproducible builds are a first-class concern. The following rules apply throughout the project:

| Rule | Why |
|---|---|
| Always commit `package-lock.json` | Locks exact versions of all packages and sub-dependencies |
| Install with `--save-exact` flag | Pins exact version in `package.json` (e.g. `"recharts": "2.10.0"` not `"^2.10.0"`) |
| `.nvmrc` file in project root | Documents the intended Node version; enables one-command switching with nvm |
| Never commit `node_modules/` | Always in `.gitignore`; reproduced from `package-lock.json` via `npm ci` |

### Node Version
- **Development:** Node v25.8.1 (developer's current version — works fine)
- **Target / Production:** Node v22 LTS (current long-term support release; matches Vercel's default)
- `.nvmrc` will be set to `22` so the project documents its intended runtime

### Installing packages
```bash
# Always use --save-exact
npm install --save-exact <package-name>

# For dev dependencies
npm install --save-exact --save-dev <package-name>
```

---

## 8. Database Schema (Initial Design)

```sql
-- Monitoring stations (one row per physical station)
CREATE TABLE stations (
  id           TEXT PRIMARY KEY,        -- e.g. "gios_123" or "airly_456"
  source       TEXT NOT NULL,           -- 'gios' | 'airly'
  name         TEXT NOT NULL,
  city         TEXT NOT NULL,
  latitude     NUMERIC(9,6) NOT NULL,
  longitude    NUMERIC(9,6) NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Periodic air quality readings
CREATE TABLE readings (
  id           BIGSERIAL PRIMARY KEY,
  station_id   TEXT REFERENCES stations(id),
  measured_at  TIMESTAMPTZ NOT NULL,
  pm25         NUMERIC(6,2),
  pm10         NUMERIC(6,2),
  no2          NUMERIC(6,2),
  o3           NUMERIC(6,2),
  so2          NUMERIC(6,2),
  co           NUMERIC(6,2),
  aqi_value    NUMERIC(6,2),
  aqi_level    TEXT,                    -- 'very_good'|'good'|'moderate'|'bad'|'very_bad'
  fetched_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast time-series queries
CREATE INDEX idx_readings_station_time ON readings(station_id, measured_at DESC);
```

---

## 9. Design Direction

- **Feel:** Consumer-friendly, modern, visually expressive — inspired by Airly's mobile app and Apple's weather app aesthetic. Not a government dashboard.
- **Color language:** The AQI color scale is a core design element — greens, yellows, oranges, reds are used meaningfully throughout the UI, not decoratively
- **Typography:** Clean sans-serif (Inter or similar), Polish diacritics must render correctly
- **Layout:** Desktop-first with a fully usable mobile layout. No horizontal scrolling on mobile.
- **Charts:** Self-sufficient — they should tell a story without tooltips being required. Axes labelled in the user's language.
- **Accessibility:** Color is never the sole indicator of information (icons + text always accompany color)

---

## 10. Language & Localisation

- **Default language:** Polish
- **Secondary language:** English (full translation)
- Language preference stored in browser localStorage
- All AQI level names, pollutant descriptions, and warnings translated
- Date/number formatting locale-aware (Polish: `13 marca 2026`, English: `March 13, 2026`)
- All data in the database (stations, cities, regions) is stored in correct Polish with diacritics (e.g. `Kraków`, `Łódź`), while search and filtering are implemented in a diacritic-insensitive way (e.g. user typing `Krakow` still finds `Kraków`)

---

## 11. Portfolio & Professional Value

This project is designed to be a genuine portfolio piece for a data analytics engineer. The following aspects are intentionally crafted to demonstrate real-world skills:

| Skill area | What's demonstrated in this project |
|---|---|
| **SQL / Data modelling** | Supabase schema design, indexing strategy, time-series query patterns |
| **Data pipeline** | Scheduled fetcher, API normalisation, upsert logic, error handling |
| **Data transformation** | Raw sensor data → normalised AQI index → user-facing colour/label |
| **Git discipline** | Meaningful commit messages, feature branches, documented README |
| **Code quality** | TypeScript throughout, clear separation of concerns, commented data layer |
| **Tooling** | VSCode, GitHub, modern JS ecosystem — mirrors professional workflow |

The project README will include a data architecture section explaining design decisions, suitable for sharing with potential employers.

---

## 12. Out of Scope (MVP)

The following are explicitly deferred to avoid scope creep:

- Email or push notifications (in-app warnings only for now)
- User accounts or personalisation beyond language preference
- Mobile app / PWA installation prompt
- Data export / download features
- Air quality forecasting
- Coverage outside Poland

---

## 13. Domain Name

Not yet decided. Options being considered:

- `powietrze.info` — Polish, clear meaning, short
- `jakpowietrze.pl` — "how's the air" — conversational, local feel
- `smogmapa.pl` — "smog map" — descriptive, searchable

**Decision needed:** Register a domain before launching publicly. `.pl` domains cost ~30–50 PLN/year.

---

## 14. Next Steps (after this document is approved)

1. **Explore & document the GIOŚ API** — understand all available endpoints, data shapes, rate limits
2. **Register for Airly API key** — review free tier limits and terms of use
3. **Set up project skeleton** — Next.js + TypeScript + Tailwind + Git repo
4. **Design database schema** — finalise and create tables in Supabase
5. **Build data fetcher** — cron job that populates the DB from both APIs
6. **Build frontend** — page by page, starting with the Kraków dashboard
7. **Deploy to Vercel** — connect domain, go live

---

*This document is a living reference. It will be updated as decisions are made and scope evolves.*
