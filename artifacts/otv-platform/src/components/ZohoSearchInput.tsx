/**
 * ZohoSearchInput — DISABLED (FIX 0: Zoho CRM integration removed).
 * Client/agency data now sourced from approved target allocations only.
 * This stub preserves existing imports to avoid compile errors.
 */
import React from "react";

export interface ZohoSearchInputProps {
  placeholder?: string;
  onSelect?: (name: string, id: string) => void;
  value?: string;
  label?: string;
  [key: string]: unknown;
}

/** Stub — renders nothing. Remove call-site usages progressively. */
const ZohoSearchInput: React.FC<ZohoSearchInputProps> = () => null;

export default ZohoSearchInput;
