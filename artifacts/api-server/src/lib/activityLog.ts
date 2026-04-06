/**
 * Activity Ledger helper.
 * Call logActivity() anywhere a significant workflow event occurs.
 * Fire-and-forget — never await in a request handler; use void logActivity(...)
 * to avoid adding latency to the response path.
 */
import { db, activityLog } from "@workspace/db";
import { logger } from "./logger";
import { nowISO } from "./date";

export interface ActivityParams {
  userId?:     string | null;
  userName?:   string | null;
  userRole?:   string | null;
  region?:     string | null;
  action:      string;
  entityType?: string | null;
  entityId?:   string | null;
  meta?:       Record<string, unknown>;
}

export async function logActivity(params: ActivityParams): Promise<void> {
  try {
    const id = `al_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db.insert(activityLog).values({
      id,
      userId:     params.userId     ?? null,
      userName:   params.userName   ?? null,
      userRole:   params.userRole   ?? null,
      region:     params.region     ?? null,
      action:     params.action,
      entityType: params.entityType ?? null,
      entityId:   params.entityId   ?? null,
      meta:       params.meta       ?? {},
    });
  } catch (err) {
    logger.error({ err, action: params.action }, "activityLog: write failed");
  }
}
