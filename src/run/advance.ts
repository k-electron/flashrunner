// The whole tuning surface for the card transition (FR-007). Change the numbers
// here and nothing else: the unpressable window after a mark is CARD_EXIT_MS +
// CARD_ENTRY_MS, derived at every use site, so no third number exists to
// disagree with the animation (FR-006).
//
// This file names Tailwind classes, which the rest of src/run/ deliberately does
// not. Splitting the numbers from the classes would put the tuning surface in
// two directories and break FR-007's "one place" to preserve a convention.
//
// The two fade percentages MUST stay equal. The exit ends at 40% opacity and the
// entry starts there, which is what makes the dim one continuous gesture rather
// than two adjacent ones (FR-005b). Change one, change the other.
//
// `fill-mode-forwards` is not a tuning knob: without it the outgoing card snaps
// back to full opacity for a frame before it unmounts.
export const CARD_EXIT_MS = 140;
export const CARD_ENTRY_MS = 180;

export const CARD_EXIT_CLASSES =
  'animate-out fade-out-40 slide-out-to-top-2 ease-in fill-mode-forwards duration-(--card-exit)';
export const CARD_ENTRY_CLASSES =
  'animate-in fade-in-40 slide-in-from-bottom-2 ease-out duration-(--card-entry)';
