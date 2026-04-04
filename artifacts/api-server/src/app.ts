import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS: restrict to the configured origin.
// ALLOWED_ORIGIN must be set in production (e.g. https://crm.odishatv.com).
// Falls back to localhost:5173 for local development only.
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no Origin header (same-origin, curl, mobile apps)
      if (!origin) return cb(null, true);
      if (origin === allowedOrigin) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }),
);

// ── Simple in-memory rate limiter ───────────────────────────────────────────
// Keeps a hit-count per IP per window. No external dependency required.
// Limits: login = 10 req/min, all others = 200 req/min.
interface RateWindow { count: number; resetAt: number }
const rateBuckets = new Map<string, RateWindow>();

function rateLimit(maxPerMin: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip  = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
              ?? req.socket.remoteAddress
              ?? "unknown";
    const key = `${ip}:${req.path}:${maxPerMin}`;
    const now = Date.now();

    let bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + 60_000 };
      rateBuckets.set(key, bucket);
    }
    bucket.count++;

    if (bucket.count > maxPerMin) {
      res.status(429).json({ ok: false, error: "Too many requests. Please wait a minute." });
      return;
    }
    next();
  };
}

// Prune stale buckets every 5 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) {
    if (now > v.resetAt) rateBuckets.delete(k);
  }
}, 5 * 60_000);

// Body size limit: 10 MB max to prevent DoS via oversized JSON blobs
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Strict limit on auth endpoints (brute-force protection)
app.use("/api/auth/login",   rateLimit(10));
app.use("/api/auth/signup",  rateLimit(10));
// General limit on all other API routes
app.use("/api", rateLimit(200));
app.use("/api", router);

export default app;
