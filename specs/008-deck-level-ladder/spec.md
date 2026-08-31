# Feature Specification: Deck screen level ladder

**Feature Branch**: `008-deck-level-ladder`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "1. rungs on the ladder need to be called levels rather than 'x words'. 2. we need to invert the order in which they are displayed. lowest level on the bottom instead of top. 3. the final level should just be called 'full deck'. 4. if someone uses a url to advance ahead of their actual position, its ok to let them play the game, but the deck screen should be strictly monotonic in unlocks. 5. on the deck screen, a partially finished rung spreads itself over multiple rows. instead it should still stay in a single row with one wider button representing the entry point to the rung as it is today (which also resumes) and then a second less wide button for starting over. also this second button for starting over should be on the left side. color scheme for the start over button is already appropriate. 6. when a rung(level) is ever fully successed, the rung button should contain our circle-check next to the rung name text. this should stay that way even if the user comes back and retries formerly successed levels."

## Clarifications

### Session 2026-08-29

- Q: When someone completes a level out of order (by typing its run URL), should that completed level still be tappable from the deck screen, or locked until the levels below it are finished? → A: Locked. Startable is always Level 1 up to the first uncompleted level; a level completed out of order shows its completion mark but is not tappable from the deck screen. It stays reachable by URL. The goal is one simple rule an early reader can hold, not preventing URL editing — URL editing remains fine.
- Q: When a level has an unfinished run, should the small "Unfinished run" caption beside those buttons stay in the row, or be dropped? → A: Dropped. The row is the two controls and nothing else — "Start over" beside the level's own button already says what it is, and it saves width on a phone.
- Q: Which side of the level name does the completion mark sit on? → A: Left of the name. The control's content stays centre-justified as it is today, so the mark sits in the middle of the row with clear distance from the "Start over" button, not hard against it.
- Q: Should this ship as one PR or a stack? → A: One PR.
- Q: What should happen where a deck's highest level only adds a remainder to the level below it? → A: Collapse the two into a single level holding the full deck, and make that the deck's final level. Applies to every deck, now and later. Today it affects only `dolch-k-5` (50 words + 2 = one level of 52); `dolch-prek-5` ends on a full step of 5 and is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Levels read as levels, not word counts (Priority: P1)

A learner (and the adult beside them) opens a deck and sees a ladder of numbered
levels — "Level 1", "Level 2", and so on — with the last one named "Full deck".
The word counts that previously named each step are gone from every screen that
names a step.

**Why this priority**: This is the vocabulary the whole feature is stated in. Every
other story reads more clearly once the steps are called levels, and the rename
touches the same three screens the rest of the work touches.

**Independent Test**: Open each built-in deck and confirm no step is named "N
words" anywhere — the deck screen, the deck list status line, and the run header
all say "Level N" or "Full deck".

**Acceptance Scenarios**:

1. **Given** a deck with 8 steps, **When** the learner opens the deck screen, **Then** the steps are named "Level 1" through "Level 7" and "Full deck".
2. **Given** a learner who has completed the third step, **When** they view the deck list, **Then** the status line names that step "Level 3" and the next one "Level 4".
3. **Given** a learner in a run on the first step, **When** they look at the run header, **Then** it names the step "Level 1".
4. **Given** a learner on the last step of a deck, **When** they look at the deck screen or the run header, **Then** that step is named "Full deck" with no number.
5. **Given** the Kindergarten deck, whose last step used to add only two words to the one below it, **When** the learner opens it, **Then** there are ten levels — "Level 1" through "Level 9", then "Full deck" — and no level adds a part-step.

---

### User Story 2 - Climbing upward (Priority: P1)

The deck screen shows Level 1 at the bottom and the highest level at the top, so
the ladder is climbed upward the way a ladder is.

**Why this priority**: Pairs with the rename as the other half of "this is a
ladder of levels". Cheap, self-contained, and visible on the same screen.

**Independent Test**: Open a deck screen and read top to bottom — the levels
descend, ending with Level 1 as the last item on screen.

**Acceptance Scenarios**:

1. **Given** a deck with 8 levels, **When** the learner opens the deck screen, **Then** "Full deck" is the first level shown and "Level 1" is the last.
2. **Given** the inverted order, **When** the learner reads down the list, **Then** the locked levels appear above the unlocked ones with no interleaving.

---

### User Story 3 - One row per level, start-over on the left (Priority: P2)

A learner who left a run unfinished comes back to the deck screen. The level they
were on stays a single row: the level's own button — unchanged as the way into
that level, and now also the way to pick up where they left off — plus a narrower
"Start over" button to its left.

**Why this priority**: This is the layout defect named in the request. It only
affects learners with an unfinished run, so it is worth less than the two changes
every learner sees, but it is the one that currently looks broken.

**Independent Test**: Leave a run partway through, return to the deck screen, and
confirm that level occupies one row containing exactly two buttons, "Start over"
first and the level button second and wider.

