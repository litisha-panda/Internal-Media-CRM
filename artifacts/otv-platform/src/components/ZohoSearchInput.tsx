import { useState, useEffect, useRef, useCallback } from "react";

interface ZohoResult {
  id: string;
  name: string;
}

interface Props {
  value: string;
  zohoId: string;
  onChange: (name: string, zohoId: string) => void;
  endpoint: "/api/zoho/clients" | "/api/zoho/agencies";
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const C = {
  surface: "#ffffff",
  s2:      "#f0f4f9",
  s3:      "#e2e8f2",
  border:  "#d6dce8",
  text:    "#18243a",
  dim:     "#4d5e78",
  muted:   "#8596b0",
  green:   "#15803d",
  orange:  "#c47d00",
  red:     "#c92828",
};

function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export default function ZohoSearchInput({
  value,
  zohoId,
  onChange,
  endpoint,
  placeholder = "Type to search…",
  style,
  disabled,
}: Props) {
  const [query,   setQuery]   = useState(value);
  const [results, setResults] = useState<ZohoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [zohoDown, setZohoDown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep local query in sync when value changes externally
  useEffect(() => { setQuery(value); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchResults = useCallback(
    debounce(async (q: string) => {
      if (q.length < 3) { setResults([]); setLoading(false); return; }
      setLoading(true);
      setZohoDown(false);
      try {
        const res  = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { ok: boolean; results?: ZohoResult[]; error?: string };
        if (data.ok && data.results) {
          setResults(data.results.slice(0, 12));
          setOpen(true);
        } else {
          setZohoDown(true);
          setResults([]);
        }
      } catch {
        setZohoDown(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300) as (q: string) => void,
    [endpoint],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onChange(q, ""); // clear zohoId when user types
    if (q.length >= 3) fetchResults(q);
    else { setResults([]); setOpen(false); }
  };

  const handleSelect = (r: ZohoResult) => {
    setQuery(r.name);
    onChange(r.name, r.id);
    setOpen(false);
    setResults([]);
  };

  const isVerified = Boolean(zohoId);

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 36px 9px 12px",
            background: C.s2,
            border: `1px solid ${isVerified ? C.green : zohoDown ? C.orange : C.border}`,
            borderRadius: 6,
            color: C.text,
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
          }}
        />
        {/* Right-side indicator */}
        <div style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 12, pointerEvents: "none",
          color: isVerified ? C.green : loading ? C.muted : C.muted,
        }}>
          {loading ? "…" : isVerified ? "✓" : "⌕"}
        </div>
      </div>

      {/* Verified badge */}
      {isVerified && (
        <div style={{ fontSize: 10, color: C.green, marginTop: 3 }}>
          ✓ Verified in Zoho · ID {zohoId.slice(0, 10)}…
        </div>
      )}

      {/* Zoho unavailable warning */}
      {zohoDown && (
        <div style={{ fontSize: 10, color: C.orange, marginTop: 3 }}>
          ⚠ Zoho unavailable — type client name carefully. This may affect revenue matching.
        </div>
      )}

      {/* Hint */}
      {!isVerified && !zohoDown && query.length > 0 && query.length < 3 && (
        <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
          Type 3+ characters to search Zoho
        </div>
      )}

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          zIndex: 9999,
          maxHeight: 260,
          overflowY: "auto",
          marginTop: 3,
        }}>
          {results.map((r) => (
            <div
              key={r.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              style={{
                padding: "9px 14px",
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                color: C.text,
                cursor: "pointer",
                borderBottom: `1px solid ${C.s3}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.s2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>{r.name}</span>
              <span style={{ fontSize: 9, color: C.muted }}>Zoho ID</span>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {open && results.length === 0 && !loading && query.length >= 3 && !zohoDown && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: "10px 14px",
          fontSize: 11, color: C.muted, zIndex: 9999, marginTop: 3,
        }}>
          No Zoho matches for "{query}" — you can still save this name manually.
        </div>
      )}
    </div>
  );
}
