#!/usr/bin/env bash
# Swiss Bakery — local publish (build + commit + push to GitHub).
# Double-click in Finder, or run from terminal: bash publish.command
#
# What it does:
#   1. Pre-flight checks (Node ≥ 20, .env present, git repo, working tree
#      sanity)
#   2. Builds the static web (`apps/web/dist`)
#   3. Re-generates the Prisma client locally with native + rhel-openssl-3.0.x
#      binaries (`apps/api/prisma-client/`) — the cPanel server is too small
#      to run prisma generate; we ship the artefact
#   4. Compiles the API (`apps/api/dist`)
#   5. Runs `npm audit` (warning-only — won't block publish)
#   6. Shows you the diff summary, asks for a commit message, commits & pushes
#   7. Prints the one-liner you run on the server to finish the deploy
#
# Re-runnable. Skips steps where nothing changed.

set -eu -o pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ── colours ───────────────────────────────────────────────────────────────
BLUE=$'\033[1;34m'
GOLD=$'\033[1;33m'
RED=$'\033[1;31m'
GREEN=$'\033[1;32m'
DIM=$'\033[2m'
NC=$'\033[0m'

say()  { printf "%s\n" "$*"; }
hdr()  { printf "\n%s\n" "${BLUE}━━━ $* ━━━${NC}"; }
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "  ${GOLD}!${NC} %s\n" "$*"; }
fail() { printf "  ${RED}✗${NC} %s\n" "$*"; }
pause_and_exit() {
  local code="${1:-1}"
  printf "\n"
  read -r -p "Press enter to close this window..."
  exit "$code"
}

printf "%s\n" "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "%s\n" "${BLUE}  Swiss Bakery — publish to GitHub (then deploy on cPanel)${NC}"
printf "%s\n" "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "${DIM}Project: %s${NC}\n" "$SCRIPT_DIR"

# ── 1. pre-flight ─────────────────────────────────────────────────────────
hdr "1/6  Pre-flight checks"

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install Node 20+ from https://nodejs.org"
  pause_and_exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node $NODE_MAJOR found — need Node 20+."
  pause_and_exit 1
fi
ok "Node $(node -v), npm $(npm -v)"

if ! command -v git >/dev/null 2>&1; then
  fail "git is not installed."
  pause_and_exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a git working tree. Aborting."
  pause_and_exit 1
fi
ok "git repo: $(git remote get-url origin 2>/dev/null || echo '(no remote)')"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ok "branch: $BRANCH"
if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
  warn "You're on '$BRANCH', not main/master."
  read -r -p "Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || pause_and_exit 0
fi

if [[ ! -f .env ]]; then
  warn ".env is missing locally. Build will still work, but the API can't run without it."
fi

# Make sure dependencies are installed at each workspace.
need_root_install=false
[[ -d node_modules ]] || need_root_install=true
[[ -d apps/api/node_modules ]] || need_root_install=true
[[ -d apps/web/node_modules ]] || need_root_install=true
if $need_root_install; then
  hdr "Installing dependencies (first time on this machine)"
  npm install --no-audit --no-fund || { fail "npm install failed at root."; pause_and_exit 1; }
  ( cd apps/api && npm install --no-audit --no-fund ) || { fail "apps/api install failed."; pause_and_exit 1; }
  ( cd apps/web && npm install --no-audit --no-fund ) || { fail "apps/web install failed."; pause_and_exit 1; }
  ok "deps installed"
fi

# ── 2. build web ──────────────────────────────────────────────────────────
hdr "2/6  Building the public site (Astro)"
( cd apps/web && npx astro build ) >/tmp/sb-web-build.log 2>&1 || {
  fail "Astro build failed. Log:"
  tail -40 /tmp/sb-web-build.log
  pause_and_exit 1
}
ok "apps/web/dist rebuilt ($(find apps/web/dist -type f | wc -l | tr -d ' ') files)"

# ── 3. prisma client ──────────────────────────────────────────────────────
hdr "3/6  Generating Prisma client (native + rhel-openssl-3.0.x)"
# The output path and binaryTargets are set in apps/api/prisma/schema.prisma.
# We always regenerate so the client matches the current schema and the
# committed engine binaries stay in sync with whatever's in node_modules.
npx prisma generate --schema apps/api/prisma/schema.prisma >/tmp/sb-prisma.log 2>&1 || {
  fail "prisma generate failed. Log:"
  tail -40 /tmp/sb-prisma.log
  pause_and_exit 1
}
if [[ ! -f apps/api/prisma-client/libquery_engine-rhel-openssl-3.0.x.so.node ]]; then
  fail "rhel-openssl-3.0.x engine missing after generate — check binaryTargets in schema.prisma."
  pause_and_exit 1
