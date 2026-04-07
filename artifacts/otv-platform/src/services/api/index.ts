/**
 * services/api/index.ts — Re-exports all API service modules.
 *
 * Import individual modules directly for tree-shaking; use this barrel
 * only when you need multiple domains in one import.
 */

export * from "./_client";
export * as authApi     from "./auth";
export * as meetingsApi from "./meetings";
export * as tpApi       from "./touchpoints";
export * as tasksApi    from "./tasks";
export * as irApi       from "./internalRequests";
export * as attendApi   from "./attendance";
export * as dealsApi    from "./deals";
export * as revenueApi  from "./revenue";
export * as adminApi    from "./admin";

// Named re-exports for common utilities
export { getSessionToken, setSessionToken, authHeaders, ApiError } from "./_client";
