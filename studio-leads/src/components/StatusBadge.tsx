import React from "react";
import { Badge } from "./Badge";
import { LEAD_STATUS_LABELS, type LeadStatus } from "../lib/types";

const VARIANT_BY_STATUS: Record<LeadStatus, "outline" | "brand" | "accent" | "warn" | "ok" | "bad"> = {
  new: "outline",
  contacted: "brand",
  quotation_sent: "accent",
  follow_up: "warn",
  on_hold: "outline",
  signed: "ok",
  rejected: "bad",
};

export const StatusBadge: React.FC<{ status: LeadStatus; className?: string }> = ({ status, className }) => (
  <Badge variant={VARIANT_BY_STATUS[status]} className={className}>
    {LEAD_STATUS_LABELS[status]}
  </Badge>
);