fi
PRISMA_SIZE="$(du -sh apps/api/prisma-client | cut -f1)"
ok "apps/api/prisma-client ready ($PRISMA_SIZE, native + rhel-openssl-3.0.x)"

# ── 4. build API ──────────────────────────────────────────────────────────
hdr "4/6  Compiling the API (tsc)"
( cd apps/api && npx tsc -p tsconfig.json ) >/tmp/sb-api-build.log 2>&1 || {
  fail "tsc failed. Log:"
  tail -40 /tmp/sb-api-build.log
  pause_and_exit 1
}
ok "apps/api/dist rebuilt"

# ── 5. npm audit (advisory) ───────────────────────────────────────────────
hdr "5/6  npm audit (warnings only — won't block publish)"
AUDIT_JSON="$(npm audit --omit=dev --json 2>/dev/null || true)"
if [[ -n "$AUDIT_JSON" ]]; then
  HIGH=$(node -e 'try{const j=JSON.parse(process.argv[1]); const m=j.metadata?.vulnerabilities||{}; console.log((m.high||0)+(m.critical||0))}catch{console.log(0)}' "$AUDIT_JSON")
  if [[ "$HIGH" -gt 0 ]]; then
    warn "$HIGH high/critical advisories at the project root."
    warn "Run \`npm audit --omit=dev\` for details; consider fixing before pushing."
  else
    ok "no high/critical advisories"
  fi
else
  warn "npm audit didn't return JSON — skipping check."
fi

# ── 6. git: stage, commit, push ───────────────────────────────────────────
hdr "6/6  Stage → commit → push"

# Stage the artefacts the deploy expects to find in git.
git add -A apps/web/dist apps/api/dist apps/api/prisma-client apps/api/prisma >/dev/null 2>&1 || true
# Also stage anything else the user has been editing.
git add -A >/dev/null 2>&1 || true

if git diff --cached --quiet; then
  ok "nothing to commit — working tree matches origin/$BRANCH"
  COMMITTED=false
else
  printf "\n${DIM}Changes to be committed:${NC}\n"
  git diff --cached --stat | sed 's/^/  /'
  printf "\n"
  DEFAULT_MSG="publish: $(date '+%Y-%m-%d %H:%M') — site + API rebuilt"
  read -r -p "Commit message [${DEFAULT_MSG}]: " MSG
  MSG="${MSG:-$DEFAULT_MSG}"
  git commit -m "$MSG" >/dev/null
  ok "committed: $(git log -1 --oneline)"
  COMMITTED=true
fi

# Decide whether to push: if there are unpushed commits, push.
UNPUSHED="$(git log "@{u}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ' || echo 0)"
if [[ "${UNPUSHED:-0}" -gt 0 ]]; then
  printf "\n${GOLD}%s unpushed commit(s):${NC}\n" "$UNPUSHED"
  git log "@{u}..HEAD" --oneline | sed 's/^/  /'
  printf "\n"
  read -r -p "Push to origin/$BRANCH now? [Y/n] " yn
  if [[ -z "$yn" || "$yn" =~ ^[Yy]$ ]]; then
    git push origin "$BRANCH" || { fail "push failed."; pause_and_exit 1; }
    ok "pushed to origin/$BRANCH"
  else
    warn "skipped push (run \`git push\` yourself when ready)."
  fi
else
  if $COMMITTED; then
    warn "no unpushed commits found — odd, but skipping push."
  else
    ok "origin/$BRANCH is already up-to-date with local"
  fi
fi

# ── summary + next step ───────────────────────────────────────────────────
printf "\n%s\n" "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "%s\n" "${GREEN}  Done. Now finish the deploy on the cPanel server:${NC}"
printf "%s\n" "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cat <<'EOF'

  SSH into the server (cPanel → Terminal, or ssh swissbak@au-s1) and run:

      cd ~/repositories/swiss-bakery
      git fetch && git reset --hard origin/main
      bash deploy.sh

  deploy.sh will:
    • detect what changed since the last deploy
    • apply any new Prisma migrations
    • use the pre-generated client at apps/api/prisma-client/
    • touch tmp/restart.txt to restart Passenger
    • update .last-deploy with the new HEAD

  After it finishes, the next browser request to swissbakery.com.au
  picks up the new build.

EOF

read -r -p "Press enter to close this window..."
