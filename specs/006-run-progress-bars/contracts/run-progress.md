# Contract: Run Progress Indicators

**Feature**: `006-run-progress-bars` | **Spec**: [../spec.md](../spec.md)

The run screen's two indicators are a UI contract in two directions. Outward, they are what a
screen reader user is told — the only channel through which this feature carries any words at all,
since FR-011 forbids visible text. Inward, they are the surface `src/routes/Run.test.tsx` binds to,
replacing the sentence 17 assertions used to read.

Everything below was confirmed against rendered DOM in this repo, not inferred from documentation.

---

## 1. The accessible surface

Each indicator renders one element with `role="progressbar"`, carrying:

| Attribute | Run bar | Cycle bar | Source |
|---|---|---|---|
| `role` | `progressbar` | `progressbar` | Radix, automatic |
| `aria-label` | `Cards got right` | `Cards done in this round` | supplied |
| `aria-valuetext` | `{done} of {total} cards` | `{done} of {total} cards` | supplied |
| `aria-valuenow` | the percentage | the percentage | Radix, from `value` |
| `aria-valuemin` | `0` | `0` | Radix, automatic |
| `aria-valuemax` | `100` | `100` | Radix, default |

Per ARIA, `aria-valuetext` is announced **instead of** `aria-valuenow`, so the percentage is never
read aloud. That is the whole reason it is set.

### Naming

The two accessible names are load-bearing, not decoration. They are how a screen reader user tells
the bars apart (FR-023) and how every test selects one (`getByRole('progressbar', { name })`). They
must stay distinct and stable.

"Round" rather than "cycle" in the cycle bar's name: "round" is the word the removed sentence used
("N cards left in this round"), so an adult who has used the app before meets a word they already
know. "Cycle" is internal vocabulary from `001-deck-runs` and appears nowhere in user-facing copy.

### Grammar of `aria-valuetext`

`{done} of {total} cards` — always plural "cards", including `1 of 5 cards` and `0 of 1 cards`. The
deleted sentence special-cased the singular ("1 card left in this round"); this does not, because
`aria-valuetext` is read as a value rather than as prose, and the special case only existed to keep
a visible sentence grammatical.

---

## 2. What the numbers mean

```
Run bar:    done = cards marked "Got it" so far this run     total = the rung's card count
Cycle bar:  done = cards marked so far this cycle            total = this cycle's card count
```

| Property | Run bar | Cycle bar |
|---|---|---|
| Monotonic within a run | **yes** — never decreases (FR-003) | no — resets to 0 each cycle (FR-006) |
| `total` changes during a run | no — fixed for the whole run | **yes** — one value per cycle (FR-007) |
| Advances on "Not yet" | no | yes |
| Reads full mid-run | **never** (FR-004) | never — see below |
| Reads full on completion | yes (FR-020) | yes (FR-020) |

### Two invariants worth stating

**`done === total` on the run bar if and only if the run is complete.** Forward: completion requires
every card to have been got. Backward: a card cannot be got twice, because a got card never returns
to a queue. This is what makes the bar reaching its end a truthful statement that the run is over,
and it is asserted arithmetically in `src/run/reducer.test.ts`.

**The cycle bar does not read full while a card is on screen.** `done` counts cards *marked*, so the
last card of a 5-card cycle shows `4 of 5 cards`. It reaches `5 of 5` only at completion, when
`position === queue.length` and no card is showing. This is FR-005 as written, not an off-by-one.

### Why `total` is never zero

No guard is needed and none is written. `src/decks/validate.ts` rule **V8** rejects any deck
containing an empty `rung.cardIds`, and a repeat cycle only ever opens from a non-empty
`failedThisCycle` in `src/run/reducer.ts`. A zero denominator is unreachable by construction.

---

## 3. The percentage rule

> **`value` is a percentage. `max` must never be passed.**

The vendored component positions the fill with a hardcoded `translateX(-${100 - (value || 0)}%)`,
so it treats `value` as a percentage whatever `max` says. Verified in this repo:

| Props passed | Rendered transform | Correct |
|---|---|---|
| `value={40}` | `translateX(-60%)` | yes |
| `value={2} max={5}` | `translateX(-98%)` | **no** — should be `-60%` |

Passing the natural-looking `value={2} max={5}` yields a bar 2% full that announces "2 of 5". Any
future edit here must keep `value={done / total * 100}` and must not add `max`.

`value` is **not rounded**. Rounding buys nothing once `aria-valuetext` carries the exact count, and
it would let `(n-1)/n` reach 100 for `n ≥ 200`, contradicting FR-004. Unrounded, `n/n` is exactly
`1` in IEEE-754 for every `n`, so full happens exactly at completion. The cost is that
`aria-valuenow` can read `33.33333333333333`, which nothing announces and nothing asserts.

---

## 4. What tests may bind to

Permitted, per constitution Principle IV:

- `getByRole('progressbar', { name })` — role and accessible name.
- The value of `aria-valuetext` on the element that query returns.

**Forbidden**, and the reasons:

| Do not bind to | Why |
|---|---|
| `aria-valuenow` | An unrounded percentage. Asserting it tests float formatting, not behaviour. |
| `data-state`, `data-value`, `data-max` | Radix internals. Principle IV forbids internals. |
| `data-slot="progress"` / `"progress-indicator"` | Internals of the vendored component. |
| Class names (`h-1.5`, `h-0.5`, `bg-primary`) | Principle IV forbids class names outright. |
| The indicator's inline `transform` | Implementation of the fill, and untestable in jsdom anyway. |
| Element order in the DOM | Use the accessible name; order is not the contract. |

The single reader every test should go through:

```ts
function progressOf(name: string): string | null {
  return screen.getByRole('progressbar', { name }).getAttribute('aria-valuetext');
}
```

### The migration this replaces

Old assertions counted **down** from the cycle size; the cycle bar counts **up**. The mapping is
mechanical:

| Deleted assertion | Replacement |
|---|---|
| `getByText('5 cards left in this round')` | `progressOf('Cards done in this round') === '0 of 5 cards'` |
| `getByText('4 cards left in this round')` | `progressOf('Cards done in this round') === '1 of 5 cards'` |
| `getByText('1 card left in this round')` | `progressOf('Cards done in this round') === '0 of 1 cards'` |

Each site may now also assert the run bar, which the sentence never exposed. Where a test's real
subject is "the run advanced" rather than the counter, asserting both bars is strictly better
evidence than asserting the old sentence was.

---

## 5. What is not part of this contract

- **Position, size, colour, and animation.** FR-012 through FR-021 govern them — including the
  decision *not* to vary animation with the device's reduced-motion preference — and
  [../research.md](../research.md) records the decisions, but none of it is assertable in jsdom.
  It is verified by eye — see [../quickstart.md](../quickstart.md) § Manual checks.
- **Any visible text.** FR-011 forbids it. A test asserting visible progress text should fail.
- **The run mechanic.** Untouched by this feature. `src/run/reducer.ts` and its tests are the
  authority on cycles, shuffling, and completion; these bars only report what it already decided.
