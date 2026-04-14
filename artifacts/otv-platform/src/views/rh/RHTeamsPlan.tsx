import React from "react";
import { useCROAppContext } from "../../contexts/CROAppContext";
import { USER_ROLES } from "../../constants";

export function RHTeamsPlan() {
  const { meetings, reps, C, TODAY, TOMORROW } = useCROAppContext();

  const allMeetings = meetings || [];

  const tomorrowMeetings = allMeetings.filter(m => m.date === TOMORROW);
  const todayMeetings    = allMeetings.filter(m => m.date === TODAY);

  function getRepName(repId: number | null | undefined): string {
    if (!repId) return "—";
    const u = USER_ROLES.find(u => u.repId === repId);
    if (u) return u.name;
    const r = reps.find(r => r.id === repId || String(r.id) === String(repId));
    return r ? r.name : "—";
  }

  function fmtTime(t: string | null | undefined): string {
    if (!t) return "—";
    return t;
  }

  function fmtPitchType(m: any): string {
    if (m.pitchType) return m.pitchType;
    if (m.actionableType) return m.actionableType;
    if (m.meetingKind === "PR") return "Relationship";
    if (m.meetingKind === "ACTIONABLE") return "Actionable";
    return "—";
  }

  function fmtFeedbackType(m: any): string {
    if (m.meetingKind === "PR") return "Relationship";
    if (m.meetingKind === "ACTIONABLE") return "Actionable";
    return m.meetingKind || "—";
  }

  function fmtUpdated(m: any): string {
    const d = m.updatedAt || m.createdAt;
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return String(d).slice(0, 16);
    }
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 13px",
    background: C.s2,
    color: C.dim,
    fontWeight: 600,
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "left",
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    letterSpacing: ".06em",
  };

  const tdStyle: React.CSSProperties = {
    padding: "9px 13px",
    borderBottom: `1px solid ${C.s2}`,
    fontSize: 12,
    verticalAlign: "middle",
  };

  const emptyRow = (cols: number, msg: string) => (
    <tr>
      <td colSpan={cols} style={{ padding: 28, textAlign: "center", color: C.muted, fontSize: 12 }}>
        {msg}
      </td>
    </tr>
  );

  return (
    <div className="fin">
      <div style={{ marginBottom: 20 }}>
        <div className="sans" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>TEAM'S PLAN</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>
          Your direct reports' meetings — today's status and tomorrow's schedule
        </div>
      </div>

      {/* ── Tomorrow's Meetings ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10, color: C.accent, fontWeight: 700,
          letterSpacing: ".1em", textTransform: "uppercase",
          marginBottom: 10,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          TOMORROW'S MEETINGS
          <span style={{ background: `${C.accent}18`, color: C.accent, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
            {tomorrowMeetings.length}
          </span>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rep Name", "Client", "Agency", "Scheduled Time", "Pitch Type"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tomorrowMeetings.length === 0
                ? emptyRow(5, "No meetings scheduled for tomorrow")
                : tomorrowMeetings
                    .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                    .map(m => (
                      <tr
                        key={m.id}
                        style={{ borderBottom: `1px solid ${C.s2}` }}
                        onMouseOver={e => (e.currentTarget.style.background = C.s2)}
                        onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{getRepName(m.repId)}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{m.clientName || "—"}</td>
                        <td style={{ ...tdStyle, color: C.dim }}>{m.agencyName || "—"}</td>
                        <td style={{ ...tdStyle, color: C.dim, whiteSpace: "nowrap" }}>{fmtTime(m.time)}</td>
                        <td style={tdStyle}>
                          <span style={{
                            background: `${C.accent}18`, color: C.accent,
                            padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                          }}>
                            {fmtPitchType(m)}
                          </span>
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Today's Meeting Status ── */}
      <div>
        <div style={{
          fontSize: 10, color: C.blue, fontWeight: 700,
          letterSpacing: ".1em", textTransform: "uppercase",
          marginBottom: 10,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          TODAY'S MEETING STATUS
          <span style={{ background: `${C.blue}18`, color: C.blue, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
            {todayMeetings.length}
          </span>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rep Name", "Client", "Feedback Logged", "Feedback Type", "Last Updated"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayMeetings.length === 0
                ? emptyRow(5, "No meetings for today")
                : todayMeetings
                    .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                    .map(m => {
                      const logged = m.status === "logged";
                      const loggedColor = logged ? C.green : C.red;
                      const loggedLabel = logged ? "Yes" : "No";
                      return (
                        <tr
                          key={m.id}
                          style={{ borderBottom: `1px solid ${C.s2}` }}
                          onMouseOver={e => (e.currentTarget.style.background = C.s2)}
                          onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{getRepName(m.repId)}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{m.clientName || "—"}</td>
                          <td style={tdStyle}>
                            <span style={{
                              background: `${loggedColor}18`, color: loggedColor,
                              padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                            }}>
                              {loggedLabel}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              background: `${C.dim}18`, color: C.dim,
                              padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                            }}>
                              {fmtFeedbackType(m)}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: C.dim, fontSize: 11, whiteSpace: "nowrap" }}>
                            {fmtUpdated(m)}
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
