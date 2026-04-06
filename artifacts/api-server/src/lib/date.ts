/**
 * Asia/Kolkata date utilities.
 * All date/time comparisons and "today" calculations in the backend
 * must go through this module — never use bare `new Date().toISOString().slice(0,10)`.
 *
 * Kolkata is UTC+5:30. We avoid adding a full date library dependency
 * and instead use the Intl API (V8 built-in) for all IST formatting.
 */

const IST = "Asia/Kolkata";

/**
 * Returns today's date in IST as a "YYYY-MM-DD" string.
 */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  }).format(new Date());
}

/**
 * Returns current wall-clock hour (0–23) in IST.
 */
export function hourIST(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    hour:     "numeric",
    hour12:   false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour");
  return h ? parseInt(h.value, 10) : new Date().getHours();
}

/**
 * Returns current wall-clock minute (0–59) in IST.
 */
export function minuteIST(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    minute:   "numeric",
  }).formatToParts(new Date());
  const m = parts.find((p) => p.type === "minute");
  return m ? parseInt(m.value, 10) : new Date().getMinutes();
}

/**
 * Parses an ISO timestamp (UTC) and returns its date in IST as "YYYY-MM-DD".
 */
export function toISTDate(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  }).format(d);
}

/**
 * Returns the current ISO-8601 timestamp (UTC) — use for DB writes.
 * Aliased here so imports stay single-source.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Hours elapsed since a given ISO timestamp.
 */
export function hoursSince(isoString: string | null | undefined): number {
  if (!isoString) return 0;
  return (Date.now() - new Date(isoString).getTime()) / 3_600_000;
}

/**
 * Days elapsed since a given ISO timestamp.
 */
export function daysSince(isoString: string | null | undefined): number {
  return hoursSince(isoString) / 24;
}

/**
 * Returns true if wall-clock time in IST is between 23:30 and 23:59.
 */
export function isAttendanceWindow(): boolean {
  return hourIST() === 23 && minuteIST() >= 30;
}
