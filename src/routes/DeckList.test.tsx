// Queried by role and visible text only — no class names, no internals, no
// snapshots (Principle IV). The progress rules themselves are covered as plain
// function calls in src/decks/ladder.test.ts.
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { dolchK5 } from '@/decks/dolch-k-5';
import { dolchPreK5 } from '@/decks/dolch-prek-5';
import { decks } from '@/decks/registry';
import type { DeckConfig } from '@/decks/types';
import { DeckList } from '@/routes/DeckList';
import { deckKey } from '@/storage/keys';
import { writeItem } from '@/storage/safeStorage';

// The real registry, because the list renders it: Dolch Pre-K (r1–r8) then Dolch
// Kindergarten (r1–r9, r11), both starting at a rung labelled "Level 1".
const EVERY_PRE_K_RUNG = dolchPreK5.rungs.map((rung) => rung.id);

/**
 * Seeds one deck's stored progress. An absent key and a record with nothing
 * completed read identically (covered in src/storage/deckRecord.test.ts), and
 * seeding is what makes each test's starting state known: under Node 26
 * `globalThis.localStorage` reads back undefined, so safeStorage keeps one
 * module-level in-memory map that would otherwise carry the previous test's
 * writes into this one.
 */
function seed(deckId: string, completedRungIds: string[]): void {
  writeItem(deckKey(deckId), JSON.stringify({ schemaVersion: 1, completedRungIds }));
}

beforeEach(() => {
  for (const deck of decks) {
    seed(deck.id, []);
  }
});

function renderList() {
  const router = createMemoryRouter([{ path: '/', element: <DeckList /> }], {
    initialEntries: ['/'],
  });
  render(<RouterProvider router={router} />);
}

function expectDeckLink(deck: DeckConfig) {
  expect(screen.getByRole('link', { name: deck.title })).toHaveAttribute(
    'href',
    `/deck/${deck.id}`,
  );
}

describe('DeckList', () => {
  it('lists every built-in deck and opens each one at its ladder (FR-034)', () => {
    renderList();

    expect(screen.getByRole('heading', { name: 'FlashRunner' })).toBeInTheDocument();
    for (const deck of decks) {
      expectDeckLink(deck);
    }
  });

  it('shows a deck with no progress as not started and names its smallest run', () => {
    renderList();

    // Both built-in ladders begin at Level 1, so both lines read the same.
    expect(screen.getAllByText('Not started · Next run: Level 1')).toHaveLength(decks.length);
  });

  it('shows the highest rung completed and offers the one above it', () => {
    seed(dolchPreK5.id, ['r1', 'r2', 'r3']);
    renderList();

    expect(screen.getByText('Completed Level 3 · Next run: Level 4')).toBeInTheDocument();
    // Untouched decks are unaffected — one record per deck (FR-036).
    expect(screen.getByText('Not started · Next run: Level 1')).toBeInTheDocument();
  });

  it('ignores a stored rung id the deck does not have', () => {
    seed(dolchPreK5.id, ['r99']);
    renderList();

    expect(screen.getAllByText('Not started · Next run: Level 1')).toHaveLength(decks.length);
  });

  it('marks a mastered deck and offers it no larger run', () => {
    seed(dolchPreK5.id, EVERY_PRE_K_RUNG);
    renderList();

    expect(screen.getByText('Deck mastered')).toBeInTheDocument();
    // Still reachable, so any rung can be repeated one level down (FR-016).
    expectDeckLink(dolchPreK5);
  });

  it('starts normally with a stored record for a deck that is no longer built in (FR-022)', () => {
    writeItem(
      deckKey('retired-deck'),
      JSON.stringify({ schemaVersion: 1, completedRungIds: ['r1'] }),
    );
    seed(dolchK5.id, ['r1']);
    renderList();

    // The list looks up one key per known deck, so the orphan is never read.
    expect(screen.getAllByRole('link')).toHaveLength(decks.length);
    expect(screen.getByText('Completed Level 1 · Next run: Level 2')).toBeInTheDocument();
  });
});
