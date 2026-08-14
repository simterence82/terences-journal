import React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint-ink focus:outline-none focus:shadow-ring ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
