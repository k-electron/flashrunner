---

description: "Task list for 007-heard-word-emphasis"
---

# Tasks: Heard-Word Button Emphasis

**Input**: Design documents from `/specs/007-heard-word-emphasis/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[contracts/outcome-emphasis.md](./contracts/outcome-emphasis.md), [quickstart.md](./quickstart.md)

**Tests**: Included — five new assertions, all inside the existing `window.speechSynthesis`-stubbing
`describe` block in `src/routes/Run.test.tsx`. Two of them are written *before* the line they guard,
deliberately (see [Why this order](#why-this-order)). No test file is created.

**Organization**: Grouped by user story. Both stories are P1 and both are small; the split is real
but the second story is one line of source plus its two assertions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`, `[US2]` — maps to the user stories in [spec.md](./spec.md)
- Paths are repository-relative. Single-project SPA: everything lives under `src/`.

---

## Why this order

**There is no Setup phase and no Foundational phase.** Nothing is installed, no component is
vendored, no schema changes, and nothing blocks either story. Inventing a phase to say so would be
process for its own sake.

**US1 is built without the reset, on purpose.** Phase 1 ends with the swap working and a green tree,
but the emphasis leaking to the next card — the exact bug FR-007 forbids. Phase 2 then writes the
two reset assertions, **confirms they fail against Phase 1's code**, and adds the one line that
fixes them. That sequence costs nothing and buys the only thing worth buying here: proof that the
reset tests have teeth. Written the other way round, the reset line and its tests land together and
nobody ever sees the tests fail, which is how a green assertion that checks nothing gets shipped.

This is a sequence within one branch, not stacked PRs. It is a four-file change; a reviewer sees the
end state.

---

## Phase 1: User Story 1 — Hearing the word points the learner at "Not yet" (Priority: P1) 🎯 MVP

**Goal**: Pressing the speaker swaps which outcome the screen recommends, and presses nothing.

**Independent Test**: Open a run, press the speaker, confirm "Not yet" is now near-black and "Got it"
plain grey, the same word is still on the card, and both buttons still work. Do not mark anything —
the reset does not exist yet and marking will show the bug Phase 2 fixes.

- [X] T001 [P] [US1] Add the press signal to `src/components/PronounceButton.tsx`. One new required prop and one call, placed as the **first statement of `speak`, above the `if (speaking)` guard** — that placement is what makes FR-002 (a press that never makes a sound still counts) and FR-006 (a repeat press during speech is harmless) both fall out for free.

  ```tsx
  export function PronounceButton({ word, onHeard }: { word: string; onHeard: () => void }) {
  ```

  ```tsx
    function speak(): void {
      // The press is the signal, not the word finishing (FR-002). Above the guard
      // below, so a press during speech — which starts nothing — still reports.
      // The receiver sets an already-set flag, so repeating is free (FR-006).
      onHeard();
      // A press while the word is still being said does nothing at all: no second
      // utterance, and nothing held back to play afterwards (FR-007 of 005).
      if (speaking) {
        return;
      }
  ```

  Nothing else in this file changes: the `aria-label`, the `h-12` / `variant="outline"` / `col-start-2` treatment, the cancel-on-word-change effect, the availability guard and the pulse all stay exactly as they are.

- [X] T002 [P] [US1] Make the fills conditional in `src/components/OutcomeButtons.tsx`. Add the required `heard` prop, swap both `variant`s on it, and make the green classes conditional with `cn` (new import from `@/lib/utils`). The green must be **removed** in the heard state rather than overridden — `Button` composes `cn(buttonVariants({ variant, size, className }))`, so `className` wins over the variant, which is exactly why today's green works.

  ```tsx
  import { cn } from '@/lib/utils';
  ```

  ```tsx
  export function OutcomeButtons({
    onMark,
    heard,
  }: {
    onMark: (outcome: Outcome) => void;
    heard: boolean;
  }) {
  ```

  ```tsx
        <Button
          className={cn(
            'h-24 flex-1 flex-col gap-1 text-xl',
            !heard && 'bg-green-800 text-white hover:bg-green-900',
          )}
          variant={heard ? 'secondary' : 'default'}
          onClick={() => onMark('got-it')}
        >
  ```

  ```tsx
        <Button
          className="h-24 flex-1 flex-col gap-1 text-xl"
          variant={heard ? 'default' : 'secondary'}
          onClick={() => onMark('not-yet')}
        >
  ```

  Both icons, both labels, `h-24 flex-1`, the order and the accessible names are untouched (FR-003, FR-005). Add **no** `aria-pressed`, no live region, no `disabled` — the emphasis is offered to the eye only, and the file's existing comment about accessible names still has to hold.

