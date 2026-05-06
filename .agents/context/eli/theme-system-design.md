# Theme System — Design

Status: draft. Owner: Eli. Read [`theme-system-research.md`](./theme-system-research.md)
first — it sets the constraints this design honors.

## Goal

Replace the five-layered color system with a single token file, a tiny
runtime, and a thin bridge to LiteGraph and PrimeVue. A new contributor
should be able to read **one file** and understand the entire color system.

## Shape of the solution

```
src/styles/
  tokens.css         # the entire token system
src/composables/
  useColorScheme.ts  # current theme name, persisted
src/services/
  themeBridge.ts     # one file: pushes tokens into LiteGraph + PrimeVue
src/lib/litegraph/
  litegraph.css      # rewritten to use var(--…) tokens
src/components/
  ColorSchemeMenu.vue  # the only theme-related UI
```

That's the whole system.

## Scope decisions (locked in)

These are the answers that shaped the rest of the doc; they're collected
here so they're not buried in subsections.

- **V1 nodes remain the default; V2 is opt-in via the toggle.**
  Attempted to default `Comfy.VueNodes.Enabled` to `true` but it
  broke app mode (layout collapsed, panels empty). App mode's V2 path
  is supposed to delegate selection chrome to `AppInput` / `AppOutput`
  Vue components per the comment at the top of `AppBuilder.vue`, but
  those components either aren't wired or aren't complete. Reverted
  the default. V2 + app-mode integration is its own scoped task,
  separate from the theme rewrite. The LiteGraph bridge keeps setting
  all per-node color constants both modes need.
- **Six themes, no system-follow.** `dark` (default), `light`, `gray`,
  `strawberry` (light-mood, pink-warm), `mint` (light-mood, cool green),
  `campfire` (dark-mood, amber-warm). No `prefers-color-scheme`
  auto-switching — new users get dark; they can pick anything else.
- **No "accent color" abstraction.** Every color the UI uses is just a
  token in `tokens.css`. If the Run button needs to be a particular hue,
  that's `--color-action: …;` with a value per theme. No hover/active/
  disabled variants invented up front; we add those when an actual UI
  need appears.
- **Splash screen: do nothing.** Pre-Vue boot stays as-is; if a user has
  light theme and reloads, they see a brief dark flash. Acceptable cost
  for keeping the lite version actually lite.
- **Storage key:** plain `localStorage['lite-color-scheme']`, plus a
  one-line shim that mirrors writes into the existing
  `Comfy.ColorPalette` settings key so existing E2E tests keep working
  without edits.

## Token model

### One layer, semantic names

No primitive/semantic split. **One layer of names**, all semantic.
Primitives inline as raw hex inside `tokens.css` itself — they're not
exported as `--color-charcoal-700`, they're values that happen to be
reused.

This is the part the existing system gets wrong: the three-layer
palette → semantic → comfy-legacy stack lets contributors pick the
wrong layer to reference, then the wrong layer drifts.

### Naming convention

Two prefixes only:

- `--color-*` — colors (backgrounds, text, borders, focus rings)
- `--space-*` / `--text-*` / `--radius-*` — non-color tokens

Within `--color-*`, name by **role**, not by appearance:

| ✅ Role-named        | ❌ Appearance-named    |
| -------------------- | ---------------------- |
| `--color-bg`         | `--color-charcoal-800` |
| `--color-surface`    | `--color-gray-700`     |
| `--color-text`       | `--color-white`        |
| `--color-text-muted` | `--color-gray-400`     |
| `--color-border`     | `--color-gray-600`     |
| `--color-action`     | `--color-yellow-400`   |
| `--color-danger`     | `--color-red-500`      |

Role names survive the dark↔light flip without renaming. A token called
`--color-charcoal-800` becomes a lie when the light theme sets it to
`#f5f5f5`.

### Themes

Dark is the default (set on `:root`). The five other themes are blocks
keyed by `[data-theme="…"]` on `<html>`:

