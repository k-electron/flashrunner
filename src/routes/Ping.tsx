// DISPOSABLE SCAFFOLD CONTENT — deleted by feature 001-deck-runs.
// Second route exists so navigation and direct addressing are observable.
import { Link } from 'react-router';

export function Ping() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">pong</h1>
      <p className="text-muted-foreground text-sm">
        Reaching this by pasting the URL proves deep links resolve.
      </p>
      <Link className="text-primary text-sm underline underline-offset-4" to="/">
        Back home
      </Link>
    </main>
  );
}
