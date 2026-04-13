import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { db, users, sessions } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router = Router();

// ─── RATE LIMITER — login + signup ───────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:       15 * 60 * 1000, // 15 minutes
  max:            10,              // max 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { ok: false, error: "Too many attempts. Please try again in 15 minutes." },
});

const BCRYPT_ROUNDS     = 10;
const SESSION_TTL_MS    = 24 * 60 * 60 * 1000; // 24 h
const COOKIE_NAME       = "otv_session";
const DEMO_PASSWORD     = "demo123";

// ─── VALID ROLES ────────────────────────────────────────────────────────────
const ALL_ROLES = [
  "SALES REP","REGION HEAD","SALES HEAD","CRO",
  "SALES STRATEGY","DIGI OPS","ADMIN",
] as const;

// ─── HELPERS ────────────────────────────────────────────────────────────────
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function cookieOpts(expiresAt: Date) {
  return {
    httpOnly:  true,
    secure:    true,           // required for SameSite=None (proxy uses HTTPS externally)
    sameSite:  "none" as const, // allow cross-path/cross-site in Replit's proxy environment
    path:      "/",
    expires:   expiresAt,
  };
}

async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  // Purge expired sessions for this user (housekeeping)
  await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()));

  const token     = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ token, userId, expiresAt });

  return { token, expiresAt };
}

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
// Creates a pending user (requires admin approval before they can log in)
router.post("/auth/signup", authLimiter, async (req, res) => {
  const { name, email, password, phone, designation, intendedRole, preferredRegion } =
    req.body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    res.status(400).json({ ok: false, error: "name, email and password are required" });
    return;
  }

  const lowerEmail = email.toLowerCase().trim();

  try {
    const existing = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.email, lowerEmail))
      .limit(1);

    if (existing.length > 0) {
      const u = existing[0];
      if (u.status === "active") {
        res.status(409).json({ ok: false, error: "Email already registered. Please log in." });
      } else if (u.status === "pending") {
        res.status(409).json({ ok: false, error: "A request for this email is already pending admin approval." });
      } else {
        res.status(409).json({ ok: false, error: "This email has been revoked. Contact admin." });
      }
      return;
    }

    const role = intendedRole && (ALL_ROLES as readonly string[]).includes(intendedRole)
      ? intendedRole
      : "SALES REP";

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [created] = await db
      .insert(users)
      .values({
        name:         name.trim(),
        email:        lowerEmail,
        passwordHash,
        role,
        region:       preferredRegion || null,
        status:       "pending",
        needsPwReset: false,
      })
      .returning({ id: users.id, name: users.name, email: users.email, status: users.status });

    res.status(201).json({
      ok:      true,
      message: "Signup request submitted. Awaiting admin approval.",
      user:    created,
    });
  } catch (err) {
    req.log.error({ err }, "signup error");
    res.status(500).json({ ok: false, error: "Signup failed" });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post("/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password?.trim()) {
    res.status(400).json({ ok: false, error: "email and password are required" });
    return;
  }

  const lowerEmail = email.toLowerCase().trim();

  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, lowerEmail))
      .limit(1);

    if (rows.length === 0) {
      res.status(401).json({ ok: false, error: "No account found for that email" });
      return;
    }

    const user = rows[0];

    if (user.status === "pending") {
      res.status(403).json({ ok: false, error: "pending", message: "Account pending admin approval" });
      return;
    }

    if (user.status === "revoked") {
      res.status(403).json({ ok: false, error: "revoked", message: "Account access has been revoked" });
      return;
    }

    // SHA-256 bridge removed — affected users must reset password.
    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      res.status(401).json({ ok: false, error: "Incorrect password" });
      return;
    }

    const { token, expiresAt } = await createSession(user.id);

    res.cookie(COOKIE_NAME, token, cookieOpts(expiresAt));

    // Also return token in body — allows clients to use X-Session-Token header
    // as a fallback when cookie-based auth is unreliable (e.g. Replit proxy env)
    res.json({
      ok:    true,
      token, // client stores in localStorage, sends as X-Session-Token header
      user: {
        id:     user.id,
        name:   user.name,
        email:  user.email,
        role:   user.role,
        region: user.region,
        repId:  user.repId,
      },
    });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ ok: false, error: "Login failed" });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/auth/logout", async (req, res) => {
  // Accept token from cookie OR X-Session-Token header
  const token = (req.cookies?.[COOKIE_NAME] as string | undefined)
    || (req.headers["x-session-token"] as string | undefined);

  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      // best-effort
    }
  }

  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ─── POST /api/auth/seed-demo ────────────────────────────────────────────────
