import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, getUser } from '../utils/api';
import { useEnforcedTimer } from '../hooks/useEnforcedTimer';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';
import ArucoScanner from '../components/ArucoScanner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, BookOpen, AlertTriangle, 
  CheckCircle2, ChevronRight, Clock, Hash, FileText, 
  ChevronDown, ChevronUp, Edit3, Play, Pause, ShieldCheck, Camera, Lock
} from 'lucide-react';
import Skeleton from '../components/Skeleton';

const font = { mono: "'Space Mono', monospace", sans: "'Outfit', sans-serif" };

export default function ExperimentWorkspace() {
  const { experimentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isGhostMode = searchParams.get('mode') === 'ghost';
  const currentUser = getUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [experiment, setExperiment] = useState(null);
  const [theoryBlocks, setTheoryBlocks] = useState([]);
  const [videoLinks, setVideoLinks] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  
  // Session tracking
  const [session, setSession] = useState(null);
  const [activeStage, setActiveStage] = useState('learning'); // learning, visual, checklist, complete
  const [institution, setInstitution] = useState(null);
  
  // ArUco Bench Proof-of-Presence Gatekeeper
  const [isArUcoScanned, setIsArUcoScanned] = useState(searchParams.get('scanned') === 'true');
  const [showScanGatekeeper, setShowScanGatekeeper] = useState(false);
  const [scanGatekeeperError, setScanGatekeeperError] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [hasScannerBeenDismissed, setHasScannerBeenDismissed] = useState(false);

  // Video Player states
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoTimeOffset, setVideoTimeOffset] = useState(0);
  const [videoNotes, setVideoNotes] = useState('');

  // Progressive Disclosure in Learning Stage
  const [expandedSections, setExpandedSections] = useState({
    objectives: true,
    theory: true,
    formula: true,
    precautions: true,
    procedure: true
  });

  const videoRef = React.useRef(null);

  // Initialize Enforced Timer Hook
  const {
    watchedSeconds,
    isTabActive,
    isPlaying,
    isCompleted: isCurrentVideoCompleted,
    setManualPlaying,
    remainingSeconds
  } = useEnforcedTimer({
    sessionId: session?.session_id,
    videoId: activeVideo?.id,
    initialProgress: session?.current_video_progress?.[activeVideo?.id] || 0,
    minDuration: activeVideo?.min_duration || 60,
    videoRef: videoRef
  });

  // Load experiment and session
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        setLoading(true);
        setError('');

        try {
          const instData = await apiFetch('/institutions');
          setInstitution(instData);
        } catch (e) {
          console.warn('Failed loading institution settings in workspace:', e);
        }

        if (isGhostMode) {
          // Ghost Mode: Fetch latest version directly
          const data = await apiFetch(`/experiments/${experimentId}`);
          setExperiment(data.experiment);
          setTheoryBlocks(data.content.theory_procedure_json || []);
          setVideoLinks(data.content.video_links || []);
          setChecklistItems(data.content.checklist_items || []);
          setActiveStage('learning');
          
          if (data.content.video_links?.length > 0) {
            setActiveVideo(data.content.video_links[0]);
          }
          setLoading(false);
        } else {
          // Student Mode: Retrieve or start session
          if (!currentUser || currentUser.role !== 'student') {
            navigate(`/login?expId=${experimentId}`);
            return;
          }

          let activeSession;
          try {
            const sessId = searchParams.get('sessionId');
            const url = sessId 
              ? `/sessions/active/${experimentId}?sessionId=${sessId}&_t=${Date.now()}` 
              : `/sessions/active/${experimentId}?_t=${Date.now()}`;
            const data = await apiFetch(url);
            activeSession = data.session;
            setChecklistItems(data.checklist || []);
          } catch (e) {
            // If no active session, start one
            const data = await apiFetch('/sessions/start', {
              method: 'POST',
              body: JSON.stringify({ experiment_id: experimentId })
            });
            activeSession = data.session;
            
            // Reload checklist items from the session version
            const detail = await apiFetch(`/experiments/${experimentId}?versionId=${activeSession.content_version_id}`);
            setChecklistItems(detail.content.checklist_items || []);
          }

          setSession(activeSession);
          const detail = await apiFetch(`/experiments/${experimentId}?versionId=${activeSession.content_version_id}`);
          setExperiment(detail.experiment);

          // Sync ArUco verification from URL parameter with backend if not already saved in session
          if (searchParams.get('scanned') === 'true' && !activeSession.aruco_verified_at && detail.experiment) {
            try {
              await apiFetch('/sessions/verify-aruco', {
                method: 'POST',
                body: JSON.stringify({
                  experiment_id: experimentId,
                  scanned_marker_id: detail.experiment.ar_qr_marker_id
                })
              });
              activeSession.aruco_verified_at = new Date().toISOString();
              setSession({ ...activeSession });
            } catch (err) {
              console.warn('Failed to auto-verify scanned marker with backend:', err);
            }
          }

          setTheoryBlocks(detail.content.theory_procedure_json || []);
          setVideoLinks(detail.content.video_links || []);

          if (detail.content.video_links?.length > 0) {
            setActiveVideo(detail.content.video_links[0]);
          }

          // Determine current stage based on completions
          if (activeSession.session_completed_at || activeSession.checklist_completed_at) {
            setIsArUcoScanned(true);
            setActiveStage('complete');
          } else if (activeSession.visual_stage_completed_at) {
            setIsArUcoScanned(true);
            setActiveStage('checklist');
          } else if (activeSession.learning_stage_completed_at) {
            setIsArUcoScanned(true);
            setActiveStage('visual');
          } else {
            setActiveStage('learning');
          }

          setLoading(false);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    initWorkspace();
  }, [experimentId, isGhostMode, navigate]);

  // Auto-launch scanner modal when entering a stage that requires marker verification (Learning Stage, if not scanned yet)
  useEffect(() => {
    if (activeStage === 'learning' && !isArUcoScanned && !isGhostMode && !loading && session && !hasScannerBeenDismissed) {
      setShowScanGatekeeper(true);
    }
  }, [activeStage, isArUcoScanned, isGhostMode, loading, session, hasScannerBeenDismissed]);

  // Handle video selection change
  const handleSelectVideo = (vid) => {
    setManualPlaying(false);
    setVideoTimeOffset(0);
    setActiveVideo(vid);
  };

  const getGoogleDriveFileId = (url) => {
    if (!url) return null;
    const rawUrl = url.trim();
    const fileIdMatch = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) return fileIdMatch[1];
    const idMatch = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];
    return null;
  };

  // Safe Video Embed Parser (Prevents YouTube 'Video Unavailable' error)
  const parseEmbedVideoUrl = (vid) => {
    if (!vid || !vid.url) return 'https://www.youtube.com/embed/48S8N0fsm8w';
    const rawUrl = vid.url.trim();

    try {
      const parsedUrl = new URL(rawUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const isAllowed = 
        host === 'youtube.com' || 
        host === 'www.youtube.com' || 
        host === 'youtu.be' || 
        host === 'drive.google.com' ||
        host === 'docs.google.com';

      if (!isAllowed) {
        console.warn('Blocked iframe load to non-allowed domain:', host);
        return 'about:blank';
      }
    } catch (e) {
      console.error('Invalid URL passed to iframe:', rawUrl);
      return 'about:blank';
    }

    // Google Drive URL parsing
    if (rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com')) {
      const fileIdMatch = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
      }
      const idMatch = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
      }
      return rawUrl;
    }

    if (rawUrl.includes('embed/')) {
      const parts = rawUrl.split('embed/')[1]?.split('?');
      if (parts && parts[0] && parts[0].length >= 8) {
        return `https://www.youtube.com/embed/${parts[0]}`;
      }
    }

    const match = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }

    // High quality educational physics/chemistry lab demonstration fallback
    return 'https://www.youtube.com/embed/48S8N0fsm8w';
  };

  // Handle stage navigation click with ArUco and completion lock checks
  const handleStageClick = (targetStage) => {
    if (session?.session_completed_at || session?.checklist_completed_at) {
      setActiveStage(targetStage);
      return;
    }
    if (targetStage === 'visual' && !isArUcoScanned && !isGhostMode) {
      setShowScanGatekeeper(true);
      return;
    }
    if (targetStage === 'checklist' && !session?.visual_stage_completed_at && !isGhostMode) {
      alert('Please complete Stage 2 (Visual Bench Stage) first.');
      return;
    }
    setActiveStage(targetStage);
  };

  // Mark Learning Stage Completed (Student only)
  const completeLearningStage = async (skipArucoCheck = false) => {
    if (session?.session_completed_at || session?.checklist_completed_at) {
      alert('This session is completed and read-only.');
      return;
    }
    if (!skipArucoCheck && !isArUcoScanned && !isGhostMode) {
      setShowScanGatekeeper(true);
      return;
    }
    if (isGhostMode) {
      setActiveStage('visual');
      return;
    }
    try {
      await apiFetch('/sessions/progress', {
        method: 'PUT',
        body: JSON.stringify({ session_id: session.session_id, stage: 'learning' })
      });
      const data = await apiFetch(`/sessions/active/${experimentId}`);
      setSession(data.session);
      setActiveStage('visual');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCameraDetectedMarker = async (detectedId) => {
    const expectedId = String(experiment?.ar_qr_marker_id || '01');
    const scannedIdStr = String(detectedId);

    if (scannedIdStr === expectedId) {
      setScanGatekeeperError('');

      if (!isGhostMode && session?.session_id) {
        try {
          await apiFetch('/sessions/verify-aruco', {
            method: 'POST',
            body: JSON.stringify({
              experiment_id: experimentId,
              scanned_marker_id: parseInt(detectedId, 10)
            })
          });
        } catch (err) {
          setScanGatekeeperError(`Server verification failed: ${err.message}`);
          return;
        }
      }

      setIsArUcoScanned(true);
      setScanSuccess(true);
      setTimeout(() => {
        setScanSuccess(false);
        setShowScanGatekeeper(false);
      }, 1200);
    } else {
      setScanGatekeeperError(`Wrong Marker Scanned! You scanned ArUco Marker #${scannedIdStr}, but your lab bench requires ArUco Marker #${expectedId}.`);
    }
  };

  const handleArUcoGatekeeperScan = (markerId) => {
    handleCameraDetectedMarker(markerId || experiment?.ar_qr_marker_id || '01');
  };

  // Complete Visual Stage (Checks if all video timers are done)
  const completeVisualStage = async () => {
    if (session?.session_completed_at || session?.checklist_completed_at) {
      alert('This session is completed and read-only.');
      return;
    }
    if (isGhostMode) {
      alert('Ghost Mode does not enforce checklist. Feel free to explore.');
      return;
    }

    // Check if all videos are completed
    const progress = session.current_video_progress || {};
    const allDone = videoLinks.every(vid => (progress[vid.id] || 0) >= vid.min_duration);

    // If current video is finished in UI but not synced yet, check that too
    const currentProgressVal = activeVideo?.id === activeVideo?.id ? watchedSeconds : (progress[activeVideo?.id] || 0);
    const currentVideoDone = currentProgressVal >= (activeVideo?.min_duration || 0);

    if (!allDone && !currentVideoDone) {
      alert('Please finish watching all video resources according to the timers before proceeding.');
      return;
    }

    try {
      await apiFetch('/sessions/progress', {
        method: 'PUT',
        body: JSON.stringify({ session_id: session.session_id, stage: 'visual' })
      });
      
      // Update local checklist items state to ensure we render them
      const data = await apiFetch(`/sessions/active/${experimentId}`);
      setChecklistItems(data.checklist || []);

      setActiveStage('checklist');
    } catch (err) {
      alert(err.message);
    }
  };

  // Toggle Checklist Checkboxes (Student only)
  const handleChecklistToggle = async (item) => {
    if (isGhostMode || session?.session_completed_at || session?.checklist_completed_at) return;
    const newCompleted = !item.is_completed;
    
    // 1. Update state optimistically for instant UI feedback (reduces INP to near 0ms!)
    setChecklistItems(prev => prev.map(ci => 
      ci.checklist_item_id === item.checklist_item_id 
        ? { ...ci, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
        : ci
    ));
    
    try {
      // 2. Perform network update in background
      await apiFetch('/sessions/checklist', {
        method: 'PUT',
        body: JSON.stringify({
          session_id: session.session_id,
          checklist_item_id: item.checklist_item_id,
          is_completed: newCompleted
        })
      });
    } catch (err) {
      // 3. Revert state on error
      setChecklistItems(prev => prev.map(ci => 
        ci.checklist_item_id === item.checklist_item_id 
          ? { ...ci, is_completed: item.is_completed, completed_at: item.completed_at }
          : ci
      ));
      alert(err.message);
    }
  };

  // Complete Checklist Stage & Complete Session
  const completeChecklistStage = async () => {
    if (session?.session_completed_at || session?.checklist_completed_at) {
      alert('This session is completed and read-only.');
      return;
    }
    const allChecked = checklistItems.every(ci => ci.is_completed);
    if (!allChecked) {
      alert('Please complete all verification checklist items before finishing.');
      return;
    }

    try {
      await apiFetch('/sessions/progress', {
        method: 'PUT',
        body: JSON.stringify({ session_id: session.session_id, stage: 'checklist' })
      });
      await apiFetch('/sessions/progress', {
        method: 'PUT',
        body: JSON.stringify({ session_id: session.session_id, stage: 'complete' })
      });
      
      const res = await apiFetch(`/sessions/active/${experimentId}`);
      if (res && res.session) {
        setSession(res.session);
      }
      setActiveStage('complete');
    } catch (err) {
      alert(err.message);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check completeness ratios
  const getCompletedChecklistCount = () => checklistItems.filter(c => c.is_completed).length;
  const getChecklistPercentage = () => checklistItems.length ? Math.round((getCompletedChecklistCount() / checklistItems.length) * 100) : 0;
  
  const getVideoCompletionPercentage = () => {
    if (!videoLinks.length) return 0;
    const progress = session?.current_video_progress || {};
    const completedCount = videoLinks.filter(vid => (progress[vid.id] || 0) >= vid.min_duration).length;
    return Math.round((completedCount / videoLinks.length) * 100);
  };

  if (error) return <div style={{ color: 'var(--accent-red)', textAlign: 'center', margin: '100px' }}><h3>Error: {error}</h3></div>;

  return (
    <div className="academic-app">
      <style>{`
        /* Academic Color & Elevation System */
        :root {
          --primary-blue: #1e3a8a;
          --primary-blue-hover: #1e40af;
          --accent-cyan: #06b6d4;
          --success-emerald: #10b981;
          --warning-amber: #f59e0b;
          --danger-red: #ef4444;
          --neutral-slate: #64748b;
          
          --surface-l0: var(--bg-primary, #050a14);
          --surface-l1: var(--bg-secondary, #0a0f1d);
          --surface-l2: var(--bg-tertiary, #12182c);
          --surface-l3: #374151;
          
          --border-color: var(--border-color, rgba(255, 255, 255, 0.05));
          --border-focus: #3b82f6;
          --text-primary: var(--text-primary, #f8fafc);
          --text-secondary: var(--text-secondary, #94a3b8);
          --text-muted: var(--text-muted, #74879f);
        }

        :root[data-theme="light"] {
          --primary-blue: #2563eb;
          --primary-blue-hover: #1d4ed8;
          --accent-cyan: #0891b2;
          --success-emerald: #059669;
          --warning-amber: #d97706;
          --danger-red: #dc2626;
          --neutral-slate: #64748b;
          --surface-l0: var(--bg-primary, #f3f4f6);
          --surface-l1: var(--bg-secondary, #ffffff);
          --surface-l2: var(--bg-tertiary, #e5e7eb);
          --surface-l3: #cbd5e1;
          --border-color: var(--border-color, rgba(15, 23, 42, 0.08));
          --border-focus: #2563eb;
          --text-primary: var(--text-primary, #0f172a);
          --text-secondary: var(--text-secondary, #334155);
          --text-muted: var(--text-muted, #64748b);
        }

        .exit-ghost-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background-color: transparent;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .exit-ghost-btn:hover {
          background-color: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.15);
        }
        :root[data-theme="light"] .exit-ghost-btn:hover {
          background-color: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.15);
        }

        .academic-app {
          min-height: 100vh;
          background-color: var(--surface-l0);
          color: var(--text-primary);
          font-family: var(--font-family);
          display: flex;
          flex-direction: column;
        }

        .workspace-header {
          background-color: var(--surface-l1);
          border-bottom: 1px solid var(--border-color);
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 50;
        }

        .workspace-layout {
          display: grid;
          grid-template-columns: 280px 1fr 340px;
          min-height: calc(100vh - 64px);
          background-color: var(--surface-l0);
        }

        /* Left Outline Panel */
        .sidebar-panel {
          background-color: var(--surface-l1);
          border-right: 1px solid var(--border-color);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          text-align: left;
        }

        .sidebar-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--neutral-slate);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          font-family: ${font.mono};
        }

        .sidebar-nav-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          background-color: transparent;
          border: 1px solid transparent;
          text-align: left;
        }
        .sidebar-nav-item:hover:not(.locked) {
          background-color: var(--surface-l2);
          border-color: var(--border-color);
          opacity: 0.9;
        }
        .sidebar-nav-item.active {
          background-color: var(--surface-l2);
          border-color: var(--primary-blue);
        }
        .sidebar-nav-item.locked {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .nav-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .sidebar-nav-item.active .nav-item-header {
          color: var(--primary-blue);
        }

        .nav-item-meta {
          font-size: 11px;
          color: var(--text-muted);
          font-family: ${font.mono};
        }

        /* Center Content Area */
        .center-content-panel {
          padding: 32px 40px;
          overflow-y: auto;
          background-color: var(--surface-l0);
        }

        /* Right Context Panel */
        .right-context-panel {
          background-color: var(--surface-l1);
          border-left: 1px solid var(--border-color);
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
          text-align: left;
        }

        /* Academic Cards & Layout components */
        .academic-section-card {
          background-color: var(--surface-l1);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-bottom: 16px;
          overflow: hidden;
          transition: border-color 0.2s ease;
        }
        .academic-section-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }
        :root[data-theme="light"] .academic-section-card:hover {
          border-color: rgba(0, 0, 0, 0.12);
        }

        .section-header-bar {
          padding: 16px 20px;
          background-color: rgba(255,255,255,0.01);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .section-body {
          padding: 20px;
          background-color: var(--surface-l1);
        }

        .metadata-grid-box {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .meta-stat-card {
          background-color: var(--surface-l2);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 12px;
          text-align: left;
        }
        .meta-stat-label {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          font-family: ${font.mono};
          margin-bottom: 4px;
        }
        .meta-stat-value {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .academic-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          font-family: var(--font-family);
        }
        .btn-academic-primary {
          background-color: #2563eb;
          color: #ffffff;
        }
        .btn-academic-primary:hover:not(:disabled) {
          background-color: #1d4ed8;
        }
        .btn-academic-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-academic-secondary {
          background-color: transparent;
          border-color: var(--border-color);
          color: #d1d5db;
        }
        .btn-academic-secondary:hover {
          background-color: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .btn-academic-success {
          background-color: var(--success-emerald);
          color: #ffffff;
        }
        .btn-academic-success:hover:not(:disabled) {
          background-color: #059669;
        }

        /* Formula Component Styling */
        .formula-container {
          background-color: var(--surface-l2);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 8px;
          padding: 20px;
          text-align: left;
        }

        .formula-display {
          font-family: ${font.mono};
          font-size: 1.6rem;
          color: var(--success-emerald);
          background-color: rgba(16, 185, 129, 0.05);
          border-radius: 6px;
          padding: 16px;
          text-align: center;
          margin-bottom: 16px;
          border: 1px dashed rgba(16, 185, 129, 0.2);
        }

        .formula-variable-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        /* Safety Warning Component */
        .safety-alert-box {
          background-color: rgba(245, 158, 11, 0.03);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-left: 4px solid var(--warning-amber);
          border-radius: 6px;
          padding: 16px;
          text-align: left;
        }

        /* Progressive timeline */
        .timeline-flow {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
        }
        .timeline-step {
          display: flex;
          gap: 16px;
          position: relative;
          padding-bottom: 24px;
        }
        .timeline-step:last-child {
          padding-bottom: 0;
        }
        .timeline-step::before {
          content: '';
          position: absolute;
          left: 13px;
          top: 24px;
          bottom: 0;
          width: 2px;
          background-color: var(--border-color);
          z-index: 0;
        }
        .timeline-step:last-child::before {
          display: none;
        }
        .timeline-marker {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: var(--surface-l2);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          font-size: 11px;
          font-weight: 700;
          color: var(--neutral-slate);
          flex-shrink: 0;
        }
        .timeline-step.active .timeline-marker {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          background-color: rgba(6, 182, 212, 0.05);
        }
        .timeline-content {
          flex: 1;
          background-color: var(--surface-l1);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          text-align: left;
        }

        /* Video Workspace */
        .media-workspace {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          overflow-x: hidden;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        
        .video-wrapper-card {
          background-color: #000000;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 16/9;
          border: 1px solid var(--border-color);
        }

        .media-controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background-color: var(--surface-l1);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        /* Timer Box */
        .timer-hud-card {
          background-color: var(--surface-l2);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          position: relative;
        }
        .timer-hud-value {
          font-family: ${font.mono};
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 12px;
        }
        .timer-hud-card.low {
          border-color: rgba(239, 68, 68, 0.4);
          background-color: rgba(239, 68, 68, 0.02);
          animation: pulseBorder 1.5s infinite;
        }
        .timer-hud-card.low .timer-hud-value {
          color: var(--danger-red);
        }
        
        @keyframes pulseBorder {
          0% { border-color: rgba(239, 68, 68, 0.4); }
          50% { border-color: rgba(239, 68, 68, 0.8); }
          100% { border-color: rgba(239, 68, 68, 0.4); }
        }

        /* Inspection Table */
        .inspection-table {
          width: 100%;
          border-collapse: collapse;
        }
        .inspection-th {
          padding: 10px 14px;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--neutral-slate);
          border-bottom: 2px solid var(--border-color);
          font-family: ${font.mono};
          font-weight: 700;
          text-align: left;
        }
        .inspection-td {
          padding: 14px;
          font-size: 13px;
          border-bottom: 1px solid var(--border-color);
          text-align: left;
        }
        .status-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          font-family: ${font.mono};
        }
        .status-chip.pass { background-color: rgba(16, 185, 129, 0.1); color: var(--success-emerald); border: 1px solid rgba(16, 185, 129, 0.2); }
        .status-chip.pending { background-color: rgba(245, 158, 11, 0.1); color: var(--warning-amber); border: 1px solid rgba(245, 158, 11, 0.2); }

        /* Document style lab record */
        .lab-record-container {
          background-color: var(--surface-l1);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 32px;
          max-width: 580px;
          margin: 0 auto;
          box-shadow: var(--glass-shadow);
          font-family: ${font.sans};
        }
        .record-title-block {
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 14px;
          margin-bottom: 20px;
          text-align: center;
        }
        .record-title-txt {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin: 0;
          color: var(--text-primary);
        }
        .record-grid-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 20px;
          margin-bottom: 20px;
          text-align: left;
        }
        .record-item-box {
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 6px;
        }
        .record-item-lbl {
          font-size: 10px;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
        }
        .record-item-val {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .record-stamp-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .record-qr-stub {
          border: 1px solid var(--border-color);
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: var(--text-muted);
          font-weight: bold;
          text-transform: uppercase;
          background-color: var(--surface-l2);
        }

        .sidebar-nav-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sidebar-progress-container {
          margin-top: auto;
        }

        @media (max-width: 1024px) {
          .workspace-layout {
            display: flex;
            flex-direction: column;
          }
          .right-context-panel {
            border-left: none;
            border-top: 1px solid var(--border-color);
            padding: 24px 20px;
          }
        }

        @media (max-width: 768px) {
          .workspace-layout {
            grid-template-columns: 1fr;
            display: flex;
            flex-direction: column;
          }
          .sidebar-panel {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            padding: 12px 16px;
            display: flex;
            flex-direction: row;
            overflow-x: auto;
            gap: 12px;
            white-space: nowrap;
          }
          .sidebar-panel > div:first-child {
            width: 100%;
          }
          .sidebar-nav-container {
            flex-direction: row !important;
            overflow-x: auto;
            gap: 12px;
            width: 100%;
          }
          .sidebar-nav-item {
            flex-direction: row;
            align-items: center;
            padding: 6px 12px;
            font-size: 13px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .nav-item-meta {
            display: none;
          }
          .sidebar-title {
            display: none;
          }
          .sidebar-progress-container {
            display: none;
          }

        }

        @media (max-width: 600px) {
          .academic-section-card:has(.inspection-table) {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .inspection-table {
            display: block !important;
            width: 100% !important;
            border: none !important;
          }
          .inspection-table thead {
            display: none !important;
          }
          .inspection-table tbody {
            display: block !important;
            width: 100% !important;
          }
          .inspection-row {
            display: grid !important;
            grid-template-areas:
              "check status"
              "text text"
              "time time" !important;
            grid-template-columns: 1fr auto !important;
            gap: 10px !important;
            padding: 16px !important;
            background-color: var(--surface-l1) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 8px !important;
            margin-bottom: 12px !important;
            box-sizing: border-box !important;
            width: 100% !important;
          }
          .inspection-td-check {
            grid-area: check !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: 0 !important;
            border: none !important;
          }
          .inspection-td-text {
            grid-area: text !important;
            display: block !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            color: var(--text-primary) !important;
            padding: 4px 0 0 0 !important;
            border: none !important;
            text-align: left !important;
            line-height: 1.5 !important;
          }
          .inspection-td-time {
            grid-area: time !important;
            display: block !important;
            font-size: 11px !important;
            color: var(--text-muted) !important;
            padding: 0 !important;
            border: none !important;
            text-align: left !important;
          }
          .inspection-td-status {
            grid-area: status !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            padding: 0 !important;
            border: none !important;
          }
        }

        @media (max-width: 768px) {
          .workspace-header {
            padding: 10px 16px !important;
          }
          .workspace-header-left {
            gap: 12px !important;
          }
          .workspace-header-title-container {
            max-width: calc(100vw - 180px) !important;
          }
          .workspace-header-breadcrumb {
            display: none !important;
          }
          .workspace-header-title {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 100% !important;
            font-size: 15px !important;
          }
          .workspace-header-user {
            display: none !important;
          }
          .workspace-header-right {
            gap: 12px !important;
          }
        }
      `}</style>

      {/* Global Header */}
      <header className="workspace-header">
        <div className="workspace-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <motion.button 
            className="exit-ghost-btn" 
            onClick={() => navigate(isGhostMode ? '/scan-simulator' : '/student/dashboard')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft size={14} /> Exit
          </motion.button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <LabScanLogo size={24} style={{ flexShrink: 0 }} />
            <div className="workspace-header-title-container" style={{ textAlign: 'left', minWidth: 0 }}>
              <span className="workspace-header-breadcrumb" style={{ fontSize: '10px', fontFamily: font.mono, color: 'var(--neutral-slate)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                {experiment?.lab_name} {isGhostMode && '• GHOST ACCESS'}
              </span>
              <h2 className="workspace-header-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{experiment?.experiment_name}</h2>
            </div>
          </div>
        </div>

        <div className="workspace-header-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span className="workspace-header-user" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: font.mono }}>
            {!isGhostMode ? `Session User: ${currentUser?.username}` : 'Anonymous Observer'}
          </span>
          <ThemeToggle size="sm" />
        </div>
      </header>

      {/* ArUco Bench Proof-of-Presence Gatekeeper Modal with Live Camera Scanner */}
      {showScanGatekeeper && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          overflowY: 'auto'
        }}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: 'var(--surface-l1)', border: '1px solid var(--border-color)',
              borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '24px',
              textAlign: 'center', color: 'var(--text-primary)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} style={{ color: 'var(--accent-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Scan Bench ArUco Marker</h3>
              </div>
              <span className="status-chip pending">Required</span>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px', textAlign: 'left' }}>
              Point your camera at <strong>ArUco Marker #{experiment?.ar_qr_marker_id || '01'}</strong> located on your physical lab bench at <strong>{experiment?.location || 'Block 4, Room 302'}</strong> to unlock Step 2 and activate your attendance countdown timer.
            </p>

            {/* Live Camera Feed Scanner Component */}
            <div style={{ width: '100%', marginBottom: '16px' }}>
              {scanSuccess ? (
                <div style={{
                  height: '240px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--success-emerald)',
                  borderRadius: '12px', color: 'var(--success-emerald)'
                }}>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle2 size={54} />
                  </motion.div>
                  <p style={{ marginTop: '12px', fontWeight: 700, fontSize: '15px' }}>Marker Verified Successfully!</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Unlocking visual bench trials...</p>
                </div>
              ) : (
                <ArucoScanner autoStart={true} onDetected={handleCameraDetectedMarker} />
              )}
            </div>

            {scanGatekeeperError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-red)', borderRadius: '8px', padding: '10px 12px', color: 'var(--danger-red)', fontSize: '12px', marginBottom: '14px', textAlign: 'left' }}>
                ⚠️ {scanGatekeeperError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {import.meta.env.DEV && (
                <button 
                  className="academic-btn btn-academic-primary"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => handleArUcoGatekeeperScan(experiment?.ar_qr_marker_id || '01')}
                >
                  <ShieldCheck size={16} /> Simulate Camera Bench Scan (Marker #{experiment?.ar_qr_marker_id || '01'})
                </button>
              )}
              <button 
                className="academic-btn btn-academic-secondary"
                style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                onClick={() => {
                  setShowScanGatekeeper(false);
                  setHasScannerBeenDismissed(true);
                }}
              >
                Back to Theory & Objectives
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Main Workspace layout */}
      <div className="workspace-layout">
        {loading ? (
          <>
            {/* Left Outline nav skeleton */}
            <aside className="sidebar-panel">
              <div style={{ marginBottom: '20px' }}>
                <Skeleton variant="text" width="120px" height="16px" style={{ marginBottom: '14px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: '54px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <Skeleton variant="text" width="60%" height="12px" />
                      <Skeleton variant="text" width="40%" height="10px" style={{ marginTop: '4px' }} />
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Center Content Panel skeleton */}
            <main className="center-content-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px', height: '240px' }}>
                  <Skeleton variant="text" width="30%" height="20px" />
                  <Skeleton variant="text" width="90%" height="14px" style={{ marginTop: '12px' }} />
                  <Skeleton variant="text" width="80%" height="14px" style={{ marginTop: '6px' }} />
                  <Skeleton variant="text" width="50%" height="14px" style={{ marginTop: '6px' }} />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <Skeleton variant="text" width="100px" height="36px" style={{ borderRadius: '999px' }} />
                    <Skeleton variant="text" width="100px" height="36px" style={{ borderRadius: '999px' }} />
                  </div>
                </div>

                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px', height: '180px' }}>
                  <Skeleton variant="text" width="40%" height="16px" />
                  <Skeleton variant="text" width="100%" height="12px" style={{ marginTop: '12px' }} />
                  <Skeleton variant="text" width="95%" height="12px" style={{ marginTop: '6px' }} />
                </div>
              </div>
            </main>

            {/* Right sidebar metadata skeleton */}
            <aside className="sidebar-panel" style={{ borderLeft: '1px solid var(--border-color)', borderRight: 'none' }}>
              <div>
                <Skeleton variant="text" width="100px" height="14px" style={{ marginBottom: '10px' }} />
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', height: '70px' }}>
                  <Skeleton variant="text" width="40%" height="10px" />
                  <Skeleton variant="text" width="70%" height="14px" style={{ marginTop: '6px' }} />
                </div>
              </div>
            </aside>
          </>
        ) : (
          <>
            {/* Left Sidebar Panel - Outline navigation */}
            <aside className="sidebar-panel">
          <div>
            <div className="sidebar-title">Experiment Outline</div>
            <div className="sidebar-nav-container">
              
              {/* Learning Stage Nav */}
              <div 
                className={`sidebar-nav-item ${activeStage === 'learning' ? 'active' : ''}`}
                onClick={() => handleStageClick('learning')}
              >
                <div className="nav-item-header">
                  <span>1. Learning Stage</span>
                  {activeStage !== 'learning' && <span style={{ color: 'var(--success-emerald)' }}>✓</span>}
                </div>
                <div className="nav-item-meta">Objectives & Theory</div>
              </div>

              {/* Visual Stage Nav */}
              <div 
                className={`sidebar-nav-item ${activeStage === 'visual' ? 'active' : ''} ${!isArUcoScanned && !isGhostMode ? 'locked' : ''}`}
                onClick={() => handleStageClick('visual')}
              >
                <div className="nav-item-header">
                  <span>2. Visual Stage</span>
                  {(activeStage === 'checklist' || activeStage === 'complete') && <span style={{ color: 'var(--success-emerald)' }}>✓</span>}
                </div>
                <div className="nav-item-meta">
                  {!isArUcoScanned && !isGhostMode ? '📷 ArUco Marker Required' : `Video Trials (${getVideoCompletionPercentage()}% watched)`}
                </div>
              </div>

              {/* Verification Stage Nav */}
              <div 
                className={`sidebar-nav-item ${activeStage === 'checklist' ? 'active' : ''} ${(activeStage === 'learning' || activeStage === 'visual') && !isGhostMode ? 'locked' : ''}`}
                onClick={() => handleStageClick('checklist')}
              >
                <div className="nav-item-header">
                  <span>3. Validation</span>
                  {activeStage === 'complete' && <span style={{ color: 'var(--success-emerald)' }}>✓</span>}
                </div>
                <div className="nav-item-meta">Checklist ({getChecklistPercentage()}%)</div>
              </div>

              {/* Completion Stage Nav */}
              <div 
                className={`sidebar-nav-item ${activeStage === 'complete' ? 'active' : ''} ${activeStage !== 'complete' && !isGhostMode ? 'locked' : ''}`}
                onClick={() => handleStageClick('complete')}
              >
                <div className="nav-item-header">
                  <span>4. Completion</span>
                </div>
                <div className="nav-item-meta">Institutional Record</div>
              </div>

            </div>
          </div>

          <div className="sidebar-progress-container">
            <div className="sidebar-title">Global Progress</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: 
                      activeStage === 'learning' ? '25%' :
                      activeStage === 'visual' ? '50%' :
                      activeStage === 'checklist' ? '75%' : '100%'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: font.mono }}>
                <span>Completion Status</span>
                <span>
                  {activeStage === 'learning' ? '25%' :
                   activeStage === 'visual' ? '50%' :
                   activeStage === 'checklist' ? '75%' : '100%'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Panel - Primary task content */}
        <main className="center-content-panel">
          <AnimatePresence mode="wait">
            
            {/* STAGE 1: LEARNING */}
            {activeStage === 'learning' && (
              <motion.div 
                key="learning"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {/* 1. Learning Objectives */}
                <div className="academic-section-card">
                  <div className="section-header-bar" onClick={() => toggleSection('objectives')}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <BookOpen size={18} style={{ color: 'var(--accent-cyan)' }} /> Learning Objectives
                    </span>
                    {expandedSections.objectives ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {expandedSections.objectives && (
                    <div className="section-body" style={{ textAlign: 'left' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        By the end of this module, students will understand the mathematical relationship behind chemical neutralization, identify the proper physical configurations for acid-base titrations, and observe critical color changes mapping to chemical equivalence points.
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Theory */}
                <div className="academic-section-card">
                  <div className="section-header-bar" onClick={() => toggleSection('theory')}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} style={{ color: 'var(--accent-cyan)' }} /> Scientific Theory
                    </span>
                    {expandedSections.theory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {expandedSections.theory && (
                    <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {theoryBlocks.map((block, index) => {
                        if (block.type === 'heading') {
                          return <h4 key={index} style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px', textAlign: 'left' }}>{block.text}</h4>;
                        }
                        if (block.type === 'text') {
                          return <p key={index} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, textAlign: 'left' }}>{block.text}</p>;
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Formula Component */}
                <div className="academic-section-card">
                  <div className="section-header-bar" onClick={() => toggleSection('formula')}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Hash size={18} style={{ color: 'var(--success-emerald)' }} /> Key Equation
                    </span>
                    {expandedSections.formula ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {expandedSections.formula && (
                    <div className="section-body">
                      {theoryBlocks.filter(b => b.type === 'equation').map((block, index) => (
                        <div key={index} className="formula-container">
                          <div className="formula-display">{block.text}</div>
                          <div style={{ textAlign: 'left' }}>
                            <h5 style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', fontFamily: font.mono }}>Variables Definition</h5>
                            <div className="formula-variable-list">
                              <div><strong>M₁ , M₂</strong>: Molarity of solution 1 (analyte) and solution 2 (titrant). Represents moles of solute per liter.</div>
                              <div><strong>V₁ , V₂</strong>: Volume in liters or milliliters of analytes and titrants used.</div>
                              <div><strong>Application:</strong> Used for computing neutralization reactions when acid and base moles reach equal quantities.</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Safety Precautions */}
                <div className="academic-section-card">
                  <div className="section-header-bar" onClick={() => toggleSection('precautions')}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <AlertTriangle size={18} style={{ color: 'var(--warning-amber)' }} /> Safety Precautions
                    </span>
                    {expandedSections.precautions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {expandedSections.precautions && (
                    <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {theoryBlocks.filter(b => b.type === 'warning').map((block, index) => (
                        <div key={index} className="safety-alert-box">
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning-amber)', fontFamily: font.mono, textTransform: 'uppercase', marginBottom: '4px' }}>Attention Required</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{block.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Procedure Workflow */}
                <div className="academic-section-card">
                  <div className="section-header-bar" onClick={() => toggleSection('procedure')}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Clock size={18} style={{ color: 'var(--accent-cyan)' }} /> Procedural Steps
                    </span>
                    {expandedSections.procedure ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {expandedSections.procedure && (
                    <div className="section-body">
                      <div className="timeline-flow">
                        {theoryBlocks.filter(b => b.type === 'text').map((block, index) => {
                          const stepMatch = block.text.match(/^\s*(?:step\s*)?(\d+|[①②③④⑤⑥⑦⑧⑨⑩])[.\s:-]*(.*)/i);
                          if (stepMatch) {
                            const stepNum = stepMatch[1];
                            const stepText = stepMatch[2];
                            return (
                              <div key={index} className="timeline-step">
                                <div className="timeline-marker">{stepNum}</div>
                                <div className="timeline-content">
                                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{stepText}</div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  {session?.session_completed_at || session?.checklist_completed_at || session?.learning_stage_completed_at ? (
                    <span className="status-chip pass" style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Learning Stage Verified & Completed
                    </span>
                  ) : (
                    <button 
                      className="academic-btn btn-academic-primary pill"
                      onClick={completeLearningStage}
                    >
                      Confirm Stage Completion & Continue <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STAGE 2: VISUAL */}
            {activeStage === 'visual' && (
              <motion.div 
                key="visual"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="media-workspace"
              >
                {activeVideo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Header Details */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', minWidth: 0 }}>
                      <div style={{ textAlign: 'left', minWidth: 0, width: '100%' }}>
                        <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontFamily: font.mono, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>ACTIVE RESOURCE</span>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 0', color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', width: '100%' }}>{activeVideo.title}</h3>
                      </div>
                    </div>

                    {/* Video Selector Tabs (Enables easy switching on all screen sizes) */}
                    {videoLinks.length > 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: font.mono, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Select Visual Resource:</span>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {videoLinks.map((vid, idx) => {
                            const savedProgress = session?.current_video_progress?.[vid.id] || 0;
                            const isDone = savedProgress >= vid.min_duration;
                            const isActive = activeVideo?.id === vid.id;
                            return (
                              <button
                                key={vid.id || idx}
                                onClick={() => handleSelectVideo(vid)}
                                className="academic-btn pill"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '12px',
                                  padding: '8px 16px',
                                  whiteSpace: 'nowrap',
                                  border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface-l1)',
                                  color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                  fontWeight: isActive ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  flexShrink: 0
                                }}
                              >
                                <Play size={12} style={{ color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '200px' }}>{vid.title}</span>
                                <span style={{ fontSize: '10px', color: isDone ? 'var(--success-emerald)' : 'var(--text-muted)', marginLeft: '4px', fontWeight: 600 }}>
                                  {isDone ? '✓ Met' : `${formatTime(savedProgress)} / ${formatTime(vid.min_duration)}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Physical Bench Verification & Proof-of-Presence Enforced */}
                    <div style={{ background: 'var(--surface-l1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <ShieldCheck size={18} style={{ color: 'var(--accent-cyan)' }} />
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                            Physical Bench Verification (ArUco Marker #{experiment?.ar_qr_marker_id || '01'})
                          </span>
                        </div>
                        <span className="status-chip pass" style={{ padding: '4px 10px', fontSize: '10.5px' }}>
                          ✓ Bench Verified at {experiment?.location || 'Block 4, Room 302'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong>Proof-of-Presence Enforced:</strong> Each physical lab table in the university lab has a unique ArUco/QR marker. Students must physically stand at that lab bench and scan the marker with their camera in Stage 2 (Visual Bench Stage) to prove physical attendance and unlock worksheet sign-off.
                      </p>
                    </div>

                    {/* Inline Attendance Timer HUD Card (Guarantees 100% visibility on all screen sizes) */}
                    {!isGhostMode && (
                      <div style={{ background: 'var(--surface-l1)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: font.mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attendance Countdown</div>
                          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: font.mono, color: remainingSeconds <= 15 ? 'var(--warning-amber)' : 'var(--accent-blue)', marginTop: '2px' }}>
                            {formatTime(remainingSeconds)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => setManualPlaying(!isPlaying)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: isPlaying ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              border: `2px solid ${isPlaying ? 'var(--danger-red)' : 'var(--success-emerald)'}`,
                              color: isPlaying ? 'var(--danger-red)' : 'var(--success-emerald)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              flexShrink: 0,
                              outline: 'none',
                              padding: 0,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = isPlaying ? 'rgba(239, 68, 68, 0.22)' : 'rgba(16, 185, 129, 0.22)';
                              e.currentTarget.style.transform = 'scale(1.08)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = isPlaying ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title={isPlaying ? 'Pause Timer' : 'Start Timer'}
                          >
                            {isPlaying ? <Pause size={18} style={{ strokeWidth: 3 }} /> : <Play size={18} style={{ strokeWidth: 3, fill: 'currentColor' }} />}
                          </button>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: isCurrentVideoCompleted ? 'var(--success-emerald)' : 'var(--text-secondary)', fontWeight: 600 }}>
                              {isCurrentVideoCompleted ? '✓ REQUIRED TIME MET' : `${formatTime(watchedSeconds)} / ${formatTime(activeVideo.min_duration)} watched`}
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: isPlaying ? 'var(--success-emerald)' : 'var(--text-muted)', fontFamily: font.mono, fontWeight: 700 }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPlaying ? 'var(--success-emerald)' : 'var(--text-muted)' }} />
                                {isPlaying ? 'TIMER ACTIVE' : 'TIMER PAUSED'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Player */}
                    <div className="video-wrapper-card">
                      {parseEmbedVideoUrl(activeVideo) === 'about:blank' ? (
                        <div style={{
                          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', background: 'var(--surface-l2)',
                          border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)',
                          padding: '24px', textAlign: 'center'
                        }}>
                          <AlertTriangle size={40} style={{ color: 'var(--warning-amber)', marginBottom: '12px' }} />
                          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Unable to Embed Video</h4>
                          <p style={{ fontSize: '12px', margin: '6px 0 12px', maxWidth: '320px', lineHeight: 1.4 }}>
                            This video link cannot be safely embedded. The domain is not allowed, or the URL format is invalid.
                          </p>
                          <a 
                            href={activeVideo.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="academic-btn btn-academic-secondary pill"
                            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            Open Resource Link <ChevronRight size={12} />
                          </a>
                        </div>
                      ) : (activeVideo.url.includes('drive.google.com') || activeVideo.url.includes('docs.google.com')) ? (
                        <iframe 
                          loading="lazy"
                          src={parseEmbedVideoUrl(activeVideo)}
                          title={activeVideo.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ width: '100%', height: '100%', border: '0', display: 'block' }}
                        />
                      ) : (
                        <iframe 
                          loading="lazy"
                          src={`${parseEmbedVideoUrl(activeVideo)}${parseEmbedVideoUrl(activeVideo).includes('?') ? '&' : '?'}start=${videoTimeOffset}`}
                          title={activeVideo.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ width: '100%', height: '100%', border: '0', display: 'block' }}
                        />
                      )}
                    </div>

                    {/* Google Drive Specific Guidance & Fallback */}
                    {activeVideo?.url && activeVideo.url.includes('drive.google.com') && (
                      <div className="safety-alert-box" style={{ borderLeft: '3px solid var(--accent-blue)', background: 'var(--surface-l1)', borderRadius: '8px', padding: '14px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', fontFamily: font.mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Google Drive Resource Guide</div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          If the video displays a connection error or blank screen:
                          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <li>Verify that the owner/instructor has set sharing to <strong>"Anyone with the link can view"</strong>.</li>
                            <li>Ensure you are logged into your institutional Google account in this browser.</li>
                          </ul>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '6px' }}>
                          <a 
                            href={activeVideo.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="academic-btn btn-academic-secondary pill" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', padding: '6px 12px', textDecoration: 'none' }}
                          >
                            <FileText size={13} /> Open Directly in Google Drive <ChevronRight size={12} />
                          </a>
                        </div>
                      </div>
                    )}



                    {/* Notes Editor (Saves in component memory) */}
                    <div className="academic-section-card">
                      <div className="section-header-bar">
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Edit3 size={15} /> Personal Experiment Observations
                        </span>
                      </div>
                      <div className="section-body" style={{ padding: '16px' }}>
                        <textarea
                          className="premium-input"
                          style={{ width: '100%', minHeight: '80px', padding: '12px', background: 'var(--surface-l0)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: font.sans, resize: 'vertical' }}
                          placeholder="Document your observations, readings, color indicators or mathematical comments here as you watch..."
                          value={videoNotes}
                          onChange={(e) => setVideoNotes(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Unfocused Warning */}
                    {/* Proceed Action */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: font.mono }}>
                        {!isGhostMode && `Resource time: ${formatTime(watchedSeconds)} / ${formatTime(activeVideo?.min_duration || 60)}`}
                      </span>
                      {session?.session_completed_at || session?.checklist_completed_at || session?.visual_stage_completed_at ? (
                        <span className="status-chip pass" style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={16} /> Visual Stage Completed
                        </span>
                      ) : (
                        <button 
                          className="academic-btn btn-academic-primary pill"
                          onClick={completeVisualStage}
                          disabled={!isGhostMode && watchedSeconds < (activeVideo?.min_duration || 0) && !isCurrentVideoCompleted}
                        >
                          Proceed to Verification <ChevronRight size={14} />
                        </button>
                      )}
                    </div>

                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No videos configured.</div>
                )}
              </motion.div>
            )}

            {/* STAGE 3: CHECKLIST */}
            {activeStage === 'checklist' && (
              <motion.div 
                key="checklist"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Verification & Safety Sign-off</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                    Confirm physical tasks completed on the workbench before submitting data for final faculty verification.
                  </p>
                </div>

                {/* Inspection Checklist Table */}
                <div className="academic-section-card" style={{ padding: 0 }}>
                  <table className="inspection-table">
                    <thead>
                      <tr>
                        <th className="inspection-th" style={{ width: '44px', textAlign: 'center' }}>Check</th>
                        <th className="inspection-th">Checklist Item</th>
                        <th className="inspection-th" style={{ width: '140px' }}>Timestamp</th>
                        <th className="inspection-th" style={{ width: '120px', textAlign: 'center' }}>Inspect Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checklistItems.map(item => (
                        <tr 
                          key={item.checklist_item_id} 
                          onClick={() => handleChecklistToggle(item)}
                          style={{ cursor: isGhostMode ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                          className="inspection-row"
                        >
                          <td className="inspection-td inspection-td-check" style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={!!item.is_completed}
                              readOnly
                              style={{
                                width: '18px',
                                height: '18px',
                                accentColor: 'var(--success-emerald)',
                                cursor: 'pointer'
                              }}
                            />
                          </td>
                          <td className="inspection-td inspection-td-text" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.item_text}
                          </td>
                          <td className="inspection-td inspection-td-time" style={{ fontFamily: font.mono, fontSize: '11px', color: 'var(--text-muted)' }}>
                            {item.completed_at ? new Date(item.completed_at).toLocaleTimeString() : '--:--:--'}
                          </td>
                          <td className="inspection-td inspection-td-status" style={{ textAlign: 'center' }}>
                            <span className={`status-chip ${item.is_completed ? 'pass' : 'pending'}`}>
                              {item.is_completed ? 'PASS' : 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {checklistItems.length === 0 && (
                        <tr>
                          <td colSpan="4" className="inspection-td" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No checklist verification items configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Sign-off Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  {session?.session_completed_at || session?.checklist_completed_at ? (
                    <span className="status-chip pass" style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Verification Record Generated & Signed Off
                    </span>
                  ) : (
                    <button 
                      className="academic-btn btn-academic-success pill"
                      onClick={completeChecklistStage}
                      disabled={!checklistItems.every(ci => ci.is_completed)}
                    >
                      Generate Faculty Verification Record <CheckCircle2 size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STAGE 4: COMPLETION */}
            {activeStage === 'complete' && (
              <motion.div 
                key="complete"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                {/* Printable Digital Lab Record */}
                <div className="lab-record-container">
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '14px 18px', textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--success-emerald)', fontWeight: 800, fontSize: '14px' }}>
                      <CheckCircle2 size={18} /> OFFICIAL COMPLETED & STAMPED RECORD
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Verified in laboratory room at <strong>{experiment?.location || 'Block 4, Room 302'}</strong> via ArUco Marker #{experiment?.ar_qr_marker_id || '01'}. Session locked to prevent remote re-runs.
                    </p>
                  </div>

                  <div className="record-title-block">
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, fontFamily: font.mono, letterSpacing: '0.1em' }}>
                      {institution?.name ? institution.name.toUpperCase() : 'LABSCAN DIGITAL RECORD'}
                    </div>
                    <h3 className="record-title-txt">Experiment Verification</h3>
                  </div>

                  <div className="record-grid-box" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                    <div className="record-item-box">
                      <div className="record-item-lbl">Student Identifier</div>
                      <div className="record-item-val">{currentUser?.username || 'Guest Student'}</div>
                    </div>
                    <div className="record-item-box">
                      <div className="record-item-lbl">Experiment Module</div>
                      <div className="record-item-val">{experiment?.experiment_name}</div>
                    </div>
                    <div className="record-item-box">
                      <div className="record-item-lbl">Academic Lab Unit</div>
                      <div className="record-item-val">{experiment?.lab_name}</div>
                    </div>
                    <div className="record-item-box">
                      <div className="record-item-lbl">Signoff Date</div>
                      <div className="record-item-val">
                        {session ? new Date(session.session_completed_at || session.checklist_completed_at || new Date()).toLocaleDateString(undefined, { dateStyle: 'long' }) : new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </div>
                    </div>
                    <div className="record-item-box" style={{ gridColumn: '1 / -1' }}>
                      <div className="record-item-lbl">Department Authority</div>
                      <div className="record-item-val">{institution?.name || 'Academic Institution'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '580px', margin: '0 auto', width: '100%' }}>
                  {/* Facilator instructions */}
                  <div className="safety-alert-box" style={{ borderLeftColor: 'var(--success-emerald)', backgroundColor: 'rgba(16,185,129,0.01)', margin: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success-emerald)', fontFamily: font.mono, textTransform: 'uppercase', marginBottom: '4px' }}>✔ Stamped & Archived</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      This laboratory record has been finalized. Please present this official stamped screen to your lab instructor.
                    </div>
                  </div>

                  <button 
                    className="academic-btn btn-academic-secondary" 
                    style={{ width: '100%', padding: '12px' }}
                    onClick={() => navigate('/student/dashboard')}
                  >
                    Return to Student Dashboard
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Right Panel - Context Aware Info panel */}
        <aside className="right-context-panel">
          
          {/* Context 1: Learning Stage Information */}
          {activeStage === 'learning' && (
            <>
              <div>
                <div className="sidebar-title">Task Parameters</div>
                <div className="metadata-grid-box">
                  <div className="meta-stat-card">
                    <div className="meta-stat-label">Estimated Time</div>
                    <div className="meta-stat-value">35 min</div>
                  </div>
                  <div className="meta-stat-card">
                    <div className="meta-stat-label">Difficulty</div>
                    <div className="meta-stat-value">Intermediate</div>
                  </div>
                  <div className="meta-stat-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="meta-stat-label">Session Batch</div>
                    <div className="meta-stat-value">Morning A</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="sidebar-title">Instructors Notes</div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, textAlign: 'left' }}>
                  "Always verify that the burette stopcock is completely closed before pouring the alkaline NaOH solution. Add exactly two drops of phenolphthalein."
                </div>
              </div>

              <div>
                <div className="sidebar-title">Safety Rating</div>
                <span className="academic-badge badge-warning">Level 2 (Corrosive Chemicals)</span>
              </div>
            </>
          )}

          {/* Context 2: Visual Stage Information */}
          {activeStage === 'visual' && (
            <>
              <div>
                <div className="sidebar-title">Resource Progress</div>
                <div className="video-playlist-container" style={{ gap: '8px' }}>
                  {videoLinks.map(vid => {
                    const savedProgress = session?.current_video_progress?.[vid.id] || 0;
                    const isDone = savedProgress >= vid.min_duration;
                    const isActive = activeVideo?.id === vid.id;
                    return (
                      <div 
                        key={vid.id}
                        className={`video-card-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleSelectVideo(vid)}
                        style={{ padding: '10px 12px' }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{vid.title}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: font.mono }}>
                          <span>Target: {formatTime(vid.min_duration)}</span>
                          {isDone ? <span style={{ color: 'var(--success-emerald)' }}>✓ MET</span> : <span>{formatTime(savedProgress)} watched</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isGhostMode && (
                <div>
                  <div className="sidebar-title">Required Attendance Timer</div>
                  <div className={`timer-hud-card ${remainingSeconds <= 15 ? 'low' : ''} ${isCurrentVideoCompleted ? 'completed' : ''}`}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: font.mono, marginBottom: '6px' }}>Time Remaining</div>
                    <div className="timer-hud-value">
                      {isCurrentVideoCompleted ? "0:00" : formatTime(remainingSeconds)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {!isTabActive 
                        ? 'TIMER PAUSED: Keep window active' 
                        : !isPlaying 
                          ? 'Timer Paused: Click Play' 
                          : 'TIMING ACTIVE: Stay on tab'}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Context 3: Checklist Stage Information */}
          {activeStage === 'checklist' && (
            <>
              <div>
                <div className="sidebar-title">Checklist Integrity</div>
                <div className="meta-stat-card">
                  <div className="meta-stat-label">Completion Ratio</div>
                  <div className="meta-stat-value" style={{ fontSize: '18px', color: '#ffffff' }}>
                    {getCompletedChecklistCount()} / {checklistItems.length} Tasks Stamped
                  </div>
                  <div className="progress-bar-container" style={{ marginTop: '10px' }}>
                    <div className="progress-bar-fill" style={{ width: `${getChecklistPercentage()}%` }} />
                  </div>
                </div>
              </div>

            </>
          )}

          {/* Context 4: Complete Stage Information */}
          {activeStage === 'complete' && (
            <>
              <div>
                <div className="sidebar-title">Record Authentication</div>
                <div className="meta-stat-card">
                  <div className="meta-stat-label">Verification Status</div>
                  <div className="meta-stat-value" style={{ color: 'var(--success-emerald)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> FACILITATOR READY
                  </div>
                </div>
              </div>

              <div>
                <div className="sidebar-title">Session Information</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div><strong>Session ID:</strong><div style={{ fontFamily: font.mono, fontSize: '10px', wordBreak: 'break-all', marginTop: '2px', color: 'var(--text-primary)' }}>{session?.session_id || 'N/A'}</div></div>
                  <div><strong>Completed At:</strong><div style={{ fontSize: '12px', marginTop: '2px', color: 'var(--text-primary)' }}>{session?.session_completed_at ? new Date(session.session_completed_at).toLocaleString() : 'Pending'}</div></div>
                  <div><strong>Faculty Status:</strong><div style={{ color: session?.session_completed_at ? 'var(--success-emerald)' : 'var(--warning-amber)', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginTop: '2px' }}>{session?.session_completed_at ? 'COMPLETED & STAMPED' : 'PENDING SIGN-OFF'}</div></div>
                </div>
              </div>
            </>
          )}

        </aside>
          </>
        )}
      </div>

      {/* Floating Camera Scan FAB */}
      {activeStage === 'learning' && !isArUcoScanned && !isGhostMode && !loading && (
        <button 
          className="btn-fab btn-fab-scan" 
          onClick={() => setShowScanGatekeeper(true)}
          title="Scan Bench Marker"
        >
          <Camera size={24} />
        </button>
      )}
    </div>
  );
}
