#!/usr/bin/env bash
# Prepares a copy of the Git history WITHOUT prisma/dev.db.
#
# Context: prisma/dev.db was a development/TEST database (no real student data),
# committed in 1a8b9f8. It contains password hashes of test accounts, so it
# should not stay in the repository history.
#
# This script NEVER pushes. It rewrites a fresh mirror clone in a temporary
# directory and prints the command to publish it. Publishing rewrites the remote
# history: every collaborator must re-clone afterwards.
#
# Requires git-filter-repo (pip install git-filter-repo).
set -euo pipefail

if [ "${1:-}" != "--i-understand-this-rewrites-history" ]; then
  echo "usage: scripts/purge-dev-db-from-history.sh --i-understand-this-rewrites-history" >&2
  exit 1
fi
command -v git-filter-repo >/dev/null || { echo "install git-filter-repo first" >&2; exit 1; }

cd "$(dirname "$0")/.."
remote=$(git remote get-url origin)
work="$(mktemp -d)/issatkr-mirror.git"

git clone --mirror "$remote" "$work"
cd "$work"
git filter-repo --path prisma/dev.db --invert-paths --force

if [ -n "$(git log --all --format=%H -- prisma/dev.db)" ]; then
  echo "purge: prisma/dev.db is still present in the rewritten history" >&2
  exit 1
fi

cat <<EOF
Rewritten mirror ready (prisma/dev.db removed from every commit): $work

Review it, then publish (DESTRUCTIVE for the remote history):
  cd "$work"
  git remote add origin "$remote"
  git push --force --mirror origin

Afterwards: every collaborator re-clones; ask GitHub support to purge cached
views of the old commits if the repository was ever public.
EOF
