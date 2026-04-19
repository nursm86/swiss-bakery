# Swiss Bakery - Project Brief & Handoff

> **For the next AI session.** Read this before touching any code.
> Everything below is **already decided** - don't re-litigate the stack. If a decision needs to change, raise it explicitly before implementing.

---

## 1. Business context

- **Shop name:** Swiss Bakery
- **Type:** Australian bakery serving Swiss-branded European + traditional Bengali items (savouries, breads, mishti/sweets, beverages)
- **Currency:** AUD (`$`)
- **Address:** Shop 3/12 Minto Rd, Minto NSW 2566 (Sydney, southwest suburbs)
- **Phone:** +61 0452 626 232
- **Email:** contact@swissbakery.com.au
- **Existing site:** https://swissbakery.com.au (WooCommerce, being replaced)
- **Social:** Facebook present (URL not yet captured - ask owner when needed)
- **Deployment target:** owner's cPanel hosting (Node.js "Setup Node.js App" / Phusion Passenger is supported - confirmed 2026-04-19)

---

## 2. Scope

One-page public website with a small backend to manage dynamic content. **No e-commerce checkout in this build** - ordering will be handled later by **Oracle GloriaFood**, which is a third-party JS widget (drop-in `<script>` + HTML snippet, no backend integration required from us).

### Public page sections

1. Hero banner (editable image + heading + subheading + CTA)
2. Notice strip (editable text + active/inactive toggle + dismissible)
3. Featured products (editable list with image, name, price, category, description)
4. Full menu (by category: Savoury Bites, Bakery & Breads, Traditional Sweets, Beverages & Sides)
5. About / brand story (static or editable)
6. Contact (address, phone, email, Google Map embed, hours)
7. Footer (social, copyright, GloriaFood ordering widget mount point - reserve `<div id="gloriafood-widget"></div>`)

### Admin (single admin, behind JWT)

- Login page (email + password, verified against `.env`-stored credentials)
- Dashboard: CRUD for products, edit hero banner, edit notice, edit opening hours / contact bits
- Image upload → `public/uploads/` on the server (multer, size + MIME validated)

---

## 3. Final stack (LOCKED - do not change without owner sign-off)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Node.js ≥ 20 LTS** | cPanel "Setup Node.js App" - pick the highest version the host offers (22 LTS preferred) |
| Server | **Express 5.x** | Native async/await error handling, no `express-async-errors` needed |
| DB | **MySQL** (cPanel-provisioned) | Create via cPanel → MySQL Databases |
| ORM | **Prisma 6.x** | Parameterized queries by default; schema-first; `prisma migrate dev` for local, `prisma migrate deploy` for cPanel |
| Auth | **JWT, 1 admin, creds in `.env`** | ⚠ **Owner-approved override of the global rule** that mandates Clerk/Supabase/Auth0. Any future multi-user or customer-auth requirement MUST switch to a managed provider. |
| Validation | **Zod 3.x** | At every API boundary |
| Password hash | **argon2** | Store the argon2 hash in `.env`, never plaintext |
| Security middleware | **helmet, express-rate-limit, cors (allow-listed), cookie-parser** | All mandatory per global rules |
| Logging | **pino** + `pino-pretty` in dev | No `console.log` in committed code |
| File upload | **multer** with MIME + size + extension whitelist | Uploads to `public/uploads/` served as static |
| Frontend (public) | **Astro 5.x** + **Tailwind CSS v4** | Build to static HTML/CSS/JS, Express serves the built `dist/` as static |
| Frontend (admin) | Same Astro project, separate `/admin/*` routes that call the JSON API; JWT stored in httpOnly cookie | Or minimal vanilla HTML+JS if Astro SSR feels heavy - decide early |
| Env loader | Node's native `--env-file=.env` flag (Node 20.6+) | No `dotenv` dep needed |
| Dev runner | `node --watch` (built-in) | No `nodemon` dep needed |
| TypeScript | **Yes**, both backend and frontend | `tsx` for ts execution if needed; or compile step |

