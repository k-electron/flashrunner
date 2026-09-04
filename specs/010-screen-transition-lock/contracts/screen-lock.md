# Contract: Screen Lock

Feature: [spec.md](../spec.md) · Supersedes § 1, § 3 and part of § 6 of
[009's card-advance contract](../../009-card-advance-guard/contracts/card-advance.md)

What must be true of the run screen while it is transitioning. Rules are stated so
that a reader can check an implementation against them without reading the
implementation first.

## 1. The locked region is the screen, not a set of controls

The locked region is every descendant of `RunLoop`'s outermost element: the progress
bars, the heading, the storage message, the card block, the outcome buttons, the
pronounce control, "Start over", "Leave this run", and — in the other arm of the same
branch — "Repeat this run" and "Next run".

- No control may be named anywhere in the lock's implementation.
- No control may receive a prop, flag, or `disabled` state describing the lock.
- A control added inside that element later is locked with no change to the lock.

**Prohibited**: enumerating the controls; a per-control boolean; a `disabled`
attribute driven by the phase; consulting the phase inside any handler.

**Boundary — portals are not covered.** Both mechanisms in § 2 act on the wrapper's DOM
subtree, and a portalled element is not in it: `inert` does not reach it and the capture
listener never sees its events. No control in the run screen portals today, and this
contract does not require one to be handled. But a control that portals — a shadcn
`Dialog`, `Popover`, `Tooltip`, or `Select`, all of which do by default — **escapes the
lock silently**, with no test failing. Anyone adding one to a run screen owes this rule
a second look, and the option to revisit is in [research](../research.md) Decision 2a.

## 2. Two mechanisms, one expression

The locked element carries both:

| Mechanism | Buys | Verified in |
|---|---|---|
| `inert` | pointer, focus, tab order, and AT removal, natively | a real browser |
| one capture-phase interceptor on the same element | activations discarded | `npm test` and a real browser |

Both MUST read the same expression. Neither may compute the lock independently.
The reason for two is in [research](../research.md) Decision 2: jsdom enforces
neither `inert` nor hit-testing, so `inert` alone would leave the lock's absence
undetectable in CI.

## 3. The lock is derived, never stored

```
locked === (phase !== 'idle')
```

MUST hold at every moment, including the first frame after mount. There MUST be no
state whose value is the lock, and none whose only purpose is to exempt a case.

**Prohibited**: a `guarded`-style boolean set and cleared alongside `phase`; a lock
that survives in a ref; any initialiser that starts the screen unlocked while a phase
is running.

## 4. When it opens and closes

- **Opens** on the event that begins a transition, in the same synchronous turn,
  before any moved frame is painted.
- **Closes** when the arriving screen has finished arriving, and for every control at
  once.
- **Each phase locks for its own duration**, taken from `CARD_EXIT_MS` or
  `CARD_ENTRY_MS`. There is no lock duration, no sum, and no margin.
- **The phases are contiguous.** Between the exit's last moment and the entry's
  first, `locked` MUST NOT be observably false. Advancing a fake clock to exactly
  `CARD_EXIT_MS` MUST find the screen locked.

## 5. A blocked activation

Produces nothing: no card marked, no progress recorded, no write to storage, no
navigation, no speech, no `heard` flag. It is discarded at the moment it arrives and
MUST NOT be replayed when the lock releases.

This holds for pointer, mouse, pen, keyboard activation, and key auto-repeat. Auto-
repeat is the case a pointer-only mechanism misses, and it is the reported defect
009 was opened for.

## 6. The release cannot be lost

- Driven by `setTimeout`. **Prohibited**: `onAnimationEnd`, `onTransitionEnd`, the
  Web Animations API, `requestAnimationFrame` counting, or anything else that depends
  on the browser reporting that motion finished.
- Cleared before a new transition opens a new lock.
- Cleared when the screen unmounts.
- Exactly one release pending at any moment.
- A release delayed by a throttled tab still arrives. It MUST NOT be cancelled by
  anything but the two clearings above.

A screen that is locked with no release pending is the failure this contract exists
to make impossible.

## 7. Appearance and content

- No control may look disabled, greyed, or switched off while locked. The moving
  group's existing dim-and-recover stays the only progress cue.
- Non-control content stays visible and readable throughout.
- No new status message, spinner, countdown, or cursor change.

## 8. Zero-duration correctness

With `CARD_EXIT_MS` and/or `CARD_ENTRY_MS` at `0`, one press MUST mark exactly one
card, the outcome MUST still apply and persist, and the screen MUST be live once the
timers have run. No rule above may be implemented in a way that requires a non-zero
duration to be correct.

## 9. What 009 said and this replaces

| 009 contract | Now |
|---|---|
| § 1 "the guarded group is the card, the two outcome buttons and the pronounce control" | § 1 above: the group is the screen |
| § 3 "the window opens on the press and closes on the entry's final frame", as one span | § 4 above: per phase, contiguous |
| § 6 prohibits `pointer-events: none` as the guard | still prohibited, and § 2 says what replaces it |

009's § 2 (the outcome lands on the press), § 4 (the one clock), § 7 (every card
change plays both phases) and § 8 (layout invariant) stand unchanged.
