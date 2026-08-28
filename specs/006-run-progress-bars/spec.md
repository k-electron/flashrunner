# Feature Specification: Run Progress Bars

**Feature Branch**: `006-run-progress-bars`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Instead of the text \"x cards left in this round\", we need to have 2 subtle progress indicators. the first progress indicator is how many cards of the current rung were successfully 'got it'. when this progress indicator goes to full, the run is done. the second progress indicator is how many cards were progressed in the current cycle regardless of 'got it' or 'not yet'. essentially this just tracks progress through the current cycle and resets every time a new cycle starts. please ask me a lot of questions around placement, options for what visuals to use, etc. likely we will want to use something from the shadcn/ui."

## Supersedes

This feature replaces the numeric sentence introduced by `001-deck-runs`:

- **001-deck-runs FR-013** — "show, during a run, how many cards remain in the current cycle." The
  same information is now carried graphically, and the count is no longer written out.
- **001-deck-runs SC-008** — the criterion that an adult can read the remaining-in-cycle count
  "without asking" is restated here as SC-002, against a bar rather than a sentence.

Nothing else in `001-deck-runs` changes. The mechanic, the cycle rules, the shuffle, and the
persistence contract are untouched — this feature only changes how the run's state is displayed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A learner sees how close the run is to being over (Priority: P1)

A young pre-reader is working through a run. They cannot read the sentence "3 cards left in this
round" — it is written for the adult, not for them. What they can read is a bar that grows. Every
time they get a word right, the top bar grows a little. When it reaches the end, the run is over.
Nothing else fills that bar: getting a word wrong leaves it exactly where it was, so the bar only
ever means "words I have got right".

**Why this priority**: This is the primary ask and the only indicator with a payoff. It gives a
pre-literate learner a legible sense of progress toward the end of the run, which the current text
cannot do for them at all.

**Independent Test**: Start a run on a rung of known size, mark cards "Got it" one at a time, and
confirm the top bar advances by an equal step each time and is exactly full at the moment the run
completes. Mark a card "Not yet" and confirm the bar does not move.

**Acceptance Scenarios**:

1. **Given** a fresh run on a 5-card rung, **When** the run screen first appears, **Then** the run
   indicator is empty.
2. **Given** a fresh run on a 5-card rung, **When** the learner marks two cards "Got it", **Then**
   the run indicator is two fifths full.
3. **Given** a run with the run indicator two fifths full, **When** the learner marks the next card
   "Not yet", **Then** the run indicator does not move.
4. **Given** a run where every card but one has been got, **When** the learner marks that last card
   "Got it", **Then** the run indicator is completely full and the run-complete screen is shown.
5. **Given** a run in any state, **When** the learner chooses "Start over", **Then** the run
   indicator returns to empty.
6. **Given** a run that was interrupted with the run indicator part-full, **When** the learner
   returns to that run, **Then** the run indicator is at the same fill it was at when they left.

---

### User Story 2 - An adult sees how far through the current pass the child is (Priority: P2)

A supervising adult wants to know whether this pass through the cards is nearly done, so they know
whether to interrupt now or wait. A second, fainter bar tracks position through the current cycle
and moves on every card regardless of the outcome. When a cycle ends and a new one begins with only
the missed cards, that bar visibly rewinds to empty and begins again — which is itself the signal
that a new pass has started.

**Why this priority**: This preserves what the removed sentence actually told the adult. It is
secondary because the run indicator alone is a viable improvement over the text, and this one is
supporting information.

**Independent Test**: Start a run, mark cards with a mix of outcomes, and confirm the second bar
advances on every mark irrespective of outcome, then returns to empty at the first card of the next
cycle.

**Acceptance Scenarios**:

1. **Given** a fresh run on a 5-card rung, **When** the learner marks a card "Not yet", **Then** the
   cycle indicator advances by one fifth even though the run indicator did not move.
2. **Given** a 5-card cycle with four cards marked, **When** the learner marks the fifth and at
   least one card was missed, **Then** a new cycle begins and the cycle indicator is empty again.
3. **Given** a repeat cycle containing two cards, **When** the learner marks one of them, **Then**
   the cycle indicator is half full — measured against this cycle's two cards, not against the
   rung's original size.
4. **Given** a run that was interrupted mid-cycle, **When** the learner returns to that run,
   **Then** the cycle indicator is at the same fill it was at when they left.

---

### User Story 3 - The indicators stay readable and stay out of the way (Priority: P3)

The indicators sit at the very top edge of the screen and remain there while the rest of the screen
scrolls beneath them, so they never move, never compete with the word on the card, and never sit
between the word and the two outcome buttons. On a wide screen they do not stretch across the whole
display: they stay the width of the run's own content and stay centred beneath it, so they read as
part of the run rather than as browser chrome.

