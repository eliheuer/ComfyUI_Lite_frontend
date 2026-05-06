#!/usr/bin/env bash
# Open the lite-frontend dev server in a chromeless Chromium window.
# Used for clean UI testing and consistent screenshots — no tabs,
# no address bar, no extensions, isolated profile.
#
# Usage:
#   ./scripts/dev-window.sh                          # opens http://localhost:5173
#   ./scripts/dev-window.sh http://localhost:6006    # storybook, or any other URL
#
# Env overrides:
#   LITE_FE_PROFILE  — profile directory (default: ~/.cache/lite-frontend-profile)
#   LITE_FE_WINDOW   — initial window size (default: 1440,900)

set -euo pipefail

URL="${1:-http://localhost:5173}"
PROFILE_DIR="${LITE_FE_PROFILE:-$HOME/.cache/lite-frontend-profile}"
WINDOW_SIZE="${LITE_FE_WINDOW:-1440,900}"

if ! command -v chromium >/dev/null 2>&1; then
  echo "chromium not found in PATH. Install it (e.g. 'sudo pacman -S chromium')." >&2
  exit 1
fi

exec chromium \
  --app="$URL" \
  --user-data-dir="$PROFILE_DIR" \
  --window-size="$WINDOW_SIZE" \
  "${@:2}"
