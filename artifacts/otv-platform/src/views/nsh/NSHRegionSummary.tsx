import React from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";

export function NSHRegionSummary() {
  const {
    meetings,
    reps,
    revenueEntries,
    targetSubs,
    REGIONS,
    C,
    fmtR,
    TODAY,
    TOMORROW,
  } = useCROAppContext();

  const FISCAL_MONTHS = ["april","may","june","july","august","september","october","november","december","january","february","march"];

  // ── Section 1: Meeting status table ──────────────────────────────────────────

  type MeetingRow = {
    region: string;
    rhName: string;
    scheduledTomorrow: number;
    loggedToday: number;
    pendingLogToday: number;
  };

  const meetingRows: MeetingRow[] = REGIONS.map(region => {
    const regionReps = reps.filter(r => r.region === region);
    const repIds = new Set(regionReps.map(r => String(r.id)));

    const regionMeetings = meetings.filter(m => m.region === region || repIds.has(String(m.repId)));

    const scheduledTomorrow = regionMeetings.filter(m =>
      m.date === TOMORROW && (m.status === "planned" || m.status === "logged")
    ).length;

    const todayMeetings = regionMeetings.filter(m => m.date === TODAY);
    const loggedToday   = todayMeetings.filter(m => m.status === "logged").length;
    const pendingLogToday = todayMeetings.filter(m => m.status === "planned").length;

    // RH name = first rep with a region head-like name, or use a placeholder
    const rhName = `RH – ${region}`;

    return { region, rhName, scheduledTomorrow, loggedToday, pendingLogToday };
  });

  const mtgTotals = {
    scheduledTomorrow: meetingRows.reduce((s, r) => s + r.scheduledTomorrow, 0),
    loggedToday:       meetingRows.reduce((s, r) => s + r.loggedToday, 0),
    pendingLogToday:   meetingRows.reduce((s, r) => s + r.pendingLogToday, 0),
  };

  // ── Section 2: Revenue summary table ─────────────────────────────────────────
  // Annual target: sum of all approved target submissions per region (use totalTarget)
  // YTD Achieved: sum of revenue entries for region (non-reversed)
  // Shortfall: target − achieved

  const currentYear = new Date().getFullYear();
  const currentFY   = new Date().getMonth() >= 3 ? currentYear + 1 : currentYear;
  const fyLabel     = `Annual-${currentFY}`;

  type RevenueRow = {
    region: string;
    rhName: string;
    annualTarget: number;
    achieved: number;
    shortfall: number;
  };

  const revenueRows: RevenueRow[] = REGIONS.map(region => {
    const regionReps = reps.filter(r => r.region === region);
    const repIds     = new Set(regionReps.map(r => String(r.id)));

    // Annual target: from approved target submissions for the current FY
    const annualTarget = targetSubs
      .filter(s =>
        s.region === region &&
        s.status === "Approved" &&
        (s.quarter === fyLabel || String(s.quarter).startsWith(`Annual-${currentFY}`))
      )
      .reduce((sum, s) => sum + (Number(s.totalTarget) || 0), 0);

    // YTD achieved: sum of revenue entries for this region, non-reversed
    const achieved = revenueEntries
      .filter(e =>
        (e.region === region || repIds.has(String(e.repId))) &&
        !(e as any).isReversed &&
        !(e as any).reversalOf
      )
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const shortfall = Math.max(0, annualTarget - achieved);

    return { region, rhName: `RH – ${region}`, annualTarget, achieved, shortfall };
  });

  const revTotals = {
    annualTarget: revenueRows.reduce((s, r) => s + r.annualTarget, 0),
    achieved:     revenueRows.reduce((s, r) => s + r.achieved, 0),
    shortfall:    revenueRows.reduce((s, r) => s + r.shortfall, 0),
  };

  return (
    <div className="fin">
      <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>REGION SUMMARY</div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
        National view · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </div>

      {/* ── Section 1: Meeting Status ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
          Meeting Status
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.s2 }}>
                {["RH Name", "Region", "Meetings Scheduled Tomorrow", "Meetings Logged Today", "Pending Logs Today"].map(h => (
                  <th key={h} style={{
                    padding: "9px 14px", color: C.dim, fontWeight: 700, fontSize: 10,
                    textTransform: "uppercase", textAlign: "left", borderBottom: `1px solid ${C.border}`,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meetingRows.map(row => (
                <tr
                  key={row.region}
                  style={{ borderBottom: `1px solid ${C.s2}` }}
                  onMouseOver={e => (e.currentTarget.style.background = C.s2)}
                  onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{row.rhName}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: `${C.blue}18`, color: C.blue, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                      {row.region}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontWeight: 700, color: row.scheduledTomorrow > 0 ? C.green : C.muted }}>
                      {row.scheduledTomorrow}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontWeight: 700, color: row.loggedToday > 0 ? C.accent : C.muted }}>
                      {row.loggedToday}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontWeight: 700,
                      color: row.pendingLogToday > 0 ? C.orange : C.green,
                    }}>
                      {row.pendingLogToday}
                    </span>
                    {row.pendingLogToday > 0 && (
                      <span style={{ fontSize: 9, color: C.orange, marginLeft: 6, fontWeight: 600 }}>not yet logged</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr style={{ background: C.s2, fontWeight: 700 }}>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>ALL REGIONS</td>
                <td style={{ padding: "10px 14px" }} />
                <td style={{ padding: "10px 14px", color: C.green, fontWeight: 700 }}>{mtgTotals.scheduledTomorrow}</td>
                <td style={{ padding: "10px 14px", color: C.accent, fontWeight: 700 }}>{mtgTotals.loggedToday}</td>
                <td style={{ padding: "10px 14px", color: mtgTotals.pendingLogToday > 0 ? C.orange : C.green, fontWeight: 700 }}>
                  {mtgTotals.pendingLogToday}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: Revenue Summary ── */}
      <div>
        <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
          Revenue Summary · FY{String(currentFY).slice(-2)}
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.s2 }}>
                {["Region", "RH Name", "Annual Target", "Achieved (YTD)", "Shortfall (YTD)"].map(h => (
                  <th key={h} style={{
                    padding: "9px 14px", color: C.dim, fontWeight: 700, fontSize: 10,
                    textTransform: "uppercase", textAlign: "left", borderBottom: `1px solid ${C.border}`,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenueRows.map(row => {
                const achievePct = row.annualTarget > 0 ? Math.round((row.achieved / row.annualTarget) * 100) : 0;
                const sc = achievePct >= 80 ? C.green : achievePct >= 40 ? C.accent : C.red;
                return (
                  <tr
                    key={row.region}
                    style={{ borderBottom: `1px solid ${C.s2}` }}
                    onMouseOver={e => (e.currentTarget.style.background = C.s2)}
                    onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: `${C.blue}18`, color: C.blue, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                        {row.region}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{row.rhName}</td>
                    <td style={{ padding: "10px 14px", color: C.dim }}>{fmtR(row.annualTarget)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: C.s3, borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                          <div style={{ height: "100%", width: `${Math.min(achievePct, 100)}%`, background: sc }} />
                        </div>
                        <span style={{ color: sc, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                          {fmtR(row.achieved)} <span style={{ fontSize: 10, fontWeight: 600 }}>({achievePct}%)</span>
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: row.shortfall > 0 ? C.red : C.green }}>
                      {row.shortfall > 0 ? fmtR(row.shortfall) : "✓ On track"}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: C.s2, fontWeight: 700 }}>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>ALL REGIONS</td>
                <td style={{ padding: "10px 14px" }} />
                <td style={{ padding: "10px 14px" }}>{fmtR(revTotals.annualTarget)}</td>
                <td style={{ padding: "10px 14px", color: C.accent, fontWeight: 700 }}>{fmtR(revTotals.achieved)}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: revTotals.shortfall > 0 ? C.red : C.green }}>
                  {revTotals.shortfall > 0 ? fmtR(revTotals.shortfall) : "✓ On track"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
