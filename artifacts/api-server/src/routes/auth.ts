import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { db, users, sessions, inviteTokens } from "@workspace/db";
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
const INVITE_TTL_MS     = 72 * 60 * 60 * 1000; // 72 h
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

/** Validate an invite token row. Returns the row if valid, or a rejection reason. */
async function validateInviteToken(
  token: string,
): Promise<{ ok: true; row: typeof inviteTokens.$inferSelect } | { ok: false; status: number; error: string }> {
  const rows = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.token, token))
    .limit(1);

  if (!rows.length) {
    return { ok: false, status: 403, error: "Invalid invite link. Please request a new one from an admin." };
  }
  const row = rows[0]!;
  if (row.usedAt !== null) {
    return { ok: false, status: 403, error: "This invite link has already been used." };
  }
  if (new Date() > row.expiresAt) {
    return { ok: false, status: 403, error: "This invite link has expired. Please request a new one." };
  }
  return { ok: true, row };
}

// ─── POST /api/auth/invite ────────────────────────────────────────────────────
// Admin-only. Generates a single-use invite link valid for 72 hours.
// Body: { email: string }
// Returns: { ok, token, inviteUrl, email, expiresAt }
router.post("/auth/invite", requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    return void res.status(400).json({ ok: false, error: "email is required" });
  }

  const lowerEmail = email.toLowerCase().trim();
  const token      = crypto.randomUUID();
  const expiresAt  = new Date(Date.now() + INVITE_TTL_MS);

  try {
    await db.insert(inviteTokens).values({
      token,
      email:     lowerEmail,
      createdBy: req.user!.id,
      expiresAt,
    });

    // Build invite URL: prefer REPLIT_DEV_DOMAIN (set in Replit hosted envs),
    // then X-Forwarded-Host (set by the Replit proxy), then Origin header,
    // then fall back to the raw host (which may be localhost:8080 in dev).
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;
    const origin = replitDomain
      ? `https://${replitDomain}`
      : forwardedHost
      ? `https://${forwardedHost}`
      : (req.headers.origin as string | undefined) || `${req.protocol}://${req.get("host")}`;
    const inviteUrl  = `${origin}?invite=${token}`;
    req.log.info({ origin, inviteUrl }, "invite URL built");

    res.json({ ok: true, token, inviteUrl, email: lowerEmail, expiresAt });
  } catch (err) {
    req.log.error({ err }, "invite create error");
    res.status(500).json({ ok: false, error: "Failed to create invite" });
  }
});

// ─── GET /api/auth/invite/:token ─────────────────────────────────────────────
// Public — no auth required. Called by the signup page to validate the token
// and pre-fill the email field before the user fills in the rest of the form.
// Returns: { ok: true, valid: true, email } or error JSON.
router.get("/auth/invite/:token", async (req, res) => {
  const token = String(req.params["token"]).trim();

  try {
    const result = await validateInviteToken(token);
    if (!result.ok) {
      return void res.status(result.status).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, valid: true, email: result.row.email });
  } catch (err) {
    req.log.error({ err }, "invite validate error");
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
// Requires a valid inviteToken in the request body (open self-signup is disabled).
// Validates the token, creates a pending user, then marks the token as used.
// Body: { name, email, password, inviteToken, phone?, designation?, intendedRole?, preferredRegion? }
router.post("/auth/signup", authLimiter, async (req, res) => {
  const { name, email, password, phone, designation, intendedRole, preferredRegion, inviteToken } =
    req.body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    res.status(400).json({ ok: false, error: "name, email and password are required" });
    return;
  }

  // ── Require invite token ──────────────────────────────────────────────────
  if (!inviteToken?.trim()) {
    res.status(403).json({ ok: false, error: "A valid invite link is required to sign up. Contact an admin." });
    return;
  }

  try {
    // ── Validate invite token ─────────────────────────────────────────────
    const tokenResult = await validateInviteToken(inviteToken.trim());
    if (!tokenResult.ok) {
      res.status(tokenResult.status).json({ ok: false, error: tokenResult.error });
      return;
    }
    const invite = tokenResult.row;

    // ── Check for existing account ────────────────────────────────────────
    const lowerEmail = email.toLowerCase().trim();

    const existing = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.email, lowerEmail))
      .limit(1);

    if (existing.length > 0) {
      const u = existing[0]!;
      if (u.status === "active") {
        res.status(409).json({ ok: false, error: "Email already registered. Please log in." });
      } else if (u.status === "pending") {
        res.status(409).json({ ok: false, error: "A request for this email is already pending admin approval." });
      } else {
        res.status(409).json({ ok: false, error: "This email has been revoked. Contact admin." });
      }
      return;
    }

    // ── Create user ───────────────────────────────────────────────────────
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

    // ── Mark token as used ────────────────────────────────────────────────
    await db
      .update(inviteTokens)
      .set({ usedAt: new Date() })
      .where(eq(inviteTokens.token, invite.token));

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

    const user = rows[0]!;

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
// Self-service profile update — any authenticated user may update their own
// name, region, and/or managerId. Used by the first-login setup wizard.
const VALID_REGIONS_ME = new Set([
  "North","South","East","West","National","Central",
  "West 1","West 2","Odisha","Digital",
]);
router.patch("/users/me", requireAuth, async (req, res) => {
  try {
    const u = req.user!;
    const { name, region, managerId } = req.body as {
      name?: string;
      region?: string;
      managerId?: number | null;
    };

    // At least one field must be provided.
    if (name === undefined && region === undefined && managerId === undefined) {
      return void res.status(400).json({ ok: false, error: "No update fields provided" });
    }

    // Validate provided fields.
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return void res.status(400).json({ ok: false, error: "name must be a non-empty string" });
    }
    if (region !== undefined && !VALID_REGIONS_ME.has(region)) {
      return void res.status(400).json({
        ok: false,
        error: `Invalid region. Must be one of: ${[...VALID_REGIONS_ME].join(", ")}`,
      });
    }
    if (managerId !== undefined && managerId !== null && !Number.isInteger(managerId)) {
      return void res.status(400).json({ ok: false, error: "managerId must be an integer or null" });
    }

    const patch: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined)      patch.name      = name.trim();
    if (region !== undefined)    patch.region    = region;
    if (managerId !== undefined) patch.managerId = managerId;

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, u.id))
      .returning({ id: users.id, name: users.name, region: users.region, role: users.role });

    if (!updated) return void res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, user: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "An internal error occurred" });
  }
});

export default router;
