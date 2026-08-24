# Feature Specification: Pronounce Word Button

**Feature Branch**: `005-pronounce-word`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "as a general instruction don't overengineer anything. use obvious, simple, industry standard practices and patterns. I want a new button above the \"not yet\" button that pronounces the word in american english using a female voice when pressed. during the pronunciation, pressing that button should do nothing. after the pronunciation, pressing the button again should pronounce again. basically don't queue up pronunciations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A learner hears the word said out loud (Priority: P1)

A young learner is mid-run and a sight word is on the card. They do not recognise it. Rather than
guessing or waiting for an adult, they press a button on the run screen and the word is spoken
aloud in American English in a female voice. They hear it, match it to the letters in front of
them, and then mark the card.

**Why this priority**: This is the whole request. A pre-reader stuck on a word currently has no way
forward without an adult present; hearing the word is the thing that unblocks them.

**Independent Test**: Open a run, press the pronounce button, and confirm the word currently on the
card is spoken in an American English female voice.

**Acceptance Scenarios**:

1. **Given** a card showing "yellow" is on screen, **When** the learner presses the pronounce
   button, **Then** the word "yellow" is spoken aloud in American English in a female voice.
2. **Given** a card has just been marked and a different word is now showing, **When** the learner
   presses the pronounce button, **Then** the word now on screen is spoken — never the previous one.
3. **Given** the learner presses the pronounce button, **When** the word finishes being spoken,
   **Then** nothing else happens: the card does not advance, no outcome is recorded, and the run is
   exactly where it was.
4. **Given** the run-complete screen is showing, **When** the learner looks at it, **Then** there is
   no pronounce button, because there is no word to pronounce.

---

### User Story 2 - Pressing repeatedly does not stack up pronunciations (Priority: P2)

A child presses the button several times in a row, the way children press buttons. The word is
spoken once, not five times over. Once it has finished, pressing again speaks it again.

**Why this priority**: Without this, the feature is actively unpleasant — a queue of repeated words
that has to play itself out before anything else can be heard. It is a small rule that decides
whether the button is usable by its actual audience.

**Independent Test**: Press the pronounce button five times in quick succession and confirm the word
is spoken exactly once; then wait for it to finish, press once more, and confirm it is spoken again.

**Acceptance Scenarios**:

1. **Given** the word is currently being spoken, **When** the learner presses the pronounce button
   again, **Then** nothing happens — no second pronunciation starts and none is queued for later.
2. **Given** the word has finished being spoken, **When** the learner presses the pronounce button,
   **Then** the word is spoken again from the start.
3. **Given** the learner presses the button five times in rapid succession, **When** the speaking
   ends, **Then** the word has been spoken exactly once and nothing further is spoken.
4. **Given** the word is currently being spoken, **When** the learner marks the card "Got it" or
   "Not yet", **Then** the speaking stops and the run advances normally — the previous word is not
   left talking over the new card.

---

### User Story 3 - The run still works where nothing can speak (Priority: P3)

A learner is on a device or browser that cannot speak text aloud, or that has no voice installed.
The run screen still works: every card, every control, no error, no blank screen.

**Why this priority**: Speaking aloud is not available everywhere, and the run is the app's core
loop. Losing the run because a voice is missing would be a far worse outcome than losing the
button.

**Independent Test**: Disable or remove speech support in the browser, open a run, and confirm the
run screen renders and every other control works.

**Acceptance Scenarios**:

1. **Given** the device cannot speak text aloud at all, **When** the learner opens a run, **Then**
   the run screen renders normally and marking cards works exactly as before.
2. **Given** the device cannot speak text aloud at all, **When** the learner looks at the run
   screen, **Then** they are not offered a button that would do nothing when pressed.
3. **Given** speaking fails partway through for any reason, **When** the learner presses the
   pronounce button again, **Then** it responds — a failed attempt does not leave the button stuck
   permanently unpressable.

---

### Edge Cases

- **Repeated presses mid-pronunciation** — ignored outright, not queued (US2). This is the
  explicitly requested behaviour.
- **The card changes while the word is being spoken** — speaking stops. The learner has moved on,
  so hearing the previous word finish would be confusing.
- **The learner leaves the run while the word is being spoken** — speaking stops. Nothing keeps
  talking on the deck ladder or the deck list.
- **No American English female voice is installed on the device** — see FR-004.
- **Speaking is unavailable entirely** — the button is not shown (US3, FR-011).
- **Speaking fails or is cut short by the device** — the button becomes pressable again rather than
  latching (US3 scenario 3).
- **The device is silent or muted** — out of scope. Nothing in the app can detect or fix this.
- **The word contains only letters an English voice can say** — every card in both decks is a plain
  lowercase English sight word, so there is no pronunciation-of-symbols case to handle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The run screen MUST offer a control that speaks the word currently on the card aloud
  when pressed.
- **FR-002**: The control MUST sit directly above the "Not yet" button only, aligned to it, with the
  space above "Got it" left empty. The two outcome buttons MUST keep their present size, position
  relative to each other, and appearance.