### JWT auth details (locked)

- Access token lifetime: **15 minutes**
- Refresh token lifetime: **7 days**, rotates on use
- Algorithm: **HS256** with a `JWT_SECRET` of ≥ 32 random bytes (generate via `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`)
- Storage: **httpOnly + Secure + SameSite=Strict cookie** for refresh token; access token in memory or short-lived cookie
- Login rate-limit: **5 attempts / 15 min / IP** via `express-rate-limit`
- CSRF: double-submit token on all state-changing routes (or rely on SameSite=Strict + custom header check)
- No password-reset flow in v1 (single admin, reset via `.env` edit by owner)

### `.env` shape

```
# server
NODE_ENV=production
PORT=3000
PUBLIC_ORIGIN=https://swissbakery.com.au

# db
DATABASE_URL="mysql://USER:PASS@localhost:3306/DBNAME"

# auth
ADMIN_EMAIL=owner@swissbakery.com.au
ADMIN_PASSWORD_HASH=<argon2 hash - generate with scripts/hash-password.ts>
JWT_SECRET=<48 random bytes, base64>
JWT_REFRESH_SECRET=<48 random bytes, base64, DIFFERENT from JWT_SECRET>

# cors
ALLOWED_ORIGINS=https://swissbakery.com.au,https://www.swissbakery.com.au
```

`.env.example` committed; `.env` gitignored.

---

## 4. Proposed repo structure

```
swiss-bakery/
├── apps/
│   ├── web/                    # Astro public + admin frontend
│   │   ├── src/
│   │   │   ├── pages/          # index.astro, admin/*
│   │   │   ├── components/
│   │   │   ├── layouts/
│   │   │   └── styles/global.css
│   │   ├── public/             # static assets (favicon, logo)
│   │   ├── astro.config.mjs
│   │   └── package.json
│   └── api/                    # Express backend
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/         # auth, products, hero, notice, upload
│       │   ├── middleware/     # jwt, rateLimit, error
│       │   ├── lib/            # prisma, logger, jwt helpers
│       │   └── schemas/        # zod schemas
│       ├── prisma/
│       │   └── schema.prisma
│       ├── scripts/
│       │   └── hash-password.ts
│       └── package.json
├── public/uploads/             # served by Express - gitignore contents, keep .gitkeep
├── scripts/
│   └── build_menu.py           # existing, A4 menu PPTX generator
├── swiss-bakery-menu.pptx      # editable menu template
├── swiss_logo.png              # brand logo
├── swiss bakery menu.jpeg      # source ref (handwritten)
├── swiss bakery menu 2.jpeg    # source ref (typed)
├── .env.example
├── .gitignore
├── package.json                # root, uses npm workspaces or pnpm
├── PROJECT_BRIEF.md            # this file
└── README.md
```

> If monorepo feels heavy for one-pager, collapse `apps/web` and `apps/api` into root with `src/` and `web/` - fine either way. Decide on first day.

---

## 5. Prisma schema starting point

```prisma
model Product {
  id          Int      @id @default(autoincrement())
  slug        String   @unique
  name        String
  category    String   // Savoury | Bakery | Sweets | Beverages
  priceCents  Int?     // null = "ask staff"
  unit        String   @default("piece") // piece | kg | pack
  description String?  @db.Text
  imagePath   String?  // /uploads/xyz.webp
  isFeatured  Boolean  @default(false)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model HeroBanner {
  id          Int      @id @default(autoincrement())
  heading     String
  subheading  String?
  ctaLabel    String?
  ctaHref     String?
  imagePath   String
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  updatedAt   DateTime @updatedAt
}

model Notice {
  id        Int      @id @default(autoincrement())
  message   String   @db.Text
  level     String   @default("info") // info | promo | alert
  isActive  Boolean  @default(false)
  startsAt  DateTime?
  endsAt    DateTime?
  updatedAt DateTime @updatedAt
}

model SiteSetting {
  key       String   @id
  value     String   @db.Text
  updatedAt DateTime @updatedAt
}
// site settings: address, phone, email, hours, mapEmbedUrl, facebookUrl, instagramUrl
```

