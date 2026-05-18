import { Router, Request, Response } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  products, blogPosts, digitalProducts, digitalPurchases, affiliateProducts,
  membershipTiers, siteSettings
} from "../db/schema.js";
import { requireAdmin, verifyAdminPassword, signAdminToken, ADMIN_COOKIE } from "../middleware/adminAuth.js";

const router = Router();

function insertedId(row: { id: number | bigint } | undefined): number {
  return row ? Number(row.id) : 0;
}

function parseId(value: string): number | null {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
}

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || !verifyAdminPassword(password)) {
    res.status(401).json({ success: false, error: "Invalid password" });
    return;
  }
  const token = signAdminToken();
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  // Also return token in body so frontend can use Authorization header
  // when cross-origin cookies are blocked
  res.json({ success: true, token });
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie(ADMIN_COOKIE);
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
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().optional().nullable(),
  category: z.string().default("apparel"),
  sizes: z.array(z.string()).default([]),
  imageUrl: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  inStock: z.boolean().default(true),
  published: z.boolean().default(false),
  hidden: z.boolean().default(false),
  delisted: z.boolean().default(false),
  featured: z.boolean().default(false),
  sortOrder: z.number().default(0),
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
      compareAtPrice: data.compareAtPrice ? String(data.compareAtPrice) : null,
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
    res.json({ success: true, id: insertedId(inserted) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = productSchema.partial().parse(req.body);
    const db = await getDb();
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    if (data.compareAtPrice !== undefined) updateData.compareAtPrice = data.compareAtPrice ? String(data.compareAtPrice) : null;
    await db.update(products).set(updateData).where(eq(products.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const db = await getDb();
    await db.delete(products).where(eq(products.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Blog Posts ───────────────────────────────────────────────────────────────
router.get("/blog", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(blogPosts).orderBy(asc(blogPosts.sortOrder), asc(blogPosts.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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
  sortOrder: z.number().default(0),
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
    res.json({ success: true, id: insertedId(inserted) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = blogSchema.partial().parse(req.body);
    const db = await getDb();
    await db.update(blogPosts).set({ ...data, updatedAt: new Date() }).where(eq(blogPosts.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/blog/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const db = await getDb();
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Digital Products ─────────────────────────────────────────────────────────
router.get("/digital", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(digitalProducts).orderBy(asc(digitalProducts.sortOrder), asc(digitalProducts.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const digitalSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
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
  sortOrder: z.number().default(0),
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
    res.json({ success: true, id: insertedId(inserted) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/digital/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = digitalSchema.partial().parse(req.body);
    const db = await getDb();
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    await db.update(digitalProducts).set(updateData).where(eq(digitalProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/digital/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const db = await getDb();
    await db.delete(digitalProducts).where(eq(digitalProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Site Settings ────────────────────────────────────────────────────────────
router.get("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(siteSettings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value ?? "";
    res.json(map);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    const db = await getDb();
    const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(siteSettings).set({ value, updatedAt: new Date() }).where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({ key, value, updatedAt: new Date() });
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ─── Affiliate Products ───────────────────────────────────────────────────────
const affiliateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive().optional().nullable(),
  affiliateUrl: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  category: z.string().default("gear"),
  brand: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  commission: z.string().optional().nullable(),
  published: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

router.get("/affiliate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(affiliateProducts).orderBy(asc(affiliateProducts.sortOrder), asc(affiliateProducts.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/affiliate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = affiliateSchema.parse(req.body);
    const db = await getDb();
    const [inserted] = await db.insert(affiliateProducts).values({
      name: data.name,
      description: data.description,
      price: data.price !== undefined && data.price !== null ? String(data.price) : null,
      affiliateUrl: data.affiliateUrl,
      imageUrl: data.imageUrl,
      category: data.category,
      brand: data.brand,
      badge: data.badge,
      commission: data.commission,
      published: data.published,
      sortOrder: data.sortOrder,
    }).$returningId();
    res.json({ success: true, id: insertedId(inserted) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/affiliate/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id as string);
    if (id === null) { res.status(404).json({ error: "Not found" }); return; }
    const data = affiliateSchema.partial().parse(req.body);
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = data.price !== null ? String(data.price) : null;
    const db = await getDb();
    await db.update(affiliateProducts).set(updateData).where(eq(affiliateProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/affiliate/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id as string);
    if (id === null) { res.status(404).json({ error: "Not found" }); return; }
    const db = await getDb();
    await db.delete(affiliateProducts).where(eq(affiliateProducts.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Membership Tiers ─────────────────────────────────────────────────────────
const membershipSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
  features: z.array(z.string()).default([]),
  badge: z.string().optional().nullable(),
  stripePriceId: z.string().optional().nullable(),
  published: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

router.get("/memberships", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(membershipTiers).orderBy(asc(membershipTiers.sortOrder), asc(membershipTiers.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    res.json({ success: true, id: insertedId(inserted) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put("/memberships/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id as string);
    if (id === null) { res.status(404).json({ error: "Not found" }); return; }
    const data = membershipSchema.partial().parse(req.body);
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    const db = await getDb();
    await db.update(membershipTiers).set(updateData).where(eq(membershipTiers.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/memberships/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id as string);
    if (id === null) { res.status(404).json({ error: "Not found" }); return; }
    const db = await getDb();
    await db.delete(membershipTiers).where(eq(membershipTiers.id, id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Admin Ecosystem Controls ─────────────────────────────────────────────────
const integrationCatalog = [
  { id: "shopify", label: "Shopify", env: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_ACCESS_TOKEN"] },
  { id: "printify", label: "Printify", env: ["PRINTIFY_API_KEY", "PRINTIFY_SHOP_ID"] },
  { id: "stripe", label: "Stripe", env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { id: "tidio", label: "Tidio AI", env: ["TIDIO_PUBLIC_KEY", "TIDIO_PRIVATE_KEY"] },
  { id: "paypal", label: "PayPal", env: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"] },
] as const;

function envStatus(names: readonly string[]) {
  return names.map((name) => ({ name, configured: Boolean(process.env[name]) }));
}

function integrationStatus() {
  return integrationCatalog.map((integration) => {
    const environment = envStatus(integration.env);
    const configured = environment.every((item) => item.configured);
    return {
      id: integration.id,
      label: integration.label,
      status: configured ? "ready" : "needs_configuration",
      configured,
      environment,
    };
  });
}

async function readSettings(prefix: string) {
  const db = await getDb();
  const rows = await db.select().from(siteSettings);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.startsWith(prefix)) settings[row.key.slice(prefix.length)] = row.value ?? "";
  }
  return settings;
}

async function upsertSettings(prefix: string, values: Record<string, unknown>) {
  const db = await getDb();
  for (const [key, rawValue] of Object.entries(values)) {
    const settingKey = `${prefix}${key}`;
    const value = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
    const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
    if (existing.length > 0) {
      await db.update(siteSettings).set({ value, updatedAt: new Date() }).where(eq(siteSettings.key, settingKey));
    } else {
      await db.insert(siteSettings).values({ key: settingKey, value, updatedAt: new Date() });
    }
  }
}

async function dashboardSnapshot() {
  const db = await getDb();
  const [productRows, blogRows, digitalRows, affiliateRows, membershipRows, purchaseRows] = await Promise.all([
    db.select().from(products),
    db.select().from(blogPosts),
    db.select().from(digitalProducts),
    db.select().from(affiliateProducts),
    db.select().from(membershipTiers),
    db.select().from(digitalPurchases),
  ]);
  const revenue = purchaseRows.length;
  return {
    metrics: {
      products: productRows.length,
      publishedProducts: productRows.filter((item) => item.published && !item.hidden && !item.delisted).length,
      posts: blogRows.length,
      digitalProducts: digitalRows.length,
      affiliateProducts: affiliateRows.length,
      membershipTiers: membershipRows.length,
      digitalOrders: purchaseRows.length,
      customerEmails: new Set(purchaseRows.map((purchase) => purchase.email).filter(Boolean)).size,
      revenueSignals: revenue,
    },
    integrations: integrationStatus(),
    updatedAt: new Date().toISOString(),
  };
}

router.get("/dashboard", requireAdmin, async (req: Request, res: Response) => {
  try { res.json(await dashboardSnapshot()); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/analytics/overview", requireAdmin, async (req: Request, res: Response) => {
  try { res.json(await dashboardSnapshot()); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/integrations", requireAdmin, (req: Request, res: Response) => {
  res.json(integrationStatus());
});

router.get("/integrations/:provider", requireAdmin, (req: Request, res: Response) => {
  const provider = integrationStatus().find((item) => item.id === req.params.provider);
  if (!provider) { res.status(404).json({ error: "Integration not found" }); return; }
  res.json(provider);
});

router.post("/integrations/:provider/test", requireAdmin, (req: Request, res: Response) => {
  const provider = integrationStatus().find((item) => item.id === req.params.provider);
  if (!provider) { res.status(404).json({ error: "Integration not found" }); return; }
  res.json({
    success: provider.configured,
    status: provider.status,
    message: provider.configured ? `${provider.label} is configured for server-side use.` : `${provider.label} is missing required environment variables.`,
  });
});

router.post("/sync/products", requireAdmin, (req: Request, res: Response) => {
  const syncSchema = z.object({ provider: z.enum(["shopify", "printify", "all"]).default("all"), mode: z.enum(["dry_run", "pull", "push"]).default("dry_run") });
  const request = syncSchema.parse(req.body ?? {});
  res.json({ success: true, queued: true, ...request, message: "Product sync control accepted by admin API." });
});

router.get("/inventory", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select({
      id: products.id,
      name: products.name,
      category: products.category,
      inStock: products.inStock,
      hidden: products.hidden,
      delisted: products.delisted,
      published: products.published,
      shopifyVariantId: products.shopifyVariantId,
      shopifyProductId: products.shopifyProductId,
      printifyProductId: products.printifyProductId,
      updatedAt: products.updatedAt,
    }).from(products).orderBy(asc(products.sortOrder), asc(products.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/orders", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.select().from(digitalPurchases).orderBy(desc(digitalPurchases.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/customers", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const purchases = await db.select().from(digitalPurchases).orderBy(desc(digitalPurchases.createdAt));
    const customers = new Map<string, { email: string; orders: number; lastOrderAt: Date | null }>();
    for (const purchase of purchases) {
      if (!purchase.email) continue;
      const current = customers.get(purchase.email) ?? { email: purchase.email, orders: 0, lastOrderAt: null };
      current.orders += 1;
      current.lastOrderAt = current.lastOrderAt && current.lastOrderAt > purchase.createdAt ? current.lastOrderAt : purchase.createdAt;
      customers.set(purchase.email, current);
    }
    res.json([...customers.values()]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/theme", requireAdmin, async (req: Request, res: Response) => {
  try { res.json(await readSettings("theme.")); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/theme", requireAdmin, async (req: Request, res: Response) => {
  try {
    await upsertSettings("theme.", z.record(z.unknown()).parse(req.body ?? {}));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get("/environment", requireAdmin, (req: Request, res: Response) => {
  res.json({
    runtime: process.env.NODE_ENV || "development",
    publicFrontend: Boolean(process.env.FRONTEND_URL),
    adminFrontend: Boolean(process.env.ADMIN_FRONTEND_URL),
    database: Boolean(process.env.DATABASE_URL),
    jwtSecret: Boolean(process.env.JWT_SECRET),
    adminPasswordHash: Boolean(process.env.ADMIN_PASSWORD_HASH),
    integrations: integrationStatus(),
  });
});

router.get("/automations", requireAdmin, async (req: Request, res: Response) => {
  try { res.json(await readSettings("automation.")); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/automations", requireAdmin, async (req: Request, res: Response) => {
  try {
    await upsertSettings("automation.", z.record(z.unknown()).parse(req.body ?? {}));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get("/notifications", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const productRows = await db.select().from(products);
    const missingIntegrations = integrationStatus().filter((item) => !item.configured);
    const outOfStock = productRows.filter((product) => !product.inStock && product.published);
    res.json([
      ...missingIntegrations.map((item) => ({ type: "integration", severity: "warning", title: `${item.label} needs configuration`, message: "Add the required server-side environment variables before enabling automation." })),
      ...outOfStock.map((product) => ({ type: "inventory", severity: "info", title: `${product.name} is out of stock`, message: "Review inventory before featuring this product." })),
    ]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


export default router;
