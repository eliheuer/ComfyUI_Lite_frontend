---
globs:
  - 'src/components/**/*.vue'
  - 'src/views/**/*.vue'
---

# Design System

The design system lives in code. Source of truth is `src/styles/tokens.css`
(see [`theme-system-design.md`](../../.agents/context/eli/theme-system-design.md)
for the design and rationale).

## Rules for UI code

- Reference semantic tokens, not raw hex. Either `var(--color-*)`
  directly or Tailwind utilities (e.g. `bg-bg`, `text-text-muted`,
  `border-border`) that resolve to the same tokens via Tailwind 4's
  `@theme` directive.
- Never use the `dark:` Tailwind variant — tokens already swap on
  `[data-theme="…"]`.
- Hover / active / disabled states are derived from base tokens via
  `color-mix()` or Tailwind modifier classes (`hover:`, `disabled:`),
  not from separate `*-hover` / `*-active` tokens. We don't ship
  state-suffixed tokens.

## Figma

Figma is allowed as a **consumer** of the design system, not its source.
Designers exploring concepts in Figma treat the tokens as a one-way
export: repo → Figma, never the other way.

A Figma-mirror pipeline (read `tokens.css`, emit Tokens Studio JSON,
import into Figma) isn't built yet. When we build it, it goes one
direction only — anti-drift is the whole point.

## Why one-way

Two-way sync between code and Figma always drifts. Figma's component
model isn't 1:1 with CSS; names diverge; designers add states the code
doesn't have; engineers add tokens the design system doesn't reflect.
Within a month you have two sources of truth and no idea which is right.
