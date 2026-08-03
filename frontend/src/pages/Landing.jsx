import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';

import { 
  Shield, Scan, Users, Activity, Layers, BookOpen, Terminal, 
  Monitor, Camera, Cpu, ChevronRight, ArrowRight,
  Sparkles, Zap, Layout, UserCheck, CheckSquare, FileText, Lock
} from 'lucide-react';

const font = { mono: "'Space Mono', monospace", sans: "'DM Sans', sans-serif" };
const BTN_BASE = { cursor: 'pointer', border: 'none', outline: 'none', fontFamily: font.mono, letterSpacing: '0.08em', transition: 'var(--transition-fast)' };

// ── Scroll Reveal Component ────────────────────────────────────────────────
function ScrollReveal({ children, delay = '0s', direction = 'up' }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(domRef.current);
        }
      });
    }, { threshold: 0.1 });
    
    const currentEl = domRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }
    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, []);

  const transformDirection = {
    up: 'translateY(40px)',
    down: 'translateY(-40px)',
    left: 'translateX(40px)',
    right: 'translateX(-40px)',
  }[direction];

  return (
    <div
      ref={domRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : transformDirection,
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}`,
        willChange: 'transform, opacity'
      }}
    >
      {children}
    </div>
  );
}

// ── Stat Item ──────────────────────────────────────────────────────────────
function StatItem({ value, label }) {
  return (
    <div style={{ padding: '32px', textAlign: 'center', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 20, backdropFilter: 'blur(20px)' }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 'clamp(36px, 4vw, 54px)', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: font.mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>{label}</div>
    </div>
  );
}

// ── 3D Particle Field Canvas ───────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particles = useRef([]);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    particles.current = [];
    for (let i = 0; i < 70; i++) {
      particles.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random(),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        baseSize: Math.random() * 1.5 + 0.5,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach((p, i) => {
        p.x += p.vx * (0.5 + p.z * 0.8);
        p.y += p.vy * (0.5 + p.z * 0.8);

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const size = p.baseSize * (0.4 + p.z * 0.8);
        const alpha = isDark ? (0.08 + p.z * 0.2) : (0.05 + p.z * 0.14);

        const r = Math.round(59 + (6 - 59) * p.z);
        const g = Math.round(130 + (182 - 130) * p.z);
        const b = Math.round(246 + (212 - 246) * p.z);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();

        for (let j = i + 1; j < particles.current.length; j++) {
          const q = particles.current[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 80 + p.z * 60;
          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * (isDark ? 0.03 : 0.02) * (p.z + q.z);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(59,130,246,${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
  );
}

// ── 3D Orbital Scanner ─────────────────────────────────────────────────────
function OrbitalScanner() {
  const { isDark } = useTheme();
  const markerA = [1,1,0,1,1, 0,0,1,0,0, 1,0,1,0,1, 1,1,0,0,1, 0,1,1,1,0];
  const markerB = [0,1,1,0,1, 1,0,0,1,0, 0,1,0,1,1, 1,0,1,0,0, 0,1,0,1,1];

  const markerBg = 'var(--bg-secondary)';
  const markerBorder = 'var(--border-color)';
  const bitBlack = '#000000';
  const bitWhite = '#ffffff';

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 460, height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {[340, 260, 180].map((size, i) => (
        <div key={i} style={{
          position: 'absolute', width: size, height: size, borderRadius: '50%',
          border: `1px ${i === 1 ? 'dashed' : 'solid'} rgba(${i === 0 ? '59,130,246' : i === 1 ? '6,182,212' : isDark ? '255,255,255' : '15,23,42'},${0.06 + i * 0.02})`,
          animation: `spinSlow ${14 + i * 6}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}`,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${65 + i * 5}deg)`
        }} />
      ))}

      {[0, 120, 240].map((deg, i) => (
        <div key={i} style={{
          position: 'absolute', width: 340, height: 340,
          animation: `spinSlow 8s linear ${i * 2.7}s infinite`,
          transformStyle: 'preserve-3d',
          transform: `rotateX(65deg) rotate(${deg}deg)`
        }}>
          <div style={{
            position: 'absolute', top: -4, left: '50%', marginLeft: -4,
            width: 8, height: 8, borderRadius: '50%',
            background: `rgba(${i === 0 ? '59,130,246' : i === 1 ? '6,182,212' : '16,185,129'},0.9)`,
            boxShadow: `0 0 12px rgba(${i === 0 ? '59,130,246' : i === 1 ? '6,182,212' : '16,185,129'},0.6)`
          }} />
        </div>
      ))}

      <div style={{
        background: markerBg, padding: 18, border: `6px solid ${markerBorder}`, borderRadius: 4,
        width: 140, height: 140, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 2,
        boxShadow: 'var(--glass-shadow)',
        transform: 'perspective(600px) rotateY(15deg) rotateX(10deg)',
        zIndex: 2,
        animation: 'pulse3d 4s ease-in-out infinite'
      }}>
        {markerA.map((b, i) => <div key={i} style={{ background: b ? bitBlack : bitWhite }} />)}
      </div>

      <div style={{
        position: 'absolute', width: 140, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.8), transparent)',
        animation: 'scanSweep 2s ease-in-out infinite',
        zIndex: 3, pointerEvents: 'none'
      }} />

      <div style={{
        position: 'absolute', top: 20, right: 30, padding: 6, background: markerBg,
        border: `3px solid ${markerBorder}`, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1,
        width: 52, height: 52,
        animation: 'float3d 5s ease-in-out 0.5s infinite',
        boxShadow: 'var(--glass-shadow)'
      }}>
        {markerB.map((b, i) => <div key={i} style={{ background: b ? bitBlack : bitWhite }} />)}
      </div>

      <div style={{
        position: 'absolute', bottom: 30, left: 20, padding: 6, background: markerBg,
        border: `3px solid ${markerBorder}`, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1,
        width: 44, height: 44,
        animation: 'float3d 6s ease-in-out 1.5s infinite',
        boxShadow: 'var(--glass-shadow)'
      }}>
        {[1,0,1,0,1, 0,1,0,1,0, 1,0,1,0,1, 0,1,0,1,0, 1,0,1,0,1].map((b, i) => <div key={i} style={{ background: b ? bitBlack : bitWhite }} />)}
      </div>

      {[
        { top: -12, left: -12, borderTop: '2px solid var(--accent-blue)', borderLeft: '2px solid var(--accent-blue)' },
        { top: -12, right: -12, borderTop: '2px solid var(--accent-blue)', borderRight: '2px solid var(--accent-blue)' },
        { bottom: -12, left: -12, borderBottom: '2px solid var(--accent-blue)', borderLeft: '2px solid var(--accent-blue)' },
        { bottom: -12, right: -12, borderBottom: '2px solid var(--accent-blue)', borderRight: '2px solid var(--accent-blue)' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 20, height: 20, zIndex: 4, ...s }} />
      ))}
    </div>
  );
}