**Acceptance Scenarios**:

1. **Given** an unfinished run on Level 3, **When** the learner opens the deck screen, **Then** Level 3 is one row containing a "Start over" button on the left and a wider "Level 3" button on the right, and no other text.
2. **Given** that row, **When** the learner taps the "Level 3" button, **Then** the run resumes where it was left.
3. **Given** that row, **When** the learner taps "Start over", **Then** the unfinished run is discarded and a fresh run of Level 3 begins.
4. **Given** no unfinished run on a level, **When** the learner opens the deck screen, **Then** that level is one row containing only its own button, full width.
5. **Given** an unfinished run, **When** the learner discards it with "Start over", **Then** no level's completed state and no other deck's progress changes.

---

### User Story 4 - A completed level stays marked (Priority: P2)

Once a learner finishes every card in a level, that level's button carries a
circle-check beside its name. The mark is permanent: it survives replaying the
level, and it is still there mid-replay and after a replay that is abandoned.

**Why this priority**: Replaces the separate "Completed" text with the icon
already used for the "Got it" outcome, so success is marked the same way
everywhere. Depends on nothing else here.

**Independent Test**: Complete a level, confirm the check appears on its button,
then start that level again and confirm the check is still there.

**Acceptance Scenarios**:

1. **Given** a level the learner has never finished, **When** they view the deck screen, **Then** its button shows the level name with no check.
2. **Given** a level the learner has finished, **When** they view the deck screen, **Then** its button shows a circle-check beside the level name.
3. **Given** a finished level, **When** the learner replays it and leaves the replay unfinished, **Then** the check is still on that level's button.
4. **Given** a finished level, **When** the learner replays it and fails cards, **Then** the check is still on that level's button.

---

### User Story 5 - The ladder never shows a gap (Priority: P3)

A learner who reached a level by editing the address bar can play it. The deck
screen, however, always offers an unbroken run of levels from Level 1 upward — it
never shows an unlocked level sitting above a locked one.

**Why this priority**: Only reachable by hand-editing a URL, so few learners hit
it. It matters because an early reader should be able to hold one rule about this
screen — the levels go in order and you are somewhere along them — and a gap
breaks that rule. It is not a barrier: URL entry stays open by design. It is the
least-seen of the five.

**Independent Test**: With no progress, navigate directly to a mid-deck level's
run URL and finish it, then open the deck screen and confirm the unlocked levels
still start at Level 1 and stop at the first unfinished one.

**Acceptance Scenarios**:

1. **Given** no completed levels, **When** the learner navigates directly to Level 5's run URL, **Then** the run screen plays Level 5 normally.
2. **Given** Level 5 completed but Levels 1–4 not, **When** the learner opens the deck screen, **Then** Level 1 is startable and every level above it — including the completed Level 5, and including Level 6, which the learner has just "earned" — is not.
3. **Given** that same state, **When** the learner looks at Level 5's button, **Then** it carries the circle-check and is not startable.
4. **Given** a learner who completes levels in order, **When** they open the deck screen, **Then** the unlocked levels are exactly the completed ones plus the next one — the behaviour they see today.

---

### Edge Cases

