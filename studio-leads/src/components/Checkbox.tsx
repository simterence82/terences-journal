import React from "react";
import { Check } from "lucide-react";

/** A checkbox drawn as a plain outlined box -- transparent background,
    checkmark only rendered when checked -- instead of relying on the
    browser's native checkbox appearance. */
export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
}> = ({ checked, onChange, children, className = "" }) => (
  <label className={`flex cursor-pointer items-center gap-2 ${className}`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line bg-transparent">
      {checked && <Check size={12} strokeWidth={3} className="text-ink" />}
    </span>
    {children}
  </label>
);
