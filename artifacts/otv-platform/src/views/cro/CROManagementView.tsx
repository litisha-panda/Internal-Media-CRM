import React from "react";
import { NSHView } from "../nsh/NSHView";

/**
 * CROManagementView — CRO role management dashboard.
 * The CRO sees the same hierarchical views as the NSH (with isNSHDashboard flag),
 * plus the WarRoom and CRO-specific pipeline overviews handled by WarroomView/PipelineView.
 * All props pass through to NSHView unchanged.
 */
export function CROManagementView(props: any) {
  return <NSHView {...props} />;
}
