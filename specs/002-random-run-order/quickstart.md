# Quickstart: validating Random Run Order

**Date**: 2026-08-23 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

How to prove the feature works. Automated checks first, then the three things only a browser can
show.

## Prerequisites

Node 26.7.0 (`.nvmrc`) and a clean install:

```sh
npm ci
```

## Gate

```sh
npm run lint && npm run typecheck && npm test && npm run build
```

Same sequence CI runs. All four must pass before the PR is opened.

## Automated coverage map

Every success criterion has an owning test. `/speckit-tasks` turns this into the task list.

| Criterion | Asserted in | Shape of the assertion |
|---|---|---|
| SC-001 first card varies over 20 runs | `src/run/reducer.test.ts` | 20 `start` calls with a seeded `Rng`; the set of first cards has more than one member. |
| SC-002 every card reaches every position | `src/run/shuffle.test.ts` | Shuffle a 5-element input over many seeds; assert a 5×5 position-occupancy grid has no empty cell. |
| SC-003 repeat cycle ≠ fail order beyond chance | `src/run/reducer.test.ts` | Drive many runs to cycle 1 with a fixed fail set; assert the share of cycles matching fail order is near `1/k!`, not 1. |
| SC-004 cycle membership unchanged | `src/run/reducer.test.ts` | I7 — every `queue` is a permutation of the cards that cycle should hold. Compare as sorted sets. |
| SC-005 resume matches uninterrupted | `src/routes/Run.test.tsx` | Play a run to a known point, unmount, remount, and compare the full card sequence against one uninterrupted playthrough of the same `Rng`. |
| SC-006 no passed card re-presented | `src/routes/Run.test.tsx` | Across a resumed run, no card appears twice after being marked "Got it". |
| SC-007 pre-feature runs resume, zero migration | `src/storage/deckRecord.test.ts` | Seed `localStorage` with a v1 run whose `queue` is in config order; assert it reads back intact and `CURRENT_SCHEMA_VERSION` is still 1 with an empty migration registry. |
| SC-008 completion unchanged | `src/run/reducer.test.ts` | 001's I3 test, still passing. |
| SC-009 no perceptible delay | not a test | One O(52) shuffle per cycle, not per card. Confirmed by inspection; see the browser walkthrough. |
| SC-010 memorized sequence does not clear a repeat | `src/run/reducer.test.ts` | Two runs of one rung under different seeds; assert the answer sequence that cleared the first does not clear the second. |

Two hazards get their own tests rather than riding along:

- **The `Rng` boundary.** An `Rng` returning exactly `1` must not put `undefined` in a queue.
  `src/run/shuffle.test.ts`.
- **The double transition.** `src/routes/Run.test.tsx` must fail against the current
  `Run.tsx:173–174`. Mark a card at a cycle boundary, then read the run back from storage and assert
  its `queue` equals the order on screen. Without the fix, two independent shuffles make these
  differ. Per constitution Principle IV, write it and watch it fail first.

## Browser walkthrough

```sh
npm run dev
```

Use Dolch Pre-K, smallest rung. Three things the test suite cannot show:

**1. It looks random (FR-001, FR-002).** Start the rung, note the first two or three words, leave the
run, start it again. Repeat a few times. The opening words should move around. Then fail three
cards deliberately and let the cycle turn over — the repeat cycle should not arrive in the order you
failed them.

**2. A resume is invisible (FR-011, FR-012, FR-014).** Part-way through a run, write down the card on
screen and the next two. Close the tab. Reopen and resume. Same card, same next two, and nothing
you already passed comes back.

**3. Nothing else moved (FR-025, FR-026, FR-027).** The remaining count still counts down correctly.
"Start over" gives a different order from the run it discarded. No new control, toggle, or setting
appeared anywhere.

## Upgrade check

The one thing worth doing by hand, because it is what a real learner will experience.

1. On `main`, before the change: start a run and mark two or three cards. Leave the tab open.
2. Switch to the feature branch and restart the dev server.
3. Reload and resume.

The run must resume on the same card, in its original config order, and finish normally. It must not
be discarded, reshuffled, or migrated. That is FR-021 and SC-007 — and it works because `readRun`
compares card membership as a set, never as an order.

## Deploy check

The PR gets a Cloudflare Pages preview. Both branch-protection checks — `Verify` and
`Cloudflare Pages` — must pass. On the preview, open a run deep link
(`/deck/:deckId/rung/:rungId`) directly to confirm SPA fallback still resolves, per constitution
Principle I. Nothing in this feature touches routing, so this is a regression check, not a new risk.
