export const C = {
  bg:"#080a0f", surface:"#0d1117", s2:"#131920", s3:"#1a2332",
  border:"#1e2d3d", accent:"#f0a500", green:"#16c784", red:"#ea3943",
  blue:"#2d7dd2", purple:"#a855f7", orange:"#f97316", text:"#e6edf3",
  dim:"#7d8590", muted:"#2a3a4d"
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
