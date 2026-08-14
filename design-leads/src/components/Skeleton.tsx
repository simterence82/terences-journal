import React from "react";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", style, ...props }) => (
  <div className={`animate-pulse rounded bg-muted ${className}`} style={style} {...props} />
);
