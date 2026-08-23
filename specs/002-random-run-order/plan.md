# Implementation Plan: Random Run Order

**Branch**: `002-random-run-order` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-random-run-order/spec.md`

## Summary

Shuffle the cards of every cycle — the first and every repeat cycle — so a learner cannot clear a
rung by chanting a memorized sequence. The order a cycle is presented in is fixed when that cycle
begins and is already written to storage as part of the run, so a resume replays it exactly.

Technical approach: a Fisher–Yates `shuffle(items, rng)` in `src/run/`, called by `start` (cycle 0)
and by `mark` at each cycle boundary. Randomness enters the pure engine as an **injected parameter**
(`Rng = () => number`, defaulting to `Math.random`), which is what keeps the engine testable under
constitution Principle IV. No seed is stored: the persisted `queue` is already the ordered list, so
the storage shape, `schemaVersion`, and migration set are all untouched.

One correctness fix travels with this. `src/routes/Run.tsx` currently computes each transition
**twice** — once inside `dispatch`, once again to decide what to persist — on the stated assumption
that the engine is pure. Randomizing the engine invalidates that assumption, so the screen must
compute each transition once. See [Complexity Tracking](#complexity-tracking).

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict: true`. Unchanged.

**Primary Dependencies**: **None added.** The feature is `Math.random`, a 10-line Fisher–Yates, and
a threaded parameter. Constitution Principle V is satisfied by not engaging it — no license,
maintenance, or release-channel review is owed because there is nothing new to review.

**Storage**: `localStorage`, unchanged. `schemaVersion` stays at **1**, no migration is added, and
`PersistedRun` keeps its exact current shape. The shuffled order occupies `queue`, the field that
already holds the run's card order (FR-020).

**Testing**: Vitest + React Testing Library on `jsdom`. The engine is pure and unit-tested by direct
call. Statistical criteria (SC-001 to SC-003) are tested with a deterministic seeded PRNG living in
`src/test/` — **test infrastructure only, never imported by shipped code**, so it does not
contradict FR-010.

**Target Platform**: Evergreen browsers, static bundle. Unchanged.

**Project Type**: Single-page web application. No backend.

**Performance Goals**: A shuffle is O(n) over at most 52 ids and runs once per cycle, not per card.
Marking a card stays a synchronous transition plus one `localStorage` write (SC-009).

**Constraints**: `Math.random` needs no network, no permission prompt, and no external service
(FR-024). Reproducing an order needs nothing at all, because the order is read back from storage
rather than recomputed (FR-009).

**Scale/Scope**: 2 built-in decks (40 and 52 cards), largest cycle 52 ids. 4 source files changed,
2 added.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see [below](#post-design-re-check).*

| Principle | Verdict | Basis |
|---|---|---|
| I. Client-only static SPA | **Pass** | Pure client computation. No server, no SSR, no route changes. |
| II. localStorage is the system of record | **Pass** | No persisted shape change, so no `schemaVersion` bump and no migration are owed (FR-020). A shuffle permutes `queue`; it never changes membership, so `readRun`'s set-equality validation still holds. Verified in [data-model.md § The invariant that makes this free](./data-model.md#the-invariant-that-makes-this-free). |
| III. Green CI or it does not merge | **Pass** | No new CI step. Existing `lint → typecheck → test → build` covers it. |
| IV. Test behavior, not implementation | **Pass, and it drives the design** | A pure function that calls `Math.random` internally cannot be tested for the behavior the spec asks for. Injecting `Rng` is what makes SC-001 through SC-006 assertable. Component tests continue to query by role and visible text. |
| V. Minimal dependency surface | **Pass** | Zero dependencies added. See [research.md § Why no dependency](./research.md#decision-3-no-shuffle-or-prng-dependency). |
| VI. Build only what was asked | **Pass with one justified change** | The `Run.tsx` transition fix is required for correctness of what was asked, not adjacent to it. Recorded in [Complexity Tracking](#complexity-tracking). |
| VII. Self-contained, no host pollution | **Pass** | Nothing installed, nothing global. |
| VIII. Free, open, reputable, stable | **Not engaged** | No new dependency and no new asset. |

**No gate fails. No violation requires an exit path.**

## Project Structure

### Documentation (this feature)

```text
specs/002-random-run-order/
├── spec.md                  # merged in #85
├── plan.md                  # this file
├── research.md              # Phase 0
├── data-model.md            # Phase 1
├── quickstart.md            # Phase 1
├── contracts/
│   └── run-engine.md        # Phase 1 — the engine's changed signatures
├── checklists/
│   └── requirements.md      # 16/16
└── tasks.md                 # /speckit-tasks, not created here
```

### Source code (repository root)

```text
src/
├── run/
│   ├── shuffle.ts           # NEW — Fisher–Yates over an injected Rng
│   ├── shuffle.test.ts      # NEW
│   ├── types.ts             # + Rng
│   ├── reducer.ts           # start/mark/restart take an Rng; shuffle at cycle start
│   ├── reducer.test.ts      # order assertions rewritten; new order tests
│   └── selectors.ts         # UNCHANGED
├── routes/
│   ├── Run.tsx              # compute each transition once (see Complexity Tracking)
│   └── Run.test.tsx         # + resume-order and restart-order tests
├── storage/
│   ├── deckRecord.ts        # UNCHANGED
│   ├── migrations.ts        # UNCHANGED — no bump
│   └── deckRecord.test.ts   # + shuffled-order round trip, + legacy config-order run
└── test/
    └── rng.ts               # NEW — deterministic PRNG, test-only
```

**Structure Decision**: The existing layout is kept exactly. The mechanic stays entirely inside
`src/run/`, which is the rule 001 established and the reason this feature touches one component
file and no storage code. `src/test/` already exists for test setup, which is where the
deterministic PRNG belongs — it is a test fixture, not a runtime module.

## Complexity Tracking

> One change is larger than the feature description alone implies, and is recorded here rather than
> made quietly.

| Change | Why needed | Simpler alternative rejected because |
|---|---|---|
| `RunLoop` moves from `useReducer` to `useState`, and `apply` computes the next state once | `Run.tsx:173–174` runs the transition twice — `dispatch(action)` has React compute it, then `runReducer(state, action)` computes it again to decide what to persist. Today that is safe and the code says so: *"The engine is pure, so working the next state out here and letting React work it out again cannot diverge."* Randomizing the engine makes it false. The two calls would shuffle differently at a cycle boundary, persisting an order that is not the one on screen — the exact failure FR-011 and FR-015 forbid, and a silent one, since `readRun` validates set equality and would accept the wrong order. StrictMode's double-invoke is a second instance of the same hazard. | Keeping `useReducer` and dispatching a pre-computed `{type:'replace'}` action works, but leaves a reducer that is dispatched with an already-final state — a reducer that no longer reduces. Once the transition must be computed at the call site, `useState` is the smaller of the two. |

Everything else is additive: one new pure module, one new type, one threaded parameter.

## Post-design re-check

Re-evaluated after Phase 1. **No verdict changed.**

Two things the design work confirmed rather than assumed:

- **Principle II holds by construction.** `readRun` validates `queue ∪ failedThisCycle ∪
  passedThisRun` as a *set* against the rung, and permutation preserves sets. A run written before
  this feature — `queue` in config order — is therefore already a valid run afterwards, which is why
  FR-021 costs no code. Walked through in [data-model.md](./data-model.md#the-invariant-that-makes-this-free).
- **Principle IV shaped the contract, not just the tests.** `Rng` is a parameter because SC-002 and
  SC-003 are distribution claims, and a distribution claim cannot be asserted against a function
  that reaches for global randomness on its own.
