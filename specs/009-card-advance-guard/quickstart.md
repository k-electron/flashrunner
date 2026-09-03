# Quickstart: Card Advance Guard

**Feature**: 009-card-advance-guard | **Spec**: [spec.md](./spec.md) ·
[contract](./contracts/card-advance.md)

How to prove the feature works, and how to tune it. Prerequisites are the
repo's: git and Node at the version in `.nvmrc`, nothing else.

```bash
npm ci
```

---

## 1. The CI gate

Same sequence CI runs, and the same build command Pages runs.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

**Expected**: all green. `npm test` includes the rewritten `Run.test.tsx` — 53
existing press sites now route through the `mark()` / `restart()` helpers, plus the
new guard tests.

## 2. What the unit tests prove

```bash
npx vitest run src/routes/Run.test.tsx
```

| Expected outcome | Requirement |
|---|---|
| Two presses inside the window mark one card | FR-001, SC-001 |
| With no timer advance at all, the outcome is already stored and the bars have moved, while the marked card is still painted | FR-005d, FR-014 |
| Unmounting mid-exit and rendering again resumes on the *next* card — the mark survived | FR-014, SC-003b |
| "Start over" during an exit leaves one coherent run, with the earlier mark still recorded | FR-013 |
| A press on the *other* button inside the window is ignored | FR-002 |
| A blocked press moves neither progress bar and writes nothing | FR-003 |
| A press after the window marks normally | FR-001, SC-002 |
| Keyboard activation and auto-repeat are guarded like a tap | FR-004 |
| At both durations `0`, one press still marks exactly one card | FR-008 |
| "Repeat this run" works immediately on the completion screen | FR-009 |
| A resumed run's first card is markable with no wait | FR-010 |
| "Start over" is never blocked, and does open a window of its own | FR-012 |

**Not covered here, by design**: everything visual. jsdom applies no CSS, and
asserting class names is forbidden by constitution Principle IV. See § 3.

## 3. The browser checks

These are the whole verification of FR-005, FR-005a, FR-005b, FR-005c, FR-006,
FR-007a and FR-011. Playwright drives the dev server from the scratchpad — it is
**not** added to `package.json`, so the repo stays free of it (Principle VII).

```bash
npm run dev          # leave running on :5173
```

Navigate to a run — `/deck/dolch-prek-5/rung/r1` — and check each of the nine:

| # | Check | Requirement |
|---|---|---|
| 1 | Press "Got it". The old card and both buttons **leave** together; the new card and the buttons **arrive** together. No element starts or finishes on its own timing | FR-005 |
| 2 | The outgoing card is still readable for the whole exit — it does not vanish on the press | FR-005d |
| 3 | The travel is small (8px each way) and eased. Nothing slides across the screen | FR-005a |
| 4 | The buttons come to rest at exactly the position and size they held before the press. Measure it — a 1px drift is a bug | FR-005a |
| 5 | The dim is **one continuous gesture**: it deepens as the card leaves, does not reset or flicker at the boundary, and recovers as the next card settles. You should not be able to point to the frame where the phases meet | FR-005b, SC-003a |
| 6 | No countdown, no numeric timer, no spinner, and at no point does a button look greyed out or switched off | FR-005b |
| 7 | Both progress bars' fill *grows* rather than jumping — the bar starts advancing as the card leaves underneath it, which is the first sign the press landed. It runs on its own layer and need not finish with the card | FR-005c |
| 8 | Tap the instant the entry stops: it registers. Tap a frame earlier: it does not | FR-006 |
| 9 | Press the speaker mid-transition — nothing is said. Press it once the block settles — it speaks | FR-011 |
| 10 | Press "Start over" mid-transition. The card on screen exits and the restarted card enters, exactly like a mark | FR-012, FR-013 |
| 11 | Arrive at a run fresh. The first card plays an entry, and is markable straight away | FR-010 |
| 12 | Mark the last card of a run. It plays its exit, then the run-complete screen enters. No hard cut, and its buttons work on the frame they appear | FR-005e, FR-009 |

