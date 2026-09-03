# Feature Specification: Card Advance Guard

**Feature Branch**: `009-card-advance-guard`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "It is too easy to double tap a \"got it\" or \"not yet\" button because in the per card flow, those buttons are exactly in the same place. I think we need to introduce some kind of animation during which the buttons for the next card are not clickable to prevent accidental double taps. we'll want to fine tune how long the animation takes so dont build something that is hard to iterate on."

## Clarifications

### Session 2026-09-01

- Q: Should the spec cover reduced-motion and screen-reader behaviour for this transition? → A: No — out of scope, the maintainer does not want it specified or gated on
- Q: How tightly are the animation and the unpressable window coupled? → A: Exactly — the buttons become pressable again on the animation's final frame, never before or after it, so the animation *is* the signal to wait
- Q: How should the outcome buttons look while the transition plays? → A: Card and buttons move as one group — separate motion would look jarring. Motion is restrained throughout: subtle, polished, tasteful, not a full-width slide. The buttons additionally dim on press and recover their colour across the window, so the return to full strength reads as "ready" without a countdown or a disabled look
- Q: What happens to the pronounce (speaker) button, which shares the block with the outcome buttons? → A: It moves with the group and is guarded with it — the whole block settles as one and everything in it becomes live at the same moment. Supersedes the earlier "pronounce is never guarded" position
- Q: Should the transition be one enter animation, or an exit and an entry? → A: Decomposed — the outgoing card plays an exit, the incoming card plays an entry. Every card change gets both halves: "Start over", the first card of a run, and the run-complete screen included
- Q: Do the progress bars need to share the card block's timing? → A: No. They are a separate layer above the card, not part of the moving group, so they do their own thing while the cards move underneath. They keep the fill animation they already have
- Q: Does the outcome apply on the press, or when the exit finishes? → A: **On the press.** The mark and its storage write happen immediately, and the animation follows. A mark must never be lost to an interruption mid-animation. What lags is only which card is painted, never what is true
- Q: Should the progress bars snap on press or move with the transition? → A: Their fill animates concurrently with the card transition, over the same window, arriving at the new value as the card block settles

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A double tap does not mark two cards (Priority: P1)

A learner marking a card taps "Got it". The next card takes its place, and the
outcome buttons come to rest in exactly the spot they started from. If the
learner's finger comes down a second time — a bounce, a stutter, an over-eager
tap — that second press must not mark the card that has just appeared.

**Why this priority**: This is the whole reported defect. Every accidental double
tap silently marks a card the learner never saw, which corrupts the run's record
of what they actually know. Nothing else in this feature has value without it.

**Independent Test**: Mark a card, then fire a second activation immediately
after. Only one card advances, and the newly presented card is still waiting for
its answer.

**Acceptance Scenarios**:

1. **Given** a run showing card A, **When** "Got it" is pressed and a second press
   lands within the guard window, **Then** only card A is marked and card B is
   still the card being presented.
2. **Given** a run showing card A, **When** "Not yet" is pressed and a second press
   lands within the guard window, **Then** only card A is marked and card B is
   still the card being presented.
3. **Given** a run showing card A, **When** "Got it" is pressed and a second press
   lands on the *other* button within the guard window, **Then** the second press
   is ignored — card B receives no outcome.
4. **Given** a run showing card A, **When** "Got it" is pressed and the next press
   lands after the guard window has ended, **Then** that press marks card B
   normally.
5. **Given** a keyboard user with focus on "Got it", **When** the key is held long
   enough to auto-repeat, **Then** exactly one card is marked per guard window
   rather than one per repeat event.

---

### User Story 2 - The wait reads as a transition, not as a broken screen (Priority: P2)

Because the controls sit in the same place from one card to the next, a new card
can look like a page that failed to respond. Card and buttons move together as one group, so the
learner sees the screen changing rather than a still frame with dead controls.
The learner should never form the thought "the buttons are switched off" — they
should simply see the change happening and wait for it to settle.

**Why this priority**: The guard in US1 makes presses safe; this is what makes the
pause legible. Without it the fix reads as lag. The run is already correct without
it, so it is not P1.

**Independent Test**: Mark a card and watch the screen. Card and buttons move as
one, restrained, and settle together at the moment the buttons become pressable.

**Acceptance Scenarios**:

1. **Given** a run showing card A, **When** an outcome is pressed, **Then** card A
   and the outcome buttons leave together as one group, and card B and the buttons
   arrive together as one group — never separately or on different timings.
2. **Given** an outcome is pressed, **When** the block dims as card A leaves,
   **Then** it is still dimmed at the instant card B begins to arrive, and recovers
   to full strength as card B settles. The dim does not reset or flicker at the
   boundary between the two halves.
3. **Given** an outcome is pressed, **When** the transition plays, **Then** the
   buttons never take on a greyed-out or switched-off appearance, and no countdown,
   spinner, or numeric timer is shown.
4. **Given** an outcome is pressed, **When** the transition plays, **Then** the
   progress bars' fill grows toward its new value rather than jumping to it, and
   moves **in parallel** with the card block — both starting from the same press,
   never one after the other. The bars keep their own speed and are not required
   to finish with the block (FR-005c, SC-003).
