// One test per rung of the fallback cascade in contract § 3, plus the real-world
// name shapes that make substring matching necessary. Every test asserts which
// voice comes back, never how it was found.
import { describe, expect, it } from 'vitest';
import { pickVoice } from '@/speech/voice';

// `SpeechSynthesisVoice` has five readonly fields and `pickVoice` reads three of
// them. The cast lives here, once, rather than two invented values per fixture.
function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, default: isDefault } as SpeechSynthesisVoice;
}

describe('pickVoice', () => {
  it('prefers a female-sounding American voice over the American default', () => {
    // Ordered so that taking the first American voice, or the default one, both
    // return Zarvox -- the robot this rule exists to skip.
    const samantha = voice('Samantha', 'en-US');

    expect(pickVoice([voice('Zarvox', 'en-US', true), samantha, voice('Fred', 'en-US')])).toBe(
      samantha,
    );
  });

  it('matches a female name the platform has decorated with its locale', () => {
    // macOS writes `Flo (English (US))` and Windows `Microsoft Zira Desktop -
    // English (United States)`. Whole-name equality would miss both.
    const zira = voice('Microsoft Zira Desktop - English (United States)', 'en-US');

    expect(pickVoice([voice('Microsoft David Desktop', 'en-US'), zira])).toBe(zira);
  });

  it('reads en_US and en-us as American', () => {
    // Platforms disagree on the separator and the casing; the learner does not.
    const flo = voice('Flo (English (US))', 'en_us');

    expect(pickVoice([voice('Daniel', 'en-GB'), flo])).toBe(flo);
  });

  it("falls back to the device's own American default when no name sounds female", () => {
    // The default is never a novelty voice, so it is tried before the list order.
    const alex = voice('Alex', 'en-US', true);

    expect(pickVoice([voice('Bells', 'en-US'), alex, voice('Zarvox', 'en-US')])).toBe(alex);
  });

  it('falls back to any American voice when none is marked default', () => {
    // The British voice comes first on purpose. With only American voices in the
    // list this test would pass against an implementation that had lost the
    // "any American voice" rule entirely, since the rule beneath it — any English
    // voice — would return the same one. Here the two rules disagree.
    const fred = voice('Fred', 'en-US');

    expect(pickVoice([voice('Daniel', 'en-GB'), fred])).toBe(fred);
  });

  it('falls back to another English accent when the device has no American voice', () => {
    // A British "yellow" is further from the deck than an American one, and much
    // closer than silence.
    const daniel = voice('Daniel', 'en-GB');

    expect(pickVoice([voice('Amelie', 'fr-CA'), daniel])).toBe(daniel);
  });

  it('returns undefined when no voice speaks English, and for an empty list', () => {
    // The caller then leaves `utterance.voice` unset and the browser uses what it
    // has. Chrome also answers `[]` until its voices have loaded -- same path.
    expect(pickVoice([voice('Amelie', 'fr-CA')])).toBeUndefined();
    expect(pickVoice([])).toBeUndefined();
  });
});