Playwright, for the checks that are measurements rather than impressions
(3, 6, 7):

```bash
cd "$SCRATCHPAD" && npx playwright@1.62.1 install chromium   # first run only
# then drive http://localhost:5173/deck/dolch-prek-5/rung/r1:
#   4  → boundingBox() of each button before the press and after settling; compare
#   5  → sample the block's computed opacity every ~16ms across both phases;
#        assert it is monotonic down then up, with no step at the boundary
#   7  → poll the indicator's transform at ~4 points after the press; assert it
#        is strictly between the old and new value at least once
#   8  → click at (EXIT+ENTRY) - 32ms and again at + 32ms; assert one mark
#   10 → click "Got it", then "Start over" at EXIT/2; assert one coherent run
#   -- → click "Got it" and reload the page at EXIT/2; assert the run comes back
#        on the next card, not the one just marked (FR-014)
```

Playwright 1.62.1 resolves from the npx cache here — verified, not assumed.

Record what the checks actually showed, per the repo's habit — not that they
were run.

## 4. Tuning it

One file: `src/run/advance.ts`.

```ts
export const CARD_EXIT_MS = 140;
export const CARD_ENTRY_MS = 180;

export const CARD_EXIT_CLASSES =
  'animate-out fade-out-40 slide-out-to-top-2 ease-in fill-mode-forwards duration-(--card-exit)';
export const CARD_ENTRY_CLASSES =
  'animate-in fade-in-40 slide-in-from-bottom-2 ease-out duration-(--card-entry)';
```

| To change | Edit | Note |
|---|---|---|
| How long the card takes to leave | `CARD_EXIT_MS` | The guard window follows automatically — it is the sum |
| How long the next takes to arrive | `CARD_ENTRY_MS` | Entry only. The progress bars are not on this clock — they are a separate layer with their own 150ms |
| The overall feel of the pause | Both | Try an exit quicker than the entry first: the card leaves briskly and the next settles gently |
| How far the block travels | `slide-out-to-top-2` / `slide-in-from-bottom-2` | Tailwind spacing: `-1` is 4px, `-4` is 16px. Keep the two equal unless you want an asymmetric arc |
| Which way it goes | `-top` / `-from-bottom` | `-left`, `-right` also exist. Out-top-in-from-bottom reads as "next card" |
| How deep the dim goes | `fade-out-40` **and** `fade-in-40` | **Change both to the same number.** They meet at the boundary, and a mismatch is a visible step in the middle of the gesture. `0` is invisible — too far, it stops reading as a dim |
| The easing | `ease-in` on the exit, `ease-out` on the entry | Accelerate away, decelerate in. `ease-in-out`, `ease-linear`, `ease-[cubic-bezier(...)]` |

`fill-mode-forwards` on the exit is **not** a tuning knob. Remove it and the
outgoing card snaps back to full opacity for a frame before it unmounts.

With the dev server running, an edit here is a hot reload. Expect several passes:
"subtle, polished and tasteful" is the acceptance test and it is a judgement.

**Sanity bounds while tuning**, from the contract § 5:

- Below ~120ms **total** the protection stops working — a finger bounce is
  50-100ms.
- Above ~450ms total an adult marking quickly starts waiting on the app (SC-002).
- At `0` for both, the app must still be correct: one press, one card marked, the
  outcome applied and stored. Check it after any change to the machine itself:

```bash
# temporarily set both CARD_EXIT_MS and CARD_ENTRY_MS to 0
npx vitest run src/routes/Run.test.tsx
```

## 5. Confirm nothing else moved

```bash
git diff --stat main -- src/ package-lock.json
```

**Expected**: four files, and **no change to `package-lock.json`** — this feature
adds no dependency.

```bash
git diff main -- src/components/ui/ && echo "no vendored component touched"
```

**Expected**: empty.

```bash
git diff main -- src/storage/ && echo "storage untouched"
```

**Expected**: empty. No `schemaVersion` bump, no migration (FR-010).

---

## 6. What the browser checks showed

