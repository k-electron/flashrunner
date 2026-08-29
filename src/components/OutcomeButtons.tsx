// The two outcomes, in encouraging language rather than pass/fail (FR-027).
// Large targets, side by side, so an adult marking on a learner's behalf and a
// child pressing for themselves are equally well served (FR-025, FR-026).
// Each button stacks a large icon above smaller wording, so a learner who cannot
// yet read the words can still tell them apart (FR-001, FR-002, FR-004).
import { CircleCheck, CircleQuestionMark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Outcome } from '@/run/types';

export function OutcomeButtons({
  onMark,
  heard,
}: {
  onMark: (outcome: Outcome) => void;
  heard: boolean;
}) {
  return (
    <div className="flex w-full max-w-md gap-4">
      {/* Plain text children, so each accessible name is exactly its visible text.
          Each icon carries its own size-* because the base Button class forces an
          unsized descendant svg to size-4. */}
      {/* The green is *removed* in the heard state rather than overridden: `Button`
          composes `cn(buttonVariants({ variant, size, className }))`, so a
          className beats its variant, and leaving the green on would emphasise
          nothing. Only the fill moves — nothing here is disabled, because this is
          a hint to the eye rather than a restriction. */}
      <Button
        className={cn(
          'h-24 flex-1 flex-col gap-1 text-xl',
          !heard && 'bg-green-800 text-white hover:bg-green-900',
        )}
        variant={heard ? 'secondary' : 'default'}
        onClick={() => onMark('got-it')}
      >
        <CircleCheck className="size-12" aria-hidden="true" />
        Got it
      </Button>
      <Button
        className="h-24 flex-1 flex-col gap-1 text-xl"
        variant={heard ? 'default' : 'secondary'}
        onClick={() => onMark('not-yet')}
      >
        <CircleQuestionMark className="size-12" aria-hidden="true" />
        Not yet
      </Button>
    </div>
  );
}
