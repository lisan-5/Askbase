# Askbase

**Ask your business data anything.** Drop in CSV exports from Stripe, Shopify, Google Sheets or your POS, ask a question in plain English, and get the answer as a chart — together with the SQL that produced it.

Your rows never leave your browser: Askbase runs a real analytics database (DuckDB, compiled to WebAssembly) inside the tab. The AI only ever sees your question and your column names.

## What it does

- **Plain-English questions → real SQL.** Claude (Opus 5.5) turns a question into a validated query plan: one read-only DuckDB query, the right chart, an explanation, the assumptions it made and three follow-up questions.
- **Runs locally.** The query executes in DuckDB-WASM in a Web Worker. Results, charts and dashboards are computed on the visitor's machine.
- **Shows its work.** Every answer has an editable, re-runnable SQL panel and its assumptions in plain English.
- **Self-repairing.** If DuckDB rejects a query, the error goes back to the model once and the fixed query runs automatically.
- **Read-only by design.** A SQL guard allows exactly one `SELECT`/`WITH` statement and blocks anything that writes, loads extensions or reaches files and URLs.
- **Works without an API key.** A built-in question engine answers the common business questions about the sample company and handles previews, totals, breakdowns and time series on uploaded files — so the live demo always works.
- **Sample company included.** _Lumen Coffee Roasters_: 22 months of customers, orders, line items, products, subscriptions and ad spend, generated deterministically in the browser, with stories to discover (a product that loses money, a channel that takes off, a refund spike, a plan that churns).
- **Dashboard.** Pin any answer; pinned answers re-run live against your data whenever you open the dashboard.

## How a question is answered

```
question ──► Claude: schema (names, types, a few example values) + question
             └─ structured output: { sql, chart, explanation, assumptions, followups }
         ──► SQL guard (single read-only statement)
         ──► DuckDB-WASM in the browser ──► chart / KPI / table
                 └─ on error: error → Claude once → fixed query
```

No rows, files or aggregates are ever sent to the server.

## Tech

React 19 · TypeScript · TanStack Start (SSR + server functions) · DuckDB-WASM · Anthropic SDK (structured outputs with Zod, prompt caching, refusal fallbacks) · Tailwind CSS 4 · Motion · Recharts · Vitest

## Getting started

Requires Node.js 22+.

```sh
npm install
cp .env.example .env   # optional: add ANTHROPIC_API_KEY to ask anything
npm run dev
```

Open http://localhost:8080 — the landing page — and http://localhost:8080/app for the workspace.

| Variable            | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Enables the AI engine. Without it, the built-in engine answers.            |
| `ASKBASE_EFFORT`    | Model effort for SQL planning: `low` (default, fastest), `medium`, `high`. |

## Scripts

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Dev server on port 8080         |
| `npm run build`     | Production build into `.output` |
| `npm start`         | Run the production build        |
| `npm test`          | Unit tests (Vitest)             |
| `npm run typecheck` | Type-check                      |
| `npm run lint`      | ESLint + Prettier               |

## Deploying

Import the repository on Vercel; the build detects Vercel automatically. Add `ANTHROPIC_API_KEY` in the project's environment variables to switch on the AI engine. The DuckDB WebAssembly build is served from the same origin, so there is no CDN dependency.

## Project layout

```
src/
  routes/        landing page (/) and workspace (/app)
  server/ask.ts  the only server code: question + schema → validated plan (Claude)
  lib/db.ts      DuckDB-WASM: loading CSVs, describing tables, running queries
  lib/plan.ts    plan schema and the read-only SQL guard
  lib/answer.ts  question → plan → guard → run → self-repair
  lib/offline.ts built-in question engine
  lib/demo-data.ts  the Lumen Coffee Roasters sample company
  components/    answer cards, charts, SQL highlighting, the landing demo stage
```

---

Built by [Lisanegebriel Abay](https://www.ligator.tech).
