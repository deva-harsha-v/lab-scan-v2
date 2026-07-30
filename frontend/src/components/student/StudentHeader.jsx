import React from 'react';
import LabScanLogo from '../LabScanLogo';
import ThemeToggle from '../ThemeToggle';

export default function StudentHeader({ profile, font = { mono: 'monospace' }, handleLogout }) {
  return (
    <div className="mobile-top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <LabScanLogo size={20} />
        <span style={{ fontSize: '13px', fontFamily: font.mono, color: 'var(--text-muted)', fontWeight: 700 }}>
          {profile?.institution_short_name || 'LMS'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <ThemeToggle size="sm" />
        <button 
          onClick={handleLogout} 
          className="academic-btn btn-academic-secondary" 
          style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '8px' }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
