// The two outcomes, in encouraging language rather than pass/fail (FR-027).
// Large targets, side by side, so an adult marking on a learner's behalf and a
// child pressing for themselves are equally well served (FR-025, FR-026).
import { Button } from '@/components/ui/button';
import type { Outcome } from '@/run/types';

export function OutcomeButtons({ onMark }: { onMark: (outcome: Outcome) => void }) {
  return (
    <div className="flex w-full max-w-md gap-4">
      {/* Plain text children, so each accessible name is exactly its visible text. */}
      <Button className="h-16 flex-1 text-xl" size="lg" onClick={() => onMark('got-it')}>
        Got it
      </Button>
      <Button
        className="h-16 flex-1 text-xl"
        size="lg"
        variant="secondary"
        onClick={() => onMark('not-yet')}
      >
        Not yet
      </Button>
    </div>
  );
}