```css
/* tokens.css — sketch only; final values tuned during step 1 */
:root {
  /* dark — the default */
  --color-bg: #0e0f12;
  --color-surface: #16181d;
  --color-surface-alt: #1d2027;
  --color-text: #e7e9ee;
  --color-text-muted: #8b909b;
  --color-border: #2a2d35;
  --color-action: #f5d800;
  --color-danger: #e35454;
  /* …rest of the ~30-token list… */
}

[data-theme='light'] {
  /* neutral light */
}
[data-theme='gray'] {
  /* mid-neutral grey, eye-saving */
}
[data-theme='strawberry'] {
  /* light, warm pink/red */
}
[data-theme='mint'] {
  /* light, cool mint green */
}
[data-theme='campfire'] {
  /* dark, warm amber/orange */
}
```

Every block defines the same set of tokens. No theme has tokens the
others don't have.

### Tailwind 4 integration

Tailwind 4 reads CSS variables natively via `@theme`:

```css
@theme {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-text: var(--color-text);
  /* … */
}
```

Then `bg-bg`, `text-text-muted`, `border-border` resolve to the right
variable. No second config file, no JS-side translation.

### Token list (target)

Aim for ~30 tokens in v1. Stop adding when we hit 50.

**Surface / text:** bg, surface, surface-alt, text, text-muted, text-disabled, border, border-strong, focus
**State:** action, action-fg, danger, danger-fg, warning, success
**Canvas (V2 nodes are Vue, so these are read by Vue components directly):**
canvas-bg, canvas-grid, node-bg, node-header, node-text, node-border, node-selected, node-error
**Links (datatype socket colors):** link-model, link-image, link-latent, link-conditioning, link-mask, link-string, link-int, link-float, link-bool

## Runtime — `useColorScheme`

```ts
// src/composables/useColorScheme.ts
import { useStorage } from '@vueuse/core'
import { watchEffect } from 'vue'

const STORAGE_KEY = 'lite-color-scheme'
type Theme = 'dark' | 'light' | 'gray' | 'strawberry' | 'mint' | 'campfire'

export function useColorScheme() {
  const theme = useStorage<Theme>(STORAGE_KEY, 'dark')

  watchEffect(() => {
    const root = document.documentElement
    if (theme.value === 'dark') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme.value)
  })

  return { theme }
}
```

That's the whole composable. No store. No service. No imperative
`setProperty` calls.

A separate one-line shim writes through to the legacy
`Comfy.ColorPalette` setting on every change so existing browser tests
keep working without edits. (When the legacy settings store goes away,
the shim goes with it.)

## Bridges

### LiteGraph bridge

LiteGraph renders the canvas background, links, groups, and (in V1
mode) the nodes themselves. The bridge sets the canvas-level colors
plus the per-node constants both modes need.

```ts
// src/services/themeBridge.ts
import { watch } from 'vue'
import { LiteGraph } from '@/lib/litegraph/...'
import { useColorScheme } from '@/composables/useColorScheme'

const readVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function applyToLiteGraph(canvas /* LGraphCanvas */) {
  canvas.clear_background_color = readVar('--color-canvas-bg')
  LiteGraph.LINK_COLOR = readVar('--color-border')
  // Tier 1 compat — keep setting the per-node constants any extension
  // drawing on the canvas might still read.
  LiteGraph.NODE_DEFAULT_BGCOLOR = readVar('--color-node-bg')
  LiteGraph.NODE_TITLE_COLOR = readVar('--color-node-header')
  LiteGraph.NODE_TEXT_COLOR = readVar('--color-node-text')
  LiteGraph.WIDGET_BGCOLOR = readVar('--color-surface-alt')
}

export function installThemeBridge(canvas /* LGraphCanvas */) {
  const { theme } = useColorScheme()
  watch(
    theme,
    () => {
      applyToLiteGraph(canvas)
      canvas.draw(true, true)
    },
    { immediate: true }
  )
}
```

This is the _only_ place LiteGraph's color constants are touched.

### `litegraph.css` rewrite

`src/lib/litegraph/public/css/litegraph.css` currently inlines hex
values for the canvas-side context menu, search box, etc. Rewrite once
to use `var(--color-surface)`, `var(--color-text)`,
`var(--color-border)`. Mechanical edit; the file is ~200 lines.

