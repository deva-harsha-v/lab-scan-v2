const crypto = require('crypto');
const db = require('../config/db');

async function logAction(actorId, actionType, targetType, targetId, details) {
  try {
    const logId = crypto.randomUUID();
    const detailsStr = details ? JSON.stringify(details) : null;
    
    await db.query(
      `INSERT INTO audit_logs (log_id, actor_id, action_type, target_type, target_id, details) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, actorId, actionType, targetType, targetId, detailsStr]
    );
    info(`[AUDIT LOG] Action: ${actionType} | Actor: ${actorId} | Target: ${targetType} (${targetId})`);
  } catch (err) {
    error('Failed to write audit log to database:', err);
  }
}

function info(message, meta = {}) {
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
  } else {
    console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : '');
  }
}

function warn(message, meta = {}) {
  if (process.env.NODE_ENV === 'production') {
    console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
  } else {
    console.warn(`[WARN] ${message}`, Object.keys(meta).length ? meta : '');
  }
}

function error(message, err = null, meta = {}) {
  const errorDetails = err ? { error: err.message, stack: err.stack } : {};
  if (process.env.NODE_ENV === 'production') {
    console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, ...errorDetails, ...meta }));
  } else {
    console.error(`[ERROR] ${message}`, err || '', Object.keys(meta).length ? meta : '');
  }
}

module.exports = {
  logAction,
  info,
  warn,
  error
};
