import React from 'react';
import { Home, Grid, BarChart3, Calendar, FileText, Settings, User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';
import LabScanLogo from '../LabScanLogo';

export default function SidebarRail({ activeItem, onItemClick, user, showHome = false, onLogout }) {
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', icon: Grid, label: 'Dashboard' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'files', icon: FileText, label: 'Files' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <>
      <style>{`
        .sidebar-rail-wrapper {
          position: fixed;
          left: 16px;
          top: 16px;
          bottom: 16px;
          width: 76px;
          background: var(--glass-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          box-shadow: var(--glass-shadow);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 24px 0;
          z-index: 1000;
        }

        .sidebar-rail-nav {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
          width: 100%;
        }

        .sidebar-rail-btn {
          width: 48px;
          height: 48px;
          border-radius: 999px; /* Floating rounded icons! */
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          background: none;
        }

        .sidebar-rail-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
        }

        .sidebar-rail-btn.active {
          color: #ffffff;
          background: var(--accent-blue);
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.35);
        }

        .sidebar-rail-btn.active:hover {
          background: #0ea5e9;
        }

        .sidebar-rail-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          width: 100%;
        }

        .sidebar-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.1);
          border: 1.5px solid var(--accent-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-blue);
          font-weight: 700;
          font-size: 13px;
        }

        .sidebar-logo {
          margin-bottom: 16px;
        }

        /* Mobile bottom rail bar is hidden since we use a custom floating pill navbar */
        @media (max-width: 767px) {
          .sidebar-rail-wrapper {
            display: none !important;
          }
        }
      `}</style>

      <div className="sidebar-rail-wrapper">
        {/* Top / Main Navigation Section */}
        <div className="sidebar-rail-nav">
          <div className="sidebar-logo">
            <LabScanLogo size={28} />
          </div>
          {showHome && (
            <>
              <button 
                className="sidebar-rail-btn"
                title="Go to Home"
                onClick={() => navigate('/')}
              >
                <Home size={20} />
              </button>
              <div style={{ width: '24px', height: '1px', background: 'var(--border-color)', margin: '4px 0' }} className="sidebar-divider-rail" />
            </>
          )}

          {navItems.map(item => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                className={`sidebar-rail-btn ${activeItem === item.id ? 'active' : ''}`}
                onClick={() => onItemClick(item.id)}
                title={item.label}
              >
                <IconComponent size={20} />
              </button>
            );
          })}
        </div>

        {/* Footer Section */}
        <div className="sidebar-rail-footer">
          <ThemeToggle size="sm" />
          {onLogout && (
            <button 
              className="sidebar-rail-btn" 
              title="Logout" 
              onClick={onLogout}
              style={{ color: 'var(--accent-red)' }}
            >
              <LogOut size={20} />
            </button>
          )}
          <div className="sidebar-avatar" title={user?.full_name || user?.username}>
            {getInitials(user?.full_name || user?.username)}
          </div>
        </div>
      </div>
    </>
  );
}
