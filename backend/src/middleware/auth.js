const jwt = require('jsonwebtoken');
const db = require('../config/db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const token = req.cookies?.accessToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token.' });
    }

    try {
      // Look up current_session_id in the database to verify if user session was invalidated
      const dbUsers = await db.query('SELECT current_session_id FROM users WHERE user_id = ?', [user.user_id]);
      if (dbUsers.length === 0) {
        return res.status(401).json({ error: 'Account not found.' });
      }

      const activeSessionId = dbUsers[0].current_session_id;

      // Only reject if both token session_id and DB current_session_id exist but don't match
      if (user.session_id && activeSessionId && user.session_id !== activeSessionId) {
        return res.status(401).json({ 
          error: 'Session invalidated. You have been logged out because your account was accessed on another device.',
          code: 'SESSION_INVALIDATED'
        });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Error validating single session in auth middleware:', dbErr);
      return res.status(500).json({ error: 'Internal server error validating session.' });
    }
  });
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions.' });
    }
    next();
  };
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const token = req.cookies?.accessToken || headerToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = decoded;
    } catch (err) {
      // Ignore token decode/verification errors for optional authentication path
    }
  }
  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
};
