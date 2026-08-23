# Contract: the run engine's interface

**Date**: 2026-08-23 | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

The app exposes no network API. Its contracts are internal module boundaries. This feature changes
exactly one of them — the run engine in `src/run/` — and leaves the storage contract untouched.

## Storage contract: unchanged

[`specs/001-deck-runs/contracts/storage.md`](../../001-deck-runs/contracts/storage.md) continues to
hold verbatim. `schemaVersion` stays **1**, the key namespace is unchanged, `PersistedRun` keeps its
exact fields, and no migration is added. See
[data-model.md § The invariant that makes this free](../data-model.md#the-invariant-that-makes-this-free)
for why a shuffle costs nothing here.

## `src/run/shuffle.ts` — new

```ts
import type { Rng } from '@/run/types';

export function shuffle<T>(items: readonly T[], rng: Rng): T[];
```

`rng` is **required**. This module has no reason to reach for a default: it exists to be given one.

| Guarantee | |
|---|---|
| Purity | Returns a fresh array. `items` is never mutated. |
| Permutation | Output has the same length and the same multiset of members. |
| Reachability | Over repeated calls, every element reaches every index. |
| Honesty | An output equal to the input order is returned as-is. Never re-rolled. |
| Total | `[]` and one-element inputs return an equal array. An `Rng` returning `1` does not index off the end. |

## `src/run/types.ts` — one addition

```ts
/** A source of randomness yielding a number in [0, 1). `Math.random` satisfies it. */
export type Rng = () => number;
```

`Outcome` and `RunState` are unchanged. `RunState.queue` keeps its type and gains a shuffled
meaning.

## `src/run/reducer.ts` — three signatures gain a parameter

```ts
export function start(deck: DeckConfig, rungId: RungId, rng?: Rng): RunState;
export function mark(state: RunState, outcome: Outcome, rng?: Rng): RunState;
export function restart(deck: DeckConfig, state: RunState, rng?: Rng): RunState;
```

Each defaults to `Math.random`. Existing call sites compile unchanged; tests pass a deterministic
`Rng`.

| Function | Consumes randomness | Behavior |
|---|---|---|
| `start` | Always, once | `queue = shuffle(rung.cardIds, rng)`. Still throws on an unknown rung. |
| `mark` | Only at a cycle boundary | Mid-cycle it advances `position` and consumes nothing. Ending a cycle with failures sets `queue = shuffle(failedThisCycle, rng)`. Completing consumes nothing. |
| `restart` | Always, once | Delegates to `start`, so a restart is a fresh shuffle (FR-017, FR-018). |

Marking a complete run still returns the state unchanged and consumes no randomness.

## `src/run/selectors.ts` — unchanged

`currentCard`, `remainingInCycle`, and `isComplete` read `queue` and `position` and are indifferent
to order. `remainingInCycle` stays correct, which is FR-026.

## `src/routes/Run.tsx` — the caller's obligation

**A transition must be computed exactly once and that single value used for both the state update
and the persist.**

This is a contract, not an implementation note. It is unenforceable by the type system and its
violation is silent — two shuffles of the same cards both pass `readRun`'s set-equality check, so a
divergent order reaches the learner with nothing thrown and nothing logged.

```ts
// Required shape.
function apply(action: RunAction): void {
  const next = transition(state, action);   // once
  setState(next);
  setStorageFull(persist(deck, next));      // the same value
}
```

```ts
// Currently at src/routes/Run.tsx:173–174. Correct today, wrong the moment the engine shuffles.
dispatch(action);
setStorageFull(persist(deck, runReducer(state, action)));  // a second, different transition
```

`<StrictMode>` (`src/main.tsx:13`) double-invokes reducers in development for exactly this class of
bug. Computing once satisfies it too.

## What callers may rely on

- The order a cycle is presented in is decided once, when the cycle begins, and is in `queue`
  (FR-007, FR-009).
- `queue` is written to storage by the same transition that sets it, so an order is durable before
  any interruption can occur (FR-008, FR-016).
- Nothing recomputes an order from anything. Reading a run back is the whole of resume (FR-009).
- No seed, generator state, or equivalent is stored anywhere (FR-010).
