import { describe, expect, it } from 'vitest';
import { deckKey } from '@/storage/keys';

// The literal string, not a re-derivation. Every other test calls deckKey() to
// build the key it then asserts on, so the `flashrunner:` prefix could vanish
// without a single failure — and a namespace collision with another app on the
// same origin is silent data loss (constitution Principle II).
describe('deckKey', () => {
  it('namespaces the key with the literal flashrunner: prefix', () => {
    expect(deckKey('dolch-prek-5')).toBe('flashrunner:deck:dolch-prek-5');
  });
});
