# Phase 0 Research: Run Progress Bars

**Feature**: `006-run-progress-bars` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

Every decision below was settled either with the maintainer in conversation before the spec was
written, or against evidence gathered from the actual registry and a throwaway test run in this
repo. Where a claim was checked rather than assumed, the check is recorded.

---

## Decision 1 — Use the vendored `@shadcn/progress` component

**Decision**: Add `src/components/ui/progress.tsx` via `npx shadcn add progress`, which resolves
through this project's preset to the `radix-nova` base.

**Verified, not assumed.** `npx shadcn view progress` returns exactly one file,
`registry/radix-nova/ui/progress.tsx`, whose whole body is:

```tsx
function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}
```

**Rationale**: it imports `Progress as ProgressPrimitive` from `radix-ui`, which is already a
dependency at `^1.6.7` and already used for `Slot` in `src/components/ui/button.tsx`. Adding this
component installs **nothing**. Principle V's pre-approved row for shadcn/ui plus Radix primitives
covers it with no justification required, and Principle VIII needs no new license entry.

**Alternatives considered**:

- **Hand-rolled `<div>` pair.** Two nested divs with a width percentage is genuinely fewer lines
  than the vendored file. Rejected because it would hand-roll `role="progressbar"` and the three
  `aria-value*` attributes, which is exactly the accessibility work the primitive exists to get
  right, and Principle V says prefer the already-approved thing.
- **A native `<progress>` element.** Rejected: it is notoriously hard to style consistently across
  engines, and restyling it to a flat 2px track is more CSS than the vendored component is code.

---

## Decision 2 — Differentiate the two bars by height, not colour

**Decision**: run bar `className="h-1.5"`, cycle bar `className="h-0.5"`. Both keep the shipped
`bg-primary` fill and `bg-muted` track. No new colour token.

**Rationale**: the component's `className` reaches only `ProgressPrimitive.Root`, and the Root's
class list carries `h-1`. `cn()` is `tailwind-merge`, so `h-1.5` and `h-0.5` override it cleanly —
height is *directly* configurable with no tricks. The indicator's `bg-primary` is hardcoded on a
child that no prop reaches, so fill colour is *not* directly configurable.

The maintainer's constraint, given in conversation on 2026-08-25, was that the differentiation must
not require "custom hijinx". Height satisfies that literally; colour does not. Height also satisfies
FR-013's requirement that the distinction survive dark mode and any future theme, which a
colour-based distinction would not.

**Alternatives considered and rejected by the maintainer**:

- `opacity-40` on the Root. One stock class, no child selector, but it fades the track as well as
  the fill.
- `[&>[data-slot=progress-indicator]]:bg-muted-foreground/40`. Reaches the fill only, via the
  `data-slot` attribute the component puts there for the purpose. Rejected as hijinx.
- Adding a `cva` variant prop to the vendored file. Rejected because it diverges the vendored
  component from `shadcn view progress` output, making future updates a manual merge.

---

## Decision 3 — `value` is a percentage, and `max` must never be passed

**Decision**: pass `value={done / total * 100}` and **do not** pass `max`.

**Verified empirically.** A throwaway test file rendered the primitive with both shapes and dumped
the DOM (test deleted after the run):

| Props | Rendered indicator transform | Correct? |
|---|---|---|
| `value={40}` | `translateX(-60%)` | yes — 40% filled |
| `value={2} max={5}` | `translateX(-98%)` | **no** — should be `-60%` |

The component's transform is hardcoded as `100 - (value || 0)`, so it treats `value` as a
percentage regardless of what `max` says. Passing the natural `value={2} max={5}` produces a bar
that is 2% full while announcing "2 of 5". This is a real trap and the reason it is written down.

**Consequence**: because `max` stays at its default of 100, Radix emits `aria-valuenow="40"` — a
percentage. FR-024 requires a card count. That is what Decision 4 exists to solve.

---

## Decision 4 — The announced count comes from `aria-valuetext`

**Decision**: give each bar an `aria-label` naming it and an `aria-valuetext` carrying the exact
card count. The percentage stays in `value` where the fill needs it; the count goes in
`aria-valuetext` where assistive technology needs it.