- **FR-003**: The spoken word MUST be rendered in American English.
- **FR-004**: The spoken word MUST use a female American English voice where the device has one.
  Where it does not, the system MUST fall back to **the device's own American English default**
  rather than to an arbitrary voice from its list, and MUST NOT go silent or hide the control —
  hearing the word matters more than the voice being female. The distinction is not pedantic: many
  devices list novelty voices (ones that sing, whisper, or sound robotic) alongside real ones, and
  an arbitrary pick can land on one. See
  [research Decision 2](./research.md#decision-2-there-is-no-gender-field-so-female-is-a-name-match-with-a-safe-fallback).
- **FR-005**: The control MUST speak the word that is on the card at the moment it is pressed, and
  never a word from an earlier card.
- **FR-006**: Pressing the control MUST NOT record an outcome, advance the run, alter cycle
  position, or change anything that is remembered about the run.
- **FR-007**: While a word is being spoken, pressing the control again MUST do nothing at all — no
  second pronunciation, and nothing held back to play afterwards.
- **FR-008**: Once speaking has ended, pressing the control MUST speak the word again.
- **FR-009**: Speaking MUST stop when the card changes, when the run is restarted, and when the
  learner leaves the run screen.
- **FR-010**: The control MUST be shown only while a card is on screen. It MUST NOT appear on the
  run-complete screen, where there is no word.
- **FR-011**: Where the device cannot speak text aloud at all, the control MUST NOT be shown, and
  every other part of the run screen MUST behave exactly as it does today.
- **FR-012**: The control MUST recover from a failed or interrupted pronunciation — a single failure
  MUST NOT leave it permanently unpressable.
- **FR-013**: The control's purpose MUST be identifiable by a pre-reader without reading, and it
  MUST carry a name that assistive technology can announce.
- **FR-013a**: While the word is being spoken, the control MUST show a **subtle** sign that it is
  working. The signal MUST be confined to a small part of the control rather than the whole of it,
  MUST NOT dim or grey the control, and MUST NOT compete for attention with the card or the outcome
  buttons. The card is what the learner should be looking at.
- **FR-014**: The control MUST be distinguishable from the two outcome buttons, so that a learner
  reaching for "hear it again" cannot mark the card by mistake.
- **FR-015**: Nothing about the word, the card, or the run MUST leave the device in order to produce
  the pronunciation.
- **FR-016**: Nothing about the run that is remembered between sessions MUST change. No new setting,
  preference, or stored value is introduced by this feature.
- **FR-017**: Every existing behaviour of the run screen — marking, cycling, repeating, restarting,
  resuming, completing — MUST be unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner who cannot read the word on the card can hear it spoken with a single press,
  with no adult intervention and no prior setup.
- **SC-002**: The spoken word is recognisably American English, and is spoken in a female voice on
  every device that has one. A device with no female American English voice speaks it in whatever
  American English voice it does have, which is a pass rather than a failure (FR-004) — but never in
  a novelty voice.
- **SC-003**: Pressing the control five times in rapid succession results in the word being spoken
  exactly once.
- **SC-004**: Speech begins within roughly one second of the press, so the connection between
  pressing and hearing is obvious to a young child.
- **SC-005**: Marking a card while the word is being spoken silences it immediately and advances the
  run as usual.
- **SC-006**: With speech unavailable, 100% of existing run-screen behaviours still work and no
  error is shown.
- **SC-007**: The run screen still fits a 320-pixel-wide viewport with no vertical scrolling and
  nothing overlapping.
- **SC-008**: The existing automated test suite passes unchanged, confirming no existing run
  behaviour was altered.

## Assumptions

- **Speaking is done by the device, not by a service.** The word is spoken using the browser's own
  built-in text-to-speech. No audio files are added to the app and nothing is fetched from a third
  party — which is what keeps FR-015 true and keeps the app a self-contained static bundle.
- **Which exact voice speaks is the device's choice, not the app's.** Available voices differ by
  operating system, browser, and the user's own settings. The app asks for American English and
  prefers a female voice; it cannot guarantee a specific named voice, and does not try to.
- **Where a device has no American English voice at all**, the word is still spoken, marked as
  American English, leaving the device to pick the closest thing it has. This is the end of the
  FR-004 fallback chain rather than a fourth case: a learner hearing the word in another accent is
  better served than a learner hearing nothing, and this is rare on the platforms in use.
- **Speech quality is not something this feature can control.** Some devices sound noticeably better
  than others. That is accepted rather than worked around.
- **No pronunciation data is added.** Words are spoken as the device's voice reads them. There is no
  per-word phonetic override, and no attempt to correct a device that mispronounces something.
- **No settings are added.** No voice picker, no speed control, no volume control, no on/off toggle,
  no autoplay-on-card-change. If any of those are wanted they are a separate request.
- **The pronounce control does not appear anywhere else.** The deck list and the deck ladder are
  untouched; only the run screen gains it.
- **Muted or silent devices are out of scope.** The app cannot detect the hardware volume, so a
  learner hearing nothing on a muted phone is not a defect in this feature.
- **The existing decks are all plain English words**, so no card requires special handling to be
  pronounceable.
