// The word on the card, said out loud by the browser's own text-to-speech
// (research.md § Decision 1). Nothing is added to the app to make this work: no
// audio files, no dependency, and no request — so the word cannot leave the
// device, because there is nowhere to send it (FR-015).
//
// It sits beside the outcomes without being one. Pressing it marks nothing,
// advances nothing and stores nothing, which is why the word is passed to this
// component rather than into src/components/OutcomeButtons.tsx (FR-006).
// See specs/005-pronounce-word/contracts/pronunciation.md.
import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pickVoice } from '@/speech/voice';

export function PronounceButton({ word, onHeard }: { word: string; onHeard: () => void }) {
  // The whole of the state machine (contract § 4): idle or speaking, and no
  // queue, because nothing is ever enqueued. What is stored is the word being
  // said rather than a bare flag, so that "is it speaking?" is derived at render
  // and a word change lands on idle by arithmetic instead of by anyone
  // remembering to reset it.
  //
  // That matters because the alternative depends on a promise another program
  // keeps. A cancel is meant to come back through the utterance's `error`
  // handler; a device that stops making sound without admitting it would leave a
  // flag latched and the button dead for the rest of the run — silently, which is
  // this feature's whole failure mode. Nothing can latch a value that is only
  // ever compared.
  //
  // Deliberately not read from `speechSynthesis.speaking` either: React cannot
  // re-render on a browser global, and Safari has been known to leave that flag
  // true after speech has ended.
  const [spokenWord, setSpokenWord] = useState<string | null>(null);
  const speaking = spokenWord === word;

  // Stops the talking in all four cases at once: marking a card and restarting
  // change the word, leaving the run and completing it unmount the component
  // (FR-009, FR-010). Returning to idle is the line above's job, not this one's —
  // all this does is stop the sound.
  //
  // It keys on the word rather than the card id because the word is all this
  // component is given, so the same card presented twice running does not
  // re-trigger it. That does happen — fail only the last card of a cycle and
  // src/run/reducer.ts makes the next queue that one card, and a "Start over"
  // can reshuffle onto the card already showing. Nothing needs to stop in either
  // case: the word on screen is still the word being said, `spokenWord === word`
  // still holds, and it ends on its own. A rung's cards are distinct words, so
  // two *different* cards can never collide here.
  //
  // The optional call is not defensiveness: the hook has to run before the
  // availability guard below, so on a device with no Web Speech API this cleanup
  // still fires with nothing to cancel. That is the path jsdom takes.
  useEffect(() => () => window.speechSynthesis?.cancel(), [word]);

  // A browser without the Web Speech API loses the button and nothing else — no
  // error, no dead control, and no empty row left behind in the grid, since a
  // component that renders nothing is not a grid item (FR-011). This is the path
  // jsdom takes, which is why the run screen's existing tests never meet this
  // component at all. The hooks above run unconditionally, ahead of this return.
  if (!('speechSynthesis' in window)) {
    return null;
  }

  function speak(): void {
    // The press is the signal, not the word finishing (FR-002 of 007). Above the
    // early return below, so a press during speech — which starts nothing —
    // still reports. The receiver sets an already-set flag, so repeating is free.
    //
    // No test holds this ordering any more. It was observable only when the same
    // word came back mid-utterance with the latch still set, and 009 rebuilds
    // this component on every card presentation, which clears the latch. Moving
    // `onHeard()` below would now break nothing — so do not, and do not read the
    // silence as permission.
    //
    // Nothing here knows about the transition: the run screen refuses the press
    // before this component sees it (FR-002 of 010).
    onHeard();
    // A press while the word is still being said does nothing at all: no second
    // utterance, and nothing held back to play afterwards (FR-007).
    if (speaking) {
      return;
    }
    // A lone capital is announced as one: the card "I" comes out as "capital I"
    // rather than as the word, which is the opposite of hearing it read. Lower
    // case for the device only — the card keeps its capital, because that is how
    // a reader meets the word (FR-005a, contract § 3a). Nothing longer is
    // touched, so the fix cannot reach a word where case carries meaning.
    const spoken = word.length === 1 ? word.toLowerCase() : word;
    const utterance = new SpeechSynthesisUtterance(spoken);
    // Set whether or not a voice is chosen below, and the whole of the last
    // resort when none is: an unset `voice` with an American English `lang`
    // leaves the browser to use what it has (contract § 3 rule 5).
    utterance.lang = 'en-US';
    // Asked for at press time, never at mount, where Chrome answers with an empty
    // list until voices have loaded (research.md § Decision 3). An empty list
    // needs no handling of its own — it falls out of the cascade as `undefined`.
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice !== undefined) {
      utterance.voice = voice;
    }
    // `error` matters as much as `end`: a cancel arrives as one (`canceled` /
    // `interrupted`), and a pronunciation that fails must leave the control
    // pressable rather than latched (FR-008, FR-012).
    const idle = () => setSpokenWord(null);
    utterance.onend = idle;
    utterance.onerror = idle;
    setSpokenWord(word);
    window.speechSynthesis.speak(utterance);
  }

  return (
    // The accessible name is the action, not the word: the word is already on
    // screen as the card, and what a screen-reader user needs to know is what the
    // control does (FR-013). `h-12` against the outcome buttons' `h-24`, and an
    // outline rather than their fill, so it cannot be taken for an outcome
    // (FR-014). The icon carries its own size-* because the base Button class
    // forces an unsized descendant svg to size-4.
    //
    // `col-start-2` lives here rather than on a wrapper in src/routes/Run.tsx so
    // that a device which cannot speak leaves no empty grid cell where the button
    // would have been. The only caller is that grid.
    <Button
      aria-label="Hear the word"
      className="col-start-2 h-12"
      variant="outline"
      onClick={speak}
    >
      {/* The sign of activity is the icon alone, and only while speaking: the
          button is never dimmed, greyed or animated as a whole, so it cannot
          compete with the card for a learner's attention (FR-013a). Under
          `prefers-reduced-motion: reduce` the pulse does not run and the control
          works exactly the same, which is what `motion-safe:` is doing here.

          The duration is overridden because Tailwind's own `animate-pulse` is a
          2s cycle and a one-syllable sight word is spoken in under half of that:
          at the stock speed the opacity has fallen to roughly 0.9 by the time the
          word ends, which reads as nothing happening at all. 500ms fits a whole
          cycle inside the shortest word in either deck. */}
      <Volume2
        className={
          speaking
            ? 'size-6 motion-safe:animate-pulse motion-safe:[animation-duration:500ms]'
            : 'size-6'
        }
        aria-hidden="true"
      />
    </Button>
  );
}
