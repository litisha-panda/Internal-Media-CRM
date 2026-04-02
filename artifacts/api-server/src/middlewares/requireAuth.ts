import { Request, Response, NextFunction } from "express";
import { db, sessions, users } from "@workspace/db";
import { eq, gt } from "drizzle-orm";

export interface AuthUser {
  id:      string;
  name:    string;
  email:   string;
  role:    string;
  region:  string | null;
  repId:   number | null;
  status:  string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.otv_session as string | undefined;

  if (!token) {
    res.status(401).json({ ok: false, error: "Not authenticated" });
    return;
  }

  try {
    const now = new Date();

    const rows = await db
      .select({
        userId:    sessions.userId,
        expiresAt: sessions.expiresAt,
        id:        users.id,
        name:      users.name,
        email:     users.email,
        role:      users.role,
        region:    users.region,
        repId:     users.repId,
        status:    users.status,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, token))
      .limit(1);

    if (rows.length === 0 || rows[0].expiresAt < now) {
      res.clearCookie("otv_session");
      res.status(401).json({ ok: false, error: "Session expired or invalid" });
      return;
    }

    const row = rows[0];

    if (row.status !== "active") {
      res.status(403).json({ ok: false, error: "Account is not active" });
      return;
    }

    req.user = {
      id:     row.id,
      name:   row.name,
      email:  row.email,
      role:   row.role,
      region: row.region,
      repId:  row.repId,
      status: row.status,
    };

    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: "Auth check failed" });
  }
}
