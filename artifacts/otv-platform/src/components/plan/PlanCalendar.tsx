/**
 * PlanCalendar — stateless monthly calendar grid for My Plan.
 *
 * Renders a 7-column month grid with plan chips per cell.
 * All state lives in the parent; callbacks bubble navigation.
 * Calendar chip visual state is computed from plan.date + plan.status (never stored).
 */

import React from "react";
import { C, TODAY } from "../../utils/palette";
import { PlanCard } from "./PlanCard";
import type { PlanCardPlan } from "./PlanCard";

export interface PlanCalendarProps {
  /** All plans visible to this rep/user */
  plans: PlanCardPlan[];
  /** Current month offset in 4-week units (0 = current month) */
  weekOffset: number;
  /** Date string selected for day-drill-down, or null */
  dayView: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayClick: () => void;
  onDayClick: (date: string) => void;
  onPlanTap: (plan: PlanCardPlan) => void;
  onAddForDate: (date: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const PlanCalendar: React.FC<PlanCalendarProps> = ({
  plans,
  weekOffset,
  dayView,
  onPrevMonth,
  onNextMonth,
  onTodayClick,
  onDayClick,
  onPlanTap,
  onAddForDate,
}) => {
  const ref = new Date(Date.now() + weekOffset * 28 * 86400000);
  const year  = ref.getFullYear();
  const month = ref.getMonth(); // 0-indexed
  const monthLabel = ref.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const firstDow = (firstDay.getDay() + 6) % 7; // 0=Mon
  const totalDays = lastDay.getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={onPrevMonth}
            style={{ background: C.s2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 10px", color: C.dim, cursor: "pointer", fontSize: 14 }}
          >
            ‹
          </button>
          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13, color: C.text, minWidth: 140, textAlign: "center" }}>
            {monthLabel}
          </span>
          <button
            onClick={onNextMonth}
            style={{ background: C.s2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 10px", color: C.dim, cursor: "pointer", fontSize: 14 }}
          >
            ›
          </button>
        </div>
        <button
          onClick={onTodayClick}
          style={{ background: C.s2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 10px", color: weekOffset === 0 ? C.accent : C.dim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace" }}
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ fontSize: 10, fontWeight: 700, color: C.muted, textAlign: "center", padding: "4px 0", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: ".06em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} />;
          const isToday    = date === TODAY;
          const isPast     = date < TODAY;
          const isSelected = date === dayView;
          const dayPlans   = plans.filter(p => p.date === date && p.autoCreatedFrom !== "action-item");
          const hasLogged  = dayPlans.some(p => p.status === "Done");
          const hasMissed  = isPast && dayPlans.length > 0 && dayPlans.some(p => p.status !== "Done");

          return (
            <div
              key={date}
              onClick={() => onDayClick(date)}
              style={{
                minHeight: 72, padding: "6px 6px 4px", borderRadius: 6, cursor: "pointer",
                background: isSelected ? `${C.accent}10` : isToday ? `${C.blue}08` : C.surface,
                border: isSelected ? `2px solid ${C.accent}55` : isToday ? `2px solid ${C.blue}44` : `1px solid ${C.border}`,
                transition: "box-shadow .1s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px #1d5db418"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: isToday ? 800 : 600,
                  color: isToday ? C.blue : isPast ? C.dim : C.text,
                  fontFamily: "'DM Mono',monospace",
                }}>
                  {parseInt(date.slice(8))}
                </span>
                {hasLogged  && <span style={{ fontSize: 9, color: C.green, fontWeight: 700 }}>✓</span>}
                {hasMissed  && <span style={{ fontSize: 9, color: C.red, fontWeight: 700 }}>!</span>}
              </div>
              {dayPlans.slice(0, 2).map(p => {
                const isDone = p.status === "Done";
                const color  = isDone ? C.green : p.date < TODAY ? C.red : C.accent;
                return (
                  <div
                    key={p.id}
                    onClick={e => { e.stopPropagation(); onPlanTap(p); }}
                    style={{
                      fontSize: 9, background: `${color}18`, color, borderRadius: 3, padding: "1px 4px",
                      marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {p.time} {p.clientAgencyName}
                  </div>
                );
              })}
              {dayPlans.length > 2 && (
                <div style={{ fontSize: 9, color: C.muted, textAlign: "right" }}>+{dayPlans.length - 2} more</div>
              )}
              {dayPlans.length === 0 && !isPast && (
                <div
                  onClick={e => { e.stopPropagation(); onAddForDate(date); }}
                  style={{ fontSize: 9, color: C.s3, textAlign: "center", paddingTop: 6, cursor: "pointer" }}
                >
                  + add
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanCalendar;
