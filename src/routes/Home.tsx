// DISPOSABLE SCAFFOLD CONTENT — deleted by feature 001-deck-runs.
// Exists only to prove routing, styling, and the test harness work end to end.
// Nothing outside src/routes/ and src/demo/ references this file by name.
import { Link } from 'react-router';

export function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">FlashRunner</h1>
      <p className="text-muted-foreground text-sm">Scaffold is running.</p>
      <Link className="text-primary text-sm underline underline-offset-4" to="/ping">
        Go to ping
      </Link>
    </main>
  );
}
