import React from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, options, className = "" }) => (
  <div className={`relative ${className}`}>
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="h-9 w-full appearance-none rounded border border-border bg-card px-3 pr-8 text-sm text-foreground focus:outline-none focus:shadow-focus"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
  </div>
);
