# Contract: heard-word emphasis

**Date**: 2026-08-28 | **Plan**: [plan.md](../plan.md) | **Spec**: [spec.md](../spec.md)

Two component interfaces change, each by one prop. Nothing else in the app gains a prop, and
`src/components/ui/button.tsx` is untouched.

## `OutcomeButtons` — one prop added

```ts
function OutcomeButtons({
  onMark,
  heard,
}: {
  onMark: (outcome: Outcome) => void;
  heard: boolean;
}): ReactElement
```

`heard` is required. `Outcome` is `'got-it' | 'not-yet'` (`src/run/types.ts`), unchanged. The left
button still calls `onMark('got-it')` and the right still calls `onMark('not-yet')`, in both states
(FR-003).

### Rendered contract

| | Left button | Right button |
|---|---|---|
| Wording | `Got it` | `Not yet` |
| Accessible name | `Got it` | `Not yet` |
| Icon | `CircleCheck`, `aria-hidden` | `CircleQuestionMark`, `aria-hidden` |
| Height / flex | `h-24 flex-1`, unchanged | `h-24 flex-1`, unchanged |
| **Fill, `heard === false`** | **green** — `variant="default"` + `bg-green-800 text-white hover:bg-green-900` | **grey** — `variant="secondary"` |
| **Fill, `heard === true`** | **grey** — `variant="secondary"`, green classes absent | **near-black** — `variant="default"` |

Invariant across both states (FR-004, FR-005): two buttons, side by side, left to right, in this
order; same size, same wording, same icons, same accessible names, same tab order, both enabled and
both pressable. Exactly one is `variant="default"` and exactly one is `variant="secondary"` — never
two of either.

The near-black is not a new colour: `variant="default"` is `bg-primary`, `oklch(0.205 0 0)`
(`src/index.css:59`), the same treatment "Resume" on the deck ladder and "Next run" on the
run-complete screen already render. The grey is `bg-secondary`, `oklch(0.97 0 0)` (`:61`) — what
"Not yet" renders today.

### What must not change with `heard`

- No `aria-pressed`, no `aria-current`, no live region, no change of accessible name (FR-003). The
  emphasis is offered to the eye only.
- Nothing is disabled, focused, blurred, reordered, resized or auto-activated.
- Neither icon changes, and neither icon's `aria-hidden` is lifted.

## `PronounceButton` — one prop added

```ts
function PronounceButton({
  word,
  onHeard,
}: {
  word: string;
  onHeard: () => void;
}): ReactElement | null
```

`onHeard` is required, and is called **once per press**, as the first statement of `speak` —
before the already-speaking guard, and before any `SpeechSynthesisUtterance` is constructed.

Consequences, all of them required by the spec rather than incidental:

- It fires on a press that produces no sound at all (FR-002).
- It fires again on a repeat press during speech, where `speak` otherwise returns early; the
  receiver sets an already-true boolean (FR-006).
- It never fires on a device without the Web Speech API, because the component returns `null`
  before rendering anything to press — which is the edge case where the outcomes keep their default
  styling for the whole run.

Everything else about this component is unchanged: the accessible name stays `Hear the word`, the
`h-12` / `variant="outline"` / `col-start-2` treatment stays, the no-queue rule stays, the pulse
while speaking stays, and it still marks nothing and advances nothing (FR-009).

## `Run.tsx` — the wiring

`RunLoop` holds `const [heard, setHeard] = useState(false)`, passes `onHeard={() => setHeard(true)}`
to `PronounceButton` and `heard={heard}` to `OutcomeButtons`, and calls `setHeard(false)` inside
`apply`.

The reset lives in `apply` because `apply` and the `useState` initialiser are the only two things
that ever change which card is presented — see
[research.md § Decision 1](../research.md#decision-1-where-the-heard-flag-lives-and-what-resets-it)
for the enumeration. Nothing about `heard` reaches `toPersistedRun`, `persist`, or `src/run/`
(FR-008).

## The assertions that hold this contract

New, in the `window.speechSynthesis`-stubbing `describe` block of `src/routes/Run.test.tsx` — the
only block where the speaker button exists:

1. Pressing the speaker swaps the pair: `Got it` → `data-variant="secondary"`,
   `Not yet` → `data-variant="default"` (FR-001).
2. The press marks nothing: the same card is still showing and both outcomes are still pressable
   (FR-003).
3. Pressing the speaker twice leaves the pair as it was after the first press (FR-006).
3a. A press that starts no sound still swaps the pair (FR-002). Reached by failing the last card of
   a cycle as its only failure: the engine re-presents that same card at once, the word has not
   changed so the speech was never cancelled, and the press lands on the already-speaking guard.
   This is the only assertion that fails if the press is reported below that guard rather than
   above it — added during implementation, when a review found the FR-006 assertion above could not
   detect that move.
4. Marking after a press presents the next card with the pair back to `default` / `secondary`
   (FR-007).
5. "Start over" after a press presents its card with the pair back to `default` / `secondary`
   (FR-007).

Existing, and must stay green unchanged: every `getByRole('button', { name: 'Got it' | 'Not yet' })`
query in the file. They are the standing guard that FR-003 and FR-005 hold — a changed accessible
name breaks all of them.

## Explicitly not part of this contract

- Any assertion about colour, class names, or computed styles. jsdom does not resolve Tailwind
  utilities, so such an assertion would pass while checking nothing. Colour is verified in a
  browser — [quickstart.md](../quickstart.md) step 2.
- The `default`/`secondary` definitions themselves. They live in `src/components/ui/button.tsx` and
  are not modified.
- Every other button in the app. None changes appearance, in either state.
