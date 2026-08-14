import React from "react";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-faint-ink focus:outline-none focus:shadow-ring ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
