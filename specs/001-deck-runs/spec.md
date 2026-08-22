# Feature Specification: Deck Runs

**Feature Branch**: `001-deck-runs`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "the core workflow for flash cards based learning is to start with a deck of cards pertaining to a particular concept. for the first few decks we can start with dolch sight words for pre-k and k. when the user starts with a deck, we have the notion of 'runs'. a 'run' is taking a part of the deck, and then showing the user one card at a time. then we have the user either 'pass' the card or 'fail' the card. once they go through all the cards, they again go through failed cards and try to pass some more, whittling down the list of failed cards until they are down to zero. at this point the run is successful. now the user can repeat the run or try an expanded run which includes all cards from the initial run plus a few more from the deck. user can keep expanding their cards this way until they master a run that contains the entire deck. we probably want to standardize the way a deck is added so that we can 'configure' a new deck by putting together the things in the deck, whats in the smallest run, the next bigger run, the next bigger run, etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a run by clearing every card (Priority: P1)

A learner opens a deck and starts its smallest run. Cards appear one at a time. Each card is
marked pass or fail. After the last card, every card that was failed comes back for another
attempt. That repeats — each cycle presenting only the cards still unpassed — until no failed
cards remain. The run is then complete.

**Why this priority**: This is the entire learning mechanic. Without it there is no product.
Every other story is navigation around this loop.

**Independent Test**: Load a deck with a small run, mark a mix of passes and fails, and confirm
that failed cards re-present in later cycles, that passed cards do not, and that the run reports
success only when the failed set reaches zero.

**Acceptance Scenarios**:

1. **Given** a run of 5 cards, **When** the learner passes all 5 on the first cycle, **Then** the
   run completes immediately with no repeat cycle.
2. **Given** a run of 5 cards where 2 were failed, **When** the first cycle ends, **Then** a second
   cycle begins containing exactly those 2 cards and nothing else.
3. **Given** a repeat cycle of 2 cards, **When** 1 is passed and 1 failed, **Then** a further cycle
   begins containing exactly the 1 still-failed card.
4. **Given** any cycle, **When** the last remaining failed card is passed, **Then** the run is
   recorded as successful.
5. **Given** a card was passed in an earlier cycle, **When** later cycles run, **Then** that card is
   never shown again in this run.

---

### User Story 2 - Climb the ladder from smallest run to whole deck (Priority: P2)

After completing a run, the learner can either repeat that same run or move up to the next run on
the deck's ladder. Each rung contains every card from the rung below plus additional cards from the
deck. The top rung is the entire deck. Completing the top rung means the deck is mastered.

**Why this priority**: This is what turns a single practice session into progression. It depends on
Story 1 existing but adds the sense of advancement that makes a learner return.

**Independent Test**: Complete the smallest run on a deck, confirm the next rung is offered, start
it, and verify it contains all previous cards plus the new ones. Confirm the top rung equals the
full deck and that completing it marks the deck mastered.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the result is shown, **Then** the learner is offered both
   "repeat this run" and "next run" as choices.
2. **Given** rung 1 contains cards A–E and rung 2 is configured as A–J, **When** rung 2 starts,
   **Then** all of A–E appear in it along with F–J.
3. **Given** the learner is on the top rung, **When** it completes, **Then** the deck is marked
   mastered and no larger run is offered.
4. **Given** a rung has never been completed, **When** the learner views the ladder, **Then** rungs
   above the highest completed one are visible but not startable.
5. **Given** a completed rung, **When** the learner chooses to repeat it, **Then** a fresh run of
   the same card set begins and prior mastery is not lost.

---

### User Story 3 - Pick up a deck and see where you left off (Priority: P3)

Returning to the app, the learner sees their decks with progress shown — which rung is next, which
decks are mastered. Progress survives closing the browser and reopening later.

**Why this priority**: Valuable for retention but the loop works without it. A learner could
complete runs in a single sitting with no persistence at all.

**Independent Test**: Complete a rung, close the browser entirely, reopen the app, and confirm the
deck list shows the completed rung and offers the correct next one.

**Acceptance Scenarios**:

1. **Given** completed rungs on a deck, **When** the learner reopens the app later, **Then** the
   deck shows the highest rung completed and offers the next one.
2. **Given** a deck never started, **When** viewed in the list, **Then** it shows as not started
   and offers its smallest run.
3. **Given** a mastered deck, **When** viewed in the list, **Then** it is marked mastered and any
   rung remains available to repeat.

---

### Edge Cases

- A run where every card is failed on the first cycle: the second cycle contains the whole run,
  and the loop continues normally rather than treating it as a failure state.
- A learner who never passes a particular card: the run cannot complete. There is no cap on
  cycles, so the learner needs a way to leave a run without completing it.
- Leaving mid-run (closing the tab, losing power, navigating away): the run resumes where it
  stopped, including mid-cycle.
- Stored in-progress run state whose deck or rung no longer matches a revised deck configuration:
  the run is discarded rather than resumed into an inconsistent state.
