# Research: Pronounce Word Button

**Date**: 2026-08-24 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Seven decisions. Every one takes the obvious option; the only two that needed thought are
Decision 2 (there is no such thing as a "female voice" flag) and Decision 7 (what a test can
actually observe).

## Decision 1: the browser speaks. Nothing is added to the app.

**Decision**: `window.speechSynthesis` — the platform's own text-to-speech. **No new dependency,
no audio files, no network.**

**Rationale**: this is the boring answer and it is also the only one that fits the constitution.
Principle I forbids a server; FR-015 forbids the word leaving the device. Browser speech satisfies
both by construction rather than by care — there is no request to accidentally make. It costs zero
bytes of bundle, works offline, and already knows how to say English words.

**Alternatives considered**:

- **Pre-recorded audio per word** — 80 files across the two decks, each one produced, licensed and
  committed, and a new deck ships mute until someone records it. Megabytes for something the device
  does for free.
- **A cloud text-to-speech API** — violates Principle I and FR-015, costs money, needs a key the
  app has nowhere to keep, and breaks with no network.

## Decision 2: there is no gender field, so "female" is a name match with a cascade beneath it

**Decision**: prefer an American English voice whose name contains a known female hint; otherwise
fall through the device's own American default, then any American voice, then any English voice.

**The API has no gender.** Read out of the DOM typings rather than recalled —
`node_modules/@typescript/typescript-darwin-arm64/lib/lib.dom.d.ts:35847`:

```ts
interface SpeechSynthesisVoice {
    readonly default: boolean;
    readonly lang: string;
    readonly localService: boolean;
    readonly name: string;
    readonly voiceURI: string;
}
```

Five properties. No gender, no age, no description. Every implementation of "use a female voice" on
the web is therefore a name match, and this one is no exception.

**Match on a substring, not the whole name.** Platforms decorate voice names, and whole-name equality
misses every decorated one. Verified on the development machine — 8 of the 28 `en_US` voices
`say -v '?'` lists carry a parenthetical suffix:

> Eddy (English (US)), Flo (English (US)), Grandma (English (US)), Grandpa (English (US)),
> Reed (English (US)), Rocko (English (US)), Sandy (English (US)), Shelley (English (US))

`Samantha` is plain only because it is single-locale today; if Apple makes it multilingual the way it
did Flo, whole-name matching stops finding the one entry that is verified to exist. Windows is
reported to write `Microsoft Zira Desktop - English (United States)` — **not verified here**, since
this is a macOS machine with no browser automation in the repo — but the pattern is the same one.
Language tags get the same treatment for the same reason: `en_US`, `en-us` and `en-US` are one
language written three ways.

**The hint list**: `samantha`, `zira`, `aria`, `jenny`, `google us english`, `female`, compared
lower-case.

`Samantha` is **verified end to end**: UAT on the Pages preview on 2026-08-24 confirmed it is the
voice the browser actually selected and spoke with. That matters more than it sounds — `say -v '?'`
lists macOS's speech voices, which is one layer removed from the names the Web Speech API exposes to
a page, so until UAT the whole list rested on an inference. Rule 1 is now known to fire.

The other four are still unverified, and a wrong entry is cheap: it matches nothing and the next rule
answers.

**Why the device default sits above "any American voice".** Real data, from `say -v '?'`:

> Albert, **Bad News**, **Bahh**, **Bells**, **Boing**, **Bubbles**, **Cellos**, **Wobble**, Eddy,
> Flo, Fred, **Good News**, Grandma, Grandpa, **Jester**, Junior, Kathy, **Organ**, **Superstar**,
> Ralph, Reed, Rocko, Samantha, Sandy, Shelley, **Trinoids**, **Whisper**, **Zarvox**

Fourteen of twenty-eight are novelty voices. "Bells" sings, "Zarvox" is a robot, "Whisper" whispers —
an arbitrary pick can hand a five-year-old learning the word *yellow* a singing bell. The browser's
own default never is one, so trying it first costs one `??` and removes the common case. The
arbitrary pick remains as the rule beneath it, and can still land on a novelty voice on a device with
no default marked. **That is accepted rather than solved**: an odd voice is a smaller failure than no
voice, which is the maintainer's call and the reason the cascade has four rungs instead of two.

