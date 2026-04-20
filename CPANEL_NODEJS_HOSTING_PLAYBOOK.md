# cPanel + CloudLinux Node.js Hosting Playbook

Hard-won lessons from deploying Swiss Bakery (Express 5 + Prisma 6 + Astro 5 + MySQL) to cPanel on CloudLinux / LiteSpeed, **April 2026**. Read this before deploying a Node.js app to any cPanel / CloudLinux shared host — it will save hours.

---

## 0. TL;DR — the rules that save you

1. **All runtime dependencies MUST live in the root `package.json`.** cPanel's `npm` wrapper only installs at the Application Root. It ignores `workspaces`, ignores subpackage `package.json` files, ignores `npm install --prefix`.
2. **Pre-build everything locally. Commit `dist/` folders.** Do not try to build on the server. Astro, tsc, Prisma CLI have path/PATH issues that waste hours. `npm run build` locally, `git add apps/*/dist`, push.
3. **Never create a real `node_modules/` directory at the App Root.** The CloudLinux wrapper needs to create a *symlink* pointing to `~/nodevenv/<app>/<version>/lib/node_modules/`. If a real dir is there, `npm install` silently succeeds but does nothing.
4. **Write `.env` directly on the server.** The cPanel Node.js App env-vars UI is flaky and Passenger can't pass `--env-file=`. Load via `process.loadEnvFile()` in code (Node 20.12+).
5. **Use cPanel Terminal (Advanced → Terminal), not the UI buttons.** "Run NPM Install" and "Run JS Script" have bizarre cwd and PATH behavior. The Terminal with `source nodevenv/.../activate` is normal bash.

---

## 1. What cPanel's CloudLinux wrapper actually does

`~/nodevenv/<app-path>/<version>/bin/npm` is **not real npm** — it's a bash script. On any `install` / `add` subcommand it:

1. Deletes any existing symlink at `<app_root>/node_modules`.
2. **Errors out** if a real directory or file exists at `<app_root>/node_modules`.
3. Creates `<venv>/lib/node_modules/` if missing.
4. Runs real npm with a custom prefix pointing at the venv.
5. Symlinks `<app_root>/node_modules` → `<venv>/lib/node_modules/`.

This is why:
- `npm install` inside a sub-dir like `apps/api` silently says "up to date in <1s" and does nothing.
- `npm install --workspaces=...` / `--prefix` / `--install-strategy=nested` all fail to produce local `node_modules/`.
- `node_modules` at the App Root always appears as a symlink after a successful install.

**Read your wrapper:**
```bash
head -40 $(which npm)
```

---

## 2. First-time deploy checklist (in order)

### 2.1. Provision MySQL
- cPanel → **MySQL® Databases**
- Create DB (e.g. `account_appdb`), user (e.g. `account_appuser`), strong password
- **Add user to DB with ALL PRIVILEGES**
- Build DSN: `mysql://USER:URL_ENCODED_PASS@localhost:3306/DBNAME`
  - URL-encode special chars in the password: `)` → `%29`, `=` → `%3D`, `{` → `%7B`, etc.

### 2.2. Repo prep (on your dev machine)
Before first `git push`:

```json
// root package.json
{
  "name": "my-app",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "build": "…your build command(s)…",
    "deploy:prisma": "prisma migrate deploy --schema path/to/schema.prisma"
  },
  "dependencies": {
    // ALL runtime deps here, not in sub-packages.
  },
  "devDependencies": {
    // Build-time only: typescript, astro, @types/*, etc.
  }
}
```

**Do not use npm workspaces** for anything cPanel-deployed. Keep subpackages for local dev organization only, and consolidate runtime deps at root.