**Verified empirically** in the same throwaway run: `aria-valuetext` passes straight through
`{...props}` onto the Root and appears in the DOM alongside `aria-valuenow`, and
`screen.getByRole('progressbar', { name: 'Words got right' })` resolves against `aria-label`. Both
were confirmed, not assumed.

Per ARIA, `aria-valuetext` is announced **in place of** `aria-valuenow`, so the percentage is never
read aloud. Copy:

| Bar | `aria-label` | `aria-valuetext` |
|---|---|---|
| Run | `Cards got right` | `{got} of {rungSize} cards` |
| Cycle | `Cards done in this round` | `{position} of {cycleSize} cards` |

"Round" rather than "cycle" in the cycle bar's name, because "round" is the word the removed
sentence used and the word an adult will already have read on this screen.

**Alternatives considered**:

- **An `sr-only` span next to each bar.** Rejected: it produces a second announcement per bar,
  duplicating what the progressbar role already reports.
- **Round `value` to an integer so `aria-valuenow` reads tidily.** Rejected on two grounds. It is
  unnecessary once `aria-valuetext` is present, and rounding introduces a way for the run bar to
  read 100 before the run completes — `(n-1)/n` rounds to 100 once `n ≥ 200`. That contradicts
  FR-004 for zero gain. Unrounded, `n/n` is exactly `1` in IEEE-754 for every `n`, so full is
  reached exactly at completion and never before.

---

## Decision 5 — Reduced motion is deliberately not handled

**Decision**: ship the vendored `progress.tsx` **byte-identical to `npx shadcn view progress`**. No
`motion-safe:` token, no `motion-reduce:` variant, no call-site override. The bars animate for
everyone.

**Rationale**: the maintainer's call on 2026-08-25, taken after the trade-off was laid out. Three
things drove it.

The motion is trivial. The only animation this feature adds is a 12px-tall bar sliding for
Tailwind's default `--default-transition-duration` of 150ms (verified at
`node_modules/tailwindcss/theme.css:492`). `prefers-reduced-motion` exists for movement that can
make people physically unwell — parallax, full-screen transitions, large-area motion. A hairline
bar is not in that category.

The fix is not free. The transition lives on `ProgressPrimitive.Indicator`, which `className` cannot
reach (the same wall as Decision 2). Honouring the preference means either editing the vendored
component or writing the child-selector form the maintainer had already rejected. Both were on the
table and both were declined.

Leaving the file untouched has its own value. `src/components/ui/progress.tsx` now matches
`npx shadcn view progress` exactly, so a future `shadcn add progress` is a clean overwrite with no
manual merge and nothing to remember. This feature touches zero vendored code.

**Alternatives considered**:

- `motion-safe:transition-all` in the vendored file. One token, and the repo has the precedent at
  `src/components/PronounceButton.tsx:128` (`motion-safe:animate-pulse`). **Rejected by the
  maintainer**: the divergence from upstream costs more than the motion is worth.
- `motion-reduce:[&>[data-slot=progress-indicator]]:transition-none` at both call sites. Verified to
  compile correctly to `@media (prefers-reduced-motion: reduce) { … > [data-slot=progress-indicator]
  { transition-property: none } }`. **Rejected**: it is the child-selector hijinx ruled out in
  Decision 2, and it would appear twice.

> **Note for a future reviewer**: the inconsistency with `PronounceButton.tsx` is known and
> accepted. That control's pulse is a repeating animation on an icon the learner is looking at; this
> is a one-shot 150ms slide on a 2px bar at the edge of the screen. If this feature's motion ever
> grows — a longer duration, a larger element, anything repeating — this decision should be revisited
> rather than inherited.

## Decision 6 — Fixed positioning, and the padding that keeps content clear

**Decision**: a `fixed inset-x-0 top-0 z-10` wrapper whose inner element is
`mx-auto w-full max-w-xl px-6`, holding the two bars in a `flex flex-col gap-1`. `<main>`'s `p-6`
becomes `px-6 pb-6 pt-9`.

**Rationale**: FR-015 wants the pair pinned to the viewport edge; FR-016 wants it capped and centred
rather than spanning a wide display. `fixed inset-x-0` gives the first, and an inner `mx-auto
max-w-xl px-6` gives the second — matching `<main>`'s own `max-w-xl` and `p-6` exactly, so the bars
line up with the card's edges rather than approximately near them.

