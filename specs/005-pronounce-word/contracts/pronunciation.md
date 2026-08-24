# Contract: the pronounce control

**Date**: 2026-08-24 | **Plan**: [plan.md](../plan.md) | **Spec**: [spec.md](../spec.md)

What the run screen presents, and how it behaves. Written so it can be checked without reading the
implementation.

## 1. Is the control there at all?

| Device | Control shown? | Requirement |
|---|---|---|
| `speechSynthesis` exists on `window` | Yes, whenever a card is on screen | FR-001, FR-010 |
| `speechSynthesis` absent (older browser, locked-down build, `jsdom`) | **No** | FR-011 |
| Run-complete screen, regardless of device | **No** — there is no word | FR-010 |

The check is presence of the API, nothing more. A device that has the API but zero installed voices
cannot be distinguished from one that works, and is not attempted — see
[research Decision 3](../research.md#decision-3-ask-for-the-voice-list-when-the-button-is-pressed-not-before).

## 2. Appearance and name

| Property | Value | Requirement |
|---|---|---|
| Symbol | A speaker icon, recognisable without reading | FR-013 |
| Accessible name | Fixed and readable by assistive technology, e.g. "Hear the word" | FR-013 |
| Position | Directly above **"Not yet"**, aligned to it. Nothing above "Got it" | FR-002 |
| Height | Visibly shorter than the outcome buttons, so the two cannot be confused | FR-014 |
| "Got it" / "Not yet" | Unchanged in size, position and appearance | FR-002, FR-017 |

The accessible name is fixed text, not the word on the card. It names the action ("hear the word"),
which is what a screen-reader user needs; the word itself is already on screen as the card.

## 3. Which voice speaks

Applied in order. The first match wins.

| # | Rule | Result |
|---|---|---|
| 1 | An American English voice whose name contains a known female hint | Use that voice |
| 2 | The device's own American English default | Use that voice |
| 3 | Any American English voice | Use that voice |
| 4 | Any English voice, whatever the accent | Use that voice |
| 5 | Otherwise | **Set no voice.** `lang = 'en-US'` is set regardless, so the browser uses what it has |

Language tags are compared case-insensitively with `_` read as `-`, because platforms write the same
language as `en-US`, `en_US` and `en-us`. Names are matched on a **substring**, not the whole string,
because platforms decorate them: macOS ships `Flo (English (US))`, Windows
`Microsoft Zira Desktop - English (United States)`. See
[research Decision 2](../research.md#decision-2-there-is-no-gender-field-so-female-is-a-name-match-with-a-safe-fallback).

Rule 2 sits above rule 3 for one reason: the device's default is never a novelty voice, and half of
macOS's `en_US` list is — Bells sings, Zarvox is a robot, Whisper whispers. Rule 3 can still land on
one, on a device whose default is itself missing. That is accepted: an odd voice is a smaller failure
than no voice.

**Never**: silent, hidden, or an error, because no preferred voice was found (FR-004).

## 4. The speaking state machine

Two states. No queue, because nothing is ever enqueued.

```text
                press
    ┌─────────┐ ─────► ┌──────────┐
    │  idle   │        │ speaking │ ──┐ press → ignored entirely (FR-007)
    └─────────┘ ◄───── └──────────┘ ◄─┘
                 end / error / cancel
```

| From | Event | To | Side effect | Requirement |
|---|---|---|---|---|
| idle | press | speaking | The word on screen is spoken, once | FR-001, FR-005 |
| speaking | press | speaking | **Nothing.** No second utterance, nothing deferred | FR-007 |
| speaking | utterance ends | idle | — | FR-008 |
| speaking | utterance errors | idle | — | FR-012 |
| speaking | word changes / screen left | idle | Speech is cancelled | FR-009, FR-010 |
| either | press | *(unchanged run)* | No outcome, no advance, no stored change | FR-006, FR-016 |

**While speaking**, the control shows a subtle sign of activity confined to the icon. It is not
dimmed, not greyed, and does not animate as a whole (FR-013a). Under
`prefers-reduced-motion: reduce` the animation does not run; the control still works.

## 5. What this contract does not cover

- **Whether sound is audible.** Device volume, mute switches and Bluetooth routing are outside the
  app. Nothing here can detect them.
- **How good the voice sounds.** Varies by device and is accepted as-is.
- **Pronunciation accuracy.** The device reads the word; there are no phonetic overrides.
- **Any setting.** No voice picker, speed, volume, toggle or autoplay exists to specify.
