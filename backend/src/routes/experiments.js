const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { validateBody, experimentSchema } = require('../utils/validators');

const { executeTransaction } = db;


// GET /api/experiments/by-marker/:markerId - Scan resolver (unauthenticated)
router.get('/by-marker/:markerId', async (req, res) => {
  const markerId = parseInt(req.params.markerId, 10);
  if (isNaN(markerId)) {
    return res.status(400).json({ error: 'Marker ID must be an integer.' });
  }
  try {
    const experiments = await db.query(
      `SELECT e.*, l.lab_name 
       FROM experiments e 
       JOIN labs l ON e.lab_id = l.lab_id 
       WHERE e.ar_qr_marker_id = ?`,
      [markerId]
    );

    if (experiments.length === 0) {
      return res.status(404).json({ error: 'No experiment found matching this marker ID.' });
    }

    res.json(experiments[0]);
  } catch (err) {
    console.error('Error finding experiment by marker:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/experiments - List experiments by Lab ID (unauthenticated/authenticated)
router.get('/', optionalAuth, async (req, res) => {
  const labId = req.query.labId;
  
  let branchIdToFilter = null;

  if (req.user) {
    try {
      const users = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [req.user.user_id]);
      if (users.length > 0) {
        branchIdToFilter = users[0].branch_id;
      }
    } catch (e) {
      console.error('Error fetching optional user branch details:', e);
    }
  }

  try {
    let queryStr = `
      SELECT e.*, l.lab_name, 
             (SELECT MAX(version_number) FROM experiment_content_versions ecv WHERE ecv.experiment_id = e.experiment_id) as latest_version
      FROM experiments e
      JOIN labs l ON e.lab_id = l.lab_id
    `;
    const params = [];

    if (branchIdToFilter) {
      queryStr += `
        INNER JOIN lab_branches lb ON l.lab_id = lb.lab_id
        WHERE lb.branch_id = ?
      `;
      params.push(branchIdToFilter);
      if (labId) {
        queryStr += ' AND e.lab_id = ?';
        params.push(labId);
      }
    } else {
      if (labId) {
        queryStr += ' WHERE e.lab_id = ?';
        params.push(labId);
      }
    }

    queryStr += ' ORDER BY e.created_at DESC';

    const experiments = await db.query(queryStr, params);
    res.json(experiments);
  } catch (err) {
    console.error('Error fetching experiments:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/experiments/:id - Fetch experiment details & contents
// Query parameter: ?versionId=XYZ (forces load of specific version, e.g. for student snapshot)
router.get('/:id', optionalAuth, async (req, res) => {
  const experimentId = req.params.id;
  const { versionId } = req.query;

  try {
    // 1. Get metadata
    const experiments = await db.query(
      `SELECT e.experiment_id, e.lab_id, e.experiment_name, e.description, e.ar_qr_marker_id, l.lab_name 
       FROM experiments e
       JOIN labs l ON e.lab_id = l.lab_id
       WHERE e.experiment_id = ?`,
       [experimentId]
    );

    if (experiments.length === 0) {
      return res.status(404).json({ error: 'Experiment not found.' });
    }

    const exp = experiments[0];

    // Enforce branch-based access control for students & scoped admins
    if (req.user) {
      try {
        const users = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [req.user.user_id]);
        if (users.length > 0 && users[0].branch_id) {
          const userBranchId = users[0].branch_id;
          const allowed = await db.query(`
            SELECT 1 FROM lab_branches 
            WHERE lab_id = ? AND branch_id = ?
          `, [exp.lab_id, userBranchId]);
          if (allowed.length === 0) {
            return res.status(403).json({ error: 'Access Denied: This laboratory module is not assigned to your academic branch.' });
          }
        }
      } catch (e) {
        console.error('Error in branch-based access verification:', e);
      }
    }

    // 2. Fetch specific version or latest version
    let versionRecord;
    if (versionId) {
      const versions = await db.query(
        'SELECT * FROM experiment_content_versions WHERE content_version_id = ? AND experiment_id = ?',
        [versionId, experimentId]
      );
      versionRecord = versions[0];
    } else {
      const versions = await db.query(
        'SELECT * FROM experiment_content_versions WHERE experiment_id = ? ORDER BY version_number DESC LIMIT 1',
        [experimentId]
      );
      versionRecord = versions[0];
    }

    if (!versionRecord) {
      return res.status(404).json({ error: 'Experiment content version not found.' });
    }

    // 3. Fetch checklist items for this version
    const checklistItems = await db.query(
      'SELECT * FROM checklist_items WHERE content_version_id = ? ORDER BY item_order ASC',
      [versionRecord.content_version_id]
    );

    res.json({
      experiment: exp,
      content: {
        content_version_id: versionRecord.content_version_id,
        version_number: versionRecord.version_number,
        theory_procedure_json: typeof versionRecord.theory_procedure_json === 'string' 
          ? JSON.parse(versionRecord.theory_procedure_json) 
          : versionRecord.theory_procedure_json,
        video_links: typeof versionRecord.video_links === 'string' 
          ? JSON.parse(versionRecord.video_links) 
          : versionRecord.video_links,
        checklist_items: checklistItems
      }
    });
  } catch (err) {
    console.error('Error fetching experiment detail:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

function validateVideoLinks(videoLinks) {
  if (!videoLinks || !Array.isArray(videoLinks)) return true;
  for (const vid of videoLinks) {
    if (!vid.url) continue;
    try {
      const parsedUrl = new URL(vid.url.trim());
      const host = parsedUrl.hostname.toLowerCase();
      const isAllowed = 
        host === 'youtube.com' || 
        host === 'www.youtube.com' || 
        host === 'youtu.be';
      if (!isAllowed) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  return true;
}

// POST /api/experiments - Admin only, create experiment & content version 1
router.post('/', authenticateToken, requireRole(['admin']), validateBody(experimentSchema), async (req, res) => {
  const { 
    lab_id, 
    experiment_name, 
    description, 
    ar_qr_marker_id,
    theory_procedure_json,
    video_links,
    checklist_items
  } = req.body;

  if (!lab_id) {
    return res.status(400).json({ error: 'Lab ID is required.' });
  }

  let adminBranchId = null;
  const userRes = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [req.user.user_id]);
  if (userRes.length > 0 && userRes[0].branch_id) {
    adminBranchId = userRes[0].branch_id;
  }
  if (adminBranchId) {
    const allowed = await db.query('SELECT 1 FROM lab_branches WHERE lab_id = ? AND branch_id = ?', [lab_id, adminBranchId]);
    if (allowed.length === 0) {
      return res.status(403).json({ error: 'Access Denied: You do not have permission to add experiments to this lab.' });
    }
  }

  if (!validateVideoLinks(video_links)) {
    return res.status(400).json({ error: 'Invalid video URL. Only YouTube and Google Drive links are allowed.' });
  }

  const markerInt = parseInt(ar_qr_marker_id, 10);

  try {
    const experimentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();

    const theory = theory_procedure_json || [{ type: "heading", text: "New Experiment" }];
    const videos = video_links || [];
    const checklist = checklist_items || [];

    await executeTransaction(async (conn) => {
      // 1. Insert Experiment
      await conn.query(
        'INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)',
        [experimentId, lab_id, experiment_name, description || '', markerInt]
      );

      // 2. Insert Version 1 Content
      await conn.query(
        'INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, 1, ?, ?)',
        [versionId, experimentId, JSON.stringify(theory), JSON.stringify(videos)]
      );

      // 3. Insert Checklist Items
      for (let i = 0; i < checklist.length; i++) {
        const itemText = checklist[i];
        if (itemText && itemText.trim()) {
          await conn.query(
            'INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)',
            [crypto.randomUUID(), versionId, itemText.trim(), i + 1]
          );
        }
      }
    });

    // Audit log
    await logAction(req.user.user_id, 'CREATE_EXPERIMENT', 'EXPERIMENT', experimentId, { 
      experiment_name, 
      ar_qr_marker_id 
    });

    res.status(201).json({
      message: 'Experiment and initial version created successfully.',
      experiment_id: experimentId
    });
  } catch (err) {
    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY' || err.message.includes('unique constraint') || err.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Marker ID is already assigned to another experiment.' });
    }
    console.error('Error creating experiment:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/experiments/:id - Admin only, update metadata and create new content version (if content changed)
router.put('/:id', authenticateToken, requireRole(['admin']), validateBody(experimentSchema), async (req, res) => {
  const experimentId = req.params.id;
  const {
    experiment_name,
    description,
    ar_qr_marker_id,
    theory_procedure_json,
    video_links,
    checklist_items
  } = req.body;

  if (!validateVideoLinks(video_links)) {
    return res.status(400).json({ error: 'Invalid video URL. Only YouTube and Google Drive links are allowed.' });
  }

  const markerInt = parseInt(ar_qr_marker_id, 10);

  try {
    // 1. Fetch current experiment
    const exps = await db.query('SELECT * FROM experiments WHERE experiment_id = ?', [experimentId]);
    if (exps.length === 0) {
      return res.status(404).json({ error: 'Experiment not found.' });
    }

    const oldExp = exps[0];

    let adminBranchId = null;
    const userRes = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [req.user.user_id]);
    if (userRes.length > 0 && userRes[0].branch_id) {
      adminBranchId = userRes[0].branch_id;
    }
    if (adminBranchId) {
      const allowed = await db.query(`
        SELECT 1 FROM lab_branches 
        WHERE lab_id = ? AND branch_id = ?
      `, [oldExp.lab_id, adminBranchId]);
      if (allowed.length === 0) {
        return res.status(403).json({ error: 'Access Denied: You do not have permission to edit experiments in this lab.' });
      }
    }

    // 2. Fetch current latest version
    const versions = await db.query(
      'SELECT * FROM experiment_content_versions WHERE experiment_id = ? ORDER BY version_number DESC LIMIT 1',
      [experimentId]
    );

    const latestVer = versions[0];
    const newVersionNumber = latestVer ? latestVer.version_number + 1 : 1;
    const newVersionId = crypto.randomUUID();

    // 3. Execute update in transaction
    await executeTransaction(async (conn) => {
      // Update metadata
      await conn.query(
        'UPDATE experiments SET experiment_name = ?, description = ?, ar_qr_marker_id = ? WHERE experiment_id = ?',
        [experiment_name, description || '', markerInt, experimentId]
      );

      // If content fields are provided, we create a new version of content
      if (theory_procedure_json && video_links && checklist_items) {
        // Insert new version record
        await conn.query(
          'INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)',
          [newVersionId, experimentId, newVersionNumber, JSON.stringify(theory_procedure_json), JSON.stringify(video_links)]
        );

        // Insert new checklist items linked to the new version ID
        for (let i = 0; i < checklist_items.length; i++) {
          const itemText = checklist_items[i];
          if (itemText && itemText.trim()) {
            await conn.query(
              'INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)',
              [crypto.randomUUID(), newVersionId, itemText.trim(), i + 1]
            );
          }
        }
      }
    });

    // Audit log
    await logAction(req.user.user_id, 'UPDATE_EXPERIMENT', 'EXPERIMENT', experimentId, {
      meta_updated: { experiment_name, ar_qr_marker_id: markerInt },
      content_version_bumped: (theory_procedure_json && video_links && checklist_items) ? newVersionNumber : false
    });

    res.json({ 
      message: 'Experiment updated successfully.',
      version_bumped: (theory_procedure_json && video_links && checklist_items) ? newVersionNumber : false
    });
  } catch (err) {
    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY' || err.message.includes('unique constraint') || err.message.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Marker ID is already assigned to another experiment.' });
    }
    console.error('Error updating experiment:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/experiments/:id - Admin only
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const experimentId = req.params.id;

  try {
    const exps = await db.query('SELECT * FROM experiments WHERE experiment_id = ?', [experimentId]);
    if (exps.length === 0) {
      return res.status(404).json({ error: 'Experiment not found.' });
    }

    const exp = exps[0];

    let adminBranchId = null;
    const userRes = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [req.user.user_id]);
    if (userRes.length > 0 && userRes[0].branch_id) {
      adminBranchId = userRes[0].branch_id;
    }
    if (adminBranchId) {
      const allowed = await db.query(`
        SELECT 1 FROM lab_branches 
        WHERE lab_id = ? AND branch_id = ?
      `, [exp.lab_id, adminBranchId]);
      if (allowed.length === 0) {
        return res.status(403).json({ error: 'Access Denied: You do not have permission to delete experiments in this lab.' });
      }
    }

    // Pre-check for session records to provide a friendly error message
    const sessions = await db.query('SELECT COUNT(*) as count FROM student_sessions WHERE experiment_id = ?', [experimentId]);
    if (sessions[0].count > 0) {
      return res.status(400).json({ error: 'This experiment has active or completed student worksheets and cannot be deleted for academic record retention.' });
    }

    await db.query('DELETE FROM experiments WHERE experiment_id = ?', [experimentId]);

    // Audit log
    await logAction(req.user.user_id, 'DELETE_EXPERIMENT', 'EXPERIMENT', experimentId, { 
      experiment_name: exp.experiment_name,
      ar_qr_marker_id: exp.ar_qr_marker_id 
    });

    res.json({ message: 'Experiment deleted successfully.' });
  } catch (err) {
    if (err.code === '23503' || err.code === '1451') {
      return res.status(400).json({ error: 'This experiment has active or completed student worksheets and cannot be deleted for academic record retention.' });
    }
    console.error('Error deleting experiment:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
