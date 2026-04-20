#!/usr/bin/env bash
# One-command deploy on the cPanel server.
#
# Usage (from cPanel Terminal or SSH):
#   cd ~/repositories/swiss-bakery && bash deploy.sh
#
# What it does:
#   1. Activates the CloudLinux Node.js virtualenv
#   2. Pulls latest from git
#   3. Re-installs deps only if package.json / package-lock.json changed
#   4. Regenerates Prisma client only if schema.prisma changed
#   5. Applies new migrations only if migrations/ changed
#   6. Restarts the Passenger app (graceful, no downtime)
#
# Safe to run every time — skips the expensive steps if nothing changed.

set -euo pipefail

REPO_DIR="$HOME/repositories/swiss-bakery"
VENV_ACTIVATE="$HOME/nodevenv/repositories/swiss-bakery/20/bin/activate"
SCHEMA="$REPO_DIR/apps/api/prisma/schema.prisma"

cd "$REPO_DIR"

# Activate the Node.js virtualenv if not already active
if [ -z "${CL_VIRTUAL_ENV:-}" ]; then
  # shellcheck disable=SC1090
  source "$VENV_ACTIVATE"
fi

# Verify .env exists — bail loudly if missing (app would fail to start anyway)
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "✗ $REPO_DIR/.env is missing. Create it before deploying (see CPANEL_NODEJS_HOSTING_PLAYBOOK.md §2.7)." >&2
  exit 1
fi

echo "==> pulling from GitHub"
OLD_HEAD=$(git rev-parse HEAD)
git pull origin main
NEW_HEAD=$(git rev-parse HEAD)

if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
  echo "   (already up to date — nothing to deploy)"
  exit 0
fi

echo "==> checking what changed"
CHANGED=$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD")
echo "$CHANGED" | sed 's/^/   /'

deps_changed=false
schema_changed=false
migrations_changed=false
echo "$CHANGED" | grep -qE '^(package(-lock)?\.json)$' && deps_changed=true
echo "$CHANGED" | grep -qE '^apps/api/prisma/schema\.prisma$' && schema_changed=true
echo "$CHANGED" | grep -qE '^apps/api/prisma/migrations/' && migrations_changed=true

if $deps_changed; then
  echo "==> deps changed; reinstalling (removing any real node_modules so the wrapper can symlink)"
  rm -rf node_modules apps/api/node_modules apps/web/node_modules
  npm install --no-audit --no-fund --omit=dev
fi

if $schema_changed; then
  echo "==> prisma schema changed; regenerating client"
  npx prisma generate --schema "$SCHEMA"
fi

if $migrations_changed; then
  echo "==> new migrations; applying"
  npx prisma migrate deploy --schema "$SCHEMA"
fi

echo "==> restarting Passenger app"
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "✓ deployed $(git log -1 --oneline)"
echo "  Next request will pick up the new build (Passenger restart is lazy)."
