import React from 'react';

export default function Skeleton({ variant = 'text', width, height, style, className = '' }) {
  const customStyle = {
    width: width || (variant === 'circle' ? '40px' : '100%'),
    height: height || (variant === 'circle' ? '40px' : variant === 'card' ? 'auto' : '16px'),
    ...style
  };

  if (variant === 'card') {
    return (
      <div className={`skeleton-card ${className}`} style={customStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-base skeleton-circle" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton-base skeleton-pill" style={{ height: '18px', width: '60%' }} />
            <div className="skeleton-base skeleton-pill" style={{ height: '12px', width: '30%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div className="skeleton-base" style={{ height: '14px', width: '95%' }} />
          <div className="skeleton-base" style={{ height: '14px', width: '70%' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <div className="skeleton-base skeleton-pill" style={{ height: '32px', width: '80px' }} />
          <div className="skeleton-base skeleton-pill" style={{ height: '32px', width: '60px' }} />
        </div>
      </div>
    );
  }

  const variantClass = variant === 'circle' ? 'skeleton-circle' : variant === 'text' ? 'skeleton-pill' : '';

  return (
    <div 
      className={`skeleton-base ${variantClass} ${className}`} 
      style={customStyle} 
    />
  );
}
