// Choosing which voice says the word. One pure function over a voice list --
// no React, no browser access; the caller asks for the list at press time so it
// is always the live one (research.md § Decision 3).
// See specs/005-pronounce-word/contracts/pronunciation.md § 3.

/**
 * Substrings that mark a voice as female on some platform. `SpeechSynthesisVoice`
 * has no gender field, so "female" can only ever be a name match, and matching on
 * a substring rather than the whole name is what makes it survive the decoration
 * platforms add: macOS ships `Flo (English (US))`, Windows `Microsoft Zira
 * Desktop - English (United States)`.
 *
 * `Samantha` is the only entry verified present on a real machine (macOS
 * `say -v '?'`). Being wrong about the rest is cheap -- an entry that matches
 * nothing just falls through to the next rule.
 */
const FEMALE_HINTS = ['samantha', 'zira', 'aria', 'jenny', 'google us english', 'female'];

/** `en_US`, `en-us` and `en-US` are the same language written three ways. */
function tag(voice: SpeechSynthesisVoice): string {
  return voice.lang.toLowerCase().replace('_', '-');
}

/**
 * The best available voice for an American English word, or `undefined` when the
 * device has no English voice at all -- in which case the caller leaves
 * `utterance.voice` unset and the browser uses whatever it has.
 *
 * Four rules, first match wins: a female-sounding American voice; the device's
 * own American default; any American voice; any English voice.
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const american = voices.filter((voice) => tag(voice).startsWith('en-us'));
  return (
    american.find((voice) =>
      FEMALE_HINTS.some((hint) => voice.name.toLowerCase().includes(hint)),
    ) ??
    // Before any American voice, because the browser's own default is never one
    // of the novelty voices -- Bells sings, Zarvox is a robot, Whisper whispers
    // -- that half of macOS's en_US list is made of. One `??`, and the singing
    // bell only comes up on a device whose default is itself missing.
    american.find((voice) => voice.default) ??
    american[0] ??
    voices.find((voice) => tag(voice).startsWith('en'))
  );
}
