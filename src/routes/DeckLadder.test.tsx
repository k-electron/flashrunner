// Queried by role and visible text only — no class names, no internals, no
// snapshots (Principle IV). The unlocking rule itself is covered as plain
// function calls in src/decks/ladder.test.ts.
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { dolchPreK5 } from '@/decks/dolch-prek-5';
import { DeckLadder } from '@/routes/DeckLadder';
import { deckKey } from '@/storage/keys';
import { writeItem } from '@/storage/safeStorage';

// The real registry, because the route resolves through it. The Pre-K ladder is
// r1–r8, labelled "5 words" through "40 words".
const DECK_PATH = `/deck/${dolchPreK5.id}`;
const EVERY_RUNG = dolchPreK5.rungs.map((rung) => rung.id);

/**
 * Seeds the deck's stored progress, then renders the ladder over it.
 *
 * The seed is what makes each test's starting state known: under Node 26
 * `globalThis.localStorage` reads back undefined, so safeStorage keeps one
 * module-level in-memory map that would otherwise carry the previous test's
 * writes into this one.
 */
function renderLadder(completedRungIds: string[], path = DECK_PATH) {
  writeItem(deckKey(dolchPreK5.id), JSON.stringify({ schemaVersion: 1, completedRungIds }));
  const router = createMemoryRouter([{ path: '/deck/:deckId', element: <DeckLadder /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

/** Startable rungs render as links to their run; locked ones cannot be activated. */
function expectStartable(label: string, rungId: string) {
  expect(screen.getByRole('link', { name: label })).toHaveAttribute(
    'href',
    `${DECK_PATH}/rung/${rungId}`,
  );
}

function expectLocked(label: string) {
  expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: label })).toBeDisabled();
}

describe('DeckLadder', () => {
  it('lists every rung of the deck, in order', () => {
    renderLadder([]);

    expect(screen.getByRole('heading', { name: dolchPreK5.title })).toBeInTheDocument();
    for (const rung of dolchPreK5.rungs) {
      expect(screen.getByText(rung.label)).toBeInTheDocument();
    }
  });

  it('offers only the smallest rung when nothing has been completed', () => {
    renderLadder([]);

    expectStartable('5 words', 'r1');
    expectLocked('10 words');
    expectLocked('15 words');
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('marks a completed rung and keeps it startable (FR-016)', () => {
    renderLadder(['r1']);

    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expectStartable('5 words', 'r1');
  });

  it('opens the rung above a completed one and no further (FR-015, US2 scenario 4)', () => {
    // The case that separates "immediate predecessor completed" from "above the
    // highest completed rung": the latter would lock the rung just unlocked and
    // leave the deck unfinishable.
    renderLadder(['r1']);

    expectStartable('10 words', 'r2');
    expectLocked('15 words');
    expectLocked('20 words');
  });

  it('opens each next rung in turn as the ladder is climbed', () => {
    renderLadder(['r1', 'r2']);

    expectStartable('15 words', 'r3');
    expectLocked('20 words');
  });

  it('unlocks nothing on a stored rung id the deck does not have', () => {
    renderLadder(['r99']);

    expectStartable('5 words', 'r1');
    expectLocked('10 words');
  });

  it('does not claim mastery before the top rung is completed', () => {
    renderLadder(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);

    expect(screen.queryByText('Deck mastered')).not.toBeInTheDocument();
    expectStartable('40 words', 'r8');
  });

  it('shows mastery and still lets any rung be repeated (FR-017, US2 scenario 5)', () => {
    renderLadder(EVERY_RUNG);

    expect(screen.getByText('Deck mastered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /words/ })).not.toBeInTheDocument();
    for (const rung of dolchPreK5.rungs) {
      expectStartable(rung.label, rung.id);
    }
  });

  it('links back to the deck list (FR-034)', () => {
    renderLadder([]);

    expect(screen.getByRole('link', { name: 'All decks' })).toHaveAttribute('href', '/');
  });

  it('shows a plain message and a way home for a deck that does not exist', () => {
    renderLadder([], '/deck/no-such-deck');

    expect(screen.getByRole('heading', { name: 'Deck not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });
});
