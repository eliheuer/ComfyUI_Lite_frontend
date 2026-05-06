# Theme System — Research

Status: draft. Owner: Eli. Companion to [`theme-system-design.md`](./theme-system-design.md)
and [`figma-removal-todo.md`](./figma-removal-todo.md).

## Why this exists

This fork (`ComfyUI_Lite_frontend`) is an opinionated, design-engineer-focused
trim of upstream `Comfy-Org/ComfyUI_frontend`. The theme system inherited from
upstream is the single biggest source of incidental complexity in the chrome:
five overlapping color-setting pathways, a JSON palette schema with unused
fields, a runtime palette service that pushes constants into the canvas
library, a Figma file as the declared "single source of truth," and a doc tree
that points contributors at all of it.

The lite fork is small enough to **rewrite, not refactor**. This document
captures what's there now and what to delete; the design doc proposes the
replacement.

## Current state — what we found

Full file-by-file inventory lives in the design doc; the headlines:

### Five competing color-setting pathways

1. **PrimeVue Aura preset** — `--p-surface-*`, `--p-text-color`, etc. set by
   PrimeVue at runtime from a `definePreset(Aura, ...)` call in `src/main.ts`.
2. **Design-system semantic tokens** — `--color-layout-cell`,
   `--color-layout-text`, etc. in `packages/design-system/src/css/style.css`
   (~1900 lines), partly *derived from* PrimeVue's variables.
3. **Comfy legacy CSS variables** — `--fg-color`, `--bg-color`,
   `--comfy-menu-bg` set imperatively on `documentElement.style` by
   `colorPaletteService.loadComfyColorPalette()`.
4. **LiteGraph runtime constants** — `LiteGraph.NODE_TITLE_COLOR`,
   `LGraphCanvas.link_type_colors`, etc. assigned imperatively.
5. **Hardcoded litegraph CSS** — `src/lib/litegraph/public/css/litegraph.css`
   inlines hex/rgb values for context menu, menu bar, search box; only two
   lines reference CSS variables.

