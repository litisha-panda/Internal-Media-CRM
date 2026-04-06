/**
 * Notification helper.
 * createNotification() is fire-and-forget — use void createNotification(...).
 */
import { db, notifications } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "./logger";

export interface NotificationParams {
  userId:     string;
  type:       string;
  title:      string;
  body?:      string;
  entityType?: string;
  entityId?:  string;
}

export async function createNotification(params: NotificationParams): Promise<void> {
  try {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await db.insert(notifications).values({
      id,
      userId:     params.userId,
      type:       params.type,
      title:      params.title,
      body:       params.body      ?? null,
      entityType: params.entityType ?? null,
      entityId:   params.entityId  ?? null,
      read:       false,
    });
  } catch (err) {
    logger.error({ err, type: params.type }, "notifications: write failed");
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(id: string): Promise<void> {
  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  } catch (err) {
    logger.error({ err, id }, "notifications: markRead failed");
  }
}
