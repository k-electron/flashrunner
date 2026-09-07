# Feature Specification: Screen Transition Lock

**Feature Branch**: `010-screen-transition-lock`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Right now only the two outcome buttons and the speaker are protected, and only because each one separately checks a flag. Other controls stay live. Instead we need to make all controls present and future unclickable during card transitions. Essentially the entire screen, all controls, present, and even future new controls on a card should be unclickable once a transition has begun and the new screens controls should only become clickable after that screen has transitioned in. The reason is accidental taps during motion. A finger bouncing on a large button, or a child tapping repeatedly, should never land on something that has moved under it. Protecting individual controls means every new control is a new place to remember, and eventually someone forgets. Coverage should be a property of the screen while it is transitioning, not a property of each handler. Currently card screens have 'transition in' and 'transition out' animations. During these animations, the screen should not be interactable. This will change some requirements from 009. That is fine. The run-complete screen is essentially 'a card' and therefore should fall under this treatment of having 'transitions' during which the ui is completely un-interactable. This introduces a risk. Today a transition that failed to complete would leave two buttons dead and the learner could still restart or leave. Under the new approach it would lock the whole screen. The release path therefore becomes safety critical: it must stay driven by a timeout rather than by an animation event, it must be cleared before every new transition, and it must be cleared on unmount. The intent here is to have cards be able to evolve and add new features without having to remember to guard every one independently."

## Context

