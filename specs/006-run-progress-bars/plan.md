# Implementation Plan: Run Progress Bars

**Branch**: `006-run-progress-bars` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-run-progress-bars/spec.md`

## Summary

Replace the sentence "N cards left in this round" on the run screen with two thin horizontal bars
pinned to the top of the viewport: a thicker **run bar** measuring cards got right against the
rung's size, and a hairline **cycle bar** measuring position within the current cycle, which resets
every time a new cycle opens.

Both values already exist in `RunState`. Nothing is added to storage, no `schemaVersion` bump, no
migration, and no new package — `radix-ui` is already a dependency, so `@shadcn/progress` is a file
copy. The work is one presentational component swapped for another, two derivations built inline at
the call site in `Run.tsx`, and the migration of 17 existing test assertions that used the deleted
sentence as a proxy for run position. The vendored component is used exactly as it ships — this
feature modifies no vendored code, and adds no abstraction.

All eleven design decisions are settled and recorded in [research.md](./research.md). There are no
open questions.

## Technical Context

**Language/Version**: TypeScript 7.0.2 (`strict`), targeting the browser. Node 26.7.0 for tooling,
pinned in `.nvmrc`.

**Primary Dependencies**: React 19.2.8 · React Router 8.3.0 (browser mode) · Tailwind CSS 4.3.3 ·
shadcn/ui vendored as source (`radix-nova` base, preset `b2fA`) · `radix-ui` ^1.6.7. **No new
dependency is added by this feature.**

**Storage**: `localStorage` via `src/storage/`. Unchanged by this feature — both indicators are
derived at render time from run state that is already persisted, so the stored record's shape and
its `schemaVersion` of 1 are untouched.

**Testing**: Vitest 4.1.11 + React Testing Library 16.3.2 + jsdom 30.0.1. Component assertions go
through role and accessible name. No new unit tests: the arithmetic invariant behind the run bar is
already asserted by `src/run/reducer.test.ts:268` (I3) and `:293` (I6), which predate this feature —
see [research.md § Decision 9](./research.md).

**Target Platform**: Static SPA in a modern browser. Primary device is a tablet or phone held by a
young learner, with a supervising adult nearby.

**Project Type**: Single-project client-only SPA. No backend exists.

**Performance Goals**: Both indicators are two divisions per render on state that is already in
memory. No measurable cost, no new render path, no new effect, no timer.

**Constraints**: Offline-capable; no network at runtime. Bars must be legible at 2px and 6px on a
phone, and must not obscure the card or the outcome buttons at any viewport size.

**Scale/Scope**: One screen (`/deck/:deckId/rung/:rungId`). Rungs in the shipped decks run from 5 to
40 cards. Two new files, one deleted, four modified. No new exported function.

## Constitution Check

*Constitution version 1.6.0. Gate evaluated before Phase 0 and re-evaluated after Phase 1 — see
[Post-Design Re-check](#post-design-re-check).*

| Principle | Verdict | Basis |
|---|---|---|
| **I. Client-Only Static SPA** | PASS | Presentational change inside an existing route. No server, no SSR, no loader, no framework mode. Nothing new assumes an API. |
| **II. localStorage Is the System of Record** | PASS | Reads no storage and writes none. Both values are derived from `RunState` already in memory. No persisted shape change, so no `schemaVersion` bump and no migration. The existing quota-exceeded notice is untouched and the bars keep working when a write fails, per the spec's edge cases. |
| **III. Green CI or It Does Not Merge** | PASS, with work | 17 assertions in `src/routes/Run.test.tsx` bind to the deleted sentence and will go red until migrated. That migration is in scope, not deferred — see [research.md § Decision 10](./research.md). |
| **IV. Test Behavior, Not Implementation** | PASS | New tests query `getByRole('progressbar', { name })` and read `aria-valuetext` — role and accessible name only, no class names, no `data-state`, no snapshots. No new pure function is added, so the rule on testing pure functions has nothing to bite on; the invariant it would have covered is already asserted by existing tests ([research.md § Decision 9](./research.md)). Four tautological or change-detector assertions were identified and cut before implementation — see [What was cut, and why](#what-was-cut-and-why). `src/components/ui/progress.tsx` is vendored and exempt, covered through the feature that renders it. |
| **V. Minimal Dependency Surface** | PASS | Zero new packages. `@shadcn/progress` imports `Progress` from `radix-ui` ^1.6.7, already installed and already used for `Slot`. Explicitly pre-approved by the shadcn/ui row. Net deletion elsewhere: `CycleCounter.tsx` and the now-unused `remainingInCycle` selector both go, satisfying "remove unused". |
| **VI. Build Only What Was Asked** | PASS | Two indicators, the sentence removed, nothing else. No progress UI is added to the deck list or ladder. No settings, no toggle, no options. Exactly one change is not literally requested — `<main>`'s padding — and it is forced by FR-017 rather than adjacent to it: content must not sit under the fixed bars. No abstraction either: an earlier draft added a `CardCount` type and two selectors, and they were cut for having one call site each and no test that was not already covered — "abstraction is earned by a second real use case, not predicted from the first". |
| **VII. Self-Contained, No Host Pollution** | PASS | `npx shadcn add progress` runs through `npx`, installs nothing globally, and writes one file inside the repo. Host prerequisites remain git + Node at the pinned version. |
| **VIII. Free, Open, Reputable, Stable** | PASS | No new package, so no new license to record. shadcn/ui source is MIT and `radix-ui` is already vetted in the existing tree. No new font, icon, or asset. No pre-release anything. |

### No vendored code is modified

`src/components/ui/progress.tsx` is used exactly as `npx shadcn add progress` writes it, byte for
byte identical to `npx shadcn view progress`. A future re-add is a clean overwrite with no manual
merge.

This is worth stating because an earlier draft of this plan proposed a one-token
`motion-safe:transition-all` edit to honour a reduced-motion preference. The maintainer declined it
on 2026-08-25 and FR-021 was amended accordingly — the bars animate for everyone. The reasoning, the
rejected alternatives, and the known inconsistency with `PronounceButton.tsx` are all recorded in
[research.md § Decision 5](./research.md).

## Project Structure

### Documentation (this feature)

```text
specs/006-run-progress-bars/
├── spec.md                      # Feature specification
├── plan.md                      # This file
├── research.md                  # Phase 0 — 11 decisions, all resolved
├── quickstart.md                # Phase 1 — manual + automated validation
├── contracts/
│   └── run-progress.md          # Phase 1 — the accessible contract the tests bind to
├── checklists/
│   └── requirements.md          # Spec quality checklist (16/16)
└── tasks.md                     # Phase 2 — created by /speckit-tasks, NOT by this command
```

**No `data-model.md`.** This feature introduces no stored, authored, or transmitted data — the spec's
Key Entities section lists four values that all already exist in `RunState` and `RungConfig`. Writing
an artifact to say "nothing changed" would be noise. This follows the precedent of `003`, `004`, and
`005`, none of which produced one; `001` and `002` did, because they defined the data model.

### Source Code (repository root)

```text
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx           # unchanged
│   │   └── progress.tsx         # NEW — vendored, used verbatim, not modified
│   ├── CardFace.tsx             # unchanged
│   ├── CycleCounter.tsx         # DELETED — the sentence this feature removes
│   ├── OutcomeButtons.tsx       # unchanged
│   ├── PronounceButton.tsx      # unchanged
│   └── RunProgress.tsx          # NEW — the two bars, presentational, no state
├── run/
│   ├── selectors.ts             # MODIFIED — remainingInCycle deleted, nothing added
│   ├── reducer.ts               # unchanged — the mechanic is untouched
│   ├── reducer.test.ts          # MODIFIED — the remainingInCycle test trimmed, not replaced
│   └── types.ts                 # unchanged
└── routes/
    ├── Run.tsx                  # MODIFIED — bars replace the counter; main padding for FR-017
    └── Run.test.tsx             # MODIFIED — 17 assertions migrated, new coverage added
