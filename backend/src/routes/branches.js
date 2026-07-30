const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const { validateBody, branchSchema } = require('../utils/validators');

// GET /api/branches - List all branches (Accessible to all)
router.get('/', async (req, res) => {
  try {
    const branches = await db.query('SELECT * FROM branches ORDER BY name ASC');
    res.json(branches);
  } catch (err) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/branches - Admin only
router.post('/', authenticateToken, requireRole(['admin']), validateBody(branchSchema), async (req, res) => {
  const { name } = req.body;

  try {
    const branchId = crypto.randomUUID();
    await db.query(
      'INSERT INTO branches (branch_id, name) VALUES (?, ?)',
      [branchId, name]
    );

    // Audit log
    await logAction(req.user.user_id, 'CREATE_BRANCH', 'BRANCH', branchId, { name });

    res.status(201).json({
      message: 'Branch created successfully.',
      branch: { branch_id: branchId, name }
    });
  } catch (err) {
    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Branch name already exists.' });
    }
    console.error('Error creating branch:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/branches/:id - Admin only
router.put('/:id', authenticateToken, requireRole(['admin']), validateBody(branchSchema), async (req, res) => {
  const branchId = req.params.id;
  const { name } = req.body;

  try {
    const branches = await db.query('SELECT * FROM branches WHERE branch_id = ?', [branchId]);
    if (branches.length === 0) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const oldName = branches[0].name;

    await db.query('UPDATE branches SET name = ? WHERE branch_id = ?', [name, branchId]);

    // Audit log
    await logAction(req.user.user_id, 'UPDATE_BRANCH', 'BRANCH', branchId, { old_name: oldName, new_name: name });

    res.json({ message: 'Branch updated successfully.' });
  } catch (err) {
    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Another branch with this name already exists.' });
    }
    console.error('Error updating branch:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/branches/:id - Admin only
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const branchId = req.params.id;

  try {
    const branches = await db.query('SELECT * FROM branches WHERE branch_id = ?', [branchId]);
    if (branches.length === 0) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const branch = branches[0];

    // Check if any users belong to this branch
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users WHERE branch_id = ?', [branchId]);
    if (usersCount[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete branch. Student accounts are currently enrolled in this branch.' });
    }

    await db.query('DELETE FROM branches WHERE branch_id = ?', [branchId]);

    // Audit log
    await logAction(req.user.user_id, 'DELETE_BRANCH', 'BRANCH', branchId, { name: branch.name });

    res.json({ message: 'Branch deleted successfully.' });
  } catch (err) {
    console.error('Error deleting branch:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
