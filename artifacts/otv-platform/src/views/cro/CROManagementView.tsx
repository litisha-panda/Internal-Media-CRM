import React from "react";
import { NSHView } from "../nsh/NSHView";

interface CROManagementViewProps {
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
  isMobile: boolean;
  nshRHDrill: string | null;
  setNshRHDrill: React.Dispatch<React.SetStateAction<string | null>>;
  nshRegion: string;
  setNshRegion: React.Dispatch<React.SetStateAction<string>>;
  targetDrilldown: { key: string; label: string } | null;
  setTargetDrilldown: React.Dispatch<React.SetStateAction<{ key: string; label: string } | null>>;
  nshRepDrill: string | null;
  setNshRepDrill: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * CROManagementView — CRO role management dashboard.
 * The CRO sees the same hierarchical views as the NSH (with isNSHDashboard flag),
 * plus the WarRoom and CRO-specific pipeline overviews handled by WarroomView/PipelineView.
 * All props pass through to NSHView unchanged.
 *
 * NOTE: Not rendered directly in CROApp.tsx — NSHView handles all NSH/Strategy/CRO
 * screens via the isNSHDashboard flag to avoid duplicate rendering. This component
 * is retained for potential future CRO-specific divergence.
 */
export function CROManagementView(props: CROManagementViewProps) {
  return <NSHView {...props} />;
}
