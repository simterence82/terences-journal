import React, { ReactNode } from "react";

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, sublabel, icon, className = "" }) => (
  <div className={`rounded-lg border border-border bg-card px-6 py-4 shadow ${className}`}>
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
      {icon && <span className="text-muted-foreground">{icon}</span>}
    </div>
    <div className="font-display text-[1.75rem] font-semibold leading-tight text-foreground tabular-nums">{value}</div>
    {sublabel && <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>}
  </div>
);
