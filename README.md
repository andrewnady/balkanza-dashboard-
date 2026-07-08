# Balkanza — Product & Growth Dashboard

A modern, filterable analytics dashboard for the Balkanza dating app, built for
product managers / product leads. It reads **live** from the production Postgres
(Neon) read-replica and surfaces acquisition, activation, engagement, liquidity,
monetization, and trust-&-safety metrics — each section with its own filters.

Built with **Next.js (App Router)** + **Recharts**, deployable on **Vercel** in
a couple of clicks.

## Sections

| Section | What it shows | Filters |
|---|---|---|
| **Overview** | Headline KPIs (sign-ups, active users, matches, revenue, subscribers, conversion) with period-over-period deltas | Period: 7 / 30 / 90 days |
| **Growth** | Daily sign-up trend + registration source mix | Window: 14 / 30 / 90 days |
| **Funnel** | Register → complete → like → match → message, distinct users per stage + completion trend | Cohort: 7 / 30 / 90 days |
| **Engagement** | Match → conversation rate, dead matches, retention cohorts, swipe outcomes | Window: 7 / 30 / 90 days |
| **Liquidity** | Complete-profile density by residence country + gender balance | Gender, min per country, top-N |
| **Monetization** | Revenue by service, active plans, offers, payment health | Window: 30 / 90 days |
| **Trust & Safety** | Spam-in-bio signals, verification funnel, data-quality gaps, report trend, spam-farm clusters | Reports window: 14 / 30 / 90 days |

Every section fetches independently, so changing one filter never disturbs another.

## Run locally

```bash
npm install
cp .env.example .env.local     # then edit .env.local with the real read-only password
npm run dev                    # http://localhost:3000
```

### Environment variable

The app needs one variable:

```
DATABASE_URL="postgresql://readonly_user:PASSWORD@ep-sweet-salad-aee19c0f-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Use the **read-only** database user. The value lives only in `.env.local`
(git-ignored) and in Vercel's encrypted env store — it is never committed.

## Deploy to Vercel

1. Push this repo to GitHub (already done on `main`).
2. In Vercel: **Add New… → Project → Import** this repository.
3. Framework preset is auto-detected as **Next.js** — no build settings to change.
4. Under **Environment Variables**, add `DATABASE_URL` with the connection
   string above (Production, Preview, and Development).
5. **Deploy.**

Because the API routes use Neon's HTTP driver, they run fine on Vercel's
serverless functions with no extra configuration.

## Architecture

```
app/
  layout.tsx            # root layout + global styles
  page.tsx              # renders <Dashboard/>
  globals.css           # design system (validated data-viz palette, light/dark)
  api/metrics/route.ts  # single API endpoint, dispatches by ?section=
lib/
  db.ts                 # Neon client + day-window whitelist
  queries.ts            # one function per section (parameterized SQL)
components/
  Dashboard.tsx         # top bar, section nav, composition
  ui/primitives.tsx     # fetch hook, stat tiles, segmented filters, formatters
  ui/charts.tsx         # Recharts wrappers (theme-aware via CSS variables)
  sections/*.tsx        # one component per dashboard section
balkanza_tracking_pack.sql  # the raw SQL pack these metrics are based on
```

All SQL runs against the read-replica with parameterized inputs; day-windows are
whitelisted before use. The dashboard is read-only — it never writes to the DB.

## Notes on the data

- All timestamps are UTC.
- Gender values are stored capitalized (`Male`/`Female`); queries match
  case-insensitively.
- Some metrics intentionally flag known problems (e.g. missing heritage data,
  subscription-payment status) with inline callouts.