- Resuming a run whose current card was already marked before the interruption.
- A deck whose ladder has a single rung equal to the whole deck: the smallest run is also the top
  run, and completing it masters the deck in one go.
- A deck config where a rung does not contain every card of the rung below it: this is invalid and
  must be rejected rather than producing a run that silently drops cards.
- A deck config whose top rung omits cards present in the deck: those cards would be unreachable,
  so this is invalid.
- Duplicate cards within a deck.
- Stored progress that references a deck or card that no longer exists after a deck is revised.
- Very long runs where a learner may need to see how many cards remain in the current cycle.

## Requirements *(mandatory)*

### Functional Requirements

**Decks and cards**

- **FR-001**: System MUST present a set of built-in decks the learner can choose from, with Dolch
  sight word decks for Pre-K and Kindergarten included as the initial content.
- **FR-002**: System MUST define decks through a standard configuration format specifying the
  deck's identity, its cards, and its ordered ladder of runs.
- **FR-003**: Deck configuration MUST express each rung of the ladder such that every rung contains
  all cards of the rung below it, and the top rung contains every card in the deck.
- **FR-004**: System MUST reject a deck configuration that violates FR-003, rather than loading it
  partially.
- **FR-005**: Adding a new deck MUST require only supplying a new configuration in that format, with
  no change to the run mechanic.

**The run loop**

- **FR-006**: System MUST present the cards of a run one at a time.
- **FR-007**: Users MUST be able to mark the currently shown card as either passed or failed.
- **FR-008**: System MUST, after the final card of a cycle, begin a new cycle containing exactly the
  cards failed during that cycle.
- **FR-009**: System MUST exclude a card from all later cycles of a run once it has been passed.
- **FR-010**: System MUST repeat cycles until no failed cards remain, at which point the run is
  recorded as successfully completed.
- **FR-011**: System MUST NOT cap the number of cycles in a run.
- **FR-012**: Users MUST be able to abandon a run in progress and return to the deck without
  recording a completion.
- **FR-013**: System MUST show, during a run, how many cards remain in the current cycle.

**The ladder**

- **FR-014**: On completing a run, system MUST offer the learner the choice to repeat that run or
  start the next rung.
- **FR-015**: System MUST make a rung startable only when the rung below it has been completed at
  least once, except the smallest rung, which is always startable.
- **FR-016**: System MUST allow any previously completed rung to be repeated at any time.
- **FR-017**: System MUST mark a deck as mastered when its top rung is completed.
- **FR-018**: Repeating a rung MUST NOT reduce or reset previously earned progress.

**Progress**

- **FR-019**: System MUST persist, per deck, the highest rung completed and whether the deck is
  mastered, so progress survives closing and reopening the browser.
- **FR-020**: System MUST show each deck's progress in the deck list.
- **FR-021**: System MUST continue to function when no prior progress exists, presenting every deck
  as not started.
- **FR-022**: System MUST handle stored progress that references decks or cards no longer present,
  without failing to start.

**Cards and marking**

- **FR-023**: System MUST present each card of the initial decks with a single visible face. A
  sight word card's content is the word itself; there is nothing hidden and nothing to reveal.
- **FR-024**: Deck configuration MUST be able to express a card as a question paired with an
  answer, so two-sided decks can be added later without rewriting existing single-sided deck
  configurations and without changing the run mechanic.
- **FR-025**: A supervising adult marks each card's outcome on the learner's behalf.
- **FR-026**: Marking controls MUST be operable by an adult or a child. No size, placement, or
  wording choice may assume only one of them will use it.
- **FR-027**: The two outcomes MUST be labeled on screen in encouraging, child-appropriate
  language rather than the words "pass" and "fail". Decided 2026-08-22: "Got it" and "Not yet".

**Resuming an unfinished run**

- **FR-028**: System MUST persist run progress as it happens: which rung, which cycle, which cards
  have been passed, which are still failed, and which card is current.
- **FR-029**: On returning to a deck with an unfinished run, system MUST offer to resume it from
  exactly where it stopped.
- **FR-030**: A resumed run MUST NOT re-present cards already passed earlier in that run.
- **FR-031**: Resume and restart MUST be offered together, at the moment an unfinished run is
  surfaced. A learner who has forgotten where they were must not have to resume in order to find
  the way to start over.
- **FR-032**: Restarting a rung MUST discard only that unfinished run. Completed rungs, mastery,
  and other decks' runs are untouched, and the rung stays unlocked.
- **FR-033**: Restarting MUST be reachable during a run as well, not only before resuming it.
- **FR-034**: Navigation MUST be a tree: deck list → a deck's rung ladder → a run. Leaving a run
  returns to that deck's ladder; leaving a deck returns to the deck list.
- **FR-035**: Entering a deck that has an unfinished run MUST surface it on the rung it belongs to,
  so resuming is the obvious next tap rather than something to hunt for.