### PrimeVue bridge

PrimeVue's surface area shrinks per upstream's own direction (#11081,
#11922, #10791) and our AGENTS.md "Avoid new usage of PrimeVue
components." For what remains:

- Keep `definePreset(Aura, …)` in `src/main.ts`, but override it so
  PrimeVue's tokens (`--p-content-background`, `--p-text-color`,
  `--p-surface-*`, `--p-primary-*`) point at our `--color-*` tokens.
- Wire `darkModeSelector: ':root, [data-theme="campfire"]'` (the dark-
  mood themes), drop the `:has()` workaround.
- One file, one preset. If a PrimeVue component looks wrong, fix the
  preset or replace the component — not a per-component override.

## Extensions & compatibility

### Tier 1 — preserve via aliases (cheap, do this)

The "legacy" CSS variables aren't only used by extensions — they're
used by **dozens of our own components**. A `grep` across `src/` shows
heavy use of `--comfy-menu-bg` (12+ files), `--fg-color` (6+ files),
plus `--bg-color`, `--border-color`, `--comfy-input-bg`,
`--comfy-menu-secondary-bg`, `--input-text`. Renaming all of them in
one PR is a giant churn diff with no architectural payoff.

**Plan:** keep every existing CSS-var name as an alias inside
`tokens.css`, in a labeled compat block:

```css
/* tokens.css — legacy aliases.
   Do not use in new code; reference --color-* roles directly.
   Removable in a future major once extension authors have migrated. */
:root {
  --fg-color: var(--color-text);
  --bg-color: var(--color-bg);
  --border-color: var(--color-border);
  --comfy-menu-bg: var(--color-surface);
  --comfy-menu-secondary-bg: var(--color-surface-alt);
  --comfy-input-bg: var(--color-surface-alt);
  --input-text: var(--color-text);
  --tr-odd-bg-color: var(--color-surface);
  --tr-even-bg-color: var(--color-surface-alt);
}
```

~10 lines. Existing components keep working without edits; wild
extensions keep working too. New code references `--color-*` directly.

LiteGraph runtime constants get the same treatment (the bridge keeps
setting them). Internal callers (`groupNode`, `dynamicWidgets`, etc.)
keep working unchanged.

### Tier 2 — break, with a one-page migration note

These removals are the _point_ of the rewrite; preserving them would
preserve the disease.

