#!/usr/bin/env sh
# Enforce branch naming: <type>/<slug>
# Allowed types match Conventional Commits: feat|fix|chore|refactor|test|docs
# Allowed slug chars: lowercase letters, digits, dot, dash, underscore.

branch=$(git rev-parse --abbrev-ref HEAD)

# Allow long-lived branches and detached HEAD (e.g. during rebase).
# `production` tracks what is live in prod; only the release workflow advances it.
case "$branch" in
  main|production|HEAD)
    exit 0
    ;;
esac

pattern='^(feat|fix|chore|refactor|test|docs)/[a-z0-9._-]+$'

if ! printf '%s' "$branch" | grep -Eq "$pattern"; then
  printf '\n\033[31m✖ Invalid branch name:\033[0m %s\n' "$branch"
  printf '  Expected: <type>/<slug>\n'
  printf '  Types:    feat | fix | chore | refactor | test | docs\n'
  printf '  Example:  feat/lit-7-eslint-prettier-husky\n'
  printf '  Rename:   git branch -m <new-name>\n\n'
  exit 1
fi
