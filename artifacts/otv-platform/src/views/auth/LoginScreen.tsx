// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import * as authSvc from "../../services/api/auth";
import { setSessionToken as setSessionTokenLib } from "../../services/api/_client";

const GOOGLE_CLIENT_ID = "773380743026-i87vjdrj5n699von60sa3plqqv95mlem.apps.googleusercontent.com";
const ZOHO_CLIENT_ID   = "1000.TQ0C2M1CLOJC0ES8EPEJJWG5LUJ9ON";

function setSessionTokenStore(t) {
  setSessionTokenLib(t);
}

export function LoginScreen({ onLogin }) {
  const [mode, setMode]           = useState("options"); // "options" | "email"
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [name, setName]           = useState("");
  const [phone, setPhone]         = useState("");
  const [designation, setDesig]   = useState("");
  const [intendedRole, setRole]   = useState("SALES REP");
  const [preferredRegion, setReg] = useState("North");
  const [isNew, setIsNew]         = useState(false);
  const [err, setErr]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [pendingApproval, setPendingApproval] = useState<any>(null);

  const googleReady           = useRef(false);
  const hiddenGoogleBtn       = useRef(null);

  useEffect(() => {
    function initGIS() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (hiddenGoogleBtn.current) {
        window.google.accounts.id.renderButton(hiddenGoogleBtn.current, {
          theme: "outline", size: "large", width: 400,
        });
      }
      googleReady.current = true;
    }
    if (window.google?.accounts?.id) { initGIS(); return; }
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) { clearInterval(interval); initGIS(); }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  function handleGoogleCredential(response) {
    try {
      const parts = response.credential.split(".");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      onLogin({ name: payload.name || payload.email, email: payload.email, picture: payload.picture, provider:"google" });
    } catch (e) {
      setErr("Google sign-in failed. Please try email login.");
      setLoading(false);
    }
  }

  function handleGoogleClick() {
    setErr(""); setLoading(true);
    if (googleReady.current && window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const btn = hiddenGoogleBtn.current?.querySelector("div[role='button']");
          if (btn) { btn.click(); }
          else { setErr("Google Sign-In popup was blocked. Please allow popups and try again."); setLoading(false); }
        }
      });
    } else {
      setLoading(false);
      setErr("Google Sign-In is still loading. Please wait a moment and try again.");
    }
  }

  function handleZohoClick() {
    setErr(""); setLoading(true);
    const redirectUri = window.location.origin + window.location.pathname.replace(/\/$/g, "");
    const scope = "AaaServer.profile.Read";
    const authUrl = `https://accounts.zoho.in/oauth/v2/auth?response_type=token&client_id=${ZOHO_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=online&prompt=consent`;
    const popup = window.open(authUrl, "zoho-login", "width=560,height=660,left=300,top=80");
    if (!popup) {
      setErr("Popup was blocked. Please allow popups for this site and try again.");
      setLoading(false);
      return;
    }
    const timer = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          setErr("Zoho sign-in was cancelled.");
          setLoading(false);
          return;
        }
        const href = popup.location.href;
        if (href && href.includes("access_token")) {
          clearInterval(timer);
          const hash = popup.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          const token = params.get("access_token");
          popup.close();
          try {
            const resp = await fetch("https://accounts.zoho.in/oauth/v2/userinfo", {
              headers: { Authorization: `Zoho-oauthtoken ${token}` },
            });
            const profile = await resp.json();
            const displayName = profile.display_name || profile.given_name || profile.first_name || profile.email;
            onLogin({ name: displayName, email: profile.email, picture: profile.picture, provider:"zoho" });
          } catch (e) {
            setErr("Could not fetch Zoho profile. Please try again.");
            setLoading(false);
          }
        }
      } catch (_) {
        // Cross-origin error while popup is on Zoho's domain — safe to ignore, keep polling
      }
    }, 500);
  }


  const DEMO_ACCOUNTS = [
    { label:"Darpan (CRO)",        email:"darpan@odishatv.com",     role:"CRO",            color:"#065f46" },
    { label:"Sales Head (NSH)",    email:"saleshead@odishatv.com",  role:"SALES HEAD",     color:"#0891b2" },
    { label:"Sachin (Strategy)",   email:"sachin@odishatv.com",     role:"SALES STRATEGY", color:"#7c2d12" },
    { label:"Digi Ops",            email:"digiops@odishatv.com",    role:"DIGI OPS",       color:"#1e40af" },
    { label:"RH – National",       email:"rh.national@odishatv.com", role:"REGION HEAD",    color:"#7c3aed" },
    { label:"RH – North",          email:"rh.north@odishatv.com",   role:"REGION HEAD",    color:"#7c3aed" },
    { label:"Arjun (Sales Rep)",   email:"arjun@odishatv.com",      role:"SALES REP",      color:"#2563eb" },
    { label:"Vikram (Sales Rep)",  email:"vikram@odishatv.com",     role:"SALES REP",      color:"#2563eb" },
  ];

  const handleEmail = async (e) => {
    e.preventDefault(); setErr("");
    if (!email.trim()) { setErr("Email is required"); return; }
    if (!isNew && !password.trim()) { setErr("Password is required"); return; }
    if (isNew && !name.trim()) { setErr("Full name is required"); return; }
    if (isNew && !phone.trim()) { setErr("Phone number is required"); return; }
    setLoading(true);
    try {
      if (isNew) {
        // Signup: POST to API signup endpoint
        const data = await authSvc.signup({
          name: name.trim(), email: email.toLowerCase().trim(), password,
          phone: phone.trim(), designation: designation.trim(),
          intendedRole, preferredRegion,
        });
        if (data.ok) {
          setPendingApproval({ name: name.trim(), email: email.toLowerCase().trim() });
        } else {
          setErr(data.error || "Registration failed. Try again.");
        }
        setLoading(false);
        return;
      }

      // Login: always call the API — creates a real server session
      const data = await authSvc.login(email.toLowerCase().trim(), password);
      if (data.ok) {
        if (data.token) setSessionTokenStore(data.token); // persist for session restore
        onLogin(data.user);
      } else if (data.httpStatus === 403) {
        // Account exists but pending admin approval
        setPendingApproval({ name: data.user?.name || email, email: email.toLowerCase().trim() });
        setLoading(false);
      } else {
        setErr(data.error || "Incorrect email or password.");
        setLoading(false);
      }
    } catch {
      setErr("Network error — check your connection."); setLoading(false);
    }
  };

  const handleDemo = (account) => {
    setLoading(true);
    authSvc.login(account.email, "demo123")
      .then(data => {
        if (data.ok) {
          if (data.token) setSessionTokenStore(data.token); // persist for session restore
          onLogin(data.user);
        } else setLoading(false);
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  };

  // ── Pending-approval holding screen ──
  if (pendingApproval) return (
    <div style={{fontFamily:"'DM Mono','JetBrains Mono',monospace",background:"#f0f4f9",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12}}>
            <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:10,padding:"8px 14px",fontSize:15,fontWeight:700,color:"#fff",letterSpacing:2}}>OTV</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:16,fontWeight:700,color:"#18243a",letterSpacing:1}}>OTV CRM</div>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #c8d3e5",borderRadius:12,padding:"32px 28px",boxShadow:"0 4px 24px rgba(0,0,0,.08)",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:16}}>⏳</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:17,fontWeight:700,color:"#18243a",marginBottom:8}}>Access Request Submitted</div>
          <div style={{fontSize:12,color:"#4d5e78",lineHeight:1.7,marginBottom:20}}>
            Hi <strong>{pendingApproval.name}</strong>, your request has been sent to the admin.<br/>
            Once approved, you can sign in and get started.<br/>
            <span style={{fontSize:11,color:"#8a97ae"}}>Requested role: {pendingApproval.intendedRole} · {pendingApproval.preferredRegion}</span>
          </div>
          <div style={{background:"#f0f4f9",border:"1px solid #c8d3e5",borderRadius:8,padding:"12px 16px",marginBottom:20,textAlign:"left"}}>
            {[["Name",pendingApproval.name],["Email",pendingApproval.email],["Phone",pendingApproval.phone||"—"],["Designation",pendingApproval.designation||"—"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",gap:8,fontSize:11,marginBottom:4}}>
                <span style={{color:"#8a97ae",minWidth:80}}>{l}</span>
                <span style={{color:"#18243a",fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setPendingApproval(null)}
            style={{background:"transparent",border:"1px solid #c8d3e5",borderRadius:6,padding:"9px 20px",color:"#4d5e78",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'DM Mono','JetBrains Mono',monospace", background:"#f0f4f9", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .login-input{background:#ffffff;border:1px solid #c8d3e5;border-radius:6px;padding:10px 14px;color:#18243a;font-size:13px;font-family:'DM Mono',monospace;outline:none;width:100%;transition:border-color .15s}
        .login-input:focus{border-color:#7920e8}
        .login-input::placeholder{color:#8a97ae}
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* LOGO */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:10, padding:"8px 14px", fontSize:15, fontWeight:700, color:"#fff", letterSpacing:2 }}>OTV</div>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:16, fontWeight:700, color:"#18243a", letterSpacing:1 }}>OTV CRM</div>
              <div style={{ fontSize:10, color:"#4d5e78", letterSpacing:2, textTransform:"uppercase" }}>Sales Intelligence Platform</div>
            </div>
          </div>
        </div>

        <div style={{ background:"#ffffff", border:"1px solid #c8d3e5", borderRadius:12, overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,.08)" }}>

          {/* HEADER */}
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #c8d3e5" }}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#18243a", marginBottom:3 }}>
              {mode==="email" ? (isNew ? "Create account" : "Sign in") : "Sign in"}
            </div>
            <div style={{ fontSize:11, color:"#4d5e78" }}>Odisha Television Network · Internal use only</div>
          </div>

          <div style={{ padding:24 }}>
            {mode==="options" && (
              <>
                {/* Google */}
                <button
                  onClick={handleGoogleClick}
                  disabled={loading}
                  style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", color:"#3c4043", border:"1px solid #dadce0", borderRadius:6, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", width:"100%", marginBottom:10, transition:"box-shadow .15s" }}
                  onMouseOver={e=>e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,.3)"}
                  onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
                  Continue with Google
                </button>

                {/* Zoho */}
                <button
                  onClick={handleZohoClick}
                  disabled={loading}
                  style={{ display:"flex", alignItems:"center", gap:10, background:"#e42527", color:"#fff", border:"none", borderRadius:6, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", width:"100%", marginBottom:16, transition:"opacity .15s" }}
                  onMouseOver={e=>e.currentTarget.style.opacity=".88"}
                  onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                  <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="4" fill="#e42527"/><text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">Z</text></svg>
                  Continue with Zoho
                </button>

                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:"#c8d3e5" }} />
                  <span style={{ fontSize:11, color:"#4d5e78" }}>or</span>
                  <div style={{ flex:1, height:1, background:"#c8d3e5" }} />
                </div>

                {/* Email */}
                <button onClick={() => setMode("email")} style={{ width:"100%", background:"transparent", border:"1px solid #c8d3e5", borderRadius:6, padding:"10px 16px", color:"#18243a", fontSize:13, cursor:"pointer", fontFamily:"'DM Mono',monospace", transition:"border-color .15s", marginBottom:10 }}
                  onMouseOver={e=>e.currentTarget.style.borderColor="#7920e8"}
                  onMouseOut={e=>e.currentTarget.style.borderColor="#c8d3e5"}>
                  Continue with Email →
                </button>

                {/* Demo access */}
                <div style={{ marginTop:20, borderTop:"1px solid #c8d3e5", paddingTop:16 }}>
                  <div style={{ fontSize:10, color:"#4d5e78", fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", marginBottom:10, textAlign:"center" }}>Demo Access</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    {[
                      { label:"Sales Rep",           email:"arjun@odishatv.com",      color:"#1d5db4" },
                      { label:"Region Head",          email:"rh.north@odishatv.com",    color:"#7920e8" },
                      { label:"National Sales Head",  email:"saleshead@odishatv.com",   color:"#0369a1" },
                      { label:"Digi Ops",             email:"digiops@odishatv.com",     color:"#1e40af" },
                      { label:"Sales Strategy",       email:"sachin@odishatv.com",      color:"#15803d" },
                      { label:"CRO",                  email:"darpan@odishatv.com",      color:"#c47d00" },
                    ].map(a => (
                      <button key={a.email}
                        onClick={() => handleDemo(a)}
                        style={{ background:"#f0f4f9", border:`1px solid ${a.color}44`, borderRadius:6, padding:"8px 10px", cursor:"pointer", textAlign:"left", transition:"border-color .15s, background .15s" }}
                        onMouseOver={e=>{ e.currentTarget.style.borderColor=a.color; e.currentTarget.style.background="#e8eef7"; }}
                        onMouseOut={e=>{ e.currentTarget.style.borderColor=`${a.color}44`; e.currentTarget.style.background="#f0f4f9"; }}>
                        <div style={{ fontSize:11, fontWeight:700, color:a.color, fontFamily:"'DM Sans',sans-serif", marginBottom:1 }}>{a.label}</div>
                        <div style={{ fontSize:9, color:"#8a97ae", letterSpacing:".04em" }}>demo</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin quick-login — bottom, subtle */}
                <button
                  onClick={() => handleDemo({ label:"Admin", email:"admin@odishatv.com", role:"ADMIN" })}
                  style={{ width:"100%", marginTop:10, background:"transparent", border:"1px solid #c8d3e544", borderRadius:6, padding:"8px 16px", color:"#8a97ae", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:".04em" }}>
                  ⚙ Admin access
                </button>

                {err && <div style={{ marginTop:12, background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#c92828" }}>{err}</div>}
              </>
            )}

            {mode==="email" && (
              <form onSubmit={handleEmail}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {isNew && (
                    <>
                      <div>
                        <label style={{fontSize:10,color:"#4d5e78",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Full Name *</label>
                        <input className="login-input" type="text" placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)} autoFocus />
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontSize:10,color:"#4d5e78",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Phone *</label>
                          <input className="login-input" type="tel" placeholder="Mobile number" value={phone} onChange={e=>setPhone(e.target.value)} />
                        </div>
                        <div>
                          <label style={{fontSize:10,color:"#4d5e78",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Designation</label>
                          <input className="login-input" type="text" placeholder="e.g. Sales Manager" value={designation} onChange={e=>setDesig(e.target.value)} />
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontSize:10,color:"#4d5e78",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Intended Role</label>
                          <select className="login-input" value={intendedRole} onChange={e=>setRole(e.target.value)} style={{padding:"10px 14px"}}>
                            {["SALES REP","REGION HEAD","SALES HEAD","SALES STRATEGY","CRO","DIGI OPS"].map(r=><option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{fontSize:10,color:"#4d5e78",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Region</label>
                          <select className="login-input" value={preferredRegion} onChange={e=>setReg(e.target.value)} style={{padding:"10px 14px"}}>
                            {["North","South","East","West","National"].map(r=><option key={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#0369a1"}}>
                        Your request will be reviewed by the admin before you can access the platform.
                      </div>
                    </>
                  )}
                  <div>
                    <label style={{ fontSize:10, color:"#4d5e78", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Email</label>
                    <input className="login-input" type="email" placeholder="you@odishatv.com" value={email} onChange={e=>setEmail(e.target.value)} autoFocus={!isNew} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:"#4d5e78", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>Password</label>
                    <input className="login-input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
                  </div>

                  {err && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#c92828" }}>{err}</div>}

                  <button type="submit" style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:6, padding:"11px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>
                    {isNew ? "Create Account" : "Sign In"}
                  </button>

                  <div style={{ textAlign:"center", fontSize:12, color:"#4d5e78" }}>
                    {isNew
                      ? <span>Already have an account? <button type="button" onClick={()=>{setIsNew(false);setErr("");}} style={{ color:"#7920e8", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Sign in</button></span>
                      : <span>No account? <button type="button" onClick={()=>{setIsNew(true);setErr("");}} style={{ color:"#7920e8", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Create one</button></span>
                    }
                  </div>

                  <button type="button" onClick={()=>{setMode("options");setErr("");}} style={{ background:"transparent", border:"none", color:"#4d5e78", fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>← Back</button>
                </div>
              </form>
            )}

            {err && mode==="options" && <div style={{ marginTop:12, background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:5, padding:"8px 12px", fontSize:12, color:"#c92828" }}>{err}</div>}
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:10, color:"#8a97ae" }}>
          OTV CRM · Internal platform · Odisha Television Network
        </div>
      </div>
    </div>
  );
}
