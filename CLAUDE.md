@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code
in this repository. Paths below are relative to the **monorepo root**
(`makkah-municipality-gis/`), not to this `apps/gis-viewer/` directory.

## What this is

**Makkah Geographic Explorer (نظام معاملات المكاتب الهندسيةة)** — a municipal GIS geoportal
for Holy Makkah Municipality (أمانة العاصمة المقدسة), built on the **Esri/ArcGIS**
mapping stack. The product vision (auth, imagery time-travel, attestations/إفادات,
dashboards, drawing/measurement tools) is documented in `docs/product-overview.md`
and `docs/design-system.md`, both reverse-engineered from Figma.

The code is **early-stage and mid-build**: today the repo is an ArcGIS map shell
(tools dock, drawing, measurements) plus a shared Mantine-based UI library. The
`docs/` describe the *target* product, not the current state — many widgets,
components, and SCSS files are stubs. Treat docs as intent, code as ground truth.

The whole UI is **Arabic-first and RTL** (`<html lang="ar">`, global `direction: rtl`,
Arabic labels). Verify mirrored padding/margins and icon direction on every change.

## ⚠️ Recent major versions — read the docs before writing framework code

This stack is on bleeding-edge majors whose APIs differ from older training data:
**Next.js 16**, **React 19**, **Mantine v9**, **ArcGIS Maps SDK v5**, TypeScript 5/6.
The imported `AGENTS.md` rule (top of this file) says it plainly for Next.js:
*"This is NOT the Next.js you know — read the relevant guide in
`node_modules/next/dist/docs/` before writing any code."* The same caution applies
to the other majors. Don't assume App Router / config / API shapes from memory;
check the installed version's docs.

## Monorepo layout

pnpm + Lerna workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`). Package
manager is pinned: **pnpm@10.17.1**.

- `apps/gis-viewer/` — the Next.js 16 (App Router) + React 19 application. The map shell.
- `packages/ui/` — `@makkah-municipality-gis/ui`: shared component library wrapping
  Mantine v9, plus the SCSS design-token system. Consumed **as source** (no build).
- `docs/` — product + design-system docs (the spec, derived from Figma).

## Commands

```bash
pnpm install                 # install all workspaces (run at repo root)
pnpm dev                     # → pnpm --filter gis-viewer dev  (next dev, http://localhost:3000)
pnpm build                   # → pnpm --filter gis-viewer build (next build)
pnpm lint                    # → pnpm -r lint  (eslint in every workspace)