**Un-gitignore `dist/`** (assuming you're not shipping it via CI):
```
# .gitignore
dist
!apps/web/dist
!apps/web/dist/**
!apps/api/dist
!apps/api/dist/**
```

Build locally, commit `dist/`, push.

### 2.3. In code: auto-load `.env`
cPanel Passenger can't pass `--env-file`. Put this as the very first import of your entry file:

```ts
// src/loadEnv.ts
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const p of [
  path.resolve(here, "..", "..", ".env"),   // repo root (adjust for your layout)
  path.resolve(here, "..", ".env"),
]) {
  if (existsSync(p)) {
    process.loadEnvFile(p);
    break;
  }
}

// src/index.ts (first line)
import "./loadEnv.js";
```

Requires Node ≥ 20.12. cPanel's Node 20.20.0 supports it.

### 2.4. Prisma schema
- Pin Prisma to the latest **major 6.x** (`"prisma": "^6.1.0"`, `"@prisma/client": "^6.1.0"`). Prisma 7 drops `url` from the schema's datasource block, requiring `prisma.config.ts`, which is more moving parts.
- Skip `shadowDatabaseUrl` in production — `prisma migrate deploy` doesn't need it.
- `@db.Text` on any field that might exceed 191 chars (MySQL's default VARCHAR hoist).

### 2.5. cPanel Setup Node.js App
- **Node.js version:** highest ≥ 20 (22 if available).
- **Application mode:** Production.
- **Application root:** `repositories/<reponame>` (matches cPanel Git Version Control's default clone path).
- **Application URL:** your domain or subdomain.
- **Application startup file:** your entry, e.g. `apps/api/dist/index.js`.
- **Don't set env vars here.** Leave the list empty — we'll use `.env`.
- Click **Create**. Don't start yet.

### 2.6. cPanel Git Version Control
- **Clone URL:** HTTPS URL for public repos, or SSH with key uploaded to GitHub.
- **Repository Path:** `/home/USER/repositories/<reponame>` (must match App Root from 2.5).
- **Branch:** `main`.
- Create.

### 2.7. Activate shell + write `.env`
cPanel → Advanced → **Terminal**:

```bash
source ~/nodevenv/repositories/<app>/<ver>/bin/activate
cd ~/repositories/<app>

cat > .env <<'EOF'
NODE_ENV=production
PORT=3000
PUBLIC_ORIGIN=https://YOURDOMAIN
DATABASE_URL=mysql://USER:URLENC_PASS@localhost:3306/DB
# …your other secrets…
EOF
chmod 600 .env
```

### 2.8. Install (the moment of truth)
```bash
cd ~/repositories/<app>
# Nuke any real node_modules the wrapper might choke on:
rm -rf node_modules apps/*/node_modules

npm install --no-audit --no-fund --omit=dev

# Verify the wrapper created the symlink:
ls -la node_modules    # must show:  node_modules -> /home/USER/nodevenv/.../lib/node_modules
ls node_modules/ | head   # must show real packages
```

If `ls node_modules/` is empty, the wrapper silently failed. Causes + fixes below.

### 2.9. Prisma + seed
```bash
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
node --env-file=.env --import tsx apps/api/prisma/seed.ts
```

### 2.10. `.htaccess` — the final piece
`public_html/.htaccess` (or whatever the domain's docroot is) needs Passenger directives. cPanel's Setup Node.js App usually writes this, but only after the app is started. To force it manually:

```apache
DirectoryIndex disabled
RewriteEngine On
RewriteRule ^$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ - [L]

PassengerAppRoot "/home/USER/repositories/APP"
PassengerBaseURI "/"
PassengerNodejs "/home/USER/nodevenv/repositories/APP/VER/bin/node"
PassengerAppType node
PassengerStartupFile path/to/dist/index.js
```

LiteSpeed honors these same directives. `chmod 644`.

### 2.11. Start the app
cPanel → Setup Node.js App → **START APP** (or Restart).

Visit the domain. If it still shows "Index of /", the `.htaccess` is missing or the app didn't start — see §3.

---

## 3. Debugging playbook — by symptom

### "up to date in <1s" but `node_modules` is empty
1. **Check you're at the App Root**, not a sub-dir. `npm install` in `apps/api` is a no-op.
2. **Check for a real directory at `<app_root>/node_modules`.** The wrapper refuses to install if it can't swap in a symlink. `rm -rf node_modules` and retry.
3. **Check your root `package.json` actually has deps.** If it only had `"workspaces"`, there's nothing to install.
4. **Make sure the virtualenv is activated.** `type npm` should show `~/nodevenv/.../bin/npm`. If not, `source activate`.

### `npx prisma generate` pulls Prisma 7 + fails
- Your root `package.json` doesn't include `prisma` as a runtime dep, so `npx` downloads latest (7+).
- Pin `"prisma": "^6.1.0"` in root `dependencies`. Re-run `npm install`, retry.

### `sh: astro: command not found` (exit 127) when building on cPanel
- Don't build on cPanel. Pre-build locally and commit `dist/`.
- If you truly need to build on server: resolve the binary by reading the installed package's `package.json` `bin` field and invoking with `node <path>`. PATH/symlink discovery is unreliable here.

### Browser shows "Index of /" (LiteSpeed default)
- `.htaccess` missing from docroot — write it per §2.10.
- App not started — cPanel → Setup Node.js App → Start App.

### DATABASE_URL is empty after activating the venv
- cPanel's env-vars UI didn't regenerate `set_env_vars.py`. Either re-save in the UI (click Save even with no changes), or — better — stop using the UI and put everything in `.env` (see §2.3, §2.7).

### Passenger error log
- `~/logs/<domain>*.log` — Apache / LiteSpeed access + error logs.
- The Node.js App screen in cPanel has a `stderr.log` link — that's stdout/stderr from your app.
- Passenger output during startup sometimes goes to `~/logs/passenger.log` or is referenced from the `.htaccess.log`.

### `git pull` fails because of local changes
Working copy has uncommitted debug state (node_modules, deleted lockfiles, etc.):
```bash
git reset --hard HEAD
rm -rf node_modules tmp apps/*/node_modules
git pull origin main
```

---

## 4. What cPanel's UI buttons actually do (and why not to trust them)

| Button | What you'd expect | What actually happens |
|---|---|---|
| Run NPM Install | `npm install` in app root | Runs `npm install` via the CloudLinux wrapper. Works if root `package.json` has deps. Silently no-ops if workspace-only or if a real `node_modules` dir exists. No useful error output. |
| Run JS Script → `build` | Runs your `build` script | Runs in a shell where PATH may not include workspace-hoisted `.bin/`. Often fails with exit 127 (`command not found`) even when the tool is installed. |
| Start/Restart App | Starts Passenger | Works. Use it. |
| Env Vars section | Sets process.env | Technically works, but variables sometimes don't propagate to `source activate` without a re-save, and Passenger doesn't re-read them without restart. `.env` on disk is more reliable. |

**Rule:** when in doubt, use cPanel Terminal with the venv activated.

---

## 5. File layout that works

```
repo-root/
├── package.json                    ← ALL runtime deps here
├── package-lock.json               ← committed
├── .env                            ← gitignored; written on server
├── .env.example                    ← committed
├── apps/
│   ├── api/
│   │   ├── src/                    ← TS source
│   │   ├── dist/                   ← committed (pre-built)
│   │   ├── prisma/schema.prisma
│   │   └── package.json            ← local dev only; not read by cPanel
│   └── web/
│       ├── src/                    ← Astro source
│       ├── dist/                   ← committed (pre-built static)
│       └── package.json            ← local dev only
└── public_html/                    ← cPanel's webroot, OUTSIDE repo
    └── .htaccess                   ← PassengerAppRoot etc.
```

The `.htaccess` in `public_html/` points Passenger at the repo's `apps/api/dist/index.js`, which serves:
- `/api/*` via Express
- `/*` as static files from `apps/web/dist/` (mounted via `express.static`)

---

## 6. Deploy workflow after initial setup

On dev machine:
```bash
# make changes
npm run build              # regenerate apps/*/dist
git add -A
git commit -m "…"
git push origin main
```

On cPanel (Terminal or Git Version Control → Update from Remote):
```bash
source ~/nodevenv/repositories/APP/VER/bin/activate
cd ~/repositories/APP
git pull origin main

# If package.json changed:
npm install --no-audit --no-fund --omit=dev

# If schema.prisma changed:
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Then cPanel → Setup Node.js App → **Restart App**.

---

## 7. Things that *don't* exist on cPanel / won't work

- `docker` / `docker-compose`
- systemd units
- `pm2` as a long-lived daemon (use Passenger)
- Custom ports (Passenger manages the port, your app reads `process.env.PORT`)
- `sudo` / root access
- Installing global npm packages (they'd go to virtualenv only anyway)
- `postinstall` scripts that assume `npm install` runs at the repo root with full workspace context

---

## 8. The one-line diagnostic that tells you everything

```bash
source ~/nodevenv/repositories/APP/VER/bin/activate
cd ~/repositories/APP
echo "node: $(node -v), npm wrapper: $(type -p npm), DATABASE_URL present: $([ -n "$DATABASE_URL" ] && echo yes || echo no)"
ls -la node_modules | head -1
ls node_modules/ 2>/dev/null | wc -l
```

If node_modules is a symlink pointing into `nodevenv/.../lib/node_modules/` and the package count is non-zero, your install is good. If you see a real directory instead, delete it and reinstall.
