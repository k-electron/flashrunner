// The four outcomes of contract § 3, one of which is `undefined`. That is not a
// gap in coverage: `undefined` is the instruction to leave `utterance.voice`
// unset, so it is asserted as deliberately as a returned voice is.
import { describe, expect, it } from 'vitest';
import { pickVoice } from '@/speech/voice';

// `SpeechSynthesisVoice` has five readonly fields and `pickVoice` reads two of
// them. The cast lives here, once, rather than three invented values per fixture.
function voice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang } as SpeechSynthesisVoice;
}

describe('pickVoice', () => {
  it('returns the known-female American voice, passing over other American ones', () => {
    // Ordered so that taking the first en-US voice would return Zarvox — the
    // exact novelty-voice outcome the name match exists to avoid.
    const chosen = voice('Samantha', 'en-US');

    expect(pickVoice([voice('Zarvox', 'en-US'), chosen, voice('Fred', 'en-US')])).toBe(chosen);
  });

  it('returns undefined when every American voice is an unknown name', () => {
    // The browser then speaks in its own en-US default, which is never a
    // novelty voice — better than picking Bells off this list.
    expect(pickVoice([voice('Zarvox', 'en-US'), voice('Bells', 'en-US')])).toBeUndefined();
  });

  it('returns undefined for a known-female name in the wrong language', () => {
    // A name match alone is not enough. Samantha also ships as en-GB, and this
    // deck teaches American sight words.
    expect(pickVoice([voice('Samantha', 'en-GB'), voice('Samantha', 'en-AU')])).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    // Chrome hands back `[]` before its voices have loaded. Same answer, so the
    // caller needs no separate path for it.
    expect(pickVoice([])).toBeUndefined();
  });
});
