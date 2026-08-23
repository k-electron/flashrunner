// The authored half of the data model: deck configs ship with the app, are
// immutable at runtime, and are never written to storage.
// See specs/001-deck-runs/contracts/deck-config.md.

export type DeckId = string;
export type CardId = string;
export type RungId = string;

export type CardConfig = {
  id: CardId; // stable within the deck
  front: string; // the visible face (FR-023)
  back?: string; // absent for single-sided decks (FR-024)
};

export type RungConfig = {
  id: RungId; // stable — appears in stored progress
  label: string; // "5 words"
  cardIds: CardId[]; // EXPLICIT membership, in presentation order. Never computed.
};

export type DeckConfig = {
  id: DeckId; // stable forever — storage keys hang off this
  title: string; // shown to the adult
  cards: CardConfig[]; // every card in the deck
  rungs: RungConfig[]; // ordered smallest → largest
};
