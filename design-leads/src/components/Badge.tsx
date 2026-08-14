import React from "react";

type Variant = "primary" | "secondary" | "destructive" | "success" | "warning" | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[var(--primary-tint)] text-primary",
  secondary: "bg-[var(--secondary-tint)] text-secondary",
  destructive: "bg-[var(--error-tint)] text-error",
  success: "bg-[var(--success-tint)] text-success",
  warning: "bg-[var(--warning-tint)] text-warning",
  outline: "border border-border text-foreground",
};

export const Badge: React.FC<BadgeProps> = ({ variant = "primary", className = "", children, ...props }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    {...props}
  >
    {children}
  </span>
);