// ── 3D Isometric Workflow Node ─────────────────────────────────────────────
function IsoNode({ icon, role, tag, desc, color, delay }) {
  const [hovered, setHovered] = useState(false);
  const { isDark } = useTheme();
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 24, borderRadius: 20,
        background: hovered ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(14,165,233,0.04)') : 'var(--glass-bg)',
        border: `1px solid ${hovered ? color : 'var(--border-color)'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        zIndex: 1, backdropFilter: 'blur(10px)',
        transition: 'var(--transition-normal)',
        transform: hovered
          ? 'perspective(600px) rotateX(-8deg) rotateY(4deg) translateY(-6px) scale(1.03)'
          : 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)',
        boxShadow: hovered ? `0 20px 40px rgba(0,0,0,0.3), 0 0 30px ${color}22` : 'none',
        cursor: 'default',
        animationDelay: delay,
        position: 'relative', overflow: 'hidden'
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 20,
        background: `linear-gradient(135deg, ${color}08, transparent)`,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s'
      }} />
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--bg-primary)', border: `2px solid ${hovered ? color : 'var(--border-color)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, marginBottom: 16,
        boxShadow: hovered ? `0 0 20px ${color}44, inset 0 2px 4px rgba(0,0,0,0.1)` : 'none',
        transition: 'var(--transition-fast)',
        zIndex: 1,
        color: 'var(--text-primary)'
      }}>
        {icon}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 9, color: color, fontWeight: 700, zIndex: 1 }}>{tag}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, marginBottom: 8, zIndex: 1 }}>{role}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, zIndex: 1 }}>{desc}</div>
    </div>
  );
}

// ── 3D Bento Card ──────────────────────────────────────────────────────────
function BentoCard3D({ children, style = {} }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, shine: { x: 50, y: 50 } });

  const handleMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xc = rect.width / 2, yc = rect.height / 2;
    setTilt({
      x: (yc - y) / 18,
      y: (x - xc) / 18,
      shine: { x: (x / rect.width) * 100, y: (y / rect.height) * 100 }
    });
  }, []);

  const handleLeave = useCallback(() => {
    setTilt({ x: 0, y: 0, shine: { x: 50, y: 50 } });
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const transformValue = isMobile
    ? 'none'
    : `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.02 : 1})`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        padding: 32, borderRadius: 24,
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-color)',
        transformStyle: 'preserve-3d',
        transform: transformValue,
        transition: tilt.x === 0 ? 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' : 'transform 0.1s ease',
        boxShadow: (tilt.x !== 0 && !isMobile) ? 'var(--glass-shadow)' : 'none',
        overflow: 'hidden',
        position: 'relative',
        ...style
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 24,
        background: `radial-gradient(circle at ${tilt.shine.x}% ${tilt.shine.y}%, rgba(56,189,248,0.06) 0%, transparent 60%)`,
        transition: 'opacity 0.2s',
        opacity: tilt.x !== 0 || tilt.y !== 0 ? 1 : 0
      }} />
      {children}
    </div>
  );
}

