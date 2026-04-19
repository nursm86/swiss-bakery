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
  facebookUrl: "",
  instagramUrl: "",
  aboutText:
    "Swiss Bakery brings Swiss-trained patisserie and traditional Bengali sweets to Minto. Every pastry, sweet and bread is baked on-site - flaky patties in the morning, warm singaras in the afternoon, rasgulla and firni set fresh daily. Handcrafted, never shortcut - Swiss soul, Bengali heart.",
  gloriaFoodScriptSrc: "",
};

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
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }

  const heroCount = await prisma.heroBanner.count();
  if (heroCount === 0) {
    await prisma.heroBanner.create({ data: defaultHero });
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
