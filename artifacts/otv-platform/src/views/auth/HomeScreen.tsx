// @ts-nocheck
import React from "react";

export function HomeScreen({ user, onSelect, onLogout }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name || "").split(" ")[0];

  return (
    <div style={{ fontFamily:"'DM Mono','JetBrains Mono',monospace", background:"#f0f4f9", minHeight:"100vh", display:"flex", flexDirection:"column", color:"#18243a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .home-tile{background:#ffffff;border:1px solid #c8d3e5;border-radius:14px;padding:40px 36px;cursor:pointer;transition:border-color .2s,background .2s,transform .15s,box-shadow .2s;display:flex;flex-direction:column;align-items:flex-start;gap:14px;text-align:left;box-shadow:0 2px 12px rgba(0,0,0,.06)}
        .home-tile:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,0,0,.12)}
        .home-tile-ro:hover{border-color:#7920e8;background:#faf6ff}
        .home-tile-crm:hover{border-color:#c47d00;background:#fffbf0}
      `}</style>

      {/* TOPBAR */}
      <div style={{ background:"#ffffff", borderBottom:"1px solid #c8d3e5", padding:"0 32px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:7, padding:"5px 10px", fontSize:13, fontWeight:700, letterSpacing:2, color:"#fff" }}>OTV</div>
          <span style={{ color:"#c8d3e5" }}>|</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:"#4d5e78", letterSpacing:2, textTransform:"uppercase" }}>Platform</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"#7920e820", border:"1px solid #7920e850", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#7920e8" }}>
            {(user.name||"?")[0].toUpperCase()}
          </div>
          <span style={{ fontSize:12, color:"#4d5e78" }}>{user.name}</span>
          <button onClick={onLogout} style={{ background:"transparent", border:"1px solid #c8d3e5", borderRadius:4, padding:"3px 10px", color:"#4d5e78", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#c92828";e.currentTarget.style.color="#c92828";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="#c8d3e5";e.currentTarget.style.color="#4d5e78";}}>
            Sign out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>

        {/* GREETING */}
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:28, fontWeight:800, marginBottom:6, letterSpacing:-.5, color:"#18243a" }}>
            {greeting}, {firstName} 👋
          </div>
          <div style={{ fontSize:13, color:"#4d5e78" }}>
            {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })} · Odisha Television Network
          </div>
        </div>

        {/* TWO TILES */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, width:"100%", maxWidth:720 }}>

          {/* RO MANAGEMENT TILE */}
          <div className="home-tile home-tile-ro" onClick={() => window.open("https://dealroreader.replit.app", "_blank")}>
            <div style={{ width:48, height:48, borderRadius:12, background:"#7920e818", border:"1px solid #7920e840", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              📋
            </div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:"#18243a", marginBottom:6, letterSpacing:-.3 }}>RO Management</div>
              <div style={{ fontSize:12, color:"#4d5e78", lineHeight:1.6 }}>Parse Release Orders from any agency format. Export Zoho-ready Deal + Breakup sheets. View and manage all saved ROs.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              {["PDF","Excel","Images","CSV"].map(f => (
                <span key={f} style={{ background:"#7920e815", color:"#7920e8", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600 }}>{f}</span>
              ))}
              {["WPP","Madison","Zenith","ENES"].map(f => (
                <span key={f} style={{ background:"#e8eef7", color:"#4d5e78", padding:"2px 8px", borderRadius:10, fontSize:10 }}>{f}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, color:"#7920e8", fontSize:12, fontWeight:600 }}>
              Open RO Module <span style={{ fontSize:16 }}>→</span>
            </div>
          </div>

          {/* CRM TILE */}
          <div className="home-tile home-tile-crm" onClick={() => onSelect("crm")}>
            <div style={{ width:48, height:48, borderRadius:12, background:"#c47d0018", border:"1px solid #c47d0040", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              ⬡
            </div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:800, color:"#18243a", marginBottom:6, letterSpacing:-.3 }}>OTV CRM</div>
              <div style={{ fontSize:12, color:"#4d5e78", lineHeight:1.6 }}>Pipeline, targets, team scorecards, meeting logs, escalations, HR compliance and absence reports.</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              {["War Room","Pipeline","Targets","Team","HR Reports"].map(f => (
                <span key={f} style={{ background:"#c47d0015", color:"#c47d00", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:600 }}>{f}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, color:"#c47d00", fontSize:12, fontWeight:600 }}>
              Open CRM <span style={{ fontSize:16 }}>→</span>
            </div>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <div style={{ marginTop:40, fontSize:11, color:"#8a97ae", textAlign:"center" }}>
          Odisha Television Network · Internal platform · Not for external distribution
        </div>
      </div>
    </div>
  );
}
