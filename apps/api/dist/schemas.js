import { z } from "zod";
export const loginSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(200),
});
export const productCreateSchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(120)
        .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and hyphens only"),
    name: z.string().min(1).max(200),
    category: z.enum(["Savoury", "Bakery", "Sweets", "Beverages"]),
    priceCents: z.number().int().nonnegative().nullable().optional(),
    unit: z.enum(["piece", "pack", "kg", "cup"]).default("piece"),
    description: z.string().max(1000).nullable().optional(),
    imagePath: z.string().max(500).nullable().optional(),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
});
export const productUpdateSchema = productCreateSchema.partial();
export const heroCreateSchema = z.object({
    heading: z.string().min(1).max(200),
    subheading: z.string().max(300).nullable().optional(),
    ctaLabel: z.string().max(60).nullable().optional(),
    ctaHref: z.string().max(500).nullable().optional(),
    imagePath: z.string().max(500).nullable().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
});
export const heroUpdateSchema = heroCreateSchema.partial();
export const noticeUpsertSchema = z.object({
    message: z.string().min(1).max(1000),
    level: z.enum(["info", "promo", "alert"]).default("info"),
    isActive: z.boolean().default(false),
    startsAt: z
        .string()
        .datetime()
        .nullable()
        .optional()
        .transform((v) => (v ? new Date(v) : null)),
    endsAt: z
        .string()
        .datetime()
        .nullable()
        .optional()
        .transform((v) => (v ? new Date(v) : null)),
});
const settingKey = z.enum([
    "address",
    "phone",
    "email",
    "hours",
    "mapEmbedUrl",
    "facebookUrl",
    "instagramUrl",
    "aboutText",
    "gloriafoodCuid",
    "gloriafoodRuid",
]);
export const pageCreateSchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and hyphens only"),
    title: z.string().min(1).max(200),
    content: z.string().max(50_000),
    isPublished: z.boolean().default(true),
});
export const pageUpdateSchema = pageCreateSchema.partial();
export const settingsUpdateSchema = z
    .array(z.object({
    key: settingKey,
    value: z.string().max(5000),
}))
    .min(1)
    .max(20);
export const PUBLIC_SETTING_KEYS = [
    "address",
    "phone",
    "email",
    "hours",
    "mapEmbedUrl",
    "facebookUrl",
    "instagramUrl",
    "aboutText",
    "gloriafoodCuid",
    "gloriafoodRuid",
];
