import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setSession } from '../utils/api';
import { ShieldAlert, ArrowLeft, Loader2, Lock, User, Eye, EyeOff } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';

const rawBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL;
if (!rawBase) {
  throw new Error("FATAL: Environment variable VITE_API_BASE or VITE_API_URL is required but missing at build time. Ensure VITE_API_BASE is defined in your environment or .env file before building.");
}
const apiBase = rawBase.replace(/\/api\/?$/, '').replace(/\/$/, '');

const font = { mono: "'Space Mono', monospace", sans: "'Outfit', sans-serif" };

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(
    searchParams.get('reason') === 'device'
      ? "You've been logged out because your account was accessed on another device."
      : ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      if (data.user.role !== 'admin') {
        throw new Error('Access denied: Unauthorized role.');
      }

      setSession(data.accessToken, data.refreshToken, data.user);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <style>{`
        .login-page-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          padding: 24px;
          position: relative;
          overflow: hidden;
          width: 100%;
          transition: background 0.3s ease;
        }

        .login-glow-aura {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(245, 158, 11, 0.06) 0%, transparent 70%);
          filter: blur(50px);
          pointer-events: none;
          z-index: 0;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .login-card {
          width: 100%;
          max-width: 480px;
          padding: 40px;
          background: var(--glass-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border);
          box-shadow: var(--glass-shadow);
          border-radius: 24px;
          z-index: 1;
          position: relative;
        }

        .top-nav-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 480px;
          margin-bottom: 24px;
          z-index: 2;
        }

        .ghost-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 8px 16px;
          color: var(--text-secondary);
          font-size: 13px;
          font-family: inherit;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ghost-back-btn:hover {
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
        }

        .logo-glow-container {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.05) 100%);
          border: 1px solid rgba(245, 158, 11, 0.25);
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }

        .login-title {
          font-weight: 800;
          font-size: 32px;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          margin-bottom: 8px;
          line-height: 1.1;
        }

        .login-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          opacity: 0.8;
          margin-bottom: 28px;
        }

        .premium-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          margin-bottom: 20px;
        }

        .premium-input {
          width: 100%;
          height: 50px;
          padding-left: 48px;
          padding-right: 16px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 14.5px;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-input.password-input {
          padding-right: 48px;
        }

        .premium-input::placeholder {
          color: var(--text-muted);
        }

        .premium-input:focus {
          border-color: var(--accent-warning);
          box-shadow: 0 0 0 1px var(--accent-warning), 0 0 16px rgba(245, 158, 11, 0.18);
          background: rgba(0, 0, 0, 0.25);
        }

        .premium-input-icon {
          position: absolute;
          left: 16px;
          color: var(--text-muted);
          transition: color 0.2s ease;
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .premium-input-wrapper:focus-within .premium-input-icon {
          color: var(--accent-warning);
        }

        .password-toggle-btn {
          position: absolute;
          right: 16px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
        }

        .password-toggle-btn:hover {
          color: var(--text-primary);
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 30px 24px;
          }
          .logo-glow-container {
            width: 70px;
            height: 70px;
            margin-bottom: 20px;
          }
          .login-title {
            font-size: 28px;
          }
        }
      `}</style>

      {/* Glow Aura */}
      <div className="login-glow-aura" />

      {/* Top Navigation Row */}
      <div className="top-nav-row">
        <button className="ghost-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Exit to Main
        </button>
        <ThemeToggle size="sm" />
      </div>

      {/* Card Content */}
      <div className="login-card">
        <div className="logo-glow-container">
          <LabScanLogo size={36} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 className="login-title">Faculty Portal</h2>
          <p className="login-subtitle">Access course publishments and audit controls.</p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(248, 113, 113, 0.08)', 
            border: '1px solid rgba(248, 113, 113, 0.2)', 
            color: 'var(--accent-red)',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="premium-input-wrapper">
            <div className="premium-input-icon">
              <User size={18} />
            </div>
            <input 
              type="text" 
              className="premium-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required 
            />
          </div>

          <div className="premium-input-wrapper">
            <div className="premium-input-icon">
              <Lock size={18} />
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              className="premium-input password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passcode"
              required 
            />
            <button 
              type="button" 
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button 
            type="submit" 
            className="academic-btn btn-academic-primary" 
            style={{ 
              width: '100%', 
              height: '50px',
              borderRadius: '12px',
              background: 'var(--accent-warning)', 
              color: '#050a14', 
              border: 'none',
              boxShadow: '0 4px 14px rgba(251, 191, 36, 0.25)',
              fontWeight: 700,
              fontSize: '14.5px',
              marginTop: '8px'
            }}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Log In to Console'}
          </button>
        </form>


      </div>
    </div>
  );
}
