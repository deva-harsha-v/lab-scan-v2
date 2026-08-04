import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getUser, clearSession, setSession } from '../utils/api';
import { 
  LogOut, Play, ChevronRight, ChevronDown, ChevronUp, User, Clipboard, ShieldCheck, 
  Settings, BookOpen, Key, Lock, Check, Loader2, Info, Calendar, FileText, BarChart3, Grid, AlertTriangle,
  Eye, EyeOff
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';
import SidebarRail from '../components/bento/SidebarRail';
import GlassCard from '../components/bento/GlassCard';
import ProgressRing from '../components/bento/ProgressRing';
import StatusPill from '../components/bento/StatusPill';
import GreetingHero from '../components/bento/GreetingHero';
import Skeleton from '../components/Skeleton';
import StudentHeader from '../components/student/StudentHeader';
import StudentMobileNav from '../components/student/StudentMobileNav';
import WeeklyActivityChart from '../components/student/WeeklyActivityChart';

const font = { mono: "'Space Mono', monospace", sans: "'Outfit', sans-serif" };

export default function StudentDashboard() {
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Navigation active tab: dashboard, analytics, calendar, files, settings
  const [activeRailTab, setActiveRailTab] = useState('dashboard');
  const [startingExpId, setStartingExpId] = useState(null);
  const [expandedLabName, setExpandedLabName] = useState(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const navigate = useNavigate();
  const user = getUser();

  const loadData = async () => {
    try {
      let histData = [];
      try {
        histData = await apiFetch('/sessions/history');
      } catch (e) {
        histData = await apiFetch('/sessions/my-history');
      }
      const profData = await apiFetch('/auth/me').catch(() => null);
      setHistory(Array.isArray(histData) ? histData : []);
      setProfile(profData || null);
    } catch (err) {
      console.error('Error loading student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [navigate]);

  const handleStartExperiment = async (expId) => {
    if (startingExpId) return;
    if (profile?.force_password_change) {
      alert('Password change required: You must change your default password before accessing laboratory worksheets.');
      return;
    }
    setStartingExpId(expId);
    try {
      await apiFetch('/sessions/start', {
        method: 'POST',
        body: JSON.stringify({ experiment_id: expId })
      });
      navigate(`/experiment/${expId}`);
    } catch (err) {
      alert(err.message || 'Failed to start session.');
    } finally {
      setStartingExpId(null);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Confirm password does not match.');
      return;
    }

    setPwLoading(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      setPwSuccess('Password updated successfully. Forced change flag cleared.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const updatedProfile = await apiFetch('/auth/profile');
      setProfile(updatedProfile);

      const stored = JSON.parse(localStorage.getItem('labscan_user') || '{}');
      stored.force_password_change = false;
      localStorage.setItem('labscan_user', JSON.stringify(stored));
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  const handleDownloadWorksheet = (item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download your digital laboratory sheet.');
      return;
    }

    const signoffDate = item.session_completed_at ? new Date(item.session_completed_at).toLocaleString() : new Date().toLocaleString();
    const instName = profile?.institution_name || 'Academic Institution';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Worksheet Record - ${item.experiment_name}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: #fff; color: #111; line-height: 1.6; }
            .container { max-width: 680px; margin: 0 auto; border: 2px solid #111; padding: 32px; border-radius: 8px; }
            .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
            .title { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 4px 0; }
            .subtitle { font-size: 12px; color: #666; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .badge { display: inline-block; background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .item { border-bottom: 1px solid #eee; padding-bottom: 6px; }
            .lbl { font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase; }
            .val { font-size: 14px; font-weight: 700; color: #111; }
            .stamp-box { border: 2px dashed #15803d; background: #f0fdf4; padding: 16px; text-align: center; border-radius: 6px; margin-top: 24px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="max-width:680px; margin:0 auto 16px; text-align:right;">
            <button onclick="window.print()" style="background:#0284c7; color:#fff; border:none; padding:10px 20px; border-radius:6px; font-weight:700; cursor:pointer;">
              🖨️ Print / Save as PDF
            </button>
          </div>
          <div class="container">
            <div class="header">
              <div class="subtitle">${instName.toUpperCase()}</div>
              <h1 class="title">OFFICIAL LABORATORY WORKSHEET</h1>
              <div class="subtitle">AUTOMATED AR/QR PROOF-OF-PRESENCE VERIFICATION</div>
            </div>

            <div style="text-align: center;">
              <div class="badge">✔ VERIFIED & OFFICIALLY SIGNED OFF</div>
            </div>

            <div class="grid">
              <div class="item">
                <div class="lbl">Student Name</div>
                <div class="val">${profile?.full_name || user?.username}</div>
              </div>
              <div class="item">
                <div class="lbl">Roll Number</div>
                <div class="val">${profile?.roll_number || 'N/A'}</div>
              </div>
              <div class="item">
                <div class="lbl">Academic Branch</div>
                <div class="val">${profile?.branch_name || 'EEE'}</div>
              </div>
              <div class="item">
                <div class="lbl">Laboratory Unit</div>
                <div class="val">${item.lab_name}</div>
              </div>
              <div class="item" style="grid-column: 1 / -1;">
                <div class="lbl">Experiment Title</div>
                <div class="val">${item.experiment_name}</div>
              </div>
              <div class="item">
                <div class="lbl">Lab Bench Location</div>
                <div class="val">${item.location || 'Block 4, Room 302'}</div>
              </div>
              <div class="item">
                <div class="lbl">ArUco Marker Target</div>
                <div class="val">Marker #${item.ar_qr_marker_id || '01'}</div>
              </div>
              <div class="item" style="grid-column: 1 / -1;">
                <div class="lbl">Signoff Date & Time</div>
                <div class="val">${signoffDate}</div>
              </div>
            </div>

            <div class="stamp-box">
              <div style="font-weight: 800; color: #15803d; font-size: 13px;">DEPARTMENT FACULTY STAMP VALIDATED</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">Session ID: ${item.session_id || 'v2-completed'}</div>
            </div>
          </div>
          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const showForceOverlay = !!profile?.force_password_change;

  // Split history worksheets
  const inProgressExperiments = history.filter(item => !!item.session_id && !item.session_completed_at);
  const assignedExperiments = history.filter(item => !item.session_id);
  const completedExperiments = history.filter(item => !!item.session_completed_at);

  const totalAssigned = history.length;
  const completedCount = completedExperiments.length;
  const inProgressCount = inProgressExperiments.length;
  const pendingVerificationCount = inProgressExperiments.filter(item => !!item.checklist_completed_at).length;

  const completionPercentage = totalAssigned > 0 ? (completedCount / totalAssigned) * 100 : 0;

  return (
    <div className="bento-dashboard-wrapper">
      <style>{`
        .bento-dashboard-wrapper {
          min-height: 100vh;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: ${font.sans};
          position: relative;
          padding-left: 112px;
          box-sizing: border-box;
        }

        .dashboard-content-layout {
          padding: 40px;
          max-width: 1300px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }

        /* Top header for mobile navigation (hidden since we use floating top-bar) */
        .mobile-nav-header {
          display: none !important;
        }

        /* Bento Grid */
        .bento-grid-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 30px;
        }

        .bento-card-full {
          grid-column: span 3;
        }
        .bento-card-2col {
          grid-column: span 2;
        }
        .bento-card-1col {
          grid-column: span 1;
        }

        .dashboard-hud-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        /* Simple mini charts */
        .analytics-bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 140px;
          margin-top: 20px;
          padding-bottom: 36px;
          position: relative;
        }
        .analytics-column-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          position: relative;
          width: 40px;
        }
        .analytics-bar {
          width: 22px;
          background: var(--accent-blue);
          border-radius: 6px;
          transition: height 0.6s ease;
        }
        .analytics-bar-label {
          position: absolute;
          bottom: -32px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 700;
          text-align: center;
          line-height: 1.2;
          white-space: nowrap;
        }

        /* Lists stack */
        .bento-list-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        .bento-list-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 13.5px;
          transition: background 0.2s ease;
        }
        .bento-list-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        /* Quick shortcuts grid */
        .shortcuts-grid-layout {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 16px;
        }
        .shortcut-rounded-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          gap: 8px;
        }
        .shortcut-rounded-tile:hover {
          background: rgba(56, 189, 248, 0.05);
          border-color: var(--accent-blue);
          transform: translateY(-2px);
        }

        /* Force Password overlay */
        .force-password-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(5, 10, 20, 0.9);
          backdrop-filter: blur(24px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        @media (max-width: 900px) {
          .bento-grid-container {
            grid-template-columns: repeat(2, 1fr);
          }
          .bento-card-full, .bento-card-2col, .bento-card-1col {
            grid-column: span 2;
            min-width: 0 !important;
            max-width: 100% !important;
          }
        }

        @media (max-width: 767px) {
          .bento-dashboard-wrapper {
            padding-left: 0;
            padding-top: 70px;
            padding-bottom: 90px;
            overflow-x: hidden !important;
          }
          .dashboard-content-layout {
            padding: 16px;
            max-width: 100% !important;
            overflow-x: hidden !important;
            box-sizing: border-box;
          }
          .bento-grid-container {
            grid-template-columns: 1fr;
            gap: 16px;
            width: 100% !important;
          }
          .bento-card-full, .bento-card-2col, .bento-card-1col {
            grid-column: span 1 !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .dashboard-hud-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* Ambient background glows */}
      <div className="ambient-glow-canvas">
        <div className="glow-blue" />
        <div className="glow-amber" />
      </div>

      {/* Left Sidebar Rail */}
      <SidebarRail 
        activeItem={activeRailTab} 
        onItemClick={setActiveRailTab} 
        user={profile || user} 
        showHome={false}
        onLogout={handleLogout}
      />

      {/* Floating Top Mobile Header */}
      <StudentHeader profile={profile} font={font} handleLogout={handleLogout} />

      {/* Floating Bottom Mobile Tab Bar */}
      <StudentMobileNav activeRailTab={activeRailTab} setActiveRailTab={setActiveRailTab} />

      {/* Main content grid area */}
      <main className="dashboard-content-layout">
        
        {loading ? (
          <>
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <Skeleton variant="text" width="240px" height="28px" />
              <Skeleton variant="text" width="180px" height="13px" style={{ marginTop: '6px' }} />
            </div>

            <div className="bento-grid-container">
              {/* Welcome banner skeleton */}
              <div className="bento-card-2col">
                <div className="skeleton-card" style={{ height: '140px' }}>
                  <Skeleton variant="text" width="40%" height="24px" />
                  <Skeleton variant="text" width="60%" height="14px" style={{ marginTop: '8px' }} />
                  <Skeleton variant="text" width="30%" height="14px" style={{ marginTop: '4px' }} />
                </div>
              </div>

              {/* Metrics grid skeleton */}
              <div className="bento-card-1col">
                <div className="skeleton-card" style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Skeleton variant="circle" width="56px" height="56px" />
                  <Skeleton variant="text" width="60%" height="12px" style={{ marginTop: '8px' }} />
                </div>
              </div>

              {/* Assigned worksheets list skeleton */}
              <div className="bento-card-2col">
                <div className="skeleton-card" style={{ height: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <Skeleton variant="text" width="120px" height="18px" />
                    <Skeleton variant="text" width="80px" height="18px" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Skeleton variant="text" width="40%" height="14px" />
                          <Skeleton variant="text" width="25%" height="10px" />
                        </div>
                        <Skeleton variant="text" width="70px" height="32px" style={{ borderRadius: '999px' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shortcuts grid card skeleton */}
              <div className="bento-card-1col">
                <div className="skeleton-card" style={{ height: '220px' }}>
                  <Skeleton variant="text" width="100px" height="18px" style={{ marginBottom: '14px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ height: '80px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                        <Skeleton variant="circle" width="20px" height="20px" />
                        <Skeleton variant="text" width="50%" height="10px" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* TAB 1: WORKSPACE DASHBOARD */}
            {activeRailTab === 'dashboard' && (
          <>
            <div className="u-text-left">
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Laboratory Workspace</h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Active academic course sessions and logs
              </p>
            </div>

            <div className="bento-grid-container">
              {/* 1. Greeting Hero Card (Full 2-col span) */}
              <div className="bento-card-2col">
                <GreetingHero 
                  name={profile?.full_name || user?.username} 
                  department={profile?.branch_name ? `${profile.branch_name} Department` : ''} 
                />
              </div>

              {/* 2. Stat / Progress Ring Card (1-col span) */}
              <div className="bento-card-1col">
                <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '160px' }}>
                  <ProgressRing 
                    percentage={completionPercentage} 
                    label="Workspace Completion" 
                  />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                    {completedCount} of {totalAssigned} Experiments Completed
                  </div>
                </GlassCard>
              </div>

              {/* 3. List Card: Worksheets Checklist (2-col span) */}
              <div className="bento-card-2col">
                <GlassCard style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Assigned Worksheets</h3>
                    <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontFamily: font.mono, fontWeight: 700 }}>
                      {history.length} REGISTERED
                    </span>
                  </div>

                  {history.length > 0 ? (
                    <div className="bento-list-stack">
                      {history.map(item => {
                        let statusText = 'Pending';
                        if (item.session_completed_at) statusText = 'Completed';
                        else if (item.session_id) statusText = 'In Progress';

                        const verNum = item.session_version_number || item.latest_version_number || 1;

                        return (
                          <div key={item.session_id ? item.session_id : `pending-${item.experiment_id}-${verNum}`} className="bento-list-row">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>
                                {item.experiment_name} <span style={{ fontSize: '11px', color: 'var(--accent-blue)', opacity: 0.8 }}>(V{verNum})</span>
                              </strong>
                              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{item.lab_name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <StatusPill status={statusText} />
                              <button 
                                className="academic-btn btn-academic-primary pill" 
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                disabled={startingExpId === item.experiment_id}
                                onClick={() => {
                                  if (item.session_id) {
                                    navigate(`/experiment/${item.experiment_id}?sessionId=${item.session_id}`);
                                  } else {
                                    handleStartExperiment(item.experiment_id);
                                  }
                                }}
                              >
                                {startingExpId === item.experiment_id ? 'Launching...' : (statusText === 'Completed' ? 'Review' : (statusText === 'In Progress' ? 'Resume' : 'Start'))}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      <Clipboard size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No worksheets assigned</div>
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>Your assigned academic branch has no laboratories configured.</div>
                    </div>
                  )}
                </GlassCard>
              </div>

              {/* 4. Shortcuts grid card (1-col span) */}
              <div className="bento-card-1col">
                <GlassCard style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>Quick Actions</h3>
                  <div className="shortcuts-grid-layout">
                    <div className="shortcut-rounded-tile" onClick={() => setActiveRailTab('settings')}>
                      <User size={18} style={{ color: 'var(--accent-blue)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>Profile</span>
                    </div>
                    <div className="shortcut-rounded-tile" onClick={() => setActiveRailTab('settings')}>
                      <Key size={18} style={{ color: 'var(--accent-warning)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>Password</span>
                    </div>
                    <div className="shortcut-rounded-tile" onClick={() => setActiveRailTab('files')}>
                      <FileText size={18} style={{ color: 'var(--accent-green)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>Records</span>
                    </div>
                    <div className="shortcut-rounded-tile" onClick={() => setActiveRailTab('calendar')}>
                      <Calendar size={18} style={{ color: 'var(--accent-blue)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>Schedule</span>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* 5. System Status / Session Health (1-col span) */}
              <div className="bento-card-1col">
                <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '160px' }}>
                  <ProgressRing 
                    percentage={100} 
                    label="Telemetry Sync" 
                    gradientId="syncGradient"
                  />
                  <div style={{ fontSize: '11.5px', color: 'var(--accent-green)', fontWeight: 700, textTransform: 'uppercase', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Systems Online
                  </div>
                </GlassCard>
              </div>

              {/* 6. Upcoming Activities logs card (2-col span) */}
              <div className="bento-card-2col">
                <GlassCard style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>Completed Submissions</h3>
                  {completedExperiments.length > 0 ? (
                    <div className="bento-list-stack">
                      {completedExperiments.map(item => {
                        const verNum = item.session_version_number || item.latest_version_number || 1;
                        return (
                          <div key={item.session_id ? `comp-${item.session_id}` : `comp-exp-${item.experiment_id}-${verNum}`} className="bento-list-row" style={{ borderColor: 'rgba(52, 211, 153, 0.15)' }}>
                            <div>
                              <strong>{item.experiment_name} <span style={{ fontSize: '11px', color: 'var(--accent-green)', opacity: 0.8 }}>(V{verNum})</span></strong>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Signoff Date: {new Date(item.session_completed_at).toLocaleDateString()}
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)' }}>
                              ✓ VERIFIED RECORD
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                      No completed worksheets submitted yet.
                    </div>
                  )}
                </GlassCard>
              </div>

            </div>
          </>
        )}

        {/* TAB 2: ANALYTICS HUD */}
        {activeRailTab === 'analytics' && (
          <>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, textAlign: 'left' }}>Session Analytics</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
              Academic progress logs, elapsed timing, and statistics
            </p>

            <div className="bento-grid-container">
              {/* Workspace Completion Rate Card (Full 3-col span) */}
              <div className="bento-card-full">
                <GlassCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '24px' }}>
                  <ProgressRing percentage={completionPercentage} label="Workspace Completion Rate" size={130} />
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>Academic Performance Index</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                      {completedCount} of {totalAssigned} laboratory worksheets verified and signed off.
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* Bold numbers HUD row */}
              <div className="bento-card-full">
                <div className="dashboard-hud-grid">
                  <GlassCard style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: font.mono }}>{totalAssigned}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Total Assigned</div>
                  </GlassCard>
                  <GlassCard style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: font.mono }}>{completedCount}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Completed</div>
                  </GlassCard>
                  <GlassCard style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: font.mono }}>{inProgressCount}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>In Progress</div>
                  </GlassCard>
                  <GlassCard style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: font.mono }}>{pendingVerificationCount}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Pending Signoff</div>
                  </GlassCard>
                </div>
              </div>

              {/* Dynamic Session Activity Bar Chart */}
              <WeeklyActivityChart history={history} font={font} />
            </div>
          </>
        )}

        {/* TAB 3: CALENDAR & LAB UNITS */}
        {activeRailTab === 'calendar' && (
          <>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, textAlign: 'left' }}>Assigned Laboratory Units</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
              Academic laboratory locations and assigned worksheet modules
            </p>

            <div className="bento-grid-container" style={{ textAlign: 'left' }}>
              <div className="bento-card-full">
                <GlassCard>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Registered Laboratory Units</h3>
                  {history.length > 0 ? (
                    <div className="bento-list-stack">
                      {Array.from(new Set(history.map(item => item.lab_name))).map(labName => {
                        const labItems = history.filter(item => item.lab_name === labName);
                        const labLoc = labItems[0]?.location || 'Block 4, Room 302';
                        const isExpanded = expandedLabName === labName;
                        const validExps = labItems.filter(item => item.experiment_id);

                        return (
                          <div key={labName} className="bento-list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{labName}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Location: {labLoc}</span>
                                <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontFamily: font.mono, fontWeight: 700, marginTop: '2px' }}>
                                  {validExps.length} {validExps.length === 1 ? 'Worksheet' : 'Worksheets'} Assigned
                                </span>
                              </div>
                              <button 
                                className="academic-btn btn-academic-secondary"
                                style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => setExpandedLabName(isExpanded ? null : labName)}
                              >
                                {isExpanded ? 'Hide Worksheets' : 'View Worksheets'}
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>

                            {isExpanded && (
                              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {validExps.length > 0 ? (
                                  validExps.map(exp => {
                                    let statusText = 'Pending';
                                    if (exp.session_completed_at) statusText = 'Completed';
                                    else if (exp.session_id) statusText = 'In Progress';

                                    const verNum = exp.session_version_number || exp.latest_version_number || 1;

                                    return (
                                      <div key={exp.session_id ? exp.session_id : `drawer-pending-${exp.experiment_id}-${verNum}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ textStyle: 'left', textAlign: 'left' }}>
                                          <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                                            {exp.experiment_name} <span style={{ fontSize: '11px', color: 'var(--accent-blue)', opacity: 0.8 }}>(V{verNum})</span>
                                          </strong>
                                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{exp.description}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <StatusPill status={statusText} />
                                          <button 
                                            className="academic-btn btn-academic-primary pill"
                                            style={{ padding: '6px 14px', fontSize: '12px' }}
                                            disabled={startingExpId === exp.experiment_id}
                                            onClick={() => {
                                              if (exp.session_id) {
                                                navigate(`/experiment/${exp.experiment_id}?sessionId=${exp.session_id}`);
                                              } else {
                                                handleStartExperiment(exp.experiment_id);
                                              }
                                            }}
                                          >
                                            {startingExpId === exp.experiment_id ? 'Launching...' : (statusText === 'Completed' ? 'Review' : (statusText === 'In Progress' ? 'Resume' : 'Start'))}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                                    No active worksheets published for this laboratory unit yet.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      No laboratory units assigned to your branch yet.
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          </>
        )}

        {/* TAB 4: FILES / CERTIFICATES */}
        {activeRailTab === 'files' && (
          <>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, textAlign: 'left' }}>Digital Laboratory Sheets</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
              Downloadable verification sheets, worksheets snapshots, and reports
            </p>

            <div className="bento-grid-container" style={{ textAlign: 'left' }}>
              <div className="bento-card-full">
                <GlassCard>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Your Worksheet Submissions</h3>
                  {completedExperiments.length > 0 ? (
                    <div className="bento-list-stack">
                      {completedExperiments.map(item => {
                        const verNum = item.session_version_number || item.latest_version_number || 1;
                        return (
                          <div key={item.session_id ? `history-${item.session_id}` : `history-exp-${item.experiment_id}-${verNum}`} className="bento-list-row">
                            <div>
                              <strong>{item.experiment_name} <span style={{ fontSize: '11px', color: 'var(--accent-green)', opacity: 0.8 }}>(V{verNum})</span></strong>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Signoff Date: {new Date(item.session_completed_at).toLocaleDateString()}
                              </div>
                            </div>
                          <button 
                            className="academic-btn btn-academic-secondary"
                            onClick={() => handleDownloadWorksheet(item)}
                          >
                            Download Sheet
                          </button>
                        </div>
                      ); })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      <Clipboard size={36} style={{ marginBottom: '10px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No completed worksheets found</div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>Complete and verify your worksheets to download digital sheets.</div>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          </>
        )}

        {/* TAB 5: PROFILE & SETTINGS */}
        {activeRailTab === 'settings' && (
          <>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, textAlign: 'left' }}>Operator Profile & Settings</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
              Manage password updates and inspect academic records
            </p>

            <div className="bento-grid-container" style={{ textAlign: 'left' }}>
              <div className="bento-card-2col">
                <GlassCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                    <User size={20} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Academic Details</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13.5px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Full Name</span>
                      <div style={{ fontWeight: 700, marginTop: '2px' }}>{profile?.full_name || 'N/A'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Roll Number</span>
                      <div style={{ fontWeight: 700, marginTop: '2px', fontFamily: font.mono }}>{profile?.roll_number || user?.username}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Branch</span>
                      <div style={{ fontWeight: 700, marginTop: '2px' }}>{profile?.branch_name || 'N/A'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Institution</span>
                      <div style={{ fontWeight: 700, marginTop: '2px' }}>{profile?.institution_name || 'N/A'}</div>
                    </div>
                  </div>
                </GlassCard>
              </div>

              <div className="bento-card-1col">
                <GlassCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                    <Key size={20} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Change Password</h3>
                  </div>

                  {pwError && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--danger-red)', fontSize: '12px', marginBottom: '14px' }}>
                      {pwError}
                    </div>
                  )}

                  {pwSuccess && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: 'var(--success-emerald)', fontSize: '12px', marginBottom: '14px' }}>
                      {pwSuccess}
                    </div>
                  )}

                  <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showCurrentPw ? 'text' : 'password'}
                        className="erp-input"
                        style={{ paddingRight: '36px' }}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Verify current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      >
                        {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showNewPw ? 'text' : 'password'}
                        className="erp-input"
                        style={{ paddingRight: '36px' }}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Specify new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showConfirmPw ? 'text' : 'password'}
                        className="erp-input"
                        style={{ paddingRight: '36px' }}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      >
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="submit" className="academic-btn btn-academic-primary pill" disabled={pwLoading}>
                      {pwLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </GlassCard>
              </div>
            </div>
          </>
        )}
          </>
        )}
      </main>

      {/* Force Password Overlay Panel */}
      {showForceOverlay && (
        <div className="force-password-overlay">
          <GlassCard style={{ width: '480px', padding: '30px', textAlign: 'left', zIndex: 2100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-warning)', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <Lock size={24} />
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Account Security Update</h3>
            </div>
            
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Your account has been registered with a default/temporary passcode. You must set a personalized, secure password before accessing your laboratory worksheets workspace.
            </p>

            {pwError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--accent-red)', fontSize: '12.5px', marginBottom: '16px' }}>
                {pwError}
              </div>
            )}

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Verify Current Temporary Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showCurrentPw ? 'text' : 'password'} 
                    className="erp-input" 
                    style={{ paddingRight: '36px' }}
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Specify New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showNewPw ? 'text' : 'password'} 
                    className="erp-input" 
                    style={{ paddingRight: '36px' }}
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showConfirmPw ? 'text' : 'password'} 
                    className="erp-input" 
                    style={{ paddingRight: '36px' }}
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm matches above"
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <button 
                type="submit" 
                className="academic-btn btn-academic-primary pill" 
                style={{ width: '100%', marginTop: '10px' }} 
                disabled={pwLoading}
              >
                {pwLoading ? 'Updating credentials...' : 'Establish Secure Account Access'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
