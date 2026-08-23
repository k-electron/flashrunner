// A sight-word card has one visible face and nothing to reveal (FR-023). This
// component takes only the front, so a two-sided deck cannot leak into the run
// loop by accident — the mechanic never inspects card content.

export function CardFace({ front }: { front: string }) {
  return (
    <p className="text-center text-7xl leading-none font-semibold tracking-tight sm:text-8xl">
      {front}
    </p>
  );
}
