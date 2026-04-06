/**
 * Ownership validation helper.
 *
 * Resolves and validates the rep/region for any write operation.
 * Rules by acting role:
 *
 *   SALES REP    — always session data; body values ignored entirely
 *   REGION HEAD  — body.repId must be an active SALES REP in RH's own region (DB-validated)
 *   Admin/Elevated — one of two modes:
 *       a) body.repId provided → must resolve to a real user in the DB (any role);
 *          if the user is a SALES REP, use their region.
 *          No silent fallback: unknown repId → 400.
 *       b) no body.repId → SELF-ACTION using the session user's own data.
 *          repId = user.repId (may be null for roles with no assigned repId).
 *
 * Returns { repId, region, name } or throws { status, error } for immediate 4xx response.
 * Callers should: try { owner = await resolveOwnership(...) } catch (e) { return res.status(e.status).json({ok:false,error:e.error}) }
 */
import { db, users } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface ResolvedOwner {
  repId:        number | null;   // null is valid for elevated roles acting in self-context
  region:       string;
  name:         string;
  isSelfAction: boolean;         // true when no rep is specified — elevated acting for themselves
}

export async function resolveOwnership(
  user: { id: string; role: string; repId: number | null; region: string | null; name: string },
  body: { repId?: number | null; region?: string | null; repName?: string | null },
): Promise<ResolvedOwner> {

  // ── SALES REP: always own session data — body ignored ────────────────────────
  if (user.role === "SALES REP") {
    return {
      repId:        user.repId ?? 0,
      region:       user.region ?? "",
      name:         user.name,
      isSelfAction: true,
    };
  }

  // ── REGION HEAD: body.repId is required; must be an active SALES REP ─────────
  if (user.role === "REGION HEAD") {
    const bodyRepId = body.repId ?? null;
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
      repId:        bodyRepId,
      region:       repUser[0].region ?? user.region ?? "",
      name:         repUser[0].name,
      isSelfAction: false,
    };
  }

  // ── Admin / Elevated roles ────────────────────────────────────────────────────
  const bodyRepId = body.repId ?? null;

  if (bodyRepId !== null && bodyRepId !== 0) {
    // bodyRepId was explicitly provided — it must resolve to a real user in the DB.
    // No silent fallback: if the repId doesn't exist we fail loudly.
    const targetUser = await db
      .select({ id: users.id, name: users.name, region: users.region, repId: users.repId, role: users.role })
      .from(users)
      .where(eq(users.repId, bodyRepId))
      .limit(1);

    if (!targetUser.length) {
      throw {
        status: 400,
        error:  `repId ${bodyRepId} does not correspond to any known user — cannot create record on their behalf`,
      };
    }

    return {
      repId:        targetUser[0].repId,
      region:       targetUser[0].region ?? body.region ?? user.region ?? "",
      name:         targetUser[0].name,
      isSelfAction: false,
    };
  }

  // ── Self-action: no bodyRepId supplied — elevated user acts for themselves ────
  // repId may be null for roles like CRO/SALES HEAD/ADMIN that have no assigned repId.
  return {
    repId:        user.repId,
    region:       body.region ?? user.region ?? "",
    name:         user.name,
    isSelfAction: true,
  };
}
