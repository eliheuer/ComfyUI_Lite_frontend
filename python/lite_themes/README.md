# lite_themes

Backend companion for the ComfyUI Lite frontend's dotfile theme system.

## What this does

Reads TOML theme files from `~/.config/comfy/themes/` (or
`$XDG_CONFIG_HOME/comfy/themes/`) and exposes them at
`GET /api/lite-themes`. The Lite frontend lists them in the theme
menu alongside built-in themes.

## Install

From the frontend repo:

```bash
./scripts/install-lite-themes.sh
```

That symlinks `python/lite_themes/` into ComfyUI's `custom_nodes/`
and copies the example themes into `~/.config/comfy/themes/` if the
directory is empty. Restart ComfyUI to register the endpoint.

## Theme file format

```toml
# ~/.config/comfy/themes/my-theme.toml

[meta]
name        = "My Theme"
author      = "you"
description = "What it looks like or what it's for."
mood        = "dark"   # or "light" — drives PrimeVue's darkModeSelector

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

See `examples/` for working themes you can copy and modify.

## Design notes

- Re-scans on every GET — there's no cache. Add a theme, refresh, see
  it. No reload command to teach.
- TOML parse errors are logged and skipped (the rest of the directory
  still loads). Look at ComfyUI's stderr if a file isn't appearing.
- Returns the raw token map; the frontend translates tokens into CSS
  variables via the same code path the legacy palette adapter uses.
