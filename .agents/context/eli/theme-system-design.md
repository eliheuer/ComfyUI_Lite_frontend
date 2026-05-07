# Theme System / Visual Redesign — Design

Status: draft. Owner: Eli. Read [`theme-system-research.md`](./theme-system-research.md)
first — it sets the constraints this design honors.

## Goal

A total visual redesign of the application that unifies it under a
coherent design language ("Lite" — Eli's taste). Replaces upstream's
five-layered color system with a **single token file** plus a **layered
override architecture** that keeps upstream sync conflict-cheap. A new
contributor reading one file (`tokens.css`) should understand the entire
visual system.

This is bigger than "swap colors": fonts, spacing rhythm, corner
roundness, shadow language, motion, and component visual identity all
shift to match. **Upstream owns behavior; we own appearance.**

## Layered architecture (the discipline that makes redesign possible)

Defense in depth — five layers, each handling a different category of
visual change. The first three are zero-conflict with upstream. The
fourth is per-component cost. The fifth is what we explicitly avoid.

| Layer                                                                                          | Covers                                                               | Conflict surface                                                            |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **1. Tokens** (`src/styles/tokens.css` + Tailwind 4 `@theme`)                                  | Colors, spacing scale, typography, radii, shadows, motion            | **Zero** — single new file                                                  |
| **2. Stylesheet overrides** (`src/styles/lite-overrides.css`)                                  | Selector-reachable tweaks, PrimeVue layer, LiteGraph canvas          | **Near-zero** — only conflicts if upstream renames a CSS class we override  |
| **3. PrimeVue preset rewrite** (`src/styles/litePreset.ts`)                                    | Buttons, dialogs, dropdowns, menus, inputs — all PrimeVue components | **Zero** — preset definition, not a component edit                          |
| **4. Component shadowing** (Vite alias `@/lite/components/*` resolved before `@/components/*`) | Components whose _structure_ must differ                             | **Per-shadow** — re-port if upstream rewrites that component                |
| **5. Direct in-file edits**                                                                    | Things only inline edits can express                                 | **One conflict per edit per sync** — used sparingly, treated as last resort |

**Discipline rule**: ~95% of the redesign happens in layers 1–3, ~5% in
layer 4, ~zero in layer 5. If you find yourself wanting to edit
`src/components/foo.vue` directly to change how it looks, stop and
check: can a token, an override, or a shadow do the job instead?

If the discipline holds, daily upstream sync is conflict-free; weekly
sync has at most a couple of trivial CSS conflicts.

## Shape of the solution

```
src/styles/
  tokens.css           # the entire token system: colors, type, space, radii, shadows
  lite-overrides.css   # selector-level overrides (PrimeVue, LiteGraph, scrollbars)
  litePreset.ts        # PrimeVue preset wired to our tokens
src/composables/
  useColorScheme.ts    # current theme name, persisted
src/services/
  themeBridge.ts       # pushes tokens into LiteGraph constants
src/lib/litegraph/
  litegraph.css        # rewritten to use var(--…) tokens
src/lite/
  components/          # shadowed Vue components (added per need, not up front)
src/components/
  ColorSchemeMenu.vue  # the only theme-related UI
vite.config.mts
  + alias: '@/lite/components' → 'src/lite/components' resolved first
```

That's the whole system.

## Scope decisions (locked in)

These are the answers that shaped the rest of the doc; they're collected
here so they're not buried in subsections.

- **V1 nodes are dropped from the fork.** Only the Vue-rendered V2 nodes
  (`src/renderer/extensions/vueNodes/...`) survive. The LiteGraph canvas
  itself stays (it still renders the background, links, groups), but
  per-node color constants like `LiteGraph.NODE_DEFAULT_BGCOLOR` no longer
  matter for _us_ — the bridge keeps setting them only as Tier 1
  compatibility for any extension still drawing on the canvas.
- **Six themes, no system-follow.** `dark` (default), `light`, `gray`,
  `strawberry` (light-mood, pink-warm), `mint` (light-mood, cool green),
  `campfire` (dark-mood, amber-warm). No `prefers-color-scheme`
  auto-switching — new users get dark; they can pick anything else.
  Themes are _colorway variants of one design language_, not different
  designs — typography, spacing, radii, shadows are shared across all
  six.
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
Primitives (raw hex, raw px values) appear inline as the values of
semantic tokens — they're not separately exported.

This is the part the existing system gets wrong: the three-layer
palette → semantic → comfy-legacy stack lets contributors pick the
wrong layer to reference, then the wrong layer drifts.

### Naming convention

Five prefixes, one for each token category:

- `--color-*` — colors (backgrounds, text, borders, focus rings)
- `--text-*` — typography (font family, sizes, weights, line-heights)
- `--space-*` — spacing scale (padding, margin, gap)
- `--radius-*` — border radii
- `--shadow-*` — drop shadows / elevation
- `--motion-*` — durations and easings

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

### Themes (color tokens vary; everything else stays)

Dark is the default (set on `:root`). The five other themes are blocks
keyed by `[data-theme="…"]` on `<html>`. Only `--color-*` tokens differ
between themes — typography, spacing, radii, shadows, and motion are
defined once at `:root` and inherited everywhere.

```css
/* tokens.css — sketch only; final values tuned during step 1 */
:root {
  /* === colors: dark default === */
  --color-bg: #0e0f12;
  --color-surface: #16181d;
  --color-surface-alt: #1d2027;
  --color-text: #e7e9ee;
  --color-text-muted: #8b909b;
  --color-border: #2a2d35;
  --color-action: #f5d800;
  --color-danger: #e35454;
  /* …rest of the ~30-color list… */

  /* === typography (theme-invariant) === */
  --text-family-sans: 'Inter', system-ui, sans-serif;
  --text-family-mono: 'JetBrains Mono', ui-monospace, monospace;
  --text-size-xs: 0.75rem;
  --text-size-sm: 0.875rem;
  --text-size-base: 1rem;
  --text-size-lg: 1.125rem;
  --text-size-xl: 1.25rem;
  --text-weight-regular: 400;
  --text-weight-medium: 500;
  --text-weight-bold: 700;
  --text-leading-tight: 1.2;
  --text-leading-normal: 1.5;

  /* === spacing scale (theme-invariant) === */
  --space-0: 0;
  --space-1: 0.25rem; /* 4px  */
  --space-2: 0.5rem; /* 8px  */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */

  /* === radii (theme-invariant) === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;

  /* === shadows (theme-invariant) === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);

  /* === motion (theme-invariant) === */
  --motion-fast: 100ms;
  --motion-base: 200ms;
  --motion-slow: 400ms;
  --motion-ease: cubic-bezier(0.2, 0, 0.2, 1);
}

[data-theme='light'] {
  /* color-* only */
}
[data-theme='gray'] {
  /* color-* only */
}
[data-theme='strawberry'] {
  /* color-* only */
}
[data-theme='mint'] {
  /* color-* only */
}
[data-theme='campfire'] {
  /* color-* only */
}
```

Every color block defines the same set of color tokens. No theme has
color tokens the others don't have.

### Tailwind 4 integration

Tailwind 4 reads CSS variables natively via `@theme`. We expose all
five token categories so utility classes like `bg-bg`, `text-text-muted`,
`p-4`, `rounded-md`, `shadow-md` resolve to our tokens:

```css
@theme {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-text: var(--color-text);
  --font-sans: var(--text-family-sans);
  --font-mono: var(--text-family-mono);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --shadow-sm: var(--shadow-sm);
  /* … */
}
```

No second config file, no JS-side translation.

### Token list (target)

**~30 color tokens, ~25 non-color tokens.** Stop adding when colors hit
50 or non-color hits 40.

**Surface / text:** bg, surface, surface-alt, text, text-muted,
text-disabled, border, border-strong, focus
**State:** action, action-fg, danger, danger-fg, warning, success
**Canvas (V2 nodes are Vue, so these are read by Vue components directly):**
canvas-bg, canvas-grid, node-bg, node-header, node-text, node-border,
node-selected, node-error
**Links (datatype socket colors):** link-model, link-image, link-latent,
link-conditioning, link-mask, link-string, link-int, link-float,
link-bool

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

### LiteGraph bridge (smaller because V1 is dead)

LiteGraph still renders the canvas background, links, and groups, so
the bridge has work to do — but no per-node color constants are needed
since V2 nodes are Vue components reading CSS vars directly.

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

### PrimeVue preset (`litePreset.ts`)

PrimeVue's surface area shrinks per upstream's own direction (#11081,
#11922, #10791) and our AGENTS.md "Avoid new usage of PrimeVue
components." For what remains:

- Replace `definePreset(Aura, …)` with `litePreset` in `src/main.ts`.
  The preset maps PrimeVue's tokens (`--p-content-background`,
  `--p-text-color`, `--p-surface-*`, `--p-primary-*`) onto our
  `--color-*` tokens.
- Wire `darkModeSelector: ':root, [data-theme="campfire"]'` (the dark-
  mood themes), drop the `:has()` workaround.
- One file, one preset. If a PrimeVue component looks wrong, fix the
  preset or replace the component — not a per-component override.

## Component shadowing (Layer 4)

When a component's _structure_ (not just appearance) needs to differ
from upstream, we shadow it via a Vite alias rather than editing it
in-place. Vite resolves `@/components/Foo.vue` to `src/lite/components/
Foo.vue` first if that file exists, falling back to
`src/components/Foo.vue` otherwise.

```ts
// vite.config.mts (one-line addition to existing alias array)
{ find: /^@\/components\/(.*)/, replacement: ... custom resolver that
  checks src/lite/components first, then falls back to src/components }
```

(Exact resolver shape decided during step 1 — Vite supports
custom-function aliases that can do filesystem fallback.)

The shadowed component file can:

- **Wrap and re-export** the original (keep behavior, change wrapper):
  `import Original from '@/components/Foo'; export default Original`
  with extra surrounding markup.
- **Replace entirely** (new template, same script imports/composables).

Use shadowing sparingly — every shadowed component is one we maintain
through upstream evolution. Reach for it only when tokens + overrides +
preset tweaks can't express the desired change.

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

### Tier 1.5 — custom palette adapter (preserves community themes)

Built-in themes (the 6 colorways) are defined as CSS blocks in
`tokens.css`. But community-shared custom palettes — JSON files users
have saved, posted on GitHub, traded on Discord — should keep working.

A small adapter (`src/services/legacyPaletteAdapter.ts`, ~80–100 lines)
loads a custom palette JSON and translates it into our role tokens by
calling `style.setProperty('--color-bg', value)` etc. on `:root`. The
Tier 1 aliases make this transitive: setting `--color-text` updates
every component reading the legacy `--fg-color`.

Mapping (sketch):

```
JSON path                                 → role token
comfy_base.fg-color                       → --color-text
comfy_base.bg-color                       → --color-bg
comfy_base.comfy-menu-bg                  → --color-surface
comfy_base.comfy-menu-secondary-bg        → --color-surface-alt
comfy_base.border-color                   → --color-border
comfy_base.descrip-text                   → --color-text-muted
comfy_base.error-text                     → --color-danger
node_slot.MODEL                           → --color-link-model
node_slot.IMAGE                           → --color-link-image
litegraph_base.CLEAR_BACKGROUND_COLOR     → --color-canvas-bg
litegraph_base.NODE_DEFAULT_BGCOLOR       → --color-node-bg
litegraph_base.NODE_TITLE_COLOR           → --color-node-header
litegraph_base.NODE_TEXT_COLOR            → --color-node-text
litegraph_base.LINK_COLOR                 → --color-border (canvas links)
```

What the adapter preserves:

- All `comfy_base` colors (the legacy CSS-var set most themes customize)
- All `node_slot` colors (link/socket per data type)
- The most common `litegraph_base` colors (canvas bg, node bg/header/text, link)

What the adapter drops (acceptable):

- `BACKGROUND_IMAGE` — base64 canvas-grid image. Our system uses a single
  grid color (`--color-canvas-grid`), not a tiled image.
- `NODE_DEFAULT_SHAPE` — V1 canvas-rendered shape (round/square corners).
  V2 nodes are Vue, shape comes from CSS. Ignored.
- Per-node tinting saved on individual nodes — V1 feature, going away.
- Anything design-language related (typography, spacing, radii) — old
  palettes don't have these. Custom themes will inherit our defaults.

The custom-palette import UI stays (or simplifies to import-only, no
export). Built-in themes and custom themes appear side-by-side in the
theme menu. This is a Step 4 deliverable; tokens.css and the rest of
Step 1 don't depend on it.

### Tier 1.6 — user themes (`<ComfyUI>/user/default/themes/`)

A first-class extension point for users who want themes as text files:
drop a CSS file in `<ComfyUI>/user/default/themes/`, refresh, see it
in the theme menu. **Zero backend code** (uses the existing
`/userdata` endpoint) and **zero parser dependencies** (browser
parses CSS natively).

**File format: CSS.** Reasons:

- Browser-native — no parser dependency at all.
- Universal — every web dev already knows the syntax.
- Direct — what the user writes is what gets applied. No translation
  layer between the theme file and the rendered styles.
- Expressive — anything CSS supports is available (media queries,
  fancy selectors, non-`:root` rules if a power user wants them).

Example skeleton:

```css
/* Optional metadata — picked up by the theme menu. */
/* @meta name = Gruvbox Dark */
/* @meta author = morhetz */
/* @meta description = Retro groove color scheme. */
/* @meta mood = dark */ /* or "light" */

:root {
  --color-bg: #282828;
  --color-surface: #3c3836;
  --color-text: #ebdbb2;
  /* ...all role tokens... */

  --color-link-model: #d3869b;
  --color-link-image: #83a598;
  /* ... */
}
```

Metadata uses `/* @meta key = value */` comments — easy to scan with
a regex on app boot, doesn't pollute the CSS itself.

**Built-in themes vs user themes:** Built-in themes ship as CSS blocks
in `tokens.css` and are colorways only (typography/spacing/radii
shared from `:root`). User themes can override anything — they're
just CSS, they can do whatever CSS can do.

**Implementation:** zero backend code, zero parser deps.

- Frontend service at `src/services/userThemeLoader.ts`:
  1. Lists files via `api.listUserDataFullInfo('themes')`.
  2. Filters to `*.css`.
  3. For each file, fetches the body via
     `api.getUserData('themes/<filename>')`, parses `@meta` comments
     with a regex, returns `{ id, filename, meta, cssText }`.
  4. On theme selection, injects the cssText into a `<style>`
     element in `<head>`. Removing the element clears the theme
     and falls back to the built-in cascade.
- File watching / live reload: skip in v1. A "reload themes" button
  on the menu is enough.

**Initial seed:** ship 3 example CSS themes (gruvbox, nord,
tokyo-night) checked into the repo at `examples/themes/`, with a
brief README that copying any of them into
`<ComfyUI>/user/default/themes/` is enough to install.

**Discovery:** themes appear in the menu under a "User themes"
divider. Theme menu shape (built-ins ▸ divider ▸ user themes) is
decided in step 2.

**Why not `~/.config/comfy/themes/`?** That XDG-dotfile location
needed a Python companion to bridge the browser sandbox. ComfyUI's
existing `/userdata` endpoint reaches `<ComfyUI>/user/default/`
directly with no new code. The cost: themes live inside the install
dir instead of a clean dotfile location. Worth it for the simplicity.

### Tier 2 — break, with a one-page migration note

These removals are the _point_ of the rewrite; preserving them would
preserve the disease.

| Removed surface                                                                                              | Replacement                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `Pinia colorPaletteStore`                                                                                    | none — extensions wanting the active theme read `document.documentElement.dataset.theme` |
| `services/colorPaletteService`                                                                               | none — the bridge runs internally, no public API                                         |
| `colorPaletteSchema` (Zod) and the `node_slot` / `litegraph_base` / `comfy_base` JSON shape                  | none — themes are CSS, not JSON                                                          |
| `Comfy.CustomColorPalettes` setting                                                                          | **kept** — loaded via `legacyPaletteAdapter` (Tier 1.5)                                  |
| Built-in palette JSONs (`dark.json`, `light.json`, `arc.json`, `nord.json`, `github.json`, `solarized.json`) | replaced by tokens.css blocks                                                            |
| Custom palette import/export UI                                                                              | **kept** — possibly simplified to import-only                                            |
| The six `*ColorPicker*` components per upstream #8024                                                        | mostly V1-canvas-rendered; deleted along with V1                                         |

`Comfy.ColorPalette` setting key **stays** but its accepted values
become `'dark' | 'light' | 'gray' | 'strawberry' | 'mint' | 'campfire'`.
Existing values (`'arc'`, `'nord'`, `'github'`, `'solarized'`,
`'obsidian_dark'`, `'light_red'`, custom IDs) silently coerce to
`'dark'` or `'light'` based on whether the original palette had
`light_theme: true`. Existing E2E specs work with no changes; their
saved IDs just resolve to dark/light.

## Files to delete

When the new system lands:

- `src/stores/workspace/colorPaletteStore.ts` (replaced by `useColorScheme` composable)
- `src/services/colorPaletteService.ts` (replaced by smaller `legacyPaletteAdapter.ts` for custom palettes only)
- `src/schemas/colorPaletteSchema.ts` (kept in adapter as a minimal validator for custom-palette JSON)
- `src/constants/coreColorPalettes.ts` (built-in palettes go to tokens.css)
- `src/assets/palettes/*.json` (all six built-ins; user-saved custom palettes in `Comfy.CustomColorPalettes` setting are unaffected)
- `src/platform/settings/components/ColorPaletteMessage.vue`
- `src/components/common/ColorCustomizationSelector.vue` (V1-related)
- `src/components/common/FormColorPicker.vue` (if V1 only)
- `src/components/graph/selectionToolbox/ColorPickerButton.vue` (V1)
- `src/components/rightSidePanel/settings/SetNodeColor.vue` (V1)
- `src/composables/graph/useNodeCustomization.ts` (V1)
- `packages/design-system/src/css/_palette.css`
- `packages/design-system/src/css/style.css` (the ~1900-line one) —
  most of it; salvage genuinely-needed bits (font face declarations,
  Iconify safelist) into smaller files

The replacement is `src/styles/tokens.css` +
`src/styles/lite-overrides.css` + `src/styles/litePreset.ts` +
`src/composables/useColorScheme.ts` + `src/services/themeBridge.ts` +
`src/components/ColorSchemeMenu.vue`. Net delta: roughly **−4000 to
−5000 lines** including the V1 color picker components.

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

**Step 1 — foundation.** Build the layer 1–3 stack:

- 1a. `tokens.css` — dark theme + Tier 1 alias block + non-color tokens.
- 1b. `useColorScheme.ts` composable.
- 1c. Fill in the other 5 themes in `tokens.css`.
- 1d. `themeBridge.ts` — LiteGraph constants.
- 1e. Rewrite `litegraph.css` to use the new vars.
- 1f. `litePreset.ts` — PrimeVue Aura preset rewired to our tokens.
- 1g. `lite-overrides.css` — initial scaffold (empty until needed).

Old palette code stays alive in parallel — Tier 1 means nothing breaks
visually.

**Step 1.5 — user theme support (Tier 1.6).** Build the user theme
loader. No backend code, no parser dependencies; uses the existing
`/userdata` endpoint.

- 1.5a. `src/services/userThemeLoader.ts` — lists `*.css` from
  `<ComfyUI>/user/default/themes/`, parses `@meta` comments with a
  regex, applies by injecting a `<style>` element.
- 1.5b. Ship 3 example CSS themes at `examples/themes/`
  (`gruvbox.css`, `nord.css`, `tokyo-night.css`) with a README
  saying "copy these into `<ComfyUI>/user/default/themes/`."

Step 1.5 can land before or after step 2 (the menu) — they're
independent, but the menu becomes more compelling once user themes
exist to populate it.

**Step 2 — wire the menu.** Build `ColorSchemeMenu.vue`. Lists built-in
themes + user themes (from 1.5) under a divider. Drop
`ColorPaletteMessage.vue` from the settings dialog and replace it.

**Step 3 — delete the old system.** Remove every file in the "Files
to delete" list. Remove the `.dark-theme` class plumbing. Coerce
`Comfy.ColorPalette` legacy values to dark/light. Update browser
tests for the new menu surface.

**Step 4 — visual polish & shadowing.** With the foundation working,
iterate on the actual look: tune token values against the running app,
add `lite-overrides.css` rules for things tokens can't reach, shadow
specific components whose structure should differ. Also build
`legacyPaletteAdapter.ts` (Tier 1.5) so community-shared custom
palettes keep working. This is the open-ended phase where the design
language gets refined.

Step 1 + Step 2 = the minimum visible rewrite. Step 3 is the cleanup
that removes the old code. Step 4 is where the redesign actually lives.
**Throughout all four, the Tier 1 alias block stays in place** — it's
a permanent fixture in `tokens.css` until a future major where we
revisit.

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
- **Per-theme typography or spacing.** Themes are colorways. The design
  language (font, spacing, radii, shadows) is shared across all six.

## Risks

- **LiteGraph repaint cost on theme change.** The bridge calls
  `canvas.draw(true, true)` on every switch. Acceptable for an
  infrequent action.
- **PrimeVue Aura preset surprises.** Aura's internal token graph is
  large; mapping our ~30 tokens may leave gaps where Aura components
  fall back to defaults. Fix on sight during step 1; don't pre-plan.
- **Extensions calling the removed Pinia store / service.** They break
  with clear errors. Document the removal in a migration note.
  CSS-var-using extensions are unaffected (Tier 1 aliases).
- **`darkModeSelector` for PrimeVue with multiple dark themes.** Our
  dark-mood themes are `:root` (default) and `[data-theme="campfire"]`.
  Need to verify PrimeVue's `darkModeSelector` accepts a comma-
  separated selector. If not, set the attribute differently (e.g.
  `data-mood="dark|light"` separately from `data-theme`).
- **Vite alias resolver complexity.** Filesystem-fallback alias
  resolvers are slightly tricky to get right and may interact oddly
  with HMR. Worst case: fall back to explicit per-shadow alias entries
  added to `vite.config.mts` one at a time. Still cheap.

## Open questions

1. **Theme menu shape.** Plain dropdown vs. a 6-swatch grid. Decide
   when building it; both are easy.
2. **Token tuning.** The hex values in this doc are sketches. Real
   values get tuned during step 1 against the actual UI.
3. **Initial design direction.** What does "Eli's taste" mean
   concretely for fonts, corner roundness, spacing rhythm, density?
   Resolved by exploring during step 4 — not blocking.
