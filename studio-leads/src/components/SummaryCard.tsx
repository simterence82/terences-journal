import React, { ReactNode } from "react";

type Tone = "brand" | "accent" | "ok" | "warn" | "bad";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-[var(--brand-wash)] text-brand",
  accent: "bg-[var(--accent-wash)] text-accent",
  ok: "bg-[var(--ok-wash)] text-ok",
  warn: "bg-[var(--warn-wash)] text-warn",
  bad: "bg-[var(--bad-wash)] text-bad",
};

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, sublabel, icon, tone = "brand", className = "" }) => (
  <div className={`rounded-xl border border-line bg-panel px-6 py-4 shadow-sm transition-shadow hover:shadow-md ${className}`}>
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[0.8125rem] font-medium text-faint-ink">{label}</span>
      {icon && (
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>{icon}</span>
      )}
    </div>
    <div className="font-display text-[1.75rem] font-semibold leading-tight text-ink tabular-nums">{value}</div>
    {sublabel && <div className="mt-1 text-xs text-faint-ink">{sublabel}</div>}
  </div>
);
