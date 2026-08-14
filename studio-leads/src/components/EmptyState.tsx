import React, { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, className = "" }) => (
  <div className={`flex flex-col items-center gap-3 py-16 text-faint-ink ${className}`}>
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-faint text-faint-ink">{icon}</span>
    <p>{message}</p>
  </div>
);