5. **Given** the last card of a run is marked, **When** the run completes,
   **Then** that card still plays its exit, and the run-complete screen plays an
   entry — the run does not end on a hard cut.
6. **Given** a learner arrives at a run, **When** the first card is presented,
   **Then** it plays an entry.
7. **Given** a run in progress, **When** "Start over" is pressed, **Then** the card
   on screen plays its exit and the restarted run's first card plays its entry,
   exactly as a mark would.

---

### User Story 3 - The duration can be tuned without a rewrite (Priority: P2)

The right length for the guard is a matter of feel and will need several passes.
Changing it must be a one-value edit, not a change to how the guard or the
transition works.

**Why this priority**: Explicitly requested. It costs nothing at build time and
is the difference between one afternoon of tuning and a re-implementation.

**Independent Test**: Change the single duration value, reload, and observe that
both the transition and the length of the unpressable window change together.

**Acceptance Scenarios**:

1. **Given** the duration is defined in one place, **When** that one value is
   changed, **Then** both the visible transition and the guard window change to
   match, with no other edit required.
2. **Given** the duration is set to zero, **When** an outcome is pressed, **Then**
   the run still advances correctly and marks exactly one card per press.

---

### Edge Cases

- A press that lands during the guard window is **discarded**, never queued and
  replayed after it ends. A deferred press would mark a card the learner had not
  read, which is the defect being fixed.
- Marking the final card of a run plays that card's exit, then the run-complete
  screen's entry. The guard ends as that screen appears — the completion controls
  are never briefly unpressable.
- "Start over" and "Leave this run" are never blocked by the guard. "Start over"
  does open one, because it changes the card (FR-012).
- A press on "Start over" during a mark's exit keeps that mark. It was applied and
  written on the press, so the restart discards it the way it discards the rest of
  the run — deliberately, not by losing it (FR-005d, FR-014).
- Leaving the run, or closing the tab, at any point during a transition keeps the
  mark. There is no window in which an outcome exists on screen but not in storage
  (FR-014).
- During an exit the engine has already moved to the next card while the previous
  one is still painted. Only the painting lags; every read of what is true — the
  progress bars, the storage write, what a resume comes back to — follows the
  engine, not the paint.
- The pronounce button is guarded with the rest of the block (FR-011). A press on
  it inside the window is discarded like any other, so it can never speak the
  incoming word while the outgoing card is still on screen.
- A run resumed from storage plays its first card's entry and is not guarded: the
  card is pressable immediately on arrival. There is no earlier press to bounce
  from, so the guard would protect against nothing and only delay the learner.
- The guard is presentation state only. It is never written to storage, so a tab
  closed mid-window resumes on the same card with no guard pending.
- A press blocked by the guard must produce no record of any kind: no outcome, no
  storage write, no progress-bar movement.
- The very first card of a run has no exit to play — nothing preceded it. It plays
  an entry alone, and that is not a special case to write but the absence of a
  transition to run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After an outcome is recorded, the system MUST reject every further
  outcome press until a guard window of a defined duration has elapsed.
- **FR-002**: The guard MUST cover both outcome controls together — pressing one
  blocks both, not only the one pressed.
- **FR-003**: A press rejected by the guard MUST have no effect whatsoever: no
  card marked, no progress recorded, no stored state changed.
- **FR-004**: The guard MUST apply to every means of activating an outcome
  control, including touch, mouse, and keyboard activation and auto-repeat.
- **FR-005**: A card change MUST play in two phases: an **exit**, in which the
  outgoing card and the buttons leave as one group, and an **entry**, in which the
  incoming card and the buttons arrive as one group. Within each phase everything
  MUST share one timing and one curve, and MUST NOT animate independently.
- **FR-005a**: The motion MUST be restrained — a small, eased displacement, not a
  full-width slide or a large scale change. The buttons MUST return to the exact
  position and size they started from.
- **FR-005b**: The outcome buttons MUST dim across the exit and recover across the
  entry, reaching full strength as the entry ends. The two halves MUST meet at the
  same opacity, so the dim reads as one continuous gesture rather than two. This
  recovery is the only progress cue: the system MUST NOT show a countdown, numeric
  timer, or spinner, and MUST NOT give the buttons a greyed-out or switched-off
  appearance.
- **FR-005c**: The progress bars MUST animate their fill rather than jumping. They
  sit on a layer above the card and are **not** part of the moving group, so they
  are not required to share its timing: they advance on the press, under their own
  existing animation, while the card moves beneath them. The bar starting to fill
  as the card leaves is the learner's first confirmation that the press landed.
- **FR-005d**: The outcome MUST be applied, and recorded, **on the press** —
  before the exit begins. No outcome may ever be waiting on an animation to
  finish. The card that was on screen when the press landed MUST nonetheless
  remain painted for the whole of its exit, so what the learner sees leaving is
  the card they just marked.
