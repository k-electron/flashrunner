import { describe, expect, it } from 'vitest';
import type { DeckConfig } from '@/decks/types';
import { decks } from '@/decks/registry';
import { validateDeck } from '@/decks/validate';

// One deliberately malformed fixture per rule. Each starts from a deck that is
// valid apart from the single rule under test.
function deck(overrides: Partial<DeckConfig> = {}): DeckConfig {
  return {
    id: 'fixture',
    title: 'Fixture',
    cards: [
      { id: 'a', front: 'a' },
      { id: 'b', front: 'b' },
      { id: 'c', front: 'c' },
    ],
    rungs: [
      { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
      { id: 'r2', label: '3 words', cardIds: ['a', 'b', 'c'] },
    ],
    ...overrides,
  };
}

function messagesFor(rule: string, config: DeckConfig): string[] {
  return validateDeck(config).filter((message) => message.startsWith(`${rule}:`));
}

describe('validateDeck', () => {
  it('reports nothing for a well-formed deck', () => {
    expect(validateDeck(deck())).toEqual([]);
  });

  it('V1: reports a deck with no cards', () => {
    const problems = messagesFor(
      'V1',
      deck({ cards: [], rungs: [{ id: 'r1', label: '0 words', cardIds: [] }] }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no cards');
  });

  it('V1: reports a duplicated card id', () => {
    const problems = messagesFor(
      'V1',
      deck({
        cards: [
          { id: 'a', front: 'a' },
          { id: 'a', front: 'A' },
          { id: 'b', front: 'b' },
          { id: 'c', front: 'c' },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"a"');
  });

  it('V2: reports a deck with no rungs', () => {
    const problems = messagesFor('V2', deck({ rungs: [] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no rungs');
  });

  it('V3: reports a duplicated rung id', () => {
    const problems = messagesFor(
      'V3',
      deck({
        rungs: [
          { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
          { id: 'r1', label: '3 words', cardIds: ['a', 'b', 'c'] },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"r1"');
  });

  it('V4: reports a rung listing a card the deck does not have', () => {
    const problems = messagesFor(
      'V4',
      deck({
        rungs: [
          { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
          { id: 'r2', label: '3 words', cardIds: ['a', 'b', 'c', 'z'] },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"z"');
  });

  it('V5: reports a rung listing the same card twice', () => {
    const problems = messagesFor(
      'V5',
      deck({
        rungs: [
          { id: 'r1', label: '2 words', cardIds: ['a', 'a', 'b'] },
          { id: 'r2', label: '3 words', cardIds: ['a', 'b', 'c'] },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"a"');
  });

  it('V6: reports a rung that drops a card the rung below it has', () => {
    const problems = messagesFor(
      'V6',
      deck({
        cards: [
          { id: 'a', front: 'a' },
          { id: 'b', front: 'b' },
          { id: 'c', front: 'c' },
        ],
        rungs: [
          { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
          { id: 'r2', label: '2 words', cardIds: ['a', 'c'] },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"b"');
  });

  it('V6: accepts a rung that reorders the cards of the rung below it', () => {
    // Containment is a set relation, not a prefix match.
    expect(
      validateDeck(
        deck({
          rungs: [
            { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
            { id: 'r2', label: '3 words', cardIds: ['c', 'b', 'a'] },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('V7: reports a top rung that omits a card, leaving it unreachable', () => {
    const problems = messagesFor(
      'V7',
      deck({
        rungs: [
          { id: 'r1', label: '1 word', cardIds: ['a'] },
          { id: 'r2', label: '2 words', cardIds: ['a', 'b'] },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"c"');
  });

  it('V7: reports a top rung that lists a card the deck does not have', () => {
    const problems = messagesFor(
      'V7',
      deck({
        rungs: [
          { id: 'r1', label: '2 words', cardIds: ['a', 'b'] },
          { id: 'r2', label: '4 words', cardIds: ['a', 'b', 'c', 'z'] },
        ],
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"z"');
  });

  // SC-005 in executable form: a malformed built-in deck fails CI rather than
  // reaching a learner.
  it.each(decks)('reports no violations for the built-in deck $id', (config) => {
    expect(validateDeck(config)).toEqual([]);
  });
});
