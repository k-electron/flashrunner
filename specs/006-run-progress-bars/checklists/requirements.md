# Specification Quality Checklist: Run Progress Bars

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Passed on the first iteration. Nine design decisions were settled with the maintainer in
conversation before the spec was written, which is why no [NEEDS CLARIFICATION] marker survives:
visual form (two stacked continuous bars), placement (fixed to the viewport top, capped and centred
to the content column), the cycle bar's denominator (cycle-relative, constant track width),
labelling (graphical only, assistive text carrying card counts), differentiation (thickness, not
colour), the cycle reset (allowed to animate backwards), and missed cards (no third visual state).

**Amended after planning, 2026-08-25.** FR-021 originally required both bars to stop animating when
the device asks for reduced motion. Honouring it turned out to need an edit to a vendored component,
because the transition sits on an element no prop reaches. Put to the maintainer with the trade-off,
that was declined: the motion in question is a 12px bar sliding for 150ms, and the divergence from
upstream costs more than it buys. FR-021 now requires no reduced-motion behaviour, the matching edge
case says so explicitly, and an Assumptions entry records the reasoning so it reads as a decision
rather than a gap. The checklist still passes — the requirement is testable and the scope is bounded;
only what it requires changed. Full reasoning in [research.md § Decision 5](../research.md).

Two things were deliberately kept out of `spec.md` and belong to `/speckit-plan`:

1. **The component's shape.** The library's progress component ships with no variant prop and its
   `className` reaches only the outer track, so the two bars are differentiated by height — which
   the class merger overrides cleanly — rather than by fill colour, which it cannot reach. FR-013
   states the requirement (distinguishable without colour); the mechanism is a planning concern.
2. **The percentage-versus-count split.** The shipped indicator positions itself from a 0–100 value,
   so the announced figure has to be supplied separately from the value that drives the fill.
   FR-024 states what must be announced; how the two are kept in step is a planning concern.

One assumption is worth re-reading before planning, because it is a judgement call rather than a
derivation from the request: both indicators stay on the run-complete screen with the run bar full
(FR-020). The request says nothing about the screen after the last card.
