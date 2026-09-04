# Research: Screen Transition Lock

Feature: [spec.md](./spec.md) · Supersedes parts of
[009 research](../009-card-advance-guard/research.md)

009 asked "how does a control know it is guarded?" and answered: a boolean read at
the outcome handler. This feature asks a different question — "how does a *screen*
stop being interactive?" — and the answer is not a bigger boolean.

Every decision below was reached against the code as it stands in
`src/routes/Run.tsx`, `src/components/PronounceButton.tsx`, and
`src/run/advance.ts`.

## Decision 1 — `inert` is the native mechanism, but it is not the enforcement

**Decision**: The run screen's outermost element carries `inert` while any phase is
running, **and** the same element carries one capture-phase interceptor that
discards activations while locked. Both are driven by the same expression.

**Rationale**: `inert` is exactly the semantic this feature wants and it is a
platform feature, not a library: one attribute makes an entire subtree
non-clickable, unfocusable, out of the tab order, and hidden from assistive
technology. React 19 accepts it as a boolean prop — verified in this repo:

```
OUTER HTML: <div inert=""><button>press</button><p>count 0</p></div>
```

It cannot be the whole answer, for the reason in Decision 2.

**Alternatives considered**:

- `pointer-events: none` — blocks pointer input only. A held key auto-repeats
  straight through it, which is the defect 009's FR-004 test exists to catch;
  `src/routes/Run.test.tsx:1473` already says so in as many words.
- `disabled` on each control — per-control, so it fails FR-002 outright, and it
  changes appearance, which FR-007 forbids. 009 Decision 1 rejected it too.
- A transparent overlay element — pointer-only like `pointer-events: none`, and it
  needs a stacking context that the card animation would have to work around.
- Keeping the per-handler boolean and adding it to more handlers — this is the
  thing the feature exists to delete.

## Decision 2 — jsdom does not enforce `inert`, so `inert` alone is untestable

**Decision**: Treat `inert` as unverifiable in CI, and put the enforcement in a
mechanism jsdom does implement: event capture.

**Rationale**: measured, not assumed. A probe rendered `<div inert><button
onClick=…>` under this repo's own test environment (jsdom 30.0.1,
`@testing-library/user-event` 14.6.6) and drove it:

| Probe | Result |
|-------|--------|
| React 19 renders the attribute | `<div inert="">` — yes |
| `user.click()` on a button inside an inert subtree | **handler fired**, no throw |
| `queryByRole('button')` inside an inert subtree | **found** |
| `user.tab()` into an inert subtree | **focused the button** |
| `{Enter}` on that focused button | **handler fired** |

