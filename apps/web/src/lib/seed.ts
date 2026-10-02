import seedJson from "../../../../data/products.seed.json" with { type: "json" };

export type SeedProduct = {
  slug: string;
  name: string;
  category: string;
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

export const featured: SeedProduct[] = seed.products
  .filter((p) => p.isFeatured && p.isActive)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export const byCategory = (cat: string): SeedProduct[] =>
  seed.products
    .filter((p) => p.category === cat && p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

export const DEFAULT_SETTINGS = {
  address: "Shop 3/12 Minto Rd, Minto NSW 2566",
  phone: "+61 0452 626 232",
  phoneHref: "tel:+61452626232",
  shopPhone: "02 7245 4418",
  shopPhoneHref: "tel:0272454418",
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
