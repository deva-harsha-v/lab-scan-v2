const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// GET /api/institutions - Get institution details (Accessible to all)
router.get('/', async (req, res) => {
  try {
    const list = await db.query('SELECT * FROM institutions LIMIT 1');
    if (list.length === 0) {
      // Return a default placeholder if not seeded
      return res.json({
        institution_id: 'default-inst-id',
        name: 'St. Jude Academic University',
        short_name: 'SJU',
        logo: ''
      });
    }
    res.json(list[0]);
  } catch (err) {
    console.error('Error fetching institution:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/institutions - Admin only, update institution details
router.put('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { name, short_name, logo } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Institution name is required.' });
  }

  try {
    const list = await db.query('SELECT * FROM institutions LIMIT 1');
    
    if (list.length === 0) {
      // Create new
      const instId = crypto.randomUUID();
      await db.query(
        'INSERT INTO institutions (institution_id, name, short_name, logo) VALUES (?, ?, ?, ?)',
        [instId, name, short_name || '', logo || '']
      );
      
      // Update all users without institution_id to this new one
      await db.query('UPDATE users SET institution_id = ?', [instId]);
      
      await logAction(req.user.user_id, 'CREATE_INSTITUTION', 'INSTITUTION', instId, { name });
    } else {
      const inst = list[0];
      await db.query(
        'UPDATE institutions SET name = ?, short_name = ?, logo = ? WHERE institution_id = ?',
        [name, short_name || '', logo || '', inst.institution_id]
      );
      
      await logAction(req.user.user_id, 'UPDATE_INSTITUTION', 'INSTITUTION', inst.institution_id, {
        old: { name: inst.name, short_name: inst.short_name, logo: inst.logo },
        new: { name, short_name, logo }
      });
    }

    res.json({ message: 'Institution details updated successfully.' });
  } catch (err) {
    console.error('Error updating institution:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
