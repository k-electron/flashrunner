# Feature Specification: Heard-Word Button Emphasis

**Feature Branch**: `007-heard-word-emphasis`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "we need to make it so that if the user listen's to a pronunciation guide on a particular screen then 'not yet' button that currently has a grey background becomes a black background with similar mechanics to the 'resume' button or other black buttons AND the 'got it' button loses its green background and gets the grey background of the former 'not yet' button. neither button must be auto-clicked or anything, but we are visually changing the user guidance to now prefer the 'not yet' button since the user chose to hear the pronunciation guide which is in essence the answer for this sort of flash card. all these transitions are within the context of a single card and must not transcend between cards. this is a simple feature. don't overengineer it. keep the spec succinct."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hearing the word points the learner at "Not yet" (Priority: P1)

A learner is mid-run, does not recognise the word, and presses the button that says it out loud.
Having been told the answer, they should mark the card "Not yet" — the card is not yet known. The
moment they press the speaker, the run screen changes which outcome it visually recommends: "Not
yet" takes on the emphasised black styling used elsewhere for the main action, and "Got it" drops
its green and takes the plain grey "Not yet" used to have. Nothing is pressed for them; both
outcomes remain available and do exactly what they always did.

**Why this priority**: This is the whole feature. A learner who needed the answer read to them has
not recognised the word, and the screen should stop recommending the outcome that says they did.

**Independent Test**: Open a run, press the speaker button, and confirm "Not yet" is now the
emphasised button and "Got it" the plain one, with no outcome recorded and the same card still
showing.

**Acceptance Scenarios**:

1. **Given** a card is showing and the outcomes are in their default styling, **When** the learner
   presses the speaker button, **Then** "Not yet" becomes the emphasised (black) button and "Got
   it" becomes the plain grey one.
2. **Given** the learner has pressed the speaker button, **When** they look at the screen, **Then**
   no outcome has been recorded, the same card is still showing, and both buttons are still
   pressable.
3. **Given** the styling has swapped, **When** the learner presses "Got it", **Then** the card is
   marked "Got it" exactly as it would have been otherwise.
4. **Given** the styling has swapped, **When** the learner presses the speaker button again,
   **Then** the styling stays as it is — nothing swaps back or toggles.

---

### User Story 2 - The emphasis does not follow the learner to the next card (Priority: P1)

The learner hears one word, marks it, and the next card appears. That card gets the ordinary
treatment: green "Got it", grey "Not yet". Whatever happened on the previous card is not carried
over.

**Why this priority**: Same priority as Story 1 because without it the feature is wrong rather than
incomplete — a run would drift into permanently recommending "Not yet" after one press.

**Independent Test**: Press the speaker on one card, mark it, and confirm the next card shows the
default green/grey styling.

**Acceptance Scenarios**:

1. **Given** the learner heard the word on the current card, **When** they mark it and a new card
   appears, **Then** the outcomes are back to green "Got it" and grey "Not yet".
2. **Given** the learner heard the word on a card and marked it "Not yet", **When** that same card
   comes back later in the run, **Then** it is presented with the default styling again.
3. **Given** the learner heard the word on the current card, **When** they press "Start over",
   **Then** the card that comes up is presented with the default styling.
4. **Given** the learner heard the word on the current card, **When** they leave the run and resume
   it later, **Then** the resumed card is presented with the default styling.

---

### Edge Cases

- A device that cannot speak shows no speaker button at all, so the outcomes keep their default
  styling for the whole run.
- A press that fails to produce sound still counts as hearing the word: the styling swaps on the
  press, not on the word finishing.
- Pressing the speaker while the word is still being said does nothing, as today, and leaves the
  swapped styling in place.
- The run-complete screen has no card and no outcome buttons, so nothing here applies to it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the learner presses the speaker button for the card on screen, "Not yet" MUST
  take the emphasised styling used for the app's primary buttons (the same black treatment as
  "Resume" and "Next run"), and "Got it" MUST take the plain grey styling "Not yet" had before.
- **FR-002**: The swap MUST happen on the press itself, not on the word finishing, and MUST NOT
  depend on whether the device succeeds in speaking.
- **FR-003**: The swap MUST be purely visual: neither outcome may be pressed, activated, focused,
  disabled or reordered, and what each outcome does when pressed MUST be unchanged.
- **FR-004**: Both outcomes MUST remain visible, pressable and distinguishable from each other at
  all times — one emphasised and one plain, never two of either.
- **FR-005**: Each outcome MUST keep its label, icon, size and position in both states; only the
  background and its matching text colour change.
- **FR-006**: Further presses of the speaker button on the same card MUST leave the swapped styling
  unchanged.
- **FR-007**: The emphasis MUST apply to the presentation of a single card only. Presenting any
  card — the next one, the same one requeued later, the one after a "Start over", or the one a
  resumed run opens on — MUST show the default green "Got it" and grey "Not yet".
- **FR-008**: Nothing about the emphasis may be stored on the device or survive leaving the run.
- **FR-009**: The speaker button's own appearance and behaviour MUST be unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of presses of the speaker button, the emphasised outcome afterwards is "Not
  yet" and the plain one is "Got it".
- **SC-002**: The swap is visible on the press, with no wait for the word to be spoken.
- **SC-003**: Across a full run, zero cards are presented with swapped styling that the learner did
  not press the speaker on during that presentation.
- **SC-004**: Marking outcomes, run progression, and stored progress are byte-for-byte identical to
  today whether or not the swap has happened.

## Assumptions

- "Black background with similar mechanics to the 'resume' button" means the app's existing primary
  button treatment, reused rather than re-specified — including its hover and focus behaviour.
- "The grey background of the former 'not yet' button" likewise means the app's existing secondary
  treatment, unchanged.
- The icons on both outcomes ("Got it" tick, "Not yet" question mark) stay as they are; only the
  backgrounds change.
- This changes only the run screen. No other screen shows these two buttons.
