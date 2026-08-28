# Quickstart: Run Progress Bars

**Feature**: `006-run-progress-bars` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run this feature and prove it works. Automated checks come first because they are cheap and
cover the arithmetic; the manual checks cover placement, thickness, and layout, which no jsdom test
can see.

## Prerequisites

```bash
node --version    # must match .nvmrc — 26.7.0
npm ci            # from the committed lockfile
```

Nothing else. No global install, no service, no network at runtime (constitution Principle VII).

## Setup

One command adds the component. It installs no package — `radix-ui` is already a dependency.

```bash
npx shadcn add progress
```

Confirm it landed where the aliases in `components.json` say, and that it pulled nothing in:

```bash
test -f src/components/ui/progress.tsx && echo "component present"
git diff --stat package.json package-lock.json    # MUST be empty
```

Do **not** edit the component. It ships verbatim ([research.md § Decision 5](./research.md)), so it
must stay byte-identical to the registry — verify that, and verify the `max` trap from
[contracts/run-progress.md § 3](./contracts/run-progress.md) has not been reintroduced:

```bash
# The indicator's classes must be exactly as shipped — no motion-safe:, nothing added.
grep -c 'className="size-full flex-1 bg-primary transition-all"' src/components/ui/progress.tsx
# expect: 1

grep -rn "max=" src/components/RunProgress.tsx    # expect NO hits
```

The one difference from `npx shadcn view progress` output is expected and not a modification: the CLI
rewrites `@/registry/radix-nova/lib/utils` to `@/lib/utils` per the aliases in `components.json`.
Nothing else may differ.

## Automated checks

The full gate, in the order CI runs it:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Targeted runs while working:

```bash
npx vitest run src/routes/Run.test.tsx      # the bars as rendered, and the 17 migrated assertions
npx vitest run src/run/reducer.test.ts      # unchanged by this feature except one trimmed test
```

### What the automated checks must establish

Six assertions, all in `src/routes/Run.test.tsx`, plus the 17 migrated ones. The authoritative list
with its task numbers is in [tasks.md](./tasks.md) — T005, T011, T013 — and is not restated here, so
the two documents cannot drift apart. What matters at this level is the shape of the coverage:

| Level | What is asserted | Where |
|---|---|---|
| Rendered | Both bars read as `{done} of {total} cards`; the run bar ignores "Not yet"; the cycle bar resets to `0 of N` and measures against its own cycle; both read full at completion; neither appears on a "Run not found" screen | T005, T011, T013 |
| Migrated | 17 existing assertions that used the deleted sentence as a proxy for run position, now reading the bars. Three of them are load-bearing: they are what prove FR-008 (start over), FR-009 (resume), and FR-022 (pronounce moves neither bar) | T009 |
| Pre-existing | The arithmetic invariant behind the run bar — `passedThisRun.length === rungSize` if and only if the run is complete — is already asserted at `src/run/reducer.test.ts:268` (I3), with `:293` (I6) proving no card is counted twice. **No new unit test is needed and none should be added** | already green |

**No new selectors, and no unit tests for them.** An earlier draft added two; both were cut, along
with six assertions that turned out to be tautological or already covered. The reasoning is in
[research.md § Decision 9](./research.md) and the list is in
[tasks.md § Tests that were cut](./tasks.md). If you find yourself writing a test that asserts a
getter returns the field it reads, that is the thing that was cut — stop.

A quick way to confirm the sentence is genuinely gone everywhere:

```bash
grep -rn "left in this round" src/    # expect NO hits
grep -rn "CycleCounter\|remainingInCycle" src/    # expect NO hits
```

## Manual checks

Nine of the requirements are visual or motion-related and are not assertable in jsdom. Run the app:

```bash
npm run dev     # then open /deck/dolch-prek-5/rung/r1
```

Rung `r1` is five words (a, I, the, and, to), which makes each step a clean 20%. Rung `r8` is the
full 40-word deck if you want to see fine-grained movement.

| # | Check | How | Requirement |
|---|---|---|---|
| 1 | Two bars at the very top, the upper one visibly thicker | Look. Upper is 6px, lower is 2px. | FR-012, FR-013 |
| 2 | Both use existing theme colours | Toggle dark mode. The thickness difference must survive it; no new colour appears. | FR-013, FR-014 |
| 3 | Capped and centred on a wide screen | Widen the window to full ultra-wide. Bars stay the content column's width, centred, aligned with the card's edges. | FR-016, SC-008 |
| 4 | Pinned while scrolling | Shrink the window until the page scrolls, then scroll. The bars stay at the top edge. | FR-015 |
| 5 | Nothing hidden behind them | At that same short height, confirm the "Deck · rung" heading is fully readable and not clipped. | FR-017, SC-009 |
| 6 | Nothing between card and buttons | Look at the space the sentence used to occupy. It is empty. | FR-018, SC-007 |
| 7 | Top bar only grows on "Got it" | Mark "Not yet" and watch the top bar. It must not move. | FR-003, SC-005 |
| 8 | Cycle bar rewinds at a cycle boundary | Mark four "Got it" then one "Not yet". The lower bar slides back to empty. | FR-006, Decision 7 |
| 9 | Full exactly at completion | Get all five words right. The top bar reaches its end on the same mark that shows "Run complete" — not a card early. | FR-004, FR-020, SC-003 |

### Screen reader spot check

Requires VoiceOver (macOS: ⌘F5) or another real reader. Automated tests confirm the attributes are
present; only a reader confirms what is actually said.

- Focus each bar. It is announced by its own name, and the value is spoken as **cards** — "2 of 5
  cards" — never as a percentage. (FR-024, SC-010)

### Preview deploy

Per constitution Principle I, deep links and real `localStorage` get verified on the PR's Pages
preview rather than on the dev server. Open the preview and re-run manual checks 3, 4, and 5 there,
on an actual phone if one is to hand — viewport behaviour is the part of this feature the dev server
is least able to vouch for.

## Rollback

No storage shape changed and no migration ran, so reverting the branch is the whole rollback. A
device holding a run written by this build resumes correctly on the previous build, because the
persisted record is byte-identical.
