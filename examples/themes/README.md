# Example themes

Drop-in CSS themes for the Lite frontend. Copy any of these into your
ComfyUI user theme directory and they'll appear in the theme menu:

```bash
cp examples/themes/gruvbox.css ~/Comfy/repos/ComfyUI/user/default/themes/
```

(adjust the path if your ComfyUI install lives elsewhere)

After copying, refresh the frontend or use the "Reload themes" button
in the theme menu. No restart required — the file appears via
ComfyUI's existing `/userdata` endpoint.

## Format

Themes are plain CSS. A minimal theme is just a `:root { ... }` block
that overrides the role tokens:

```css
/* Optional metadata — picked up by the theme menu. */
/* @meta name = My Theme */
/* @meta author = you */
/* @meta description = What it looks like. */
/* @meta mood = dark */ /* or "light" */

:root {
  --color-bg: #0e0f12;
  --color-surface: #171718;
  --color-text: #ffffff;
  /* ...all role tokens you want to override... */

  --color-link-model: #b39ddb;
  --color-link-image: #64b5f6;
  /* ... */
}
```

See `.agents/context/eli/theme-system-design.md` (Tier 1.6) for the
full design and `src/styles/tokens.css` for every available token.

## Why CSS

- **Zero parser deps.** The browser already understands CSS.
- **Universal.** Every web dev knows the syntax.
- **Direct.** What you write is what gets applied — no translation
  layer between your file and the rendered styles.
- **Expressive.** Anything CSS supports is fair game (media queries,
  fancy selectors, custom non-`:root` rules).

Built-in themes ship as colorways only (typography/spacing/radii
shared across all six). User themes can override anything they want
since they're just CSS.

## Included examples

- **gruvbox.css** — Retro Groove Color Scheme by Pavel Pertsev. Warm,
  muted, easy on the eyes. Dark mood.
- **nord.css** — Arctic, north-bluish palette. Cool, calm, distinctly
  Scandinavian. Dark mood.
- **tokyo-night.css** — Neon-tinged dark theme inspired by downtown
  Tokyo at night. Dark mood.

Use these as starting templates — copy, rename, edit.