**Why this priority**: Placement is what makes the indicators "subtle" rather than a second thing to
look at. It is separable from either indicator's correctness.

**Independent Test**: Open a run on a narrow viewport and a very wide one; confirm the bars are
capped to the content width and centred in both, that they stay at the top edge while the page
scrolls, and that no heading or card is obscured by them.

**Acceptance Scenarios**:

1. **Given** a very wide viewport, **When** a run is on screen, **Then** the indicators are no wider
   than the run's content column and are horizontally centred over it.
2. **Given** a viewport short enough that the run screen scrolls, **When** the learner scrolls,
   **Then** the indicators remain at the top edge of the viewport and no part of the run's heading
   is hidden behind them.
3. **Given** a run is on screen, **When** the learner looks at the area between the card and the
   outcome buttons, **Then** there is nothing there — no sentence, no bar.

---

### Edge Cases

- **A one-card rung.** The run indicator has a single step: empty, then full at completion. The
  cycle indicator behaves the same way. Neither divides by zero, because a rung always has at least
  one card.
- **A repeat cycle of one card.** The cycle indicator goes from empty to full in one mark. This is
  correct, not a glitch: the cycle genuinely contains one card.
- **A repeat cycle that is shorter than the previous one.** The cycle indicator's track does not
  change size; only what one mark is worth changes. A mark in a 2-card cycle moves the bar half way.
- **The last card of a cycle when every card was got.** The run completes rather than opening a new
  cycle, so both indicators end full and neither rewinds.
- **The run-complete screen.** Both indicators remain visible and both read full. The run indicator
  being full is the visual statement that the run is done, so removing it at the moment it is
  earned would discard the payoff.
- **"Start over" mid-run.** Both indicators return to empty, because a restart is a fresh run.
- **The storage-full notice.** The indicators are unaffected. They are derived from the run in
  memory, so they keep working accurately even when nothing can be written to the device.
- **A deck or rung that does not exist.** The "Run not found" screens have no run, so they show no
  indicators.
- **A reduced-motion preference.** Not handled. The bars animate for everyone, including a device
  asking for reduced motion. This is a deliberate decision, not an oversight — see Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

#### The two indicators

- **FR-001**: The run screen MUST show two progress indicators while a run is on screen: a **run
  indicator** and a **cycle indicator**, in that order top to bottom.
- **FR-002**: The run indicator MUST measure the number of cards of the current rung marked "Got it"
  so far in this run against the total number of cards in that rung.
- **FR-003**: The run indicator MUST NOT advance when a card is marked "Not yet", and MUST NOT ever
  move backwards within a single run.
- **FR-004**: The run indicator MUST be exactly full when, and only when, the run is complete. It
  MUST NOT reach full before the run completes, and MUST NOT stop short of full once it has.
- **FR-005**: The cycle indicator MUST measure how many cards of the current cycle have been marked
  against the number of cards in that cycle, counting every mark regardless of outcome.
- **FR-006**: The cycle indicator MUST return to empty when a new cycle begins, and MUST be measured
  against the new cycle's own card count from that point on — not against the rung's size.
- **FR-007**: The cycle indicator's track MUST stay the same width in every cycle. A shorter cycle
  makes each mark worth more of the track; it does not make the track shorter.
- **FR-008**: Both indicators MUST return to empty when the learner chooses "Start over", and when a
  completed run is repeated.
- **FR-009**: Both indicators MUST be restored to the state they were in when a resumed run is
  re-entered, to the same accuracy as the run itself resumes.

#### Removing the text

- **FR-010**: The sentence "N cards left in this round" MUST be removed from the run screen. No
  replacement sentence is added.
- **FR-011**: Neither indicator MUST show any visible text, number, label, or caption. They are
  graphical for sighted users.

#### Form and placement

- **FR-012**: Both indicators MUST be horizontal bars that fill from the leading edge, sharing the
  same width, alignment, and corner treatment.
- **FR-013**: The run indicator MUST be visibly thicker than the cycle indicator, so the two are
  distinguishable by mass alone. The distinction MUST NOT depend on colour, so that it survives
  light mode, dark mode, and any future theme.
- **FR-014**: Both indicators MUST use the existing theme's colours. No new colour MUST be
  introduced for this feature.
- **FR-015**: The pair MUST sit at the top edge of the viewport and MUST remain there while the rest
  of the run screen scrolls beneath them.
- **FR-016**: The pair MUST be constrained to the same width as the run screen's content column and
  centred over it, so it does not span a wide display edge to edge.
- **FR-017**: The pair MUST NOT obscure any part of the run screen. Content that would otherwise sit
  under them MUST be pushed clear.
- **FR-018**: Nothing MUST be placed between the card and the outcome buttons, where the removed
  sentence used to sit.