- **FR-005e**: Every card change MUST play both phases, whatever caused it: a
  mark, a "Start over", the first card of a run (entry only — there is no outgoing
  card), and the run-complete screen (which is the entry for the last card's exit).
- **FR-006**: The guard window MUST span **both** phases: it opens on the press
  that starts the exit and closes on the entry's final frame. It MUST NOT be a
  duration of its own — it is exactly the exit plus the entry, so the two cannot
  disagree.
- **FR-007**: The exit and the entry each have one named duration, and both live in
  one place. Everything in the moving group — the card, the buttons, the dim and
  its recovery — and the guard window MUST all be **derived** from those two
  values, never given a number of their own, so a single edit retimes everything
  that has to agree. The progress bars are outside that group (FR-005c) and are
  exempt.
- **FR-007a**: The remaining feel of the motion — how far the block travels, and
  its easing — MUST be adjustable alongside that duration, in the same one place
  and without touching the guard logic. "Subtle, polished, tasteful" is a judgement
  reached by trying values, so the values MUST be cheap to try.
- **FR-008**: The system MUST remain correct with either or both durations set to
  zero — one press marks exactly one card, and the outcome still applies.
- **FR-009**: The run-complete screen MUST play an entry, and MUST NOT be guarded.
  Its controls are pressable from the frame it appears.
- **FR-010**: The guard MUST NOT be persisted. A run entered or resumed plays its
  first card's entry but is **not** guarded — there is no earlier press to bounce
  from, so the first card is pressable on arrival.
- **FR-011**: The guarded group is the card, the two outcome buttons, and the
  pronounce control. All three MUST move on the same timing and MUST become live
  again at the same moment.
- **FR-012**: "Start over" and "Leave this run" sit below the card block, do not
  move with it, and MUST NOT be blocked by the guard. "Start over" does change the
  card, so it plays both phases and opens a guard window over the outcome controls
  while it runs — otherwise the restarted card would arrive unprotected under a
  finger.
- **FR-013**: A card change starting while another is still in flight MUST replace
  it, not queue behind it. Because every outcome is already applied and recorded by
  then (FR-005d), there is never a pending outcome to cancel — an interrupted
  transition can lose only an animation, never a mark.
- **FR-014**: No outcome may be lost to an interruption. Closing the tab, leaving
  the run, or restarting at any point during a transition MUST leave the mark that
  started it already recorded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A second activation arriving within the guard window never records an
  outcome — 0 out of 100 attempts mark a second card.
- **SC-002**: A learner deliberately marking cards in sequence is never blocked:
  every press made after the transition has finished registers on the first try.
- **SC-003**: On marking a card, nothing on the screen snaps while something else
  eases. Within the moving group the outgoing card and the buttons leave together,
  and the incoming card and the buttons arrive together and come to rest at one
  moment. The bars ease too, on their own layer and their own timing.
- **SC-003a**: The two phases read as one gesture. A viewer watching the screen
  cannot point to the frame where the exit ended and the entry began.
- **SC-003b**: A mark survives an interruption at every point in the transition.
  Closing the tab one frame after the press resumes on the *next* card, not the
  one just marked.
- **SC-004**: Retiming either phase is a one-value edit in one file, and the guard
  window follows without being touched. Adjusting travel or easing is a one-value
  edit in the same file. None of it requires a change to any test that describes
  behaviour rather than timing.
- **SC-005**: A learner asked to describe what happened says the screen was
  changing cards. They do not describe the buttons as broken, stuck, or switched
  off — the wait reads as the transition, not as a restriction.

## Assumptions

- **Scope is the card block: card, both outcome buttons, and the pronounce
  control.** The buttons on the run-complete screen sit elsewhere on the page, so
  they are not part of the reported problem and get no guard.
- **The outgoing card's direction carries no meaning.** "Got it" and "Not yet" do
  not send the card different ways. That would be a new feature, not a fix for the
  double tap.
- **A starting duration around a third of a second** is assumed as the first value
  to tune from: long enough to swallow a finger bounce, short enough that an adult
  marking quickly does not feel held up. The point of FR-007 is that this number
  is expected to change, so it is a starting point rather than a requirement.
- **The mark is never in flight; only the picture is.** The outcome and its
  storage write happen on the press, so no interruption can lose one. The cost is
  that during an exit the card being painted is one behind the engine. That
  divergence is deliberately confined to a single value — which card to draw — and
  lasts one exit. It is cheaper than a lost mark, and it removes the failure mode
  the alternative created: an outcome scheduled to apply later, landing after a
  "Start over" onto a run it was never meant for.
- **The screen has two layers, and only one of them is the group.** The card and
  its buttons move together as one block. The progress bars are fixed above it and
  simply respond when their value changes — no coordination needed, because
  nothing about them is trying to look like part of the card. A press landing
  inside the guard window is discarded outright, so motion in the block can never
  cause a *wrong* mark, only a press that does nothing.
- **The block returns to exactly where it started.** Travel is displacement, not
  relocation: sizes and resting positions are unchanged, so a learner's aim on the
  next card is the same as on this one.
- **Reduced-motion and screen-reader behaviour are out of scope**, per the
  maintainer. No reduced-motion variant is specified, and no assistive-technology
  announcement is required or gated on.
- **No change to what is stored.** The guard is transient screen state, so no
  stored-data version change or migration is involved.
