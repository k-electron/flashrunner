# Feature Specification: Andika Font

**Feature Branch**: `004-andika-font`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "we need to use andika as the font here. early readers are not familiar
with double story characters."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A card shows the letters a child is actually taught (Priority: P1)

A young learner is shown a card. The word on it is drawn in the same letter shapes they are taught
to
read and write: a round single-story `a`, a single-bowl `g` with an open tail. Nothing on the card
asks them to recognize a letterform they have never been shown.

**Why this priority**: This is the whole request, and it is the one place where the wrong letterform
does real harm. The card face is the only text a pre-reader is asked to decode. A double-story `a`
here is not a cosmetic mismatch — it is an unfamiliar symbol presented as the thing being learned.

**Independent Test**: Open a run and look at a card whose word contains an `a` or a `g` — "and",
"go", "again". The `a` is a circle with a stem, not a hooked two-storey form. The `g` has one bowl
and an open descender, not a lower loop.

**Acceptance Scenarios**:

1. **Given** a card whose word contains a lowercase `a`, **When** it is shown, **Then** the `a` is
   single-story.
2. **Given** a card whose word contains a lowercase `g`, **When** it is shown, **Then** the `g` is
   single-bowl with an open tail.
3. **Given** any card, **When** it is shown, **Then** the word is drawn in Andika and in no other
   font.
4. **Given** a normal load, **When** the card appears, **Then** it is drawn in Andika by the time
   the learner is looking at it.

---

### User Story 2 - The whole app reads in one voice (Priority: P2)

Every other piece of text — deck titles, rung labels, the remaining-cards counter, the outcome
button
wording, the completion message, the links — is drawn in the same font as the card. The app does not
mix a literacy font for the content with a different font for the interface.

**Why this priority**: Two fonts in one screen is both a visual seam and a teaching inconsistency:
the
outcome buttons say "Got it" and "Not yet", and a supervising adult reading those aloud with a child
is pointing at letters too. It ranks below US1 because the card is where the learning happens and
the
chrome is where it merely should not contradict it.

**Independent Test**: Walk the deck list, a deck ladder, a run and a completion screen. Every string
on every screen is Andika. No screen shows two typefaces.

**Acceptance Scenarios**:

1. **Given** any screen in the app, **When** its text is compared with a card face, **Then** both
   are the same typeface.
2. **Given** the shipped app, **When** the fonts it downloads are listed, **Then** it fetches Andika
   and no other text font.
3. **Given** a heading or a button label, **When** it is compared with body text, **Then** it still
   reads as heavier — emphasis survives the change.

---

### User Story 3 - Nothing else about any screen moves (Priority: P3)

Swapping the font changes how wide and how tall every string is. No screen may break as a result: no
clipped label, no word running past the edge of its card, no button whose wording suddenly wraps, no
screen that starts scrolling when it did not before.

**Why this priority**: Protective. A font swap is a one-line change with an app-wide blast radius —
different letter widths and a different x-height are exactly what turns a comfortable layout into a
clipped one. This story is the check that catches it.

**Independent Test**: Open every screen at a phone-sized viewport and confirm nothing clips, wraps
unexpectedly, overlaps, or scrolls where it did not before. Check the longest word in each deck at
the
card's full size.

**Acceptance Scenarios**:

1. **Given** a phone-sized viewport, **When** a run is open, **Then** the card, the counter and both
   outcome buttons are visible without scrolling, exactly as before.
2. **Given** the longest word in each deck, **When** it is shown on a card at the narrowest
   supported width, **Then** it is fully visible and does not overflow its card or clip.
3. **Given** the outcome buttons, **When** their wording is drawn in the new font, **Then** neither
   label wraps or collides with its icon.
4. **Given** any other screen — deck list, deck ladder, completion, the not-found screens — **When**
   it is compared with the current build, **Then** its layout is intact and its content unchanged.

---

### Edge Cases

- **The font has not arrived yet.** On a first visit the font may still be downloading when the
  markup is ready, so text paints in the browser's substitute face and swaps when Andika lands. On a
  modern connection with a self-hosted font that window is brief, and blocking text to avoid it costs
  more than it saves. Accepted.
- **The font fails to load entirely.** The app must remain fully usable and readable. Correct
  letterforms are the goal; legible text is the floor, and the floor is not negotiable.
- **Accented letters.** A word containing `á`, `à` or `ä` must show the same single-story `a` shape
  under the accent, not a different one.
- **Emphasis.** Andika offers regular and bold only. Anything the app currently draws at an
  in-between weight resolves to the nearest available weight; it must not be faked by smearing the
  regular weight.
- **The longest word on the largest card.** The card face is the app's largest text by far, so a
  wider font shows up here first.
- **Text the deck content never uses.** The font covers alphabets the English decks will never
  contain. None of that may be downloaded on a learner's device.

## Requirements *(mandatory)*

### Functional Requirements

**Letterforms**