- **FR-019**: The indicators MUST NOT appear on the "Run not found" screens, which have no run.
- **FR-020**: The indicators MUST remain visible on the run-complete screen, both reading full.

#### Behaviour on change

- **FR-021**: Both indicators MAY animate between values, and the cycle indicator's return to empty
  MAY be shown as the bar travelling back rather than snapping. No behaviour is required to vary with
  the device's reduced-motion preference.
- **FR-022**: Pressing the pronounce control MUST NOT move either indicator, since it records no
  outcome and advances nothing.

#### Assistive technology

- **FR-023**: Each indicator MUST be exposed to assistive technology as a named progress indicator,
  so a screen reader user can tell the two apart and can obtain the same information a sighted user
  reads from the bars.
- **FR-024**: What assistive technology announces MUST be expressed as a count of cards, not as a
  percentage — the run indicator as cards got out of the rung's total, the cycle indicator as cards
  marked out of this cycle's total.
- **FR-025**: The indicators MUST be reachable in reading order before the run's heading and card,
  matching their position on screen.

### Key Entities

No new stored or authored data. Both indicators are derived, at display time, from run state that
already exists:

- **Cards got this run** — the run's existing record of every card marked "Got it", which never
  shrinks. Numerator of the run indicator.
- **Rung size** — the number of cards the current rung declares. Denominator of the run indicator,
  and a constant for the whole run.
- **Position in cycle** — the run's existing index into the current cycle's queue. Numerator of the
  cycle indicator.
- **Cycle size** — the length of the current cycle's queue. Denominator of the cycle indicator, and
  a constant for one cycle only.

Because all four already exist and are already persisted, nothing new is written to the device and
the stored-record format does not change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pre-reader who cannot read any word on screen can still tell, from the top bar
  alone, whether the run is near its start, near its middle, or near its end.
- **SC-002**: An adult watching a child complete a run can tell at every point how far through the
  current pass the child is, without asking and without reading any text.
- **SC-003**: The run indicator reads full at exactly the same moment the run-complete screen
  appears — never a card early, never a card late — for every rung in every shipped deck.
- **SC-004**: Across a complete run on any rung, the run indicator moves in exactly as many steps as
  the rung has cards, and never once moves backwards.
- **SC-005**: 100% of "Not yet" marks advance the cycle indicator and leave the run indicator
  unmoved.
- **SC-006**: The cycle indicator reads empty on the first card of every cycle, including cycle 0
  and every repeat cycle.
- **SC-007**: No numeric or textual progress information is visible anywhere on the run screen.
- **SC-008**: On a display of any width from a small phone to an ultra-wide monitor, the indicators
  are no wider than the run's own content and are centred over it.
- **SC-009**: No part of the run screen is ever hidden behind the indicators, at any viewport size,
  at any scroll position.
- **SC-010**: A screen reader user can obtain both counts as cards rather than percentages, and can
  distinguish the two indicators by name.

## Assumptions

- **Rung size is the run indicator's denominator.** The rung's declared card list is the total, not
  the deck's. This follows from the request naming "the current rung".
- **A card can only be got once.** Once a card is marked "Got it" it is never presented again in
  that run, so the run indicator cannot double-count and full is reachable exactly once. This is
  already true of the existing mechanic; the indicator relies on it rather than re-checking it.
- **Both indicators stay on the run-complete screen.** The request does not say what happens after
  the last card. Keeping them, with the run indicator full, was chosen because a bar that vanishes
  at the instant it is earned throws away the one moment it was built for. Hiding them instead
  would be a small change if that reads better in use.
- **The cycle indicator's reset is allowed to animate backwards.** Chosen deliberately: the rewind
  is a free, wordless signal that a new pass has begun, and it costs nothing to build.
- **A reduced-motion preference is deliberately not honoured.** The maintainer's call, 2026-08-25,
  after the trade-off was put to them. The only motion this feature adds is a 12px-tall bar sliding
  for the framework's default 150ms — the mildest category of motion there is, and nothing like the
  full-screen movement the preference exists to suppress. Honouring it would mean editing a vendored
  component, because the transition sits on an element no prop reaches. Recorded here so a reviewer
  reads it as a decision rather than a gap. Revisit if this feature's motion ever grows.
- **No visual distinction is made for cards that were missed.** The run indicator is filled or
  empty, with no third state for "seen but not got". This keeps it monotonic and keeps a tally of a
  child's mistakes off the screen.
- **The existing component library covers this.** The indicators are expected to be built from the
  project's existing UI component set and its existing dependencies, adding no new package. If that
  turns out to be false, it is a question for planning, not a change to this specification.
- **Out of scope.** No indicators are added to the deck list or the deck ladder; no per-deck or
  per-ladder progress bar is introduced; the run mechanic, the shuffle, the cycle rules, the
  outcome buttons, the pronounce control, and the storage format are all unchanged.