[quickstart.md](./quickstart.md) checks what actually speaks on real devices, which is the only way
to know.

**Alternative considered**: shipping a voice with the app so the sound is identical everywhere.
Rejected — that is a speech engine in the bundle, which is a different and much larger project.

## Decision 3: ask for the voice list when the button is pressed, not before

**Decision**: call `getVoices()` inside the click handler. **No `voiceschanged` listener, no cached
voice state, no effect.**

**Rationale**: the well-known trap is that Chrome returns `[]` from `getVoices()` until voices have
loaded — which bites code that asks at mount. Asking inside a click handler means asking after the
page has loaded, after the learner has navigated into a run, and after they have looked at a card.
Voices are long since populated.

And if they somehow are not, nothing breaks: an empty list matches no name, so no voice is set, and
Decision 2's fallback speaks the word anyway. The degraded path and the fallback path are the same
path, which is why it needs no handling of its own.

**Alternative considered**: subscribing to `voiceschanged` and caching the chosen voice in state.
Rejected as a subscription, an effect and a piece of state bought to fix a case that already
resolves correctly on its own.

## Decision 4: one piece of React state, and "speaking" is derived from it

**Decision**: `const [spokenWord, setSpokenWord] = useState<string | null>(null)`, with
`const speaking = spokenWord === word` worked out at render. Set to the word on speak, back to
`null` on the utterance's `end` and `error`. The guard is `if (speaking) return;`.

That guard **is** "don't queue up pronunciations" (FR-007). There is no queue to manage because
nothing is ever enqueued.

**Revised 2026-08-24, during implementation.** The first pass stored a bare `speaking` boolean, which
is the obvious shape and the wrong one. Returning to idle after a cancel then depended entirely on
the browser firing `error` on the cancelled utterance — a promise another program keeps, not ours.
A device that stops making sound without reporting it left the button latched and dead for the rest
of the run, silently, which is the one failure mode this feature cannot afford. Storing the word
instead makes a word change land on idle by comparison: **nothing can latch a value that is only
ever compared.** Same single piece of state, and one fewer thing to remember to reset.

**Not `speechSynthesis.speaking`**, for two reasons. It is a browser global, so React cannot
re-render the animation when it changes — and the animation is a requirement (FR-013a). And it is
known to be unreliable across Safari versions, where it can stay `true` after speech ends.

**`error` resets it as well as `end`**, which is what discharges FR-012. `SpeechSynthesisErrorCode`
(`lib.dom.d.ts:44457`) includes `canceled` and `interrupted`, so a cancel comes back through the
same path a failure does and the button is pressable again either way.

**Ceiling, named rather than engineered around**: if a browser fires *neither* `end` nor `error`,
the button stays unpressable for that word — and, stated at its true size, for **every later
presentation of the same word in the run**, since `spokenWord` is never cleared and a "Not yet" card
comes back in the next cycle by design. Any *other* card is unaffected, because `spokenWord === word`
is then false. Note this is why it is scoped: the component is **not**
remounted on a card change. It has no `key` and a stable position in `src/routes/Run.tsx`, so it
re-renders with a new prop. Under the old boolean that distinction was the bug; under a derived
value it is simply correct. A watchdog timer for a case no known browser produces is exactly the
speculative work Principle VI rules out.

## Decision 5: one cleanup effect covers every "stop talking" case

**Decision**:

```ts
useEffect(() => () => window.speechSynthesis?.cancel(), [word]);
```

Three lines, four requirements. The cleanup runs when the word changes and when the component goes
away, and those two events are every case the spec lists:

| Case | Requirement | How it is covered |
|---|---|---|
| The learner marks a card | FR-009 | The word changes |
| The learner restarts the run | FR-009 | The word changes |
| The learner leaves the run | FR-009 | The component unmounts |
| The run completes | FR-010 | The component unmounts |