Seed the menu items from `scripts/build_menu.py`'s data (already structured by category) - write a `prisma/seed.ts` that mirrors the Python dicts.

---

## 6. API surface (v1)

```
POST   /api/auth/login           { email, password } → sets httpOnly refresh cookie, returns access token
POST   /api/auth/refresh         → rotates refresh, returns new access
POST   /api/auth/logout          → clears cookie, invalidates refresh

GET    /api/products             (public)
POST   /api/products             (admin)
PATCH  /api/products/:id         (admin)
DELETE /api/products/:id         (admin)

GET    /api/hero                 (public, active only)
GET    /api/hero/all             (admin)
POST   /api/hero                 (admin)
PATCH  /api/hero/:id             (admin)
DELETE /api/hero/:id             (admin)

GET    /api/notice               (public, active only, current time window)
PATCH  /api/notice               (admin, upsert)

GET    /api/settings             (public, whitelisted keys only)
PATCH  /api/settings             (admin)

POST   /api/uploads              (admin, multipart, returns imagePath)
```

All write routes: JWT middleware + Zod body validation + rate-limit.

---

## 7. Latest package versions to target (as of 2026-04-19)

Check `npm view <pkg> version` on day 1 - these are the floors.

**Backend (`apps/api`):**
```json
{
  "engines": { "node": ">=20.0.0" },
  "dependencies": {
    "express": "^5.1.0",
    "@prisma/client": "^6.0.0",
    "zod": "^3.24.0",
    "argon2": "^0.41.0",
    "jsonwebtoken": "^9.0.2",
    "helmet": "^8.0.0",
    "express-rate-limit": "^7.5.0",
    "cors": "^2.8.5",
    "cookie-parser": "^1.4.7",
    "multer": "^1.4.5-lts.1",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/multer": "^1.4.0",
    "@types/cookie-parser": "^1.4.0",
    "@types/cors": "^2.8.0",
    "pino-pretty": "^13.0.0"
  }
}
```

> **Before installing any of these, run `npm view <name> version` and use whatever is higher if a new major landed after 2026-04-19.** Per the updated global rule: run `npm audit` after install, resolve every high/critical advisory, don't suppress.

**Frontend (`apps/web`):**
```json
{
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/node": "^9.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

Fonts: load **Playfair Display** (display) + **Montserrat** (body) from Google Fonts with `font-display: swap`. Both also used in the PPTX menu - keeps print + web consistent.

---

## 8. Brand

- **Primary:** `#1A2A4F` (navy)
- **Accent:** `#C89A2B` (mustard gold)
- **Background:** `#F6EFE0` (cream)
- **Swiss accent:** `#C8102E` (red - use sparingly, e.g. cross motif only)
- **Logo:** `swiss_logo.png` (circular emblem with Matterhorn + braided bread + croissant + Swiss cross, wordmark "SWISS ✚ BAKERY")
- **Tone:** premium-boutique patisserie crossed with warm Bengali hospitality - not corporate, not kitsch

---

## 9. Prerequisites the next session must verify on day 1

- [ ] Node.js version available on owner's cPanel (open **Setup Node.js App → Create Application**, note the Node dropdown's highest value - must be ≥ 20). Owner confirmed Node.js support exists; exact version still pending.
- [ ] MySQL database + user created in cPanel, connection string captured
- [ ] Domain/subdomain routing decision: does `swissbakery.com.au` repoint to the new app, or does new app live at `new.swissbakery.com.au` first?
- [ ] Opening hours (for Contact section) - owner to provide
- [ ] Facebook URL - owner to provide
- [ ] **Hero banner + About mood imagery:** owner is deferring. Build CSS-only branded placeholders per `IMAGE_STRATEGY.md` → "Placeholder spec for hero/decorative slots (v1)". Owner will swap in real assets later via admin - no stock-photo sourcing needed for v1.