```

**Structure Decision**: the existing single-project layout is kept exactly as it is. This feature
adds no directory and introduces no new architectural seam. It follows the established division that
`001` set and every feature since has kept: `src/run/` holds pure logic with no React and no I/O,
`src/components/` holds presentational pieces that decide nothing, and `src/routes/` composes them
and owns the state. The two new derivations go in `src/run/selectors.ts` because that is where pure
reads over `RunState` already live; the two bars go in `src/components/` because they render and
decide nothing.

## Phase 0 — Research

Complete. See [research.md](./research.md) for all eleven decisions with rationale and rejected
alternatives. Two were settled against evidence rather than reasoning:

- **The `max` trap** (Decision 3). A throwaway test in this repo confirmed that `value={2} max={5}`
  renders `translateX(-98%)` instead of `-60%`, because the component's transform hardcodes
  `100 - value`. `value` must be a percentage and `max` must never be passed.
- **`aria-valuetext` passes through** (Decision 4). The same run confirmed it reaches the DOM and
  that `getByRole('progressbar', { name })` resolves against `aria-label`. This is what lets the
  count be announced as cards while the fill is driven by a percentage.

No `NEEDS CLARIFICATION` markers were raised in the spec and none arose here.

## Phase 1 — Design & Contracts

Complete.

- **[contracts/run-progress.md](./contracts/run-progress.md)** — the accessible contract for the two
  indicators: role, accessible names, the `aria-valuetext` grammar, the percentage rule, and exactly
  what tests are permitted to bind to.
- **[quickstart.md](./quickstart.md)** — how to run the feature and prove it, automated and by hand,
  including the viewport and layout checks that no jsdom test can make.
- **data-model.md** — deliberately not produced. See the note under Project Structure.

### Implementation shape

Two pieces, plus one deletion.

**1. `src/components/RunProgress.tsx`** — takes the two counts and renders two `<Progress>`, the run
bar at `h-1.5` above the cycle bar at `h-0.5`, wrapped in `fixed inset-x-0 top-0 z-10` with an inner
`mx-auto w-full max-w-xl px-6` matching `<main>`'s own column. Each bar gets
`value={done / total * 100}`, an `aria-label`, and an `aria-valuetext` of `{done} of {total} cards`.
No `max`. No state, no effect. The pair's shape lives in this file's own props signature:

```ts
type Count = { done: number; total: number };
export function RunProgress({ run, cycle }: { run: Count; cycle: Count }) …
```

**2. `src/routes/Run.tsx`** — `RunLoop` returns a fragment with `<RunProgress>` before `<main>`, so
the bars are first in reading order (FR-025) and outside the `complete ? … : …` branch (FR-020). Both
counts are built inline, where the difference between the two indicators is visible in one glance:

```tsx
<RunProgress
  run={{ done: state.passedThisRun.length, total: rung.cardIds.length }}
  cycle={{ done: state.position, total: state.queue.length }}
