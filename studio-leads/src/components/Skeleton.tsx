import React from "react";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", style, ...props }) => (
  <div className={`animate-pulse rounded-lg bg-faint ${className}`} style={style} {...props} />
);
