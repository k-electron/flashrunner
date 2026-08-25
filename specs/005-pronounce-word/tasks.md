---

description: "Task list for Pronounce Word Button"
---

# Tasks: Pronounce Word Button

**Input**: Design documents from `/specs/005-pronounce-word/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[contracts/pronunciation.md](./contracts/pronunciation.md), [quickstart.md](./quickstart.md).
No `data-model.md` — this feature persists nothing and adds no entity.

**Tests**: **Yes, and they are worth writing here** — unlike the font swap, most of this feature is
observable from `jsdom`. Voice selection is a pure function. The no-queue rule is a counting
assertion: five presses must produce exactly one spoken word. What `jsdom` *cannot* observe is
whether sound comes out, which is why T014 and T017 exist.

`jsdom` has **no Web Speech API** — verified by running it, not assumed:
`speechSynthesis in window` → `false`. Two consequences that shape this list:

1. **The "no speech available" path is the default in tests.** The existing **166 tests must pass
   completely unmodified**, and their doing so is the evidence for FR-011. No existing test file
   should need editing. If one does, something outside this feature's scope changed.
2. **Every test of the speaking behaviour needs a stub.** T008 builds it once; T012 and T016 reuse it.

Three tests are deliberately **not** written, each named and rejected in
[research § Decision 7](./research.md#decision-7-what-is-tested-and-the-one-thing-that-cannot-be):
asserting the icon is a speaker, asserting `utterance.lang === 'en-US'` on a stub that echoes back
whatever it was handed, and asserting the animation class is present. The first two restate the diff;
the third reads a class name, which Principle IV bans outright.

**Organization**: By user story, and here they really are independent increments. US1 is a button
that speaks — usable on its own even while it still queues. US2 adds the guard that makes it bearable.
US3 is verification of the degraded path. **One honest exception**: the availability check that US3
verifies must be written in T005, not deferred to Phase 5, because without it the cleanup effect
throws on unmount in `jsdom` and takes the existing 166 tests down with it. Noted where it happens
rather than papered over.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are in every task

**Checkbox states used here**: `[X]` done. `[ ]` not started. **`[~]` means partly done, with what
remains written in the task's own Status note.** Nothing is to be marked `[X]` that was not actually
done — four of these tasks can only be closed by a human listening to a device.

---

## Phase 1: Setup

**None required, and that is the finding rather than an omission.**

No dependency is installed, no config file is touched, no directory scaffolding is needed beyond the
one file `src/speech/voice.ts` creates as it is written. `window.speechSynthesis` is a platform API
and `lucide-react` is already in `package.json`. A task saying "install nothing" is process for its
own sake.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the one piece of real logic in the feature — deciding which voice speaks. US1 cannot be
built without it.

**⚠️ Blocks US1.** US2 and US3 do not depend on it directly, but both are built on top of US1.

- [X] T001 [P] Write failing tests for voice selection in `src/speech/voice.test.ts`, covering the
      outcomes rather than the mechanism: a list containing a female en-US voice returns that voice;
      a list of en-US voices with no name on the known-female list returns `undefined`; a list with a
      female-named voice in the wrong language returns `undefined`; an empty list returns `undefined`.
      `undefined` is the meaningful result — it is the signal to leave `utterance.voice` unset and let
      the browser choose (contract §3 rule 2), so assert it explicitly rather than treating it as a
      gap. Build voice fixtures as plain objects with `name` and `lang`; the real interface has only
      five readonly fields and none of them need faking beyond those two.

- [X] T002 Implement `pickVoice(voices)` in `src/speech/voice.ts` per
      [contracts/pronunciation.md §3](./contracts/pronunciation.md#3-which-voice-speaks): four rules,
      first match wins — an American English voice whose name contains a known female hint, the
      device's own American default, any American voice, any English voice — and `undefined` when the
      device speaks no English at all. Compare language tags case-insensitively with `_` read as `-`,
      and match names on a **substring**, because platforms decorate both:
      [research Decision 2](./research.md#decision-2-there-is-no-gender-field-so-female-is-a-name-match-with-a-cascade-beneath-it)
      records the eight `(English (US))` suffixes verified on the development machine. The device
      default sits above "any American voice" deliberately — half of macOS's en_US voices are novelty
      voices and the default is never one; comment that, because it looks like a redundant rule
      otherwise. The arbitrary pick beneath it can still land on a novelty voice, which is accepted.
      (FR-003, FR-004, T001)

      **Status**: revised 2026-08-24 on maintainer direction, after the first pass matched whole
      names and stopped at the device default. The earlier version could not have matched any
      decorated name, including `Samantha (English (US))`.

**Checkpoint**: `npm test` green, voice selection covered, nothing rendered yet.

---

## Phase 3: User Story 1 — A learner hears the word said out loud (Priority: P1) 🎯 MVP

**Goal**: a speaker button above "Not yet" that says the word on the card out loud in an American
English female voice.

**Independent Test**: open a run, press the speaker button, hear the word currently on the card.

**Deliverable on its own**: yes. At the end of this phase the button works. It may still queue up
repeats — that is US2's job — but a learner stuck on a word can hear it, which is the whole point of
the feature.

- [X] T003 [US1] Create `src/components/PronounceButton.tsx` taking a single `word: string` prop.
      Render a `Button` from `@/components/ui/button` containing a speaker icon from `lucide-react`
      (`Volume2`) marked `aria-hidden`, with a fixed accessible name naming the *action* — "Hear the
      word" — not the word itself, which is already on screen as the card. Size it `h-12` so it is
      visibly shorter than the `h-24` outcome buttons and cannot be mistaken for one (FR-014).
      (FR-001, FR-013, contract §2)

- [X] T004 [US1] Add the click handler to `src/components/PronounceButton.tsx`: construct a
      `SpeechSynthesisUtterance` for `word`, set `lang = 'en-US'`, set `voice` to
      `pickVoice(window.speechSynthesis.getVoices())` **only when it returns a voice**, then call
      `speak`. Call `getVoices()` inside the handler — never at mount, where Chrome returns `[]`
      before voices load. Nothing else happens: no outcome, no advance, no write.
      (FR-003, FR-004, FR-005, FR-006, T002)

- [X] T005 [US1] Add the availability guard to `src/components/PronounceButton.tsx`: return `null`
      when `speechSynthesis` is not on `window`. **This belongs to US3 by requirement (FR-011) but
      must be written now** — the cleanup effect T009 adds would otherwise throw on unmount in
      `jsdom` and break the existing 166 tests. Phase 5 verifies it; this task is what makes the
      suite survive Phase 3. (FR-011)

      **Status**: written in Phase 3 as planned, but the stated reason did not
      survive contact. The cleanup effect calls `window.speechSynthesis?.cancel()`,
      so it does not throw when the API is absent and the 166 stay green with the
      guard removed — verified by removing it. The guard earns its place on FR-011
      alone, and T016 is the only test that fails without it.

- [X] T006 [US1] Compose it in `src/routes/Run.tsx`: wrap `PronounceButton` and the existing
      `OutcomeButtons` in a two-column grid (`grid grid-cols-2 gap-x-4 gap-y-2`, `w-full max-w-md`),
      with the button on `col-start-2` and `OutcomeButtons` spanning both columns beneath it. Render
      it only in the branch where a card is showing, so the run-complete screen never has one
      (FR-010). Pass `card.front`. **Do not modify `src/components/OutcomeButtons.tsx`** — the
      speaker is not an outcome, and that file's own header comment says the mechanic never inspects
      card content. The grid also keeps the wrapper a single child of `main`, so the existing four
      `gap-8` gaps stay four. (FR-002, FR-010, FR-017, T003)

- [X] T007 [US1] Confirm the vertical budget still holds: the new row adds `h-12` + `gap-y-2` = 56px
      to the 420px measured for the font change, giving **476px against 568px** on a 320 × 568
      viewport. Check in DevTools rather than trusting the arithmetic, since this is the number
      [research Decision 6](./research.md#decision-6-a-two-column-grid-puts-the-button-above-not-yet-without-touching-the-outcome-buttons)
      computed rather than measured. (SC-007, quickstart step 6, T006)

      **Verified 2026-08-24** in DevTools at 320 × 568: the run screen fits with no
      vertical scrolling and nothing overlapping. The 476px-against-568px figure
      was arithmetic rather than measurement, and it holds. `jsdom` does no layout,
      so no test in this repository could have told us.

- [X] T008 [US1] Add a reusable `speechSynthesis` stub to `src/routes/Run.test.tsx` — installed in
      `beforeEach`, removed in `afterEach` — recording every utterance it is handed and exposing a
      way to fire `end` and `error` on the current one. It must be removable, because the existing
      tests in that file depend on the API being **absent**. Then test US1's outcomes: the button is
      present while a card is showing and absent on the run-complete screen; pressing it speaks the
      text of the card currently on screen; pressing it does not advance the run, does not change the
      "cards left in this round" count, and writes nothing new to storage. Assert on **what was
      spoken**, never on which methods were called. (FR-001, FR-005, FR-006, FR-010, T006)

- [X] T009 [US1] Browser check — [quickstart](./quickstart.md) steps **1, 2 and 5**, with the volume
      up. Confirm it speaks; that it sounds American and female; that it says the word currently on
      screen and never the previous one; and that the run-complete screen has no speaker. **Record
      which voice actually spoke**, since the name list is the one thing in this feature that cannot
      be verified from a repository. A singing, whispering or robotic voice is a real bug — that is
      the fallback failing — while a male voice is an accepted outcome on a device with no female
      en-US voice. (FR-001, FR-003, FR-004, FR-005, FR-010, SC-001, SC-002, SC-004)

      **Status**: partly. UAT on the Pages preview found one real defect and it is
      fixed: the Pre-K deck's **"I"** was being announced as **"capital I"** rather
      than as the word, because a device reads a lone capital as one. The card
      keeps its capital — that is how a reader meets the word — and only what is
      handed to the device is lowered. Covered by a test that presses every card
      of the rung, since the shuffle decides which one is "I".

      **Verified 2026-08-24** on the preview: it speaks, promptly, in American
      English, in a voice that sounds female; it says the word currently on screen
      and never the previous one; and the run-complete screen has no speaker.

      **The voice that spoke was `Samantha`.** That is the first time any entry on
      the hint list has been verified through the Web Speech API rather than
      inferred from `say -v '?'`, which is one layer removed from what the browser
      actually exposes. Rule 1 of contract §3 is therefore known to fire, not just
      believed to. The other four entries — `zira`, `aria`, `jenny`,
      `google us english` — remain unverified and cost only a fallthrough if wrong.

**Checkpoint**: the button works and is usable. It may still queue repeats. **166 + new tests green,
no existing test edited.**

---

## Phase 4: User Story 2 — Pressing repeatedly does not stack up (Priority: P2)

**Goal**: one press speaks once. Presses during speech do nothing at all. After it ends, pressing
speaks again.

**Independent Test**: press the button five times fast; the word is spoken exactly once. Wait for it
to end, press again, it speaks again.

**Note**: T010–T012 all edit `src/components/PronounceButton.tsx`, so none are `[P]`. They are listed
separately because each closes a different requirement, not because they can be done at once.

- [X] T010 [US2] Add the guard to `src/components/PronounceButton.tsx`: one piece of state,
      `const [speaking, setSpeaking] = useState(false)`. Set it true when speaking starts; return
      early from the click handler when it is already true. Reset it on the utterance's **`end`
      and `error`** — `error` matters as much as `end`, because a cancel arrives as an error
      (`canceled` / `interrupted`) and because a failed pronunciation must not leave the button
      latched. **Do not read `speechSynthesis.speaking`**: React cannot re-render on a browser global,
      and Safari has been known to leave it `true` after speech ends. There is no queue to drain
      because nothing is ever enqueued. (FR-007, FR-008, FR-012, contract §4, T004)

- [X] T011 [US2] Add the cleanup effect to `src/components/PronounceButton.tsx`:
      `useEffect(() => () => window.speechSynthesis.cancel(), [word])`. Three lines covering all four
      stop-talking cases — marking a card and restarting change the word, leaving the run and
      completing it unmount the component. Comment that the effect keys on the word rather than the
      card id, and that two consecutive cards showing the same string would not re-trigger it, which
      cannot happen because a rung's cards are distinct words. (FR-009, FR-010, T010)

- [X] T012 [US2] Add the speaking indicator to `src/components/PronounceButton.tsx`: while `speaking`
      is true, a **subtle** animation confined to the icon — `motion-safe:animate-pulse` on the svg
      only. It must not dim, grey, or animate the button as a whole, and it must not compete with the
      card for attention (FR-013a). `motion-safe:` is not optional decoration: the control must still
      work, silently, under `prefers-reduced-motion: reduce`. (FR-013a, contract §4, T010)

- [X] T013 [US2] Test the outcomes in `src/routes/Run.test.tsx` using T008's stub: pressing five
      times in succession records **exactly one** utterance; firing `end` and pressing again records
      a second; firing `error` instead of `end` also leaves the button usable (FR-012); and marking
      an outcome while speaking cancels and advances the run normally. Count utterances — the count
      *is* the requirement. (FR-007, FR-008, FR-009, FR-012, SC-003, SC-005, T010, T011)

- [X] T014 [US2] Browser check — [quickstart](./quickstart.md) steps **3 and 4**. Press five times as
      fast as possible and confirm the word is spoken once, with nothing played afterwards. Watch the
      button while it speaks and confirm the movement is small and does not pull the eye off the card
      — **this is the one judgement call in the feature, and it is the maintainer's to make**, not
      something a test can settle. Then confirm marking, "Start over" and "Leave this run" each
      silence it immediately. (FR-007, FR-008, FR-009, FR-013a, SC-003, SC-005)

      **Status**: partly. Quickstart steps 3 and 4 pass — five fast presses speak
      the word once, nothing plays afterwards, pressing again after it ends speaks
      again, and marking, "Start over" and "Leave this run" each silence it.

      The indicator failed and is fixed: Tailwind's `animate-pulse` is a **2s**
      cycle and a one-syllable sight word is spoken in under half of that, so the
      opacity had only fallen to roughly 0.9 by the time the word ended — visually
      nothing. The duration is now overridden to 500ms, which fits a whole cycle
      inside the shortest word in either deck. Note `duration-500` does **not**
      work for this: it sets `transition-duration`, not `animation-duration`.
      Verified in the built CSS that the override is emitted, comes after the
      `animation` shorthand in the cascade, and stays inside the
      `prefers-reduced-motion: no-preference` block.

      Confirmed visible by the maintainer on the preview after the change, which
      closes step 5 and with it the whole of T014. The judgement has no test by
      design — Principle IV bans reading the class name.

**Checkpoint**: the feature is behaviourally complete.

---

## Phase 5: User Story 3 — The run still works where nothing can speak (Priority: P3)

**Goal**: on a device that cannot speak, the run screen loses the button and nothing else.

**Independent Test**: remove `speechSynthesis`, open a run, confirm every other control works.

**The code for this already exists** — T005 wrote it, because the test suite could not survive
Phase 3 without it. This phase is the verification.

- [X] T015 [US3] Confirm the existing tests in `src/routes/Run.test.tsx`, `DeckLadder.test.tsx` and
      `DeckList.test.tsx` pass **with no edit of any kind**. `jsdom` has no Web Speech API, so those
      166 tests run down the no-speech path, and their staying green is the real evidence for FR-011
      and SC-006 — stronger than a test written to assert it. A test that needed changing means
      something outside this feature's scope moved; revert it rather than adapting it.
      (FR-011, FR-017, SC-006, SC-008)

      **Verified**: `git diff -U0 cbe5348 HEAD` removes **zero** lines from
      `Run.test.tsx`; `DeckLadder.test.tsx` and `DeckList.test.tsx` are not in the
      diff at all. Only two test files changed on the branch — `Run.test.tsx`
      (appends only) and the new `src/speech/voice.test.ts`.

- [X] T016 [US3] Add one explicit test in `src/routes/Run.test.tsx`, outside T008's stub, asserting
      the speaker button is **not rendered** when `speechSynthesis` is absent, while the card, both
      outcome buttons, "Start over" and "Leave this run" all are. This states FR-011 as an
      expectation rather than leaving it as an implicit property of the environment. (FR-011, SC-006)

- [X] T017 [US3] Browser check — [quickstart](./quickstart.md) step **7**. Remove
      `window.speechSynthesis` in the console, navigate client-side into a run, and confirm no speaker
      button, no error, no gap in the layout, and every other control working. If `delete` returns
      `false` — the property may be non-configurable — use the `Object.defineProperty` form given in
      the quickstart instead; a step that appears to fail because the setup did not take is worse
      than no step. (FR-011, US3, SC-006)

      **Verified 2026-08-24** in a real browser with `speechSynthesis` deleted: no
      speaker button, **no gap in the layout**, no error, and every other control
      working. The no-gap result is what confirms `col-start-2` belongs on the
      Button rather than on a wrapper — a wrapper would have left a phantom grid
      row here. T016 covers the same path in the suite.

**Checkpoint**: all three stories verified.

---

## Phase 6: Polish & Cross-Cutting

- [X] T018 Run the gate: `npm run lint && npm run typecheck && npm test && npm run build`. All four
      must pass — the same sequence CI runs, and `lint` includes `prettier --check .`, which covers
      the markdown in this directory as well as the source. Confirm the test count is **166 plus the
      new ones** and that the 166 are unmodified. (Principle III, SC-008, quickstart step 8)

      **Verified 2026-08-24**: `lint` clean (one pre-existing warning on the
      vendored `src/components/ui/button.tsx`, not from this feature), `typecheck`
      exit 0, **182 tests** in 12 files, `build` succeeded. 182 = the original 166
      plus 16 new, with zero lines removed from any pre-existing test file.

- [X] T019 Confirm the diff is what the plan said: **two files added** (`src/speech/voice.ts`,
      `src/components/PronounceButton.tsx`) plus their tests, **two modified**
      (`src/routes/Run.tsx`, `src/routes/Run.test.tsx`), and **`package.json` unchanged**. A
      dependency appearing here means something was reached for that the platform already provides.
      `src/components/OutcomeButtons.tsx`, `src/run/`, `src/storage/` and `src/decks/` must all be
      untouched. Check that none of the four declined items in
      [plan § Adjacent work](./plan.md#adjacent-work-named-and-declined) crept in — no `useSpeech`
      hook, no watchdog timer, no autoplay, no setting of any kind. Finally, grep the two new source
      files for `fetch`, `XMLHttpRequest` and any URL: there must be none. FR-015 is satisfied by
      there being no request to make, and this is the check that keeps it that way.
      (Principle I, Principle VI, FR-015, FR-016, FR-017)

      **Verified 2026-08-24** against `cbe5348`: 3 files added
      (`src/speech/voice.ts`, `src/speech/voice.test.ts`,
      `src/components/PronounceButton.tsx`), 2 modified (`src/routes/Run.tsx`,
      `src/routes/Run.test.tsx`). `package.json` and `package-lock.json` are not in
      the diff. `OutcomeButtons.tsx`, `src/run/`, `src/storage/` and `src/decks/`
      are not in the diff. Grep of both new source files for `fetch`,
      `XMLHttpRequest`, a URL, `useSpeech`, `setTimeout`, `setInterval`, `autoplay`
      and `localStorage` returns nothing — so none of the four declined items crept
      in and FR-015 holds by there being no request to make.

- [X] T020 Browser check on a **real phone**, via the PR's Pages preview —
      [quickstart](./quickstart.md) step 6, repeating steps **1, 3 and 6**. iOS is where speech
      behaves least like the desktop and where the app is actually used; a desktop pass is not
      evidence for it. Deep-link straight into a run to exercise the SPA fallback at the same time
      (Principle I). (FR-002, FR-014, SC-002, SC-007)

      **Verified 2026-08-24** on a real phone via the Pages preview at
      <https://005-pronounce-word.flashrunner.pages.dev>. Speech, the no-queue rule
      and the small-viewport layout all hold on the device the app is actually used
      on, which a desktop pass is not evidence for.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: empty.
- **Phase 2 (Foundational)**: blocks US1. T001 → T002.
- **Phase 3 (US1)**: needs Phase 2. Delivers the MVP.
- **Phase 4 (US2)**: needs US1 — every task edits the component US1 creates.
- **Phase 5 (US3)**: needs T005 (written during US1) and is best read after Phase 4, since T015
  checks the whole suite.
- **Phase 6 (Polish)**: needs everything.

### The honest picture of independence

US1 is genuinely deliverable alone: a button that speaks, even if it queues. US2 and US3 are not
parallel to it — US2 edits US1's file line by line, and US3's code had to be written inside US1 to
keep the test suite alive. **Sequential is the only sane order here**, and the phases are separated
by what they *verify* rather than by what could be staffed at once.

### Parallel opportunities

Thin, and honestly so. **T001 is the only `[P]`** in the list, because it is the only task that
touches a file nothing else touches at the time it runs. Everything after it lands in one of two
files. Marking more tasks parallel would be decoration.

### Within each story

- Foundational tests before foundational implementation (T001 → T002).
- Component before composition (T003–T005 → T006).
- Implementation before its tests for the UI work, since the tests render the finished screen.
- **Every browser check comes last in its phase**, because it is the only thing that can fail for a
  reason the suite cannot see.

---

## Implementation Strategy

### MVP first

1. Phase 2 — voice selection, tested.
2. Phase 3 — the button speaks. **Stop and listen.** If T009 is silent, nothing after it matters.
3. Deploy or demo. A learner stuck on a word can now hear it.

### Then

4. Phase 4 — the no-queue rule and the indicator. This is what makes it bearable to a child.
5. Phase 5 — verify the degraded path.
6. Phase 6 — gate, scope check, real phone.

### If something has to give

**T009, T014 and T020 do not.** They are the only checks in this list that can hear, and this
feature's failure mode is silence: a button that speaks nothing passes lint, typecheck, every test
written for it, and the build. T007 and T017 can be done in DevTools in two minutes each. T019 is
five minutes of `git diff` and is what keeps Principle VI honest.

---

## Notes

- `[P]` = different files, no dependencies. There is one.
- Commit after each task or logical group, and **do the bookkeeping in the work commit itself** —
  tick the checkbox and record what was actually verified in the same commit as the change.
- **Never mark a browser-check task `[X]` on the strength of a green test run.** Use `[~]` and write
  down what remains.
- The known-female voice list is the one thing here that no repository check can validate. Whatever
  T009 and T020 observe about real voices is worth writing into this file.
