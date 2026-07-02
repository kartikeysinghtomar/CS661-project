# CensusScope

> An editorial atlas of the 2011 Indian Census. 28 states, 640 districts, 40+ socioeconomic indicators, built to feel instant.

[Live demo](#) · [Architecture notes](#architecture) · [Performance work](#performance)

---

## Why this exists

The 2011 Census is one of the largest demographic datasets in the world — and almost every public visualisation of it is either a static PDF or a sluggish Plotly dashboard. CensusScope is a from-scratch rebuild that treats the data as the working draft of a country rather than a data dump.

The original version of this project was a Dash app — single-process, server-rendered, full page round-trip on every dropdown change. This rewrite moves it to a Next.js + TypeScript frontend with a FastAPI service backing it, and adds the engineering work (TopoJSON, Web Workers, IndexedDB caching, URL-state) that makes a dashboard at this scale actually feel good to use.

## What's interesting about the build

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js 15 (App Router) · TypeScript · React 19│
│  ─────────────────────────────────────────────  │
│  · Choropleth (D3 + TopoJSON, animated)         │
│  · Composite Index Builder (live, sliders)      │
│  · Cmd+K metric search                          │
│  · URL-encoded analysis state                   │
└────────────────┬────────────────────────────────┘
                 │
   ┌─────────────▼──────────────┐    ┌──────────────────────┐
   │  IndexedDB (idb-keyval)    │    │  Web Worker (Comlink)│
   │  Stale-while-revalidate    │    │  Quantile bins,      │
   │  ~10ms warm reads          │    │  correlations,       │
   └─────────────┬──────────────┘    │  composite scores    │
                 │                   └──────────────────────┘
                 │ fetch
                 ▼
┌─────────────────────────────────────────────────┐
│  FastAPI · Pydantic · orjson                    │
│  ─────────────────────────────────────────────  │
│  · Lifespan-managed singleton (no globals)      │
│  · @cached_property precomputation at startup   │
│    (rankings, percentiles, correlation matrix)  │
│  · Declarative metric categorisation            │
└─────────────────────────────────────────────────┘
```

### Performance work

| Concern                              | Approach                                                  | Impact                       |
| ------------------------------------ | --------------------------------------------------------- | ---------------------------- |
| Multi-MB GeoJSON payloads            | Mapshaper simplify + TopoJSON quantization, build-time    | ~80% smaller geometry        |
| Main-thread blocking on metric switch| Comlink-wrapped Web Worker for quantile / correlation work| 60fps slider interaction     |
| Repeat-visit latency                 | IndexedDB SWR cache with request coalescing               | Warm loads ~instant          |
| Server-side aggregation cost         | `@cached_property` precomputation at startup              | O(1) request handlers        |
| JSON encoding cost                   | `orjson` ORJSONResponse class                             | ~3x faster than stdlib       |

### Standout features

**Composite Index Builder.** Pick any subset of metrics, weight them with sliders, and a custom 0–100 ranking emerges in real time. Min-max normalisation + weighted sum, computed in the Web Worker so dragging stays smooth. Lets users build their own HDI-style index.

**URL-shareable analysis state.** Every interaction (metric, selected state, composite weights) serialises to the query string. Bookmark, share, or open in a new tab — same view, every time. Implemented as a 40-line Zustand-to-URL middleware.

**Cmd+K metric search.** Categorised, fuzzy-searchable picker for the 40+ metrics. Replaces the dependent two-dropdown anti-pattern from the original Dash app.

## Getting started

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
# place the census CSVs in backend/data/
uvicorn app.main:app --reload
```

API will be at `http://localhost:8000`. Open `/docs` for the auto-generated Swagger UI.

### Frontend

```bash
cd frontend
npm install
# put state GeoJSON files in backend/data/geojson/, then:
npm run geo:build      # produces public/geo/*.topo.json
npm run dev
```

Open `http://localhost:3000`.

## Project layout

```
backend/
  app/
    config.py         # settings + declarative category rules
    data_service.py   # loader, precomputation, no globals
    main.py           # FastAPI app, lifespan-managed
    schemas.py        # Pydantic models
  data/               # CSVs and GeoJSON live here (gitignored)

frontend/
  app/
    page.tsx          # editorial landing
    atlas/page.tsx    # state analysis (the demo view)
    compose/page.tsx  # composite index builder
  components/
    Choropleth.tsx    # D3 + TopoJSON, framer-motion transitions
    MetricPicker.tsx  # cmd+k searchable picker
    MetricTicker.tsx  # animated number with tabular figures
    RankingsPanel.tsx # cross-linked with map hover
    CompositeBuilder.tsx
  lib/
    api.ts            # typed client
    cache.ts          # SWR over IndexedDB
    store.ts          # Zustand + URL serialisation
    useStatsWorker.ts # Comlink-wrapped worker hook
    useUrlSync.ts     # two-way URL ↔ store binding
    viz.ts            # choropleth scale, formatters
  workers/
    stats.worker.ts   # quantile bins, correlation, composite
  scripts/
    build-topojson.js # GeoJSON → TopoJSON pipeline
```

## Engineering decisions worth interview-talking-about

1. **No module-level globals.** The original loaded data into module globals; this version uses a service class instantiated in the FastAPI lifespan. Trivial change, but unlocks testability.
2. **Declarative categorisation rules.** Original code substring-matched in a nested if/elif chain with an indentation bug that silently mis-categorised education metrics. Now it's an ordered list of (category, must-contain, must-not-contain) tuples.
3. **Worker boundary chosen by profiling, not vibes.** Chrome DevTools Performance shows the correlation matrix recomputation as a long task on metric switch. Moving exactly that to a worker — and nothing more — is the right surgical cut.
4. **Smallest tool that fits, every time.** `idb-keyval` (1KB) not Dexie. `zustand` (1KB) not Redux. `clsx + tailwind-merge` not styled-components. Bundle size matters for a dashboard people open once.
5. **URL is canonical state.** Means the back button works, screenshots come with context, and there's no "where did my selection go" after a refresh.

## Status

- [x] State analysis (choropleth, rankings, stats panel)
- [x] Composite index builder
- [x] URL state sync
- [x] IndexedDB cache + Web Worker
- [ ] District drill-down (foundations in place, view pending)
- [ ] Compare states (radar + side-by-side, foundations in place)
- [ ] Vitest + Playwright suites
- [ ] CI deploy to Vercel + Render

## Data

Census of India, 2011. Originally distributed by the Office of the Registrar General & Census Commissioner. GeoJSON state boundaries from public-domain repositories — see `backend/data/geojson/` for attributions.

---

Built by Kartikey · MIT licensed
