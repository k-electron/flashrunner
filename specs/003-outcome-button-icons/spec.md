# Feature Specification: Outcome Button Icons

**Feature Branch**: `003-outcome-button-icons`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "1. we need to make the 'got it button' green with a check mark symbol in addition to the text. actually the checkmark should be a large central thing and the text should be smaller and underneath the checkbox. 2. same thing for the 'not yet' button except leave it the color it is and the icon will be a question mark"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A child can tell the two buttons apart without reading (Priority: P1)

A young learner is mid-run and has just been shown a card. The two ways of answering are a large
green tick and a large question mark, each with its wording in smaller text underneath. The learner
presses the tick when they knew the word and the question mark when they did not, recognizing the
shape rather than reading the label.

**Why this priority**: This is the whole request. The run screen's only interactive decision is
this pair of buttons, and its users include pre-readers. Symbols carry the meaning; the words stay
for the adult marking alongside them.

**Independent Test**: Open a run, look at the two buttons, and confirm each shows a large symbol
above smaller wording — a tick for "Got it", a question mark for "Not yet" — and that pressing each
one still records the outcome it always did.

**Acceptance Scenarios**:

1. **Given** a card is on screen, **When** the learner looks at the two buttons, **Then** the
   left-hand one shows a check mark above the smaller words "Got it" and the right-hand one shows a
   question mark above the smaller words "Not yet".
2. **Given** a card is on screen, **When** the learner presses the check mark button, **Then** the
   card is recorded as passed and the run advances exactly as before.
3. **Given** a card is on screen, **When** the learner presses the question mark button, **Then** the
   card is recorded as not yet known and the run advances exactly as before.
4. **Given** either button, **When** it is pressed anywhere within it — on the symbol, on the words,
   or on empty space inside it — **Then** the outcome is recorded. The symbol and the words are not
   separately clickable.

---

### User Story 2 - Green marks the positive answer (Priority: P2)

The "Got it" button is green. The "Not yet" button keeps the appearance it has today. Colour
reinforces the symbol rather than replacing it, so the pair still reads correctly for a learner who
cannot distinguish the two colours.

**Why this priority**: Requested explicitly, and it separates the two buttons at a glance. It ranks
below the symbols because colour alone is not an accessible distinction — the symbols are.

**Independent Test**: Open a run and confirm the "Got it" button is green with legible content, and
that "Not yet" is visually unchanged from the current build.

**Acceptance Scenarios**:

1. **Given** a card is on screen, **When** the two buttons are compared, **Then** the "Got it"
   button is green and the "Not yet" button has the same appearance it had before this feature.
2. **Given** the "Got it" button, **When** its symbol and wording are read against its green
   background, **Then** both are legible at normal-text contrast.
3. **Given** a viewer who cannot distinguish green from grey, **When** they look at the pair,
   **Then** the symbols alone still identify which button is which.

---

### User Story 3 - Nothing else about the run screen moves (Priority: P3)

The rest of the run screen is untouched. The buttons stay side by side, stay at least as large and
as easy to hit as they are now, and the screen still fits without scrolling on a phone.

**Why this priority**: Protective. Taller button content is the obvious way this change could push
the card or the counter off a small screen, or shrink the tap targets it is meant to serve.

**Independent Test**: Open a run on a small phone-sized viewport and confirm the card, the counter
and both buttons are all visible without scrolling, and that neither button is smaller than before.

**Acceptance Scenarios**:

1. **Given** a phone-sized viewport, **When** a run is open, **Then** the card, the remaining count
   and both buttons are visible without scrolling.
2. **Given** either button, **When** its tap area is measured, **Then** it is no smaller than it was
   before this feature.
3. **Given** the run screen, **When** it is compared with the current build, **Then** the card face,
   the cycle counter, the storage-full message, the completion screen and the ladder link are
   unchanged.

---

### Edge Cases

- **Screen reader.** Each button is announced by its wording only. The symbol adds nothing to
  announce, so it is not announced twice and not announced as "check mark".
- **Keyboard.** Each button is one tab stop with a visible focus indicator, as now. The symbol is
  not focusable.
- **Symbol fails to render.** If the symbol cannot be drawn, the wording is still present and the
  button still works and is still identifiable.
- **Very narrow viewport.** With the two buttons side by side at their narrowest, the wording is
  still fully readable — it does not clip or overlap the symbol.