- **FR-036**: Each deck MUST retain its own unfinished run independently. Going home and working on
  a different deck MUST NOT disturb the first deck's position.
- **FR-037**: One unfinished run per deck is a consequence of this shape, not a rule the system
  enforces. Progress within a deck is linear, so the situation does not arise. There is no guard,
  no reconciliation logic, and no error state for it.

**Storing progress so it can grow**

- **FR-038**: Stored progress MUST use an additive shape. Introducing a new field in a later version
  MUST NOT invalidate records written by an earlier version.
- **FR-039**: Reading stored progress MUST fill absent fields with defaults rather than rejecting
  the record. A record missing a field added after it was written is valid.
- **FR-040**: A stored record MUST NOT be discarded solely because an earlier version wrote it.
- **FR-041**: Fields the current version does not recognize MUST be left intact when a record is
  written back, so data is not destroyed by a version that predates it.
- **FR-042**: Upgrading the app MUST preserve completed rungs, mastery, and any unfinished run.

### Key Entities *(include if feature involves data)*

- **Deck**: A named set of cards about one concept, plus its ladder. Has an identity, a title, and
  the run ladder definition. Dolch Pre-K and Dolch Kindergarten are the first two.
- **Card**: A single item shown during a run. Belongs to exactly one deck. Carries content that is
  a single face today and can carry a question/answer pair in future decks.
- **Rung**: One step of a deck's ladder, defined as a set of that deck's cards. Ordered, strictly
  containing the rung below, with the top rung equal to the whole deck.
- **Run**: One attempt at a rung. Made up of one or more cycles, and ends either completed (no
  failed cards remain) or abandoned.
- **Cycle**: One sweep through the cards still unpassed in a run. The first cycle is the whole rung;
  each later cycle is exactly the cards failed in the cycle before it.
- **Deck Progress**: Per deck, the highest rung completed and whether the deck is mastered.
- **Run State**: The unfinished run for a deck, if any — its rung, its cycle, which cards are passed
  and which still failed, and the current card. Held per deck, independently of other decks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can go from opening the app to seeing the first card of a run in under 15
  seconds, with no setup, account, or configuration step.
- **SC-002**: Marking a card and seeing the next one feels immediate, with no perceptible wait.
- **SC-003**: 100% of cards failed in a cycle reappear in the next cycle, and 0% of passed cards do.
- **SC-004**: A run reports success only when every card in it has been passed at least once — never
  earlier.
- **SC-005**: Every rung above the smallest contains 100% of the cards from the rung below it.
- **SC-006**: Progress recorded before closing the browser is present on reopening, in 100% of
  cases where the browser retains site data.
- **SC-007**: A new deck can be added by supplying only a configuration in the standard format, with
  no change to the run mechanic.
- **SC-008**: An adult can watch a child complete a run and understand at every point how many cards
  are left in the current cycle without asking.
- **SC-009**: A run interrupted at any point resumes at that exact point, with 0% of already-passed
  cards re-presented.
- **SC-010**: Adding a two-sided deck later requires no change to existing single-sided deck
  configurations.
- **SC-011**: A learner who upgrades to a newer version of the app loses 0% of their completed
  rungs, mastery, and in-progress run.
- **SC-012**: Adding a new field to stored progress requires no migration of existing records.
- **SC-013**: A learner can leave a deck mid-run, work on a different deck, and return to find the
  first deck exactly where they left it — same rung, same cycle, same card.
- **SC-014**: Resuming an unfinished run takes at most three taps from opening the app: deck, rung,
  resume.
- **SC-015**: A learner returning to a half-finished run can start it over without first resuming
  it, and doing so costs them 0% of their completed rungs or mastery.

## Assumptions

- **Single learner per browser.** No profiles, accounts, or switching between children. Progress
  belongs to whoever uses that browser. Multiple children would need separate browsers or devices.
  Chosen to keep initial scope minimal; profiles can be added later if asked for.
- **Learner age drives the interface.** Pre-K and Kindergarten means large text, few controls on
  screen, and no reading-dependent navigation for the learner.
- **Sight word cards are text.** No images or audio in the initial decks.
- **Automated pass/fail marking is out of scope.** The adult tapping is how outcomes are produced
  for now. Detecting outcomes automatically per card type — for instance treating a revealed answer
  as a failure — is a known future direction and is deliberately not designed for here.
- **Outcome wording is "Got it" / "Not yet".** Settled 2026-08-22. Changing it later is a label
  change, not a design change.
- **Built-in decks only.** Learners choose from decks that ship with the app. Creating or editing
  decks in the interface is out of scope; new decks arrive as configuration.
- **Dolch word lists are public domain.** Published 1936 and in wide free use in education.
- **No timing, scoring, or streaks.** Pass and fail are the only signals. No stars, points, or
  spaced-repetition scheduling — none of that was asked for.
- **Cards are presented in a consistent order within a cycle** unless randomization is requested.
- **No sharing, export, sync, or printing.**
- **Offline-capable by nature**, since decks ship with the app and progress is stored locally.