- [X] T003 [US1] Wire the two in `src/routes/Run.tsx`, inside `RunLoop`. One `useState`, two props. **Do not add the reset yet** — that is T005/T006, and Phase 2 needs this state to be wrong first.

  ```tsx
    // Whether the learner asked to hear the word on the card in front of them.
    // Purely visual guidance, never persisted (FR-008), so it is component state
    // rather than a field on the run.
    const [heard, setHeard] = useState(false);
  ```

  ```tsx
                {card !== undefined && (
                  <PronounceButton word={card.front} onHeard={() => setHeard(true)} />
                )}
                <div className="col-span-2">
                  <OutcomeButtons
                    heard={heard}
                    onMark={(outcome) => apply({ type: 'mark', outcome })}
                  />
                </div>
  ```

  Nothing goes near `toPersistedRun`, `persist`, `resume`, or anything under `src/run/` or `src/storage/`.

- [X] T004 [US1] Add the first three assertions to `src/routes/Run.test.tsx`, inside the existing `describe` that defines `window.speechSynthesis` — outside it `PronounceButton` renders `null` and there is nothing to press. Reuse the file's existing `renderRun`, `shownCard` and `FIRST_RUN` / `FIRST_RUNG_CARDS` helpers; do not add new ones beyond a local reader for the attribute.

  The observable is `data-variant`, set by `src/components/ui/button.tsx:59`. Read as a pair it is unambiguous: green never accompanies `secondary`. Assert **no** class name and **no** colour — jsdom does not resolve Tailwind utilities, so a `toHaveStyle` check there would pass while checking nothing ([research.md § Decision 3](./research.md#decision-3-what-the-tests-can-honestly-assert)).

  ```tsx
  function emphasis(): { gotIt: string | null; notYet: string | null } {
    return {
      gotIt: screen.getByRole('button', { name: 'Got it' }).getAttribute('data-variant'),
      notYet: screen.getByRole('button', { name: 'Not yet' }).getAttribute('data-variant'),
    };
  }
  ```

  The three tests:
  1. **The swap (FR-001)** — before the press `{ gotIt: 'default', notYet: 'secondary' }`; after it `{ gotIt: 'secondary', notYet: 'default' }`.
  2. **Nothing is pressed (FR-003)** — after the press, `shownCard(FIRST_RUNG_CARDS)` returns the same word it did before, and both outcome buttons are still in the document and enabled.
  3. **Repeat presses are harmless (FR-006)** — press the speaker twice with no `speech.end()` between; the pair after the second press equals the pair after the first.

**Checkpoint**: `npm run lint && npm run typecheck && npm test && npm run build` is green. The swap
works and the emphasis leaks to the next card. That is expected here and is Phase 2's job.

---

## Phase 2: User Story 2 — The emphasis does not follow the learner to the next card (Priority: P1)

**Goal**: Every presentation of a card starts with green "Got it" / grey "Not yet".

**Independent Test**: Press the speaker, mark the card, and confirm the next card shows the default
pair. Then press the speaker and press "Start over", and confirm the same.

- [X] T005 [US2] Add the two reset assertions to `src/routes/Run.test.tsx`, in the same `describe` and using the same `emphasis()` reader from T004. **Run them before writing T006 and confirm both FAIL** (`npx vitest run src/routes/Run.test.tsx`). A pass here means the assertion is not testing what it claims and must be fixed before continuing.

  1. **Marking presents the next card fresh (FR-007)** — press the speaker, click "Not yet", then expect `{ gotIt: 'default', notYet: 'secondary' }`.
  2. **"Start over" presents its card fresh (FR-007)** — press the speaker, click "Start over", then expect the same pair.

  Use "Not yet" rather than "Got it" for the first one: the rung has five cards, so one mark cannot complete the run and unmount the outcomes either way, but marking "Not yet" also proves the reset does not depend on the outcome chosen.

- [X] T006 [US2] Add the reset to `apply` in `src/routes/Run.tsx` — one line, and the comment matters more than the line.

  ```tsx
    function apply(action: RunAction): void {
      // `nextState`, not `next`: `next` is already the next rung, just above.
      const nextState = transition(state, action);
      setState(nextState);
      setStorageFull(persist(deck, nextState));
      // Every presentation of a card begins either here or at this component's
      // mount, so clearing it here is the whole of FR-007 — marking, "Start over",
      // a resumed run, and a move to another rung (RunLoop is keyed by rung).
      // Deliberately not keyed on the word: a failed last card is re-queued and a
      // "Start over" can reshuffle onto the card already showing, so the same word
      // can be a genuinely new presentation. See research.md § Decision 1.
      setHeard(false);
    }
  ```

  Re-run T005's two tests and confirm they now pass.

**Checkpoint**: the full gate is green, all five new assertions pass, and every pre-existing
`getByRole('button', { name: 'Got it' | 'Not yet' })` query in the file still passes untouched — that
is the standing guard that no accessible name changed (FR-003).

---

## Phase 3: Polish & Verification

- [ ] T007 [P] Confirm the untouched-file guarantees the plan claims. All four must print nothing:

  ```bash
  git diff --stat package.json package-lock.json
  git diff --stat src/components/ui/
  git diff --stat src/index.css
  git diff --stat src/run/ src/storage/
  ```

  A diff in any of them means the design was departed from — no dependency is added, no button variant or token is added, and nothing persisted changes (plan.md Constitution Check, Principles II, V, VIII).

- [ ] T008 Run the browser checks in [quickstart.md](./quickstart.md) steps 1–6 against `npm run dev`, driving the page with Playwright from the scratchpad rather than handing the geometry back to the maintainer. Capture the run screen before and after the press. Two judgements that no test makes, and that are the actual deliverable:

  - Does the black "Not yet" match `bg-primary` as rendered on "Resume" (deck ladder) and "Next run" (run-complete)? They must be the same fill.
  - Does the grey "Got it" read as *plain*, or as *disabled*? `--secondary` is `oklch(0.97 0 0)`, nearly white, so this is the one visual risk in the feature. If it reads as disabled, stop and report it — the fix is a darker grey and that is the maintainer's call, not a silent substitution.

  Also confirm step 4's four reset paths by hand (including leave-and-resume, which no test covers) and step 6 (no `speechSynthesis` → no speaker → no swap for the whole run).

- [ ] T009 Record the outcome of T008 in [quickstart.md](./quickstart.md) — replace the browser-check steps' expectations with what was actually observed, the way 006 recorded its preview-deploy checks. Note the screen-reader pass as **not run** (waived), rather than leaving it ambiguous.

---

## Dependencies & Execution Order

### Phase dependencies

```
Phase 1 (US1 swap: T001–T004)          ← MVP; green tree, emphasis leaks between cards
    │
    ▼
Phase 2 (US2 reset: T005 → T006)       ← T005 must be RED before T006 is written
    │
    ▼
Phase 3 (Polish: T007–T009)
```

### Where the stories are genuinely independent, and where they are not

- **US1 is independently deliverable but not shippable.** Phase 1 ends coherent and green, and
  visibly wrong across cards. It is a checkpoint, not a release.
- **US2 is not independent of US1.** It is one line inside the state US1 introduces. Its phase exists
  because the *test order* matters, not because the work could be done by someone else in parallel.

There is one MVP checkpoint (end of Phase 1) and one complete feature (end of Phase 2).

### Within each phase

- T001 and T002 are different files with no shared symbol — genuinely parallel.
- T003 depends on both: it cannot typecheck until both props exist.
- T004 depends on T003 — nothing renders the swap until the wiring is in.
- T005 → T006 is the deliberate red-then-green pair. Do not reorder it.
- T007 is independent of T008/T009 and can run any time after Phase 2.

### Parallel opportunities

Few, and honestly so: this is a four-file change that mostly runs in sequence. `T001 [P]` with
`T002 [P]` is the only real one, and `T007 [P]` alongside T008.

---

## Implementation Strategy

Single branch, single PR. The feature is four files and one boolean; stacking it would create more
review surface than it removes.

1. T001–T004 → gate green → **stop and look at the screen**. The swap should already be doing its
   job on a single card.
2. T005 red → T006 → gate green. The reset is the only part that can fail silently, so this is where
   the care goes.
3. T007–T009 → browser verification and recording.

**Bookkeeping is inline.** Flip `- [ ]` → `- [X]` in this file in the *same commit* as the work it
describes. There is no checkbox cleanup pass at the end.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- The speaker button does not exist in jsdom. Any test that presses it must live inside the
  `describe` block that defines `window.speechSynthesis`; the `Run — where nothing can speak (US3)`
  block must keep passing unchanged, and is the standing proof of the no-speech edge case.
- Add nothing to `src/run/` or `src/storage/`. If a task seems to need it, the design was
  misread — see [research.md § Decision 1](./research.md#decision-1-where-the-heard-flag-lives-and-what-resets-it).
- Do not add a `data-testid`. The observable already exists.
