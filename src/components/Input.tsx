import React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`h-9 w-full rounded border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:shadow-focus ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
