import React from 'react';
import { Grid, BarChart3, Calendar, FileText, Settings } from 'lucide-react';

export default function StudentMobileNav({ activeRailTab, setActiveRailTab }) {
  return (
    <nav className="mobile-nav-pill">
      <button 
        className={`mobile-nav-pill-item ${activeRailTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveRailTab('dashboard')}
      >
        <div className="active-indicator">
          <Grid size={20} />
        </div>
        <span>Workspace</span>
      </button>
      <button 
        className={`mobile-nav-pill-item ${activeRailTab === 'analytics' ? 'active' : ''}`}
        onClick={() => setActiveRailTab('analytics')}
      >
        <div className="active-indicator">
          <BarChart3 size={20} />
        </div>
        <span>Analytics</span>
      </button>
      <button 
        className={`mobile-nav-pill-item ${activeRailTab === 'calendar' ? 'active' : ''}`}
        onClick={() => setActiveRailTab('calendar')}
      >
        <div className="active-indicator">
          <Calendar size={20} />
        </div>
        <span>Schedule</span>
      </button>
      <button 
        className={`mobile-nav-pill-item ${activeRailTab === 'files' ? 'active' : ''}`}
        onClick={() => setActiveRailTab('files')}
      >
        <div className="active-indicator">
          <FileText size={20} />
        </div>
        <span>Records</span>
      </button>
      <button 
        className={`mobile-nav-pill-item ${activeRailTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveRailTab('settings')}
      >
        <div className="active-indicator">
          <Settings size={20} />
        </div>
        <span>Profile</span>
      </button>
    </nav>
  );
}
