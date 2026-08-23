# Phase 0 Research: Random Run Order

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

The spec left nothing marked NEEDS CLARIFICATION — both open questions were settled in the
clarification session and are recorded in the spec's Clarifications section. What remained was
mechanism: where randomness enters a pure engine, and what breaks when it does.

---

## Decision 1: randomness enters as an injected parameter

**Decision.** Add `type Rng = () => number` (a value in `[0, 1)`) and thread it through the engine:
`start(deck, rungId, rng)`, `mark(state, outcome, rng)`, `restart(deck, state, rng)`. Each defaults
to `Math.random`, so production call sites are unchanged and tests override.

**Rationale.** Constitution Principle IV requires the engine's behavior to be testable, and three
success criteria are distribution claims — SC-001 (20 runs do not share a first card), SC-002 (every
card reaches every position), SC-003 (a repeat cycle matches fail order no more often than chance).
None can be asserted against a function that reaches for global randomness internally. Injection
also keeps `src/run/` pure in the sense 001 established: the engine's output is a function of its
arguments.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Shuffle at the call site in `Run.tsx`, engine stays order-free | Splits the mechanic across the engine and a component. 001's rule is that every decision about the mechanic lives in `src/run/reducer.ts`, and the cycle-boundary shuffle *is* part of the mechanic. |
| Module-level RNG with a `setRng()` test seam | Global mutable state makes tests order-dependent and lets one test leak into the next. |
| Store a seed and recompute order from it | Rejected in clarification, now FR-010. The order is already persisted; a seed would be a second source of truth for it. |

**Note on the defaults.** A default parameter makes the impurity easy to miss at a call site. That
is acceptable here only because the one place where missing it would cause a real bug — the double
transition in `Run.tsx` — is being fixed as part of this work (Decision 4). Without that fix, the
default would hide the bug rather than merely permit it.

---

## Decision 2: Fisher–Yates, unbiased, no retry

**Decision.** A single new pure module, `src/run/shuffle.ts`:

```ts
export function shuffle<T>(items: readonly T[], rng: Rng): T[]
```

Copies the input, walks it back to front, swaps each element with a uniformly chosen index at or
below it. Never mutates its argument.

**Rationale.** Fisher–Yates is the standard unbiased in-place shuffle and is O(n) over at most 52
ids. It satisfies FR-005 (every card reachable in every position) by construction.

**The rejected "improvement".** Not re-rolling when the result equals the input order. The spec's
edge cases make this explicit: a two-card cycle reproduces the previous order half the time, and a
larger shuffle landing on config order is legitimate. Re-rolling to make output "look random" biases
the distribution and breaks FR-005.

**Boundary to guard.** `Math.floor(rng() * (i + 1))` yields `i + 1` if an `Rng` ever returns exactly
`1`, indexing off the end. `Math.random` never does, but a hand-written test `Rng` easily could, and
the failure would be a silent `undefined` in a queue. The index is clamped, and a test passes an
`Rng` that returns `1` to prove it.

---

## Decision 3: no shuffle or PRNG dependency

**Decision.** Use `Math.random`. Add nothing to `package.json`.

**Rationale.** FR-023 rules out any cryptographic-strength requirement, and the maintainer asked for
"a basic standard rng". `Math.random` is exactly that, is available in every target browser, and
needs no network or permission (FR-024). Constitution Principle V asks whether hand-rolling is worse
than a dependency: Fisher–Yates is ten lines with a well-known correct form, so it is not.

Because nothing is added, Principle VIII is not engaged — there is no license, maintenance status,
or release channel to record.

**Not a concern.** `Math.random`'s statistical quality is far beyond what the spec asks. The
Assumptions section requires only that a child cannot predict the order, and claims nothing about
uniformity or period beyond SC-001 through SC-003.

---

## Decision 4: `Run.tsx` must compute each transition exactly once

**Decision.** `RunLoop` moves from `useReducer` to `useState<RunState>`, and `apply` computes the
next state once, using that one value for both the state update and the persist.

**The bug this prevents.** `src/routes/Run.tsx:173–174` today:

```ts
dispatch(action);                                          // React computes the transition
setStorageFull(persist(deck, runReducer(state, action)));  // and it is computed again, here
```

The code documents why that is safe: *"The engine is pure, so working the next state out here and
letting React work it out again cannot diverge."* Randomizing the engine makes the premise false.
At a cycle boundary the two calls shuffle independently, so the order written to storage is not the
order on screen.

**Why it would go unnoticed.** `readRun` validates `queue ∪ failedThisCycle ∪ passedThisRun` as a
set against the rung. Two different permutations of the same cards both pass. Nothing throws,
nothing is dropped, and the learner is served a different order after a resume — violating FR-011
and FR-015 in the one way no existing check catches.

**Second instance of the same hazard.** `<StrictMode>` is enabled (`src/main.tsx:13`) and
double-invokes reducers in development, precisely to surface impure ones. Computing once removes
both instances.

**Alternative considered.** Keep `useReducer` and dispatch a pre-computed `{type:'replace', state}`
action. It works, but yields a reducer that is handed an already-final state and no longer reduces
anything. Once the transition must be computed at the call site, `useState` is smaller.

**Not affected.** The lazy initializer `useState(() => resume(deck, rung))` may shuffle twice under
StrictMode, but React keeps one result and the entry write persists that same value. No divergence —
just a discarded shuffle in development.

---

## Decision 5: a deterministic PRNG, in test code only

**Decision.** `src/test/rng.ts` exports a mulberry32-style generator: a number in, an `Rng` out, same
sequence every time. Roughly five lines. Used by `shuffle.test.ts`, `reducer.test.ts`, and the
statistical assertions.

**Rationale.** SC-002 and SC-003 need many trials with a reproducible outcome, or CI flakes. A
scripted array of fixed values is enough for single-shuffle assertions but not for a distribution
over thousands of trials.

**Why this does not contradict FR-010.** FR-010 forbids *storing* a seed in a learner's run record.
This generator is a test fixture. It is never imported by anything under `src/run/`, `src/routes/`,
or `src/storage/`, and nothing it produces is written to `localStorage`. A lint-visible rule is not
needed; the import graph is the evidence, and it is checked by the build.

---

## Confirmed by reading the code, not assumed

- `PersistedRun` is `Omit<RunState, 'status' | 'deckId'>` (`src/storage/deckRecord.ts:11`), so `queue`
  — the ordered list — is already persisted in full. This is what makes FR-010 and FR-020 free.
- `mark` computes the next cycle's queue in the same transition that ends the previous cycle
  (`src/run/reducer.ts:59–66`), and `apply` persists the result immediately, so an order is on disk
  before any interruption can occur.
- `readRun` compares card membership with `sameSet`, never with order (`src/storage/deckRecord.ts`),
  which is why a pre-feature run in config order remains valid afterwards (FR-021).
- No file under `src/` references `Math.random`, `shuffle`, or any RNG today. The only mention is the
  comment on `start` promising config order, which this feature replaces.
- Existing tests assert config order directly — `queue: FIVE_CARDS` and `queue).toEqual(['c2','c4'])`
  described as "in fail order" (`src/run/reducer.test.ts:38, 77`). These are correct today and become
  wrong; rewriting them is scoped work, not incidental breakage.