# Per-workspace (run from apps/gis-viewer/)
pnpm dev | pnpm build | pnpm start | pnpm lint
```

**There is no test setup yet** — no test runner, no `test` script, no CI config.
If you add tests, also add the script and tell the user; don't assume one exists.

Lint is ESLint flat config: `eslint-config-next` core-web-vitals + typescript in
the app, `typescript-eslint` in the UI package. Path alias `@/*` → `apps/gis-viewer/src/*`.

## App architecture (apps/gis-viewer/src/app)

The map is the whole app. `page.tsx` renders `<MapWrapper>` full-viewport.

**Client-only ArcGIS.** ArcGIS cannot be server-rendered. `MapWrapper.tsx` loads
the real map with `dynamic(() => import('./index'), { ssr: false })` and wraps it
in `MapProvider`. `features/Map/index.tsx` renders Esri's `<arcgis-map>` **web
component** (registered by side-effect imports, e.g.
`import "@arcgis/map-components/dist/components/arcgis-map"`), basemap `osm`,
centered on Makkah `[39.8262, 21.4225]`. JSX types for the custom elements come
from `/// <reference types="@arcgis/map-components/types/react" />` in `layout.tsx`.
`next.config.ts` sets `reactStrictMode: false` (intentional — avoids ArcGIS
double-mount) and `transpilePackages: ["@makkah-municipality-gis/ui"]`.

**Reaching the live map: no React ref — use the DOM.** Imperative ArcGIS work
finds the map via `getMapElement()` (`features/Map/utils/index.ts`), which is
`document.getElementById(mapId)` with `mapId = "makkah-map"`
(`features/Map/constants.ts`). Zoom, `goTo`, geolocation, drawing all go through
this lookup, not props.

**State: two context + reducer stores.**
- `MapProvidor.tsx` → `MapProvider` / `useMap` — `selectedTool` / `subSelectedTool`
  decide which tool panel is open.
- `MapTools/SubTools/Widgets/LayersDrawer/context.tsx` → `LayersDrawerProvider` /
  `useLayersDrawer` — scoped to the drawing widget.

**ArcGIS → React bridge.** `subscriptions/graphicLayer.ts` creates a
`GraphicsLayer`, adds it to the map, and returns `{subscribe, getSnapshot, notify}`
wired to the layer's `graphics.on("change")`. The drawer context consumes it via
`useSyncExternalStore`, so Esri layer mutations re-render React. This is the
canonical pattern for reflecting ArcGIS state in components.

**Drawing.** `utls/map/Draw.ts` wraps a singleton `SketchViewModel`
(point/polyline/polygon/circle/rectangle), stamping `{id, name, geometryType,
createdAt}` attributes on create-complete. `utls/map/actions.tsx` holds graphic
actions (`goToGraphic`, `toggleGraphicVisibility`, `deleteGraphic`) and an older
`drawPoint` that overlaps with `Draw.ts` — prefer `Draw.ts` for new draw work.

**Floating panels.** `components/dragable/index.tsx` wraps `react-rnd` to center a
draggable, non-resizable panel over the map; active tool widgets render inside it.

**Tools.** `MapTools/` is the bottom dock (tabs: widgets / layers / infographics).
`SubTools/Widgets/constants.ts` lists the widget set (measurements, drawing,
magnifier, print, qibla-direction, bookmarks, add-kml, dashboard) with Arabic
labels + `react-icons/hi2`. Only **measurements** and **drawing (LayersDrawer)**
are wired today; the rest are placeholders.

## UI package (packages/ui)

`@makkah-municipality-gis/ui`, ESM, `main: src/index.ts`. **No build step** — the
app transpiles it from source via `transpilePackages`. Imports use either the
barrel (`@makkah-municipality-gis/ui`) or deep source paths
(`@makkah-municipality-gis/ui/src/components/Map/Box`); both are in use.

- Wraps **Mantine v9**. `ThemeProvider` sets RTL (`DirectionProvider
  initialDirection="rtl"`) and the theme (`primaryColor: "green"`, `primaryShade:
  6`, IBM Plex Sans Arabic). It imports `@mantine/core/styles.css` + `styles/main.scss`.
- **Design tokens** live in `src/styles/` (`colors/_primitives.scss`,
  `tokens/_*.scss`, Mantine vars aliased in `colors/_vendor.scss`). Brand is
  Saudi-flag green `#1B8354`. See `docs/design-system.md` for the full token map
  and the open gaps (semantic aliases, type/spacing/shadow scales).
- **Component conventions** (keep consistent): wrap Mantine, don't fork; one
  `*.module.scss` per component with `clsx` for conditional classes; reference
  semantic tokens, never raw hex; RTL-correct; export from `src/index.ts`.

## Code organization — the standard (where every kind of file lives)

We are **colocation-first**: code lives with the feature that owns it, and is only
promoted to a shared folder when a *second* feature needs it (the
[Next.js project-structure guidance](https://nextjs.org/docs/app/getting-started/project-structure)).
Decide a file's home by its **scope**, not by habit.

**Repo-level homes**

| Kind of code | Lives in | Notes |
| --- | --- | --- |
| Pages / layouts | `app/<route>/page.tsx`, `layout.tsx` | App Router routing only |
| **Our backend HTTP endpoints** | `app/api/**/route.ts` | Next.js route handlers — server-only |
| **A feature** (its UI + logic) | `app/features/<Feature>/` | colocate everything the feature owns |
| **Cross-feature client code** | `src/lib/` | pure, framework-agnostic (`lib/api.ts`, `lib/auth.ts`, `lib/arcgis.ts`) |
| **Server-only integrations** | `src/server/` | SDKs / secrets that must never reach the browser (`server/nafath/`) |
| Shared UI primitives | `packages/ui` | the design-system library |

**"api" is overloaded — these are three different things, keep them apart:**
- `app/api/**/route.ts` → **our** server endpoints (route handlers).
- `features/<F>/api.ts` → that feature's **client-side data access** (calls ArcGIS or
  our route handlers, returns typed DTOs). Grow it into an `api/` folder only when one
  file gets unwieldy, split by resource.
- `src/lib/api.ts` → the shared fetch / base-URL helper features build on.

**Inside a feature** (`features/<Feature>/`) — one job per file, dependencies point
**one way**: `components → hook → selectors/api → constants/config` (never the
reverse). The **Dashboard** feature is the reference; copy its shape for new features.

- **service config** (URLs, ids, env-derived values) → `config.ts` if feature-only, or
  `src/lib/*` if shared (e.g. ArcGIS endpoints live in `lib/arcgis.ts` because both
  Dashboard and Map use them; Map's basemap-only config stays in `Map/arcgis.config.ts`).
  **Never hardcode a service URL/id inline or duplicate it across files.**
- **`api.ts` — data/transport.** `fetch`, request building (`buildWhereClause`),
  response DTOs, code→label shaping. **No React, no JSX.** Imports config + constants;
  defines neither.
- **`constants.ts` — reference data.** Code↔label dictionaries, filter→code maps, order,
  palettes — anything shared across files. **Not in `api.ts`, not inline in a component**
  (a genuinely single-use presentational constant may sit atop its one component).
- **`selectors.ts` — business logic.** Pure functions mapping raw DTOs to the exact
  shape a component renders (`toDonutSegments`). No React; unit-testable without a render.
- **`use*Data.ts` — the hook.** Orchestrates api + selectors, owns loading/error/refetch/
  polling, exposes a ready-to-render view model + actions. The **only** seam where data
  meets React.
- **`*.tsx` — presentation only.** Render view-model props; hold *local UI state only*
  (open/closed, hovered). **No `fetch`, no data shaping, no mapping tables, no
  where-clauses.** A component should read like markup — if you're writing a `.map()`
  that reshapes server data or a code→label table inside a `.tsx`, move it down a layer.

**Promotion & coupling rules**
- Start at the **narrowest scope**, promote upward only when shared: one component →
  the component file; the whole feature → the feature root (`config/constants/types.ts`);
  a second feature → `src/lib` (client) or `src/server` (server-only).
- **Never import another feature's internals** (its components, hooks, private files). If
  two features must share something, that something moves to `src/lib`. (Importing a
  feature's *public* `api.ts`/`types.ts` is tolerable for a thin contract, but if the
  coupling grows, promote it to `lib`.)
- **Business logic is never a global folder** — it lives with its feature (`selectors.ts`
  + the hook). Only genuinely shared, framework-agnostic logic graduates to `src/lib`.

## Conventions & gotchas

- **Images: always use Next's `next/image` `<Image>`** — never a CSS `background-image`
  or a bare `<img>` for content/hero/photo imagery. For backgrounds use
  `<Image fill priority sizes="…">` with a separate overlay element for any tint, so
  we get WebP/AVIF, a responsive `srcset`, and LCP `priority` preload. (The `Logo`
  component is the one allowed bare-`<img>` exception — it lives in `packages/ui`,
  which can't depend on `next`.)
- **Colors: never hardcode hex** (e.g. `#d9d9d9`) — use design-system tokens from
  `packages/ui/src/styles` (`var(--neutral-300)`, `var(--text-default)`,
  `var(--surface-panel)`, …). Any raw hexes still in the auth screens are legacy and
  should migrate to tokens. **No exceptions — not even charts.** Data-visualization
  colors are design-system tokens too: the `--chart-*` scale in
  `packages/ui/src/styles/colors/_primitives.scss`, referenced as `var(--chart-…)`
  from the dashboard's chart palette in `Dashboard/constants.ts`. Raw hex lives **only**
  in the token-definition files under `packages/ui/src/styles` — never in app code
  (`.ts`, `.tsx`, or `.scss`). Need a colour that has no token? Add the token first.
- **Match the existing spelling in paths/identifiers — don't silently rename**, or
  imports break across the repo: directory `src/app/utls/` (not `utils`),
  `MapProvidor.tsx` / "Providor", the `Dragable` component, `Wraper.tsx`. These are
  real module specifiers many files import.
- `"use client"` is required on anything touching ArcGIS, context, or browser APIs.
- The app's `getMapElement()` returns `null` until the map web component mounts —
  guard every call (the codebase already does).
- Stub-heavy: empty `constants.ts`, empty `*.module.scss`, single-line component
  files are expected mid-build, not bugs to "fill in" unless asked.
