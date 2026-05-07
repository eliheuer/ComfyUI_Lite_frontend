# Example themes

Drop-in TOML themes for the Lite frontend. Copy any of these into your
ComfyUI user theme directory and they'll appear in the theme menu:

```bash
cp examples/themes/gruvbox.toml ~/Comfy/repos/ComfyUI/user/default/themes/
```

(adjust the path if your ComfyUI install lives elsewhere)

After copying, refresh the frontend or use the "Reload themes" button
in the theme menu. No restart required — the file appears via
ComfyUI's existing `/userdata` endpoint.

## Format

See `.agents/context/eli/theme-system-design.md` (Tier 1.6) for the
full design. Short version:

```toml
[meta]
name        = "My Theme"
author      = "you"
description = "What it looks like."
mood        = "dark"     # or "light"

[colors]
bg            = "#0e0f12"
surface       = "#171718"
text          = "#ffffff"
# ...all role tokens you want to override...

[colors.links]
model = "#b39ddb"
image = "#64b5f6"
# ...

# Optional sections — only override what you want.
[typography]
font-sans = "JetBrains Mono, monospace"

[radii]
md = "0px"
```

Built-in themes ship as colorways only (typography/spacing/radii
shared across all six). User themes can override anything.

## Included examples

- **gruvbox.toml** — Retro Groove Color Scheme by Pavel Pertsev. Warm,
  muted, easy on the eyes. Dark mood.
- **nord.toml** — Arctic, north-bluish palette. Cool, calm, distinctly
  Scandinavian. Dark mood.
- **tokyo-night.toml** — Neon-tinged dark theme inspired by downtown
  Tokyo at night. Dark mood.

Use these as starting templates — copy, rename, edit.
