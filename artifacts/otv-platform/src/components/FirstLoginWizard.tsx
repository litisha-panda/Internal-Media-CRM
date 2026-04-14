import React, { useState, useRef } from "react";
import { apiFetch } from "../services/api/_client";
import { USER_ROLES } from "../data";

// ── Wizard regions (as specified) ──────────────────────────────────────────
const WIZARD_REGIONS = ["North", "South", "West 1", "West 2", "Odisha", "Digital", "East"];

// ── Indian FY months (Apr–Mar) ─────────────────────────────────────────────
const FY_MONTHS = [
  { key: "april",     short: "Apr", label: "April" },
  { key: "may",       short: "May", label: "May" },
  { key: "june",      short: "Jun", label: "June" },
  { key: "july",      short: "Jul", label: "July" },
  { key: "august",    short: "Aug", label: "August" },
  { key: "september", short: "Sep", label: "September" },
  { key: "october",   short: "Oct", label: "October" },
  { key: "november",  short: "Nov", label: "November" },
  { key: "december",  short: "Dec", label: "December" },
  { key: "january",   short: "Jan", label: "January" },
  { key: "february",  short: "Feb", label: "February" },
  { key: "march",     short: "Mar", label: "March" },
] as const;

type MonthKey = (typeof FY_MONTHS)[number]["key"];

interface CsvRow {
  agencyName: string;
  clientName: string;
  brandName: string;
  months: Record<MonthKey, number>;
  q1: number; q2: number; q3: number; q4: number; annual: number;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // skip header row
  const rows = lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const [agencyName = "", clientName = "", brandName = ""] = cols;
    const monthValues: number[] = FY_MONTHS.map((_, i) => Math.round(parseFloat(cols[3 + i] || "0") || 0));
    const months = Object.fromEntries(FY_MONTHS.map((m, i) => [m.key, monthValues[i]])) as Record<MonthKey, number>;
    const q1 = monthValues[0] + monthValues[1] + monthValues[2];
    const q2 = monthValues[3] + monthValues[4] + monthValues[5];
    const q3 = monthValues[6] + monthValues[7] + monthValues[8];
    const q4 = monthValues[9] + monthValues[10] + monthValues[11];
    return { agencyName, clientName, brandName, months, q1, q2, q3, q4, annual: q1 + q2 + q3 + q4 };
  }).filter(r => r.clientName.trim());
  console.log("[parseCsv] parsed", rows.length, "rows; first row:", rows[0] ?? null);
  return rows;
}

