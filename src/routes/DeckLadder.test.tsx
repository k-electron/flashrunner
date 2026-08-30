// Queried by role and visible text only — no class names, no internals, no
// snapshots (Principle IV). The unlocking rule itself is covered as plain
// function calls in src/decks/ladder.test.ts.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { dolchK5 } from '@/decks/dolch-k-5';
import { dolchPreK5 } from '@/decks/dolch-prek-5';
import type { DeckConfig } from '@/decks/types';
import { DeckLadder } from '@/routes/DeckLadder';
import { readDeckRecord, type PersistedRun } from '@/storage/deckRecord';
import { deckKey } from '@/storage/keys';
import { writeItem } from '@/storage/safeStorage';

// The real registry, because the route resolves through it. The Pre-K ladder is
// r1–r8, labelled "Level 1" through "Full deck".
const DECK_PATH = `/deck/${dolchPreK5.id}`;
const EVERY_RUNG = dolchPreK5.rungs.map((rung) => rung.id);

// Halfway through Pre-K's second rung: two words cleared, one still to come back.
const PRE_K_RUN: PersistedRun = {
  rungId: 'r2',
  cycleIndex: 0,
  queue: ['a', 'i', 'the', 'and', 'to', 'is', 'it', 'in', 'up', 'me'],
  position: 3,
  failedThisCycle: ['i'],
  passedThisRun: ['a', 'the'],
};

// A different deck, a different rung, its own position (FR-036).
const K_RUN: PersistedRun = {
  rungId: 'r1',
  cycleIndex: 0,
  queue: ['am', 'at', 'on', 'so', 'no'],
  position: 2,
  failedThisCycle: [],
  passedThisRun: ['am', 'at'],
};

/**
 * Seeds one deck's stored progress.
 *
 * The seed is what makes each test's starting state known: under Node 26
 * `globalThis.localStorage` reads back undefined, so safeStorage keeps one
 * module-level in-memory map that would otherwise carry the previous test's
 * writes into this one.
 */
