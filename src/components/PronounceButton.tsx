// The word on the card, said out loud by the browser's own text-to-speech
// (research.md § Decision 1). Nothing is added to the app to make this work: no
// audio files, no dependency, and no request — so the word cannot leave the
// device, because there is nowhere to send it (FR-015).
//
// It sits beside the outcomes without being one. Pressing it marks nothing,
// advances nothing and stores nothing, which is why the word is passed to this
// component rather than into src/components/OutcomeButtons.tsx (FR-006).
// See specs/005-pronounce-word/contracts/pronunciation.md.
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pickVoice } from '@/speech/voice';

export function PronounceButton({ word }: { word: string }) {
  // A browser without the Web Speech API loses the button and nothing else — no
  // error, no dead control, and no empty row left behind in the grid, since a
  // component that renders nothing is not a grid item (FR-011). This is the path
  // jsdom takes, which is why the run screen's existing tests never meet this
  // component at all.
  if (!('speechSynthesis' in window)) {
    return null;
  }

  function speak(): void {
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
      <Volume2 className="size-6" aria-hidden="true" />
    </Button>
  );
}
