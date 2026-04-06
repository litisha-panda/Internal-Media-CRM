/**
 * Ownership validation helper.
 *
 * Resolves and validates the rep/region for any write operation.
 * Different rules apply per acting role:
 *
 *   SALES REP    — always session data; body values ignored
 *   REGION HEAD  — body.repId must be an active SALES REP in the RH's own region
 *   ADMIN        — body.repId must exist in DB; body.region trusted
 *   Elevated     — body.repId must exist in DB; body.region trusted
 *
 * Returns { repId, region, name } or throws { status, error } for immediate 4xx response.
 */
import { db, users } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface ResolvedOwner {
  repId:  number;
  region: string;
  name:   string;
}

export async function resolveOwnership(
  user: { id: string; role: string; repId: number | null; region: string | null; name: string },
  body: { repId?: number | null; region?: string | null; repName?: string | null },
): Promise<ResolvedOwner> {

  // ── SALES REP: always own session data ──────────────────────────────────────
  if (user.role === "SALES REP") {
    return {
      repId:  user.repId ?? 0,
      region: user.region ?? "",
      name:   user.name,
    };
  }

  // ── REGION HEAD: validate the target rep belongs to their region ─────────────
  if (user.role === "REGION HEAD") {
    const bodyRepId = body.repId ?? user.repId;
    if (!bodyRepId) {
      throw { status: 400, error: "repId is required for Region Head on-behalf actions" };
    }

    const repUser = await db
      .select({ id: users.id, name: users.name, region: users.region, repId: users.repId })
      .from(users)
      .where(
        and(
          eq(users.repId,  bodyRepId),
          eq(users.role,   "SALES REP"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    if (!repUser.length) {
      throw { status: 403, error: `Rep ${bodyRepId} is not an active SALES REP` };
    }

    if (repUser[0].region !== user.region) {
      throw {
        status: 403,
        error:  `Rep ${bodyRepId} belongs to region "${repUser[0].region}", not your region "${user.region}"`,
      };
    }

    return {
      repId:  bodyRepId,
      region: repUser[0].region ?? user.region ?? "",
      name:   repUser[0].name,
    };
  }

  // ── Admin / Elevated roles: body.repId must exist, body.region trusted ──────
  const bodyRepId = body.repId ?? user.repId;
  if (bodyRepId) {
    const repUser = await db
      .select({ id: users.id, name: users.name, region: users.region, repId: users.repId })
      .from(users)
      .where(and(eq(users.repId, bodyRepId), eq(users.role, "SALES REP")))
      .limit(1);

    if (!repUser.length) {
      // Non-reps (e.g. REGION HEAD logging a Relationship touchpoint) — fall back
      return {
        repId:  bodyRepId,
        region: body.region ?? user.region ?? "",
        name:   body.repName ?? user.name,
      };
    }

    return {
      repId:  bodyRepId,
      region: repUser[0].region ?? body.region ?? user.region ?? "",
      name:   repUser[0].name,
    };
  }

  // Fallback — no repId provided
  return {
    repId:  0,
    region: body.region ?? user.region ?? "",
    name:   body.repName ?? user.name,
  };
}