function seedDeck(deck: DeckConfig, completedRungIds: string[], run?: PersistedRun): void {
  writeItem(deckKey(deck.id), JSON.stringify({ schemaVersion: 1, completedRungIds, run }));
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/deck/:deckId', element: <DeckLadder /> },
      // A stand-in, so following Resume or Start over is observable here without
      // pulling the run screen into this file.
      { path: '/deck/:deckId/rung/:rungId', element: <p>Run screen</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

/** Seeds the Pre-K deck's stored progress, then renders the ladder over it. */
function renderLadder(
  completedRungIds: string[],
  { run, path = DECK_PATH }: { run?: PersistedRun; path?: string } = {},
) {
  seedDeck(dolchPreK5, completedRungIds, run);
  return renderAt(path);
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

    expectStartable('Level 1', 'r1');
    expectLocked('Level 2');
    expectLocked('Level 3');
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('marks a completed rung and keeps it startable (FR-016)', () => {
    renderLadder(['r1']);

    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expectStartable('Level 1', 'r1');
  });

  it('opens the rung above a completed one and no further (FR-015, US2 scenario 4)', () => {
    // The case that separates "immediate predecessor completed" from "above the
    // highest completed rung": the latter would lock the rung just unlocked and
    // leave the deck unfinishable.
    renderLadder(['r1']);

    expectStartable('Level 2', 'r2');
    expectLocked('Level 3');
    expectLocked('Level 4');
  });

  it('opens each next rung in turn as the ladder is climbed', () => {
    renderLadder(['r1', 'r2']);

    expectStartable('Level 3', 'r3');
    expectLocked('Level 4');
  });

  it('unlocks nothing on a stored rung id the deck does not have', () => {
    renderLadder(['r99']);

    expectStartable('Level 1', 'r1');
    expectLocked('Level 2');
  });

  it('does not claim mastery before the top rung is completed', () => {
    renderLadder(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);

    expect(screen.queryByText('Deck mastered')).not.toBeInTheDocument();
    expectStartable('Full deck', 'r8');
  });

  it('shows mastery and still lets any rung be repeated (FR-017, US2 scenario 5)', () => {
    renderLadder(EVERY_RUNG);

    expect(screen.getByText('Deck mastered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Level|Full deck/ })).not.toBeInTheDocument();
    for (const rung of dolchPreK5.rungs) {
      expectStartable(rung.label, rung.id);
    }
  });

  // dolch-k-5's r10 rung was deleted so the deck does not end on a two-card
  // part-step (FR-020). These two are the only automated proof that the deletion
  // costs a learner who climbed the old ladder nothing (FR-021).
  it('leaves a learner who completed the deleted rung one level from the top (FR-021)', () => {
    seedDeck(dolchK5, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10']);
    renderAt(`/deck/${dolchK5.id}`);

    expect(screen.getByRole('link', { name: 'Full deck' })).toHaveAttribute(
      'href',
      `/deck/${dolchK5.id}/rung/r11`,
    );
  });

  it('keeps a deck mastered before the collapse mastered after it (FR-021)', () => {
    seedDeck(dolchK5, ['r11']);
    renderAt(`/deck/${dolchK5.id}`);

    expect(screen.getByText('Deck mastered')).toBeInTheDocument();
  });

  it('links back to the deck list (FR-034)', () => {
    renderLadder([]);

    expect(screen.getByRole('link', { name: 'All decks' })).toHaveAttribute('href', '/');
  });

  it('shows a plain message and a way home for a deck that does not exist', () => {
    renderLadder([], { path: '/deck/no-such-deck' });

    expect(screen.getByRole('heading', { name: 'Deck not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });
});

describe('DeckLadder — an unfinished run', () => {
  it('offers nothing to resume when there is no unfinished run', () => {
    renderLadder(['r1']);

    expect(screen.queryByText('Unfinished run')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument();
  });

  it('surfaces it on its own rung, with Resume and Start over together (FR-031, FR-035)', () => {
    renderLadder(['r1'], { run: PRE_K_RUN });

    // One rung carries it, and both ways out of it are on screen at once —
    // neither is behind the other.
    expect(screen.getAllByText('Unfinished run')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'href',
      `${DECK_PATH}/rung/r2`,
    );
    expect(screen.getByRole('button', { name: 'Start over' })).toBeEnabled();
  });

  // Counting the block and reading its href says nothing about *where* it sits:
  // pinning it to the first rung regardless of which rung the run belongs to
  // leaves both of those assertions green. FR-035 is about the rung it is on, so
  // that is what this asserts — the rung is found by the label a learner reads.
  it('puts Resume and Start over on the rung the run belongs to (FR-031, FR-035)', () => {
    renderLadder(['r1'], { run: PRE_K_RUN });

    // PRE_K_RUN is on r2, which the ladder labels "Level 2".
    const rung = screen
      .getAllByRole('listitem')
      .find((item) => within(item).queryByText('Level 2') !== null);
    expect(rung).toBeDefined();

    const owner = within(rung as HTMLElement);
    expect(owner.getByText('Unfinished run')).toBeInTheDocument();
    expect(owner.getByRole('link', { name: 'Resume' })).toBeInTheDocument();
    expect(owner.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
  });

  it('goes to a fresh run of the same rung when Start over is used', async () => {
    const user = renderLadder(['r1'], { run: PRE_K_RUN });
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.getByText('Run screen')).toBeInTheDocument();
    expect(readDeckRecord(dolchPreK5).run).toBeUndefined();
  });

  it('leaves completed rungs and the rung unlocked when Start over is used (FR-032, SC-015)', async () => {
    const user = renderLadder(['r1'], { run: PRE_K_RUN });
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    cleanup();

    // Read back from storage, without reseeding: the ladder is exactly as it was
    // apart from having nothing left to resume.
    renderAt(DECK_PATH);
    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Level 2' })).toHaveAttribute(
      'href',
      `${DECK_PATH}/rung/r2`,
    );
    expect(screen.queryByText('Unfinished run')).not.toBeInTheDocument();
  });

  it('keeps each deck to its own run across a switch (FR-036, SC-013)', async () => {
    seedDeck(dolchK5, [], K_RUN);
    renderLadder(['r1'], { run: PRE_K_RUN });

    expect(screen.getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'href',
      `${DECK_PATH}/rung/r2`,
    );
    cleanup();

    // The other deck is on its own rung, at its own position.
    const user = renderAt(`/deck/${dolchK5.id}`);
    expect(screen.getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'href',
      `/deck/${dolchK5.id}/rung/r1`,
    );

    // And starting that one over disturbs nothing of the first deck's.
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(readDeckRecord(dolchK5).run).toBeUndefined();
    expect(readDeckRecord(dolchPreK5).run).toEqual(PRE_K_RUN);
  });
});
