import React from "react";

type Variant = "brand" | "accent" | "ok" | "warn" | "bad" | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  brand: "bg-[var(--brand-wash)] text-brand",
  accent: "bg-[var(--accent-wash)] text-accent",
  ok: "bg-[var(--ok-wash)] text-ok",
  warn: "bg-[var(--warn-wash)] text-warn",
  bad: "bg-[var(--bad-wash)] text-bad",
  outline: "border border-line text-ink",
};

export const Badge: React.FC<BadgeProps> = ({ variant = "brand", className = "", children, ...props }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    {...props}
  >
    {children}
  </span>
);
