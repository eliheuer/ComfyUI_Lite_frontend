#!/usr/bin/env bash
# Sync local main with the upstream PR branch (PR #11317:
# eliheuer/ComfyUI_frontend@app-mode-semi-customizable-layout). Lite-specific
# commits in scripts/, .agents/, and docs/ are replayed on top via rebase.
#
# When the PR finally merges into Comfy-Org/ComfyUI_frontend:main, switch
# tracking with --ref upstream/main (or set SYNC_PR_REF in your env).
#
# Usage:
#   ./scripts/sync-pr.sh                       # rebase only, prints push command
#   ./scripts/sync-pr.sh --push                # rebase and force-push to origin
#   ./scripts/sync-pr.sh --ref upstream/main   # track upstream main instead
#   ./scripts/sync-pr.sh --dry-run             # show what would happen
#
# Env overrides:
#   SYNC_PR_REF   — default upstream ref to track

set -euo pipefail

REF="${SYNC_PR_REF:-frontend-fork/app-mode-semi-customizable-layout}"
DO_PUSH=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) DO_PUSH=1; shift ;;
    --ref) REF="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,17p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      echo "see --help" >&2
      exit 2
      ;;
  esac
done

REMOTE="${REF%%/*}"
BRANCH="${REF#*/}"

if [[ "$REMOTE" == "$BRANCH" ]]; then
  echo "ref '$REF' must be in form <remote>/<branch>" >&2
  exit 2
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "not in a git repository" >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "remote '$REMOTE' is not configured (run: git remote add $REMOTE <url>)" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "working tree is dirty — commit or stash first" >&2
  git status --short >&2
  exit 1
fi

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo '(detached)')"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "warning: current branch is '$CURRENT_BRANCH', not 'main'" >&2
  read -r -p "continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

echo "→ fetching $REMOTE/$BRANCH..."
git fetch "$REMOTE" "$BRANCH"

NEW_TIP="$(git rev-parse "$REF")"
OLD_TIP="$(git rev-parse "$REF@{1}" 2>/dev/null || echo '(none)')"
AHEAD="$(git rev-list --count "$REF..HEAD")"
BEHIND="$(git rev-list --count "HEAD..$REF")"

echo
echo "  ref:        $REF"
echo "  old tip:    ${OLD_TIP:0:9}"
echo "  new tip:    ${NEW_TIP:0:9}"
echo "  ahead:      $AHEAD"
echo "  behind:     $BEHIND"

if [[ "$AHEAD" == "0" && "$BEHIND" == "0" ]]; then
  echo
  echo "✓ already in sync — nothing to do"
  exit 0
fi

if [[ "$AHEAD" -gt 0 ]]; then
  echo
  echo "  local commits to replay:"
  git log --oneline "$REF..HEAD" | sed 's/^/    /'
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo
  echo "(dry-run) would rebase HEAD onto $REF"
  [[ "$DO_PUSH" == "1" ]] && echo "(dry-run) would force-push to origin/main"
  exit 0
fi

echo
if [[ "$AHEAD" == "0" ]]; then
  echo "→ fast-forwarding..."
  git merge --ff-only "$REF"
else
  echo "→ rebasing onto $REF..."
  if ! git rebase "$REF"; then
    echo >&2
    echo "✗ rebase has conflicts" >&2
    echo "  resolve, then run: git rebase --continue   (or --abort)" >&2
    exit 1
  fi
fi

echo
if [[ "$DO_PUSH" == "1" ]]; then
  echo "→ force-pushing to origin/main..."
  git push --force-with-lease origin main
  echo "✓ done"
else
  echo "✓ local main updated"
  echo "  to publish: git push --force-with-lease origin main"
  echo "  (or rerun with --push)"
fi