**A caveat worth knowing**: the effect keys on the *word*, so the same card presented twice running
does not re-trigger it. **That does happen**, in two ordinary ways: fail only the last card of a
cycle and `src/run/reducer.ts` makes the next queue that single card, presenting it again straight
away; and a "Start over" reshuffle can land on the card already showing. Neither needs the speech to
stop — the word on screen is still the word being said, `spokenWord === word` still holds, and the
utterance ends on its own. Two *different* cards cannot collide, because a rung's cards are distinct
sight words. Keying on the card id instead would mean handing this component an id it otherwise has
no use for.

The call is `?.` because the hook runs ahead of the availability guard, so it still fires on a device
with no Web Speech API — which is the path `jsdom` takes on every unmount in the suite.

## Decision 6: a two-column grid puts the button above "Not yet" without touching the outcome buttons

**Decision**: wrap the pronounce button and the existing `OutcomeButtons` in a two-column grid.
The pronounce button takes `col-start-2`; `OutcomeButtons` spans both columns underneath, entirely
unmodified.

**Rationale**: the maintainer chose the asymmetric layout — above "Not yet" only, nothing above
"Got it". A grid does the width arithmetic, so the pronounce button lines up with "Not yet" without
anyone writing `calc(50% - 0.5rem)`. `OutcomeButtons` keeps its own file, its own two buttons at
their present size, and its comment about never inspecting card content — the word is passed to the
new component, not into it.

**Alternative considered**: putting the pronounce button inside `OutcomeButtons`. Rejected — it is
not an outcome, and it would mean handing that component the card's text, which is the one thing its
own header comment says it must not see.

### The vertical budget

SC-007 is the requirement a new row could break. Same 320 × 568 arithmetic the font change used,
from `src/routes/Run.tsx`'s `main` (`min-h-svh`, `gap-8`, `p-6`):

| Element | Before | After |
|---|---|---|
| Padding, top + bottom (`p-6`) | 48 | 48 |
| Deck · rung heading (`text-sm`) | 20 | 20 |
| Card face (`text-7xl leading-none`) | 72 | 72 |
| Cycle counter (`text-base`) | 24 | 24 |
| **Pronounce button (`h-12`)** | — | **48** |
| **Gap below it (`gap-y-2`)** | — | **8** |
| Outcome buttons (`h-24`) | 96 | 96 |
| "Start over" row | 32 | 32 |
| Four `gap-8` gaps | 128 | 128 |
| **Total** | **420** | **476** |

**Still five children of `main`, so still four `gap-8` gaps** — the new button joins an existing
child rather than becoming a sixth one, which is what keeps this to +56 rather than +88. **476
against 568 leaves 92px of slack.** No scrolling, no overlap.

## Decision 7: what is tested, and the one thing that cannot be

**`jsdom` has no Web Speech API.** Verified by running it rather than assumed:

```
speechSynthesis in window: false
SpeechSynthesisUtterance in window: false
```

Three consequences, and they are all good ones:

1. **FR-011's hide-path is the default in tests.** With no `speechSynthesis`, the button is not
   rendered — so the existing **166 tests pass completely unmodified**, and that is itself the
   proof that a device which cannot speak loses nothing. No test file should need editing.
2. **Voice selection is a pure function**, so it is unit-tested directly: given a voice list, which
   voice comes back. Principle IV's "every pure function transforming user data" clause, and the
   one piece of real logic in the feature.
3. **The speaking behaviour is tested against a stubbed `speechSynthesis`**, asserting *what was
   spoken and how many times* — not that a method was called. Pressing five times must produce
   exactly one spoken word; that is an outcome, and it is the requirement.

**What no test can see: whether sound comes out of the device.** This is the same shape of risk the
font swap had — a green `lint → typecheck → test → build` and silence in the room. A human with a
phone is the only check that catches it, which is what [quickstart.md](./quickstart.md) is for.

**Tests deliberately not written**, because each restates the diff rather than testing behaviour:
asserting the icon is a speaker, asserting `utterance.lang === 'en-US'` on a stub that stores
whatever it is handed, and asserting the animation class is present. The first two are
change-detectors and the third reads a class name, which Principle IV bans outright.
