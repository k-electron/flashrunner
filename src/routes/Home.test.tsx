// DISPOSABLE SCAFFOLD CONTENT — deleted by feature 001-deck-runs.
// Proves the jsdom + React Testing Library path. Queries by role and visible
// text only — no class names, no snapshots (Principle IV).
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Home } from '@/routes/Home';

function renderHome() {
  const router = createMemoryRouter([{ path: '/', element: <Home /> }], {
    initialEntries: ['/'],
  });
  render(<RouterProvider router={router} />);
}

describe('Home', () => {
  it('shows the application name as a heading', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'FlashRunner' })).toBeInTheDocument();
  });

  it('offers a link onward to the second route', () => {
    renderHome();
    expect(screen.getByRole('link', { name: 'Go to ping' })).toHaveAttribute('href', '/ping');
  });
});