---

## 10. Rules of engagement

- **Follow `~/.claude/CLAUDE.md`** (global rules). Especially: parameterized queries, Zod at boundaries, restrictive CORS, no `console.log`, `npm audit` clean, `engines.node >= 20`, security middleware mandatory.
- **Only exception:** Auth. Owner explicitly chose JWT + single admin in `.env` for v1. Implement JWT to the hardened spec in §3 (argon2, rotating refresh, rate-limit, httpOnly cookie). Any future multi-user or customer-facing auth flips back to a managed provider.
- **No premature abstraction.** This is a one-pager. Keep it boring and direct.
- **No new dependencies without checking npm publish date + open CVEs.**
- **Don't write READMEs / docs unless asked.** This brief is the doc.

---

## 11. Already-done artifacts in this repo

- `swiss_logo.png` - brand logo
- `scripts/build_menu.py` - generates `swiss-bakery-menu.pptx` (A4 in-shop menu, editable, Playfair + Montserrat, brand colors).
- `swiss-bakery-menu.pptx` - the rendered menu template (editable in PowerPoint/Canva)
- `swiss bakery menu.jpeg`, `swiss bakery menu 2.jpeg` - owner's source menu drafts (handwritten + typed). Supplier codes on these are internal - ignore when producing customer artifacts.
- **`data/products.seed.json`** - canonical product list with names, slugs, categories, prices (in cents, AUD), units, descriptions, `imagePath` (now populated - see below), and `isFeatured` flags. Matches Prisma `Product` schema exactly. **This is what `prisma/seed.ts` should consume.** Items with `priceCents: null` are listed in `_meta.priceReviewBeforeGoLive` - owner to confirm before launch.
- **`public/uploads/seed/*.jpg`** - one seed image per product (45 total, ~7.4MB), sourced from Wikipedia/Wikimedia Commons via `scripts/download_product_images.py`. Resized to max 1200px longest-side, JPEG q85. Licence is **CC-BY-SA 3.0/4.0** (per-image - see `_attributions.json` for source links). **Attribution requirement:** include a footer credit line on the public site (e.g. "Some product images courtesy Wikimedia Commons contributors under CC-BY-SA") until owner replaces with own photography. Several slugs currently share an image (e.g. all patties, all singaras, all kati-rolls, both singara variants + samosa, both monsor/kodom, both pakon-pitha/narikel-puli/patishapta) - see §11 of IMAGE_STRATEGY.md. Gitignore keeps `public/uploads/seed/` tracked; ignores all other uploads.
- **`public/uploads/seed/_attributions.json`** - per-image source article URL and file URL, for attribution + later audit.
- **`scripts/download_product_images.py`** - the seed-image downloader. Idempotent; re-run any time (will overwrite existing files) to refresh or add products.
- **`IMAGE_STRATEGY.md`** - hybrid imagery plan: owner's phone photos (primary) + free stock (universal items) + Nano Banana Pro 2 (hero/decorative only, never product shots). Includes the photo checklist for the owner.

---

## 12. Kickoff checklist for next session

1. Read this file.
2. Read `~/.claude/CLAUDE.md` global rules.
3. Confirm Node version on cPanel with owner (§9 item 1).
4. Scaffold repo per §4.
5. Initialize Prisma with schema in §5, run `prisma migrate dev --name init`.
6. Write `prisma/seed.ts` that reads `data/products.seed.json` and creates all products. Use `upsert` on `slug` so re-runs are idempotent. Seed `SiteSetting` rows with address, phone, email from §1.
7. Implement auth first (§3 JWT spec) - it's the load-bearing piece.
8. Build public page (hero/notice/menu/contact) before admin CRUD.
9. Admin CRUD last.
10. `npm audit` → clean → commit.