// ── Live Session Terminal (Upgraded to v2 Pipeline Engine) ─────────────────
function LiveSessionTerminal() {
  const { isDark } = useTheme();
  const SESSION_CODE = 'LAB-7F2';
  const markerPattern = [1,0,1,1,0, 0,1,0,0,1, 1,1,1,0,1, 0,0,1,1,0, 1,0,1,0,1];

  const STEPS = [
    { phase: 'READING',   label: 'Structured Theory Read', detail: 'Scroll & focus telemetry active', icon: '📖', color: 'var(--accent-blue)' },
    { phase: 'WATCHING',  label: 'Engagement Score >80%',  detail: 'Anti-cheat stream analysis...', icon: '📺', color: '#a78bfa' },
    { phase: 'CHECKLIST', label: 'Preparation Checked',    detail: 'Verified procedural tasks',      icon: '☑️', color: 'var(--accent-blue)' },
    { phase: 'READY',     label: 'State Machine Validated', detail: 'Backend transition checks OK',   icon: '🛡️', color: 'var(--accent-warning)' },
    { phase: 'COMPLETED', label: 'Session Crypto Finalized',detail: 'Proof-of-Prep token generated',   icon: '🔐', color: 'var(--accent-green)' },
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [scanning,   setScanning]   = useState(false);
  const [scanLine,   setScanLine]   = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveStep(prev => (prev + 1) % STEPS.length), 2200);
    return () => clearInterval(timer);
  }, [STEPS.length]);

  useEffect(() => {
    if (STEPS[activeStep]?.phase === 'WATCHING') {
      setScanning(true);
      let frame = 0;
      const id = setInterval(() => { frame += 3; setScanLine(frame % 100); }, 16);
      return () => { clearInterval(id); setScanning(false); };
    }
  }, [activeStep]);

  const completed = (i) => i < activeStep;
  const current   = (i) => i === activeStep;

  const markerBg = 'var(--bg-secondary)';
  const markerBorder = 'var(--border-color)';

  return (
    <div style={{
      position: 'relative',
      width: '100%', maxWidth: 520,
      paddingTop: 36,
      paddingBottom: 28,
    }}>
      <div style={{
        position: 'absolute', top: 36, left: 0, right: 0, bottom: 28,
        borderRadius: 24, background: 'rgba(56,189,248,0.06)',
        transform: 'translate(12px, 8px)', filter: 'blur(2px)', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', top: 36, left: 0, right: 0, bottom: 28,
        borderRadius: 24, background: 'rgba(52,211,153,0.04)',
        transform: 'translate(24px, 16px)', filter: 'blur(4px)', zIndex: 0
      }} />

      <div style={{
        position: 'absolute', top: 0, right: 0, zIndex: 10,
        padding: 8, background: markerBg, border: `4px solid ${markerBorder}`,
        width: 64, height: 64,
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1,
        animation: 'float3d 6s ease-in-out infinite',
        boxShadow: 'var(--glass-shadow)',
      }}>
        {markerPattern.map((b, i) => (
          <div key={i} style={{ background: b ? '#000' : '#fff' }} />
        ))}
      </div>

      <div className="live-terminal" style={{
        width: '100%',
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 24, padding: 28,
        backdropFilter: 'blur(24px)',
        boxShadow: 'var(--glass-shadow)',
        position: 'relative', zIndex: 1,
        transform: 'perspective(2000px) rotateY(-12deg) rotateX(6deg)',
      }}>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border-color)', paddingBottom: 14, marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56', boxShadow: '0 0 6px #ff5f56aa' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e', boxShadow: '0 0 6px #ffbd2eaa' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f', boxShadow: '0 0 6px #27c93faa' }} />
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
            V2 LEARNING STATE ENGINE · {SESSION_CODE}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)',
              boxShadow: '0 0 6px var(--accent-green-glow)', display: 'inline-block',
              animation: 'radialGlow 2s ease-in-out infinite'
            }} />
            <span style={{ fontFamily: font.mono, fontSize: 9, color: 'var(--accent-green)' }}>ACTIVE</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <div style={{
              width: 100, height: 100, background: markerBg,
              border: `4px solid ${markerBorder}`, padding: 6,
              display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1,
              boxShadow: STEPS[activeStep]?.phase === 'READY'
                ? '0 0 0 2px var(--accent-green), 0 0 20px var(--accent-green-glow)'
                : 'var(--glass-shadow)',
              transition: 'box-shadow 0.4s ease', borderRadius: 4
            }}>
              {markerPattern.map((b, i) => <div key={i} style={{ background: b ? '#000' : '#fff' }} />)}
            </div>
            {scanning && (
              <div style={{
                position: 'absolute', left: 0, right: 0, top: `${scanLine}%`, height: 2,
                background: 'linear-gradient(90deg, transparent, var(--accent-blue), transparent)',
                boxShadow: '0 0 8px var(--accent-blue)',
                transition: 'top 0.016s linear', pointerEvents: 'none'
              }} />
            )}
            {[
              { top: -4, left: -4, borderTop: '2px solid var(--accent-blue)', borderLeft: '2px solid var(--accent-blue)' },
              { top: -4, right: -4, borderTop: '2px solid var(--accent-blue)', borderRight: '2px solid var(--accent-blue)' },
              { bottom: -4, left: -4, borderBottom: '2px solid var(--accent-blue)', borderLeft: '2px solid var(--accent-blue)' },
              { bottom: -4, right: -4, borderBottom: '2px solid var(--accent-blue)', borderRight: '2px solid var(--accent-blue)' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            <div style={{ fontFamily: font.mono, fontSize: 9, color: STEPS[activeStep]?.color, letterSpacing: '0.12em' }}>
              {STEPS[activeStep]?.phase} PHASE
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {STEPS[activeStep]?.icon} {STEPS[activeStep]?.label}
            </div>
            <div style={{ fontSize: 11, fontFamily: font.mono, color: 'var(--text-muted)' }}>
              {STEPS[activeStep]?.detail}
            </div>
          </div>
        </div>

        <div style={{
          background: isDark ? 'rgba(5,12,20,0.5)' : 'var(--bg-primary)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 14
        }}>
          <div style={{ fontSize: 9, fontFamily: font.mono, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.1em' }}>
            IMMUTABLE CORE LIFECYCLE
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <React.Fragment>
              {STEPS.map((step, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
                    <div className="step-circle" style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: completed(i) ? step.color : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      border: `2px solid ${completed(i) ? step.color : current(i) ? step.color : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                      color: completed(i) ? '#fff' : 'var(--text-primary)',
                      boxShadow: current(i) ? `0 0 12px ${step.color}66` : 'none',
                      transition: 'all 0.4s ease',
                      transform: current(i) ? 'scale(1.15)' : 'scale(1)'
                    }}>
                      {completed(i) ? '✓' : current(i)
                        ? <span style={{ animation: 'radialGlow 1.5s infinite' }}>●</span>
                        : '○'}
                    </div>
                    <div className="step-phase" style={{
                      fontSize: 7, fontFamily: font.mono,
                      color: current(i) ? step.color : 'var(--text-muted)',
                      textAlign: 'center', maxWidth: 50, lineHeight: 1.3, transition: 'color 0.3s'
                    }}>
                      {step.phase}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="step-line" style={{
                      flex: 1, height: 1, maxWidth: 24,
                      background: completed(i)
                        ? `linear-gradient(90deg, ${STEPS[i].color}, ${STEPS[i + 1].color})`
                        : 'var(--border-color)',
                      transition: 'background 0.5s ease', marginBottom: 16
                    }} />
                  )}
                </React.Fragment>
              ))}
            </React.Fragment>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {STEPS.slice(0, activeStep + 1).slice(-3).map((step, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', borderRadius: 8,
              background: i === arr.length - 1 ? `${step.color}14` : 'transparent',
              border: `1px solid ${i === arr.length - 1 ? `${step.color}30` : 'transparent'}`,
              transition: 'all 0.3s ease',
              animation: i === arr.length - 1 ? 'slideIn 0.3s ease' : 'none'
            }}>
              <span style={{ fontSize: 13 }}>{step.icon}</span>
              <span style={{ fontSize: 11, color: i === arr.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1 }}>
                {step.label}
              </span>
              <span style={{ fontFamily: font.mono, fontSize: 9, color: step.color, opacity: i === arr.length - 1 ? 1 : 0.4 }}>
                {i === arr.length - 1 ? 'NOW' : `${(arr.length - 1 - i) * 2}s ago`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 20, zIndex: 10,
        padding: '8px 16px', background: 'var(--accent-green-glow)',
        border: '1px solid var(--accent-green-glow)', borderRadius: 20,
        fontSize: 11, fontFamily: font.mono, color: 'var(--accent-green)',
        backdropFilter: 'blur(12px)',
        animation: 'float3d 5s ease-in-out 1s infinite',
        display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: 'var(--glass-shadow)'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }} />
        STATE TELEMETRY SYNCHRONIZED
      </div>
    </div>
  );
}

// ── Main Landing Page ──────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [activeShowcase, setActiveShowcase] = useState('admin');

  // Hero mouse parallax effect state
  const heroRef = useRef(null);
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });

  const handleHeroMouseMove = (e) => {
    const hero = heroRef.current;
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setHeroTilt({
      x: (x / rect.width) * 20,
      y: (y / rect.height) * 20
    });
  };

  const handleHeroMouseLeave = () => {
    setHeroTilt({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;700&family=Syne:wght@800;900&family=Herr+Von+Muellerhoff&display=swap" rel="stylesheet" />
      <style>{`
        html { scroll-behavior: smooth; }
        .navlink { color: var(--text-secondary); text-decoration: none; font-size: 13px; font-family: ${font.mono}; letter-spacing: 0.08em; transition: var(--transition-fast); cursor: pointer; }
        .navlink:hover { color: var(--accent-blue); }
        .glowbtn { transition: var(--transition-fast); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; justify-content: center; }
        .glowbtn:hover { filter: brightness(1.15); transform: translateY(-2px); box-shadow: 0 16px 40px rgba(56, 189, 248, 0.35); }
        .showcase-tab { cursor: pointer; transition: var(--transition-fast); border-left: 3px solid var(--border-color); }
        .showcase-tab.active { border-left-color: var(--accent-blue); background: var(--bg-tertiary); }
        
        @keyframes float3d {
          0%,100%{transform:translateY(0px) rotateX(0deg) rotateY(0deg);}
          33%{transform:translateY(-10px) rotateX(3deg) rotateY(5deg);}
          66%{transform:translateY(-6px) rotateX(-2deg) rotateY(-3deg);}
        }
        @keyframes spinSlow { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        @keyframes radialGlow { 0%,100%{opacity:0.4;transform:scale(1);}50%{opacity:0.7;transform:scale(1.08);} }
        @keyframes auraGlow { 0%,100%{box-shadow:0 0 20px rgba(56,189,248,0.12), inset 0 0 14px rgba(56,189,248,0.06);} 50%{box-shadow:0 0 34px rgba(56,189,248,0.25), inset 0 0 24px rgba(56,189,248,0.14);} }
        @keyframes scanSweep { 0%,100%{transform:translateY(-50px);opacity:0;}50%{transform:translateY(50px);opacity:1;} }
        @keyframes pulse3d { 0%,100%{box-shadow:0 30px 80px rgba(0,0,0,${isDark ? '0.9' : '0.1'}),0 0 40px rgba(56,189,248,0.15);}50%{box-shadow:0 30px 80px rgba(0,0,0,${isDark ? '0.9' : '0.1'}),0 0 80px rgba(56,189,248,0.35);} }
        @keyframes flowAnimation { from{stroke-dashoffset:20;}to{stroke-dashoffset:0;} }
        @keyframes gridFade { 0%,100%{opacity:0.03;}50%{opacity:0.06;} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-20px);}to{opacity:1;transform:translateX(0);} }
        @keyframes countUp { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }

        @media (max-width: 1024px) {
          .nav-desktop { display: none !important; }
        }
        @media (max-width: 768px) {
          nav {
            padding: 12px 16px !important;
          }
          .nav-signin, .nav-admin-signin {
            padding: 6px 12px !important;
            font-size: 10px !important;
            border-radius: 8px !important;
          }
          .live-terminal {
            transform: none !important;
            padding: 16px !important;
            border-radius: 16px !important;
          }
          .live-terminal .step-circle {
            width: 20px !important;
            height: 20px !important;
            font-size: 10px !important;
          }
          .live-terminal .step-line {
            max-width: 12px !important;
          }
          .live-terminal .step-phase {
            font-size: 6px !important;
            max-width: 35px !important;
          }
          .showcase-card {
            transform: none !important;
            padding: 20px !important;
            min-height: auto !important;
          }
          #workflow svg {
            display: none !important;
          }
          .scanner-wrapper {
            transform: scale(0.7) !important;
            height: 320px !important;
            margin-top: -50px !important;
            margin-bottom: -50px !important;
          }
        }
        @media (max-width: 640px) {
          nav {
            flex-direction: column !important;
            gap: 12px !important;
            align-items: center !important;
            padding: 12px 16px !important;
          }
          .nav-logo {
            justify-content: center !important;
            margin-bottom: 2px !important;
            width: 100% !important;
          }
          .nav-theme-toggle {
            position: absolute !important;
            top: 12px !important;
            right: 16px !important;
          }
          .nav-cta {
            width: 100% !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .nav-signin, .nav-admin-signin {
            width: 100% !important;
            text-align: center !important;
            padding: 10px 16px !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            border-radius: 10px !important;
          }
        }
        @media (max-width: 480px) {
          .scanner-wrapper {
            transform: scale(0.6) !important;
            height: 280px !important;
            margin-top: -70px !important;
            margin-bottom: -70px !important;
          }
          .footer-bottom {
            flex-direction: column !important;
            gap: 10px !important;
            text-align: center !important;
          }
          .final-cta-card {
            padding: 32px 16px !important;
            border-radius: 20px !important;
          }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', transition: 'background 0.3s ease' }}>

        {/* Ambient background glows */}
        <div className="ambient-glow-canvas">
          <div className="glow-blue" />
          <div className="glow-amber" />
        </div>

        {/* Grid overlay */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
          backgroundImage: `linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent 100%)',
          animation: 'gridFade 6s ease-in-out infinite'
        }} />

        {/* NAVBAR */}
        <nav
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
            padding: scrolled ? '12px 24px' : '24px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: scrolled ? 'var(--bg-secondary)' : 'transparent',
            backdropFilter: scrolled ? 'blur(16px)' : 'none',
            borderBottom: scrolled ? '1px solid var(--border-color)' : '1px solid transparent',
            transition: 'var(--transition-normal)'
          }}
        >
          {/* Logo */}
          <div
            className="nav-logo"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <LabScanLogo size={28} />
            <span
              style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: '1.25rem',
                letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1
              }}
            >
              LabScan
            </span>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="nav-desktop">
            <span className="navlink" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</span>
            <span className="navlink" onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}>Showcase</span>
            <span className="navlink" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>Workflow</span>
            <span className="navlink" onClick={() => document.getElementById('creator')?.scrollIntoView({ behavior: 'smooth' })}>Creator Story</span>
          </div>

          {/* CTA */}
          <div className="nav-cta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="nav-theme-toggle"><ThemeToggle size="sm" /></div>
            <button
              className="glowbtn nav-signin"
              onClick={() => navigate('/login')}
              style={{
                ...BTN_BASE, padding: '8px 16px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)', borderRadius: 10,
                color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700,
                backdropFilter: 'blur(12px)'
              }}
            >
              Sign In
            </button>
            <button
              className="glowbtn nav-admin-signin"
              onClick={() => navigate('/admin/login')}
              style={{
                ...BTN_BASE, padding: '8px 16px', background: 'rgba(59,130,246,0.1)',
                border: '1px solid var(--accent-blue)', borderRadius: 10,
                color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 700,
                backdropFilter: 'blur(12px)'
              }}
            >
              Admin Portal
            </button>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section 
          ref={heroRef}
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
          style={{
            width: '100%', minHeight: '100vh', padding: '100px 24px 40px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px',
            alignItems: 'center', position: 'relative', zIndex: 1, overflow: 'hidden'
          }}
        >
          <ParticleField />

          {/* Left — copy */}
          <div style={{ 
            display: 'flex', flexDirection: 'column', textAlign: 'left', position: 'relative', zIndex: 2,
            transform: `translate(${heroTilt.x * -0.3}px, ${heroTilt.y * -0.3}px)`,
            transition: 'transform 0.15s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 1, background: 'var(--accent-blue)' }} />
              <div style={{ fontFamily: font.mono, fontSize: 11, color: 'var(--accent-blue)', letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase' }}>API-FIRST LAB ARCHITECTURE</div>
            </div>

            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 900,
              fontSize: 'clamp(2rem, 5.5vw, 4.2rem)', lineHeight: 1.05,
              letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 24
            }}>
              The operating system for laboratory education.
            </h1>

            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 520, marginBottom: 36 }}>
              Deploy centralized immutable versions, trace student execution paths, map active layout keys via admin automation, and isolate secure checklist verification metrics completely.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 40 }}>
              <button className="glowbtn" onClick={() => navigate('/scan-simulator')} style={{ ...BTN_BASE, padding: '16px 36px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))', border: 'none', borderRadius: 12, color: '#ffffff', fontWeight: 700, fontSize: 13 }}>
                Open Scanner Simulator →
              </button>
              <button className="glowbtn" onClick={() => navigate('/login')} style={{ ...BTN_BASE, padding: '16px 32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>
                Student Dashboard
              </button>
              
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Admin Configuration', color: 'var(--accent-blue)' },
                { label: 'Ghost Telemetry',    color: '#a78bfa' },
                { label: 'Stateless RBAC',     color: 'var(--accent-green)' }
              ].map((pill, i) => (
                <div key={i} style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: `${pill.color}14`, border: `1px solid ${pill.color}44`,
                  fontSize: 12, fontFamily: font.mono, color: pill.color,
                  backdropFilter: 'blur(8px)'
                }}>
                  {pill.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Live Session Terminal */}
          <div style={{ 
            display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 2,
            transform: `translate(${heroTilt.x * 0.4}px, ${heroTilt.y * 0.4}px)`,
            transition: 'transform 0.15s ease-out'
          }}>
            <LiveSessionTerminal />
          </div>
        </section>

        {/* ── CAPABILITIES ──────────────────────────────────────────────── */}
        <section style={{ width: '100%', padding: '32px 24px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px 28px' }}>
            {[
              'Unified Admin Provisioning',
              'Ghost Telemetry Access',
              'Strict Student Progression',
              'Checklist Preparation Proof',
              'Cryptographic Proof-Tokens',
              'Event-Driven Auditing'
            ].map((cap, i) => (
              <ScrollReveal key={i} delay={`${i * 0.05}s`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', fontFamily: font.mono, whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--accent-green)' }}>✓</span> {cap}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── PRODUCT SHOWCASE ──────────────────────────────────────────── */}
        <section id="showcase" style={{ width: '100%', padding: '80px 24px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <ScrollReveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.15em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 12 }}>ISOLATED ARCHITECTURE</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>One platform. Three perspectives.</h2>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
            <ScrollReveal direction="left">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'admin',   label: 'System & Course Administration', d1: 'Provision global courses & labs', d2: 'Deploys and locks core JSON content layouts directly', d3: 'Monitor systemic append-only audit event streams' },
                  { id: 'ghost',   label: 'Ghost Terminal & Inspection', d1: 'Inspect system models without state persistence', d2: 'Review global deployment frameworks anonymously', d3: 'Trace macro student focus telemetry invisibly' },
                  { id: 'student', label: 'Student State Engine Workspace', d1: 'Enter locked content nodes via layout triggers', d2: 'Verify attendance records using localized marker scans', d3: 'Transition step-by-step to compile verification tokens' }
                ].map((tab) => (
                  <div
                    key={tab.id}
                    className={`showcase-tab ${activeShowcase === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveShowcase(tab.id)}
                    style={{ padding: 20, borderRadius: '0 12px 12px 0' }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: activeShowcase === tab.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>{tab.label}</div>
                    {activeShowcase === tab.id && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)', animation: 'slideIn 0.3s ease' }}>
                        {[tab.d1, tab.d2, tab.d3].map((d, i) => <div key={i}>▪ {d}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="showcase-card" style={{
                background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 24,
                padding: 40, minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                transform: 'perspective(1200px) rotateY(-3deg) rotateX(2deg)',
                boxShadow: 'var(--glass-shadow)'
              }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, opacity: 0.04, backgroundImage: 'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div style={{ position: 'absolute', top: 16, right: 20, fontFamily: font.mono, fontSize: 10, color: 'var(--text-muted)' }}>V2 ARCHITECTURE BLOCK</div>

                {activeShowcase === 'admin' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideIn 0.3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)' }}><Layers size={14} /><span style={{ fontFamily: font.mono, fontSize: 11 }}>SYSTEM ADMIN DATAControl</span></div>
                    <h3 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Global Configuration & Publishing</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>Track and maintain all core structures through append-only registers. System administrators initialize active course variables, manage routing configurations, and map layouts with zero dependencies.</p>
                  </div>
                )}
                {activeShowcase === 'ghost' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideIn 0.3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a78bfa' }}><UserCheck size={14} /><span style={{ fontFamily: font.mono, fontSize: 11 }}>SHADOW MANIFEST</span></div>
                    <h3 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Shadow Content Visibility</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>Access target metrics and instruction matrix parameters completely decoupled from ongoing student session paths. Invisible layout tokens load structures cleanly without mutating runtime operational logs.</p>
                  </div>
                )}
                {activeShowcase === 'student' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideIn 0.3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)' }}><Monitor size={14} /><span style={{ fontFamily: font.mono, fontSize: 11 }}>STATE PROGRESSION</span></div>
                    <h3 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Anti-Cheat Telemetry Engine</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>Transition sequentially through Reading, Watching, and Checklist confirmations. Active telemetry heartbeats validate real-time workspace focus before generating execution proofs.</p>
                  </div>
                )}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── BENTO FEATURE GRID ────────────────────────────────────────── */}
        <section id="features" style={{ width: '100%', padding: '80px 24px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <ScrollReveal>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.15em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 12 }}>ENGINE MODULES</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Everything needed to run a modern lab.</h2>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <ScrollReveal delay="0s">
              <BentoCard3D style={{ height: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)', marginBottom: 16 }}><Scan size={18} /></div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Hardware Marker Binding</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Every station maps directly to an active layout key. Admin configuration triggers initialization logic within the core engine pipeline.</p>
              </BentoCard3D>
            </ScrollReveal>

            <ScrollReveal delay="0.1s">
              <BentoCard3D style={{ height: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-green)', marginBottom: 16 }}><Activity size={18} /></div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Strict State Transition</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Enforce strict workflow stages. Skipping required instructions or checklist steps is blocked on the API level.</p>
              </BentoCard3D>
            </ScrollReveal>

            <ScrollReveal delay="0.2s">
              <BentoCard3D style={{ height: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)', marginBottom: 16 }}><Users size={18} /></div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Isolated Student Sessions</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Track metrics directly on a granular canvas. Student session records preserve completely verified logs natively.</p>
              </BentoCard3D>
            </ScrollReveal>

            <ScrollReveal delay="0.3s">
              <BentoCard3D style={{ height: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-warning)', marginBottom: 16 }}><CheckSquare size={18} /></div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Checklist Criteria Proof</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Students sign off on detailed preparation tasks. Replaces old media uploads with precise, secure step completion logic.</p>
              </BentoCard3D>
            </ScrollReveal>

            <ScrollReveal delay="0.4s" style={{ gridColumn: '1 / -1' }}>
              <BentoCard3D style={{ display: 'flex', flexDirection: 'row', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', flexShrink: 0 }}><Lock size={18} /></div>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Cryptographic Token Verification</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Successful state completion builds a secure verification token based entirely on validated user engagement events.</p>
                </div>
              </BentoCard3D>
            </ScrollReveal>
          </div>
        </section>

        {/* ── WORKFLOW ──────────────────────────────────────────────────── */}
        <section id="workflow" style={{ width: '100%', padding: '80px 24px', maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <ScrollReveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.15em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 12 }}>SYSTEM LOGIC PIPELINE</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>From configuration to validation.</h2>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, position: 'relative' }}>
            <svg style={{ position: 'absolute', top: 36, left: '12%', width: '76%', height: 4, zIndex: 0, display: 'var(--display-desktop, block)' }} fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="2" x2="100%" y2="2" stroke="var(--border-color)" strokeWidth="2" strokeDasharray="6 6" />
              <line x1="0" y1="2" x2="100%" y2="2" stroke="url(#flowGrad)" strokeWidth="2" strokeDasharray="8 12" style={{ animation: 'flowAnimation 2s linear infinite' }} />
              <defs>
                <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>

            {[
              { role: 'Admin',    tag: 'MAINTAIN & LOCK', desc: 'Sets up core entities, manages variables, and locks instruction nodes directly.', icon: '⚙️', color: 'var(--accent-blue)' },
              { role: 'Ghosts',   tag: 'SHADOW MATRIX',   desc: 'Inspects real-time content vectors securely with zero permanent track signatures.', icon: '🔒', color: '#a78bfa' },
              { role: 'Students', tag: 'ENGAGEMENT',      desc: 'Process structured layout paths while system evaluates active metrics.', icon: '📱', color: 'var(--accent-green)' },
              { role: 'System',   tag: 'TOKEN SIGN',      desc: 'Generates secure cryptographic tokens instantly upon milestone validation.', icon: '⚡', color: 'var(--accent-warning)' }
            ].map((node, i) => (
              <ScrollReveal key={i} delay={`${i * 0.15}s`}>
                <IsoNode {...node} delay={`${i * 0.15}s`} />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── ARUCO SCANNER SHOWCASE ────────────────────────────────────── */}
        <section style={{ width: '100%', padding: '80px 24px', background: 'rgba(255,255,255,0.003)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 64, alignItems: 'start' }}>
            <ScrollReveal direction="left">
              <div>
                <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.15em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 12 }}>CRITERIA ENFORCEMENT</div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 20 }}>Validation built for laboratories.</h2>
                <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 32 }}>LabScan shifts validation logic directly onto the API backend. Telemetry pipelines evaluate layout models before processing state advancements.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                  {[
                    { t: 'Isolated Routing Keys', d: 'Connects layout vectors safely to target user instruction blocks.' },
                    { t: 'Active Window Telemetry',d: 'Evaluates focus switches, time metrics, and strict student click analytics.' },
                    { t: 'Immutable State Paths',  d: 'Rejects incomplete structural updates or skipped milestones on API checks.' },
                    { t: 'Cryptographic Completion', d: 'Constructs verified tokens directly out of verified session events.' }
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--accent-blue)' }}>✔</span> {item.t}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div className="scanner-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 460 }}>
                <OrbitalScanner />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── DEPARTMENTS ───────────────────────────────────────────────── */}
        <section id="departments" style={{ width: '100%', padding: '80px 24px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <ScrollReveal>
            <div style={{ textAlign: 'center', marginBottom: 54 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.15em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 12 }}>DEPARTMENTS</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Built for every department.</h2>
            </div>
          </ScrollReveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { d: 'Computer Science',   ex: '24 Layout Manifests' },
              { d: 'Electronics (ECE)',  ex: '16 Layout Manifests' },
              { d: 'Electrical (EEE)',   ex: '12 Layout Manifests' },
              { d: 'Mechanical',         ex: '14 Layout Manifests' },
              { d: 'Civil',              ex: '10 Layout Manifests' },
              { d: 'Chemical',           ex: '8 Layout Manifests'  }
            ].map((item, i) => (
              <ScrollReveal key={i} delay={`${i * 0.05}s`}>
                <div style={{
                  padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%',
                  background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 20,
                  transition: 'var(--transition-fast)'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 12 }}>⚙️</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{item.d}</div>
                  <div style={{ fontSize: 11, fontFamily: font.mono, color: 'var(--text-muted)' }}>{item.ex}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ── CREATOR SECTION ─────────────────────────────────────────── */}
        <section id="creator" style={{ width: '100%', padding: '100px 24px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', position: 'relative', zIndex: 1, transition: 'background 0.3s ease' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 64, alignItems: 'start' }}>
            
            {/* Left Column — Startup Portrait Hub */}
            <ScrollReveal direction="left">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  position: 'relative', width: 300, height: 360,
                  borderRadius: 24, padding: 12,
                  transform: 'perspective(1000px) rotateY(6deg) rotateX(3deg)',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--glass-shadow)',
                  animation: 'float3d 7s ease-in-out infinite'
                }}>
                  {/* Dynamic Cyan Aura Glow Backdrops */}
                  <div style={{ position: 'absolute', inset: -4, borderRadius: 28, padding: 2, background: 'linear-gradient(135deg, #06b6d4, transparent, #3b82f6)', opacity: isDark ? 0.8 : 0.4, zIndex: 0, animation: 'auraGlow 4s ease-in-out infinite' }} />
                  
                  <div style={{ width: '100%', height: '100%', background: isDark ? '#050c14' : '#f1f5f9', borderRadius: 16, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                    <img src="/profile.jpeg" alt="Deva Harsha Veerla" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDark ? 0.9 : 1.0 }} />
                    
                    {/* Micro Badge Link */}
                    <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(6, 182, 212, 0.15)', backdropFilter: 'blur(12px)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(6,182,212,0.3)' }}>
                      <div style={{ fontFamily: font.mono, fontSize: 8, color: '#06b6d4', fontWeight: 700, letterSpacing: '0.05em' }}>YC W26 PATTERN</div>
                    </div>
                  </div>
                </div>

                {/* Mini Metrics Showcase Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: 300, marginTop: 24 }}>
                  <div style={{ padding: '14px', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 12, textAlign: 'center' }}>
                    <div style={{ fontFamily: font.mono, fontSize: 16, fontWeight: 700, color: '#06b6d4' }}>120+</div>
                    <div style={{ fontSize: 8, fontFamily: font.mono, color: 'var(--text-muted)', marginTop: 2 }}>LEETCODE SOLVED</div>
                  </div>
                  <div style={{ padding: '14px', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 12, textAlign: 'center' }}>
                    <div style={{ fontFamily: font.mono, fontSize: 16, fontWeight: 700, color: 'var(--accent-green)' }}>API-First</div>
                    <div style={{ fontSize: 8, fontFamily: font.mono, color: 'var(--text-muted)', marginTop: 2 }}>ARCHITECTURE</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Right Column — Founder Narrative Frame */}
            <ScrollReveal direction="right">
              <div style={{ position: 'relative' }}>
                
                {/* Trust Badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 100, marginBottom: 20 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)' }} />
                  <span style={{ fontFamily: font.mono, fontSize: 9, color: 'var(--accent-blue)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Built for scale, maintained by admin</span>
                </div>

                <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.15em', color: '#06b6d4', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>LEAD DEVELOPER STATEMENT</div>
                
                {/* Quote-style Headline */}
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 'clamp(24px, 3.5vw, 40px)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 28 }}>
                  “Engineering labs shouldn't run on loose paper maps and broken spreadsheets.”
                </h2>

                <div style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p>I upgraded LabScan to decoupled v2 modules because institutional setups require structural execution proof systems. I minimized middle-tier management entirely: Admins fully govern institutional layouts, leaving standard operational access strictly to Students and Ghost inspecting terminals.</p>
                  <p>As a full-stack engineer working in Next.js, React, and TypeScript, I rewrote the tracking matrices so that content validation occurs securely via secure hardware keys natively.</p>
                </div>

                {/* Signature + Profile Footer Wrapper */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
                  <div>
                    {/* Cursive Signature */}
                    <div style={{ fontFamily: "'Herr Von Muellerhoff', cursive", fontSize: 54, color: '#06b6d4', lineHeight: 0.6, opacity: 0.85, marginBottom: 8, userSelect: 'none' }}>
                      Deva Harsha Veerla
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Deva Harsha Veerla</div>
                    <div style={{ fontSize: 11, fontFamily: font.mono, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lead Full-Stack Engineer</div>
                  </div>

                  {/* Social links */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { label: 'GitHub',    href: 'https://github.com/deva-harsha-v' },
                      { label: 'LinkedIn',  href: 'https://linkedin.com/in/devaharshaveerla' },
                      { label: 'Portfolio', href: 'https://devaharshadev.netlify.app/' }
                    ].map((link, i) => (
                      <a key={i} href={link.href} target="_blank" rel="noreferrer" className="navlink" style={{
                        background: 'var(--glass-bg)', border: '1px solid var(--border-color)',
                        padding: '10px 18px', borderRadius: 10, transition: 'var(--transition-fast)', fontSize: 11
                      }}>{link.label}</a>
                    ))}
                  </div>
                </div>

              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
        <section style={{ width: '100%', padding: '100px 24px 140px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'absolute', bottom: '5%', left: '50%', transform: 'translateX(-50%) perspective(400px) rotateX(60deg)', width: 600, height: 100, background: 'radial-gradient(ellipse, rgba(56,189,248,0.15) 0%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

          <ScrollReveal>
            <div className="final-cta-card" style={{
              display: 'inline-block', padding: '64px 40px',
              border: '1px solid var(--border-color)', borderRadius: 32,
              background: 'linear-gradient(180deg, rgba(56,189,248,0.025), transparent)',
              backdropFilter: 'blur(24px)', width: '100%', maxWidth: 800, position: 'relative', zIndex: 1,
              transform: 'perspective(1200px) rotateX(2deg)',
              boxShadow: 'var(--glass-shadow)'
            }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 'clamp(24px, 3.5vw, 36px)', letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 14 }}>Ready to modernize your laboratory workflow?</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 36, maxWidth: 460, margin: '0 auto 36px', lineHeight: 1.5 }}>Deploy the system architecture across your department. Start using LabScan today.</p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="glowbtn" onClick={() => navigate('/scan-simulator')} style={{ ...BTN_BASE, padding: '14px 36px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))', borderRadius: 12, color: '#ffffff', fontWeight: 700, fontSize: 13 }}>Open Scanner Simulator</button>
                <button className="glowbtn" onClick={() => navigate('/login')} style={{ ...BTN_BASE, padding: '14px 32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Student Dashboard</button>
                <button className="glowbtn" onClick={() => navigate('/admin/login')} style={{ ...BTN_BASE, padding: '14px 32px', background: 'rgba(59,130,246,0.1)', border: '1px solid var(--accent-blue)', borderRadius: 12, color: 'var(--accent-blue)', fontWeight: 700, fontSize: 13 }}>Admin Portal</button>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <footer style={{ width: '100%', borderTop: '1px solid var(--border-color)', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 24, background: isDark ? '#01030a' : '#f1f5f9', position: 'relative', zIndex: 1, transition: 'background 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', fontFamily: "'Syne', sans-serif" }}>LabScan</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: font.mono }}>EVENT-DRIVEN LAB LEARNING PLATFORM</div>
            </div>
            <div style={{ display: 'flex', gap: 40 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: font.mono, fontSize: 11, color: 'var(--text-primary)', fontWeight: 700 }}>STRUCTURE</span>
                <span className="navlink" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</span>
                <span className="navlink" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>Workflow</span>
                <span className="navlink" onClick={() => document.getElementById('creator')?.scrollIntoView({ behavior: 'smooth' })}>Creator Story</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: font.mono, fontSize: 11, color: 'var(--text-primary)', fontWeight: 700 }}>NETWORKS</span>
                <a href="https://github.com/deva-harsha-v" target="_blank" rel="noreferrer" className="navlink">GitHub</a>
                <a href="https://linkedin.com/in/devaharshaveerla" target="_blank" rel="noreferrer" className="navlink">LinkedIn</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 20, fontSize: 11, fontFamily: font.mono, color: 'var(--text-muted)' }}>
            <span>© 2026 LabScan. All rights reserved.</span>
            <span>Built by Deva Harsha Veerla</span>
          </div>
        </footer>

      </div>
    </>
  );
}