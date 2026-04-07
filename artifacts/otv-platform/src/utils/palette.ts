/** Shared design tokens — keep in sync with CROApp palette in OTVApp.tsx */
export const C = {
  bg:      "#f0f4f9",
  surface: "#ffffff",
  s2:      "#e8eef7",
  s3:      "#dde5f0",
  border:  "#c8d3e5",
  accent:  "#c47d00",
  green:   "#15803d",
  red:     "#c92828",
  blue:    "#1d5db4",
  purple:  "#7920e8",
  orange:  "#c24000",
  text:    "#18243a",
  dim:     "#4d5e78",
  muted:   "#8a97ae",
};

export const TODAY    = new Date().toISOString().split("T")[0];
export const TOMORROW = new Date(Date.now() + 86400000).toISOString().split("T")[0];

export const fmt = (n: number | null | undefined | string): string => {
  if (n == null || n === "") return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v === 0) return "0";
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `${(v / 100000).toFixed(1)}L`;
  return `${(v / 1000).toFixed(0)}K`;
};
export const fmtR = (n: number | null | undefined | string): string =>
  n == null || n === "" ? "—" : `₹${fmt(n)}`;

export const daysSince = (d: string | null | undefined): number => {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

export const STAGE_PROB: Record<string, number> = {
  "Prospect": 10, "In Discussion": 40, "Negotiation": 70,
  "Mail Confirmed": 90, "RO Received": 100, "Lost": 0,
};

export const oColor = (o: string): string => ({
  "Prospect":       C.muted,
  "In Discussion":  C.blue,
  "Negotiation":    C.accent,
  "Mail Confirmed": C.green,
  "RO Received":    "#0f6b2f",
  "Lost":           C.red,
} as Record<string, string>)[o] ?? C.dim;
