import React from "react";
import { Check } from "lucide-react";

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={`peer h-4 w-4 shrink-0 appearance-none rounded-sm border border-border bg-card checked:bg-primary checked:border-primary cursor-pointer ${className}`}
        {...props}
      />
      <Check size={12} className="pointer-events-none absolute inset-0 m-auto text-primary-foreground opacity-0 peer-checked:opacity-100" />
    </span>
  )
);
Checkbox.displayName = "Checkbox";
