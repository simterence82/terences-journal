import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)]" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};

export const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 pr-6">{children}</div>
);

export const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-display text-lg font-semibold text-foreground">{children}</h2>
);

export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-6 flex justify-end gap-2">{children}</div>
);
