import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SEED_JSON = path.join(REPO_ROOT, "data", "products.seed.json");

type SeedProduct = {
  slug: string;
  name: string;
  category: "Savoury" | "Bakery" | "Sweets" | "Beverages";
  priceCents: number | null;
  unit: string;
  description: string;
  imagePath: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
};

type SeedFile = { products: SeedProduct[] };

const defaultSettings: Record<string, string> = {
  address: "Shop 3/12 Minto Rd, Minto NSW 2566",
  phone: "+61 0452 626 232",
  email: "contact@swissbakery.com.au",
  hours: "Tue–Sun 8:00 am – 8:00 pm · Mon closed",
  mapEmbedUrl:
    "https://www.google.com/maps?q=Shop+3%2F12+Minto+Rd%2C+Minto+NSW+2566&output=embed",
  facebookUrl: "https://www.facebook.com/profile.php?id=61588443717316",
  instagramUrl: "",
  aboutText:
    "Swiss Bakery brings Swiss-trained patisserie and traditional Bengali sweets to Minto. Every pastry, sweet and bread is baked on-site - flaky patties in the morning, warm singaras in the afternoon, rasgulla and firni set fresh daily. Handcrafted, never shortcut - Swiss soul, Bengali heart.",
  gloriafoodCuid: "d769dc4e-b638-45f8-9298-ef8f8f550bec",
  gloriafoodRuid: "54e93b5e-2a23-4cad-b5c3-3fff8a2f5268",
};

const defaultPages = [
  {
    slug: "terms",
    title: "Terms & Conditions",
    content: `## 1. Who we are

Swiss Bakery ("we", "us", "our") is a retail bakery at Shop 3/12 Minto Rd, Minto NSW 2566, Australia. You can reach us on +61 0452 626 232 or contact@swissbakery.com.au.

## 2. Acceptance

By visiting this website, placing an order with us, or buying from our shop, you agree to these Terms. If you don't agree with any part of them, please don't use the site or place an order.

## 3. Our products

Everything we sell is baked fresh on-site. Daily availability varies — items may sell out through the day. We reserve the right to substitute or cancel items in the rare case of supply or kitchen issues; we'll let you know as soon as we can.

All prices are in Australian Dollars (AUD) and, unless stated otherwise, include GST. Prices can change at any time; the price that applies to your order is the one displayed when you place the order or agreed at the counter.

## 4. Allergens and food safety

Our kitchen handles wheat, dairy, eggs, nuts, sesame, and sulphites. While we take care to avoid cross-contact, **we cannot guarantee any item is free from trace allergens**. If you have a severe allergy, please speak to staff before ordering.

## 5. Ordering

**In-store:** walk in and order at the counter. Popular items (patties, sweets by the kilo) sell out early — we recommend phoning ahead for larger quantities.

**Phone orders:** call +61 0452 626 232 for pickup orders, catering trays, or custom sweets. We may request a deposit for large orders.

**Online ordering** (when available on this site) is handled via Oracle GloriaFood, an independent third-party service. GloriaFood's own terms and privacy policy apply to anything you enter into their widget.

## 6. Payment

We accept cash and contactless card payment in-store. Prepayment may be required for catering orders and large custom orders.

## 7. Collection

All orders are for in-store pickup at Shop 3/12 Minto Rd, Minto NSW 2566 unless explicitly arranged otherwise. Please collect within 24 hours — fresh items held longer may be discarded.

## 8. Catering and custom orders

Catering orders should be placed at least 48 hours in advance. Custom decorated cakes and large sweet trays may need 72+ hours notice. A non-refundable 20% deposit may be required.

Cancellations less than 24 hours before pickup may forfeit the deposit, at our discretion.

## 9. Refunds and your rights

Nothing in these Terms reduces your rights under the Australian Consumer Law. If an item we sold you is unsafe, not of acceptable quality, or not as described, you are entitled to a refund, replacement, or repair.

For issues with fresh items, please return them to the shop within 24 hours with your receipt. We'll make it right.

## 10. Intellectual property

The Swiss Bakery name, logo, product descriptions, website design, and photographs are our property or licensed to us. Some product imagery is used under CC-BY-SA 4.0 via Wikimedia Commons contributors and is credited accordingly. You may share links to our website freely. You may not copy, reproduce, or commercially reuse our content without our written permission.

## 11. Privacy

We handle any personal information you provide (name, phone, email for order confirmation) in line with the Australian Privacy Principles. We don't sell your details. For questions or requests about your data, email contact@swissbakery.com.au.

## 12. Liability

To the extent permitted by law, our total liability for any claim relating to our products or this website is limited to the purchase price of the item in question.

Nothing in these Terms excludes any consumer guarantee under the Australian Consumer Law that cannot be lawfully excluded.

## 13. Changes to these Terms

We may update these Terms from time to time. The version shown on this page is always current, with a "last updated" date above. Continuing to use the site or place orders after a change means you accept the update.

## 14. Governing law

These Terms are governed by the laws of New South Wales, Australia. Any dispute arising under them will be dealt with in the courts of New South Wales.

## 15. Contact

Questions about these Terms? Email contact@swissbakery.com.au or visit us at Shop 3/12 Minto Rd, Minto NSW 2566.
`,
    isPublished: true,
  },
];

const defaultHero = {
  heading: "Handcrafted daily · Swiss soul, Bengali heart",
  subheading:
    "European patisserie and traditional Bengali sweets, baked on-site in Minto since day one.",
  ctaLabel: "View Menu",
  ctaHref: "#menu",
  imagePath: null,
  isActive: true,
  sortOrder: 0,
};

async function main() {
  const raw = await readFile(SEED_JSON, "utf-8");
  const data = JSON.parse(raw) as SeedFile;

  let created = 0;
  let updated = 0;
  for (const p of data.products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        category: p.category,
        priceCents: p.priceCents,
        unit: p.unit,
        description: p.description,
        imagePath: p.imagePath,
        isFeatured: p.isFeatured,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
      },
      update: {
        name: p.name,
        category: p.category,
        priceCents: p.priceCents,
        unit: p.unit,
        description: p.description,
        imagePath: p.imagePath,
        isFeatured: p.isFeatured,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
      },
    });
    if (existing) updated++;
    else created++;
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await prisma.siteSetting.findUnique({ where: { key } });
    if (!existing) {
      await prisma.siteSetting.create({ data: { key, value } });
    } else if (existing.value.trim() === "" && value.trim() !== "") {
      // Backfill previously-blank settings with new defaults; never clobber
      // a value the admin has already set to something non-empty.
      await prisma.siteSetting.update({ where: { key }, data: { value } });
    }
  }

  const heroCount = await prisma.heroBanner.count();
  if (heroCount === 0) {
    await prisma.heroBanner.create({ data: defaultHero });
  }

  for (const page of defaultPages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: page,
      update: {}, // don't clobber admin edits on re-seed
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${data.products.length} products (${created} new, ${updated} updated), default hero + settings.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
