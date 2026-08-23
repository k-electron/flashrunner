# Feature Specification: Random Run Order

**Feature Branch**: `002-random-run-order`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "we need to make the 'in run' ordering of cards random. obviously picking up an unfinished run shouldn't get messed up. so once a run starts it should have it's seed locked or something to make sure its random from the user's perspective, but completely deterministic through resumes and serves exactly the right cards even through a resume. for the random number generator, we don't need cryptographic strength or anything, so use a basic standard rng."

## Clarifications

### Session 2026-08-23

- Q: Are repeat cycles shuffled, or do failed cards keep the order they were failed in? → A: Shuffled. Every cycle, including every repeat cycle.
- Q: Is a seed stored, given the run's card order is already persisted? → A: No. The persisted order is the lock. Storing a seed as well would be redundant, so the stored shape stays as it is.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cards come up in a different order every time (Priority: P1)

A learner starts a rung. The cards arrive in a shuffled order. Failing some cards brings them back
in a shuffled order too. Running the rung again produces another order. The learner is practising
the words, not the running order of a list.

**Why this priority**: The whole request. A fixed order lets a learner chant a memorized sequence
and clear a rung without recognizing a card.

**Independent Test**: Start the same rung several times, fail a known set each time, and confirm
both the first cycle and the repeat cycles vary in order while the card sets never do.

**Acceptance Scenarios**:

1. **Given** a rung of 5 cards, **When** a run starts, **Then** all 5 are presented exactly once, in
   a shuffled order.
2. **Given** several fresh runs of one rung, **When** their first cards are compared, **Then** they
   are not all the same card.
3. **Given** cards failed in the order C, A, D, **When** the next cycle begins, **Then** it contains
   exactly C, A and D, shuffled rather than in fail order.
4. **Given** a run reaching cycle 3 or beyond, **When** each cycle begins, **Then** it is shuffled
   like every cycle before it.
5. **Given** any shuffled cycle, **When** its cards are compared to the cards that cycle should
   contain, **Then** the sets match exactly.

---

### User Story 2 - An interrupted run picks up exactly where it was (Priority: P1)

A learner is partway through a run when the tab closes or a parent navigates away. On returning, the
run resumes on the same card, and the cards still to come arrive in the same order they would have
without the interruption. Nothing already passed comes back.

**Why this priority**: Inseparable from Story 1. Reshuffling on resume would re-present passed
cards, drop unseen ones, and change what completing a rung means.

**Independent Test**: Run partway, record the exact remaining sequence, interrupt, resume, and
confirm the remaining sequence and current card are unchanged.

**Acceptance Scenarios**:

1. **Given** an unfinished run showing card X, **When** the learner leaves and returns, **Then** the
   run resumes showing card X.
2. **Given** an unfinished run, **When** it resumes, **Then** the cards still to come arrive in
   exactly the order they would have without the interruption.
3. **Given** a run interrupted and resumed repeatedly at different points, **When** it finishes,
   **Then** the full sequence presented matches an uninterrupted playthrough of that run.
4. **Given** cards already passed in the run, **When** it resumes, **Then** none is presented again.
5. **Given** a run resumed mid-cycle, **When** that cycle ends, **Then** the next cycle contains
   exactly the cards failed in it, as it would have without the interruption.

---

### User Story 3 - Starting over gives a genuinely new order (Priority: P2)

A learner restarts an unfinished run, or repeats a rung they already cleared. The new run is a new
shuffle, not a replay of the old one.

**Why this priority**: Without it, restarting to escape a memorized order hands the same order back.
Narrow case, same mechanism as Story 1.

**Independent Test**: Get partway into a run, restart, and confirm the fresh run is not obliged to
reproduce the abandoned run's sequence.

**Acceptance Scenarios**:

1. **Given** an unfinished run, **When** the learner restarts it, **Then** the fresh run is shuffled
   anew rather than inheriting the discarded order.
2. **Given** a completed rung, **When** the learner repeats it, **Then** the new run is shuffled
   anew.
3. **Given** a restarted run, **When** it is interrupted and resumed, **Then** it resumes into the
   restarted run's order, never the discarded one's.

---

### Edge Cases

- A cycle of one card: one possible order. Not a failure of randomization.
- A cycle of two cards: half of all shuffles reproduce the previous order. Correct, and not retried.
- A larger shuffle that lands on the configuration order: presented as-is, never reshuffled until it
  "looks random".
- An unfinished run stored before this feature shipped: resumes in its recorded order.
- Unfinished runs in two decks at once: each order is independent.
- The same rung repeated twice: the two orders are overwhelmingly likely to differ, and matching by
  chance is legitimate.
- Deck configuration revised mid-run: the existing rule discarding a run whose cards no longer match
  its rung still applies, unchanged.
- A run reaching a very high cycle count because a card is never passed: shuffling continues per
  cycle, uncapped.

## Requirements *(mandatory)*

### Functional Requirements

**Random order**

- **FR-001**: Every cycle MUST present its cards in a shuffled order rather than the deck
  configuration's order.
