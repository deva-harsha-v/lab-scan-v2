const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { validateBody, labSchema } = require('../utils/validators');

// GET /api/labs - Accessible to all (Admins, Students, Ghost/unauthenticated)
router.get('/', optionalAuth, async (req, res) => {
  let studentBranchId = null;
  const userRole = req.user?.role;

  if (userRole === 'student') {
    try {
      // Fetch student branch_id from DB
      const users = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [req.user.user_id]);
      if (users.length > 0) {
        studentBranchId = users[0].branch_id;
      }
    } catch (e) {
      console.error('Error fetching student branch optional details:', e);
    }
  }

  try {
    let labs;
    if (userRole === 'student' && studentBranchId) {
      // Filter labs assigned to student's branch
      labs = await db.query(`
        SELECT DISTINCT l.* FROM labs l
        INNER JOIN lab_branches lb ON l.lab_id = lb.lab_id
        WHERE lb.branch_id = ?
        ORDER BY l.created_at DESC
      `, [studentBranchId]);
    } else {
      labs = await db.query('SELECT * FROM labs ORDER BY created_at DESC');
    }
    
    // For each lab, fetch its allowed branches list
    const labsWithBranches = [];
    for (const lab of labs) {
      const allowed = await db.query('SELECT branch_id FROM lab_branches WHERE lab_id = ?', [lab.lab_id]);
      lab.allowed_branches = allowed.map(a => a.branch_id);
      labsWithBranches.push(lab);
    }

    res.json(labsWithBranches);
  } catch (err) {
    console.error('Error fetching labs:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/labs - Admin only
router.post('/', authenticateToken, requireRole(['admin']), validateBody(labSchema), async (req, res) => {
  const { lab_name, description, location, allowed_branches } = req.body;

  try {
    const labId = crypto.randomUUID();
    
    await db.executeTransaction(async (conn) => {
      await conn.query(
        'INSERT INTO labs (lab_id, lab_name, description, location, admin_id) VALUES (?, ?, ?, ?, ?)',
        [labId, lab_name, description || '', location || 'Block 4, Room 302', req.user.user_id]
      );

      // Insert allowed branches if provided
      if (allowed_branches && Array.isArray(allowed_branches)) {
        for (const branchId of allowed_branches) {
          await conn.query(
            'INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)',
            [labId, branchId]
          );
        }
      }
    });

    // Audit logging
    await logAction(req.user.user_id, 'CREATE_LAB', 'LAB', labId, { lab_name, location, allowed_branches });

    res.status(201).json({
      message: 'Lab created successfully.',
      lab: { lab_id: labId, lab_name, description, location: location || 'Block 4, Room 302', admin_id: req.user.user_id, allowed_branches }
    });
  } catch (err) {
    console.error('Error creating lab:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/labs/:id - Admin only
router.put('/:id', authenticateToken, requireRole(['admin']), validateBody(labSchema), async (req, res) => {
  const labId = req.params.id;
  const { lab_name, description, location, allowed_branches } = req.body;

  try {
    // Check if exists
    const labs = await db.query('SELECT * FROM labs WHERE lab_id = ?', [labId]);
    if (labs.length === 0) {
      return res.status(404).json({ error: 'Lab not found.' });
    }

    const oldLab = labs[0];
    
    await db.executeTransaction(async (conn) => {
      await conn.query(
        'UPDATE labs SET lab_name = ?, description = ?, location = ? WHERE lab_id = ?',
        [lab_name, description || '', location || oldLab.location || 'Block 4, Room 302', labId]
      );

      // Update allowed branches: delete existing and insert new
      await conn.query('DELETE FROM lab_branches WHERE lab_id = ?', [labId]);
      if (allowed_branches && Array.isArray(allowed_branches)) {
        for (const branchId of allowed_branches) {
          await conn.query(
            'INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)',
            [labId, branchId]
          );
        }
      }
    });

    // Audit logging
    await logAction(req.user.user_id, 'UPDATE_LAB', 'LAB', labId, {
      old: { lab_name: oldLab.lab_name, description: oldLab.description, location: oldLab.location },
      new: { lab_name, description, location, allowed_branches }
    });

    res.json({ message: 'Lab updated successfully.' });
  } catch (err) {
    console.error('Error updating lab:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/labs/:id - Admin only
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const labId = req.params.id;

  try {
    // Check if exists
    const labs = await db.query('SELECT * FROM labs WHERE lab_id = ?', [labId]);
    if (labs.length === 0) {
      return res.status(404).json({ error: 'Lab not found.' });
    }

    const lab = labs[0];
    
    // In MySQL schema, labs is set to ON DELETE RESTRICT for foreign keys.
    // So if experiments exist, deletion will fail. Let's handle this cleanly:
    const experiments = await db.query('SELECT COUNT(*) as count FROM experiments WHERE lab_id = ?', [labId]);
    if (experiments[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete lab. It contains active experiments. Delete the experiments first.' });
    }

    await db.query('DELETE FROM labs WHERE lab_id = ?', [labId]);

    // Audit logging
    await logAction(req.user.user_id, 'DELETE_LAB', 'LAB', labId, { lab_name: lab.lab_name });

    res.json({ message: 'Lab deleted successfully.' });
  } catch (err) {
    console.error('Error deleting lab:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