So a pure-`inert` implementation would leave every behavioural test in
`Run.test.tsx` green whether the lock existed or not — including the two that carry
this feature's whole point (`marks one card when a second press lands inside the
guard window`, `marks one card for a held key that auto-repeats`). A safety-critical
lock whose absence no test can detect is precisely the silent failure Principle IV
is about, so `inert` alone does not clear the bar.

jsdom *does* implement event dispatch, propagation, and the capture phase. One
capture-phase handler on the locked element therefore blocks activations in both
jsdom and real browsers, and it is still one place rather than one per control, so
FR-002 holds: a control added later is covered because it is a descendant, not
because anyone remembered it.

**Alternatives considered**:

- Rewrite the behavioural tests as structural assertions (`toHaveAttribute('inert')`)
  and move all behavioural proof to a real browser. This is allowed here — a mark
  with no role or label to query is the case where structure is the only handle —
  but it would trade the suite's two highest-value assertions for an attribute
  check, and CI would no longer fail if the lock stopped working.
- Switch the test environment to a real browser runner. A far larger change than
  the feature, and it puts a browser into `npm test`, which Principle VII's
  "git and Node, nothing else" does not obviously allow.

## Decision 2a — Native capture, not React's synthetic capture

**Decision**: register the interceptor with `addEventListener(type, handler, true)` in
an effect, with a cleanup that removes it. Not `onClickCapture`.

**Rationale**: React's capture phase is a simulation. React attaches its listeners at
the root container and walks the DOM path collecting handlers off fibers, so its
capture phase reaches **handlers registered through React** and nothing else. A
descendant that attaches its own `addEventListener` fires during the real DOM capture
or bubble, before React's root listener is even reached, and `stopPropagation()` on a
React synthetic event cannot stop it.

FR-002 promises that a control added later is covered "regardless of how it is wired",
and a mechanism that only covers React handlers does not keep that promise. Native
capture on the ancestor fires before every descendant listener whatever attached it,
which is both the stronger guarantee and what makes the FR-002 probe test possible at
all: the probe appends a plain `<button>` with a plain listener, which React has never
seen, and it must still be dead.

**Cost**: an effect and a cleanup instead of a JSX prop — three lines rather than one.
Worth it for the difference between "covered" and "covered if you wire it the way we
happened to expect".

**Known boundary**: neither mechanism reaches a **portal**. A portalled control renders
outside the wrapper's DOM subtree, so it is not a descendant, so `inert` does not apply
to it and the capture listener never sees its events. Nothing in the run screen
portals today; a `Dialog` or `Popover` added later would escape the lock silently.
Recorded as a rule in [contracts/screen-lock.md](./contracts/screen-lock.md) § 1 rather
than solved here, because solving it speculatively means building a portal registry for
zero current portals.

**Alternatives considered**:

- `onClickCapture` / `onKeyDownCapture` — one line, and sufficient for every control
  that exists today, since all of them are React `<Button>`s. Rejected because "every
  control that exists today" is exactly the reasoning this feature was opened to
  delete.
- A listener on `document` filtered by `contains()` — covers portals, and covers far
  too much: it would swallow events on any future UI outside the run screen and needs
  its own containment rule. If a portal ever lands in a run, this is the option to
  revisit.

## Decision 3 — The lock is derived from the phase, and `guarded` is deleted

**Decision**: `const locked = phase !== 'idle'`. No state of its own.

**Rationale**: `RunLoop` already holds `phase: 'exiting' | 'entering' | 'idle'`, and
today it *also* holds `guarded`. Reading the current code, those two agree at every
moment but one:

- `beginTransition()` sets `guarded` true and `phase` to `'exiting'` together.
- the entry timer sets `phase` to `'idle'` and `guarded` false together.
- at mount, `phase` initialises to `'entering'` while `guarded` initialises to
  `false`.

That single divergence *is* 009 FR-010 — the first card of a run being pressable on
arrival. FR-020 removes the exception, which removes the only reason the second
variable exists. So the feature deletes state rather than adding it:

- `RunLoop`: the `guarded` state and its initialiser go.
- `RunLoop`: the `if (guarded) return` inside `OutcomeButtons`' `onMark` goes, and
  with it the comment explaining why the guard is read at that one call site.
- `PronounceButton`: the `guarded` prop, its `if (guarded === true) return`, and the
  note about no unit test being able to reach it all go. The component's public
  shape shrinks to `{ word, onHeard }`.

This is what satisfies FR-011's "MUST NOT be tracked separately from which phase is
running": there is nothing left to disagree.

## Decision 4 — The lock goes on `RunLoop`'s outermost element

**Decision**: the wrapper `<div>` in `src/routes/Run.tsx` that currently carries
only the two CSS custom properties.

**Rationale**: FR-001 covers *every* control on the screen, and they are not all in
one place — the outcome buttons and the pronounce control are inside the keyed card
block, while "Start over" and "Leave this run" are siblings further down `<main>`,
and the run-complete screen's "Repeat this run" and "Next run" are in the other arm
of the same branch. The wrapper is the only element that contains all of them. It
already exists and already carries the transition's clock, so the lock lands on the
element that owns the transition — which is the spec's framing exactly.

`RunProgress` is inside that wrapper too. It holds no controls, so inerting it costs
nothing (see Decision 8 for what it does cost).

The two "Run not found" screens live in `Run`, not `RunLoop`, and never transition.
They are untouched, which is FR-019 falling out of where the wrapper is rather than
a condition written for it.

## Decision 5 — The release stays a timeout, and stays on one ref

**Decision**: unchanged from 009 (Decision 5 and Decision 4a): `setTimeout`, one
`pending` ref, `clearTimeout` before every new transition and in an unmount cleanup.

**Rationale**: this was a preference in 009 and is a safety requirement now
(FR-009, FR-010). `onAnimationEnd` is a promise the browser makes and can break — a
dropped frame, a suspended tab, an interrupted animation, `animation: none` from a
user stylesheet — and under whole-screen coverage a release that never arrives
strands the learner on a dead screen rather than costing them two buttons. A timer
fires late when a tab is throttled; it does not fail to fire.

The existing single-ref discipline already gives FR-010's "exactly one release
pending": the two phases run in sequence and share the ref, and
`clearTimeout(pending.current)` at the top of `beginTransition()` is what makes a
card change mid-transition replace the one in flight instead of inheriting its
release.

## Decision 6 — Contiguity is already structural, and gets a test that says so

**Decision**: no code change for FR-011a; one test pinning it.

**Rationale**: the exit timer's callback *is* `enter()`, which sets
`phase` to `'entering'` synchronously before scheduling the entry timer. There is no
intermediate `'idle'`, so `locked` never goes false at the boundary. That holds by
construction, but nothing currently states it, and a later refactor that made
`enter()` async — or that routed the boundary through a state update in an effect —
would open a live frame in the middle of the motion and no test would notice.
`Run.test.tsx` already advances to exactly this boundary
(`advanceToBoundary()` at `src/routes/Run.test.tsx:1681`), so the test is cheap.

## Decision 7 — The run-complete screen needs no case of its own

**Decision**: leave `beginTransition()`'s `shownId === undefined` shortcut in place.

**Rationale**: FR-018 settled that the finished screen plays no visible exit, so
"Repeat this run" keeps going straight to the entry. Under a per-phase lock that
needs no special handling at all: there is no exit phase, so there is no exit lock,
and the entry locks for its own duration like any other entry. The run-complete
screen becomes locked-while-arriving purely by being inside the wrapper — FR-016 and
FR-017 with no code that mentions the run-complete screen.

This is the one place where 009's requirements reverse and *nothing* in the
implementation reverses with them: 009's FR-009 (never guarded) held because the
guard was read at the outcome handler and that screen has no outcome buttons. Move
coverage to the screen and the same code now guards it. The change is in the tests.

## Decision 8 — Two accepted consequences, named rather than mitigated

**Decision**: accept both; add nothing to work around them.

1. **Assistive technology loses the subtree for the length of the motion.** `inert`
   hides its subtree from the accessibility tree, so for ~320ms the card's word, the
   progress bars, and the heading are not readable by a screen reader. FR-008 is met
   as written — the content stays visible — but the AT half is a genuine narrowing
   versus today. The alternative is to drop `inert` and keep only the capture
   interceptor, which leaves the controls focusable and announced as live while they
   are moving. Between "briefly unreadable" and "announced as pressable when a press
   will be discarded", the first is the smaller lie.
2. **Focus is dropped when the wrapper goes inert.** For the outcome buttons and the
   pronounce control this changes nothing: they live in a block keyed by
   `presentation`, so a card advance already unmounts and remounts them and focus
   already goes to `<body>`. The new loss is narrow — focus resting on "Start over"
   or "Leave this run" when a transition begins. No focus restoration is added;
   FR-007 constrains appearance, nothing here promises focus is preserved, and
   Principle VI says do not build the adjacent thing.

## Decision 9 — What is verified where

| Requirement | Verified by |
|---|---|
| FR-001, FR-003, FR-004 (nothing activates; every means; no effect) | `Run.test.tsx`, behaviourally, via the capture interceptor |
| FR-002 (a new control is covered with no guard of its own) | `Run.test.tsx`, with a probe control rendered inside the wrapper |
| FR-005, FR-006 (opens on the press, releases on arrival) | `Run.test.tsx` with fake timers, advancing by the imported constants |
| FR-009 (timeout, not an animation event) | `Run.test.tsx` — the suite has no animation events to fire, so a release that depended on one would never arrive and the tests would hang on a locked screen |
| FR-010 (cleared before a new lock, cleared on unmount) | `Run.test.tsx`, existing interruption and unmount tests extended |
| FR-011a (contiguity) | `Run.test.tsx`, asserting still-locked at exactly `CARD_EXIT_MS` |
| FR-012 (zero durations) | `Run.test.tsx`, both constants stubbed to 0 |
| FR-014, FR-015 (no lost mark, lock not persisted) | `Run.test.tsx`, existing tests |
| `inert` is actually present and actually inert | Playwright against `npm run dev`, plus [quickstart.md](./quickstart.md) § 3 in a real browser |

Splitting it this way is deliberate: everything a browser is not required for is
proven in `npm test`, and the browser is used only for the one thing jsdom cannot
answer (Decision 2).

## Decision 10 — Rejected outright

- **Extending coverage to route changes across the app** (deck list → ladder → run).
  Assessed in full and rejected: a route swap unmounts the outgoing screen before it
  can be animated, so an exit needs deferred navigation; `popstate` fires after the
  history entry has already changed, so the browser's back button — the most-used
  path in a three-screen app — could never animate; and the six `<Link>` sites would
  need `preventDefault` plus programmatic navigation, breaking cmd-click and
  middle-click unless each is re-handled. It deletes none of the card machinery
  (`leaving` and `presentation` solve a run-state problem, not a routing one) and
  makes ~480 lines of passing route tests timing-dependent. If cross-screen motion is
  wanted later, the native rung is React Router's `viewTransition` on `<Link>`, as a
  separate feature.
- **An exempt escape control** ("Leave this run" stays live). Reintroduces the
  per-control reasoning the feature removes, and the browser's own back, reload, and
  tab-close are already outside the lock and already sufficient.
- **A lock duration with a safety margin added to the motion.** A third number that
  can disagree with the other two; FR-011 forbids it.
