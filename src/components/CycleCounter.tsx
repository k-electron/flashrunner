// How many cards are still to come in this cycle (FR-013, SC-008). Worded for a
// supervising adult to read at a glance, without needing to know what a cycle is.

export function CycleCounter({ remaining }: { remaining: number }) {
  return (
    <p className="text-muted-foreground text-base">
      {remaining === 1 ? '1 card left in this round' : `${remaining} cards left in this round`}
    </p>
  );
}