The padding change satisfies FR-017. `<main>` is `min-h-svh` with `justify-center`, so on a tall
viewport the centred content never reaches the top and nothing overlaps. On a short viewport — a
phone in landscape — the content exceeds the viewport and its top would sit under the bars. The
pair occupies 12px (`h-1.5` + `gap-1` + `h-0.5` = 6 + 4 + 2), so `pt-9` restores the original 24px
of breathing room above the heading and adds the 12px the bars now take.

Written as `px-6 pb-6 pt-9` rather than `p-6 pt-9`: `<main>`'s className is a plain string, not run
through `cn()`, so `tailwind-merge` is not there to resolve the conflict and the outcome would
depend on Tailwind's utility sort order. Being explicit removes the question.

**Rendered from a fragment beside `<main>`, not inside it.** `RunLoop` returns
`<><RunProgress …/><main>…</main></>`. A `fixed` child inside `<main>` is out of flow and so would
not consume one of its `gap-8` gaps, but placing it outside removes any need to reason about that
at all — the same concern 003's research recorded about keeping that gap count stable. Being first
in the DOM also satisfies FR-025's reading order for free.

**No opaque background band.** Considered adding `bg-background` to the inner wrapper so content
scrolling beneath cannot show through the 4px gap between the bars. Rejected: an opaque 12px band
is materially less subtle than two hairlines, which is the whole point of the feature, and the run
screen only scrolls on viewports short enough to be rare. Revisit if it reads badly in UAT.

---

## Decision 7 — Let the cycle bar slide back to empty

**Decision**: change nothing. The shipped `transition-all` animates the cycle bar from its last
value down to 0 when a new cycle opens.

**Rationale**: chosen by the maintainer. It is a free, wordless signal that a new pass has begun,
and it costs no code at all. It runs for every user, including one asking for reduced motion — see
Decision 5 for why that is deliberate.

**Worth knowing**: mid-run the cycle bar never reads full. `position` counts cards *marked*, so on
the last card of a 5-card cycle it reads 4 of 5, or 80%. It reaches 100% only at completion, when
`position === queue.length`. This is FR-005 behaving as written, not an off-by-one, and it is why
FR-020's "both read full on the complete screen" holds.

---

## Decision 8 — No division-by-zero guard

**Decision**: divide by `rung.cardIds.length` and `state.queue.length` with no defensive check.

**Rationale**: both are guaranteed non-zero upstream, and the guarantee is already tested.
`src/decks/validate.ts` rule **V8** rejects any deck with an empty `rung.cardIds`, with a comment
naming the reason: "An empty rung starts a run whose queue is empty while status is 'running', which
invariant I5 forbids." A repeat cycle only ever opens from a non-empty `failedThisCycle`, per
`src/run/reducer.ts`. So `NaN` is unreachable, and a guard here would be dead code asserting
something the validator already owns.

---

## Decision 9 — No selectors. The two derivations are built at the call site

**Decision**: delete `remainingInCycle` from `src/run/selectors.ts` and add **nothing** in its place.
`Run.tsx` builds both pairs inline where it renders the bars:

```tsx
<RunProgress
  run={{ done: state.passedThisRun.length, total: rung.cardIds.length }}
  cycle={{ done: state.position, total: state.queue.length }}
/>
```

The pair's shape lives in `RunProgress`'s own props signature. Nothing is exported.

**Rationale**: an earlier draft of this decision added `CardCount`, `cardsGotThisRun`, and
`cardsDoneThisCycle`, justified on the grounds that Principle IV requires a test for pure functions
transforming user data, and that putting them in `selectors.ts` was what let SC-003 and SC-004 be
asserted arithmetically without rendering.

Checking that claim during `/speckit-analyze` found it false. **The invariant is already tested, and
was before this feature existed.** `src/run/reducer.test.ts:268`, "I3: status is complete only once
every rung card has passed":

```ts
for (const outcome of pass(4)) {
  state = mark(state, outcome);
  expect(isComplete(state)).toBe(false);
  expect(state.passedThisRun.length).toBeLessThan(FIVE_CARDS.length);
}
state = mark(state, 'got-it');
expect(isComplete(state)).toBe(true);
expect(state.passedThisRun).toHaveLength(FIVE_CARDS.length);
```

