import React from 'react';

/**
 * LabScan Logo SVG Component
 * Usage: <LabScanLogo size={28} gradientId="uniqueId" />
 * gradientId must be unique per page to avoid SVG gradient conflicts
 */
export default function LabScanLogo({ size = 28, gradientId = 'logoGradient', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 10px var(--accent-blue))', flexShrink: 0, ...style }}
    >
      <path d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="50" cy="5" r="2.5" fill="var(--accent-blue)" />
      <circle cx="89" cy="27.5" r="2.5" fill="var(--accent-blue)" />
      <circle cx="89" cy="72.5" r="2.5" fill="var(--accent-blue)" />
      <circle cx="50" cy="95" r="2.5" fill="var(--accent-blue)" />
      <circle cx="11" cy="72.5" r="2.5" fill="var(--accent-blue)" />
      <circle cx="11" cy="27.5" r="2.5" fill="var(--accent-blue)" />
      <polygon points="50,15 80,32.5 80,67.5 50,85 20,67.5 20,32.5" stroke={`url(#${gradientId})`} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="50" cy="50" rx="10" ry="23" stroke="var(--accent-blue)" strokeWidth="1.5" transform="rotate(30 50 50)" />
      <ellipse cx="50" cy="50" rx="10" ry="23" stroke="var(--accent-blue)" strokeWidth="1.5" transform="rotate(-30 50 50)" />
      <circle cx="50" cy="50" r="4" fill="var(--accent-blue)" />
      <line x1="26" y1="38" x2="74" y2="38" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="26" y1="62" x2="74" y2="62" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="2 2" />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-blue)" />
          <stop offset="100%" stopColor="var(--accent-green)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