// Seeds all demo accounts into the users table.
// Safe to call multiple times — upserts on email.
// Only callable if: no users exist yet OR by an already-authenticated ADMIN.
router.post("/auth/seed-demo", async (req, res) => {
  if (process.env.NODE_ENV === "production") return void res.status(404).end();
  try {
    const existing = await db
      .select({ count: users.id })
      .from(users)
      .limit(1);

    // Allow re-seeding only if table is empty OR if caller is an authenticated admin
    const callerIsAdmin =
      req.cookies?.[COOKIE_NAME] &&
      req.user?.role === "ADMIN";

    if (existing.length > 0 && !callerIsAdmin) {
      res.status(403).json({
        ok:    false,
        error: "Users already exist. Must be authenticated as ADMIN to re-seed.",
      });
      return;
    }

    const hash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

    const demoUsers: Array<{
      name: string; email: string; role: string;
      region?: string; repId?: number;
    }> = [
      // ── Management ───────────────────────────────────────────────────────
      { name: "Admin",                   email: "admin@odishatv.com",      role: "ADMIN"          },
      { name: "Darpan (CRO)",            email: "darpan@odishatv.com",     role: "CRO"            },
      { name: "Sales Head (NSH)",        email: "saleshead@odishatv.com",  role: "SALES HEAD"     },
      { name: "Sachin (Sales Strategy)", email: "sachin@odishatv.com",     role: "SALES STRATEGY" },
      { name: "Digi Ops Team",           email: "digiops@odishatv.com",    role: "DIGI OPS"       },
      // ── Region Heads ─────────────────────────────────────────────────────
      { name: "Region Head – North",     email: "rh.north@odishatv.com",   role: "REGION HEAD",   region: "North"    },
      { name: "Region Head – South",     email: "rh.south@odishatv.com",   role: "REGION HEAD",   region: "South"    },
      { name: "Region Head – East",      email: "rh.east@odishatv.com",    role: "REGION HEAD",   region: "East"     },
      { name: "Region Head – West",      email: "rh.west@odishatv.com",    role: "REGION HEAD",   region: "West"     },
      { name: "Region Head – National",  email: "rh.national@odishatv.com",role: "REGION HEAD",   region: "National" },
      { name: "Region Head – Central",   email: "rh.central@odishatv.com", role: "REGION HEAD",   region: "Central"  },
      // ── Sales Reps (key demo accounts) ───────────────────────────────────
      { name: "Arjun Mishra",    email: "arjun@odishatv.com",   role: "SALES REP", region: "North",    repId: 1  },
      { name: "Priya Dash",      email: "priya@odishatv.com",   role: "SALES REP", region: "South",    repId: 2  },
      { name: "Rohit Nanda",     email: "rohit@odishatv.com",   role: "SALES REP", region: "East",     repId: 3  },
      { name: "Sneha Patel",     email: "sneha@odishatv.com",   role: "SALES REP", region: "West",     repId: 4  },
      { name: "Vikram Sen",      email: "vikram@odishatv.com",  role: "SALES REP", region: "National", repId: 5  },
      { name: "Meera Rao",       email: "meera@odishatv.com",   role: "SALES REP", region: "South",    repId: 6  },
      { name: "Rahul Sharma",    email: "rahul@odishatv.com",   role: "SALES REP", region: "North",    repId: 7  },
      { name: "Kavya Singh",     email: "kavya@odishatv.com",   role: "SALES REP", region: "North",    repId: 8  },
      { name: "Manish Tiwari",   email: "manish@odishatv.com",  role: "SALES REP", region: "North",    repId: 9  },
      { name: "Pooja Agarwal",   email: "pooja@odishatv.com",   role: "SALES REP", region: "North",    repId: 10 },
    ];

    const results: string[] = [];

    for (const u of demoUsers) {
      await db
        .insert(users)
        .values({
          name:         u.name,
          email:        u.email,
          passwordHash: hash,
          role:         u.role,
          region:       u.region ?? null,
          repId:        u.repId ?? null,
          status:       "active",
          needsPwReset: false,
        })
        .onConflictDoUpdate({
          target:  users.email,
          set: {
            name:         u.name,
            passwordHash: hash,
            role:         u.role,
            region:       u.region ?? null,
            repId:        u.repId ?? null,
            status:       "active",
            needsPwReset: false,
            updatedAt:    new Date(),
          },
        });
      results.push(u.email);
    }

    res.json({
      ok:      true,
      seeded:  results.length,
      users:   results,
      note:    `All demo users have password: "${DEMO_PASSWORD}"`,
    });
  } catch (err) {
    req.log.error({ err }, "seed-demo error");
    res.status(500).json({ ok: false, error: "Seed failed" });
  }
});

// ─── PATCH /api/users/me ─────────────────────────────────────────────────────
// Self-service region update. SALES REP only — region is not an auth boundary for reps.
// Region Heads and above must have their region changed by an Admin (region is their
// authorization scope and self-reassignment would widen cross-region data access).
const VALID_REGIONS_SET = new Set(["North","South","East","West","National","Central"]);
router.patch("/users/me", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    // Only SALES REP may self-update their region. All other roles are denied.
    if (u.role !== "SALES REP") {
      return void res.status(403).json({
        ok:    false,
        error: "Only Sales Reps may use this endpoint. Other roles require an Admin to update their region.",
      });
    }
    const { region } = req.body as { region?: string };
    if (!region || !VALID_REGIONS_SET.has(region)) {
      return void res.status(400).json({
        ok: false,
        error: `region must be one of: North, South, East, West, National, Central`,
      });
    }
    const [updated] = await db
      .update(users)
      .set({ region, updatedAt: new Date() })
      .where(eq(users.id, u.id))
      .returning({ id: users.id, region: users.region, role: users.role, name: users.name });

    if (!updated) return void res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, user: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

export default router;
