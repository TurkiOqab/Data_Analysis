# Insight.csv

Drop a CSV. Ask questions in plain English. Get a clear, written insight and the right charts back from Claude.

A local-only React web app for AI-powered exploratory data analysis. No backend service to run, no separate API server — just `npm run dev`.

---

## What it does

1. **Upload** any CSV (drag-and-drop or file picker).
2. **Preview** the first 20 rows in a clean table.
3. **Ask** a question — `"total revenue by region"`, `"which category has the highest profit?"`, `"what trends do you see?"`.
4. **Read** Claude's plain-English answer and **see** 1–4 charts (bar / line / pie) it picked to visualize the answer.

The whole flow happens on `localhost`. Your CSV stays on your machine; only the data you choose to send goes to the Anthropic API.

## How it works

```
┌──────────────────┐      POST /api/anthropic       ┌────────────────────┐
│  React app       │ ───────────────────────────▶   │ Vite dev server    │
│  (browser)       │   { question, columns, rows }  │  (Node)            │
│                  │                                │                    │
│  PapaParse →     │                                │  + injects API key │
│  Dataset state   │                                │  from .env         │
│                  │ ◀───────────────────────────── │                    │
│  Recharts +      │      tool input as JSON        │  Anthropic SDK ──▶ │ ──▶ Claude
│  shadcn/ui       │                                │                    │
└──────────────────┘                                └────────────────────┘
```

The Vite dev server runs a small middleware plugin that proxies `/api/anthropic` to Anthropic's `messages` endpoint, attaching `ANTHROPIC_API_KEY` from `.env` server-side. **The key never reaches the browser bundle.**

Claude is forced to respond by calling a single `present_analysis` tool. That guarantees a structured `{ insight, charts }` shape — no JSON-from-prose parsing.

## Tech stack

| Layer | Choice |
|---|---|
| Build / dev server | Vite |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| CSV parsing | PapaParse |
| LLM | Anthropic SDK (Claude Sonnet 4.6) |
| Tests | Vitest |
| Toasts | Sonner |

## Quick start

**Prerequisites:** Node 20+, an Anthropic API key from <https://console.anthropic.com/settings/keys>.

```bash
git clone <this-repo-url> insight-csv
cd insight-csv
npm install

# Add your key (gitignored)
cp .env.example .env
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # or edit the file directly

npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/`), drop `samples/sales_q1.csv`, ask a question.

## Scripts

```
npm run dev       # start Vite dev server (with proxy)
npm run build     # type-check (tsc -b) and produce a production build
npm test          # run unit tests once
npm run test:watch # rerun tests on change
```

## Project structure

```
.
├── src/
│   ├── App.tsx                      # top-level state + layout
│   ├── main.tsx                     # React entry
│   ├── types.ts                     # Dataset, Chart, Result
│   ├── styles/globals.css           # Tailwind base + theme tokens
│   ├── components/
│   │   ├── UploadCard.tsx           # drag-drop CSV upload + size warning
│   │   ├── PreviewCard.tsx          # first-20-rows table
│   │   ├── AskCard.tsx              # question input + suggestions
│   │   ├── ResultOverlay.tsx        # modal: loading state + insight + charts
│   │   ├── ChartCard.tsx            # bar / line / pie via Recharts
│   │   └── ui/                      # shadcn/ui primitives
│   └── lib/
│       ├── csv.ts                   # PapaParse wrapper, type coercion
│       ├── csv.test.ts              # unit tests
│       ├── anthropic.ts             # POST /api/anthropic client
│       └── utils.ts                 # cn() helper
├── server/
│   ├── vite-anthropic-proxy.ts      # Vite middleware plugin
│   └── vite-anthropic-proxy.test.ts # unit tests for request shaping
├── samples/
│   └── sales_q1.csv                 # smoke-test dataset
├── docs/
│   ├── DESIGN.md                    # design rationale
│   └── PLAN.md                      # step-by-step implementation plan
└── CLAUDE.md                        # project conventions (Karpathy guidelines)
```

## Limitations

- **Local development only.** There is no production deployment story. The dev-server proxy is the only thing that hides the API key.
- **One question at a time.** No conversation history; each ask replaces the previous result.
- **Whole CSV is sent every request.** Cost grows with file size. A summary-stats sampling strategy is on the roadmap.
- **Three chart types.** Bar, line, pie. No scatter, area, heatmap, etc.
- **No streaming.** Responses come back in a single message after Claude finishes.

## Roadmap

- Summary-stats / sampling for large CSVs (cap prompt size regardless of row count).
- Per-request cost display in the UI.
- Optional Q&A history within a session.
- Export rendered insights / charts.

## Development notes

- The design rationale is in [docs/DESIGN.md](./docs/DESIGN.md).
- The full step-by-step build plan is in [docs/PLAN.md](./docs/PLAN.md).
- Project conventions for working in this repo are in [CLAUDE.md](./CLAUDE.md).

## License

MIT — see [LICENSE](./LICENSE).
