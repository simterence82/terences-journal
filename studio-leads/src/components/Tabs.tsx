import React from "react";

interface TabOption {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  options: TabOption[];
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, options, className = "" }) => (
  <div className={`inline-flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1 ${className}`}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onValueChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active ? "bg-panel text-ink shadow-sm" : "text-faint-ink hover:text-ink"
          }`}
        >
          {opt.label}
          {typeof opt.count === "number" && <span className="ml-1.5 text-xs opacity-70">({opt.count})</span>}
        </button>
      );
    })}
  </div>
);
