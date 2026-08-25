// The run screen's two indicators (FR-001). Presentational: no state, no effect,
// no knowledge of the run mechanic — it renders what Run.tsx hands it.
//
// The cycle bar arrives in T007; until then this is the run bar alone.
//
// `value` is a percentage and `max` is NEVER passed
// (specs/006-run-progress-bars/contracts/run-progress.md § 3). The vendored
// component positions the fill with a hardcoded `translateX(-${100 - value}%)`,
// so `value={2} max={5}` renders a bar 2% full while announcing "2 of 5".
//
// The percentage is deliberately not rounded: rounding would let (n-1)/n reach
// 100 for n >= 200 and contradict FR-004. Unrounded, n/n is exactly 1 in
// IEEE-754 for every n, so full happens exactly at completion.
import { Progress } from '@/components/ui/progress';

type Count = { done: number; total: number };

function percent({ done, total }: Count): number {
  return (done / total) * 100;
}

export function RunProgress({ run }: { run: Count }) {
  return (
    // The inner `max-w-xl px-6` mirrors <main>'s own column, so the bars line up
    // with the card's edges at every width (FR-016).
    <div className="fixed inset-x-0 top-0 z-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-1 px-6">
        <Progress
          className="h-1.5"
          value={percent(run)}
          aria-label="Cards got right"
          aria-valuetext={`${run.done} of ${run.total} cards`}
        />
      </div>
    </div>
  );
}
