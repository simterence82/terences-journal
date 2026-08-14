import React from "react";
import { Badge } from "./Badge";
import { LEAD_STATUS_LABELS, type LeadStatus } from "../lib/types";

const VARIANT_BY_STATUS: Record<LeadStatus, "outline" | "primary" | "secondary" | "warning" | "success" | "destructive"> = {
  new: "outline",
  contacted: "primary",
  quotation_sent: "secondary",
  follow_up: "warning",
  on_hold: "outline",
  signed: "success",
  rejected: "destructive",
};

export const StatusBadge: React.FC<{ status: LeadStatus; className?: string }> = ({ status, className }) => (
  <Badge variant={VARIANT_BY_STATUS[status]} className={className}>
    {LEAD_STATUS_LABELS[status]}
  </Badge>
);
