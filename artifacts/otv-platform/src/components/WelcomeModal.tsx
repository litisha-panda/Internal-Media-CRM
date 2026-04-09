import React from "react";

interface WelcomeModalProps {
  C: any;
  activeUser: string;
  currentTourData: any;
  startTour: () => void;
  onClose: () => void;
}

export function WelcomeModal({ C, activeUser, currentTourData, startTour, onClose }: WelcomeModalProps) {
  const wd = currentTourData.welcome;
  const dismiss = () => {
    localStorage.setItem(`otv_welcome_${activeUser}`, "1");
    onClose();
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:16,maxWidth:460,width:"100%",padding:"36px 40px",boxShadow:"0 24px 80px rgba(0,0,0,.6)",position:"relative"}}>
        <button onClick={dismiss} style={{position:"absolute",top:14,right:16,background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        <div style={{width:48,height:48,borderRadius:12,background:`${C.accent}22`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:C.accent,marginBottom:20}}>OTV</div>
        <div className="sans" style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:4}}>{wd.title}</div>
        <div style={{fontSize:13,color:C.dim,marginBottom:24}}>{wd.subtitle}</div>
        <div style={{background:C.s2,borderRadius:10,padding:"16px 20px",marginBottom:28}}>
          {wd.bullets.map((b: string, i: number) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:i<wd.bullets.length-1?10:0}}>
              <span style={{color:C.accent,marginTop:1,fontSize:14}}>{b.split(" ")[0]}</span>
              <span style={{fontSize:12,color:C.text,lineHeight:1.5}}>{b.split(" ").slice(1).join(" ")}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={startTour} style={{flex:1,background:C.accent,border:"none",color:"#000",borderRadius:8,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:.3}}>
            Start Tour →
          </button>
          <button onClick={dismiss} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.dim,borderRadius:8,padding:"12px 20px",fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            Skip for now
          </button>
        </div>
        <div style={{fontSize:10,color:C.muted,marginTop:14,textAlign:"center"}}>You can replay this tour anytime by clicking the <strong>?</strong> button in the top bar</div>
      </div>
    </div>
  );
}
