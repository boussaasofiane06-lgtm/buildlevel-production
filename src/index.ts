import "dotenv/config";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pathToFileURL } from "url";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";
import stripeRoutes from "./routes/stripe.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean).map(origin => {
  try {
    return new URL(origin as string).origin;
  } catch {
    return (origin as string).replace(/\/$/, "");
  }
});

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return allowedOrigins.includes(url.origin) || url.hostname.endsWith(".pages.dev");
  } catch {
    return allowedOrigins.includes(origin.replace(/\/$/, ""));
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
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
app.use("/api", publicRoutes);
app.use("/api/stripe", stripeRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = message.startsWith("CORS:") ? 403 : 500;
  res.status(status).json({ error: message });
};

app.use(errorHandler);

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`[Server] BUILD LEVEL backend running on port ${PORT}`);
  });
}

export default app;
