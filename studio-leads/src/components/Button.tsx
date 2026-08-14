import React from "react";

type Variant = "solid" | "soft" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  solid: "bg-brand text-brand-ink shadow-sm hover:opacity-90",
  soft: "bg-[var(--brand-wash)] text-brand hover:opacity-80",
  outline: "border border-line bg-transparent text-ink hover:bg-faint",
  ghost: "bg-transparent text-ink hover:bg-faint",
  danger: "bg-bad text-bad-ink shadow-sm hover:opacity-90",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
  icon: "h-9 w-9 p-0 justify-center",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "solid", size = "md", className = "", type = "button", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={`inline-flex items-center rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:shadow-ring ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
