import React, { useState } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import { apiFetch } from "../../services/api/_client";

function fmtLakh(val: any): string {
  const n = Math.round(Number(val) || 0);
  if (n === 0) return "—";
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  return `${(n / 1000).toFixed(0)}K`;
}

function numVal(val: any): number {
  return Math.round(Number(val) || 0);
}

export function RHTargetApproval() {
  const { targetSubs, setTargetSubs, C } = useCROAppContext();
  const [rejectId, setRejectId]   = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [loading, setLoading]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const pendingRH = targetSubs.filter(t => t.status === "Pending RH");

  async function handleApprove(id: string) {
    setLoading(id);
    setError(null);
    try {
      await apiFetch(`/api/targets/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setTargetSubs(p => p.map(t => t.id === id ? { ...t, status: "Pending NSH" } : t));
    } catch (e: any) {
      setError(e?.message || "Failed to approve");
    } finally {
      setLoading(null);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectId) return;
    setLoading(rejectId);
    setError(null);
    try {
      await apiFetch(`/api/targets/${rejectId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote }),
      });
      setTargetSubs(p => p.map(t => t.id === rejectId ? { ...t, status: "Pending Rep" } : t));
      setRejectId(null);
      setRejectNote("");
    } catch (e: any) {
      setError(e?.message || "Failed to reject");
    } finally {
      setLoading(null);
    }
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    background: C.s2,
    color: C.dim,
    fontWeight: 600,
    fontSize: 9,
    textTransform: "uppercase",
    textAlign: "left",
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    letterSpacing: ".06em",
  };

  const tdStyle: React.CSSProperties = {
    padding: "9px 10px",
    borderBottom: `1px solid ${C.s2}`,
    fontSize: 11,
    verticalAlign: "middle",
  };

  const numTd: React.CSSProperties = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div className="fin">
      <div style={{ marginBottom: 20 }}>
        <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>TARGET APPROVAL</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>
          Target submissions from your direct reports awaiting your approval
        </div>
      </div>

      {error && (
        <div style={{
          background: `${C.red}10`, border: `1px solid ${C.red}33`,
          borderRadius: 7, padding: "10px 14px", marginBottom: 16,
          fontSize: 12, color: C.red,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", marginLeft: 8, fontWeight: 700 }}>✕</button>
        </div>
      )}

      {pendingRH.length === 0 ? (
        <div style={{
          background: `${C.green}08`, border: `1px solid ${C.green}22`,
          borderRadius: 8, padding: 40, textAlign: "center",
        }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
          <div className="sans" style={{ fontWeight: 700, color: C.green, marginBottom: 4 }}>All caught up</div>
          <div style={{ fontSize: 11, color: C.dim }}>No target submissions pending your approval</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
            {pendingRH.length} submission{pendingRH.length !== 1 ? "s" : ""} pending approval · Indian FY (Apr–Mar)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr>
                {[
                  "Rep", "Agency", "Client", "Brand",
                  "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                  "Q1", "Q2", "Q3", "Q4", "Annual",
                  "Action",
                ].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pendingRH.map(sub => {
                const fc    = (sub.clients as any[])?.[0];
                const extra = (sub.clients as any[])?.length > 1 ? `+${(sub.clients as any[]).length - 1}` : "";

                const apr = numVal(sub.april);
                const may = numVal(sub.may);
                const jun = numVal(sub.june);
                const jul = numVal(sub.july);
                const aug = numVal(sub.august);
                const sep = numVal(sub.september);
                const oct = numVal(sub.october);
                const nov = numVal(sub.november);
                const dec = numVal(sub.december);
                const jan = numVal(sub.january);
                const feb = numVal(sub.february);
                const mar = numVal(sub.march);
                const q1  = apr + may + jun;
                const q2  = jul + aug + sep;
                const q3  = oct + nov + dec;
                const q4  = jan + feb + mar;
                const annual = q1 + q2 + q3 + q4;

                const busy = loading === sub.id;

                return (
                  <React.Fragment key={sub.id}>
                    <tr
                      style={{ borderBottom: `1px solid ${C.s2}` }}
                      onMouseOver={e => (e.currentTarget.style.background = C.s2)}
                      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{sub.repName || "—"}</td>
                      <td style={{ ...tdStyle, color: C.dim }}>
                        {fc?.agencyName || "—"}
                        {extra && <span style={{ color: C.muted, fontSize: 10 }}> {extra}</span>}
                      </td>
                      <td style={{ ...tdStyle, color: C.dim }}>
                        {fc?.clientName || "—"}
                      </td>
                      <td style={{ ...tdStyle, color: C.dim }}>{fc?.brandName || "—"}</td>

                      {[apr, may, jun, jul, aug, sep, oct, nov, dec].map((v, i) => (
                        <td key={i} style={{ ...numTd, color: v > 0 ? C.text : C.muted }}>{fmtLakh(v)}</td>
                      ))}

                      <td style={{ ...numTd, color: C.accent, fontWeight: 600 }}>{fmtLakh(q1)}</td>
                      <td style={{ ...numTd, color: C.accent, fontWeight: 600 }}>{fmtLakh(q2)}</td>
                      <td style={{ ...numTd, color: C.accent, fontWeight: 600 }}>{fmtLakh(q3)}</td>
                      <td style={{ ...numTd, color: C.accent, fontWeight: 600 }}>{fmtLakh(q4)}</td>
                      <td style={{ ...numTd, color: C.green, fontWeight: 700 }}>{fmtLakh(annual)}</td>

                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        {rejectId === sub.id ? (
                          <span style={{ color: C.dim, fontSize: 11 }}>Enter remarks below ↓</span>
                        ) : (
                          <div style={{ display: "flex", gap: 5 }}>
                            <button
                              disabled={busy}
                              onClick={() => handleApprove(sub.id)}
                              style={{
                                background: busy ? C.s3 : `${C.green}22`,
                                color: C.green, border: `1px solid ${C.green}44`,
                                borderRadius: 5, padding: "4px 11px",
                                fontSize: 11, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              {busy ? "…" : "Approve"}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => { setRejectId(sub.id); setRejectNote(""); }}
                              style={{
                                background: `${C.red}18`, color: C.red,
                                border: `1px solid ${C.red}44`,
                                borderRadius: 5, padding: "4px 11px",
                                fontSize: 11, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {rejectId === sub.id && (
                      <tr style={{ background: `${C.red}06` }}>
                        <td colSpan={20} style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 11, color: C.red, fontWeight: 700, minWidth: 120 }}>
                              Rejection remarks:
                            </div>
                            <input
                              value={rejectNote}
                              onChange={e => setRejectNote(e.target.value)}
                              placeholder="Reason for rejection (sent to rep as notification)"
                              style={{
                                flex: 1, minWidth: 240, fontSize: 12,
                                padding: "6px 10px", background: C.surface,
                                border: `1px solid ${C.red}55`, borderRadius: 5, color: C.text,
                              }}
                              autoFocus
                            />
                            <button
                              disabled={loading === sub.id}
                              onClick={handleRejectSubmit}
                              style={{
                                background: C.red, color: "#fff",
                                border: "none", borderRadius: 5,
                                padding: "7px 16px", fontSize: 12,
                                fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              {loading === sub.id ? "Rejecting…" : "Confirm Reject"}
                            </button>
                            <button
                              onClick={() => { setRejectId(null); setRejectNote(""); }}
                              style={{
                                background: "transparent", color: C.dim,
                                border: `1px solid ${C.border}`, borderRadius: 5,
                                padding: "7px 12px", fontSize: 12, cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                            Rejection sends an in-app notification to {sub.repName} and returns the plan for revision.
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
