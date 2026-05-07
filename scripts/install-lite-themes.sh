#!/usr/bin/env bash
# Install the lite_themes Python companion into ComfyUI's custom_nodes
# dir, and seed example themes into the user's theme directory.
#
# Defaults to ~/Comfy/repos/ComfyUI; override with COMFYUI_PATH.
#
# Usage:
#   ./scripts/install-lite-themes.sh
#   ./scripts/install-lite-themes.sh --no-examples         # skip seeding
#   COMFYUI_PATH=/elsewhere ./scripts/install-lite-themes.sh
#
# Re-running is safe — existing symlinks and theme files are not touched.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_PATH="${COMFYUI_PATH:-$HOME/Comfy/repos/ComfyUI}"
SOURCE="$REPO_DIR/python/lite_themes"
TARGET_DIR="$COMFYUI_PATH/custom_nodes"
TARGET="$TARGET_DIR/lite_themes"
THEMES_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/comfy/themes"
EXAMPLES="$REPO_DIR/python/lite_themes/examples"

INSTALL_EXAMPLES=1
for arg in "$@"; do
  case "$arg" in
    --no-examples) INSTALL_EXAMPLES=0 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -d "$COMFYUI_PATH" ]]; then
  echo "ComfyUI not found at $COMFYUI_PATH" >&2
  echo "set COMFYUI_PATH to your install location" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

# Symlink the Python package so edits to the source propagate
if [[ -L "$TARGET" ]]; then
  echo "✓ already linked: $TARGET → $(readlink "$TARGET")"
elif [[ -e "$TARGET" ]]; then
  echo "✗ $TARGET exists and is not a symlink — move or remove it" >&2
  exit 1
else
  ln -s "$SOURCE" "$TARGET"
  echo "✓ linked $SOURCE → $TARGET"
fi

# Seed the user theme dir with examples
if [[ "$INSTALL_EXAMPLES" == "1" ]]; then
  mkdir -p "$THEMES_DIR"
  echo "✓ themes dir: $THEMES_DIR"
  for f in "$EXAMPLES"/*.toml; do
    name="$(basename "$f")"
    if [[ -e "$THEMES_DIR/$name" ]]; then
      echo "  · $name (already exists, skipped)"
    else
      cp "$f" "$THEMES_DIR/"
      echo "  + $name"
    fi
  done
fi

echo
echo "Restart ComfyUI to register the /api/lite-themes endpoint."
echo "After restart: curl http://localhost:8188/api/lite-themes"