- **Large system text size.** With text scaled up, the wording stays inside its button and the
  symbol stays visible.
- **The completion screen.** It has no outcome buttons, so it is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

**Layout within each button**

- **FR-001**: Each outcome button MUST show a symbol and its wording, stacked with the symbol above
  the wording.
- **FR-002**: The symbol MUST be the visually dominant element of the button.
- **FR-003**: The wording MUST be rendered smaller than the symbol.
- **FR-004**: The symbol MUST be horizontally centred within the button, with the wording centred
  beneath it.
- **FR-005**: The symbol and the wording MUST be part of the one button. Neither is a separate
  control.

**Symbols**

- **FR-006**: The "Got it" button MUST show a check mark.
- **FR-007**: The "Not yet" button MUST show a question mark.
- **FR-008**: Symbols MUST be decorative — they convey no information the wording does not.

**Colour**

- **FR-009**: The "Got it" button MUST be green.
- **FR-010**: The "Not yet" button MUST keep its current appearance.
- **FR-011**: Neither button may depend on a dark appearance existing. The app renders in one
  appearance, and no dark-appearance variant of either button is required or wanted.
- **FR-012**: The symbol and wording on each button MUST meet normal-text contrast against that
  button's background.
- **FR-013**: Colour MUST NOT be the only thing distinguishing the two buttons. The symbols MUST
  remain sufficient on their own.

**Wording and accessibility**

- **FR-014**: The visible wording MUST remain exactly "Got it" and "Not yet".
- **FR-015**: Each button's accessible name MUST remain exactly its visible wording — "Got it" and
  "Not yet" — with no symbol name appended.
- **FR-016**: Each button MUST remain a single tab stop with a visible focus indicator.

**Unchanged behaviour**

- **FR-017**: Pressing "Got it" MUST record a pass and pressing "Not yet" MUST record a not-yet,
  exactly as today. The run mechanic, cycle construction, persistence and mastery are untouched.
- **FR-018**: The two buttons MUST stay side by side, in their current left-to-right order.
- **FR-019**: Each button's tap target MUST be no smaller than it is today.
- **FR-020**: The run screen MUST continue to fit a phone-sized viewport without scrolling.
- **FR-021**: Every other element of the run screen MUST be unchanged.
- **FR-022**: This feature MUST NOT add any setting, toggle, preference or control.
- **FR-023**: This feature MUST NOT change anything persisted, so no schema version change and no
  migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pre-reading child, shown the run screen with no explanation, correctly identifies
  which button means "I knew it" on the first attempt.
- **SC-002**: Both buttons are identifiable by symbol alone with the wording covered.
- **SC-003**: Every text and symbol against its button background meets normal-text contrast.
- **SC-004**: A screen reader announces each button once, as "Got it" or "Not yet", with no symbol
  name.
- **SC-005**: The full run screen fits a 320px-wide viewport with no scrolling and no clipped
  wording.
- **SC-006**: Neither button's tap target shrinks relative to the current build.
- **SC-007**: Marking outcomes, cycles, resuming, completion and mastery behave identically to the
  current build.

## Assumptions

- **Green is a new colour in this app.** The current theme is entirely neutral greys, so a green has
  to be introduced. The shade was settled during planning at Tailwind's `green-800`, which clears
  FR-012 with margin.
- **The app is single-appearance and dark mode is not planned.** Confirmed by the maintainer,
  2026-08-23. Nothing in the app applies the `dark` class today, and nothing is being added
  that would. So the green needs one value, not a light one and a dark one.
- **"Checkbox" in the request means the check mark.** The stacked layout is symbol above wording; no
  checkbox control is involved.
- **"Same thing" for "Not yet"** means the same stacked symbol-above-wording layout, not the same
  colour. The request says explicitly to leave its colour alone.
- **Wording stays as-is.** "Got it" and "Not yet" were chosen deliberately as encouraging language
  and are not part of this change.
- **Scope is the two outcome buttons on the run screen only.** No other button anywhere in the app
  gains a symbol.
- **The symbols come from an icon set, and both are circled.** `lucide-react` supplies them, per
  maintainer direction on 2026-08-23 — it is named in the constitution's pre-approved stack and is
  ISC-licensed. Both symbols are enclosed in a circle: a matched pair reads as two answers, where one
  ring and one bare glyph would read as one of them being different. FR-006 and FR-007 are satisfied by
  a circled tick and a circled question mark.