That is `done === total` if and only if the run is complete, both directions, against raw state.
`reducer.test.ts:293` (I6) covers the mechanism behind it — `new Set(passedThisRun).size ===
passedThisRun.length`, so no card is ever counted twice. `:246` (I2) and `:281` (I5) cover the cycle
boundary that resets the second pair.

With the tests redundant, the functions had nothing left to justify them: two struct literals, one
call site each, transforming nothing. Principle IV's rule reaches "pure functions transforming user
data", and `{ done: state.position, total: state.queue.length }` transforms nothing. Principle VI is
explicit that "abstraction is earned by a second real use case, not predicted from the first", and
there is no second call site.

The inline version is also simply better to read. Four lines put both numerators next to both
denominators, where the difference between the two indicators — the thing this whole feature is
about — is visible at a glance. Two imported function names hide it.

**What still happens to `selectors.ts`**: `remainingInCycle` is deleted, because nothing renders the
sentence any more (Principle V — remove what nothing uses). `currentCard` and `isComplete` stay
untouched. The existing test at `reducer.test.ts:466` is trimmed rather than rewritten: its
`remainingInCycle` assertions go and its `currentCard` assertions remain.

**Alternatives considered**:

- **Keep the two selectors, drop only their tests.** Rejected: an exported abstraction whose sole
  justification was testability, with the tests removed, is pure overhead.
- **Keep them and write the tests anyway.** Rejected: the tests would assert that a getter returns
  the field it reads, and would re-prove I3 and I6 through one extra layer of indirection. That is
  the definition of a change-detector test.
- **Put the derivations in `RunProgress` itself**, passing `state` and `rung`. Rejected: it would
  couple a presentational component to `RunState` and `RungConfig`, which nothing else in
  `src/components/` does.

## Decision 10 — Migrating the 17 existing assertions

**Decision**: replace every `screen.getByText('N cards left in this round')` in
`src/routes/Run.test.tsx` with a read of the two bars' `aria-valuetext`, via two local helpers.

**Context**: 17 assertions across `src/routes/Run.test.tsx` use that sentence, and almost none of
them are testing the counter. They use it as a cheap proxy for "the run advanced" inside tests about
resuming, restarting, storage, and the ladder. Deleting the sentence breaks all of them.

The mapping is mechanical — the old sentence counted down from the cycle size while the new bar
counts up — so `'5 cards left in this round'` becomes `'0 of 5 cards'` on the cycle bar. The
replacement is strictly more informative, because each site can now also assert the run bar, which
the sentence never exposed.

Helpers read through the accessible surface only, which keeps Principle IV satisfied — role and
accessible name, no class names, no `data-state`, no internals:

```ts
function progressOf(name: string): string | null {
  return screen.getByRole('progressbar', { name }).getAttribute('aria-valuetext');
}
```

**Not asserted anywhere**: `aria-valuenow`. It is an unrounded percentage, so a 3-card rung yields
`33.33333333333333`. Binding tests to that would be asserting float formatting rather than
behaviour. `aria-valuetext` is exact and is what a user is actually told, which is also what makes
these assertions a direct test of FR-024.

---

## Decision 11 — `RunProgress.tsx` replaces `CycleCounter.tsx`

**Decision**: delete `src/components/CycleCounter.tsx`, add `src/components/RunProgress.tsx`.

**Rationale**: it is the same slot in the same architecture — a small presentational component that
decides nothing, alongside `CardFace`, `OutcomeButtons`, and `PronounceButton`, with `Run.tsx` left
as the composer. Net component count is unchanged. It takes two `{ done, total }` pairs, built inline
by its one caller (Decision 9), owns the percentage rule from Decision 3, and holds no state. The
pair's type is declared locally and not exported — there is nothing else to share it with.

No `RunProgress.test.tsx`. It is covered through `src/routes/Run.test.tsx`, which is how
`CycleCounter`, `CardFace`, and `OutcomeButtons` are all covered today.

**Rendered inside `RunLoop`, not `Run`.** The two "Run not found" screens live in `Run` and have no
run state, so they get no bars — FR-019 falls out of where the component is placed rather than
needing a condition. FR-020 likewise: the bars sit outside the `complete ? … : …` branch, so they
survive onto the run-complete screen reading full, with no extra code.
