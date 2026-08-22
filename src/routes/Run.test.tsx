// Queried by role and visible text only — no class names, no internals, no
// snapshots (Principle IV). The mechanic itself is covered by src/run/reducer.test.ts.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Run } from '@/routes/Run';

// The real registry, because the route resolves through it. Rung r1 of the
// Pre-K ladder is the five words a, I, the, and, to.
const FIRST_RUN = '/deck/dolch-prek-5/rung/r1';

function renderRun(path: string) {
  const router = createMemoryRouter([{ path: '/deck/:deckId/rung/:rungId', element: <Run /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

describe('Run', () => {
  it('shows the first card of the rung', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('offers both outcomes by their accessible names', () => {
    renderRun(FIRST_RUN);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not yet' })).toBeInTheDocument();
  });

  it('shows how many cards are left in the round and counts down as they are marked', async () => {
    const user = renderRun(FIRST_RUN);
    expect(screen.getByText('5 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('4 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.getByText('3 cards left in this round')).toBeInTheDocument();
  });

  it('advances to the next card when the current one is marked', async () => {
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
  });

  it('returns to the first card of the first round when Start over is used', async () => {
    const user = renderRun(FIRST_RUN);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(screen.getByText('3 cards left in this round')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('5 cards left in this round')).toBeInTheDocument();
  });

  it('reports success once every card has been cleared', async () => {
    const user = renderRun(FIRST_RUN);
    for (let card = 0; card < 5; card += 1) {
      await user.click(screen.getByRole('button', { name: 'Got it' }));
    }
    expect(screen.getByText('Run complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
  });

  it('shows a plain message and a way home for a deck or rung that does not exist', () => {
    renderRun('/deck/no-such-deck/rung/r1');
    expect(screen.getByRole('heading', { name: 'Run not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
  });

  it('shows the same message for a rung the deck does not have', () => {
    renderRun('/deck/dolch-prek-5/rung/r99');
    expect(screen.getByRole('heading', { name: 'Run not found' })).toBeInTheDocument();
  });
});
