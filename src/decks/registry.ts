import type { DeckConfig, DeckId } from '@/decks/types';
import { dolchPreK5 } from '@/decks/dolch-prek-5';
import { dolchK5 } from '@/decks/dolch-k-5';

/** Every built-in deck, in display order. */
export const decks: DeckConfig[] = [dolchPreK5, dolchK5];

export function deckById(id: DeckId): DeckConfig | undefined {
  return decks.find((deck) => deck.id === id);
}
