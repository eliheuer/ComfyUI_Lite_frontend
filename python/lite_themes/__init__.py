"""Lite themes — dotfile theme support for ComfyUI Lite frontend.

Reads TOML theme files from ``$XDG_CONFIG_HOME/comfy/themes/``
(default ``~/.config/comfy/themes/``) and exposes them via
``GET /api/lite-themes`` so the frontend can list and apply them.

This is a backend companion to the Lite fork. See
``.agents/context/eli/theme-system-design.md`` (Tier 1.6) for design.

Install via ``scripts/install-lite-themes.sh`` from the frontend repo.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

try:
    import tomllib  # Python 3.11+
except ImportError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[no-redef]

from aiohttp import web
from server import PromptServer

log = logging.getLogger("lite_themes")


def themes_dir() -> Path:
    """Resolve the user's theme directory.

    Honors ``$XDG_CONFIG_HOME``; falls back to ``~/.config``. Never
    creates the directory — empty/missing is a normal state for a
    user who hasn't dropped a theme file yet.
    """
    xdg = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(xdg) / "comfy" / "themes"


def _load_theme(path: Path) -> dict[str, Any] | None:
    """Parse one TOML file. Returns ``None`` on any parse error."""
    try:
        with path.open("rb") as f:
            data = tomllib.load(f)
    except (tomllib.TOMLDecodeError, OSError) as e:
        log.warning("[lite_themes] failed to parse %s: %s", path.name, e)
        return None

    return {
        "id": path.stem,
        "filename": path.name,
        "meta": data.get("meta", {}),
        "colors": data.get("colors", {}),
        "typography": data.get("typography", {}),
        "spacing": data.get("spacing", {}),
        "radii": data.get("radii", {}),
        "shadows": data.get("shadows", {}),
        "motion": data.get("motion", {}),
    }


@PromptServer.instance.routes.get("/api/lite-themes")
async def list_themes(_request: web.Request) -> web.Response:
    """Return all valid TOML themes from the user's theme directory.

    Re-scans on every call — cheap, the directory is typically small
    and parsing TOML is fast. Letting users drop a file and refresh
    the menu beats teaching them to invoke a reload command.
    """
    d = themes_dir()
    if not d.is_dir():
        return web.json_response([])

    themes = []
    for path in sorted(d.glob("*.toml")):
        theme = _load_theme(path)
        if theme is not None:
            themes.append(theme)

    return web.json_response(themes)


# No ComfyUI nodes — this package only registers an HTTP endpoint.
NODE_CLASS_MAPPINGS: dict[str, Any] = {}
NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {}
