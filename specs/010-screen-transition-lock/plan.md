# Implementation Plan: Screen Transition Lock

**Branch**: `010-screen-transition-lock` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-screen-transition-lock/spec.md`

## Summary

While the run screen is transitioning, nothing on it can be activated. Coverage moves
off the handlers and onto the screen: `RunLoop`'s outermost element carries `inert`
plus one capture-phase interceptor, both driven by `phase !== 'idle'`, so every
control — including ones added later — is covered by being a descendant rather than
by remembering to check a flag.

The feature is mostly subtraction. `guarded` state, the `if (guarded) return` at the
outcome call site, and `PronounceButton`'s `guarded` prop all go, because that
variable existed only to exempt the first card of a run and FR-020 removes the
exemption ([research](./research.md) Decision 3). What is added is one attribute, one
interceptor, and the tests that make the lock's absence detectable.

The one substantive finding: **jsdom enforces neither `inert` nor hit-testing** —
measured in this repo, not assumed ([research](./research.md) Decision 2). A
pure-`inert` implementation would leave every behavioural test green whether the lock
worked or not, so the enforcement lives in event capture, which jsdom does implement,
and `inert` is checked in a real browser.

## Technical Context

**Language/Version**: TypeScript 7.0.2 (`strict`), targeting the browser

**Primary Dependencies**: React 19.2.8, React Router 8.3.0 (browser/SPA mode),
Tailwind 4.3.3, `tw-animate-css` 1.4.0 — all already present. **No new dependency.**

**Storage**: `localStorage` via `src/storage/`, untouched. No key, payload, or
`schemaVersion` change, so no migration ([data-model.md](./data-model.md)).

**Testing**: Vitest 4.1.11 + React Testing Library 16.3.2 + `user-event` 14.6.6 on
jsdom 30.0.1 for everything in CI; Playwright 1.62.1 from a scratch directory, never
added to `package.json`, for the one thing jsdom cannot answer.

**Target Platform**: Evergreen mobile and desktop browsers. `inert` is baseline
across them; the interceptor is what covers anything where it is not.

**Project Type**: Client-only static SPA (Principle I).

**Performance Goals**: 60fps through the transition; the lock adds one attribute and
one capture listener, so it introduces no per-frame work.

**Constraints**: The lock window is `CARD_EXIT_MS` (140ms) then `CARD_ENTRY_MS`
(180ms), each phase locking for its own duration. No third number. Correct at zero.

**Scale/Scope**: One route component, one child component's props, one test file.
Touched: `src/routes/Run.tsx`, `src/components/PronounceButton.tsx`,
`src/routes/Run.test.tsx`. Untouched: the engine (`src/run/reducer.ts`), storage,
`src/run/advance.ts`, and every screen outside a run.

## Constitution Check

*GATE: passes before Phase 0, re-checked after Phase 1 design. Re-check result at the
bottom of this section.*

| Principle | Verdict | Why |
|---|---|---|
| I. Client-only static SPA | **Pass** | No server, no SSR, no route-mode change. `inert` and a DOM listener are client-side and build to static output. |
| II. localStorage is the system of record | **Pass** | FR-015 forbids persisting the lock. No new key, no payload change, no `schemaVersion` bump, so no migration. `src/storage/` is not opened. |
| III. Green CI or it does not merge | **Pass** | lint, typecheck, test, build all run as-is. Five 009 tests assert superseded behaviour and are rewritten in the same commit, not left red. |
| IV. Test real outcomes, not restatements | **Pass, with one documented exception** | The interceptor makes FR-001/003/004 provable behaviourally — a press that lands is a mark that appears in storage, not an implementation detail. The exception is `inert` itself: it has no role, label, or visible text to query, so its presence is asserted structurally and its *effect* is verified in a real browser. That is the "structure only when there is no accessible handle" case, and the standing precedent for a mark whose whole purpose is permanence. |
| V. Minimal dependency surface | **Pass** | Zero new runtime dependencies. `inert` is a platform attribute and event capture is a platform API — both are the "prefer platform built-ins" rung. Playwright stays outside `package.json`. |
| VI. Build only what was asked | **Pass** | The app-wide route-transition generalisation was assessed and rejected in writing ([research](./research.md) Decision 10). No focus restoration, no reduced-motion branch, no in-app escape control, no new status message — each named and declined rather than quietly added. |
| VII. Self-contained, no host pollution | **Pass** | Nothing written outside the repo. The browser check runs from a scratch directory with a Playwright already on the machine; a clean machine with git + Node still passes `npm ci && npm test && npm run build`, because § 1 and § 2 of the quickstart need no browser. |
| VIII. Free, open, reputable, stable | **Pass** | No dependency added, so no licence to record. |

**Post-design re-check**: unchanged. Phase 1 produced no new dependency, no storage
change, and no new file in `src/`; the two items a reviewer is most likely to
challenge are logged in Complexity Tracking rather than left implicit.

## Project Structure

### Documentation (this feature)

```text
specs/010-screen-transition-lock/
├── spec.md                     # /speckit-specify output
├── plan.md                     # This file
├── research.md                 # Phase 0 — 10 decisions, incl. the jsdom finding
├── data-model.md               # Phase 1 — transient screen state, no persisted change
├── quickstart.md               # Phase 1 — how to prove it, and what is not run
├── contracts/
│   └── screen-lock.md          # Phase 1 — the 9 rules of the lock
├── checklists/
│   └── requirements.md         # spec quality, 16/16
├── lifecycle.md                # SDLC extension state
└── tasks.md                    # /speckit-tasks output — NOT created here
```

### Source Code (repository root)

```text
src/
├── routes/
│   ├── Run.tsx                 # CHANGED: lock on RunLoop's wrapper; `guarded` deleted
│   └── Run.test.tsx            # CHANGED: 5 superseded cases rewritten, ~12 added
├── components/
│   ├── PronounceButton.tsx     # CHANGED: `guarded` prop removed
│   ├── OutcomeButtons.tsx      # unchanged
│   ├── RunProgress.tsx         # unchanged
│   └── CardFace.tsx            # unchanged
├── run/
│   ├── advance.ts              # unchanged — the two durations are already the tuning surface
│   ├── reducer.ts              # unchanged — the engine never learns about the lock
│   └── selectors.ts            # unchanged
└── storage/                    # unchanged — nothing about the lock is persisted
```

**Structure Decision**: No new file. The lock is a property of one existing element
in `src/routes/Run.tsx`, which is the only element containing every control the spec
names — the card block's buttons and speaker, "Start over" and "Leave this run"
below it, and the run-complete screen's controls in the other arm of the same branch
([research](./research.md) Decision 4). Extracting a `useScreenLock` hook or a
`<Locked>` wrapper component was rejected: one call site, six lines, and an
abstraction with one consumer is what Principle V's "avoid premature abstraction"
names.

## Implementation shape

Four changes, in dependency order. `/speckit-tasks` will break these down.

1. **Lock the wrapper** — `src/routes/Run.tsx`. `const locked = phase !== 'idle'`,
   then `inert={locked}` and a **native** capture listener
   (`addEventListener(type, handler, true)` in an effect, with cleanup) on the wrapper
   `<div>` that already carries the two CSS custom properties. The interceptor discards
   the event when locked and does nothing otherwise. Not React's `onClickCapture` —
   see [research](./research.md) Decision 2a.
2. **Delete the old guard** — `src/routes/Run.tsx` and
   `src/components/PronounceButton.tsx`. Remove the `guarded` state and its
   initialiser, the `if (guarded) return` in `onMark`, the prop on `PronounceButton`
   and its internal check. `typecheck` catches any missed call site.
3. **Flip the superseded tests** — `src/routes/Run.test.tsx`. The five cases that
   currently assert "Start over", "Leave this run", "Repeat this run" on arrival, and
   a resumed run's first card all stay live now assert the opposite. The
   `describe('Run — where the guard is not')` block is where they live.
4. **Cover the new requirements** — `src/routes/Run.test.tsx`. The probe-control case
   for FR-002, the contiguity case for FR-011a, the zero-duration case for FR-012,
   and the unmount case for FR-010, per [quickstart.md](./quickstart.md) § 1.

## Post-analysis amendments

`/speckit-analyze` ran after this plan was written and found eleven issues, two of them
HIGH. All were fixed in `spec.md`, `tasks.md` and `quickstart.md`. This section records
what that changed **here**, so the drift between the spec and this plan is answered
rather than merely flagged.

| Change | Effect on this plan |
|---|---|
| **FR-013 restated** as a retained invariant with no reachable path — every action that starts a transition is inside the locked region, so no input can begin a second one | **None.** Nothing in this plan, the research, or the contract asserted FR-013 was user-reachable; research Decision 5 describes the single-ref clearing as discipline, which is exactly what it remains. The two 009 tests that exercised it are deleted by T017. |
| **SC-003** now states its two wall-clock bounds are measured in a browser | **None.** Research Decision 9 already put wall-clock behaviour in the browser column; quickstart § 3 now measures it explicitly. |
| **FR-020 and FR-015 gained test tasks** (T014a, T014b), which required T003 to keep an unsettled render helper | **None structurally** — no new file, no new source change. It does mean the harness migration has two shapes, settling and arriving, which is noted in tasks.md § dependencies. |
| **Interceptor pinned to native capture** rather than React's synthetic capture | **Sharpens step 1 above.** Synthetic capture reaches only React-registered handlers, so a descendant with its own listener would slip past it and FR-002's promise would be false. Three lines instead of one; the reasoning is research Decision 2a. |
| **Portals identified as an uncovered boundary** | **No change, recorded as a rule.** Neither `inert` nor a subtree capture listener reaches a portalled control. Nothing portals in a run screen today; [contracts/screen-lock.md](./contracts/screen-lock.md) § 1 states the boundary so a future `Dialog` does not escape the lock unnoticed. |

Constitution re-check after these amendments: unchanged, 8/8. No dependency, no storage
change, no new file under `src/`.

## Complexity Tracking

> Two items a reviewer should push on. Both are argued, not assumed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two mechanisms (`inert` + a capture interceptor) where one attribute is the "native feature" answer | `inert` is right in a browser and invisible to CI: measured in this repo, jsdom fires the handler through `inert`, focuses through it, and finds the button by role inside it. The lock is safety-critical by the spec's own framing, so a version whose absence no test can detect is not acceptable. | **`inert` alone**: the two highest-value tests in the suite (one press marks one card; a held key marks one card) would pass against a screen with no lock at all. **Interceptor alone**: functionally sufficient, but leaves controls focusable, in the tab order, and announced as live while they are moving — the wrong semantic, for one saved attribute. Cost of both: one attribute and one handler on one element, reading one expression. |
| A structural assertion (`toHaveAttribute('inert')`) in a suite whose principle is to query by role, label, or visible text | `inert` has no role, no label, and no visible text — there is no accessible handle to query, which is the exemption Principle IV already states. Its *effect* is not asserted structurally: that is verified in a real browser ([quickstart.md](./quickstart.md) § 3). | Asserting the effect in jsdom is not available (see above). Dropping the assertion entirely would let someone delete the attribute — losing AT and focus correctness — with a green suite. |
