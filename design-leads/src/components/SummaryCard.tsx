import React, { ReactNode } from "react";

type Tone = "primary" | "secondary" | "success" | "warning" | "destructive";

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-[var(--primary-tint)] text-primary",
  secondary: "bg-[var(--secondary-tint)] text-secondary",
  success: "bg-[var(--success-tint)] text-success",
  warning: "bg-[var(--warning-tint)] text-warning",
  destructive: "bg-[var(--error-tint)] text-error",
};

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, sublabel, icon, tone = "primary", className = "" }) => (
  <div className={`rounded-lg border border-border bg-card px-6 py-4 shadow transition-shadow hover:shadow-md ${className}`}>
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
      {icon && (
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>{icon}</span>
      )}
    </div>
    <div className="font-display text-[1.75rem] font-semibold leading-tight text-foreground tabular-nums">{value}</div>
    {sublabel && <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>}
  </div>
);