- **FR-002**: Shuffling MUST apply to every cycle of a run — the first cycle and every repeat cycle.
- **FR-003**: A repeat cycle's order MUST NOT be the order in which its cards were failed.
- **FR-004**: A shuffled cycle MUST contain exactly the cards that cycle should contain — each once,
  none added, none dropped.
- **FR-005**: Every card in a cycle MUST be able to appear in every position across runs. No card
  may be structurally pinned to a position.
- **FR-006**: Randomization MUST affect presentation order only. Rung membership and cycle
  membership are unchanged.

**Locking the order**

- **FR-007**: A cycle's order MUST be fixed when that cycle begins and MUST NOT change while the
  cycle is in progress.
- **FR-008**: The order MUST be recorded with the run at the moment it is fixed, so it survives
  closing and reopening the browser.
- **FR-009**: The recorded order MUST be the single source of truth for what the run presents next.
  Nothing re-derives it.
- **FR-010**: No seed, generator state, or other value from which an order could be recomputed may
  be stored. The recorded order is the whole of it.

**Resuming**

- **FR-011**: Resuming MUST present the cards still to come in exactly the recorded order.
- **FR-012**: Resuming MUST leave the current card unchanged.
- **FR-013**: Resuming MUST NOT reshuffle the cycle in progress.
- **FR-014**: Resuming MUST NOT re-present a card already passed in that run.
- **FR-015**: Any number of interruptions and resumes MUST produce the same overall sequence as an
  uninterrupted playthrough of that run.
- **FR-016**: Interruption MUST be survivable at any point, including between marking a card and the
  next card appearing, and at a cycle boundary.

**Starting over**

- **FR-017**: Restarting an unfinished run MUST shuffle anew.
- **FR-018**: Repeating a completed rung MUST shuffle anew.
- **FR-019**: A restarted run MUST NOT be resumable into the discarded run's order.

**Stored records**

- **FR-020**: The persisted shape of a run MUST NOT change. The shuffled order occupies the field
  that already holds the run's card order, so there is no new field, no schema version change, and
  no migration.
- **FR-021**: An unfinished run stored before this feature MUST resume in its recorded order,
  unchanged and undiscarded.
- **FR-022**: Completed rungs and deck mastery MUST be unaffected.

**Randomness source**

- **FR-023**: The randomness source MUST NOT be required to be cryptographically strong. An ordinary
  general-purpose generator is sufficient.
- **FR-024**: Randomization MUST NOT require network access, a permission prompt, or an external
  service.

**Unchanged behavior**

- **FR-025**: The pass/fail mechanic, the construction of each cycle from the previous cycle's
  failures, run completion, rung unlocking, and mastery are unchanged.
- **FR-026**: The count of cards remaining in the current cycle MUST remain correct.
- **FR-027**: This feature MUST NOT add any interface element, setting, toggle, or control.

### Key Entities *(include if feature involves data)*

- **Presentation Order**: The sequence in which a cycle's cards are shown. Fixed when the cycle
  begins, recorded with the run, and the only authority on what comes next. Contains exactly that
  cycle's card set, reordered.
- **Run**: Unchanged. One attempt at a rung, made of one or more cycles, ending completed or
  abandoned.
- **Cycle**: Unchanged in membership — the first is the whole rung, each later one is exactly the
  cards failed in the cycle before. Only the order within it changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 20 fresh runs of a rung of 5 or more cards, the card presented first is not the
  same in all 20.
- **SC-002**: For a cycle of 5 cards shuffled many times, every card appears in every one of the 5
  positions at least once.
- **SC-003**: A repeat cycle reproduces the order its cards were failed in no more often than
  chance.
- **SC-004**: 100% of cycles contain exactly the card set they contained before this change — no
  card added, dropped, or duplicated by shuffling.
- **SC-005**: A run interrupted and resumed at any point presents a sequence identical to the
  uninterrupted playthrough of that run, in 100% of cases.
- **SC-006**: 0% of cards already passed in a run are re-presented after a resume.
- **SC-007**: 100% of unfinished runs stored before this feature remain resumable, 0% of completed
  rungs or mastery are lost, and 0 migrations are required.
- **SC-008**: A run completes only when every card in its rung has been passed at least once, in
  100% of runs.
- **SC-009**: Marking a card and seeing the next remains immediate, including at cycle boundaries
  where a shuffle occurs, for a cycle as large as the biggest deck.
- **SC-010**: A learner who repeats a cleared rung cannot clear it by reproducing the previous run's
  sequence of answers without looking at the cards.

## Assumptions

- Randomization is presentation-only. No deck configuration changes, and no deck is re-authored.
- Randomness quality beyond SC-001 through SC-003 is not required. The generator only has to be good
  enough that a child cannot predict the order.
- No user-facing surface: no shuffle toggle, no reshuffle control, no setting.
- Existing handling of a revised deck configuration is inherited unchanged.

## Dependencies

Builds on **001-deck-runs**, which defines decks, rungs, runs, cycles, the pass/fail mechanic, and
the persisted per-deck record. Every requirement here constrains that feature's behavior rather than
introducing a separate one. The persisted run's existing ordered card list is where the shuffled
order lives, which is why FR-020 costs no schema change.
