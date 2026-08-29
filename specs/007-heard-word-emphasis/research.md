# Research: Heard-Word Button Emphasis

**Date**: 2026-08-28 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Four decisions. No unknowns were left for implementation, and no `NEEDS CLARIFICATION` reached this
document — the two open questions (when the swap fires, and how long it lasts) were put to the
maintainer before the spec was written and are recorded in
[checklists/requirements.md](./checklists/requirements.md).

## Decision 1: Where the "heard" flag lives, and what resets it

**Decision**: A `useState<boolean>` in `RunLoop` (`src/routes/Run.tsx`), cleared inside `apply`.

**Rationale**: A card's presentation ends in exactly two ways, and both are already funnelled:

| How the presented card changes | Path | Flag state afterwards |
|---|---|---|
| Marked "Got it" / "Not yet" | `apply({ type: 'mark' })` | cleared by `apply` |
| "Start over" mid-run | `apply({ type: 'restart' })` | cleared by `apply` |
| Run resumed from storage | `RunLoop` mounts, `useState` initialiser | `false` by construction |
| Moving to another rung | `RunLoop` is keyed `${deck.id}/${rung.id}` → remount | `false` by construction |
| Run completed | outcomes unmount with the `complete` branch | not rendered |

There is no fifth path: `state` is only ever written by `apply` and the initialiser. So one
assignment discharges all four clauses of FR-007 with no effect, no dependency array, and nothing to
keep in sync.

**Alternatives considered**:

- **Key the flag on the current word, the way `PronounceButton` keys `spokenWord`.** Rejected, and
  the reason is written out in that component's own `useEffect` comment: failing the last card of a
  cycle re-queues that one card, and "Start over" can reshuffle onto the card already showing. Both
  re-present the *same word*, which `PronounceButton` deliberately treats as unchanged — and which
  FR-007 requires this feature to treat as a fresh presentation. Same mechanism, opposite
  requirement.
- **A presentation key, `${cycleIndex}:${position}`, stored instead of a boolean.** Correct, and
  strictly more machinery than clearing a boolean at the one place presentations end. It would also
  need `cycleIndex` to be in scope purely for identity.
- **A field on `RunState`.** Rejected on Principle II and Principle VI. `src/run/` is a pure engine
  that decides the mechanic; whether a learner pressed a speaker is not the mechanic. It would also
  land in the persisted shape and then have to be excluded from `PersistedRun` by hand, which is
  work created solely to undo itself — FR-008 wants it gone anyway.
- **Context, or lifting into a reducer.** Two components, one common parent, one boolean.

## Decision 2: How the swap is expressed in the markup

**Decision**: Swap the `variant` prop on both buttons, and make "Got it"'s green classes conditional.

| Button | Default presentation | After the press |
|---|---|---|
| Got it | `variant="default"` + `bg-green-800 text-white hover:bg-green-900` | `variant="secondary"`, no green |
| Not yet | `variant="secondary"` | `variant="default"` |

**Rationale**: Both target treatments already exist and already ship. `default` is
`bg-primary text-primary-foreground hover:bg-primary/80`, which is what "Resume" and "Next run"
render — the request named those buttons explicitly. `secondary` is what "Not yet" renders today,
so "Got it"'s new plain state is not a new colour, it is the existing one. `--primary` is
`oklch(0.205 0 0)` and `--secondary` is `oklch(0.97 0 0)` (`src/index.css:59`, `:61`): a near-black
and a near-white grey, on a neutral ramp. No token is added and no contrast figure needs computing,
because neither pairing is new.

The green has to be *removed* rather than overridden in the heard state. `Button` composes classes as
`cn(buttonVariants({ variant, size, className }))`, so `className` is appended last and
`tailwind-merge` resolves `bg-green-800` over the variant's `bg-primary` — that is precisely why
today's green works. Nothing can out-specify it from the variant side; the conditional has to be on
the className.

**Alternatives considered**:

- **A `success` variant plus `--success` / `--success-foreground` tokens.** Declined in 003 for
  having one caller, and this feature does not add a second. Making an existing single-caller style
  conditional is not the second use case Principle VI asks for.
- **Two complete className strings chosen by ternary, avoiding the `cn` import.** Duplicates the
  four shared layout classes on both sides of the ternary, where they can drift apart. `cn` is
  already the project's idiom and is in every other component.
- **A CSS-only solution — `:has()`, a sibling selector, a data attribute on the grid.** Would put
  the rule somewhere no one reading `OutcomeButtons.tsx` would find it, to avoid passing one boolean.

## Decision 3: What the tests can honestly assert

**Decision**: Assert the pair of `data-variant` attributes. Assert no colour, and no class name.

**Rationale**: Principle IV forbids class names, internals and snapshots, and the thing worth
testing here is FR-007 — the reset — because that is the only way this feature can fail silently
and stay plausible on screen. That needs an observable for "which button is emphasised".
`src/components/ui/button.tsx:59` sets `data-variant={variant}` on every button; it is a deliberate
styling hook in the vendored component, rendered to the DOM, and it is stable across a Tailwind
class rename. Read as a *pair* it is unambiguous:

- default presentation → `Got it = "default"`, `Not yet = "secondary"`
- after the press → `Got it = "secondary"`, `Not yet = "default"`

The green never accompanies `secondary`, so no third state can masquerade as either of these.

This is a judgement call, not a clean pass, and it is recorded as one in the plan's Constitution
Check. The alternative readings were: assert the class (explicitly forbidden), add a `data-testid`
purely for the test (inventing an observable is worse than using the one that exists), or assert
nothing and verify only in a browser (leaves FR-007's reset — the regression that will actually
happen — with no guard).

Whether black *reads* as emphasised and grey as plain is not asserted anywhere. That is a visual
judgement, made in a browser, exactly as 003 handled its green.

**Alternatives considered**: covered above. One more was rejected outright — `toHaveStyle` against
a computed `background-color`. jsdom does not resolve Tailwind's utility classes into a stylesheet,
so it would assert nothing while appearing to assert everything.

## Decision 4: Where the press is signalled inside `PronounceButton`

**Decision**: A new required `onHeard: () => void` prop, called as the first statement of `speak`,
before the already-speaking guard.

**Rationale**: FR-002 says the press is the signal, not the word finishing, and explicitly does not
depend on the device succeeding. Calling first means a press that never produces sound — no voice
installed, an utterance that errors, a `speak` that silently does nothing — still swaps the buttons.
Placing it before the `if (speaking) return` guard makes FR-006 free: pressing again while the word
is still being said calls `onHeard` a second time, which sets an already-true boolean to true.
Idempotent by type, not by care.

The prop is required rather than optional. There is one caller, and an optional callback would
invite a second one that quietly does not wire it up.

**Alternatives considered**:

- **Fire on `utterance.onend`.** Rejected by the maintainer's answer during specification: the
  learner has chosen to hear the answer at the moment they press, and a cancel (marking, leaving)
  arrives as `onerror`, so an end-based trigger would leave the emphasis off in exactly the cases
  where the learner did hear enough of the word.
- **Intercept the click in `Run.tsx` with a wrapper element.** Avoids touching `PronounceButton`, at
  the cost of a click handler on a `<div>` that has to guess what was pressed inside it.
- **Move the whole speaker into `OutcomeButtons`.** Reverses 005's explicit separation — the
  speaker is not an outcome, and `OutcomeButtons` is never given the card's text.