Recorded per the repo's habit: what was observed, not that it ran. Chromium
via Playwright 1.62.1 from the scratchpad, `reducedMotion: 'no-preference'`,
against `npm run dev` at `140` / `180` (window `320ms`). Durations were read off
the page's own `--card-exit` / `--card-entry` rather than written into the
script, so the script retimes with the app.

**All twelve passed.** Measured values:

| # | Requirement | What was measured |
|---|---|---|
| 1 | FR-005 | Wrapper `animation-name` ran `exit` → `enter`; descendants carrying an animation of their own: **0** at every frame. The group moves as one because it is one element |
| 2 | FR-005d | The marked word stayed on screen for **all 14** mid-exit frames. Both words appear across the window, never together |
| 3 | FR-005a | Peak `translateY` **8.00px** over 43 frames. Nothing slides across the screen |
| 4 | FR-005a | "Got it" and "Not yet" both returned to **0.000px** on x, y, width and height. The card's y and height also 0.000 (its width tracks the word, which changes) |
| 5 | FR-005b, SC-003a | Opacity `1.00` → floor **`0.40` at 155ms** → `1.00`. Step across the boundary **0.051** against a largest step elsewhere of **0.102** — the boundary is not an outlier, so there is no frame where the two halves meet. **0** non-monotonic frames falling, **0** recovering |
| 6 | FR-005b | No button carried `disabled` at any frame; **0** countdown, timer, spinner or progressbar elements inside `<main>`. Floor opacity `0.40`, clear of shadcn's static `0.5` disabled look |
| 7 | FR-005c | **19** distinct run-bar transforms across the window, **15** of them while the card was still leaving. It grows, and it starts growing under the departing card |
| 8 | FR-006 | Second press at window **−45ms** → `1 of 5 cards` (refused). At window **+45ms** → `2 of 5 cards` (accepted). The window closes where the animation ends, with no third number involved |
| 9 | FR-011 | Utterances: 1 before the mark, **1** after a press mid-transition (unchanged), **2** after a press once settled. This is the requirement no unit test can reach |
| 10 | FR-012, FR-013 | "Start over" mid-exit ran `exit` → `enter` and dipped to `0.40`, then left `0 of 5` / `0 of 5`. It animates like a mark and restarts cleanly |
| 11 | FR-010 | On arrival the block carries `animation-name: enter`, running. A press with no wait at all gave `1 of 5 cards` — an entry, unguarded |
| 12 | FR-005e, FR-009 | The last card played `exit`; the completion screen mounted carrying `animation-name: enter`; "Repeat this run" pressed on the frame it appeared gave `0 of 5 cards` |

### Two traps in driving this with Playwright

Both produced confident false results before being caught, so they are written
down rather than left to be rediscovered:

- **`click()` waits for a stable bounding box.** Every "press mid-transition"
  was silently deferred until the animation finished, so checks 8, 9 and 10
  passed against a settled screen and check 9 read as a **failure** of the
  pronounce guard that was not one. Every press must be `click({ force: true })`.
- **`localStorage` survives `page.goto`.** Runs leaked between scenarios and the
  counts drifted. Clear it, then navigate again, before each check.

### The one thing measured and deliberately left

Each phase ends on the first paint after its `setTimeout`, so the opacity floor
lands at **155ms** against a nominal 140ms boundary — about one frame late, as
[research.md](./research.md) § 5 predicted. No knob corrects it: a correction
would be a third number that could disagree with the other two, and 15ms is far
below the ~100ms floor of perception.

## 7. Tuning, as actually judged

`140` / `180` was kept. The reasoning, so the next person retunes from a
position rather than from scratch:

- **320ms total** against a 50-100ms finger bounce — roughly 3× the thing it
  exists to stop, and well inside the ~450ms ceiling at which an adult marking
  quickly starts waiting on the app (SC-002).
- **8px of travel** is displacement rather than relocation. At `-4` (16px) the
  block starts to read as sliding rather than settling.
- **The exit quicker than the entry** does what the contract predicted: the card
  leaves briskly and the next settles.

This is a judgement, not a measurement, and it is a one-line edit in
`src/run/advance.ts` if it reads wrong on a real device.
