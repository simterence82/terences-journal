import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  onConfirm,
}) => {
  const [isBusy, setIsBusy] = useState(false);

  const handleConfirm = async () => {
    setIsBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{description}</p>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant={destructive ? "destructive" : "primary"} onClick={handleConfirm} disabled={isBusy}>
          {isBusy ? "Working..." : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

/** Hook that manages the open/target state for a ConfirmDialog bound to a delete action. */
export function useConfirmDialog<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return {
    target,
    isOpen: target !== null,
    open: (value: T) => setTarget(value),
    close: () => setTarget(null),
  };
}
