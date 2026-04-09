import React, { useState } from "react";
import { useCROAppContext, Deal, Rep, InternalReq, RevenueEntry, TargetSub, Property, MasterClient } from "../../contexts/CROAppContext";
import { apiFetch } from "../../services/api/_client";
import { externalPost } from "../../services/api/external";

const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
let _xlsxLoaded = false;
let _xlsxPromise: Promise<any> | null = null;
function loadXLSX(): Promise<any> {
  if (_xlsxLoaded) return Promise.resolve((window as any).XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = XLSX_CDN;
    s.onload = () => { _xlsxLoaded = true; res((window as any).XLSX); };
    s.onerror = rej; document.head.appendChild(s);
  });
  return _xlsxPromise;
}

interface SystemConfigViewProps {
  view: string;
}

export function SystemConfigView({ view }: SystemConfigViewProps) {
  const {
    adminConfig, setAdminConfig,
    clientMasterList, setClientMasterList,
    masterClients, setMasterClients,
    deals,
    reps, setReps,
    properties, setProperties,
    revenueEntries, setRevenueEntries,
    targetSubs, setTargetSubs,
    tasks,
    meetings,
    showToast,
    C,
    TODAY,
    REGIONS,
    ALL_ROLES,
    isAdmin,
    isStrategy,
  } = useCROAppContext();

  const [masterNewName, setMasterNewName] = useState("");
  const [zohoImporting, setZohoImporting] = useState(false);
  const [zohoAccounts, setZohoAccounts] = useState<string[]>([]);
  const [zohoError, setZohoError] = useState<string | null>(null);
  const [zohoSearchQ, setZohoSearchQ] = useState("");
  const [importTab, setImportTab] = useState("targets");
  const [dmTab, setDmTab] = useState<"reps" | "clients" | "bulk">("reps");
  const [repEditId, setRepEditId] = useState<string | number | null>(null);
  const [repEditForm, setRepEditForm] = useState<Partial<Rep>>({});
  const [repAddMode, setRepAddMode] = useState(false);
  const [repAddForm, setRepAddForm] = useState({ name: "", region: "North", role: "Sales Executive", target: 10000000, active: true });
  const [clientEditId, setClientEditId] = useState<string | null>(null);
  const [clientEditForm, setClientEditForm] = useState<Partial<MasterClient>>({});
  const [clientAddMode, setClientAddMode] = useState(false);
  const [clientAddForm, setClientAddForm] = useState({ company: "", industry: "", contact: "", phone: "", email: "", region: "National" });
  const [importData, setImportData] = useState<{filename:string;rows:Record<string,unknown>[];type:string}|null>(null);

  return (
    <>
      {/* ═══ STRATEGY APPROVAL SETTINGS ═══ */}
      {view==="strategy-config" && isStrategy && (
        <div className="fin">
          <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>APPROVAL SETTINGS</div>
          <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Configure deal approval thresholds and inactivity rules. Changes apply immediately for all users.</div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:6}}>Approval Thresholds</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Deal amount determines who reviews it. Chain: NSH → Sales Strategy → CXO.</div>
            {[
              {key:"RH",  label:"Region Head reviews deals above",  help:"Below this → Rep proceeds independently"},
              {key:"NSH", label:"NSH reviews deals above",          help:"After RH clears the deal"},
              {key:"CXO", label:"CXO sign-off required above",       help:"Strategic deals — final gate before closing"},
            ].map(({key,label,help})=>(
              <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap",padding:"10px 12px",background:C.s2,borderRadius:6}}>
                <div style={{flex:1,minWidth:180}}>
                  <div style={{fontSize:12,fontWeight:600}}>{label}</div>
                  <div style={{fontSize:10,color:C.dim,marginTop:2}}>{help}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:C.dim}}>₹</span>
                  <input type="number" value={adminConfig.approvalThresholds?.[key]!=null?adminConfig.approvalThresholds[key]/100000:0}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,approvalThresholds:{...p.approvalThresholds,[key]:parseFloat(e.target.value||"0")*100000}}))}
                    style={{width:80,padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                  <span style={{fontSize:11,color:C.dim}}>L</span>
                </div>
                <div style={{minWidth:90,fontSize:11,color:C.accent,fontWeight:700}}>{((adminConfig.approvalThresholds?.[key]||0)/100000).toFixed(0)}L = ₹{((adminConfig.approvalThresholds?.[key]||0)/10000000).toFixed(2)}Cr</div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:6}}>Deal Inactivity Rules</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Deals with no contact activity are flagged and auto-escalated based on these thresholds.</div>
            {[
              {key:"inactivityDaysRisk",     label:"Flag deal as At Risk after",       suffix:"days without client contact"},
              {key:"inactivityDaysEscalate", label:"Auto-escalate to NSH after",       suffix:"days without client contact"},
            ].map(({key,label,suffix})=>(
              <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,padding:"10px 12px",background:C.s2,borderRadius:6,flexWrap:"wrap"}}>
                <div style={{flex:1,fontSize:12,fontWeight:600}}>{label}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="number" value={adminConfig[key]||0}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,[key]:parseInt(e.target.value||"0")}))}
                    style={{width:56,padding:"5px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                  <span style={{fontSize:11,color:C.dim}}>{suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:6}}>SLA Hours by Approver Level</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Approvals not actioned within these hours are flagged Overdue and escalated upward.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {Object.entries(adminConfig.slaHours||{}).map(([k,v])=>(
                <div key={k} style={{background:C.s2,borderRadius:6,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:6}}>{k.toUpperCase()}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input type="number" value={v as number}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,slaHours:{...p.slaHours,[k]:parseInt(e.target.value||"48")}}))}
                      style={{width:50,padding:"4px 6px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                    <span style={{fontSize:10,color:C.dim}}>hrs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:`${C.green}10`,border:`1px solid ${C.green}44`,borderRadius:6,padding:"10px 14px",fontSize:11,color:C.green}}>
            ✓ All changes are saved automatically and take effect immediately for all logged-in users.
          </div>
        </div>
      )}

      {/* ═══ ADMIN CONFIG ═══ */}
      {view==="admin-config" && isAdmin && (
        <div className="fin">
          <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>SYSTEM CONFIGURATION</div>
          <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Approval thresholds, SLA hours, inactivity rules — no code deploy needed.</div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14,border:`2px solid ${adminConfig.platformLive===false?C.orange:C.green}44`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div className="sans" style={{fontWeight:700}}>Platform State</div>
              <span style={{background:adminConfig.platformLive===false?`${C.orange}22`:`${C.green}22`,color:adminConfig.platformLive===false?C.orange:C.green,padding:"3px 12px",borderRadius:6,fontSize:11,fontWeight:700}}>{adminConfig.platformLive===false?"PRE-LAUNCH":"LIVE"}</span>
            </div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>Controls whether Sales Reps can access the CRM. Set to Pre-launch while targets are being finalised. Go Live after CRO approves all targets.</div>
            <div style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:5}}>PLATFORM STATE</div>
                <div style={{display:"flex",gap:6}}>
                  {["Pre-launch","Live"].map((s: string)=>(
                    <button key={s} onClick={()=>setAdminConfig((p: Record<string, any>)=>({...p,platformLive:s==="Live"}))}
                      style={{padding:"7px 16px",fontSize:11,fontWeight:700,borderRadius:5,border:`1px solid ${((s==="Live"&&adminConfig.platformLive!==false)||(s==="Pre-launch"&&adminConfig.platformLive===false))?s==="Live"?C.green:C.orange:C.border}`,background:((s==="Live"&&adminConfig.platformLive!==false)||(s==="Pre-launch"&&adminConfig.platformLive===false))?`${s==="Live"?C.green:C.orange}18`:C.s2,color:((s==="Live"&&adminConfig.platformLive!==false)||(s==="Pre-launch"&&adminConfig.platformLive===false))?s==="Live"?C.green:C.orange:C.dim,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                      {s==="Live"?"✓ Go Live":"🚀 Pre-launch"}
                    </button>
                  ))}
                </div>
              </div>
              {adminConfig.platformLive===false&&(
                <div>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:5}}>LAUNCH DATE (shown to reps)</div>
                  <input type="date" value={adminConfig.launchDate||""} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,launchDate:e.target.value}))}
                    style={{padding:"6px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:12}}>Approval Thresholds</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Deal amount determines who must approve before it can proceed.</div>
            {[
              {key:"RH",  label:"Region Head approves deals above",  help:"Below this → rep can proceed"},
              {key:"NSH", label:"NSH approves deals above",          help:"After RH clears"},
              {key:"CXO", label:"CXO approval required above",       help:"Final gate for strategic deals"},
            ].map(({key,label,help})=>(
              <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:12,fontWeight:600}}>{label}</div>
                  <div style={{fontSize:10,color:C.dim}}>{help}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:C.dim}}>₹</span>
                  <input type="number" value={adminConfig.approvalThresholds[key]/100000}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,approvalThresholds:{...p.approvalThresholds,[key]:parseFloat(e.target.value||"0")*100000}}))}
                    style={{width:80,padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right"}}/>
                  <span style={{fontSize:11,color:C.dim}}>L</span>
                </div>
                <div style={{minWidth:80,fontSize:11,color:C.accent,fontWeight:700}}>{(adminConfig.approvalThresholds[key]/100000).toFixed(0)}L = ₹{(adminConfig.approvalThresholds[key]/10000000).toFixed(2)}Cr</div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:12}}>SLA Hours by Level</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Approvals breaching these hours are flagged Overdue and auto-escalate.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {Object.entries(adminConfig.slaHours).map(([k,v])=>(
                <div key={k} style={{background:C.s2,borderRadius:6,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:6}}>{k.toUpperCase()}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input type="number" value={v as number}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,slaHours:{...p.slaHours,[k]:parseInt(e.target.value||"48")}}))}
                      style={{width:50,padding:"4px 6px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                    <span style={{fontSize:10,color:C.dim}}>hrs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:12}}>Deal Inactivity Rules</div>
            {[
              {key:"inactivityDaysRisk",      label:"Flag as At Risk after",      suffix:"days no contact"},
              {key:"inactivityDaysEscalate",  label:"Auto-escalate to NSH after", suffix:"days no contact"},
            ].map(({key,label,suffix})=>(
              <div key={key} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{flex:1,fontSize:12,fontWeight:600}}>{label}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="number" value={adminConfig[key]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,[key]:parseInt(e.target.value||"7")}))}
                    style={{width:55,padding:"5px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center"}}/>
                  <span style={{fontSize:11,color:C.dim}}>{suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div className="sans" style={{fontWeight:700,marginBottom:6}}>Push Notifications</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Paste a webhook URL (Zapier, Make, Slack) to receive automatic alerts for absences, deal wins, and SLA breaches. Leave blank to disable.</div>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <input
                type="url"
                value={adminConfig.webhookUrl||""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setAdminConfig((p: Record<string, any>)=>({...p,webhookUrl:e.target.value}))}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                style={{flex:1,minWidth:260,padding:"7px 10px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}
              />
              <button onClick={()=>{
                const url=adminConfig.webhookUrl?.trim();
                if(!url){showToast("No webhook URL configured","err");return;}
                externalPost(url,{source:"OTV CRM",event:"test",message:"Webhook test from OTV CRM System Config",timestamp:new Date().toISOString()});
                showToast("Test ping sent ✓");
              }} style={{padding:"7px 14px",background:`${C.accent}22`,border:`1px solid ${C.accent}44`,borderRadius:5,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>
                Send Test Ping
              </button>
            </div>
            <div style={{marginTop:10,fontSize:10,color:C.muted}}>
              Triggers: EOD absence reports · Deal won · Approval breaches SLA
            </div>
          </div>

          <div className="card" style={{padding:"18px 20px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:8}}>
              <div className="sans" style={{fontWeight:700}}>Client Master List</div>
              <span style={{fontSize:10,color:C.dim,background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:"2px 10px"}}>{clientMasterList.length} clients</span>
            </div>
            <div style={{fontSize:11,color:C.dim,marginBottom:14}}>
              The canonical list of advertiser names. Reps see a searchable dropdown from this list when entering clients — preventing spelling variations that break revenue matching. Names must match exactly what the agency / client uses in ROs.
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={masterNewName} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setMasterNewName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>)=>{
                  if(e.key==="Enter"&&masterNewName.trim()){
                    const name=masterNewName.trim();
                    if(clientMasterList.some((n: string)=>n.toLowerCase()===name.toLowerCase())){showToast("Already in list","err");return;}
                    setClientMasterList((p: string[])=>[...p,name].sort((a,b)=>a.localeCompare(b)));
                    setMasterNewName("");
                    showToast(`${name} added to client list ✓`);
                  }
                }}
                placeholder="Type client name and press Enter or click Add…"
                style={{flex:1,padding:"8px 11px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
              <button onClick={()=>{
                const name=masterNewName.trim();
                if(!name){showToast("Enter a client name","err");return;}
                if(clientMasterList.some((n: string)=>n.toLowerCase()===name.toLowerCase())){showToast("Already in list","err");return;}
                setClientMasterList((p: string[])=>[...p,name].sort((a,b)=>a.localeCompare(b)));
                setMasterNewName("");
                showToast(`${name} added ✓`);
              }} style={{padding:"8px 16px",background:`${C.blue}18`,border:`1px solid ${C.blue}33`,borderRadius:5,color:C.blue,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>
                + Add
              </button>
            </div>
            <div style={{marginBottom:12,padding:"12px 14px",background:`${C.green}08`,border:`1px solid ${C.green}33`,borderRadius:6}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:8}}>
                <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:".06em"}}>IMPORT FROM ZOHO CRM</div>
                <button onClick={async()=>{
                  setZohoError(null);
                  setZohoImporting(true);
                  setZohoAccounts([]);
                  try{
                    const url=zohoSearchQ.trim().length>=2
                      ?`/api/zoho/accounts?search=${encodeURIComponent(zohoSearchQ.trim())}`
                      :"/api/zoho/accounts";
                    const j=await apiFetch(url) as {ok?:boolean;accounts?:string[];error?:string};
                    if(j.ok){setZohoAccounts(j.accounts||[]);if(!j.accounts?.length)setZohoError("No accounts found in Zoho CRM.");}
                    else setZohoError(j.error||"Failed to fetch from Zoho CRM.");
                  }catch(e: unknown){setZohoError(e instanceof Error?e.message:"Network error");}
                  finally{setZohoImporting(false);}
                }} disabled={zohoImporting}
                  style={{padding:"6px 14px",background:C.green,border:"none",borderRadius:5,color:"#fff",fontSize:11,cursor:zohoImporting?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,opacity:zohoImporting?0.6:1}}>
                  {zohoImporting?"Fetching…":"Fetch Accounts"}
                </button>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <input value={zohoSearchQ} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setZohoSearchQ(e.target.value)}
                  placeholder="Search Zoho accounts by name… (leave blank to fetch all)"
                  style={{flex:1,padding:"6px 10px",background:"#fff",border:`1px solid ${C.green}44`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}/>
              </div>
              {zohoError&&<div style={{fontSize:11,color:C.red,marginBottom:6}}>⚠ {zohoError}</div>}
              {zohoAccounts.length>0&&(()=>{
                const notYet=zohoAccounts.filter((a: string)=>!clientMasterList.some((m: string)=>m.toLowerCase()===a.toLowerCase()));
                return (
                  <div>
                    <div style={{fontSize:10,color:C.dim,marginBottom:6}}>{zohoAccounts.length} account{zohoAccounts.length!==1?"s":""} returned · {notYet.length} not yet in your list</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8,maxHeight:120,overflowY:"auto"}}>
                      {zohoAccounts.map((a: string)=>{
                        const already=clientMasterList.some((m: string)=>m.toLowerCase()===a.toLowerCase());
                        return <button key={a} onClick={()=>{
                          if(already)return;
                          setClientMasterList((p: string[])=>[...p,a].sort((x,y)=>x.localeCompare(y)));
                          showToast(`${a} added ✓`);
                        }}
                          style={{background:already?`${C.green}12`:`${C.green}20`,border:`1px solid ${already?C.green+"44":C.green+"66"}`,borderRadius:12,padding:"3px 11px",fontSize:11,color:already?C.muted:C.green,cursor:already?"default":"pointer",fontFamily:"'DM Mono',monospace",textDecoration:already?"line-through":"none"}}>
                          {already?"✓":"+"}  {a}
                        </button>;
                      })}
                    </div>
                    {notYet.length>0&&<button onClick={()=>{
                      setClientMasterList((p: string[])=>[...p,...notYet].sort((a,b)=>a.localeCompare(b)));
                      showToast(`${notYet.length} Zoho accounts imported ✓`);
                    }} style={{fontSize:10,background:`${C.green}22`,border:`1px solid ${C.green}55`,borderRadius:4,padding:"4px 12px",color:C.green,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                      Import All {notYet.length} New
                    </button>}
                  </div>
                );
              })()}
              {!zohoAccounts.length&&!zohoError&&!zohoImporting&&<div style={{fontSize:10,color:C.muted}}>Click "Fetch Accounts" to pull your advertiser list directly from Zoho CRM.</div>}
            </div>

            {(()=>{
              const existingClients=[...new Set(deals.map((d: Deal)=>d.clientCompany).filter(Boolean))].sort() as string[];
              const notYetAdded=existingClients.filter((c: string)=>!clientMasterList.some((m: string)=>m.toLowerCase()===c.toLowerCase()));
              if(!notYetAdded.length)return null;
              return (
                <div style={{marginBottom:12,padding:"10px 12px",background:`${C.accent}0a`,border:`1px solid ${C.accent}33`,borderRadius:6}}>
                  <div style={{fontSize:10,color:C.accent,fontWeight:700,marginBottom:8,letterSpacing:".06em"}}>IMPORT FROM EXISTING DEALS ({notYetAdded.length} not yet listed)</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {notYetAdded.map((c: string)=>(
                      <button key={c} onClick={()=>{setClientMasterList((p: string[])=>[...p,c].sort((a,b)=>a.localeCompare(b)));showToast(`${c} added ✓`);}}
                        style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"3px 11px",fontSize:11,color:C.accent,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                        + {c}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>{
                    const toAdd=notYetAdded.filter((c: string)=>!clientMasterList.some((m: string)=>m.toLowerCase()===c.toLowerCase()));
                    setClientMasterList((p: string[])=>[...p,...toAdd].sort((a,b)=>a.localeCompare(b)));
                    showToast(`${toAdd.length} clients imported ✓`);
                  }} style={{fontSize:10,background:`${C.accent}22`,border:`1px solid ${C.accent}55`,borderRadius:4,padding:"4px 12px",color:C.accent,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                    Import All {notYetAdded.length}
                  </button>
                </div>
              );
            })()}

            {clientMasterList.length===0
              ? <div style={{textAlign:"center",padding:20,color:C.muted,fontSize:11}}>No clients added yet. Add them above or import from existing deals.</div>
              : <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:200,overflowY:"auto"}}>
                  {clientMasterList.map((c: string,i: number)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:C.s2,border:`1px solid ${C.border}`,borderRadius:14,padding:"4px 10px 4px 12px",fontSize:11}}>
                      <span>{c}</span>
                      <button onClick={()=>{if(!window.confirm(`Remove "${c}" from client list?`))return;setClientMasterList((p: string[])=>p.filter((_,j)=>j!==i));showToast(`${c} removed`);}}
                        style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:"0 2px",lineHeight:1,fontSize:13}}>✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div className="card" style={{padding:"18px 20px"}}>
            <div className="sans" style={{fontWeight:700,marginBottom:12}}>Recent Approval Activity</div>
            {(()=>{
              const allLogs = deals.flatMap((d: Deal)=>(d.auditLog||[]).map((l: Record<string,unknown>)=>({...l,dealId:d.id,clientCompany:d.clientCompany,amount:d.amount})));
              const sorted  = allLogs.sort((a: Record<string,unknown>,b: Record<string,unknown>)=>String(b.at||"").localeCompare(String(a.at||""))).slice(0,20);
              if(!sorted.length) return <div style={{textAlign:"center",padding:20,color:C.muted}}>No approval actions yet.</div>;
              return (
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {sorted.map((l: Record<string,unknown>,i: number)=>{
                    const ac = l.action==="Approved"?C.green:l.action==="Rejected"?C.red:C.orange;
                    const sL = (k: string) => String(l[k]||"");
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:C.s2,borderRadius:5,flexWrap:"wrap"}}>
                        <span style={{background:`${ac}22`,color:ac,padding:"1px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{sL("action")}</span>
                        <span style={{fontSize:11,fontWeight:600}}>{sL("clientCompany")}</span>
                        <span style={{fontSize:10,color:C.dim}}>by {sL("by")} ({sL("role")})</span>
                        <span style={{fontSize:10,color:C.dim}}>→ {sL("to")||"Cleared"}</span>
                        {sL("note")&&<span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>"{sL("note")}"</span>}
                        <span style={{fontSize:10,color:C.muted,marginLeft:"auto"}}>{sL("at")}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══ DATA MANAGEMENT / IMPORT ═══ */}
      {view==="import" && isAdmin && (
        <div className="fin">
          <div className="sans" style={{fontSize:18,fontWeight:700,letterSpacing:1,marginBottom:4}}>DATA MANAGEMENT</div>
          <div style={{fontSize:11,color:C.dim,marginBottom:20}}>Add, edit, or deactivate sales reps and clients. Changes apply instantly for all users.</div>

          <div style={{display:"flex",gap:0,marginBottom:22,borderBottom:`1px solid ${C.border}`}}>
            {(([["reps","◇ Sales Reps"],["clients","◎ Clients"],["bulk","⬆ Bulk Import"]] as const)).map(([id,label])=>(
              <button key={id} onClick={()=>setDmTab(id)}
                style={{padding:"10px 20px",background:"transparent",border:"none",
                  borderBottom:dmTab===id?`2px solid ${C.accent}`:"2px solid transparent",
                  color:dmTab===id?C.accent:C.dim,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:dmTab===id?700:400}}>
                {label}
              </button>
            ))}
          </div>

          {/* ── SALES REPS TAB ── */}
          {dmTab==="reps" && (()=>{
            const REP_REGIONS = ["North","South","East","West","National","Central"];
            const ROLES   = ["Sales Executive","Senior Sales","Business Development"];
            const saveRep = () => {
              if (!repEditForm.name?.trim()){showToast("Name required","err");return;}
              setReps((p: Rep[])=>p.map((r: Rep)=>r.id===repEditId?{...r,...repEditForm}:r));
              setRepEditId(null); setRepEditForm({});
              showToast("Rep updated");
            };
            const addRep = () => {
              if (!repAddForm.name.trim()){showToast("Name required","err");return;}
              const newId = Math.max(0,...reps.map((r: Rep)=>Number(r.id)))+1;
              setReps((p: Rep[])=>[...p,{id:newId,...repAddForm,active:true}]);
              setRepAddMode(false);
              setRepAddForm({name:"",region:"North",role:"Sales Executive",target:10000000,active:true});
              showToast(`${repAddForm.name} added`);
            };
            return (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:12,color:C.dim}}>{reps.filter((r: Rep)=>r.active!==false).length} active · {reps.filter((r: Rep)=>r.active===false).length} inactive</div>
                  <button onClick={()=>{setRepAddMode(true);setRepEditId(null);}}
                    style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                    + Add Rep
                  </button>
                </div>

                {repAddMode && (
                  <div className="card" style={{padding:"16px 18px",marginBottom:14,border:`1px solid ${C.accent}44`}}>
                    <div className="sans" style={{fontWeight:700,marginBottom:12,fontSize:13}}>New Sales Rep</div>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>FULL NAME *</div>
                        <input value={repAddForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setRepAddForm((p)=>({...p,name:e.target.value}))} placeholder="e.g. Sunita Patra"
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>REGION *</div>
                        <select value={repAddForm.region} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setRepAddForm((p)=>({...p,region:e.target.value}))}
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                          {REP_REGIONS.map((r: string)=><option key={r}>{r}</option>)}
                        </select></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>ROLE</div>
                        <select value={repAddForm.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setRepAddForm((p)=>({...p,role:e.target.value}))}
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                          {ROLES.map((r: string)=><option key={r}>{r}</option>)}
                        </select></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>TARGET (₹L)</div>
                        <input type="number" value={repAddForm.target/100000} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setRepAddForm((p)=>({...p,target:parseFloat(e.target.value||"0")*100000}))}
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}} /></div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={addRep} style={{background:C.accent,border:"none",color:"#000",borderRadius:5,padding:"7px 18px",fontSize:12,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Save Rep</button>
                      <button onClick={()=>setRepAddMode(false)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:C.s2}}>
                        {["ID","Name","Region","Role","Target","Status","Actions"].map((h: string)=>(
                          <th key={h} style={{padding:"9px 12px",color:C.dim,fontWeight:700,fontSize:10,letterSpacing:".07em",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reps.map((rep: Rep)=>{
                        const isEditing = repEditId===rep.id;
                        const inactive  = rep.active===false;
                        return (
                          <tr key={rep.id} style={{borderTop:`1px solid ${C.s2}`,background:inactive?"rgba(0,0,0,.03)":"transparent",opacity:inactive?0.65:1}}>
                            <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",color:C.muted,fontSize:11}}>{rep.id}</td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <input value={repEditForm.name||rep.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setRepEditForm((p)=>({...p,name:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:140}} />
                                : <span style={{fontWeight:600,color:inactive?C.muted:C.text}}>{rep.name}</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <select value={repEditForm.region||rep.region} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setRepEditForm((p)=>({...p,region:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12}}>
                                    {REP_REGIONS.map((r: string)=><option key={r}>{r}</option>)}
                                  </select>
                                : <span style={{color:C.blue,fontFamily:"'DM Mono',monospace",fontSize:11}}>{rep.region}</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <select value={repEditForm.role||rep.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setRepEditForm((p)=>({...p,role:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12}}>
                                    {ROLES.map((r: string)=><option key={r}>{r}</option>)}
                                  </select>
                                : <span style={{color:C.dim,fontSize:11}}>{rep.role}</span>}
                            </td>
                            <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace"}}>
                              {isEditing
                                ? <input type="number" value={(repEditForm.target??rep.target)/100000}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setRepEditForm((p)=>({...p,target:parseFloat(e.target.value||"0")*100000}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:70,fontFamily:"'DM Mono',monospace"}} />
                                : <span style={{color:C.accent}}>₹{((rep.target||0)/100000).toFixed(0)}L</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,
                                background:inactive?`${C.red}18`:`${C.green}18`,
                                color:inactive?C.red:C.green}}>
                                {inactive?"INACTIVE":"ACTIVE"}
                              </span>
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              <div style={{display:"flex",gap:6}}>
                                {isEditing ? (
                                  <>
                                    <button onClick={saveRep}
                                      style={{background:C.green,border:"none",color:"#fff",borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>✓ Save</button>
                                    <button onClick={()=>{setRepEditId(null);setRepEditForm({});}}
                                      style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={()=>{setRepEditId(rep.id);setRepEditForm({...rep});setRepAddMode(false);}}
                                      style={{background:`${C.blue}15`,border:"none",color:C.blue,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Edit</button>
                                    <button onClick={()=>{setReps((p: Rep[])=>p.map((r: Rep)=>r.id===rep.id?{...r,active:!inactive}:r));showToast(inactive?"Rep activated":"Rep deactivated");}}
                                      style={{background:inactive?`${C.green}15`:`${C.red}12`,border:"none",color:inactive?C.green:C.red,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                                      {inactive?"Activate":"Deactivate"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── CLIENT MASTER TAB ── */}
          {dmTab==="clients" && (()=>{
            const CL_REGIONS  = ["North","South","East","West","National","Central"];
            const INDUSTRIES = ["FMCG","Banking/Finance","Automobile","Healthcare","Retail","Telecom","Technology","Steel/Manufacturing","Beverages","Paints","Media","Government","Other"];
            const saveClient = () => {
              if (!clientEditForm.company?.trim()){showToast("Company name required","err");return;}
              setMasterClients((p: MasterClient[])=>p.map((c: MasterClient)=>c.id===clientEditId?{...c,...clientEditForm}:c));
              setClientEditId(null); setClientEditForm({});
              showToast("Client updated");
            };
            const addClient = () => {
              if (!clientAddForm.company.trim()){showToast("Company name required","err");return;}
              const newId = `cl_${Date.now()}`;
              setMasterClients((p)=>[...p,{id:newId,...clientAddForm}]);
              setClientAddMode(false);
              setClientAddForm({company:"",industry:"",contact:"",phone:"",email:"",region:"National"});
              showToast(`${clientAddForm.company} added`);
            };
            return (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:12,color:C.dim}}>{masterClients.length} clients in master list</div>
                  <button onClick={()=>{setClientAddMode(true);setClientEditId(null);}}
                    style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                    + Add Client
                  </button>
                </div>

                {clientAddMode && (
                  <div className="card" style={{padding:"16px 18px",marginBottom:14,border:`1px solid ${C.accent}44`}}>
                    <div className="sans" style={{fontWeight:700,marginBottom:12,fontSize:13}}>New Client</div>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:10}}>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>COMPANY NAME *</div>
                        <input value={clientAddForm.company} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientAddForm((p)=>({...p,company:e.target.value}))} placeholder="e.g. Havells India"
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>INDUSTRY</div>
                        <select value={clientAddForm.industry} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setClientAddForm((p)=>({...p,industry:e.target.value}))}
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                          <option value="">Select…</option>
                          {INDUSTRIES.map((i: string)=><option key={i}>{i}</option>)}
                        </select></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>REGION</div>
                        <select value={clientAddForm.region} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setClientAddForm((p)=>({...p,region:e.target.value}))}
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12}}>
                          {CL_REGIONS.map((r: string)=><option key={r}>{r}</option>)}
                        </select></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>PRIMARY CONTACT</div>
                        <input value={clientAddForm.contact} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientAddForm((p)=>({...p,contact:e.target.value}))} placeholder="Name"
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>PHONE</div>
                        <input value={clientAddForm.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientAddForm((p)=>({...p,phone:e.target.value}))} placeholder="9XXXXXXXXX"
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                      <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>EMAIL</div>
                        <input value={clientAddForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientAddForm((p)=>({...p,email:e.target.value}))} placeholder="contact@company.com"
                          style={{width:"100%",padding:"6px 8px",background:C.s2,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontSize:12,boxSizing:"border-box"}} /></div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={addClient} style={{background:C.accent,border:"none",color:"#000",borderRadius:5,padding:"7px 18px",fontSize:12,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Save Client</button>
                      <button onClick={()=>setClientAddMode(false)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:C.s2}}>
                        {["Company","Industry","Contact","Phone","Email","Region","Actions"].map((h: string)=>(
                          <th key={h} style={{padding:"9px 12px",color:C.dim,fontWeight:700,fontSize:10,letterSpacing:".07em",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(masterClients as MasterClient[]).map((cl: MasterClient)=>{
                        const isEditing = clientEditId===cl.id;
                        return (
                          <tr key={cl.id} style={{borderTop:`1px solid ${C.s2}`}}>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <input value={clientEditForm.company||cl.company} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientEditForm((p)=>({...p,company:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:140}} />
                                : <span style={{fontWeight:600}}>{cl.company}</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <select value={clientEditForm.industry||cl.industry} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setClientEditForm((p)=>({...p,industry:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:11}}>
                                    {INDUSTRIES.map((i: string)=><option key={i}>{i}</option>)}
                                  </select>
                                : <span style={{color:C.dim,fontSize:11}}>{cl.industry}</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <input value={clientEditForm.contact||cl.contact} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientEditForm((p)=>({...p,contact:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:120}} />
                                : <span style={{fontSize:11}}>{cl.contact}</span>}
                            </td>
                            <td style={{padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.dim}}>{cl.phone}</td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <input value={clientEditForm.email||cl.email||""} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setClientEditForm((p)=>({...p,email:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:12,width:150}} />
                                : <span style={{fontSize:11,color:C.dim,fontFamily:"'DM Mono',monospace"}}>{cl.email||"—"}</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              {isEditing
                                ? <select value={clientEditForm.region||cl.region} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setClientEditForm((p)=>({...p,region:e.target.value}))}
                                    style={{padding:"4px 6px",background:C.s2,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.text,fontSize:11}}>
                                    {CL_REGIONS.map((r: string)=><option key={r}>{r}</option>)}
                                  </select>
                                : <span style={{color:C.blue,fontSize:11}}>{cl.region}</span>}
                            </td>
                            <td style={{padding:"9px 12px"}}>
                              <div style={{display:"flex",gap:6}}>
                                {isEditing ? (
                                  <>
                                    <button onClick={saveClient}
                                      style={{background:C.green,border:"none",color:"#fff",borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>✓ Save</button>
                                    <button onClick={()=>{setClientEditId(null);setClientEditForm({});}}
                                      style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={()=>{setClientEditId(cl.id);setClientEditForm({...cl});setClientAddMode(false);}}
                                      style={{background:`${C.blue}15`,border:"none",color:C.blue,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Edit</button>
                                    <button onClick={()=>{if(!window.confirm(`Remove ${cl.company}?`))return;setMasterClients((p: MasterClient[])=>p.filter((c: MasterClient)=>c.id!==cl.id));showToast("Client removed");}}
                                      style={{background:`${C.red}12`,border:"none",color:C.red,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Remove</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── BULK IMPORT TAB ── */}
          {dmTab==="bulk" && (()=>{
            const tabs = [
              {id:"targets",    label:"Targets",        icon:"✦", desc:"Annual client-wise targets per rep — 6 columns only"},
              {id:"reps",       label:"Sales Reps",     icon:"◇", desc:"Rep names, regions, roles"},
              {id:"clients",    label:"Clients",        icon:"◎", desc:"Client master list"},
              {id:"revenue",    label:"Revenue Entries",icon:"₹", desc:"Actual revenue logged"},
              {id:"properties", label:"IP Inventory",   icon:"⬡", desc:"IP / sponsorship inventory"},
            ];

            const TEMPLATES: Record<string, string[]> = {
              targets:    ["Rep Name","Region","Client Company","Channel","Deal Type","Annual Target Amount"],
              reps:       ["Rep Name","Email","Region","Role","Annual Quota"],
              clients:    ["Client Company","Industry","Primary Contact","Phone","Email","Assigned Rep","Region"],
              revenue:    ["Rep Name","Client Company","Deal Type","Amount","Invoice Ref","Date","Quarter"],
              properties: ["IP Name","Channel","IP Type","Air Date","Duration (weeks)","Slot Type","Slot Rate","Total Slots Available"],
            };

            const downloadTemplate = (type: string) => {
              const headers = TEMPLATES[type] || [];
              const sampleRow: Record<string, string[]> = {
                targets:    ["Vikram Sen","National","Havells India","OTV","Linear TV","15000000"],
                reps:       ["Arjun Mishra","arjun@odishatv.com","North","SALES REP","10000000"],
                clients:    ["Havells India","FMCG","Deepa Menon","9823401234","deepa@havells.com","Vikram Sen","National"],
                revenue:    ["Vikram Sen","Havells India","IPs","5000000","INV-2024-001","2026-04-10","Q1 FY26"],
                properties: ["Odia Idol S3","OTV","Reality Show","2026-07-15","8","Title Sponsor","5000000","4"],
              };
              const row = sampleRow[type] || [];
              const csv = [headers.join(","), row.join(",")].join("\n");
              const blob = new Blob([csv], {type:"text/csv"});
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `OTV_${type}_template.csv`;
              a.click();
            };

            const processUpload = async (file: File, type: string) => {
              const XLSX = await loadXLSX();
              const reader = new FileReader();
              reader.onload = (ev: ProgressEvent<FileReader>) => {
                try {
                  const wb   = XLSX.read(ev.target!.result, {type:"array", raw:false});
                  const ws   = wb.Sheets[wb.SheetNames[0]];
                  const rows = XLSX.utils.sheet_to_json(ws);
                  setImportData({filename:file.name, rows, type});
                } catch(err: unknown) { showToast("Could not read file: "+(err instanceof Error?err.message:String(err)), "err"); }
              };
              reader.readAsArrayBuffer(file);
            };

            const commitImport = () => {
              if (!importData) return;
              const {rows, type} = importData;
              const parseCur = (v: unknown): number => { if(!v)return 0; const s=String(v).replace(/[,₹]/g,"").trim(); if(/[0-9]+[Cc][Rr]$/.test(s))return parseFloat(s)*10000000; if(/[0-9]+[Ll]$/.test(s))return parseFloat(s)*100000; return parseFloat(s)||0; };

              if (type==="revenue") {
                const repLookup = (r: string) => reps.find((rep: Rep)=>rep.name.toLowerCase().includes((r||"").toLowerCase().slice(0,5)));
                const entries = rows.map((row: Record<string,unknown>,i: number)=>{
                  const rep = repLookup(String(row["Rep Name"]||""));
                  return {id:`re_imp_${Date.now()}_${i}`,repId:rep?.id!=null?String(rep.id):null,clientCompany:String(row["Client Company"]||""),dealType:String(row["Deal Type"]||"Linear TV"),amount:parseCur(row["Amount"]),invoiceRef:String(row["Invoice Ref"]||""),date:String(row["Date"]||TODAY),quarter:String(row["Quarter"]||"Q1 FY26"),notes:String(row["Notes"]||"")} as unknown as RevenueEntry;
                });
                setRevenueEntries((p: RevenueEntry[])=>[...p,...entries]);
                showToast(`✓ ${entries.length} revenue entries imported`);
              } else if (type==="targets") {
                const repGroups: Record<string, {rep: Rep|undefined; repName: string; region: string; rows: Record<string,unknown>[]}> = {};
                rows.forEach((row: Record<string,unknown>) => {
                  const repName = String(row["Rep Name"]||"").trim();
                  const rep = reps.find((r: Rep)=>r.name.toLowerCase()===repName.toLowerCase())
                           || reps.find((r: Rep)=>r.name.toLowerCase().includes(repName.toLowerCase().slice(0,6)));
                  const key = String(rep?.id || repName);
                  if (!repGroups[key]) repGroups[key] = {rep, repName, region: rep?.region||row["Region"]||"", rows:[]};
                  repGroups[key].rows.push(row);
                });
                const now = Date.now();
                const newSubs = Object.values(repGroups).map((g, i: number) => {
                  const clients = g.rows.map((row: Record<string,unknown>) => ({
                    clientCompany: String(row["Client Company"]||"").trim(),
                    channel:       String(row["Channel"]||"OTV").trim(),
                    dealType:      String(row["Deal Type"]||"Linear TV").trim(),
                    targetAmount:  parseCur(row["Annual Target Amount"]),
                    clientStatus:  "Pending",
                  }));
                  return {
                    id: `ts_imp_${now}_${i}`,
                    repId:      g.rep?.id||null,
                    repName:    g.rep?.name||g.repName,
                    region:     g.region,
                    quarter:    "FY26 Annual",
                    clients,
                    totalTarget: clients.reduce((s: number,c: {targetAmount:number})=>s+c.targetAmount,0),
                    status:     "Pending RH",
                    submittedAt: TODAY,
                    approvalLog: [],
                  };
                });
                setTargetSubs((p: TargetSub[])=>[...p,...(newSubs as TargetSub[])]);
                const totalClients = newSubs.reduce((s: number,sub: {clients:unknown[]})=>s+sub.clients.length,0);
                showToast(`✓ ${totalClients} client targets imported for ${newSubs.length} rep${newSubs.length!==1?"s":""} → pending RH approval`);
              } else if (type==="properties") {
                const grouped: Record<string, Property> = {};
                rows.forEach((row: Record<string,unknown>)=>{
                  const name = String(row["Property Name"]||"");
                  if(!grouped[name]) grouped[name]={id:`pr_imp_${Date.now()}`,name,type:row["Type"]||"",channel:row["Channel"]||"",quarter:row["Quarter"]||"Q1 FY26",totalValue:parseCur(row["Total Value"]),slots:[]};
                  grouped[name].slots.push({id:`s_imp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,label:row["Slot Label"]||"Slot",value:parseCur(row["Slot Value"]),status:row["Status"]||"Available",clientCompany:row["Client Company"]||"",repId:null});
                });
                setProperties((p: Property[])=>[...p,...Object.values(grouped)]);
                showToast(`✓ ${Object.values(grouped).length} properties imported`);
              } else {
                showToast(`${type} import noted — connect to your DB to persist`, "ok");
              }
              setImportData(null);
            };

            return (
              <div>
                <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                  {tabs.map(t=>(
                    <button key={t.id} onClick={()=>setImportTab(t.id)}
                      style={{padding:"10px 18px",background:"transparent",border:"none",
                        borderBottom:importTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
                        color:importTab===t.id?C.accent:C.dim,cursor:"pointer",
                        fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:importTab===t.id?700:400}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {tabs.filter(t=>t.id===importTab).map(tab=>(
                  <div key={tab.id}>
                    <div style={{fontSize:12,color:C.dim,marginBottom:16}}>{tab.desc} — {TEMPLATES[tab.id]?.length} columns</div>

                    <div className="card" style={{padding:"16px 20px",marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div className="sans" style={{fontWeight:700,marginBottom:3}}>Step 1 — Download Template</div>
                          <div style={{fontSize:11,color:C.dim}}>Columns: {TEMPLATES[tab.id]?.join(" · ")}</div>
                        </div>
                        <button onClick={()=>downloadTemplate(tab.id)}
                          style={{background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:5,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                          ↓ Download CSV
                        </button>
                      </div>
                    </div>

                    <div className="card" style={{padding:"16px 20px",marginBottom:14}}>
                      <div className="sans" style={{fontWeight:700,marginBottom:8}}>Step 2 — Upload Filled File</div>
                      <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Accepts .csv or .xlsx — first row must be column headers</div>
                      <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:C.s2,border:`2px dashed ${C.border}`,borderRadius:8,padding:"24px 20px",cursor:"pointer",transition:"border-color .15s"}}
                        onMouseOver={(e: React.MouseEvent<HTMLLabelElement>)=>(e.currentTarget.style.borderColor=C.accent)}
                        onMouseOut={(e: React.MouseEvent<HTMLLabelElement>)=>(e.currentTarget.style.borderColor=C.border)}>
                        <input type="file" accept=".csv,.xlsx" style={{display:"none"}} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(f)processUpload(f,tab.id);e.target.value="";}}/>
                        <span style={{fontSize:24}}>📁</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>Click to choose file</div>
                          <div style={{fontSize:11,color:C.dim,marginTop:2}}>CSV or Excel (.xlsx)</div>
                        </div>
                      </label>
                    </div>

                    {importData && importData.type===tab.id && (
                      <div className="card" style={{padding:"16px 20px",borderLeft:`3px solid ${C.green}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                          <div>
                            <div className="sans" style={{fontWeight:700}}>{importData.filename}</div>
                            <div style={{fontSize:11,color:C.dim,marginTop:2}}>{importData.rows.length} rows ready to import</div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>setImportData(null)} style={{background:`${C.red}18`,border:"none",color:C.red,borderRadius:4,padding:"6px 12px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕ Cancel</button>
                            <button onClick={commitImport}
                              style={{background:"linear-gradient(135deg,#16c784,#0ea570)",border:"none",color:"#fff",borderRadius:4,padding:"6px 18px",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                              ✓ Import {importData.rows.length} rows →
                            </button>
                          </div>
                        </div>
                        <div style={{overflowX:"auto",borderRadius:5,border:`1px solid ${C.border}`}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead><tr>
                              {Object.keys(importData.rows[0]||{}).slice(0,7).map((h: string)=>(
                                <th key={h} style={{padding:"6px 10px",background:C.s2,color:C.dim,fontWeight:600,fontSize:10,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                              {Object.keys(importData.rows[0]||{}).length>7&&<th style={{padding:"6px 10px",background:C.s2,color:C.muted,fontSize:10}}>+{Object.keys(importData.rows[0]).length-7} more</th>}
                            </tr></thead>
                            <tbody>
                              {importData.rows.slice(0,5).map((row: Record<string,unknown>,i: number)=>(
                                <tr key={i} style={{borderBottom:`1px solid ${C.s2}`}}>
                                  {Object.values(row).slice(0,7).map((v,j: number)=>(
                                    <td key={j} style={{padding:"7px 10px",color:C.text,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(v)}</td>
                                  ))}
                                  {Object.values(row).length>7&&<td style={{padding:"7px 10px",color:C.muted}}>…</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importData.rows.length>5&&<div style={{padding:"8px 12px",fontSize:11,color:C.dim,background:C.s2}}>…and {importData.rows.length-5} more rows</div>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{marginTop:20,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[
                    {label:"Deals in system",    val:deals.length,               color:C.accent},
                    {label:"Revenue entries",    val:revenueEntries.length,       color:C.green},
                    {label:"Target submissions", val:targetSubs.length,           color:C.blue},
                    {label:"Properties/IPs",     val:(properties||[]).length,    color:C.purple},
                    {label:"Tasks",              val:tasks.length,               color:C.orange},
                    {label:"Meetings logged",    val:meetings.length,            color:C.dim},
                  ].map((s)=>(
                    <div key={s.label} style={{background:C.surface,border:`1px solid ${s.color}33`,borderRadius:7,padding:"10px 14px"}}>
                      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                      <div className="sans" style={{fontSize:20,fontWeight:800,color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
