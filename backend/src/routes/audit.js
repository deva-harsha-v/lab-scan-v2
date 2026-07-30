const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/audit-logs - Admin only, fetch audit logs ordered by timestamp
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const logs = await db.query(
      `SELECT al.*, u.username as actor_username
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.user_id
       ORDER BY al.timestamp DESC`
    );

    // Parse JSON details
    const parsedLogs = logs.map(log => {
      return {
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
      };
    });

    res.json(parsedLogs);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
