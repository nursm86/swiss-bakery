# Product imagery - strategy

> Short answer: **mostly real photos you shoot with a phone**, **some free stock** for universal items, and **Nano Banana Pro 2 only for the hero banner and decorative backgrounds** - never for specific product shots.

---

## Why not AI for product photos

Bengali specialty items are where AI image models fail most visibly to the actual target customer:

- **Piyaju, patishapta, narikel puli, kaza, hafsa, aflaton, bondia** - these aren't in the training data densely enough. Nano Banana Pro 2 will produce something plausible-looking but *wrong* in a way a Bengali customer spots instantly. That's a trust problem for a food business.
- **Rasgulla, cham cham, laddu, rosmalai, firni** - model knows these but will invent garnish, plating, and colour that don't match your shop's actual presentation.
- **Legal:** Gemini's commercial use is allowed (SynthID watermark is embedded). That's not the blocker. The blocker is *honesty* - customers see a photo, they expect that exact thing.

AI-generated food photography is fine for **concept/mood imagery**, not for **"this is what you'll be served."**

## Why not 100% stock

- Free stock sites (Unsplash, Pexels, Pixabay) cover croissants, bread, cookies, tea, samosas - but thin-to-nothing on Bengali specialties.
- Every other bakery uses the same Unsplash hero croissant. You lose differentiation.

## Recommended approach - hybrid, ranked by priority

### Tier 1: Your own phone photography (highest ROI)
Shoot your actual products. Phone cameras on a modern iPhone/Android in natural window light rival studio work for web use.

**Mini setup (under $50):**
- Near a north-facing window, mid-morning (soft diffused light - no direct sun).
- Cream linen tea towel or a plain wooden board as background (matches your brand palette).
- Phone camera, 1x lens (not ultrawide - distorts close food).
- Overhead (top-down) for plated items, 3/4 angle for pastries with height.
- One item per frame. No busy backgrounds.
- Square crop (1:1) - website will render as cards.
- 10–20 min per shoot covers a whole category.

**Post-process:** any free editor (Snapseed, VSCO, Lightroom Mobile) - bump exposure +0.3, warmth +5, saturation +10. Done. Save as JPEG, max side 1600px, quality 85. I'll convert to WebP in the upload pipeline.

**Target items (Tier 1, shoot these yourself):**
All specialty Bengali items - Piyaju, Patishapta, Narikel Puli, Kaza, Hafsa, Aflaton, Bondia, Chana Mukhi, Monsor, Kodom, Balu Shai, Pera, Singara (veg + liver), Dal Puri, Mughlai Paratha, Poro Roti, Firni. Also your Patties / Rolls / Samosas / Rasgulla / Cham Cham / Rosmalai / Laddu so the style stays consistent.

### Tier 2: Free stock (Unsplash / Pexels)
For items where generic = fine:

- Tea cup / chai (Malai Cha)
- Croissant / cream roll (Butter Bun, Cream Roll)
- Baklava (well covered on stock)
- Plain bread loaf (Short Bread visual backup)
- Buttered corn
- Butter Bun

**Licenses** (all free for commercial use, no attribution required): Unsplash, Pexels, Pixabay. Always download the highest-res version and double-check the photo's individual license on the page (rare exceptions exist).

**Search terms that work:** "bangladeshi sweets", "indian mithai platter", "south asian tea", "flaky pastry close-up", "golden fried pastry".

### Tier 3: Nano Banana Pro 2 (Gemini 2.5 Flash Image)
Use **only** for hero banner, section-header decor, "About" mood imagery. Never product shots. Keep brand palette prompts: navy `#1A2A4F`, mustard gold `#C89A2B`, cream `#F6EFE0`, red `#C8102E`.

> **Current status (2026-04-19):** Owner is deferring Nano Banana generation - hero banner and all decorative imagery will use **CSS-only branded placeholders** in v1. Owner will supply real hero/About images later and swap them in via admin.

### Placeholder spec for hero/decorative slots (v1)

Until the owner uploads real assets, render:

- **Hero banner:** Full-width cream (`#F6EFE0`) section with a subtle navy-to-gold diagonal gradient overlay at ~10% opacity. Centered: the Swiss Bakery emblem at 120px, then the wordmark (Playfair Display, navy, 48px), then the tagline "Handcrafted daily · Swiss soul, Bengali heart" (Playfair Display italic, gold, 20px), then a gold-outlined CTA button "View Menu". Minimum height 520px desktop / 380px mobile. No raster image at all - pure CSS.
- **About section image slot:** Cream card with the emblem watermarked at 10% opacity, centered text "Our story - coming soon", soft gold border.
- **Any other `<img>` that points at a non-existent file:** Fall back to a cream div with the gold Swiss cross icon + the alt text in navy Playfair.

This keeps the site fully render-able, brand-consistent, and zero-dependency on stock photography until the owner is ready.

---

## What the next AI session should do

1. Seed products from `data/products.seed.json` - every row now has an `imagePath` pointing at `/uploads/seed/{slug}.jpg`. See `public/uploads/seed/_attributions.json` for per-image source credit.
2. Wire the Express static middleware to serve `public/uploads/` at `/uploads/*` so the seeded paths resolve.
3. Build the upload flow (multer + MIME/size whitelist + sharp for WebP conversion) early, so owner can overwrite seed images with their own shots via admin without redeploy.
4. Add a **CC-BY-SA attribution line** to the site footer while seed images are in use: *"Some product imagery courtesy Wikimedia Commons contributors, used under CC-BY-SA."* Remove once owner's photos replace all seeds.

## 11. Known seed-image duplicates (replace these first)

Several slugs currently share the same source image - Wikipedia didn't have distinct articles for every variant, so the downloader fell back to a shared parent category. Prioritise owner's phone photos for these so each product gets a unique visual:

- **Patties:** `chicken-patty`, `paneer-patty`, `beef-patty`, `vegetable-patty` → all show the same Jamaican patty photo
- **Rolls:** `chicken-roll`, `beef-roll` → same Kati roll photo
- **Samosa family:** `samosa`, `veg-singara`, `liver-singara` → same samosa photo
- **Pitha family:** `pakon-pitha`, `narikel-puli`, `patishapta` → same pitha platter photo
- **Sandesh variants:** `monsor`, `kodom` → same sandesh photo

All other products have unique images.

---

## Photo checklist (hand this to the owner)

- [ ] 1 hero banner shot (wide, multiple items together, mood-y)
- [ ] 1 square photo per Savoury item (~18 shots)
- [ ] 1 square photo per Bakery item (~10 shots)
- [ ] 1 square photo per Sweet item (~14 shots)
- [ ] 1 chai shot for Malai Cha
- [ ] 1 shopfront / interior shot for About section
- [ ] Owner / staff at work (optional, but humanises the brand)

Shoot over 2–3 sessions during quiet mornings. Label files by slug (`chicken-patty.jpg`, `firni.jpg`) - the admin upload can auto-match them to products.