Feature 009 protects three controls — the two outcome buttons and the pronounce
control — by having each one consult a shared flag. Everything else on the run
screen ("Start over", "Leave this run", and the run-complete screen's "Repeat this
run" and "Next run") stays live while the card block is in motion.

This feature moves coverage from the handlers to the screen: while a card screen
is transitioning, nothing on it can be activated. It supersedes several of 009's
requirements — see § Superseded Requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A bouncing finger never lands on a moved control (Priority: P1)

A learner marks a card. The card and its buttons begin to leave, and a new card
begins to arrive in their place. During that motion the learner's finger bounces,
or a child keeps tapping the spot where the big green button used to be. Nothing
they hit does anything — not the outcome buttons, not the speaker, not "Start
over", not "Leave this run". When the incoming card has settled, everything on the
screen is live again.

**Why this priority**: This is the whole point of the feature. A tap that lands on
a control which has moved under the finger produces an action the learner never
intended — a card marked wrong, a run restarted, or the run abandoned mid-motion.

**Independent Test**: Mark a card, then attempt to activate every control on the
screen while the transition is running. Verify no card is marked, no run is
restarted, no navigation occurs, and no word is spoken. Then wait for the
transition to finish and verify every one of those controls works.

**Acceptance Scenarios**:

1. **Given** a card is on screen and idle, **When** the learner marks it and then
   presses either outcome button again before the incoming card has settled,
   **Then** exactly one card has been marked and the second press has no effect.
2. **Given** a card change is in flight, **When** the learner presses "Start over",
   **Then** nothing happens: the run is not restarted and no storage write is made.
3. **Given** a card change is in flight, **When** the learner activates "Leave this
   run", **Then** no navigation occurs and the run screen stays on screen.
4. **Given** a card change is in flight, **When** the learner presses the pronounce
   control, **Then** no word is spoken and the card is not marked as heard.
5. **Given** a card change is in flight, **When** the learner taps repeatedly and
   rapidly anywhere on the screen, **Then** exactly one card has advanced when the
   transition completes.
6. **Given** the incoming card's entry has finished, **When** the learner presses
   any control, **Then** it behaves normally.
7. **Given** a card change is in flight, **When** the learner reaches the controls
   by keyboard and activates one, **Then** it has no effect, exactly as a tap
   would not.

---

### User Story 2 - The lock always lets go (Priority: P1)

Whatever happens during a transition — an animation that never reports finishing, a
second card change starting on top of the first, the learner switching tabs and
coming back, the screen being torn down — the learner is never left on a screen
where nothing works.

**Why this priority**: Under 009 a transition that failed to complete cost the
learner two dead buttons and they could still restart or leave. Under whole-screen
coverage the same failure strands them completely, with no way out of the run. The
lock is only acceptable if its release cannot be lost.

**Independent Test**: Drive a transition, then interrupt it in each way available
(start another card change mid-flight; leave and re-enter the run; background the
tab and return) and confirm that in every case the screen ends up fully live with
exactly one lock in effect and no leftover release pending.

**Acceptance Scenarios**:

1. **Given** a card change is in flight, **When** a second card change begins,
   **Then** the first change's release no longer applies, and the screen becomes
   live once — at the end of the second change, not before.
2. **Given** a card change is in flight, **When** the run screen is torn down
   (leaving the run, closing the tab), **Then** the pending release is discarded
   and does not act on a screen that is gone.
3. **Given** a card change is in flight, **When** the browser never reports the
   animation as having finished, **Then** the screen still becomes live, because
   the release does not depend on that report.
4. **Given** a card change is in flight, **When** the learner switches to another
   tab and returns, **Then** the screen is live on return (a release delayed by the
   browser still arrives; it is never cancelled).
5. **Given** both transition durations are configured to zero, **When** a card is
   marked, **Then** the screen is live immediately afterwards and exactly one card
   was marked.

---

### User Story 3 - The run-complete screen is a card (Priority: P2)

The run-complete screen arrives with the same motion a card does, and while it is
arriving its controls cannot be pressed. Pressing "Repeat this run" plays the
screen out the way marking a card plays a card out, and nothing on the screen can
be activated while that is happening.

**Why this priority**: It is the one screen in the run that already animates but was
deliberately left unguarded by 009, and it is where an accidental press is most
costly — "Next run" navigates away, "Repeat this run" throws the finished run away
and starts again.

**Independent Test**: Complete a run and attempt to activate "Repeat this run",
"Next run", and "Leave this run" during the screen's arrival; verify none of them
act, and that all three work once it has settled.

**Acceptance Scenarios**:

1. **Given** the last card of a run has just been marked, **When** the learner
   presses "Repeat this run" or "Next run" while the run-complete screen is still
   arriving, **Then** neither acts.
2. **Given** the run-complete screen has settled, **When** the learner presses any
   of its controls, **Then** it behaves normally.
3. **Given** the run-complete screen is settled, **When** the learner presses
   "Repeat this run", **Then** the screen is locked for the whole of the resulting
   transition and the first card of the repeated run is live only once it has
   arrived.

---

### User Story 4 - A new control needs no guard of its own (Priority: P2)

Someone adds a control to the card screen later — a hint, a favourite, a second
pronunciation. They write no guard, consult no flag, and the new control is
nonetheless dead during transitions like everything else.

**Why this priority**: This is the durability the feature is for. Per-handler
guarding means every future control is a new place to remember, and the failure is
silent when someone forgets.

**Independent Test**: Add a control to the card screen that does nothing but record
that it was activated, with no guard logic of its own. Activate it during a
transition and confirm it did not fire; activate it when idle and confirm it did.

**Acceptance Scenarios**:

1. **Given** a control on the card screen with no guard logic of its own, **When**
   it is activated during a transition, **Then** it does not act.
2. **Given** that same control, **When** it is activated while the screen is idle,
   **Then** it acts normally.

---

### Edge Cases

- **Zero-length transitions**: with either or both durations set to zero, one press
  marks exactly one card and the screen is live immediately after.
- **A change on top of a change**: the in-flight release is dropped and replaced,
  never allowed to fire part-way through the new lock.
- **Teardown mid-transition**: leaving the run or closing the tab during a
  transition discards the pending release rather than acting on a screen that no
  longer exists.
- **Throttled timers**: a backgrounded tab may hold the release far longer than the
  transition itself. On return the screen becomes live; the release is late, never
  lost.
- **The outcome is already recorded**: a mark is applied and stored on the press,
  before any motion begins, so an interrupted transition can lose an animation but
  never a mark. Interrupting the screen mid-transition and resuming later comes
  back to the correct card.
- **Browser controls are unaffected**: the lock covers the app's own controls. The
  browser's back button, tab close, and reload stay available throughout, which is
  what keeps a stuck screen recoverable at all.
- **Non-interactive content stays readable**: the card's word, the progress bars,
  the deck/rung heading, and the out-of-storage message are not controls and are
  unaffected by the lock — they remain visible and readable throughout.
- **First arrival of a run**: entering or resuming a run plays an entry with no
  outgoing screen before it. It is an entry, so it locks for its own duration
  (FR-020).

## Requirements *(mandatory)*

### Functional Requirements

#### The lock

- **FR-001**: While a card screen is transitioning, the system MUST prevent every
  control on that screen from being activated. "Every control" is unqualified: the
  outcome buttons, the pronounce control, "Start over", "Leave this run", "Repeat
  this run", "Next run", and any control added later.
- **FR-002**: Coverage MUST be a property of the transitioning screen, not of each
  control or handler. A control MUST NOT need any guard, flag check, or disabled
  state of its own to be covered, and adding a control MUST NOT require any change
  to the lock.
- **FR-003**: The lock MUST cover every means of activation — touch, mouse,
  pen, and keyboard activation, including key auto-repeat.
- **FR-004**: A blocked activation MUST have no effect whatsoever: no card marked,
  no progress recorded, no stored state changed, no navigation, no speech. It MUST
  be discarded, never queued for after the transition.
- **FR-005**: The lock MUST open at the instant a transition begins — on the press
  that causes it, before any motion is painted — so there is no frame in which the
  screen has begun moving and is still live.
- **FR-006**: The controls of an arriving screen MUST become activatable only once
  that screen has finished arriving, and all of them MUST become live at the same
  moment.
- **FR-007**: The lock MUST NOT change how any control looks. No control may appear
  greyed out, switched off, or otherwise disabled while the screen is locked; the
  existing dim-and-recover of the moving group (009 FR-005b) remains the only
  progress cue.
- **FR-008**: Content that is not a control MUST remain visible and readable
  throughout the lock.

#### Release (safety critical)

- **FR-009**: The release MUST be driven by a timeout, never by an animation or
  transition event from the browser. A browser that fails to report an animation as
  finished MUST NOT be able to leave the screen locked.
- **FR-010**: A pending release MUST be cleared before a new transition opens a new
  lock, and MUST be cleared when the screen is torn down. Exactly one release MUST
  ever be pending.
- **FR-011**: Each phase MUST lock for its own duration, derived from that phase's
  own motion duration. There MUST NOT be a lock duration of its own, and the lock
  MUST NOT be tracked separately from which phase is running, so the two cannot
  come to disagree.
- **FR-011a**: The phases MUST be contiguous. There MUST NOT be any frame between
  the end of an exit and the start of the following entry in which the screen is
  activatable: a phase's lock is released only into the next phase's lock, or into
  the idle state.
- **FR-012**: The system MUST remain correct with either or both durations set to
  zero: one press marks exactly one card, the outcome still applies, and the screen
  is live immediately afterwards.
- **FR-013**: A transition beginning while another is in flight MUST replace it
  rather than queue behind it, and the resulting lock MUST span the new transition in
  full. **This is a retained invariant, not a reachable path.** Every action that
  starts a transition — a mark, "Start over", "Repeat this run" — is a control inside
  the locked region, so under FR-001 no input can begin a second transition while one
  is running. The clearing required by FR-010 stays, because it costs one line and it
  is what keeps this true if a transition is ever started by something other than a
  press. It MUST NOT be described as observable behaviour, and it MUST NOT be tested
  by driving a control mid-transition: under FR-001 that tests FR-001.
- **FR-014**: No outcome may be lost to an interruption. Closing the tab, leaving
  the run, or restarting at any point during a transition MUST leave the mark that
  started it already recorded.
- **FR-015**: The lock MUST NOT be persisted. A run that is resumed MUST NOT come
  back locked, whatever was in flight when it was interrupted.

#### Which screens

- **FR-016**: The card screen and the run-complete screen MUST both be treated as
  card screens for the purposes of this lock.
- **FR-017**: The run-complete screen MUST be locked while it arrives, and its
  controls MUST become activatable only once it has settled. This replaces 009
  FR-009, which required it to be pressable from the frame it appears.
- **FR-018**: The run-complete screen MUST NOT play a visible exit. Pressing
  "Repeat this run" replaces it and plays the first card of the repeated run in, and
  the lock covers that entry. A screen with no exit phase simply has no exit lock —
  this MUST fall out of FR-011 rather than being a case written for it.
- **FR-019**: Screens outside a run — the deck list and the deck ladder — are out of
  scope and MUST NOT be changed by this feature.

#### Entering a run

- **FR-020**: Entering or resuming a run plays the first card's entry, and that
  card's controls MUST become activatable only once it has arrived — the same rule
  as every other arrival (FR-006). This replaces 009 FR-010, which made the first
  card of a run pressable on arrival. There MUST be no exception for the first
  arrival: it is an entry phase, so it locks, and no state may exist whose only
  purpose is to exempt it.

### Superseded Requirements

This feature changes these requirements of 009. Feature 009's other requirements —
in particular the two-phase motion (FR-005 through FR-005e), the one-place tuning
surface (FR-007, FR-007a), and press-time recording (FR-005d) — stand unchanged.

| 009 | Said | Now |
|-----|------|-----|
| FR-002 | The guard covers both outcome controls together | Superseded by FR-001: it covers every control on the screen |
| FR-009 | The run-complete screen MUST NOT be guarded; its controls are pressable from the frame it appears | Superseded by FR-017: it is locked while it arrives |
| FR-010 | A run entered or resumed is not guarded; the first card is pressable on arrival | Superseded by FR-020 |
| FR-011 | The guarded group is the card, the two outcome buttons, and the pronounce control | Superseded by FR-001: the group is the whole screen |
| FR-012 | "Start over" and "Leave this run" MUST NOT be blocked by the guard | Superseded by FR-001: both are blocked while the screen transitions |
| FR-013 | A card change mid-flight replaces the one in flight — reachable, because "Start over" stayed live | Retained by FR-013 above as an invariant, but no longer reachable, because superseding FR-012 removed the only input that could reach it |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero activations land during a transition. Across every control on
  the run screen and the run-complete screen, attempting activation mid-transition
  produces no marks, no restarts, no navigation, and no speech — 0 out of 0
  expected effects, for 100% of controls.
- **SC-002**: Rapid repeated tapping on a card — 10 or more taps within one second
  on and around the outcome buttons — advances exactly one card.
- **SC-003**: Every control on the screen is activatable again within 100ms of the
  arriving screen settling, and no sequence of transitions, interruptions, or tab
  switches leaves the screen locked for longer than one second past the end of the
  motion. Both bounds are wall-clock and are measured in a real browser, since a fake
  clock cannot observe either.
- **SC-004**: A control added to the card screen with no guard logic of its own is
  covered: 1 out of 1 new controls protected with 0 lines of per-control guarding.
- **SC-005**: Over 100 consecutive card advances, the screen ends every one of them
  fully live: 0 stuck screens.
- **SC-006**: Interrupting any transition leaves the mark that started it recorded:
  resuming the run comes back to the correct card in 100% of interruptions.

## Assumptions

- The exit and entry durations from 009 are unchanged, and each phase's lock is
  derived from its own duration. No new duration is introduced.
- "Card screens" means the run screen's card block and the run-complete screen.
  Nothing outside a run is touched.
- The browser's own controls (back, reload, tab close) remain available during the
  lock and are the ultimate escape from a stuck screen. The feature does not add an
  in-app escape hatch, because an exempted control would reintroduce exactly the
  per-control reasoning this feature removes.
- The out-of-storage message, the progress bars, and the card's word are not
  controls, so no requirement here applies to them.
- 009's tests that assert "Start over", "Leave this run", and the run-complete
  controls stay live during a transition now assert the opposite, and will be
  rewritten as part of this work.
- Interaction with the lock is not announced to assistive technology beyond what
  the controls already convey; no new status message is introduced.
