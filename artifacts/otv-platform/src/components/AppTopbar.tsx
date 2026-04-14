import React from "react";
import { USER_ROLES } from "../constants";

interface AppTopbarProps {
  C: any;
  user: any;
  user_role: any;
  activeUser: string;
  setActiveUser: (v: string) => void;
  isMobile: boolean;
  filterQ: string;
  setFilterQ: (v: string) => void;
  filterRegion: string;
  setFilterRegion: (v: string) => void;
  QUARTERS: string[];
  REGIONS: string[];
  globalSearch: string;
  setGlobalSearch: (v: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  searchResults: any[];
  searchRef: React.RefObject<HTMLDivElement | null>;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  countdown: string;
  isRep: boolean;
  isRH: boolean;
  openWelcome: () => void;
  onLogout: () => void;
  setShowHome: (v: boolean) => void;
}

export function AppTopbar({
  C, user, user_role, activeUser, setActiveUser, isMobile,
  filterQ, setFilterQ, filterRegion, setFilterRegion, QUARTERS, REGIONS,
  globalSearch, setGlobalSearch, searchOpen, setSearchOpen, searchResults, searchRef,
  profileOpen, setProfileOpen, countdown, isRep, isRH,
  openWelcome, onLogout, setShowHome,
}: AppTopbarProps) {
  return (
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setShowHome(true)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",gap:5,transition:"border-color .15s,color .15s"}}
          onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
          onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
          ← Home
        </button>
        <span style={{color:C.accent,fontWeight:700,fontSize:14,letterSpacing:3}}>OTV</span>
        <span style={{color:C.muted}}>|</span>
        <span className="sans" style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:2,textTransform:"uppercase"}}>CRM</span>
      </div>

      {!isMobile && (
        <div ref={searchRef} style={{position:"relative",flex:1,maxWidth:320,margin:"0 16px"}}>
          <div style={{position:"relative",display:"flex",alignItems:"center"}}>
            <span style={{position:"absolute",left:9,color:C.dim,fontSize:13,pointerEvents:"none"}}>⌕</span>
            <input
              value={globalSearch}
              onChange={e=>{setGlobalSearch(e.target.value);setSearchOpen(true);}}
              onFocus={()=>setSearchOpen(true)}
              onBlur={()=>setTimeout(()=>setSearchOpen(false),150)}
              placeholder="Search clients, deals, tasks…"
              style={{width:"100%",background:C.s2,border:`1px solid ${globalSearch?C.accent:C.border}`,borderRadius:6,padding:"5px 10px 5px 28px",fontSize:11,color:C.text,fontFamily:"'DM Mono',monospace",outline:"none",transition:"border-color .15s"}}
            />
            {globalSearch && <button onClick={()=>{setGlobalSearch("");setSearchOpen(false);}} style={{position:"absolute",right:7,background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:13,lineHeight:1}}>×</button>}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,zIndex:500,boxShadow:"0 8px 32px rgba(0,0,0,.5)",overflow:"hidden"}}>
              {searchResults.map((r: any, i: number) => (
                <div key={i} onMouseDown={e=>{e.preventDefault();r.action();}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer",borderBottom:i<searchResults.length-1?`1px solid ${C.border}`:"none",transition:"background .1s"}}
                  onMouseOver={e=>e.currentTarget.style.background=C.s2}
                  onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,
                    background: r.type==="deal"?`${C.accent}22`:r.type==="meeting"?`${C.blue}22`:`${C.green}22`,
                    color: r.type==="deal"?C.accent:r.type==="meeting"?C.blue:C.green,
                    whiteSpace:"nowrap"}}>
                    {r.type==="deal"?"DEAL":r.type==="meeting"?"MTG":"TASK"}
                  </span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
                    <div style={{fontSize:10,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {user_role?.role !== "ADMIN" && <select value={filterQ} onChange={e=>setFilterQ(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}>{QUARTERS.map(q=><option key={q}>{q}</option>)}</select>}
        {user_role?.role !== "ADMIN" && user_role.canView==="all" && <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px"}}><option>All</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>}
        <div style={{width:1,height:20,background:C.border}} />
        {["CXO","CEO","CRO"].includes(user_role?.role) && (
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:9,color:C.muted,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Preview as</span>
            <select value={activeUser} onChange={e=>setActiveUser(e.target.value)} style={{width:"auto",fontSize:11,padding:"4px 8px",color:C.accent,background:`${C.accent}18`,borderColor:`${C.accent}44`}}>
              {USER_ROLES.map(u=><option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
            </select>
          </div>
        )}
        <div style={{width:1,height:20,background:C.border}} />
        <button onClick={openWelcome}
          title="Virtual Tour & Help"
          style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,color:C.dim,fontWeight:700,transition:"border-color .15s,color .15s",flexShrink:0}}
          onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
          onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>?</button>

        {(isRep || isRH) && (()=>{
          const hr = new Date().getHours();
          const cdColor = countdown.includes("passed") ? C.red : hr >= 21 ? C.red : hr >= 18 ? C.orange : C.green;
          return <div style={{fontSize:11,fontWeight:700,color:cdColor,background:`${cdColor}12`,border:`1px solid ${cdColor}33`,padding:"3px 10px",borderRadius:4,whiteSpace:"nowrap"}}>⏱ {countdown}</div>;
        })()}

        <div style={{position:"relative"}}>
          <button
            onClick={()=>setProfileOpen(p=>!p)}
            style={{display:"flex",alignItems:"center",gap:7,background:"transparent",border:`1px solid ${profileOpen?C.accent:C.border}`,borderRadius:6,padding:"4px 10px 4px 6px",cursor:"pointer",transition:"border-color .15s"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:`${C.accent}22`,border:`1px solid ${C.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.accent,flexShrink:0}}>
              {(user.name||"?")[0].toUpperCase()}
            </div>
            <span style={{fontSize:11,color:C.text,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
            <span style={{fontSize:9,color:C.dim,marginLeft:2}}>{profileOpen?"▲":"▼"}</span>
          </button>
          {profileOpen && (
            <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:8,zIndex:200,minWidth:180,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
              <div style={{padding:"8px 12px",marginBottom:4}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>{user.name}</div>
                <div style={{fontSize:10,color:C.dim,marginTop:1}}>{user.email}</div>
                <div style={{fontSize:10,color:C.accent,marginTop:2,fontWeight:600}}>{user_role?.role}</div>
              </div>
              <div style={{height:1,background:C.border,margin:"4px 0"}} />
              <button
                onClick={()=>{setProfileOpen(false);onLogout();}}
                style={{width:"100%",background:"transparent",border:"none",padding:"8px 12px",textAlign:"left",color:C.red,fontSize:12,cursor:"pointer",borderRadius:5,fontFamily:"'DM Mono',monospace",transition:"background .1s"}}
                onMouseOver={e=>e.currentTarget.style.background=`${C.red}18`}
                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
