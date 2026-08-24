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

export function PronounceButton({ word }: { word: string }) {
  // The whole of the state machine (contract § 4): idle or speaking, and no
  // queue, because nothing is ever enqueued. Deliberately not read from
  // `speechSynthesis.speaking` — React cannot re-render on a browser global, and
  // Safari has been known to leave that flag true after speech has ended.
  const [speaking, setSpeaking] = useState(false);

  // Stops the talking in all four cases at once: marking a card and restarting
  // change the word, leaving the run and completing it unmount the component
  // (FR-009, FR-010). The browser answers a cancel through the utterance's
  // `error` handler, which is what returns the control to idle.
  //
  // It keys on the word rather than the card id because the word is all this
  // component is given. Two consecutive cards showing the same string would not
  // re-trigger it — which cannot happen, since a rung's cards are distinct words.
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
    // A press while the word is still being said does nothing at all: no second
    // utterance, and nothing held back to play afterwards (FR-007).
    if (speaking) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(word);
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
    const idle = () => setSpeaking(false);
    utterance.onend = idle;
    utterance.onerror = idle;
    setSpeaking(true);
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
          works exactly the same, which is what `motion-safe:` is doing here. */}
      <Volume2
        className={speaking ? 'size-6 motion-safe:animate-pulse' : 'size-6'}
        aria-hidden="true"
      />
    </Button>
  );
}
