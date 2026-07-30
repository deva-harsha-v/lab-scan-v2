import React, { useState, useEffect, useRef } from 'react';
import GlassCard from './GlassCard';

export default function GreetingHero({ name = 'Academic User', department = '' }) {
  const [timeStr, setTimeStr] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let offset = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      
      const width = canvas.width;
      const height = canvas.height;
      const mid = height * 0.7;

      ctx.moveTo(0, mid);
      for (let x = 0; x <= width; x += 10) {
        const y = mid + Math.sin(x * 0.01 + offset) * 15 + Math.cos(x * 0.02 + offset * 0.5) * 5;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      offset += 0.02;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Determine greeting based on local hours
  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good Morning' : hours < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <GlassCard className="greeting-hero-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px', position: 'relative' }}>
      <canvas ref={canvasRef} className="sparkline-canvas" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', zIndex: 2 }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            {greeting},
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>
            {name}
          </h2>
          {department && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {department}
            </p>
          )}
        </div>
        <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(56, 189, 248, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
          {timeStr}
        </div>
      </div>

      <div style={{ zIndex: 2, fontSize: '13px', color: 'var(--text-muted)' }}>
        Stay focused and make it happen.
      </div>
    </GlassCard>
  );
}
