#!/usr/bin/env bash
# Deploy script for the cPanel server.
#
# Pull first (cPanel Git Version Control → "Update from Remote", or
# `git fetch && git reset --hard origin/main` over SSH), then run this script.
# Or wire `.cpanel.yml` so cPanel's "Deploy HEAD Commit" runs it for you.
#
# What it does (all idempotent — safe to re-run):
#   1. Activates the CloudLinux Node.js virtualenv
#   2. Compares the current HEAD against `.last-deploy` (a local marker
#      we update at the end of every successful deploy)
#   3. Re-installs deps only if package.json / package-lock.json changed
#   4. Regenerates Prisma client only if schema.prisma changed
#   5. Applies new migrations only if migrations/ changed
#   6. Restarts Passenger (lazy — next request picks up the new build)
#   7. Writes the new HEAD into `.last-deploy`
#
# Flags:
#   --force   Run every step regardless of what `.last-deploy` says.
#             Use after editing .env, after manual file fixes, or for the
#             very first deploy on a fresh checkout.

set -eo pipefail
# No `set -u` — cPanel's nodevenv activate script references CL_VIRTUAL_ENV
# before setting it, which trips nounset.

REPO_DIR="$HOME/repositories/swiss-bakery"
VENV_ACTIVATE="$HOME/nodevenv/repositories/swiss-bakery/20/bin/activate"
SCHEMA="$REPO_DIR/apps/api/prisma/schema.prisma"
PRISMA_CLIENT_DIR="$REPO_DIR/apps/api/prisma-client"
STATE_FILE="$REPO_DIR/.last-deploy"

FORCE=false
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=true ;;
  esac
done

cd "$REPO_DIR"

# Activate the Node.js virtualenv if not already active.
if [ -z "${CL_VIRTUAL_ENV:-}" ]; then
  # shellcheck disable=SC1090,SC1091
  . "$VENV_ACTIVATE"
fi

# Verify .env exists — bail loudly if missing (app would fail to start anyway).
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "✗ $REPO_DIR/.env is missing. Create it before deploying (see CPANEL_NODEJS_HOSTING_PLAYBOOK.md §2.7)." >&2
  exit 1
fi

NEW_HEAD=$(git rev-parse HEAD)
OLD_HEAD=""
if [ -f "$STATE_FILE" ]; then
  OLD_HEAD=$(tr -d '[:space:]' < "$STATE_FILE")
fi

deps_changed=false
schema_changed=false
migrations_changed=false

if $FORCE; then
  echo "==> --force given; running every step"
  deps_changed=true
  schema_changed=true
  migrations_changed=true
elif [ -z "$OLD_HEAD" ]; then
  # First run with the new flow — we don't know what's already on disk vs.
  # what's in HEAD. Be conservative: just restart Passenger and record HEAD.
  # Run with --force once if you want a full install on the first deploy.
  echo "==> no .last-deploy marker — recording HEAD ($NEW_HEAD) and only restarting Passenger"
  echo "    (run \`bash deploy.sh --force\` if you also want a fresh install)"
elif [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
  echo "==> HEAD unchanged since last deploy ($NEW_HEAD)"
  echo "    (running restart only — Pass --force to reinstall everything)"
else
  echo "==> changes since last deploy ($OLD_HEAD..$NEW_HEAD):"
  CHANGED=$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD")
  echo "$CHANGED" | sed 's/^/    /'
  echo "$CHANGED" | grep -qE '^(package(-lock)?\.json)$' && deps_changed=true || true
  echo "$CHANGED" | grep -qE '^apps/api/prisma/schema\.prisma$' && schema_changed=true || true
  echo "$CHANGED" | grep -qE '^apps/api/prisma/migrations/' && migrations_changed=true || true
fi

if $deps_changed; then
  echo "==> deps changed; reinstalling (removing real node_modules so the wrapper can symlink)"
  rm -rf node_modules apps/api/node_modules apps/web/node_modules
  npm install --no-audit --no-fund --omit=dev
fi

# Sanity check: the Prisma client is pre-generated locally and committed to
# the repo at apps/api/prisma-client/. We do NOT regenerate on the server -
# CloudLinux LVE was SIGABRT-killing the generator's WASM engine. If this
# folder is missing it means someone forgot to commit it locally; bail loudly.
if [ ! -f "$PRISMA_CLIENT_DIR/index.js" ] || [ ! -f "$PRISMA_CLIENT_DIR/libquery_engine-rhel-openssl-3.0.x.so.node" ]; then
  echo "✗ Pre-generated Prisma client missing at $PRISMA_CLIENT_DIR" >&2
  echo "  Locally:  npx prisma generate --schema apps/api/prisma/schema.prisma" >&2
  echo "  Then:     git add apps/api/prisma-client && git commit && git push" >&2
  exit 1
fi
if $schema_changed; then
  echo "==> prisma schema changed; using pre-generated client at apps/api/prisma-client/ (no server-side generate)"
fi

if $migrations_changed; then
  echo "==> new migrations; applying"
  # Locate the Prisma CLI script. Invoke it via `node` directly (NOT npx) -
  # CloudLinux LVE was returning EAGAIN ("spawn sh") because npx adds an extra
  # shell + npm process to the chain that bumps into the NPROC ceiling.
  PRISMA_CLI=""
  for p in \
    "$REPO_DIR/node_modules/prisma/build/index.js" \
    "$REPO_DIR/apps/api/node_modules/prisma/build/index.js"; do
    if [ -f "$p" ]; then PRISMA_CLI="$p"; break; fi
  done
  if [ -z "$PRISMA_CLI" ]; then
    echo "✗ prisma CLI not found at node_modules/prisma/build/index.js" >&2
    echo "  Run with --force, or \`cd apps/api && npm install\`." >&2
    exit 1
  fi
  # Retry once or twice on EAGAIN — CloudLinux process limits are bursty and
  # the migration engine itself spawns a subprocess.
  attempt=1
  while true; do
    if node "$PRISMA_CLI" migrate deploy --schema "$SCHEMA"; then
      break
    fi
    if [ "$attempt" -ge 3 ]; then
      echo "✗ prisma migrate deploy failed after $attempt attempts." >&2
      echo "  If the failure is 'EAGAIN spawn …', try again in 30s — your CloudLinux" >&2
      echo "  account hit its process-entry / NPROC ceiling." >&2
      exit 1
    fi
    echo "  attempt $attempt failed; retrying in 5s…"
    sleep 5
    attempt=$((attempt + 1))
  done
fi

echo "==> restarting Passenger app"
mkdir -p tmp
touch tmp/restart.txt

# Record current HEAD for next run's change detection.
echo "$NEW_HEAD" > "$STATE_FILE"

echo ""
echo "✓ deployed $(git log -1 --oneline)"
echo "  Next request will pick up the new build (Passenger restart is lazy)."
