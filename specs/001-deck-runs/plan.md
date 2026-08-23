# Implementation Plan: Deck Runs

**Branch**: `001-deck-runs` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-deck-runs/spec.md`

## Summary

Build the flashcard run loop: a learner picks a deck, starts a rung, marks each card
"Got it" or "Not yet", and the run re-presents only the missed cards, cycle after cycle,
until none remain. Completing a rung unlocks the next; completing the top rung masters the
deck. Everything persists to `localStorage` as it happens so any run resumes exactly where
it stopped.

Technical approach: the run loop is a **pure state machine** in plain TypeScript, with React
as a thin rendering layer over `useReducer`. Deck ladders are **explicit data** — every rung
literally lists its card ids; nothing is computed from a rung size at runtime. Persistence is
one storage module writing per-deck records that preserve fields they do not recognize.

## Prerequisite: project scaffold

This plan was written when the repo contained no application code — no `package.json`, no Vite
scaffold, no CI workflow, no Cloudflare Pages project. That work was deliberately **out of scope
for 001** and was specified separately as `000-scaffold`, derived from what this plan requires;
it has since landed on `main`.

This plan therefore pins the stack (see Technical Context) but did not install it — `000-scaffold`
did. Every task in 001 assumes the scaffold has landed. The exact scaffold requirements this plan
generated are collected in [research.md § Scaffold requirements](./research.md#scaffold-requirements-handoff-to-000-scaffold).

## Technical Context

**Language/Version**: TypeScript **7.0.2** with `strict: true`. Target ES2022. Maintainer's
decision, 2026-08-22. License **Apache-2.0** — on Principle VIII's allowlist, and the only
non-MIT entry in the stack.

7.0.2 is npm's `latest` (2026-07-08, the Go-native port); `create-vite`'s template still pins
`~6.0.2`. The usual TypeScript-7 hazard in a React stack is `typescript-eslint`, which leans
heavily on the TypeScript compiler API — **this project does not use it**, having taken `oxlint`
(Rust, own parser) instead. That leaves `tsc` used only as the typecheck gate. Confirm it
typechecks this project cleanly during `000-scaffold`; nothing in 001 depends on a
version-specific language feature either way.

**Runtime (tooling)**: Node **26.7.0**. Maintainer's decision, 2026-08-22.

Node 26 is *Current* today and becomes Active LTS on **2026-10-28** — nine weeks out — with
support through 2029-04-30. Node 24 ("Krypton") drops to **maintenance on 2026-10-20**, eight
days before that. Pinning 24 would mean adopting a line that leaves active support almost
immediately and re-pinning before the year is out.

Principle VIII was amended to v1.4.0 to admit this — a Current line with an LTS date inside six
months counts as LTS, and beats an LTS line entering maintenance sooner. No pinned dependency
needs to change: every package in the table below already accepts Node 26.

**Primary Dependencies** (versions verified against the npm registry on 2026-08-22):

| Package | Version | Role |
|---|---|---|
| `react` / `react-dom` | 19.2.8 | UI |
| `react-router` | 8.3.0 | routing, **library mode only** |
| `vite` | 8.2.2 | build |
| `@vitejs/plugin-react` | 6.1.0 | JSX/Fast Refresh |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | styling |
| `shadcn` CLI | 4.19.0 | vendors components into `src/components/ui/` |
| `vitest` | 4.1.11 | test runner |
| `oxlint` | 1.79.0 | lint — what the Vite react-ts template ships |
| `@testing-library/react` | 16.3.2 | component tests |

No dependency outside Principle V's pre-approved set. No new runtime dependency is introduced
by this feature.

**Storage**: `localStorage` only. Keys namespaced `flashrunner:`. One record per deck, each
carrying its own integer `schemaVersion`. See [contracts/storage.md](./contracts/storage.md).

**Testing**: Vitest + React Testing Library on `jsdom`. The run engine, the deck validator, and
the storage module are pure and unit-tested directly — no React needed to test the mechanic.

**Target Platform**: Evergreen browsers. Static bundle served by Cloudflare Pages.

**Project Type**: Single-page web application. No backend, no API, no server-side execution.

**Performance Goals**: Marking a card and seeing the next is a synchronous state transition
plus one `localStorage` write — no async, no network, no perceptible wait (SC-002).

**Constraints**: Fully offline-capable after first load. Deep links to `/deck/:deckId` and
`/deck/:deckId/rung/:rungId` must resolve on a real Pages deployment.

**Scale/Scope**: 3 screens, 2 built-in decks (40 and 52 cards), 19 rungs total, single learner
per browser. Stored data is a few kilobytes.

## Constitution Check

*Checked against constitution v1.5.0. Re-checked after Phase 1 design, and again at the Phase 6
polish pass: Principle III moved from DEFERRED to PASS once CI existed, and Principle VIII's
outstanding `TODO(DEP_LICENSES)` was discharged. Under v1.5.0 the license allowlist is a
fast-path rather than a gate — an unlisted license is a question to ask and record in the PR,
not a blocker.*

| Principle | Status | How this design satisfies it |
|---|---|---|
| **I. Client-Only Static SPA** | PASS | No server, no SSR, no API. `react-router` 8.3.0 exports `createBrowserRouter` / `RouterProvider` / `BrowserRouter` — verified by unpacking the tarball, so library mode survives in v8. Build emits no top-level `404.html` and no `_redirects`. |
| **II. localStorage Is the System of Record** | PASS | Single `src/storage/` module is the only place `localStorage` is touched. All keys `flashrunner:`-prefixed, all payloads carry `schemaVersion`. Absent / disabled / full / corrupt storage each degrade to a working app on defaults. `QuotaExceededError` handled explicitly. |
| **III. Green CI or It Does Not Merge** | PASS | CI shipped with `000-scaffold`. `.github/workflows/ci.yml` runs install-from-lockfile → lint → typecheck → test → build on `ubuntu-latest`, for PRs and for pushes to `main`, and asserts the build output shape. `Verify` and `Cloudflare Pages` are both required status checks on `main`, so red blocks merge. The Node pin lives in `.nvmrc`; `engines` and the workflow's `node-version-file` follow it, and the deploy platform derives it rather than declaring its own — verified 2026-08-23, see tasks.md T049. |
| **IV. Test Behavior, Not Implementation** | PASS | Run reducer, deck validator, and storage module are pure functions and are all required coverage. Component tests query by role and visible text. |
| **V. Minimal Dependency Surface** | PASS | Zero new runtime dependencies. Run state uses `useReducer` — the run loop *is* a state machine, so a state library would add indirection over an exact fit. |
| **VI. Build Only What Was Asked** | PASS | See "Explicitly not built" below. |
| **VII. Self-Contained, No Host Pollution** | PASS | Everything in `package.json` → `./node_modules`. `shadcn` runs via `npx`, never installed globally. |
| **VIII. Free, Open, Reputable, Stable** | PASS | Node 26.7.0 is Current today with a published LTS date of 2026-10-28 — inside the six-month window Principle VIII admits as of v1.4.0, and preferred over Node 24, which enters maintenance 2026-10-20. `react-router@8.3.0` verified MIT from its own `package.json`. `TODO(DEP_LICENSES)` is discharged by [`specs/000-scaffold/research.md` §6](../000-scaffold/research.md): all 515 transitive packages enumerated, 500 of them across the six pre-cleared licenses, and the seven unlisted ones asked, assessed, and recorded — none copyleft over application code. Every pinned library version is latest stable, no alpha/beta/RC/canary. |

### Explicitly not built (Principle VI)

Named here so their absence is a decision rather than an oversight: no learner profiles or
switching, no scoring/stars/streaks/timers, no spaced repetition, no card shuffling, no in-app
deck authoring or editing, no import/export/sync/print, no automated pass/fail detection, no
settings screen, no analytics, no service worker.

## Key Design Decisions

### 1. The run loop is a pure reducer, not a React hook

`mark(state, outcome) -> state` lives in `src/run/reducer.ts` with no React import. This is
what makes SC-003, SC-004, and SC-009 testable as plain function calls rather than as UI
choreography, and it satisfies Principle IV's "every pure function transforming user data".
React holds it via `useReducer`; the component decides nothing about the mechanic.

### 2. Rung membership is literal, never computed

Per the maintainer's constraint, each rung enumerates its `cardIds` explicitly. A "steps of 5"
ladder is a property of the *authored config*, not of a `rungSize` field the engine multiplies
out. The validator **checks** containment (FR-003/FR-004) but never **derives** it.

Consequence: the same word list can ship twice under different ladders, and rung size is part
of the deck's identity — `dolch-prek-5` vs a future `dolch-prek-10`. The rung size lives in the
**stable deck id**, not just the display title, because the id is the key stored progress hangs
off; reusing an id across two ladders would silently inherit the wrong progress.

### 3. One storage record per deck

`flashrunner:deck:<deckId>` rather than one blob for everything. Three reasons: a write during a
run touches only that deck, corrupt JSON in one deck's record cannot blank the whole app
(Principle II), and FR-036's independence falls out of the shape instead of being enforced.

### 4. Completed rungs are stored as a set of ids, not a high-water index

FR-019 asks for "the highest rung completed". An index into a ladder breaks the moment a deck
config is revised — it would point at a different rung. A list of completed rung *ids* is
additive (FR-038), degrades to "ignore ids I no longer recognize" (FR-022), and still reduces
to "highest" in one pass.

### 5. Unknown fields survive a write

FR-041 is implemented as read-whole-object, overlay-known-fields, write-whole-object. A version
that predates a field never destroys it.

## Project Structure

### Documentation (this feature)

```text
specs/001-deck-runs/
├── plan.md              # This file
├── research.md          # Phase 0 — verified facts + scaffold handoff
├── data-model.md        # Phase 1 — entities, state machine, invariants
├── quickstart.md        # Phase 1 — how to validate this feature works
├── contracts/
│   ├── deck-config.md   # the deck authoring format (FR-002/003/005/024)
│   └── storage.md       # the localStorage record format (FR-038..042)
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # NOT created by /speckit-plan
```

### Source Code (repository root)

```text
src/
├── decks/
│   ├── dolch-prek-5.ts       # 40 cards, 8 rungs, explicit membership
│   ├── dolch-k-5.ts          # 52 cards, 11 rungs, explicit membership
│   ├── registry.ts           # the built-in deck list
│   ├── validate.ts           # FR-003 / FR-004 containment + integrity checks
│   └── types.ts              # DeckConfig, CardConfig, RungConfig
├── run/                      # pure — no React imports anywhere in here
│   ├── types.ts              # RunState, Outcome
│   ├── reducer.ts            # start / mark / restart transitions
│   └── selectors.ts          # currentCard, remainingInCycle, isComplete
├── storage/                  # the only place localStorage is touched
│   ├── keys.ts               # flashrunner: namespace
│   ├── safeStorage.ts        # absent / disabled / full / corrupt handling
│   ├── deckRecord.ts         # read/write + unknown-field preservation
│   └── migrations.ts         # registry; v1 is the baseline
├── routes/
│   ├── DeckList.tsx          # /
│   ├── DeckLadder.tsx        # /deck/:deckId
│   └── Run.tsx               # /deck/:deckId/rung/:rungId
├── components/
│   ├── ui/                   # vendored shadcn — project source, not a dependency
│   ├── CardFace.tsx
│   ├── OutcomeButtons.tsx    # "Got it" / "Not yet"
│   └── CycleCounter.tsx      # FR-013
├── app/
│   └── router.tsx            # createBrowserRouter — library mode
└── main.tsx
```

Tests are colocated as `*.test.ts` / `*.test.tsx` beside the module they cover, which is the
Vitest default and keeps the pure engine's tests next to the engine.

**Structure Decision**: Single project, no `backend/` or `frontend/` split — Principle I means
there is exactly one deployable and it is static. The directory boundary that matters here is
not client/server but **pure vs. React**: `src/run/`, `src/decks/`, and `src/storage/` contain
no JSX and no React import, which is what lets the entire learning mechanic be tested without
rendering anything.

## Routes

| Path | Screen | Notes |
|---|---|---|
| `/` | Deck list | Each deck shows progress and mastery (FR-020) |
| `/deck/:deckId` | Rung ladder | Unfinished run surfaced on its own rung (FR-035), with Resume **and** Start over side by side (FR-031) |
| `/deck/:deckId/rung/:rungId` | Run | Card, outcome buttons, cycle counter, Start over (FR-033) |

Leaving a run returns to that deck's ladder; leaving a deck returns to the list (FR-034). All
three are real URLs, which is exactly why Principle I's no-`404.html` rule has to hold.

## Complexity Tracking

No constitutional violations to justify.

The Node 26.7.0 pin conflicted with Principle VIII as written at v1.3.2 and was resolved by
amending the principle rather than waiving it — see constitution v1.4.0 and its Sync Impact
Report for the rationale and the release-schedule dates behind it.
