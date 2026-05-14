import seedJson from "../../../../data/products.seed.json" with { type: "json" };

export type SeedProduct = {
  slug: string;
  name: string;
  category: "Savoury" | "Bakery" | "Sweets" | "Beverages";
  priceCents: number | null;
  unit: string;
  qty?: number;
  description: string;
  imagePath: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type SeedFile = {
  _meta: Record<string, unknown>;
  products: SeedProduct[];
};

export const seed = seedJson as SeedFile;

export const CATEGORY_ORDER = [
  { key: "Savoury", label: "Savoury Bites", blurb: "Patties, rolls, samosas & more - baked and fried fresh through the day." },
  { key: "Bakery", label: "Bakery & Breads", blurb: "Short breads, buns, cream rolls and Bengali pithas from the oven." },
  { key: "Sweets", label: "Traditional Sweets", blurb: "Rasgulla, rosmalai, laddu and house-made mishti, by the kilo." },
  { key: "Beverages", label: "Beverages & Sides", blurb: "Malai cha, poro roti and seasonal sides - the perfect pairing." },
] as const;

export const featured: SeedProduct[] = seed.products
  .filter((p) => p.isFeatured && p.isActive)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export const byCategory = (cat: string): SeedProduct[] =>
  seed.products
    .filter((p) => p.category === cat && p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

// Plural form for the unit when qty > 1.
const pluralUnit = (unit: string): string => {
  if (unit === "piece") return "pcs";
  if (unit === "pack") return "packs";
  if (unit === "cup") return "cups";
  if (unit === "serve") return "serves";
  if (unit === "pound") return "pounds";
  return unit; // kg stays "kg"
};

// Full price + unit string, qty-aware:
//   qty=1, unit=piece  →  "$3.50"          (bare; unit shown separately on card)
//   qty=1, unit=kg     →  "$26/kg"
//   qty=5, unit=piece  →  "$7/5pcs"
//   qty=2, unit=kg     →  "$24/2kg"
export const formatPrice = (p: SeedProduct): string => {
  if (p.priceCents == null) return "Visit shop";
  const dollars = (p.priceCents / 100).toFixed(2).replace(/\.00$/, "");
  const qty = typeof p.qty === "number" && p.qty > 1 ? p.qty : 1;
  if (qty === 1) {
    return p.unit && p.unit !== "piece" ? `$${dollars}/${p.unit}` : `$${dollars}`;
  }
  return `$${dollars}/${qty}${pluralUnit(p.unit)}`;
};

// Render the internal unit slug as something a customer reads as a small label
// next to the price. For qty>1 the price string already encodes the unit, so
// the label is suppressed.
export const formatUnit = (p: SeedProduct): string => {
  const qty = typeof p.qty === "number" && p.qty > 1 ? p.qty : 1;
  if (qty > 1) return ""; // already in the price string (e.g. "/5pcs")
  return p.unit;
};

export const DEFAULT_SETTINGS = {
  address: "Shop 3/12 Minto Rd, Minto NSW 2566",
  phone: "+61 0452 626 232",
  phoneHref: "tel:+61452626232",
  email: "contact@swissbakery.com.au",
  emailHref: "mailto:contact@swissbakery.com.au",
  hours: "Tue–Sun 8:00 am – 8:00 pm · Mon closed",
  mapEmbedUrl:
    "https://www.google.com/maps?q=Shop+3%2F12+Minto+Rd%2C+Minto+NSW+2566&output=embed",
  facebookUrl: "https://www.facebook.com/profile.php?id=61588443717316",
  instagramUrl: "",
  aboutText:
    "Swiss Bakery brings Swiss-trained patisserie and traditional Bengali sweets to Minto. Every pastry, sweet and bread is baked on-site - flaky patties in the morning, warm singaras in the afternoon, rasgulla and firni set fresh daily. Handcrafted, never shortcut - Swiss soul, Bengali heart.",
  gloriafoodCuid: "d769dc4e-b638-45f8-9298-ef8f8f550bec",
  gloriafoodRuid: "54e93b5e-2a23-4cad-b5c3-3fff8a2f5268",
} as const;

export const DEFAULT_HERO = {
  heading: "Handcrafted daily · Swiss soul, Bengali heart",
  subheading:
    "European patisserie and traditional Bengali sweets, baked on-site in Minto since day one.",
  ctaLabel: "View Menu",
  ctaHref: "#menu",
  imagePath: null as string | null,
};

export const DEFAULT_NOTICE = {
  message: "",
  level: "info" as const,
  isActive: false,
};
