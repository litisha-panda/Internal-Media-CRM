import React from "react";

interface TourOverlayProps {
  C: any;
  tourStep: number;
  setTourStep: React.Dispatch<React.SetStateAction<number>>;
  currentTourSteps: any[];
  tourTargetRect: DOMRect | null;
  closeTour: () => void;
}

export function TourOverlay({ C, tourStep, setTourStep, currentTourSteps, tourTargetRect, closeTour }: TourOverlayProps) {
  const steps = currentTourSteps;
  const step  = steps[tourStep];
  const total = steps.length;
  const isLast  = tourStep === total - 1;
  const isFirst = tourStep === 0;
  const pct = Math.round(((tourStep + 1) / total) * 100);

  const CARD_W = 390;
  const GAP = 18;
  const PAD = 16;
  let cardStyle: React.CSSProperties = { bottom: 32, right: 32 };
  if (tourTargetRect) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const spaceRight  = W - tourTargetRect.right;
    const spaceLeft   = tourTargetRect.left;
    const spaceBottom = H - tourTargetRect.bottom;
    const spaceTop    = tourTargetRect.top;
    if (spaceRight >= CARD_W + GAP) {
      cardStyle = { position:"fixed", left: tourTargetRect.right + GAP, top: Math.max(PAD, Math.min(tourTargetRect.top, H - 350 - PAD)), width: CARD_W };
    } else if (spaceLeft >= CARD_W + GAP) {
      cardStyle = { position:"fixed", right: W - tourTargetRect.left + GAP, top: Math.max(PAD, Math.min(tourTargetRect.top, H - 350 - PAD)), width: CARD_W };
    } else if (spaceBottom >= 300 + GAP) {
      cardStyle = { position:"fixed", top: tourTargetRect.bottom + GAP, left: Math.max(PAD, Math.min(tourTargetRect.left, W - CARD_W - PAD)), width: CARD_W };
    } else if (spaceTop >= 300 + GAP) {
      cardStyle = { position:"fixed", bottom: H - tourTargetRect.top + GAP, left: Math.max(PAD, Math.min(tourTargetRect.left, W - CARD_W - PAD)), width: CARD_W };
    } else {
      cardStyle = { position:"fixed", bottom: 32, left: "50%", transform:"translateX(-50%)", width: CARD_W };
    }
  }

  return (
    <>
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:8000,pointerEvents:"none"}} />
      {tourTargetRect && (
        <div style={{
          position:"fixed", left: tourTargetRect.left - 5, top: tourTargetRect.top - 5,
          width: tourTargetRect.width + 10, height: tourTargetRect.height + 10,
          border:`2px solid ${C.accent}`, borderRadius:8,
          boxShadow:`0 0 0 3px ${C.accent}44, 0 0 22px 4px ${C.accent}55`,
          zIndex:8002, pointerEvents:"none", transition:"all .25s cubic-bezier(.4,0,.2,1)",
        }} />
      )}
      <div style={{...cardStyle,position:"fixed",zIndex:8003,background:C.surface,border:`1px solid ${C.accent}55`,borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.7)",overflow:"hidden",transition:"top .25s,left .25s,right .25s,bottom .25s"}}>
        <div style={{height:3,background:C.s2}}>
          <div style={{height:"100%",width:`${pct}%`,background:C.accent,transition:"width .35s"}} />
        </div>
        <div style={{padding:"20px 22px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:10,color:C.dim,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase"}}>Step {tourStep+1} of {total}</span>
            <button onClick={closeTour} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
          </div>
          <div className="sans" style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8,lineHeight:1.3}}>{step.title}</div>
          <div style={{fontSize:12,color:C.dim,lineHeight:1.7,marginBottom:(step as any).tip?10:0}}>{step.desc}</div>
          {(step as any).tip && (
            <div style={{background:`${C.accent}12`,border:`1px solid ${C.accent}30`,borderRadius:6,padding:"8px 12px",fontSize:11,color:C.accent,lineHeight:1.5}}>
              💡 {(step as any).tip}
            </div>
          )}
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 22px",display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setTourStep(s=>Math.max(0,s-1))} disabled={isFirst}
            style={{background:"transparent",border:`1px solid ${isFirst?C.s3:C.border}`,borderRadius:6,padding:"6px 14px",color:isFirst?C.muted:C.dim,fontSize:11,cursor:isFirst?"default":"pointer",fontFamily:"'DM Mono',monospace"}}>
            ← Prev
          </button>
          {isLast ? (
            <button onClick={closeTour} style={{flex:1,background:C.accent,border:"none",color:"#000",borderRadius:6,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
              Done ✓
            </button>
          ) : (
            <button onClick={()=>setTourStep(s=>Math.min(total-1,s+1))}
              style={{flex:1,background:`${C.accent}18`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"8px 14px",fontSize:12,color:C.accent,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
              Next →
            </button>
          )}
          <button onClick={closeTour} style={{background:"transparent",border:"none",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",padding:"6px 8px"}}>
            Skip all
          </button>
        </div>
      </div>
    </>
  );
}
