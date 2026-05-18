import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";
import stripeRoutes from "./routes/stripe.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
]
  .filter(Boolean)
  .flatMap((origin) => {
    try {
      return [new URL(origin as string).origin];
    } catch {
      return [];
    }
  });

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    let requestOrigin: string;
    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      callback(new Error(`CORS: origin ${origin} not allowed`));
      return;
    }
    if (allowedOrigins.includes(requestOrigin)) {
      return callback(null, true);
    }
    // Allow all Cloudflare Pages preview URLs
    if (origin.endsWith(".pages.dev")) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Stripe webhook needs raw body ────────────────────────────────────────────
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/admin", adminRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api", publicRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`[Server] BUILD LEVEL backend running on port ${PORT}`);
});

export default app;
