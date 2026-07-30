import React from 'react';

export default function GlassCard({ children, className = '', style = {}, onClick }) {
  return (
    <div 
      className={`glass-bento-card ${className}`} 
      style={style} 
      onClick={onClick}
    >
      {children}
    </div>
  );
}