- A learner has an unfinished run on a level that is not startable (reached by URL). The deck screen shows that level as one row, not startable, with no "Start over" button — the row offers nothing, so there is nothing to lay out beside the level button.
- The last level is "Full deck" and also the level whose completion means the deck is mastered. Its button carries the circle-check like any other, in addition to the existing "Deck mastered" line.
- Stored progress names a level this build does not have. It matches no level, so it contributes nothing to what is unlocked and shows nowhere — unchanged from today.
- A learner had completed the level removed by the FR-020 collapse. That level no longer exists, so it counts toward nothing — the same as any progress naming a level this build does not have. Every other completed level, and mastery, are unaffected.
- A learner had an unfinished run on the level removed by the FR-020 collapse. The run is dropped, as it already is for any run whose level the deck config has moved out from under. Completed levels survive.
- A deck screen for a deck id that does not exist still shows the existing "Deck not found" message. Untouched.
- Storage is full when "Start over" is tapped. The discard behaves as it does today: the run is gone for this session and the full-storage message is raised by the run screen the learner lands on.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every level in every built-in deck MUST be named "Level N", numbered from 1 in ladder order, except the highest level of each deck. Numbering follows the ladder after any collapse required by FR-020.
- **FR-002**: The highest level of every built-in deck MUST be named "Full deck", with no number.
- **FR-003**: No screen may name a level by its card count. The deck screen, the deck list status line, and the run header MUST all use the names from FR-001 and FR-002.
- **FR-004**: Renaming a level MUST NOT change which levels a learner has already completed, or reset any stored progress.
- **FR-005**: The deck screen MUST display levels highest-first, so Level 1 is the last row on screen.
- **FR-006**: A level MUST be startable from the deck screen only when every level below it has been completed. Level 1 is always startable. This is the whole unlock rule — there is no additional case for a level completed out of order.
- **FR-007**: A completed level that is not startable under FR-006 MUST be shown as not startable, and MUST still carry its completion mark.
- **FR-008**: Reaching a level's run directly by URL MUST continue to start that run, whether or not the deck screen would offer that level. FR-006 is a legibility rule for the deck screen, not an access control.
- **FR-009**: A level with an unfinished run MUST occupy a single row on the deck screen.
- **FR-010**: That row MUST contain exactly two controls: a "Start over" control on the left and the level's own control on the right, the level's control being the wider of the two.
- **FR-011**: That row MUST carry no caption or status text beside the two controls. The "Unfinished run" caption shown there today is removed.
- **FR-012**: The level's own control MUST resume the unfinished run — it is the same control that enters the level when there is no unfinished run.
- **FR-013**: "Start over" MUST discard the unfinished run and begin a fresh run of that level, leaving every completed level and every other deck's stored progress unchanged.
- **FR-014**: "Start over" MUST keep its current visual treatment.
- **FR-015**: A level that has ever been completed MUST show a circle-check inside its own control, immediately to the left of the level name — the same circle-check the "Got it" outcome uses. The control's content stays centre-justified, as it is today.
- **FR-016**: The completion mark MUST persist through replaying a completed level, including while a replay is unfinished and after a replay in which cards were failed.
- **FR-017**: A control's accessible name MUST remain the level name; the completion mark MUST NOT be announced as part of it.
- **FR-018**: The separate "Completed" text beside a level MUST be removed, replaced by the mark in FR-015.
- **FR-019**: A level with an unfinished run that is not startable MUST be shown as not startable and MUST NOT offer "Start over".
- **FR-020**: Where a deck's highest level adds only a remainder to the level below it — fewer cards than the deck's regular step — those two levels MUST be collapsed into one level holding the whole deck, and that combined level becomes the deck's highest. This is a rule about how decks are authored and applies to every deck, present and future.
- **FR-021**: A collapse under FR-020 MUST keep the identity of the level that already holds the whole deck and MUST leave every level below it untouched. A learner who had completed the removed level keeps every other completed level, and a learner who had already mastered the deck stays mastered.

### Key Entities

- **Level**: One step of a deck's ladder. Has a stable identity that stored progress refers to, a display name ("Level N" or "Full deck"), and a fixed set of cards. Authored with the deck; never changed at runtime.
- **Deck progress**: Per deck, the set of levels completed and at most one unfinished run. Already stored; this feature changes what is derived from it, not its shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The string "words" names no level on any screen, in either built-in deck.
- **SC-002**: On every deck screen, reading top to bottom, level numbers strictly decrease and "Full deck" is first.
- **SC-003**: For any stored progress whatsoever, including progress made out of order, the startable levels on a deck screen form an unbroken run beginning at Level 1.
- **SC-004**: A level with an unfinished run occupies exactly one row, the same height as every other level's row, holding two controls and no caption.
- **SC-005**: A learner returning to an unfinished run reaches it in one tap from the deck screen, and reaches a fresh start of the same level in one tap.
- **SC-006**: Every level the learner has ever completed carries the mark, in 100% of deck screen visits, regardless of what has happened since.
- **SC-007**: No stored progress is lost or altered by this change, apart from the one level FR-020 removes: a learner's completed levels before and after are otherwise the same set, and a mastered deck stays mastered.
- **SC-008**: No deck's highest level adds fewer cards than the step below it does.

## Assumptions

- FR-006 exists so the deck screen reads as one unbroken ladder to an early reader. It is deliberately not a barrier: URL entry (FR-008) is unchanged and expected to keep working.
- "Rung" and "level" name the same thing; this feature changes the display name only. The stored identity of each level is unchanged, so existing progress carries over untouched (FR-004).
- "Fully successed" means the level was completed — the same condition that already records a level as completed and unlocks the next one. No new notion of success is introduced.
- Numbering restarts at 1 per deck and follows ladder order, so the same level name may appear in more than one deck. Deck titles already distinguish them.
- Locked levels stay visible on the deck screen, as they are today — the whole ladder is legible from the start.
- The deck list's one-line status and the run header keep their current shape; only the level name inside them changes.
- Deck titles ("Dolch Pre-K · Steps of 5") are out of scope. Only level names change.
- FR-020 is applied by editing the authored decks, not by code that collapses levels at runtime. There is nothing to compute: the decks ship with the app.
- FR-020 changes `dolch-k-5` from 11 levels to 10 ("Level 1"–"Level 9", then "Full deck" holding all 52 words). `dolch-prek-5` keeps its 8 levels ("Level 1"–"Level 7", then "Full deck" holding all 40 words).
- Removing a level is a deck config revision, which the stored model already handles. It is not a change to the shape of anything stored, so no schema version bump or migration is owed.
- The two built-in decks are the whole surface: no deck authoring or level configuration is added.
