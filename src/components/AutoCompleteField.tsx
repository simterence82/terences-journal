import React, { useMemo, useRef, useState } from "react";
import { Input } from "./Input";

interface AutoCompleteFieldProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const AutoCompleteField: React.FC<AutoCompleteFieldProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const pool = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;
    return pool.filter((o) => o.toLowerCase() !== query).slice(0, 8);
  }, [options, value]);

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label className="text-[0.8125rem] font-medium text-foreground">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          placeholder={placeholder ?? "Type or pick a previous value..."}
        />
        {isOpen && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border bg-popup shadow-md">
            {suggestions.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
