/**
 * PlanCard — stateless meeting chip for the My Plan calendar.
 *
 * Visual state is computed from props (status, date, time) — never stored.
 *   planned + date < today  → Missed / time passed
 *   planned + date = today  → Tap to log
 *   logged (Done)           → Done
 * All interactions bubble via onTap callback; parent decides navigation.
 */

import React from "react";
import { C, TODAY } from "../../utils/palette";

/** DB columns return integers; form fields use strings. Both are valid rep IDs. */
type RepId = number | string | null | undefined;

export interface PlanCardPlan {
  id: string;
  date: string;
  time: string;
  status: string;
  clientAgencyName: string;
  agenda?: string;
  pitchType?: string;
  meetingType?: string;
  meetingKind?: string;
  touchpointType?: string;
  autoCreatedFrom?: string;
  blocked?: boolean;
  dealNextStep?: string | null;
  loggedMeetingId?: string | null;
  meetingDbId?: string;
  client?: string;
  agency?: string;
  brand?: string;
  contactName?: string;
  phone?: string;
  repId?: RepId;
  isUnplanned?: boolean;
}

interface PlanCardProps {
  plan: PlanCardPlan;
  isOpen?: boolean;
  onTap: (plan: PlanCardPlan) => void;
  children?: React.ReactNode;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan: p, isOpen = false, onTap, children }) => {
  const nowHHMM    = new Date().toTimeString().slice(0, 5);
  const isFuture   = p.date > TODAY && p.status !== "Done";
  const isDone     = p.status === "Done";
  /* Past-date, not logged = Missed (computed upstream or derived here) */
  const isMissed   = !isDone && !isFuture && (p.status === "Missed" || (p.date < TODAY));
  /* Time has passed today but meeting not yet logged */
  const timePassed = !isDone && !isMissed && p.date === TODAY && !!p.time && p.time < nowHHMM;
  const blocked    = p.blocked && !isDone;

  const cardBg  = isDone ? `${C.green}10` : isMissed ? `${C.red}06` : blocked ? `${C.orange}06` : timePassed ? `${C.red}08` : isOpen ? `${C.accent}10` : C.s2;
  const cardBrd = isDone ? `2px solid ${C.green}55` : isMissed ? `2px solid ${C.red}33` : timePassed ? `2px solid ${C.red}55` : blocked ? `1px solid ${C.orange}44` : isOpen ? `1px solid ${C.accent}55` : `1px solid ${C.border}`;

  const circleColor = isDone ? C.green : isMissed ? C.red : timePassed ? C.red : C.muted;
  const circleFill  = isDone ? "filled" : "hollow";

  const typeTag =
    p.autoCreatedFrom === "follow-up"   ? "📞 Follow-up" :
    p.autoCreatedFrom === "next-meeting" ? "📅 Next Mtg"  :
    p.autoCreatedFrom === "next-step"   ? "⚡ Action"    : null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => onTap(p)}
        style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "8px 10px", background: cardBg, borderRadius: 6,
          border: cardBrd, cursor: isFuture ? "default" : "pointer",
          transition: "all .1s", opacity: isFuture ? 0.8 : 1,
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${circleColor}`,
          background: circleFill === "filled" ? circleColor : "transparent",
          flexShrink: 0, marginTop: 2,
          animation: timePassed ? "planPulse 1.5s ease-in-out infinite" : undefined,
        }} />
        <span style={{ fontSize: 10, color: C.dim, whiteSpace: "nowrap", marginTop: 1 }}>
          🕐 {p.time}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.clientAgencyName}</div>
          {p.agenda && (
            <div style={{ fontSize: 10, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.agenda}
            </div>
          )}
          {blocked && p.dealNextStep && (
            <div style={{ fontSize: 10, color: C.orange, marginTop: 2 }}>
              ⚠ Blocked: {p.dealNextStep}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          {typeTag && <span style={{ fontSize: 9, color: circleColor, fontWeight: 700 }}>{typeTag}</span>}
          {p.pitchType && (
            <span style={{ background: `${C.accent}18`, color: C.accent, padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>
              {p.pitchType}
            </span>
          )}
          <span style={{ background: `${circleColor}22`, color: circleColor, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
            {isDone ? "Done" : p.status === "Cancelled" ? "Cancelled" : isFuture ? "📅 Upcoming" : isMissed ? "⚠ Missed" : "Tap to log"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
};

export default PlanCard;