- **FR-001**: All text in the app MUST be rendered in Andika.
- **FR-002**: The lowercase `a` MUST be single-story everywhere it appears.
- **FR-003**: The lowercase `g` MUST be single-bowl with an open tail everywhere it appears.
- **FR-004**: Accented forms of those letters MUST use the same single-story shapes.
- **FR-005**: No configuration MUST be required to get these shapes — they are the font's default
  forms, not an option that could be lost.

**Scope of application**

- **FR-006**: Andika MUST apply to every screen and every string, not only to the card face.
- **FR-007**: A learner's device MUST NOT download a text font the app does not use. Andika replaces
  the current font rather than joining it. Subset files that sit in the build but are never requested
  are acceptable — what matters is what crosses the network, which is also what FR-008 measures.
- **FR-008**: Only the character ranges the app's content actually uses MUST be downloaded to a
  learner's device.

**Loading**

- **FR-009**: Text MUST paint immediately, using the platform's standard web-font loading
  behaviour. A brief substitute face on a first load, before the font arrives, is accepted — this app
  targets modern connections and serves the font from its own origin. Blocking text to avoid that
  window is explicitly not wanted.
- **FR-010**: If the font cannot be loaded at all, the app MUST remain fully usable with legible
  text.
- **FR-011**: Text MUST NOT depend on a request to any third-party host. Nothing about which words a
  learner is shown may leave the device.

**Emphasis**

- **FR-012**: Text the app currently emphasizes MUST remain visibly heavier than body text.
- **FR-013**: Emphasis MUST come from a real weight of the font. Synthesized bold and synthesized
  italic are prohibited.

**Layout preservation**

- **FR-014**: Every card word MUST be fully visible on its card at the narrowest supported viewport
  — no clipping, no overflow.
- **FR-015**: The run screen MUST continue to fit a phone-sized viewport without scrolling.
- **FR-016**: No label anywhere may clip, overlap, or wrap where it did not wrap before.

**Unchanged behaviour**

- **FR-017**: Every behaviour MUST be unchanged. Decks, run mechanics, cycle construction, marking,
  resuming, completion and mastery are untouched.
- **FR-018**: Nothing persisted MUST change, so no schema version change and no migration.
- **FR-019**: This feature MUST NOT add any setting, toggle, preference, font picker or control.
- **FR-020**: The wording of every string MUST stay exactly as it is. This changes how text is
  drawn, never what it says.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On every screen, the lowercase `a` and `g` are the single-story forms a beginning
  reader is taught.
- **SC-002**: Once loaded, no screen displays a double-story `a` or `g`.
- **SC-003**: With the font blocked entirely, every screen is still readable and every control still
  works.
- **SC-004**: The run screen fits a 320px-wide viewport with no scrolling, and no text anywhere in
  the app clips, overflows or overlaps.
- **SC-005**: The longest word in every built-in deck fits its card at the narrowest supported
  width.
- **SC-006**: Headings and button labels remain visibly heavier than body text.
- **SC-007**: The app requests no text resource from a third-party host, and works with the network
  blocked after a first load.
- **SC-008**: The shipped app downloads exactly one text font family.
- **SC-009**: Decks, runs, marking, resuming, completion and mastery behave identically to the
  current build.

## Assumptions

- **Andika's single-story letterforms are its defaults, and there is no double-story form to lose.**
  Verified against the published `@fontsource/andika@5.3.0` font files rather than assumed: in both
  the regular and bold weights, `U+0061` maps to a glyph named `a.SngStory` and `U+0067` to
  `g.SngBowl`, the accented forms map to `aacute.SngStory` and siblings, and the files contain no
  double-story alternates at all. So FR-005 costs nothing — no font feature has to be switched on,
  and no future change can silently switch it off.
- **Andika replaces the current font rather than joining it.** The app has one font token applied
  once, at the root, so "the font here" is a single value. Leaving the old font installed but unused
  would violate the constitution's rule on unused dependencies.
- **Andika offers regular (400) and bold (700) only — no variable weight range.** The app currently
  asks for one in-between weight in one place and another in six. Those resolve to the nearest real
  weight, which makes some emphasized text slightly heavier than today. That is accepted as a
  consequence of the change, not worked around; FR-013 is what forbids papering over it.
- **The licence needs no approval.** Andika is SIL International's, under OFL-1.1, which the
  constitution pre-cleared for exactly this case — the rule was amended when the current font
  arrived. The package carries the same licence, so the asset review and the package review are
  discharged together.
- **The package is reputable and on a stable channel.** `@fontsource/andika@5.3.0`, published
  2026-07-19, from the same Fontsource line and major version as the font package the app already
  uses. Not a pre-release.
- **The decks are English.** The font covers Latin Extended, Cyrillic and Vietnamese as well; none
  of that will ever be requested by the built-in Dolch content, which is what makes FR-008
  achievable without hand-pruning anything.
- **Italic is unused today and stays unused.** No screen renders italic text, so nothing in this
  feature introduces one.
- **Adjusting a size or a spacing value to keep a layout intact is in scope; redesigning a screen is
  not.** FR-014 through FR-016 are about the layout surviving the swap, not about improving it.
