import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setSession, apiFetch } from '../utils/api';
import { motion } from 'framer-motion';
import { User, Lock, ArrowLeft, Loader2, Eye, EyeOff, Info, Check, ChevronRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';

const rawBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL;
if (!rawBase) {
  throw new Error("FATAL: Environment variable VITE_API_BASE or VITE_API_URL is required but missing at build time. Ensure VITE_API_BASE is defined in your environment or .env file before building.");
}
const apiBase = rawBase.replace(/\/api\/?$/, '').replace(/\/$/, '');

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(
    searchParams.get('reason') === 'device'
      ? "You've been logged out because your account was accessed on another device."
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const expId = searchParams.get('expId');

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

      if (data.user.role !== 'student') {
        throw new Error('This portal is for students only. Please use the Faculty portal.');
      }

      setSession(data.accessToken, data.refreshToken, data.user);
      setSuccess(true);

      // Add a slight delay for a premium success transition
      const isScanned = searchParams.get('scanned') === 'true';
      setTimeout(async () => {
        if (expId) {
          try {
            await apiFetch('/sessions/start', {
              method: 'POST',
              body: JSON.stringify({ experiment_id: expId })
            });
          } catch (e) {
            console.error('Session start failed:', e);
          }
          navigate(`/experiment/${expId}${isScanned ? '?scanned=true' : ''}`);
        } else {
          navigate('/student/dashboard');
        }
      }, 1000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Framer Motion Variants
  const pageVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  const cardVariants = {
    hidden: { scale: 0.96, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        duration: 0.4, 
        ease: 'easeOut',
        staggerChildren: 0.08,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
  };

  return (
    <>
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
          background: radial-gradient(circle, var(--accent-blue-glow) 0%, transparent 70%);
          filter: blur(50px);
          pointer-events: none;
          z-index: 0;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .login-card {
          width: 100%;
          max-width: 540px;
          padding: 48px 40px;
          background: var(--glass-bg) !important;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border) !important;
          box-shadow: var(--glass-shadow) !important;
          border-radius: 24px !important;
          z-index: 1;
          position: relative;
        }

        .top-nav-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 540px;
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
          font-family: var(--font-family);
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
          background: radial-gradient(circle, var(--accent-blue-glow) 0%, transparent 100%);
          border: 1px solid var(--accent-blue);
          box-shadow: 0 0 20px var(--accent-blue-glow);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }

        .login-title {
          font-family: var(--font-family);
          font-weight: 800;
          font-size: clamp(32px, 5vw, 44px);
          letter-spacing: -0.03em;
          color: var(--text-primary);
          margin-bottom: 8px;
          line-height: 1.1;
        }

        .login-subtitle {
          font-size: 15px;
          color: var(--text-secondary);
          opacity: 0.8;
          margin-bottom: 0;
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
          height: 52px;
          padding-left: 48px;
          padding-right: 16px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 15px;
          font-family: var(--font-family);
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-input.password-input {
          padding-right: 48px;
        }

        .premium-input::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .premium-input:focus {
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 1px var(--accent-blue), 0 0 16px var(--accent-blue-glow);
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
          color: var(--accent-blue);
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
          transition: color 0.2s ease;
          padding: 4px;
        }

        .password-toggle-btn:hover {
          color: var(--text-primary);
        }

        .primary-gradient-btn {
          width: 100%;
          height: 52px;
          background: linear-gradient(135deg, #42B8FF 0%, #2E9DFF 100%);
          border: none;
          border-radius: 12px;
          color: #ffffff;
          font-weight: 700;
          font-size: 16px;
          font-family: var(--font-family);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(46, 157, 255, 0.3);
          transition: all 0.2s ease;
        }

        .primary-gradient-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .info-card {
          background: rgba(10, 15, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          margin-top: 24px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          text-align: left;
        }

        .info-card-icon {
          color: #38bdf8;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .info-card-content {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .info-card-content code {
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
          color: #ffffff;
          font-family: monospace;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
          .login-card {
            padding: 32px 24px;
            border-radius: 20px !important;
          }
          .login-page-container {
            padding: 16px;
          }
          .top-nav-row {
            margin-bottom: 16px;
          }
        }
      `}</style>

      <motion.div 
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="login-page-container"
      >
        {/* Background Aura Glow */}
        <div className="login-glow-aura" />

        {/* Navigation Row */}
        <div className="top-nav-row">
          <motion.button 
            className="ghost-back-btn"
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.02, color: 'var(--text-primary)', borderColor: 'rgba(255, 255, 255, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft size={16} /> Home
          </motion.button>
          <ThemeToggle size="sm" />
        </div>

        {/* Card Component */}
        <motion.div
          variants={cardVariants}
          className="glass-panel login-card"
        >
          {/* Header */}
          <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div className="logo-glow-container">
              <LabScanLogo size={42} gradientId="loginLogoGrad" />
            </div>
            <h2 className="login-title">Student Login</h2>
            <p className="login-subtitle">Access your experiment workspace securely.</p>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div 
              variants={itemVariants}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ 
                background: 'rgba(248, 113, 113, 0.08)', 
                border: '1px solid rgba(248, 113, 113, 0.2)', 
                color: 'var(--accent-red)',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                marginBottom: '20px',
                textAlign: 'left'
              }}
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {/* Username Input */}
            <motion.div variants={itemVariants} className="premium-input-wrapper">
              <input 
                type="text" 
                className="premium-input" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required 
                aria-label="Username"
              />
              <div className="premium-input-icon">
                <User size={18} />
              </div>
            </motion.div>

            {/* Password Input */}
            <motion.div variants={itemVariants} className="premium-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="premium-input password-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required 
                aria-label="Password"
              />
              <div className="premium-input-icon">
                <Lock size={18} />
              </div>
              <button 
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={itemVariants} style={{ marginTop: '28px' }}>
              <motion.button
                type="submit"
                className="primary-gradient-btn"
                disabled={loading || success}
                style={success ? { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' } : {}}
                whileHover={!loading && !success ? { y: -2, boxShadow: '0 8px 24px rgba(46, 157, 255, 0.45)' } : {}}
                whileTap={!loading && !success ? { scale: 0.98 } : {}}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing In...
                  </>
                ) : success ? (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Check size={18} />
                    Access Granted
                  </motion.div>
                ) : (
                  <>
                    Launch Workspace
                    <ChevronRight size={18} />
                  </>
                )}
              </motion.button>
            </motion.div>
          </form>
        </motion.div>
      </motion.div>
    </>
  );
}
