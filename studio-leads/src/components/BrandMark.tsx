import React from "react";

/**
 * Hand-recreated approximation of the Form & Space logo (two offset
 * isometric blocks) -- the exact source file wasn't available to save into
 * this repo, only visible inline in chat. Swap this out for good: drop the
 * real logo file in public/ (e.g. public/logo.svg) and replace this
 * component's <svg> body with an <img src="/logo.svg" /> pointing at it.
 */
export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 25 27" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2.2 L13.5 5.4 L8 8.6 L2.5 5.4 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M2.5 5.4 L2.5 12.4 L8 15.6 L8 8.6 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8 8.6 L8 15.6 L13.5 12.4 L13.5 5.4 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M17 11.2 L22.5 14.4 L17 17.6 L11.5 14.4 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11.5 14.4 L11.5 21.4 L17 24.6 L17 17.6 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M17 17.6 L17 24.6 L22.5 21.4 L22.5 14.4 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
