import React, { useState } from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import { apiFetch } from "../../services/api/_client";

function q1(sub: any) { return ["april","may","june"].reduce((s,m) => s + (Number(sub[m]) || 0), 0); }
function q2(sub: any) { return ["july","august","september"].reduce((s,m) => s + (Number(sub[m]) || 0), 0); }
function q3(sub: any) { return ["october","november","december"].reduce((s,m) => s + (Number(sub[m]) || 0), 0); }

export function NSHTargetApproval() {
  const {
    targetSubs,
    setTargetSubs,
    reps,
    REGIONS,
    C,
    fmtR,
    showToast,
  } = useCROAppContext();

  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [rejectRegion, setRejectRegion] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const pending = targetSubs.filter(s => s.status === "Pending NSH");

  const byRegion: Record<string, typeof pending> = {};
  for (const sub of pending) {
    const r = sub.region || "Unknown";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(sub);
  }

  const regions = REGIONS.filter(r => byRegion[r]?.length);

  function toggleRegion(r: string) {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  }

  async function handleApprove(region: string) {
    if (submitting) return;
    setSubmitting(`approve-${region}`);
    try {
      const data: any = await apiFetch(`/api/targets/region/${encodeURIComponent(region)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setTargetSubs(prev => prev.map(s =>
        s.region === region && s.status === "Pending NSH"
          ? { ...s, status: data.nextStatus || "Pending Strategy" }
          : s
      ));
      showToast(`${byRegion[region]?.length} submission(s) in ${region} approved`, "success");
    } catch (e: any) {
      showToast(e.message || "Approval failed", "error");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReject(region: string) {
    if (!rejectNote.trim()) { showToast("Please enter rejection remarks", "error"); return; }
    if (submitting) return;
    setSubmitting(`reject-${region}`);
    try {
      const data: any = await apiFetch(`/api/targets/region/${encodeURIComponent(region)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote }),
      });
      setTargetSubs(prev => prev.map(s =>
        s.region === region && s.status === "Pending NSH"
          ? { ...s, status: "Rejected" }
          : s
      ));
      showToast(`${data.count} submission(s) in ${region} rejected and sent back to reps`, "success");
      setRejectRegion(null);
      setRejectNote("");
    } catch (e: any) {
      showToast(e.message || "Rejection failed", "error");
    } finally {
      setSubmitting(null);
    }
  }

  if (!regions.length) {
    return (
      <div className="fin">
        <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>TARGET APPROVAL</div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>Region-aggregated view · Pending NSH approval</div>
        <div style={{
          background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 10,
          padding: 48, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>No targets pending your approval</div>
          <div style={{ fontSize: 11, color: C.muted }}>All target submissions have been processed.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fin">
      <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>TARGET APPROVAL</div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 20 }}>
        Region-aggregated view · {regions.length} region(s) pending · {pending.length} total submission(s)
      </div>

      {regions.map(region => {
        const subs = byRegion[region] || [];
        const expanded = expandedRegions.has(region);
        const isRejecting = rejectRegion === region;
        const isApproving = submitting === `approve-${region}`;
        const isRejectingAction = submitting === `reject-${region}`;

        const totalAgencies = new Set(subs.flatMap(s => (s.clients as any[])?.map((c: any) => c.agencyName).filter(Boolean) || [])).size;
        const totalClients  = subs.reduce((n, s) => n + ((s.clients as any[])?.length || 0), 0);
        const totalApr = subs.reduce((s, x) => s + (Number(x.april) || 0), 0);
        const totalMay = subs.reduce((s, x) => s + (Number(x.may) || 0), 0);
        const totalJun = subs.reduce((s, x) => s + (Number(x.june) || 0), 0);
        const totalJul = subs.reduce((s, x) => s + (Number(x.july) || 0), 0);
        const totalAug = subs.reduce((s, x) => s + (Number(x.august) || 0), 0);
        const totalSep = subs.reduce((s, x) => s + (Number(x.september) || 0), 0);
        const totalOct = subs.reduce((s, x) => s + (Number(x.october) || 0), 0);
        const totalNov = subs.reduce((s, x) => s + (Number(x.november) || 0), 0);
        const totalDec = subs.reduce((s, x) => s + (Number(x.december) || 0), 0);
        const totalQ1  = totalApr + totalMay + totalJun;
        const totalQ2  = totalJul + totalAug + totalSep;
        const totalQ3  = totalOct + totalNov + totalDec;
        const totalAnn = totalQ1 + totalQ2 + totalQ3;

        return (
          <div key={region} style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
            {/* Region header row */}
            <div
              onClick={() => toggleRegion(region)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", background: C.s2,
                borderBottom: expanded ? `1px solid ${C.border}` : "none",
                cursor: "pointer", userSelect: "none",
              }}
            >
              <span style={{ fontSize: 12, color: C.dim, fontWeight: 700, minWidth: 14 }}>{expanded ? "▼" : "▶"}</span>
              <span className="sans" style={{ fontWeight: 700, fontSize: 14, flex: "0 0 120px" }}>{region}</span>
              <span style={{ fontSize: 10, color: C.dim, flex: "0 0 100px" }}>{subs.length} rep(s)</span>
              <span style={{ fontSize: 10, color: C.dim, flex: "0 0 90px" }}>{totalAgencies} agencies</span>
              <span style={{ fontSize: 10, color: C.dim, flex: "0 0 90px" }}>{totalClients} clients</span>
              {/* Monthly summary */}
              <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
                {[["Q1", totalQ1], ["Q2", totalQ2], ["Q3", totalQ3], ["Annual", totalAnn]].map(([l, v]) => (
                  <div key={String(l)} style={{ textAlign: "right", minWidth: 70 }}>
                    <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, letterSpacing: ".06em" }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: l === "Annual" ? C.accent : C.text }}>{fmtR(Number(v))}</div>
                  </div>
                ))}
              </div>
              {/* Action buttons */}
              <div style={{ display: "flex", gap: 6, marginLeft: 12 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setRejectRegion(null); handleApprove(region); }}
                  disabled={!!submitting}
                  style={{
                    padding: "5px 14px", borderRadius: 6, border: "none",
                    background: C.green, color: "#fff", cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 700, opacity: submitting ? .6 : 1,
                  }}
                >
                  {isApproving ? "Approving…" : "Approve"}
                </button>
                <button
                  onClick={() => { setRejectRegion(isRejecting ? null : region); setRejectNote(""); }}
                  disabled={!!submitting}
                  style={{
                    padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.red}`,
                    background: isRejecting ? `${C.red}18` : "transparent",
                    color: C.red, cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 700, opacity: submitting ? .6 : 1,
                  }}
                >
                  Reject
                </button>
              </div>
            </div>

            {/* Inline reject form */}
            {isRejecting && (
              <div style={{ padding: "12px 16px", background: `${C.red}08`, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 8 }}>Rejection remarks (required — sent to all reps in {region})</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="Enter reason for rejection…"
                    rows={2}
                    style={{
                      flex: 1, background: C.s2, border: `1px solid ${C.red}`, borderRadius: 6,
                      padding: "8px 10px", color: C.text, fontSize: 11,
                      fontFamily: "'DM Mono',monospace", resize: "vertical", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={() => handleReject(region)}
                      disabled={!!submitting || !rejectNote.trim()}
                      style={{
                        padding: "6px 16px", borderRadius: 6, border: "none",
                        background: C.red, color: "#fff",
                        cursor: (!submitting && rejectNote.trim()) ? "pointer" : "not-allowed",
                        fontSize: 11, fontWeight: 700, opacity: (!rejectNote.trim() || submitting) ? .6 : 1,
                      }}
                    >
                      {isRejectingAction ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button
                      onClick={() => { setRejectRegion(null); setRejectNote(""); }}
                      style={{
                        padding: "6px 16px", borderRadius: 6, border: `1px solid ${C.border}`,
                        background: "transparent", color: C.dim, cursor: "pointer", fontSize: 11,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Expanded rep rows */}
            {expanded && (
              <div style={{ padding: "0 0 8px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: C.s2 }}>
                      {["Rep Name", "Agencies", "Clients", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Q1", "Q2", "Q3", "Annual"].map(h => (
                        <th key={h} style={{
                          padding: "6px 10px", color: C.dim, fontWeight: 700, fontSize: 9,
                          textTransform: "uppercase", textAlign: "right", borderBottom: `1px solid ${C.border}`,
                          whiteSpace: "nowrap",
                          ...(["Rep Name", "Agencies", "Clients"].includes(h) ? { textAlign: "left" } : {}),
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map(sub => {
                      const rep = reps.find(r => String(r.id) === String(sub.repId));
                      const clients = (sub.clients as any[]) || [];
                      const agencies = new Set(clients.map((c: any) => c.agencyName).filter(Boolean)).size;
                      const sQ1 = q1(sub), sQ2 = q2(sub), sQ3 = q3(sub), sAnn = sQ1 + sQ2 + sQ3;
                      return (
                        <tr key={sub.id} style={{ borderBottom: `1px solid ${C.s2}` }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>{rep?.name || sub.repName || "—"}</td>
                          <td style={{ padding: "8px 10px", color: C.dim }}>{agencies}</td>
                          <td style={{ padding: "8px 10px", color: C.dim }}>{clients.length}</td>
                          {(["april","may","june","july","august","september","october","november","december"] as const).map(m => (
                            <td key={m} style={{ padding: "8px 10px", textAlign: "right", color: C.dim }}>{fmtR(Number(sub[m]) || 0)}</td>
                          ))}
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{fmtR(sQ1)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{fmtR(sQ2)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{fmtR(sQ3)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: C.accent }}>{fmtR(sAnn)}</td>
                        </tr>
                      );
                    })}
                    {/* Region totals row */}
                    <tr style={{ background: C.s2, fontWeight: 700 }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: C.text }}>REGION TOTAL</td>
                      <td style={{ padding: "8px 10px" }}>{totalAgencies}</td>
                      <td style={{ padding: "8px 10px" }}>{totalClients}</td>
                      {[totalApr,totalMay,totalJun,totalJul,totalAug,totalSep,totalOct,totalNov,totalDec].map((v,i) => (
                        <td key={i} style={{ padding: "8px 10px", textAlign: "right" }}>{fmtR(v)}</td>
                      ))}
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtR(totalQ1)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtR(totalQ2)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtR(totalQ3)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: C.accent }}>{fmtR(totalAnn)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
