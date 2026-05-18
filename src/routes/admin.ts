import { Router, Request, Response } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  products, blogPosts, digitalProducts, affiliateProducts,
  membershipTiers, siteSettings
} from "../db/schema.js";
import { requireAdmin, verifyAdminPassword, signAdminToken, ADMIN_COOKIE } from "../middleware/adminAuth.js";

const router = Router();
const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
} as const;
const adminCookieClearOptions = {
  httpOnly: adminCookieOptions.httpOnly,
  secure: adminCookieOptions.secure,
  sameSite: adminCookieOptions.sameSite,
} as const;

function parsePositiveId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid id");
  }
  return id;
}

function formatError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(issue => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "Request failed";
}

function sendBadRequest(res: Response, error: unknown) {
  res.status(400).json({ error: formatError(error) });
}

function sendServerError(res: Response, error: unknown) {
  res.status(500).json({ error: formatError(error) });
}

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || !verifyAdminPassword(password)) {
    res.status(401).json({ success: false, error: "Invalid password" });
    return;
  }
  const token = signAdminToken();
  res.cookie(ADMIN_COOKIE, token, adminCookieOptions);
  // Also return token in body so frontend can use Authorization header
  // when cross-origin cookies are blocked
  res.json({ success: true, token });
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie(ADMIN_COOKIE, adminCookieClearOptions);
  res.json({ success: true });
});

router.get("/me", requireAdmin, (req: Request, res: Response) => {
  res.json({ admin: true });
});

// ─── Products ─────────────────────────────────────────────────────────────────
router.get("/products", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.createdAt));
    res.json(rows);
  } catch (e: any) { sendServerError(res, e); }
});

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional().nullable(),
  category: z.string().default("apparel"),
  sizes: z.array(z.string()).default([]),
  imageUrl: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  inStock: z.boolean().default(true),
  published: z.boolean().default(false),
  hidden: z.boolean().default(false),
  delisted: z.boolean().default(false),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  shopifyVariantId: z.string().optional().nullable(),
  shopifyProductId: z.string().optional().nullable(),
  printifyProductId: z.string().optional().nullable(),
});

