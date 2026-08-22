import type { DeckId } from '@/decks/types';

/** Every key this app writes is namespaced (constitution Principle II). */
export const NAMESPACE = 'flashrunner:';

/** One record per deck — there is no global blob and no index key (FR-036). */
export function deckKey(deckId: DeckId): string {
  return `${NAMESPACE}deck:${deckId}`;
}
