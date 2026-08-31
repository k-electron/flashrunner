# Phase 0 Research: Deck screen level ladder

No NEEDS CLARIFICATION items were carried in from the spec. What follows is the set
of implementation decisions this plan commits to, with what was rejected and why.
Everything here was checked against the code as it stands on `main` (ea96536).

---

## D1 — Level names are authored data, edited in place

**Decision**: Change the 19 `label` strings in `src/decks/dolch-prek-5.ts` (8) and
`src/decks/dolch-k-5.ts` (11).

- Pre-K: `r1`–`r7` → `Level 1`…`Level 7`; `r8` → `Full deck`.
- Kindergarten, **after the D8 collapse removes `r10`**: `r1`–`r9` → `Level 1`…`Level 9`;
  `r11` → `Full deck`.

Also update the example in `src/decks/types.ts:17` (`label: string; // "5 words"`), which
would otherwise be the only place in the repo still teaching the old convention.

**Rationale**: `RungConfig.label` is already the single authored source for a level's
display name, and all three screens read it —
`src/routes/DeckLadder.tsx:51,57`, `src/routes/DeckList.tsx:52,57`,
`src/routes/Run.tsx:217`. Editing the data changes all three with no new code and no
new concept. `label` is display-only: `rung.id` is what storage refers to, so renaming
cannot touch anyone's progress (FR-004).

**Alternatives considered**:

- *Derive the name from the level's position in the UI* (`index === last ? 'Full deck'
  : \`Level ${index + 1}\``). Rejected: `Run.tsx` and `DeckList.tsx` hold a `RungConfig`,
  not its index, so this needs a lookup helper plus three call-site changes to replace
  a field that already exists and already works. More code, more indirection, and it
  moves a display string out of the authored config that owns every other display
  string.
- *Keep the count and append the level* (`Level 3 · 15 words`). Rejected: the request
  is "called levels rather than 'x words'", and item 3 says the last one should be
  "just" called Full deck.

**Verified**: `src/decks/validate.ts` reads `id` and `cardIds` only — no validation
rule inspects `label`, so V1–V8 are unaffected by the rename.

---

## D2 — The unlock rule becomes "every level below is completed"

**Decision**: In `src/decks/ladder.ts`, `isStartable` changes from

```
index === 0 || completedRungIds.includes(deck.rungs[index - 1].id)
```

to a check that *every* level below `index` is in `completedRungIds`. The range guard
stays. `[].every(...)` is `true`, so index 0 needs no special case — the "smallest level
is always startable" clause falls out of the expression rather than being written twice.

**Rationale**: This is the entirety of FR-006 in one expression, in the one module that
already owns the decision. `DeckLadder.tsx` derives nothing and needs no change for
this. For a ladder climbed in order the new rule and the old one agree on every input;
they differ only when a level was completed with earlier levels unfinished, which is
exactly the URL-skip case FR-006 is about.