router.post("/products", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = productSchema.parse(req.body);
    const db = await getDb();
    const [inserted] = await db.insert(products).values({
      name: data.name,
      description: data.description,
      price: String(data.price),
      compareAtPrice: data.compareAtPrice != null ? String(data.compareAtPrice) : null,
      category: data.category,
      sizes: data.sizes,
      imageUrl: data.imageUrl,
      badge: data.badge,
      inStock: data.inStock,
      published: data.published,
      hidden: data.hidden,
      delisted: data.delisted,
      featured: data.featured,
      sortOrder: data.sortOrder,
      shopifyVariantId: data.shopifyVariantId,
      shopifyProductId: data.shopifyProductId,
      printifyProductId: data.printifyProductId,
    }).$returningId();
    res.json({ success: true, id: inserted?.id ?? 0 });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.put("/products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const data = productSchema.partial().parse(req.body);
    const db = await getDb();
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    if (data.compareAtPrice !== undefined) updateData.compareAtPrice = data.compareAtPrice != null ? String(data.compareAtPrice) : null;
    await db.update(products).set(updateData).where(eq(products.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.delete("/products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const db = await getDb();
    await db.delete(products).where(eq(products.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

// ─── Blog Posts ───────────────────────────────────────────────────────────────
router.get("/blog", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(blogPosts).orderBy(asc(blogPosts.sortOrder), asc(blogPosts.createdAt));
    res.json(rows);
  } catch (e: any) { sendServerError(res, e); }
});

const blogSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  category: z.string().default("mindset"),
  readTime: z.string().optional(),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

router.post("/blog", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = blogSchema.parse(req.body);
    const db = await getDb();
    const [inserted] = await db.insert(blogPosts).values({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      imageUrl: data.imageUrl,
      category: data.category,
      readTime: data.readTime,
      published: data.published,
      featured: data.featured,
      sortOrder: data.sortOrder,
    }).$returningId();
    res.json({ success: true, id: inserted?.id ?? 0 });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.put("/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const data = blogSchema.partial().parse(req.body);
    const db = await getDb();
    await db.update(blogPosts).set({ ...data, updatedAt: new Date() }).where(eq(blogPosts.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.delete("/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const db = await getDb();
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

// ─── Digital Products ─────────────────────────────────────────────────────────
router.get("/digital", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(digitalProducts).orderBy(asc(digitalProducts.sortOrder), asc(digitalProducts.createdAt));
    res.json(rows);
  } catch (e: any) { sendServerError(res, e); }
});

const digitalSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  category: z.string().default("guide"),
  productType: z.enum(["pdf", "audiobook", "video", "other"]).default("pdf"),
  imageUrl: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  audioUrl: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  stripePaymentLink: z.string().optional().nullable(),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

router.post("/digital", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = digitalSchema.parse(req.body);
    const db = await getDb();
    const [inserted] = await db.insert(digitalProducts).values({
      name: data.name,
      description: data.description,
      price: String(data.price),
      category: data.category,
      productType: data.productType,
      imageUrl: data.imageUrl,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      audioUrl: data.audioUrl,
      duration: data.duration,
      badge: data.badge,
      stripePaymentLink: data.stripePaymentLink,
      published: data.published,
      sortOrder: data.sortOrder,
    }).$returningId();
    res.json({ success: true, id: inserted?.id ?? 0 });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.put("/digital/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const data = digitalSchema.partial().parse(req.body);
    const db = await getDb();
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    await db.update(digitalProducts).set(updateData).where(eq(digitalProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.delete("/digital/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const db = await getDb();
    await db.delete(digitalProducts).where(eq(digitalProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

// ─── Affiliate Products ───────────────────────────────────────────────────────
router.get("/affiliate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(affiliateProducts).orderBy(asc(affiliateProducts.sortOrder), asc(affiliateProducts.createdAt));
    res.json(rows);
  } catch (e: any) { sendServerError(res, e); }
});

const affiliateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive().optional().nullable(),
  affiliateUrl: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  category: z.string().default("gear"),
  brand: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  commission: z.string().optional().nullable(),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

router.post("/affiliate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = affiliateSchema.parse(req.body);
    const db = await getDb();
    const [inserted] = await db.insert(affiliateProducts).values({
      name: data.name,
      description: data.description,
      price: data.price != null ? String(data.price) : null,
      affiliateUrl: data.affiliateUrl,
      imageUrl: data.imageUrl,
      category: data.category,
      brand: data.brand,
      badge: data.badge,
      commission: data.commission,
      published: data.published,
      sortOrder: data.sortOrder,
    }).$returningId();
    res.json({ success: true, id: inserted?.id ?? 0 });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.put("/affiliate/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const data = affiliateSchema.partial().parse(req.body);
    const db = await getDb();
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = data.price != null ? String(data.price) : null;
    await db.update(affiliateProducts).set(updateData).where(eq(affiliateProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.delete("/affiliate/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const db = await getDb();
    await db.delete(affiliateProducts).where(eq(affiliateProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

// ─── Membership Tiers ─────────────────────────────────────────────────────────
router.get("/memberships", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(membershipTiers).orderBy(asc(membershipTiers.sortOrder), asc(membershipTiers.createdAt));
    res.json(rows);
  } catch (e: any) { sendServerError(res, e); }
});

const membershipSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
  features: z.array(z.string()).default([]),
  badge: z.string().optional().nullable(),
  stripePriceId: z.string().optional().nullable(),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

router.post("/memberships", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = membershipSchema.parse(req.body);
    const db = await getDb();
    const [inserted] = await db.insert(membershipTiers).values({
      name: data.name,
      description: data.description,
      price: String(data.price),
      interval: data.interval,
      features: data.features,
      badge: data.badge,
      stripePriceId: data.stripePriceId,
      published: data.published,
      sortOrder: data.sortOrder,
    }).$returningId();
    res.json({ success: true, id: inserted?.id ?? 0 });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.put("/memberships/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const data = membershipSchema.partial().parse(req.body);
    const db = await getDb();
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    await db.update(membershipTiers).set(updateData).where(eq(membershipTiers.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

router.delete("/memberships/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parsePositiveId(req.params.id as string);
    const db = await getDb();
    await db.delete(membershipTiers).where(eq(membershipTiers.id, id));
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

// ─── Site Settings ────────────────────────────────────────────────────────────
router.get("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(siteSettings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value ?? "";
    res.json(map);
  } catch (e: any) { sendServerError(res, e); }
});

const settingSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string().nullable().default(""),
});

router.post("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, value } = settingSchema.parse(req.body);
    const db = await getDb();
    await db.insert(siteSettings)
      .values({ key, value, updatedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e: any) { sendBadRequest(res, e); }
});

export default router;