function fmtINR(n: number): string {
  if (!n) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Step indicator ──────────────────────────────────────────────────────────
const StepBar: React.FC<{ steps: string[]; current: number; C: any }> = ({ steps, current, C }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
    {steps.map((label, i) => (
      <React.Fragment key={i}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
            background: i < current ? C.green : i === current ? C.accent : C.border,
            color: i <= current ? "#fff" : C.muted,
            border: `2px solid ${i < current ? C.green : i === current ? C.accent : C.border}`,
          }}>
            {i < current ? "✓" : i + 1}
          </div>
          <span style={{ fontSize: 9, color: i === current ? C.accent : C.muted, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
        </div>
        {i < steps.length - 1 && (
          <div style={{ flex: 1, height: 2, background: i < current ? C.green : C.border, margin: "0 6px", marginBottom: 16 }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── Field helpers ───────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 5, fontFamily: "'DM Sans',sans-serif" }}>{label}</label>
    {children}
  </div>
);

const inputStyle = (C: any): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", background: C.s2, border: `1px solid ${C.border}`,
  borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "'DM Mono',monospace", boxSizing: "border-box",
});

// ──────────────────────────────────────────────────────────────────────────
// PROPS
// ──────────────────────────────────────────────────────────────────────────
interface FirstLoginWizardProps {
  user: { id: number; name: string | null; email: string; role: string; region?: string | null };
  C: any;
  targetSubs: any[];
  setTargetSubs: React.Dispatch<React.SetStateAction<any[]>>;
  liveRoles: any[];    // active users list for manager/rep dropdowns (admin only)
  adminUsersLoading?: boolean;
  fmtR: (v: number) => string;
  onComplete: () => void;
  openWelcomeTour: () => void;
  showToast: (msg: string, type?: string) => void;
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────
export const FirstLoginWizard: React.FC<FirstLoginWizardProps> = ({
  user, C, targetSubs, setTargetSubs, liveRoles, adminUsersLoading, fmtR, onComplete, openWelcomeTour, showToast,
}) => {
  console.log("role is:", user.role);
  // Normalize role: "SALES REP" → "SALES_REP", "REGION HEAD" → "REGION_HEAD"
  const normalRole = (user.role || "").replace(/\s+/g, "_").toUpperCase();
  const isRep   = normalRole === "SALES_REP";
  const isRH    = normalRole === "REGION_HEAD";
  const isNSH   = normalRole === "NSH";
  const isAdmin = normalRole === "ADMIN";

  const stepLabels = isRep   ? ["Profile", "Targets", "Done"]
                   : isRH    ? ["Profile", "Approvals", "Done"]
                   : isNSH   ? ["Profile", "Approvals", "Done"]
                   : isAdmin ? ["Profile", "Assign Reps"]
                   : ["Profile", "Done"];

  const totalSteps = stepLabels.length;
  const [step, setStep] = useState(0);

  // ── Shared profile state ─────────────────────────────────────────────────
  const [name, setName]         = useState(user.name && user.name !== user.email ? user.name : "");
  const [region, setRegion]     = useState(user.region || "");
  const [managerId, setManagerId] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);

  // ── SALES REP: CSV state ─────────────────────────────────────────────────
  const [csvRows, setCsvRows]       = useState<CsvRow[]>([]);
  const [csvParsed, setCsvParsed]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // ── RH/NSH: approval state ──────────────────────────────────────────────
  const [rejectId,   setRejectId]   = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actioned,   setActioned]   = useState<Set<string>>(new Set());

  // ── ADMIN: manager assignment state ─────────────────────────────────────
  const rhUsers = liveRoles.filter(u =>
    (u.role || "").replace(/\s+/g, "_").toUpperCase() === "REGION_HEAD"
  );
  const unassignedReps = liveRoles.filter(u =>
    (u.role || "").replace(/\s+/g, "_").toUpperCase() === "SALES_REP" &&
    !u.managerId && !u.manager_id
  );
  const [managerAssignments, setManagerAssignments] = useState<Record<string, string>>({});

  // ── Region heads for Sales Rep dropdown ─────────────────────────────────
  // liveRoles is only populated for ADMIN users (CROApp only calls refreshAdminUsers for admin).
  // For non-admin users (reps), fall back to the static USER_ROLES constant so the dropdown
  // is always populated with the 6 region heads.
  const regionHeads = liveRoles.filter(u =>
    (u.role || "").replace(/\s+/g, "_").toUpperCase() === "REGION_HEAD"
  ).length > 0
    ? liveRoles.filter(u => (u.role || "").replace(/\s+/g, "_").toUpperCase() === "REGION_HEAD")
    : USER_ROLES.filter(u => u.role === "REGION HEAD");

  // ── Pending submissions for RH / NSH ────────────────────────────────────
  const pendingStatus = isRH ? "Pending RH" : "Pending NSH";
  const pendingSubs = targetSubs.filter(s => s.status === pendingStatus);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  // Step 0 — profile save
  const saveProfile = async () => {
    if (!name.trim()) { showToast("Please enter your full name", "err"); return; }
    if (isRep && !region) { showToast("Please select your region", "err"); return; }
    if (isRH  && !region) { showToast("Please select your region", "err"); return; }
    setSaving(true);
    try {
      const body: any = { name: name.trim() };
      if (isRep || isRH) body.region = region;
      if (isRep && managerId) body.managerId = managerId;
      await apiFetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStep(1);
    } catch (e: any) {
      showToast(e?.body?.error ?? "Failed to save profile", "err");
    } finally {
      setSaving(false);
    }
  };

  // Sales Rep: download sample CSV
  const downloadSample = () => {
    const headers = ["Agency Name", "Client Name", "Brand Name", ...FY_MONTHS.map(m => m.label)].join(",");
    const sample  = ["NA", "Star Sports", "Star Sports", "500000","500000","600000","600000","600000","700000","700000","700000","800000","800000","900000","900000"].join(",");
    const csv     = `${headers}\n${sample}`;
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = "otv_target_template.csv";
    a.click();
  };

  // Sales Rep: handle CSV file
  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) { showToast("No valid rows found in CSV. Check the format.", "err"); return; }
      setCsvRows(rows);
      setCsvParsed(true);
    };
    reader.readAsText(file);
    // reset input so re-upload works
    e.target.value = "";
  };

  // Sales Rep: confirm & submit CSV
  const submitCsv = async () => {
    if (csvRows.length === 0) return;
    setSubmitting(true);
    const now = new Date().toISOString();
    const QUARTERS_FY = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26"];
    try {
      // Post one submission per row per quarter (where quarterly total > 0)
      const newSubs: any[] = [];
      let totalAttempts = 0;
      let total409 = 0;
      for (const row of csvRows) {
        const qTotals = [row.q1, row.q2, row.q3, row.q4];
        for (let qi = 0; qi < 4; qi++) {
          if (qTotals[qi] <= 0) continue;
          totalAttempts++;
          const monthTotals: Record<string, number> = {};
          FY_MONTHS.forEach(m => { monthTotals[m.key] = m.key in row.months ? row.months[m.key as MonthKey] : 0; });
          const id = `ts_wiz_${Date.now()}_${qi}_${Math.random().toString(36).slice(2, 5)}`;
          const payload = {
            id, repId: user.id, repName: name.trim(), region,
            quarter: QUARTERS_FY[qi],
            clients: [{
              clientCompany: row.clientName,
              agency: row.agencyName === "NA" ? "" : row.agencyName,
              brand: row.brandName,
              dealType: "Linear TV",
              targetAmount: qTotals[qi],
            }],
            totalTarget: qTotals[qi],
            ...monthTotals,
            status: "Pending RH",
            submittedAt: now, submittedByRole: "SALES REP",
            approvedAt: null, approvedBy: null, frozenTarget: null,
            awaitingApprovalSince: now,
            auditLog: [{ at: now, by: "SELF", role: "SALES REP", action: "Submitted via Setup Wizard" }],
          };
          console.log("[submitCsv] posting payload:", payload);
          try {
            const result: any = await apiFetch("/api/targets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            console.log("[submitCsv] success response:", result);
            newSubs.push(result?.data ?? payload);
          } catch (e: any) {
            console.log("[submitCsv] error status:", e?.status, "body:", e?.body ?? e);
            if (e?.status === 409) { total409++; }
            else throw e;
          }
        }
      }
      if (totalAttempts > 0 && total409 === totalAttempts) {
        showToast("Targets for these clients already exist — edit them from the Targets tab", "err");
      }
      if (newSubs.length > 0) setTargetSubs(p => [...newSubs, ...p]);
      setStep(2);
    } catch (e: any) {
      console.error("[submitCsv] unhandled error:", e);
      showToast(e?.body?.error ?? "Failed to submit targets", "err");
    } finally {
      setSubmitting(false);
    }
  };

  // RH/NSH: approve
  const approve = async (sub: any) => {
    const nextStatus = isRH ? "Pending NSH" : "Pending CRO";
    try {
      await apiFetch(`/api/targets/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setTargetSubs(p => p.map(s => s.id === sub.id ? { ...s, status: nextStatus } : s));
      setActioned(prev => new Set(prev).add(sub.id));
    } catch (e: any) {
      showToast(e?.body?.error ?? "Failed to approve", "err");
    }
  };

  // RH/NSH: reject
  const reject = async (sub: any) => {
    if (!rejectNote.trim()) { showToast("Enter reject remarks", "err"); return; }
    try {
      await apiFetch(`/api/targets/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Pending Rep", remarks: rejectNote.trim() }),
      });
      setTargetSubs(p => p.map(s => s.id === sub.id ? { ...s, status: "Pending Rep", remarks: rejectNote.trim() } : s));
      setActioned(prev => new Set(prev).add(sub.id));
      setRejectId(null);
      setRejectNote("");
    } catch (e: any) {
      showToast(e?.body?.error ?? "Failed to reject", "err");
    }
  };

  // Admin: save rep assignments
  const saveAssignments = async () => {
    const entries = Object.entries(managerAssignments).filter(([, mgr]) => mgr);
    if (entries.length === 0) { complete(); return; }
    setSaving(true);
    try {
      await Promise.all(entries.map(([repApiId, mgrStr]) => {
        const repId = repApiId.startsWith("api_") ? Number(repApiId.slice(4)) : Number(repApiId);
        const mgrId = Number(mgrStr);
        return apiFetch(`/api/users/${repId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ managerId: mgrId }),
        });
      }));
      complete();
    } catch (e: any) {
      showToast(e?.body?.error ?? "Failed to save assignments", "err");
    } finally {
      setSaving(false);
    }
  };

  // Mark wizard complete
  const complete = () => {
    localStorage.setItem(`otv_wizard_${user.id}`, "1");
    onComplete();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: "36px 40px", width: 680, maxWidth: "96vw", maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.7)",
      }}>
        <StepBar steps={stepLabels} current={step} C={C} />

        {/* ─── STEP 0: Profile ─────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
              {isAdmin ? "Welcome, Admin!" : "Welcome! Let's set up your profile"}
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: C.dim, fontFamily: "'DM Sans',sans-serif" }}>
              {isNSH ? "NSH oversees all regions — no region selection needed." : "Fill in your details to get started."}
            </p>

            <Field label="Full Name *">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                style={inputStyle(C)} autoFocus />
            </Field>

            {(isRep || isRH) && (
              <Field label="Region *">
                <select value={region} onChange={e => setRegion(e.target.value)} style={inputStyle(C)}>
                  <option value="">— Select region —</option>
                  {WIZARD_REGIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
            )}

            {isRep && (
              <Field label="Reporting Manager">
                <select value={managerId ?? ""} onChange={e => setManagerId(e.target.value ? Number(e.target.value) : null)} style={inputStyle(C)}>
                  <option value="">— Select Region Head —</option>
                  {regionHeads.map(rh => {
                    const rhId = rh._apiId ?? rh.id;
                    return <option key={rhId} value={rhId}>{rh.name || rh.email}</option>;
                  })}
                </select>
              </Field>
            )}

            <button onClick={saveProfile} disabled={saving}
              style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: 8, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Continue →"}
            </button>
          </>
        )}

        {/* ─── SALES REP STEP 1: Upload Targets ────────────────────────── */}
        {step === 1 && isRep && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>Upload your annual targets</h2>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: C.dim, fontFamily: "'DM Sans',sans-serif" }}>Download the template, fill it in, then upload below.</p>

            {/* Instructions */}
            <div style={{ background: `${C.blue}0f`, border: `1px solid ${C.blue}33`, borderRadius: 8, padding: "14px 16px", marginBottom: 18, fontSize: 12, color: C.text, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: C.accent }}>How to fill the file:</div>
              <div>1. <strong>Agency Name</strong> — enter the media agency (e.g. Mindshare, Dentsu). If direct, enter <code>NA</code>.</div>
              <div>2. <strong>Client Name</strong> — enter the advertiser/brand name.</div>
              <div>3. <strong>Brand Name</strong> — enter the specific brand or product. If one brand, repeat the client name.</div>
              <div>4. <strong>April through March</strong> — enter monthly targets in rupees (numbers only, no commas or ₹).</div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={downloadSample}
                style={{ flex: 1, padding: "10px 0", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                ⬇ Download Sample File
              </button>
              <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0", background: `${C.blue}18`, border: `1px dashed ${C.blue}66`, borderRadius: 6, color: C.blue, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                📂 Upload CSV
                <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleCsvFile} style={{ display: "none" }} />
              </label>
            </div>

            {/* Preview table */}
            {csvParsed && csvRows.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>
                  Preview — {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} parsed
                </div>
                <div style={{ overflowX: "auto", borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                    <thead>
                      <tr style={{ background: C.s2 }}>
                        {["Agency","Client","Brand",...FY_MONTHS.map(m=>m.short),"Q1","Q2","Q3","Q4","Annual"].map(h => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: C.muted, fontWeight: 700, whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: i < csvRows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <td style={{ padding: "5px 8px", color: C.dim }}>{r.agencyName || "—"}</td>
                          <td style={{ padding: "5px 8px", color: C.text, fontWeight: 600 }}>{r.clientName}</td>
                          <td style={{ padding: "5px 8px", color: C.dim }}>{r.brandName || "—"}</td>
                          {FY_MONTHS.map(m => (
                            <td key={m.key} style={{ padding: "5px 8px", color: C.dim, textAlign: "right" }}>
                              {r.months[m.key] ? fmtINR(r.months[m.key]) : "—"}
                            </td>
                          ))}
                          <td style={{ padding: "5px 8px", color: C.text, fontWeight: 600, textAlign: "right" }}>{fmtINR(r.q1)}</td>
                          <td style={{ padding: "5px 8px", color: C.text, fontWeight: 600, textAlign: "right" }}>{fmtINR(r.q2)}</td>
                          <td style={{ padding: "5px 8px", color: C.text, fontWeight: 600, textAlign: "right" }}>{fmtINR(r.q3)}</td>
                          <td style={{ padding: "5px 8px", color: C.text, fontWeight: 600, textAlign: "right" }}>{fmtINR(r.q4)}</td>
                          <td style={{ padding: "5px 8px", color: C.green, fontWeight: 700, textAlign: "right" }}>{fmtINR(r.annual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, padding: "10px 0", border: `1px solid ${C.border}`, background: "transparent", color: C.dim, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>← Back</button>
              {csvParsed && csvRows.length > 0 ? (
                <button onClick={submitCsv} disabled={submitting}
                  style={{ flex: 2, padding: "10px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Submitting…" : `Confirm & Submit ${csvRows.length} client${csvRows.length !== 1 ? "s" : ""} →`}
                </button>
              ) : (
                <button onClick={() => setStep(2)}
                  style={{ flex: 2, padding: "10px 0", border: `1px dashed ${C.border}`, background: "transparent", color: C.dim, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                  Skip for now →
                </button>
              )}
            </div>
          </>
        )}

        {/* ─── RH / NSH STEP 1: Approval ───────────────────────────────── */}
        {step === 1 && (isRH || isNSH) && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
              {isRH ? "Your team has submitted targets for approval" : "Targets are waiting for your approval"}
            </h2>

            {pendingSubs.length === 0 ? (
              <>
                <div style={{ padding: "24px 0", textAlign: "center", color: C.dim, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
                  No targets pending yet. You'll approve them from the Target Approvals tab.
                </div>
                <button onClick={() => setStep(2)} style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  Continue →
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: C.dim, fontFamily: "'DM Sans',sans-serif" }}>
                  Review and approve or reject each submission. You can also do this later from the Targets tab.
                </p>
                <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.s2 }}>
                        {["Sales Rep","Agency","Client","Brand","Q1","Q2","Q3","Q4","Annual","Action"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: ".05em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSubs.map(sub => {
                        const done = actioned.has(sub.id);
                        const clients = sub.clients || [];
                        return clients.map((cl: any, ci: number) => {
                          const q1 = (Number(sub.april)||0)+(Number(sub.may)||0)+(Number(sub.june)||0);
                          const q2 = (Number(sub.july)||0)+(Number(sub.august)||0)+(Number(sub.september)||0);
                          const q3 = (Number(sub.october)||0)+(Number(sub.november)||0)+(Number(sub.december)||0);
                          const q4 = (Number(sub.january)||0)+(Number(sub.february)||0)+(Number(sub.march)||0);
                          return (
                            <React.Fragment key={`${sub.id}-${ci}`}>
                              <tr style={{ borderBottom: `1px solid ${C.border}`, opacity: done ? 0.5 : 1 }}>
                                <td style={{ padding: "7px 10px", color: C.text, fontFamily: "'DM Mono',monospace" }}>{sub.repName || "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.dim, fontFamily: "'DM Mono',monospace" }}>{cl.agency || "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.text, fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{cl.clientCompany || "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.dim, fontFamily: "'DM Mono',monospace" }}>{cl.brand || "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.dim, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{q1 ? fmtINR(q1) : "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.dim, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{q2 ? fmtINR(q2) : "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.dim, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{q3 ? fmtINR(q3) : "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.dim, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{q4 ? fmtINR(q4) : "—"}</td>
                                <td style={{ padding: "7px 10px", color: C.green, fontWeight: 700, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{fmtINR(sub.totalTarget || 0)}</td>
                                <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                                  {done ? (
                                    <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✓ Actioned</span>
                                  ) : (
                                    <div style={{ display: "flex", gap: 5 }}>
                                      <button onClick={() => approve(sub)}
                                        style={{ padding: "4px 10px", background: `${C.green}22`, border: `1px solid ${C.green}55`, color: C.green, borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                        Approve
                                      </button>
                                      <button onClick={() => { setRejectId(sub.id); setRejectNote(""); }}
                                        style={{ padding: "4px 10px", background: `${C.red}18`, border: `1px solid ${C.red}44`, color: C.red, borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {rejectId === sub.id && (
                                <tr>
                                  <td colSpan={10} style={{ padding: "10px 14px", background: `${C.red}08`, borderBottom: `1px solid ${C.border}` }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      <input value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                                        placeholder="Enter rejection remarks…"
                                        style={{ flex: 1, padding: "7px 10px", background: C.surface, border: `1px solid ${C.red}44`, borderRadius: 5, color: C.text, fontSize: 12, fontFamily: "'DM Mono',monospace" }}
                                        autoFocus />
                                      <button onClick={() => reject(sub)}
                                        style={{ padding: "7px 14px", background: C.red, border: "none", color: "#fff", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                        Confirm
                                      </button>
                                      <button onClick={() => setRejectId(null)}
                                        style={{ padding: "7px 10px", background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                        Cancel
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>

                {(actioned.size > 0 || pendingSubs.length === 0) && (
                  <button onClick={() => setStep(2)}
                    style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    Continue →
                  </button>
                )}
                {actioned.size === 0 && (
                  <button onClick={() => setStep(2)} style={{ width: "100%", padding: "10px 0", marginTop: 8, border: `1px dashed ${C.border}`, background: "transparent", color: C.dim, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                    Skip for now →
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ─── ADMIN STEP 1: Assign Reps ───────────────────────────────── */}
        {step === 1 && isAdmin && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>Assign reps to their Region Heads</h2>

            {adminUsersLoading && liveRoles.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: C.dim, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
                Loading users…
              </div>
            ) : unassignedReps.length === 0 ? (
              <>
                <div style={{ padding: "24px 0", textAlign: "center", color: C.dim, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
                  All reps are assigned. You're good to go!
                </div>
                <button onClick={complete} style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  Done ✓
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 12, color: C.dim, fontFamily: "'DM Sans',sans-serif" }}>
                  {unassignedReps.length} unassigned rep{unassignedReps.length !== 1 ? "s" : ""} found.
                </p>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.s2 }}>
                        {["Rep Name","Email","Reports To"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: ".05em", borderBottom: `1px solid ${C.border}` }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedReps.map((rep, i) => {
                        const repKey = rep.id;
                        return (
                          <tr key={repKey} style={{ borderBottom: i < unassignedReps.length - 1 ? `1px solid ${C.border}` : "none" }}>
                            <td style={{ padding: "8px 12px", color: C.text, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{rep.name || "—"}</td>
                            <td style={{ padding: "8px 12px", color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{rep.email}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <select
                                value={managerAssignments[repKey] ?? ""}
                                onChange={e => setManagerAssignments(p => ({ ...p, [repKey]: e.target.value }))}
                                style={{ width: "100%", padding: "6px 10px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 5, color: managerAssignments[repKey] ? C.text : C.muted, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                                <option value="">— Select Region Head —</option>
                                {rhUsers.map(rh => {
                                  const rhId = rh._apiId ?? rh.id;
                                  return <option key={rhId} value={rhId}>{rh.name || rh.email}</option>;
                                })}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button onClick={saveAssignments} disabled={saving}
                  style={{ width: "100%", padding: "12px 0", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Save & Continue →"}
                </button>
              </>
            )}
          </>
        )}

        {/* ─── DONE STEP (last step, non-admin) ────────────────────────── */}
        {step === totalSteps - 1 && !isAdmin && (
          <>
            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
                {isRep ? "You're all set!" : "You're ready to go!"}
              </h2>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: C.dim, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.7 }}>
                {isRep
                  ? "Your targets have been submitted for approval. You'll be notified once your Region Head reviews them."
                  : isRH
                  ? "Approved targets move to NSH for final sign-off. You can review new submissions anytime from the Target Approvals tab."
                  : "Approved targets move to CRO for final sign-off."}
              </p>
              <button onClick={() => { complete(); openWelcomeTour(); }}
                style={{ padding: "12px 36px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Start Tour →
              </button>
              <div style={{ marginTop: 12 }}>
                <button onClick={complete} style={{ background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono',monospace", textDecoration: "underline" }}>
                  Skip tour, go to dashboard
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
