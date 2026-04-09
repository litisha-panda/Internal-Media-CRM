import React, { useState } from "react";
import { C } from "../constants";
import type { NoteModalConfig } from "../types";

interface NoteModalProps {
  noteModal: NoteModalConfig | null;
  onClose: () => void;
}

export function NoteModal({ noteModal, onClose }: NoteModalProps) {
  const [val, setVal] = useState(noteModal?.initial || "");

  if (!noteModal) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, width: 380 }}>
        <div className="sans" style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{noteModal.title}</div>
        <textarea
          autoFocus
          rows={3}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              noteModal.onSubmit(val || noteModal.placeholder);
              onClose();
            }
          }}
          style={{ width: "100%", padding: "9px 12px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }}
          placeholder={noteModal.placeholder}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { noteModal.onSubmit(val || noteModal.placeholder); onClose(); }}
            style={{ padding: "7px 18px", background: C.accent, border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
