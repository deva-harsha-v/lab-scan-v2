import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getUser } from '../utils/api';
import ArucoScanner from '../components/ArucoScanner';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';
import { Camera, Sparkles, BookOpen, GraduationCap, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';

export default function ScanSimulator() {
  const navigate = useNavigate();
  const user = getUser();

  const [status, setStatus] = useState('idle'); // idle | detecting | found | error
  const [experiment, setExperiment] = useState(null);
  const [error, setError] = useState('');
  const [experiments, setExperiments] = useState([]);
  const [manualMarkerId, setManualMarkerId] = useState('');
  const [loadingManual, setLoadingManual] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);

  const scanningRef = useRef(false);

  // Load experiments for reference list
  useEffect(() => {
    apiFetch('/experiments')
      .then(data => {
        setExperiments(data);
      })
      .catch(err => {
        console.error('Failed to fetch experiments list:', err);
      });
  }, []);

  // Handle marker detection (from ArucoScanner or manual lookup)
  const handleDetected = useCallback(async (markerIdVal) => {
    const markerId = parseInt(markerIdVal, 10);
    if (isNaN(markerId)) {
      setError('Invalid ArUco ID detected.');
      setStatus('error');
      return;
    }

    if (scanningRef.current) return;
    scanningRef.current = true;
    setStatus('detecting');
    setError('');

    try {
      const data = await apiFetch(`/experiments/by-marker/${markerId}`);
      setExperiment(data);
      setStatus('found');
    } catch (err) {
      setError(err.message || `No experiment found for ArUco ID: ${markerId}`);
      setStatus('error');
      scanningRef.current = false;
    }
  }, []);

  // Reset scanner state to allow scanning again
  const handleReset = () => {
    scanningRef.current = false;
    setStatus('idle');
    setExperiment(null);
    setError('');
  };

  // Handle manual input lookup
  const handleManualScan = async (e) => {
    e.preventDefault();
    if (!manualMarkerId.trim()) return;
    setLoadingManual(true);
    await handleDetected(manualMarkerId.trim());
    setLoadingManual(false);
  };

  // Routing actions
  const handlePortalOpen = () => {
    if (experiment) {
      if (user) {
        navigate(`/experiment/${experiment.experiment_id}?scanned=true`);
      } else {
        navigate(`/login?expId=${experiment.experiment_id}&scanned=true`);
      }
    }
  };

  const handleGhostOpen = () => {
    if (experiment) {
      navigate(`/experiment/${experiment.experiment_id}?mode=ghost&scanned=true`);
    }
  };

  return (
    <div className="container fade-in" style={{ paddingTop: '30px', paddingBottom: '60px' }}>
      
      {/* Centered Single-Column Main Wrapper */}
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        
        {/* Responsive Title Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LabScanLogo size={28} />
              <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: '800' }}>Scan Marker</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ThemeToggle size="sm" />
              <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => navigate('/')}>
                Exit
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Point your camera at the ArUco marker on your experiment card to open the matching module.
          </p>
        </div>

        {/* Live Camera Scanner Feed or Found Results */}
        <div>
          {status !== 'found' ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px', color: 'var(--accent-blue)' }}>
                <Camera size={20} />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>ArUco Camera Scanner</h3>
              </div>

              {/* Modular ArUco Scanner */}
              <ArucoScanner onDetected={handleDetected} autoStart={true} />

              {/* Status overlay message */}
              {status === 'detecting' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px', color: 'var(--accent-blue)' }}>
                  <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(56, 189, 248, 0.2)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Looking up experiment…</span>
                </div>
              )}

              {/* Error overlay message */}
              {status === 'error' && (
                <div style={{ 
                  background: 'rgba(248, 113, 113, 0.08)', 
                  border: '1px solid rgba(248, 113, 113, 0.2)', 
                  color: 'var(--accent-red)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textAlign: 'left'
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Match found layout card */
            <div className="glass-panel fade-in" style={{ padding: '24px', border: '1px solid var(--accent-green)' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  background: 'rgba(52, 211, 153, 0.1)', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sparkles size={20} style={{ color: 'var(--accent-green)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 600, textTransform: 'uppercase', tracking: '0.05em' }}>
                    Experiment Found
                  </span>
                  <h2 style={{ fontSize: '1.35rem', margin: '4px 0 6px', color: '#fff', lineHeight: '1.3' }}>
                    {experiment.experiment_name}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.4 }}>
                    {experiment.description || 'No description provided.'}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ArUco ID: <code style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{experiment.ar_qr_marker_id}</code> (MIP_36h12)
                  </div>
                </div>
              </div>

              {/* Portal / Ghost Options */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                  onClick={handlePortalOpen}
                >
                  <GraduationCap size={18} />
                  Open in Portal
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: '1 1 calc(75% - 5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={handleGhostOpen}
                  title="Browse freely without saving progress"
                >
                  <BookOpen size={18} style={{ color: 'var(--accent-blue)' }} />
                  Ghost Mode
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: '0 0 44px', width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={handleReset}
                  title="Scan another card"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsed Secondary Section: Dev Testing / Manual Input Fallback */}
        <div className="glass-panel" style={{ marginTop: '24px', padding: '16px' }}>
          <button
            type="button"
            onClick={() => setShowManualFallback(!showManualFallback)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              outline: 'none',
              padding: 0
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={18} /> Don't have a camera? Enter ID
            </span>
            <span style={{ transition: 'transform var(--transition-fast)', transform: showManualFallback ? 'rotate(180deg)' : 'rotate(0)' }}>
              ▼
            </span>
          </button>
          
          {showManualFallback && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'left' }}>
              {/* Manual Input Form */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Manual Numeric Entry</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Type the numeric ArUco ID below to simulate a scan.
                </p>
                <form onSubmit={handleManualScan} style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" 
                    min="0"
                    max="99"
                    className="form-input"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
                    value={manualMarkerId}
                    onChange={(e) => setManualMarkerId(e.target.value)}
                    placeholder="ArUco ID (e.g. 1, 2, 3)"
                    disabled={status === 'detecting' || loadingManual}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} disabled={status === 'detecting' || loadingManual}>
                    Verify ID
                  </button>
                </form>
              </div>

              {/* Active Marker Reference */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Active Experiment Markers</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Active codes in database:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {experiments.map(exp => (
                    <div key={exp.experiment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                        {exp.experiment_name}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID:</span>
                        <code style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{exp.ar_qr_marker_id}</code>
                      </div>
                    </div>
                  ))}
                  {experiments.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No experiments found.</span>}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