/>
```

No zero denominator is possible: `validate.ts` rule V8 forbids an empty rung and a repeat cycle only
opens from a non-empty `failedThisCycle`, so no guard is written
([research.md § Decision 8](./research.md)). The `<CycleCounter>` line goes. `<main>`'s `p-6` becomes
`px-6 pb-6 pt-9` (FR-017). Because the bars live in `RunLoop` rather than `Run`, the two "Run not
found" screens get none (FR-019) with no condition written for it.

**3. Deletion.** `src/components/CycleCounter.tsx` and `remainingInCycle` from
`src/run/selectors.ts`, neither of which anything renders once the sentence is gone (Principle V).
`selectors.ts` gains nothing in return — see [research.md § Decision 9](./research.md).

### What was cut, and why

Recorded because `/speckit-analyze` cut it *after* the first draft of this plan, and a reader
comparing against the git history of these documents deserves to know it was deliberate.

| Cut | Reason |
|---|---|
| `CardCount` type + `cardsGotThisRun` + `cardsDoneThisCycle` | Two struct literals, one call site each, transforming nothing. Their only justification was hosting tests that turned out to be redundant. |
| A unit-test task for those selectors (6 assertions) | Every one was already covered: `reducer.test.ts:268` (I3) asserts `done === total ⇔ isComplete` in both directions, `:293` (I6) that no card is counted twice, `:246`/`:281` the cycle boundary. |
| `expect(valuetext).not.toContain('%')` | `aria-valuetext` is the template literal `` `${done} of ${total} cards` ``. It cannot contain `%`. |
| `queryByText(/cards left in this round/)` absent | A change-detector on deleted text. A `grep` over `src/` checks it statically and cannot pass by accident. |
| "Both bars addressable by distinct names" | Every other test calls `getByRole('progressbar', { name })`, which fails loudly if the names collide or go missing. |
| Re-testing start-over, resume, and pronounce | All three are *existing* tests among the 17 being migrated. `Run.test.tsx:1013` already asserts pronounce causes "no outcome, no advance, nothing stored", and line 1028 inside it is one of the 17 — so the migration itself proves FR-022. |

### Requirement coverage

| Requirement | Where it is met |
|---|---|
| FR-001, FR-012, FR-013 | `RunProgress.tsx` — two `<Progress>`, `h-1.5` over `h-0.5` |
| FR-002, FR-003, FR-004 | `passedThisRun.length` over `rung.cardIds.length`. Never shrinks, and a card cannot be got twice, so full ⇔ complete — already asserted by `reducer.test.ts:268` (I3) and `:293` (I6) |
| FR-005, FR-006, FR-007 | `position` over `queue.length`. Both are reset by the reducer at the cycle boundary, so FR-006 needs no code; track width is constant `w-full` |
| FR-008, FR-009 | Fall out of the reducer and the existing resume path. No new code. |
| FR-010, FR-011, FR-018 | `CycleCounter.tsx` deleted and its call site removed |
| FR-014 | Shipped `bg-primary` / `bg-muted` only; no token added to `src/index.css` |
| FR-015, FR-016, FR-017 | `fixed inset-x-0 top-0` + inner `mx-auto max-w-xl px-6`; `<main>` gains `pt-9` |
| FR-019, FR-020 | Placement in `RunLoop`, outside the completion branch |
| FR-021 | Nothing to do — the component's shipped `transition-all` animates both bars, and no reduced-motion branch is required ([research.md § Decision 5](./research.md)) |
| FR-022 | Nothing to do — the pronounce control records no outcome and touches no run state. Proven by the migration: `Run.test.tsx:1013` already asserts "no outcome, no advance, nothing stored", and line 1028 inside that test is one of the 17 becoming a bar read |
| FR-023, FR-024 | `aria-label` + `aria-valuetext` per [contracts/run-progress.md](./contracts/run-progress.md) |
| FR-025 | `RunProgress` is first in the DOM, before `<main>` |

### Post-Design Re-check

Re-evaluated after the design above. **All eight principles still PASS**, with no verdict changed
and nothing added to Complexity Tracking.

The design ended up smaller than the gate assumed, in three ways worth recording:

- **Principle V improved.** The feature is a net deletion of project code: `CycleCounter.tsx` and
  `remainingInCycle` go, and the vendored `progress.tsx` that arrives is 25 lines used verbatim.
  Still zero new packages, zero vendored-code edits, and — after the `/speckit-analyze` pass — zero
  new exported functions.
- **Principle VI held under pressure, and needed a second pass to hold.** Five things were cut at
  design time: an opaque background band behind the fixed bars, rounding the percentage, a
  division-by-zero guard, a dedicated `RunProgress.test.tsx`, and a reduced-motion branch. A sixth —
  the `CardCount` type and its two selectors — survived that pass and was only caught by
  `/speckit-analyze`, which checked the testability claim propping it up and found the tests already
  existed. Recorded in [What was cut, and why](#what-was-cut-and-why), because a design gate that
  misses something on the first look is worth admitting rather than smoothing over. Each is recorded with its reason
  in research.md — the first three would have been code defending against something that cannot
  happen or does not matter, and the fourth duplicates coverage `Run.test.tsx` already provides for
  every other presentational component.
- **Principle II is genuinely untouched.** Worth stating plainly because a progress indicator sounds
  like it should persist something. It does not. Both numbers are derived from fields the run
  already writes, so resume (FR-009) works with no new code and there is nothing to migrate.

## Complexity Tracking

No constitutional violations. This table is intentionally empty.

The one item an earlier draft tracked here — a one-token edit to the vendored `progress.tsx` for
reduced motion — is gone. The maintainer declined it and FR-021 was amended, so the feature now
modifies no vendored code at all. See [No vendored code is modified](#no-vendored-code-is-modified).
