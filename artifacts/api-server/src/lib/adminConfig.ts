/**
 * Admin config abstraction layer.
 *
 * Currently backed by app_state key "otv_adminConfig" (JSONB blob).
 * Designed to be swapped to a dedicated admin_config table in a future phase
 * by replacing only getAdminConfig() and setAdminConfig() — callers do not change.
 */

import { db, appStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AdminConfig {
  approvalThresholds: {
    RH:  number;   // paisa — deals above this go to RH for review
    NSH: number;
    CXO: number;
  };
  slaHours: {
    "Region Head":    number;
    NSH:              number;
    "Sales Strategy": number;
    CXO:              number;
    default:          number;
    [key: string]:    number;
  };
  inactivityDaysRisk:     number;
  inactivityDaysEscalate: number;
  webhookUrl:             string;
  platformLive:           boolean;
  launchDate:             string;
}

const DEFAULT_CONFIG: AdminConfig = {
  approvalThresholds: {
    RH:  5_000_000,    // ₹50L
    NSH: 10_000_000,   // ₹1Cr
    CXO: 30_000_000,   // ₹3Cr
  },
  slaHours: {
    "Region Head":    48,
    NSH:              48,
    "Sales Strategy": 48,
    CXO:              72,
    default:          48,
  },
  inactivityDaysRisk:     7,
  inactivityDaysEscalate: 14,
  webhookUrl:             "",
  platformLive:           true,
  launchDate:             "",
};

const CONFIG_KEY = "otv_adminConfig";

export async function getAdminConfig(): Promise<AdminConfig> {
  const rows = await db
    .select({ value: appStateTable.value })
    .from(appStateTable)
    .where(eq(appStateTable.key, CONFIG_KEY))
    .limit(1);

  if (rows.length === 0) return { ...DEFAULT_CONFIG };

  return { ...DEFAULT_CONFIG, ...(rows[0].value as Partial<AdminConfig>) };
}

export async function setAdminConfig(config: Partial<AdminConfig>): Promise<AdminConfig> {
  const current = await getAdminConfig();
  const next: AdminConfig = {
    ...current,
    ...config,
    // Deep-merge nested objects
    approvalThresholds: { ...current.approvalThresholds, ...config.approvalThresholds },
    slaHours:           { ...current.slaHours,           ...config.slaHours           },
  };

  await db
    .insert(appStateTable)
    .values({ key: CONFIG_KEY, value: next as object, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appStateTable.key,
      set:    { value: next as object, updatedAt: new Date() },
    });

  return next;
}

export async function resetAdminConfig(): Promise<AdminConfig> {
  await db
    .insert(appStateTable)
    .values({ key: CONFIG_KEY, value: DEFAULT_CONFIG as object, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appStateTable.key,
      set:    { value: DEFAULT_CONFIG as object, updatedAt: new Date() },
    });
  return { ...DEFAULT_CONFIG };
}
