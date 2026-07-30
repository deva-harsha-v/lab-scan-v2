import React from 'react';

export default function StatusPill({ status }) {
  const norm = (status || '').toLowerCase().trim();
  
  let bg = 'rgba(148, 163, 184, 0.1)';
  let text = 'var(--text-secondary)';

  if (norm.includes('complete') || norm === 'done') {
    bg = 'rgba(52, 211, 153, 0.1)';
    text = 'var(--accent-green)';
  } else if (norm.includes('progress')) {
    bg = 'rgba(56, 189, 248, 0.1)';
    text = 'var(--accent-blue)';
  } else if (norm.includes('pending') || norm.includes('force')) {
    bg = 'rgba(251, 191, 36, 0.1)';
    text = 'var(--accent-warning)';
  } else if (norm.includes('error') || norm.includes('denied') || norm.includes('offline')) {
    bg = 'rgba(248, 113, 113, 0.1)';
    text = 'var(--accent-red)';
  }

  return (
    <span 
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        backgroundColor: bg,
        color: text,
        border: `1px solid ${text.replace(')', ', 0.15)')}`
      }}
    >
      {status}
    </span>
  );
}
