import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { products, blogPosts, digitalProducts, affiliateProducts, membershipTiers } from "../db/schema.js";

const router = Router();

function numericId(value: string): number | null {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
}

const publicProductFields = {
  id: products.id,
  name: products.name,
  description: products.description,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  category: products.category,
  sizes: products.sizes,
  imageUrl: products.imageUrl,
  badge: products.badge,
  inStock: products.inStock,
  featured: products.featured,
  sortOrder: products.sortOrder,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};

const publicBlogListFields = {
  id: blogPosts.id,
  title: blogPosts.title,
  slug: blogPosts.slug,
  excerpt: blogPosts.excerpt,
  imageUrl: blogPosts.imageUrl,
  category: blogPosts.category,
  readTime: blogPosts.readTime,
  featured: blogPosts.featured,
  sortOrder: blogPosts.sortOrder,
  createdAt: blogPosts.createdAt,
  updatedAt: blogPosts.updatedAt,
};

const publicBlogPostFields = {
  ...publicBlogListFields,
  content: blogPosts.content,
};

const publicDigitalFields = {
  id: digitalProducts.id,
  name: digitalProducts.name,
  description: digitalProducts.description,
  price: digitalProducts.price,
  category: digitalProducts.category,
  productType: digitalProducts.productType,
  imageUrl: digitalProducts.imageUrl,
  fileName: digitalProducts.fileName,
  duration: digitalProducts.duration,
  badge: digitalProducts.badge,
  sortOrder: digitalProducts.sortOrder,
  createdAt: digitalProducts.createdAt,
  updatedAt: digitalProducts.updatedAt,
};

const publicAffiliateFields = {
  id: affiliateProducts.id,
  name: affiliateProducts.name,
  description: affiliateProducts.description,
  price: affiliateProducts.price,
  affiliateUrl: affiliateProducts.affiliateUrl,
  imageUrl: affiliateProducts.imageUrl,
  category: affiliateProducts.category,
  brand: affiliateProducts.brand,
  badge: affiliateProducts.badge,
  sortOrder: affiliateProducts.sortOrder,
  createdAt: affiliateProducts.createdAt,
  updatedAt: affiliateProducts.updatedAt,
};

const publicMembershipFields = {
  id: membershipTiers.id,
  name: membershipTiers.name,
  description: membershipTiers.description,
  price: membershipTiers.price,
  interval: membershipTiers.interval,
  features: membershipTiers.features,
  badge: membershipTiers.badge,
  sortOrder: membershipTiers.sortOrder,
  createdAt: membershipTiers.createdAt,
  updatedAt: membershipTiers.updatedAt,
};

// ─── Products ─────────────────────────────────────────────────────────────────
router.get("/products", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .select(publicProductFields)
      .from(products)
      .where(and(eq(products.published, true), eq(products.hidden, false), eq(products.delisted, false)))
      .orderBy(asc(products.sortOrder), asc(products.createdAt));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = numericId(req.params.id);
    if (id === null) { res.status(404).json({ error: "Not found" }); return; }
    const db = await getDb();
    const [row] = await db
      .select(publicProductFields)
      .from(products)
      .where(and(eq(products.id, id), eq(products.published, true), eq(products.hidden, false), eq(products.delisted, false)))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Blog ─────────────────────────────────────────────────────────────────────
router.get("/blog", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .select(publicBlogListFields)
      .from(blogPosts)
      .where(eq(blogPosts.published, true))
      .orderBy(asc(blogPosts.sortOrder), asc(blogPosts.createdAt));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/blog/:slug", async (req, res) => {
  try {
    const db = await getDb();
    const [row] = await db
      .select(publicBlogPostFields)
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, req.params.slug), eq(blogPosts.published, true)))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Digital Products ─────────────────────────────────────────────────────────
router.get("/digital", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .select(publicDigitalFields)
      .from(digitalProducts)
      .where(eq(digitalProducts.published, true))
      .orderBy(asc(digitalProducts.sortOrder), asc(digitalProducts.createdAt));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Affiliate Products ───────────────────────────────────────────────────────
router.get("/affiliate", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .select(publicAffiliateFields)
      .from(affiliateProducts)
      .where(eq(affiliateProducts.published, true))
      .orderBy(asc(affiliateProducts.sortOrder), asc(affiliateProducts.createdAt));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Membership Tiers ─────────────────────────────────────────────────────────
router.get("/memberships", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .select(publicMembershipFields)
      .from(membershipTiers)
      .where(eq(membershipTiers.published, true))
      .orderBy(asc(membershipTiers.sortOrder), asc(membershipTiers.createdAt));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
