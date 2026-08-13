import React from "react";
import { Badge } from "./Badge";
import type { TaskPriority } from "../lib/types";

const VARIANT_BY_PRIORITY: Record<TaskPriority, "secondary" | "warning" | "destructive"> = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
};

export const PriorityBadge: React.FC<{ priority: TaskPriority; className?: string }> = ({ priority, className }) => (
  <Badge variant={VARIANT_BY_PRIORITY[priority]} className={className}>
    {priority}
  </Badge>
);
