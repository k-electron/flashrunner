# Implementation Plan: Pronounce Word Button

**Branch**: `005-pronounce-word` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-pronounce-word/spec.md`

## Summary

Put a speaker button above "Not yet" that says the word on the card out loud, in an American English
female voice, using the browser's own text-to-speech. Pressing it while it is already speaking does
nothing at all — the explicit request, and the one rule that decides whether the button is bearable
to a child who presses things repeatedly.

Technical approach: **one new component, one new pure function, a five-line change to the run
screen. No dependency, no storage, no network.** `window.speechSynthesis` is a platform feature that
is already there; the whole feature is a `useState` boolean, a click handler, and a cleanup effect.

The only real decision was what "female voice" means, because **the API has no gender field** — five
properties, none of them gender ([research Decision 2](./research.md#decision-2-there-is-no-gender-field-so-female-is-a-name-match-with-a-safe-fallback)).
So it is a name match, with a fallback that hands the choice back to the browser rather than picking
an arbitrary voice off the list — which on macOS can mean a singing bell.

## Technical Context

**Language/Version**: TypeScript 7.0.2, `strict: true`. Roughly 60 lines of new source.

**Primary Dependencies**: **None added.** `window.speechSynthesis` is a browser API, and
`lucide-react` (already a dependency, pre-approved under Principle V as shadcn/ui's icon set)
supplies the speaker icon. Nothing enters `package.json`.

**Storage**: Untouched. No key, no field, no `schemaVersion` bump, no migration (FR-016).

**Testing**: Vitest + React Testing Library on `jsdom`. **`jsdom` has no Web Speech API** — verified
by running it, not assumed. That makes "no speech available" the default in tests, so the existing
**166 tests must pass unmodified** and their doing so is the proof of FR-011. New tests: voice
selection as a pure function, and the press/ignore/re-press behaviour against a stubbed
`speechSynthesis`. See [research § Decision 7](./research.md#decision-7-what-is-tested-and-the-one-thing-that-cannot-be).

**Target Platform**: Evergreen browsers, static bundle. Web Speech synthesis is supported across all
of them; the *voices* differ, which is what Decision 2 is about.

**Project Type**: Single-page web application. No backend.

**Performance Goals**: Speech starts within about a second of the press (SC-004). Nothing is
downloaded, so this is the device's own latency.

**Constraints**: FR-015 — nothing about the word or the run leaves the device. Satisfied by
construction: there is no request to make.

**Scale/Scope**: 3 files added (2 source, 1 test), 2 modified. 0 dependencies. 0 storage changes.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see [below](#post-design-re-check).*

| Principle | Verdict | Basis |
|---|---|---|
| I. Client-only static SPA | **Pass** | The device speaks. No server, no API, no route, no build-config change. FR-015 makes that a requirement rather than an accident. |
| II. localStorage is the system of record | **Not engaged** | Reads and writes nothing. FR-006 and FR-016 make "the run is unchanged" testable, and FR-016 forecloses the settings this feature might have grown. |
| III. Green CI or it does not merge | **Pass** | No new CI step. Worth naming: **CI cannot hear.** A button that speaks silently passes every gate. [quickstart.md](./quickstart.md) step 1 is the check that matters. |
| IV. Test behavior, not implementation | **Pass** | Voice selection is a pure function, tested as one. The component tests assert *what was spoken and how many times* — pressing five times must produce one word — not that a method was called. Three tempting fake tests are named and refused in [research](./research.md#decision-7-what-is-tested-and-the-one-thing-that-cannot-be). |
| V. Minimal dependency surface | **Pass** | **Nothing added.** Platform first, exactly as the principle asks. The icon comes from a dependency that is already here and already pre-approved. |
| VI. Build only what was asked | **Pass, with four things named and not built** | See [below](#adjacent-work-named-and-declined). |
| VII. Self-contained, no host pollution | **Pass** | No install, nothing global, no system voice dependency. A device with no voices loses the button and nothing else. |
| VIII. Free, open, reputable, stable | **Not engaged** | No package and no asset is added, so there is no licence to review. The icon is already in the tree under shadcn/ui's terms. |

**No gate fails. No violation requires an exit path.**

### Adjacent work, named and declined

1. **A `useSpeech` hook.** One consumer. A hook wrapping a `useState` and a click handler for a
   single component is the abstraction Principle VI says is earned by a second use case, not
   predicted from the first. The logic lives in the component; the *pure* part lives in its own
   function because it is the part worth testing.
2. **A watchdog timer** resetting the button if `end` never fires. No known browser does this, and
   moving to the next card already resets it. Named as a ceiling in
   [research Decision 4](./research.md#decision-4-one-boolean-of-react-state-is-the-whole-mechanic)
   rather than engineered around.
3. **Speaking the word automatically when a card appears.** Not asked for, and it would talk over an
   adult reading with the child. FR-016 and the spec's assumptions both close this off.
4. **Any setting** — voice picker, speed, volume, an on/off toggle. Each is a separate request.

## Project Structure

### Documentation (this feature)

```text
specs/005-pronounce-word/
├── spec.md                  # 18 requirements, 3 user stories, 3 clarifications answered
├── plan.md                  # this file
├── research.md              # Phase 0 — seven decisions
├── contracts/
│   └── pronunciation.md     # Phase 1 — what the control presents and how it behaves
├── quickstart.md            # Phase 1 — validation, by hand, with the volume up
├── checklists/
│   └── requirements.md      # 16/16
└── tasks.md                 # /speckit-tasks, not created here
```

**No `data-model.md`.** That Phase 1 step is conditional on the feature involving data. This one
persists nothing and adds no entity — which is also why the spec has no Key Entities section.

### Source code (repository root)

```text
src/
├── components/
│   ├── PronounceButton.tsx      # ADDED — the button, ~45 lines
│   ├── OutcomeButtons.tsx       # UNCHANGED — deliberately; see below
│   ├── CardFace.tsx             # UNCHANGED
│   └── ui/button.tsx            # UNCHANGED
├── routes/
│   ├── Run.tsx                  # MODIFIED — a grid wrapper around the two, ~5 lines
│   └── Run.test.tsx             # MODIFIED — new tests appended; nothing existing edited
├── speech/
│   ├── voice.ts                 # ADDED — pickVoice(), pure, ~15 lines
│   └── voice.test.ts            # ADDED
├── run/                         # UNCHANGED — the engine never learns speech exists
├── storage/                     # UNCHANGED — nothing persisted changes
└── decks/                       # UNCHANGED — not one word of content changes
```

**Structure Decision**: the pure part goes in its own module (`src/speech/voice.ts`) and the React
part stays in one component, mirroring how `src/run/` already separates a pure engine from the
screen that drives it. The new directory earns itself by being the only way `pickVoice` is testable
without rendering anything.

**`OutcomeButtons.tsx` is not modified, and that is a decision rather than an omission.** The
asymmetric layout could have been built by putting the speaker inside it — but the speaker is not an
outcome, and that component's own header comment says the mechanic never inspects card content.
Passing it the word to say would break exactly that. So the geometry lives one level up, in a
two-column grid in `Run.tsx`: the speaker takes `col-start-2`, `OutcomeButtons` spans both columns
below it, untouched.

## Implementation notes that will otherwise be rediscovered the hard way

- **`SpeechSynthesisVoice` has no gender property.** Five fields: `default`, `lang`, `localService`,
  `name`, `voiceURI`. Any implementation of "female voice" is a name match. Do not go looking for
  the flag; it does not exist.
- **The fallback must not pick an arbitrary en-US voice.** Over a third of macOS's `en_US` voices are
  novelty voices — Bells sings, Zarvox is a robot, Whisper whispers. Leave `utterance.voice` unset
  and set `lang = 'en-US'`; the browser's own default is never one of those. This is both safer and
  less code than sorting a candidate list.
- **Call `getVoices()` in the click handler, not at mount.** Chrome returns `[]` until voices load.
  Asking at press time means asking long after that, and an empty list degrades into the fallback
  that already exists.
- **Guard on React state, not `speechSynthesis.speaking`.** The global cannot re-render the
  animation, and Safari has been known to leave it `true` after speech ends.
- **Reset on `error` as well as `end`.** A cancel arrives as an error (`canceled` / `interrupted`),
  so this is what makes the button survive being interrupted — FR-012.
- **The cleanup effect keys on the word.** `useEffect(() => () => speechSynthesis.cancel(), [word])`
  is three lines covering all four "stop talking" cases: mark, restart, leave, complete.
- **`prefers-reduced-motion` must switch the animation off**, and the button must still work with it
  off. Accessibility is not something the "keep it simple" instruction reaches.

## Complexity Tracking

> No constitution violation, and nothing more complex than the description implies. One row,
> recording where the template's default was skipped.

| Choice | Simpler than | Why it holds |
|---|---|---|
| No `data-model.md` | The template's Phase 1 default | No data, no entity, nothing persisted. A document saying "no entities" is process for its own sake. |

## Post-design re-check

Re-evaluated after Phase 1. **No verdict changed.** Three things the design work established rather
than assumed:

- **The feature's real risk is silence, and it is not the risk it looked like going in.** The
  obvious worry was the no-queue rule being fiddly. It is one boolean. What replaces it is a failure
  mode with no symptom — a button that speaks nothing passes lint, typecheck, all 166 tests, the
  build, and every new test written for it, because neither CI nor `jsdom` can hear. Quickstart's
  first instruction is to turn the volume up.
- **`jsdom`'s lack of a Web Speech API is a gift, not an obstacle.** It makes the "no speech
  available" path the default in tests, so the 166 existing tests passing *unmodified* is itself the
  evidence for FR-011. That is a stronger check than a test written to assert it.
- **The `unrequested` risk here was settings, not code.** A voice picker, a speed control and an
  autoplay toggle all suggest themselves within a minute of building this. FR-016 and the spec's
  assumptions close each one off in writing, which is what stops them being added "while I was in
  there".

Two things are **unverified** and carry quickstart steps rather than being presented as fact: which
voice actually speaks on each real device (step 1), and that a subtle icon animation reads as subtle
to the maintainer rather than to me (step 3). Everything else — the absent gender field, the macOS
voice list, `jsdom`'s missing API, the 166-test baseline, the vertical arithmetic — was read out of
a typings file, a system command, a running process, or a real test run.
