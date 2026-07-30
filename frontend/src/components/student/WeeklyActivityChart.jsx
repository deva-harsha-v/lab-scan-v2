import React from 'react';
import GlassCard from '../bento/GlassCard';

export default function WeeklyActivityChart({ history = [], font = { mono: 'monospace' } }) {
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  
  history.forEach(item => {
    if (item.session_started_at || item.session_completed_at) {
      const d = new Date(item.session_completed_at || item.session_started_at);
      const dayIdx = d.getDay();
      dayCounts[dayIdx]++;
    }
  });
  
  const maxDayCount = Math.max(...dayCounts, 1);

  return (
    <div className="bento-card-full">
      <GlassCard style={{ textAlign: 'left' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Weekly Work Session Activity</h3>
        <div className="analytics-bar-chart">
          {daysOfWeek.map((day, idx) => {
            const count = dayCounts[idx];
            const heightPct = count > 0 ? Math.max(15, Math.round((count / maxDayCount) * 100)) : 4;
            return (
              <div key={day} className="analytics-column-wrap">
                <div 
                  className="analytics-bar" 
                  style={{ 
                    height: `${heightPct}%`, 
                    background: count > 0 ? 'var(--accent-blue)' : 'rgba(255,255,255,0.08)' 
                  }} 
                />
                <div className="analytics-bar-label">
                  {day}<br/>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({count})</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ height: '24px' }} />
      </GlassCard>
    </div>
  );
}