**Consequence to record**: `specs/001-deck-runs` FR-016 ("completed rungs stay startable
forever") no longer holds unconditionally. Its guarantee survives for anything earned in
order. The doc comments in `src/decks/ladder.ts` currently assert the old reasoning
verbatim ("Completed rungs therefore stay startable forever (FR-016) — completing a rung
required its predecessor") and must be rewritten in the same commit; leaving them is a
comment that contradicts the function beneath it.

**Alternatives considered**:

- *Unlock everything up to one above the highest completed level.* Gap-free, but hands
  a learner four levels of progress for one URL edit. Rejected by the maintainer during
  clarification.
- *Enforce it in `Run.tsx` by redirecting an out-of-order URL to the deck screen.*
  Rejected outright: FR-008 keeps URL entry working, and the maintainer was explicit
  that this is about legibility for an early reader, not about stopping anyone.

**Not affected**: `highestCompletedRung`, `isMastered`, and `nextRung` all read
`completedRungIds` directly and are correct as written under either rule. `DeckList.tsx`
uses only those three, so the deck list needs no change for D2.

---

## D3 — Inverted order reverses the DOM, not just the paint

**Decision**: Map over `deck.rungs` as today — keeping the true ladder index that
`isStartable` needs — and reverse the resulting array of elements before rendering.

**Rationale**: DOM order is what determines tab order and what a screen reader walks.
Reversing the elements keeps reading order, tab order, and visual order identical.
The index passed to `isStartable` comes from `map`, so it stays the true ladder index
regardless of render order — this is the one place the change could silently invert the
unlock rule, and taking the index from `map` is what prevents it.

**Alternatives considered**:

- *`flex-col-reverse` on the `<ul>`.* CSS-only and shorter, and normally the right
  instinct (use the platform). Rejected here: it paints bottom-to-top while the DOM
  stays top-to-bottom, so tab order would run Level 1 → Full deck against a screen
  reading Full deck → Level 1. A silent accessibility defect is not a saving.
- *Reversing `deck.rungs` in the config or the registry.* Rejected: `deck.rungs` is
  documented as ordered smallest → largest and is read by `isStartable`, `isMastered`,
  `nextRung`, and every V6/V7 validation rule. Inverting the model to change a view is
  the largest possible blast radius for the smallest possible requirement.

---

## D4 — The single row is a deletion, not a rewrite

**Decision**: Remove the `Resume` link and the `Unfinished run` caption from
`UnfinishedRun` in `src/routes/DeckLadder.tsx`. What remains — the `Start over` button —
moves into the level's own row, to the left of the level control. The level control
takes `flex-1` so it is the wider of the two (FR-010).

**Rationale, and the fact that makes this cheap**: the `Resume` link and the level
button already point at the *same* URL — `/deck/${deck.id}/rung/${rungId}` — and
`Run.tsx`'s `resume()` reads the stored run on entry and continues it when
`run.rungId` matches. So "the level button also resumes" (FR-012) is already true today
and needs no new code. The second row was pure duplication.

`startOver()` keeps its current body verbatim: read the record, write it back with
`run: undefined`, navigate. That preserves FR-013 and the quota-message reasoning
already documented in its doc comment.

**Alternatives considered**:

- *Keep "Resume" as the label of the wider button.* Rejected: the request says the
  wider button is "the entry point to the rung as it is today", i.e. it still reads
  `Level 3`. It would also mean the same level has two different names depending on
  whether a run is in progress.
- *Keep the "Unfinished run" caption above the row.* Rejected by the maintainer during
  clarification — it is what makes the level take two rows in the first place.

**Edge case that falls out (FR-019)**: a level can hold an unfinished run *and* be
locked, if the run was started from a URL. `Start over` is rendered only when the run
belongs to this level **and** the level is startable, so a locked level never offers a
control the screen has just said is unavailable.

---

## D5 — The completion mark uses the existing icon, hidden from the accessible name

**Decision**: Render `<CircleCheck className="size-5" aria-hidden="true" />` inside the
level's own control, immediately left of the level name.

The control's content stays centre-justified — `Button`'s base class already sets
`justify-center`, so nothing is needed to keep it. That is what puts the mark near the
middle of a wide row rather than hard against the `Start over` button beside it, and it
is why "left of the name" costs nothing on a resumable level's row.

**Rationale**: `CircleCheck` from `lucide-react` is already the "Got it" icon
(`src/components/OutcomeButtons.tsx:36`), so success is marked the same way on both
screens and no dependency is added. `aria-hidden` is what keeps the accessible name
exactly the level name (FR-017) — the same reason the current code puts the "Completed"
text *outside* the control.

**Two mechanics worth knowing before writing it**:

- The base `Button` class forces an unsized descendant svg to `size-4`
  (`[&_svg:not([class*='size-'])]:size-4` in `src/components/ui/button.tsx`). An
  explicit `size-*` is required or the icon silently shrinks — the same reason
  `OutcomeButtons` writes `size-12`.
- The startable branch is `<Button asChild><Link>…</Link></Button>`, which uses Radix
  `Slot`. `Slot` requires a single child element, and that child is the `Link` — the
  icon and the text go *inside* the `Link`, not beside it. Putting the icon as a second
  child of `Button` is a runtime error.

**Because there are two branches** (a `Link` when startable, a disabled `Button` when
not) and both must carry the mark (FR-007), the mark and the name should be built once
and used by both, so the branches cannot drift apart.

**Alternatives considered**: a `✓` text character (would land in the accessible name
and read as part of the level name); a `title`/`aria-label` on the control (same
problem, and FR-017 forbids it).

---

## D6 — Nothing persisted changes

**Decision**: No `schemaVersion` bump, no migration, no new key, no change to
`src/storage/`.

**Rationale**: The feature renames a display string, reorders a render, changes a
derivation, and moves two controls. `completedRungIds` and the persisted run keep
their exact shape and meaning. "Ever completed" (FR-015/FR-016) is already exactly
`completedRungIds.includes(rung.id)`, which `Run.tsx`'s `persist()` appends to once and
never removes — including on a replay, which appends nothing because the id is already
there. The permanence the spec asks for is a property the storage already has.

---

## D7 — How the new behaviour gets tested without testing internals

**Decision**: Split coverage the way the code is split.

- **`src/decks/ladder.test.ts`** takes the unlock rule as plain function calls. The
  existing four-rung fixture is already the right shape. Two changes: the
  "keeps completed rungs startable forever" case needs its premise restated (it passes
  `['r1','r2','r3','r4']`, so it still passes under the new rule and now demonstrates
  something slightly different), and a new case covers the out-of-order input the old
  rule got wrong — e.g. `isStartable(deck, ['r3'], 3)` must be `false` while
  `isStartable(deck, ['r3'], 1)` must be `true`.
- **`src/routes/DeckLadder.test.tsx`** covers what a learner sees, by role and visible
  text. The existing `expectStartable`/`expectLocked` helpers already express
  startability as "is it a link" and survive unchanged.

**The one assertion that needs care**: FR-005 is about order, and order is exactly the
thing that is easy to assert against internals. `getAllByRole('listitem')` returns items
in DOM order, so reading the accessible names out of that array and comparing the
sequence asserts what the learner reads, with no class names and no snapshot. That is
also the assertion that fails if someone later "simplifies" D3 into `flex-col-reverse`,
which is the outcome D3 exists to prevent.

**One assertion is added rather than updated**: FR-008 ("URL entry keeps working") is a negative
requirement, and the plausible way it regresses is someone later reading FR-006 as a gate and adding
a redirect. Nothing in the existing suite would catch that, so `src/routes/Run.test.tsx` gains one
assertion that a run entered directly at a level the deck screen would not offer still plays. It is
the only file this feature touches outside the deck screen and the deck data.

**Tests that must be updated, not just re-run** — these assert strings that this
feature deliberately changes, so they fail loudly rather than silently:
`DeckLadder.test.tsx` (every `'5 words'`-style label, `'Completed'`, `'Unfinished run'`,
and the `link name: 'Resume'` assertions), and `DeckList.test.tsx:65,72`. Fixture labels
in `ladder.test.ts`, `validate.test.ts`, and `deckRecord.test.ts` belong to synthetic
decks and carry no meaning — leave them alone.


---

## D8 — The remainder collapse is an edit to the authored deck, not runtime logic

**Decision**: In `src/decks/dolch-k-5.ts`, delete the `r10` rung entry (the 50-word
level). `r11` — which already lists all 52 cards — becomes the highest level and is
labelled `Full deck`. The deck goes from 11 levels to 10.

`src/decks/dolch-prek-5.ts` is untouched: its ladder ends 35 → 40, a full step of 5,
with no remainder.

**Rationale**: FR-020 is a rule about how decks are authored, and decks are authored
data that ships with the app. There is nothing to compute at runtime, so nothing is
computed — no collapse function, no config-time transform, no new module. A future deck
satisfies the rule by being written to satisfy it.

**Which of the two ids survives, and why it matters**: keep `r11`, drop `r10`.

- `r11` already holds every card in the deck, so validation rule V7 ("the last rung's
  cardIds equals the full set of card ids") passes with no edit to its `cardIds`. V6
  also still holds: `r9` (45 cards) ⊆ `r11` (52 cards).
- Anyone who has **mastered** this deck has `r11` in `completedRungIds`. Keeping `r11`
  keeps their mastery (FR-021). The reverse choice — keep `r10`, widen it to 52 cards —
  would silently un-master every learner who had finished the deck, and would also have
  meant editing a `cardIds` array.
- Anyone who had completed `r10` loses only that id's meaning. Under FR-006 they need
  `r1`–`r9` complete to reach `Full deck`, which they have if they climbed in order.
  So a learner who was one level from the top is still exactly one level from the top.

**Verified in the code, not assumed**:

- `readRungIds` in `src/storage/deckRecord.ts` keeps unrecognized ids rather than
  discarding the array, and `isStartable`/`isMastered`/`highestCompletedRung` all match
  ids against `deck.rungs`, so a stored `r10` matches nothing and contributes nothing.
- `readRun` in `src/storage/deckRecord.ts:122` drops a run whose `rungId` matches no
  rung — `completedRungIds` survives untouched. So an unfinished run on `r10` is
  handled by machinery that already exists and already has tests.
- No test hardcodes `r10`, `r11`, or a count of 11. The one stale reference is the
  comment at `src/routes/DeckList.test.tsx:16` ("Kindergarten (r1–r11)").

**No migration, no `schemaVersion` bump.** Nothing stored changes shape. This is the
"revised deck configuration" case `specs/001-deck-runs` FR-029/FR-040/FR-041 already
specify, not a new one.

**One comment that must be corrected in the same commit**: the header of
`src/decks/dolch-k-5.ts` says the rungs are "transcribed verbatim" from
`specs/001-deck-runs/research.md §4`. After the collapse they deliberately are not.
The comment must say so and say why, or it becomes a false claim about the data
beneath it.

**Nothing enforces FR-020 for a deck not yet written, and that is the maintainer's call**
(2026-08-30). The rule is applied to the two decks that ship today — `dolch-k-5` by the
collapse above, `dolch-prek-5` by already ending on a full step of 5. A third deck
authored with a remainder top level would ship without complaint: `validate.ts` has no
rule for step size, and none is added here.

That gap closes in a future release, as part of a deck intake process. Enforcing it now
would mean writing the check before knowing what intake looks like, which is the wrong
order — see Principle VI.

**Alternatives considered**:

- *Detect and collapse at runtime.* A function reading step sizes off `cardIds` lengths
  to decide what to merge, on every render, to produce a result that is knowable when
  the deck is written. Rejected: it is speculative machinery for a rule that authoring
  enforces for free, and it would make the ladder a derived thing that validation rules
  V6/V7 no longer describe.
- *Keep `r10` and widen it to all 52 cards.* Rejected above — it breaks mastery for
  anyone who finished the deck.
- *Leave `dolch-k-5` alone and apply the rule only to future decks.* Rejected: the
  maintainer said "for all decks", and the deck that motivated the rule is the one
  shipping today.
