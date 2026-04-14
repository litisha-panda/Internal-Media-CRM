/**
 * SearchableSelect — a minimal accessible combobox.
 *
 * Shows a text input that filters a list of options; selecting one
 * calls onChange. Supports an optional "N/A" and "+ Add new" sentinel.
 *
 * Props:
 *   options      — array of { value, label } to show in the list
 *   value        — currently selected value (controlled)
 *   onChange     — called with value when an option is picked
 *   onAddNew     — if provided, shows "+ Add new…" at the bottom; called on click
 *   placeholder  — input placeholder
 *   naLabel      — if provided, shows an "N/A / No X" option; its value is "NA"
 *   style        — container style overrides
 *   inputStyle   — input element style overrides
 */

import React, { useState, useRef, useEffect } from "react";
import { C } from "../../utils/palette";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  onAddNew?: () => void;
  placeholder?: string;
  naLabel?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options, value, onChange, onAddNew,
  placeholder = "Search or select…",
  naLabel,
  style,
  inputStyle,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label
    ?? (value === "NA" ? (naLabel ?? "N/A") : "");

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleOpen = () => { setOpen(true); setQuery(""); };
  const handleSelect = (val: string) => { onChange(val); setOpen(false); setQuery(""); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const base: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: C.s2, border: `1px solid ${C.border}`,
    borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.text,
    boxSizing: "border-box", outline: "none", cursor: "text",
    ...inputStyle,
  };

  const dropStyle: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
    maxHeight: 220, overflowY: "auto", zIndex: 200,
    boxShadow: "0 4px 16px rgba(0,0,0,.35)",
  };

  const rowStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 10px", fontSize: 12, cursor: "pointer",
    color: active ? C.accent : C.text,
    background: active ? `${C.accent}10` : "transparent",
    fontFamily: "'DM Mono',monospace",
    borderBottom: `1px solid ${C.border}`,
  });

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        readOnly={!open}
        value={open ? query : selectedLabel}
        placeholder={open ? "Type to filter…" : placeholder}
        onFocus={handleOpen}
        onChange={e => setQuery(e.target.value)}
        style={{ ...base, color: selectedLabel && !open ? C.text : C.dim }}
      />
      {open && (
        <div style={dropStyle}>
          {filtered.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 12, color: C.dim, fontFamily: "'DM Mono',monospace" }}>
              No matches
            </div>
          )}
          {filtered.map(o => (
            <div key={o.value} onMouseDown={() => handleSelect(o.value)}
              style={rowStyle(o.value === value)}>
              {o.label}
            </div>
          ))}
          {naLabel && (
            <div onMouseDown={() => handleSelect("NA")}
              style={{ ...rowStyle(value === "NA"), color: C.dim }}>
              {naLabel}
            </div>
          )}
          {onAddNew && (
            <div onMouseDown={onAddNew}
              style={{ ...rowStyle(false), color: C.accent, fontWeight: 700 }}>
              + Add new…
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
