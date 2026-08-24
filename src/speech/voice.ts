// Choosing which voice says the word. One pure function over a voice list — no
// React, no browser access, and no call to `getVoices()` here; the caller asks
// for the list at press time (research.md § Decision 3).
// See specs/005-pronounce-word/contracts/pronunciation.md § 3.

/**
 * Names that ship as American English female voices. `SpeechSynthesisVoice` has
 * no gender field, so "female" can only ever be a name match.
 *
 * `Samantha` is the only entry verified present on a real machine (macOS
 * `say -v '?'`); the other four are the commonly cited Chrome and Windows names
 * and are unverified here. Being wrong about one is cheap — it matches nothing
 * and falls through to the browser's own default.
 */
const KNOWN_FEMALE_NAMES = [
  'Samantha',
  'Google US English',
  'Microsoft Zira',
  'Microsoft Aria',
  'Microsoft Jenny',
];

/**
 * The first American English voice with a known-female name, or `undefined`
 * when the list holds none.
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  // There is deliberately no "otherwise any en-US voice" branch here, and its
  // absence is the design rather than a missing case. Over a third of macOS's
  // en_US voices are novelty voices — Bells sings, Zarvox is a robot, Whisper
  // whispers — so an arbitrary pick can read `yellow` to a five-year-old in a
  // singing bell. Returning `undefined` tells the caller to leave
  // `utterance.voice` unset, which makes the browser use its own en-US default;
  // that is never a novelty voice.
  return voices.find(
    (candidate) =>
      candidate.lang.startsWith('en-US') && KNOWN_FEMALE_NAMES.includes(candidate.name),
  );
}