| Removed surface                                                                                         | Replacement                                                                              |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Pinia colorPaletteStore`                                                                               | none — extensions wanting the active theme read `document.documentElement.dataset.theme` |
| `services/colorPaletteService`                                                                          | none — the bridge runs internally, no public API                                         |
| `colorPaletteSchema` (Zod) and the `node_slot` / `litegraph_base` / `comfy_base` JSON shape             | none — themes are CSS, not JSON                                                          |
| `Comfy.CustomColorPalettes` setting                                                                     | no-op (key tolerated, value ignored)                                                     |
| All palette JSONs (`dark.json`, `light.json`, `arc.json`, `nord.json`, `github.json`, `solarized.json`) | replaced by tokens.css blocks                                                            |
| Custom palette import/export UI                                                                         | removed                                                                                  |

`Comfy.ColorPalette` setting key **stays** but its accepted values
become `'dark' | 'light' | 'gray' | 'strawberry' | 'mint' | 'campfire'`.
Existing values (`'arc'`, `'nord'`, `'github'`, `'solarized'`,
`'obsidian_dark'`, `'light_red'`, custom IDs) silently coerce to
`'dark'` or `'light'` based on whether the original palette had
`light_theme: true`. Existing E2E specs work with no changes; their
saved IDs just resolve to dark/light.

## Files to delete

When the new system lands:

- `src/stores/workspace/colorPaletteStore.ts`
- `src/services/colorPaletteService.ts`
- `src/schemas/colorPaletteSchema.ts`
- `src/constants/coreColorPalettes.ts`
- `src/assets/palettes/*.json` (all six)
- `src/platform/settings/components/ColorPaletteMessage.vue`
- `packages/design-system/src/css/_palette.css`
- `packages/design-system/src/css/style.css` (the ~1900-line one) —
  most of it; salvage genuinely-needed bits (font face declarations,
  Iconify safelist) into smaller files

The replacement is `src/styles/tokens.css` +
`src/composables/useColorScheme.ts` + `src/services/themeBridge.ts` +
`src/components/ColorSchemeMenu.vue`. Net delta: roughly **−3000 lines**.

## Theme menu UI

One component. A small dropdown (or a labeled grid of 6 swatches —
decide during step 2) listing the six themes. Goes in the settings
dialog under "Appearance," replacing `ColorPaletteMessage.vue`.

No accent picker, no font-size scale, no contrast slider. Font-size
scaling and tree padding stay where they are — they're not theme
concerns.

## Plan (in steps, not milestones)

The fork preserves the surface most of our own code and extensions
depend on (Tier 1 aliases) while replacing the architecture
underneath. Single switchover, not a long transition.

**Step 1 — foundation.** Build `tokens.css` (with all 6 theme blocks
filled in _and_ the Tier 1 alias block). Build the `useColorScheme`
composable. Build `themeBridge.ts`. Rewrite `litegraph.css` to use
the new role-named vars. Rewire the PrimeVue Aura preset onto the
new tokens. Old palette code stays alive in parallel — Tier 1 means
nothing breaks visually.

**Step 2 — wire the menu.** Build `ColorSchemeMenu.vue`. Drop
`ColorPaletteMessage.vue` from the settings dialog and replace it.

**Step 3 — delete the old system.** Remove every file in the "Files
to delete" list. Remove the `.dark-theme` class plumbing. Coerce
`Comfy.ColorPalette` legacy values to dark/light. Update browser
tests for the new menu surface.

**Step 4 — polish.** One-page migration note for any extension
author still around. Tune any tokens that look off after a few days
of use.

Step 1 + Step 2 = the minimum visible rewrite. Step 3 is the cleanup
that removes the old code. Step 4 is gravy. **Throughout all four,
the Tier 1 alias block stays in place** — it's a permanent fixture
in `tokens.css` until a future major where we revisit.

## What this design deliberately does not include

- **Custom user themes / theme import-export.** Removed entirely. If
  a user wants a custom theme they edit `tokens.css` (it's CSS, not a
  format).
- **Per-node user-color tinting UI.** The V1 "color this node" feature
  goes away with V1. If V2 wants per-node tinting later, design it
  fresh on top of the new tokens.
- **Per-extension theming hooks.** Extensions read CSS vars directly
  (legacy names preserved as aliases). No public API surface.
- **Animated theme transitions.** Skip.
- **`prefers-color-scheme` auto-follow.** New users get dark. Light is
  one click away.

## Risks

- **LiteGraph repaint cost on theme change.** The bridge calls
  `canvas.draw(true, true)` on every switch. Acceptable for an
  infrequent action.
- **PrimeVue Aura preset surprises.** Aura's internal token graph is
  large; mapping our ~30 tokens may leave gaps where Aura components
  fall back to defaults. Fix on sight during step 1; don't pre-plan.
- **Extensions calling the removed Pinia store / service.** They break
  with clear errors. Document the removal in the step 4 migration
  note. CSS-var-using extensions are unaffected (Tier 1 aliases).
- **`darkModeSelector` for PrimeVue with multiple dark themes.** Our
  dark-mood themes are `:root` (default) and `[data-theme="campfire"]`.
  Need to verify PrimeVue's `darkModeSelector` accepts a comma-
  separated selector. If not, set the attribute differently (e.g.
  `data-mood="dark|light"` separately from `data-theme`).

## Open questions

All previously-listed questions are resolved (see Scope decisions).
New ones that may surface during step 1:

1. **Theme menu shape.** Plain dropdown vs. a 6-swatch grid. Decide
   when building it; both are easy.
2. **Token tuning.** The hex values in this doc are sketches. Real
   values get tuned during step 1 against the actual UI.