A token can be set by any combination of 1–4, with 5 as a silent overrider.
Changing a color often means hunting through three of them. Upstream sees this
too: **issue [#11048](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11048)
"4 layered color systems create fragile overrides"** is *open*.

### A JSON palette schema with unused branches

`src/schemas/colorPaletteSchema.ts` defines three nested categories — `node_slot`,
`litegraph_base`, `comfy_base`. Six core palettes ship as JSON
(`src/assets/palettes/{dark,light,solarized,arc,nord,github}.json`) plus user-
created ones. Several keys in `litegraph_base` (`NODE_SELECTED_TITLE_COLOR`,
`NODE_TEXT_HIGHLIGHT_COLOR`, `WIDGET_OUTLINE_COLOR`, …) are defined and
validated but never wired into the runtime. The custom-palette import/export
flow exists to support a feature (user-portable themes) that, in the lite
fork's product framing, is YAGNI.

### No real light/dark toggle

There is no dedicated dark/light switch. Light/dark is a side effect of which
*palette* you select — the "light" palette has `light_theme: true`, which then
toggles `.dark-theme` on `<body>` via a `watch()` in `GraphView.vue`. PrimeVue's
dark selector is wired to `.dark-theme, :root:has(.dark-theme)` as a workaround
for [primefaces/primevue#5515](https://github.com/primefaces/primevue/issues/5515).
The system has no concept of `prefers-color-scheme`.

### Figma as the declared source of truth

`AGENTS.md` lines 185–187 and 236, plus `docs/guidance/design-standards.md` (66
lines), instruct contributors and agents to fetch design tokens **live from a
Figma file** via the Figma MCP before implementing UI. For a fork whose stated
purpose is "design-in-code," this is exactly backwards — the source of truth
should be a CSS file in the repo. See `figma-removal-todo.md` for the rip-out
list.

## Upstream pain points

Selected issues from `Comfy-Org/ComfyUI_frontend` that ground the rewrite in
real user/contributor friction (not imagined problems):

### Architectural — the layered system itself is the bug

- **[#11048](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11048)** —
  "4 layered color systems create fragile overrides." *Open.* Same diagnosis
  as ours; upstream knows but hasn't been able to unwind it.
- **[#11031](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11031)** —
  "Four competing dialog/confirmation systems." *Closed.* Same disease pattern
  in a different surface — multi-layer drift is a structural risk, not a one-off.
- **[#8024](https://github.com/Comfy-Org/ComfyUI_frontend/issues/8024)** —
  "Refactor: Consolidate node color picker implementations." *Open.* Multiple
  color-picker UIs because no single owner of color state.

### Migration away from PrimeVue is already underway upstream

- **[#11081](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11081)** —
  TreeExplorer V1→V2 (PrimeVue → Reka UI). *Open.*
- **[#11922](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11922)** /
  **[#11923](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11923)** —
  migrate Tag off PrimeVue. *Open.*
- **[#10791](https://github.com/Comfy-Org/ComfyUI_frontend/issues/10791)** —
  migrate Load3d slider controls off PrimeVue. *Open.*

This fork can leapfrog: cut PrimeVue surface area aggressively, build on Reka
UI + Tailwind 4 from day one. AGENTS.md already says "Avoid new usage of
PrimeVue components" — make that "no PrimeVue in new code, period."

### Light mode is a long-running sore spot

- **[#5044](https://github.com/Comfy-Org/ComfyUI_frontend/issues/5044)** —
  dark/light switch intermittently fails. *Open.*
- **[#5557](https://github.com/Comfy-Org/ComfyUI_frontend/issues/5557)** —
  light theme breaks node color editing. *Closed.*
- **[#6573](https://github.com/Comfy-Org/ComfyUI_frontend/issues/6573)** —
  Milk White theme: text invisible. *Closed.*
- **[#9806](https://github.com/Comfy-Org/ComfyUI_frontend/issues/9806)** —
  chart colors don't react to theme changes. *Open.*

A theme system where light mode is a tested, equal-status branch (not a "we
mostly do dark, light kinda works") fixes the whole class.

### Accessibility / contrast

- **[#10288](https://github.com/Comfy-Org/ComfyUI_frontend/issues/10288)** —
  accessibility regressions: splash flash, motion, low-contrast UI, settings
  readability. *Open.*
- **[#5531](https://github.com/Comfy-Org/ComfyUI_frontend/issues/5531)** —
  request for medium-grey / eye-saving theme. *Open.*
- **[#5558](https://github.com/Comfy-Org/ComfyUI_frontend/issues/5558)** —
  disable zoom brightness variation. *Open.*

A small, opinionated set of well-tuned themes (dark / light / high-contrast)
beats an unbounded custom-palette feature where any user can produce an
unreadable theme.

### Loud one-off complaints worth keeping in mind

- **[#8371](https://github.com/Comfy-Org/ComfyUI_frontend/issues/8371)** —
  "This yellow bar is burning my retina." Brand colors used as UI affordances
  bleed.
- **[#11874](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11874)** —
  color menu only previews `bgcolor`, not title color. Half-finished features
  on top of the layered system.

## Principles for the rewrite

These are the constraints the design doc has to honor.

1. **One file owns color tokens.** `src/styles/tokens.css`. Every other CSS
   reference is `var(--…)`. No imperative `documentElement.style.setProperty`
   in service code, no JSON palettes loaded at runtime, no per-component
   theme overrides outside the token file.

2. **Light and dark are first-class siblings.** Same token names in both;
   selection via a single attribute (`[data-theme="light"|"dark"]`) on
   `<html>`, defaulting to `prefers-color-scheme`. No `light_theme: true`
   booleans tucked inside palette payloads.

3. **In-code source of truth, no Figma round-trip.** Designers (i.e. me) edit
   the CSS file. The repo *is* the design system. Figma can be a sketchpad,
   not a source of truth referenced by automation.

4. **Drop user-created palettes for v1.** No import/export, no custom palette
   store, no UI for adding new themes. Ship 2–3 well-tested themes (dark,
   light, maybe a high-contrast). If someone wants a fourth, they fork
   `tokens.css`. This collapses a large amount of code.

5. **Bridge to LiteGraph and PrimeVue, don't merge with them.** A single
   small adapter pushes the relevant tokens into LiteGraph runtime
   constants and PrimeVue's CSS variables when the theme changes. Both
   bridges live in *one* file each so the seam is visible.

6. **Litegraph CSS becomes token-driven.** No more hardcoded hex in
   `litegraph.css`. Either rewrite the file in this fork, or ship a small
   override stylesheet loaded after it.

7. **Tailwind 4 is the renderer, not a parallel system.** Use Tailwind 4's
   CSS-first `@theme` directive so `bg-canvas`, `text-muted` etc. resolve
   to the same `var(--…)` defined in `tokens.css`. No second layer of
   Tailwind config translating semantic-name-A to semantic-name-B.

8. **No new abstractions until two real users force them.** AHA / YAGNI.
   The current system is what you get when you build for hypothetical
   users who never showed up.

## What this fork does NOT need to do

- **Solve theming for the cloud product.** Cloud-platform-specific surfaces
  (`src/platform/cloud/...`) can reuse the same tokens but their bespoke
  styling needs aren't a constraint on the core design.
- **Maintain backwards-compatible palette JSON.** This is a fork; we can
  break the palette schema. Existing user palettes don't need to load.
- **Match upstream visually.** The point of the fork is to demonstrate a
  better design. Diverging from upstream's exact look is fine and probably
  desirable.

## Decisions (resolved — see design doc for the full picture)

- **Theme set:** dark (default), light, gray, strawberry, mint, campfire.
  All upstream palettes (github, arc, nord, solarized) are dropped.
- **Storage:** `localStorage['lite-color-scheme']` + a one-line shim
  that mirrors writes into the legacy `Comfy.ColorPalette` settings
  key so existing E2E tests work unchanged.
- **No `prefers-color-scheme` auto-follow.** New users get dark; light
  is one click away. Keeps the runtime tiny.
- **No accent abstraction.** Every color is just a token in
  `tokens.css`; if the Run button needs a specific hue, that's a token
  with a value per theme. No hover/active/disabled variants invented up
  front.
- **Splash screen: do nothing.** Accept the brief flash on light-theme
  reloads. Eli's call: "the point of this is to make a lite version
  that is clean."
- **V1 nodes are dropped from the fork.** This shrinks the LiteGraph
  bridge (no per-node color constants needed for our own use; we still
  set them as Tier 1 compat) and lets the six color picker components
  per upstream #8024 be deleted along with V1.

## Appendix — deeper upstream evidence

Added after a `gh`-authenticated pass on the same issues. Recording the
substance, not just titles, so we can cite specifics in PR descriptions
and design reviews.

### #11048 in full — what upstream actually says

The body of [#11048](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11048)
was filed by `audit-code`, an automated repo-audit skill run by Christian
Byrne (upstream lead). It enumerates four overlapping color systems in the
same order our inventory found them — design-system CSS variables, PrimeVue
Aura preset, `colorPaletteStore`/`colorPaletteService`, and litegraph CSS —
and gives a one-paragraph diagnosis worth quoting verbatim:

> The color palette service dynamically overrides CSS variables set by the
> design system, which can be fragile. As PrimeVue is migrated away, one
> layer will eventually be removed. Consider having the palette system
> generate Tailwind-compatible tokens directly.

Two things to take from this:

1. **Upstream's planned fix is half a step** — keep the palette JSON
   system, but route it into Tailwind tokens instead of imperatively
   overriding CSS vars. That removes one *symptom* (drift between layers)
   without removing the *cause* (multiple sources of truth for color).
   The lite fork can go further: delete the palette system entirely and
   *be* the Tailwind-compatible tokens.
2. **The audit is filed as MEDIUM confidence and "nice-to-have"** — even
   the team that filed it isn't fully confident. The issue body doesn't
   actually name extension breakage as the blocker; that was a guess on
   my part. The honest read is that refactor-in-place across a large,
   continuously-shipping app is structurally expensive — particularly
   with PrimeVue still being unwound (#11081, #11922, #10791) so the
   target shape isn't stable. A fork starting clean can pick the target
   shape without that constraint.

   On extension compatibility specifically: AGENTS.md's hard rule about
   "Extension ecosystem impact" applies to entity callbacks
   (`onConnectionsChange`, `node.widgets`, etc.), not to CSS variable
   names. The design doc's "Extensions & compatibility" section walks
   through what to preserve via aliases (cheap) vs. what to break with
   a migration note (intentional, scoped).

#11048 is "Part of #11022" — the umbrella audit. Worth pulling
[#11022](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11022) into
the research if we want a fuller picture of upstream's self-assessed
structural debt.

### #11081 — the PrimeVue migration pattern

[#11081](https://github.com/Comfy-Org/ComfyUI_frontend/issues/11081)
("Complete TreeExplorer V1→V2 migration (PrimeVue → Reka UI)") confirms
the **V1/V2 coexistence pattern**: the new Reka-UI-based component is
built alongside the PrimeVue one, both are used in different parts of the
UI, and migration happens consumer-by-consumer. Status: open, priority
`nice-to-have`, effort `medium`. Translation: it'll drag indefinitely.

For the lite fork the implication is the same as for color systems:
**don't carry V1+V2 of anything.** When we replace a PrimeVue component,
delete the PrimeVue dependency for that component the same day. No
parallel implementations.

### #8024 — six color picker implementations

[#8024](https://github.com/Comfy-Org/ComfyUI_frontend/issues/8024)
catalogs **six** node-color-picker components, each duplicating the same
`colorOptions` generation logic from `LGraphCanvas.node_colors`:

- `SetNodeColor.vue` (right side panel)
- `ColorPickerButton.vue` (selection toolbox)
- `useNodeCustomization.ts` (composable)
- `FormColorPicker.vue`
- `ColorCustomizationSelector.vue`
- `WidgetColorPicker.vue`

The duplicated logic is ~100 lines per implementation. This is the same
disease as #11048 in a smaller surface — no single owner of color state,
so each consumer rolls its own. The lite fork should ship at most one
node-color-picker.

### Whack-a-mole evidence in merged PRs

A recent-year sample of merged PRs touching color tokens, in roughly
chronological order:

| PR | Title | What it shows |
|----|-------|---------------|
| [#5529](https://github.com/Comfy-Org/ComfyUI_frontend/pull/5529) | Fix Vue slot label colors for light theme | Light theme regression — light ≠ first-class. |
| [#6363](https://github.com/Comfy-Org/ComfyUI_frontend/pull/6363) | Css token standardization | Standardization pass — they've been trying. |
| [#6569](https://github.com/Comfy-Org/ComfyUI_frontend/pull/6569) | Updated node tokens | Continuing churn on canvas token names. |
| [#6589](https://github.com/Comfy-Org/ComfyUI_frontend/pull/6589) / [#6714](https://github.com/Comfy-Org/ComfyUI_frontend/pull/6714) | minimap and canvas bg to use menu color tokens | Required a backport — production color drift. |
| [#7366](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7366) / [#7368](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7368) | fix: hardcoded color tokens (not theme-aware) | Hardcoded values keep getting committed; required a backport. |
| [#7908](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7908) | fix: replace text-white with theme-aware color tokens | Same disease, different surface. |
| [#10374](https://github.com/Comfy-Org/ComfyUI_frontend/pull/10374) | consolidate `--color-coral-red` into `--color-coral` | Naming drift — two tokens for the same color. |
| [#11139](https://github.com/Comfy-Org/ComfyUI_frontend/pull/11139) | add plum/ink color primitives and standardize design tokens | They keep *adding* primitives, which expands the layered tower rather than collapsing it. |

The pattern: a steady stream of fix-PRs over ~12 months for "hardcoded
color," "not theme-aware," "color X doesn't work in light theme,"
"consolidate two near-duplicate tokens." Each fix is small; together
they're the bulk of the design-system work happening upstream. None of
them would be needed if there were one source of truth in one file.

### Quantitative signal

- **Upstream open issues with `area:design-system` label**: 0 (the label
  exists but isn't being used to index issues — the work is filed under
  `area:ui` and `audit:conflicting` instead).
- **Open audit issues from the `code-audit` skill**: at least #11048,
  #11081, and others in the #11022 umbrella — upstream has an automated
  audit calling out the layered-systems pattern as a class.
- **Merged PRs in the search above**: ~15 in a single search, all small
  fixes. The aggregate work-hours equal at least one rewrite effort,
  spread over many small actions.

### Strongest evidence for "rewrite vs refactor"

If asked to defend the rewrite in a PR description, three citations
suffice:

1. **#11048 itself** — upstream's own audit identifies the layered
   system as the problem. We aren't inventing a critique.
2. **The fix-PR cadence** (~15 PRs/year just to keep tokens consistent)
   is the cost of *not* rewriting. A fork pays it once.
3. **#11081 + V1/V2 coexistence + #8024's six-picker duplication** — the
   layered-systems disease metastasizes when not addressed at the root.
   Upstream is shipping V2s without removing V1s; we should not inherit
   that pattern.

## References

- Upstream repo: <https://github.com/Comfy-Org/ComfyUI_frontend>
- Tailwind 4 `@theme` directive:
  <https://tailwindcss.com/docs/theme>
- Reka UI (the library upstream is migrating toward): <https://reka-ui.com/>
- This fork's existing planning docs: `.agents/context/svg-editor.md`,
  `.agents/context/vectorizer-node.md`
