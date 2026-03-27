export const C = {
  bg:"#f0f4f9", surface:"#ffffff", s2:"#e8eef7", s3:"#dde5f0",
  border:"#c8d3e5", accent:"#c47d00", green:"#15803d", red:"#c92828",
  blue:"#1d5db4", purple:"#7920e8", orange:"#c24000", text:"#18243a",
  dim:"#4d5e78", muted:"#8a97ae"
};

export const fmt = (n: number): string => {
  if (!n || n === 0) return "—";
  if (n >= 10000000) return `${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `${(n/100000).toFixed(1)}L`;
  return `${(n/1000).toFixed(0)}K`;
};

export const fmtR = (n: number): string => n ? `\u20B9${fmt(n)}` : "—";

export const daysSince = (d: string | null): number => {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

export const riskColor = (d: { outcome: string; lastContact: string }): string => {
  if (d.outcome === "Not Interested") return C.muted;
  if (d.outcome === "Proposal Accepted") return C.green;
  const x = daysSince(d.lastContact);
  return x >= 7 ? C.red : x >= 3 ? C.orange : C.green;
};

export const riskLabel = (d: { outcome: string; lastContact: string }): string => {
  if (d.outcome === "Not Interested") return "Lost";
  if (d.outcome === "Proposal Accepted") return "Won";
  const x = daysSince(d.lastContact);
  return x >= 7 ? "At Risk" : x >= 3 ? "Cooling" : "Active";
};

export const oColor = (o: string): string => ({
  "Proposal Accepted": C.green,
  "Very Interested": "#4ade80",
  "Interested – Needs Revision": C.accent,
  "Price Concern": C.orange,
  "Needs Callback": C.blue,
  "Not Interested": C.muted
}[o] || C.dim);

export const lColor = (l: string): string => ({
  "C-Suite / Owner": C.purple,
  "VP / GM": C.blue,
  "Marketing Head": C.green,
  "Brand Manager": C.accent,
  "Agency Lead": "#6366f1",
  "Junior/Exec": C.red
}[l] || C.dim);
