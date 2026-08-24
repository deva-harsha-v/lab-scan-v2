const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateBody, sessionStartSchema, sessionChecklistItemSchema, sessionQuestionnaireSubmissionSchema, sessionVerifyArucoSchema } = require('../utils/validators');
const { logAction } = require('../utils/logger');
const rateLimit = require('express-rate-limit');

const { executeTransaction } = db;

// Rate limiting: loose security profile (60 requests / 5 minutes) for high-frequency classroom sessions
const sessionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: 'Session rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.NODE_ENV === 'test'
});

// POST /api/sessions/start - Start or resume a session for a student
router.post('/start', sessionLimiter, authenticateToken, requireRole(['student']), validateBody(sessionStartSchema), async (req, res) => {
  const { experiment_id } = req.body;
  const studentId = req.user.user_id;

  try {
    // 1. Check if a session already exists
    const existing = await db.query(
      'SELECT * FROM student_sessions WHERE student_id = ? AND experiment_id = ?',
      [studentId, experiment_id]
    );

    if (existing.length > 0) {
      await logAction(studentId, 'RESUME_SESSION', 'SESSION', existing[0].session_id, { experiment_id });
      return res.json({
        message: 'Resuming existing session.',
        session: existing[0]
      });
    }

    // Verify branch access for this experiment
    const exps = await db.query('SELECT lab_id FROM experiments WHERE experiment_id = ?', [experiment_id]);
    if (exps.length === 0) {
      return res.status(404).json({ error: 'Experiment not found.' });
    }
    const labId = exps[0].lab_id;

    const userRes = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [studentId]);
    if (userRes.length > 0 && userRes[0].branch_id) {
      const studentBranchId = userRes[0].branch_id;
      const allowed = await db.query(
        'SELECT 1 FROM lab_branches WHERE lab_id = ? AND branch_id = ?',
        [labId, studentBranchId]
      );
      if (allowed.length === 0) {
        return res.status(403).json({ error: 'Access Denied: This experiment is not assigned to your academic branch.' });
      }
    }

    // 2. Fetch the latest content version for this experiment
    const versions = await db.query(
      'SELECT content_version_id FROM experiment_content_versions WHERE experiment_id = ? ORDER BY version_number DESC LIMIT 1',
      [experiment_id]
    );

    if (versions.length === 0) {
      return res.status(404).json({ error: 'No content versions found for this experiment. Admin has not populated content.' });
    }

    const contentVersionId = versions[0].content_version_id;

    // Check if there is an active (uncompleted) session for this experiment
    const activeSessions = await db.query(
      'SELECT * FROM student_sessions WHERE student_id = ? AND experiment_id = ? AND session_completed_at IS NULL',
      [studentId, experiment_id]
    );
    if (activeSessions.length > 0) {
      return res.status(200).json({
        message: 'Returning active session.',
        session: activeSessions[0]
      });
    }

    // Check if they already have a session for this specific version
    const completedSessions = await db.query(
      'SELECT * FROM student_sessions WHERE student_id = ? AND content_version_id = ?',
      [studentId, contentVersionId]
    );
    if (completedSessions.length > 0) {
      return res.status(200).json({
        message: 'Returning completed session for this version.',
        session: completedSessions[0]
      });
    }

    const sessionId = crypto.randomUUID();

    // 3. Create the session and initialize checklist progress in a transaction
    await executeTransaction(async (conn) => {
      // Atomic double-check inside transaction to avoid race condition double inserts
      const [doubleCheck] = await conn.query(
        'SELECT session_id FROM student_sessions WHERE student_id = ? AND content_version_id = ?',
        [studentId, contentVersionId]
      );
      if (doubleCheck && doubleCheck.length > 0) {
        return;
      }

      // Create student session
      await conn.query(
        `INSERT INTO student_sessions 
         (session_id, student_id, experiment_id, content_version_id, current_video_progress) 
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, studentId, experiment_id, contentVersionId, JSON.stringify({})]
      );

      // Fetch checklist items for this version
      const [items] = await conn.query(
        'SELECT checklist_item_id FROM checklist_items WHERE content_version_id = ?',
        [contentVersionId]
      );

      // Pre-populate checklist progress
      for (const item of items) {
        await conn.query(
          `INSERT INTO student_checklist_progress 
           (student_session_id, checklist_item_id, is_completed, completed_at) 
           VALUES (?, ?, ?, ?)`,
          [sessionId, item.checklist_item_id, false, null]
        );
      }
    });

    const newSession = await db.query('SELECT * FROM student_sessions WHERE session_id = ?', [sessionId]);
    
    // Log audit event
    await logAction(studentId, 'START_SESSION', 'SESSION', sessionId, { experiment_id });

    res.status(201).json({
      message: 'New session started successfully.',
      session: newSession[0]
    });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/sessions/verify-aruco - Verify ArUco marker scanned on lab bench
router.post('/verify-aruco', sessionLimiter, authenticateToken, requireRole(['student']), validateBody(sessionVerifyArucoSchema), async (req, res) => {
  const { experiment_id, scanned_marker_id } = req.body;
  const studentId = req.user.user_id;

  try {
    // 1. Verify the experiment has the expected marker ID
    const exps = await db.query('SELECT ar_qr_marker_id FROM experiments WHERE experiment_id = ?', [experiment_id]);
    if (exps.length === 0) {
      return res.status(404).json({ error: 'Experiment not found.' });
    }

    const expectedMarkerId = exps[0].ar_qr_marker_id;
    if (expectedMarkerId !== scanned_marker_id) {
      return res.status(400).json({ error: `Wrong marker scanned. Expected ArUco Marker #${expectedMarkerId}, got #${scanned_marker_id}.` });
    }

    // 2. Fetch the active session
    const sessions = await db.query(
      'SELECT session_id FROM student_sessions WHERE student_id = ? AND experiment_id = ? AND session_completed_at IS NULL',
      [studentId, experiment_id]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'No active session found for this experiment.' });
    }
    const sessionId = sessions[0].session_id;

    // 3. Mark ArUco verified
    await db.query(
      'UPDATE student_sessions SET aruco_verified_at = CURRENT_TIMESTAMP WHERE session_id = ?',
      [sessionId]
    );

    // 4. Log action
    await logAction(studentId, 'VERIFY_ARUCO', 'SESSION', sessionId, { experiment_id, scanned_marker_id });

    res.json({ message: 'ArUco marker verified successfully.' });
  } catch (err) {
    console.error('Error verifying ArUco marker:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/sessions/active/:experimentId - Get active session status for a student
router.get('/active/:experimentId', authenticateToken, requireRole(['student']), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const experimentId = req.params.experimentId;
  const studentId = req.user.user_id;
  const { sessionId } = req.query;

  try {
    let sessions;
    if (sessionId) {
      sessions = await db.query(
        'SELECT * FROM student_sessions WHERE student_id = ? AND session_id = ?',
        [studentId, sessionId]
      );
    } else {
      sessions = await db.query(
        'SELECT * FROM student_sessions WHERE student_id = ? AND experiment_id = ? AND session_completed_at IS NULL',
        [studentId, experimentId]
      );

      if (sessions.length === 0) {
        sessions = await db.query(
          'SELECT * FROM student_sessions WHERE student_id = ? AND experiment_id = ? ORDER BY session_started_at DESC LIMIT 1',
          [studentId, experimentId]
        );
      }
    }

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'No active session found for this experiment.' });
    }

    const session = sessions[0];

    // Auto-update / sync session to the latest content version if the admin has updated the experiment
    if (!session.session_completed_at) {
      const latestVersions = await db.query(
        'SELECT content_version_id FROM experiment_content_versions WHERE experiment_id = ? ORDER BY version_number DESC LIMIT 1',
        [experimentId]
      );
      if (latestVersions.length > 0 && latestVersions[0].content_version_id !== session.content_version_id) {
        const latestVersionId = latestVersions[0].content_version_id;

        await db.executeTransaction(async (conn) => {
          // 1. Update session to the latest content version
          await conn.query(
            'UPDATE student_sessions SET content_version_id = ? WHERE session_id = ?',
            [latestVersionId, session.session_id]
          );

          // 2. Fetch new version checklist items
          const [newChecklist] = await conn.query(
            'SELECT checklist_item_id FROM checklist_items WHERE content_version_id = ?',
            [latestVersionId]
          );

          // 3. Fetch old checklist progress text for mapping
          const [oldChecklist] = await conn.query(
            `SELECT ci.item_text, scp.is_completed, scp.completed_at
             FROM checklist_items ci
             JOIN student_checklist_progress scp ON ci.checklist_item_id = scp.checklist_item_id
             WHERE scp.student_session_id = ?`,
            [session.session_id]
          );

          // 4. Delete old progress states
          await conn.query(
            'DELETE FROM student_checklist_progress WHERE student_session_id = ?',
            [session.session_id]
          );

          // 5. Populate new progress states mapping matching text
          for (const item of newChecklist) {
            const [newItemDetails] = await conn.query(
              'SELECT item_text FROM checklist_items WHERE checklist_item_id = ?',
              [item.checklist_item_id]
            );
            const oldMatch = oldChecklist.find(oc => oc.item_text === newItemDetails[0].item_text);
            const isCompleted = oldMatch ? oldMatch.is_completed : false;
            const completedAt = oldMatch ? oldMatch.completed_at : null;

            await conn.query(
              `INSERT INTO student_checklist_progress 
               (student_session_id, checklist_item_id, is_completed, completed_at) 
               VALUES (?, ?, ?, ?)`,
              [session.session_id, item.checklist_item_id, isCompleted, completedAt]
            );
          }
        });

        session.content_version_id = latestVersionId;
      }
    }
    
    // Parse progress JSON
    session.current_video_progress = typeof session.current_video_progress === 'string'
      ? JSON.parse(session.current_video_progress)
      : session.current_video_progress;

    // Fetch checklist items and their progress states
    const checklistProgress = await db.query(
      `SELECT ci.checklist_item_id, ci.item_text, ci.item_order, scp.is_completed, scp.completed_at
       FROM checklist_items ci
       JOIN student_checklist_progress scp ON ci.checklist_item_id = scp.checklist_item_id
       WHERE scp.student_session_id = ?
       ORDER BY ci.item_order ASC`,
      [session.session_id]
    );

    // Fetch questionnaire items & student responses
    const questionnaireProgress = await db.query(
      `SELECT eqi.question_id, eqi.question_text, eqi.question_type, eqi.question_order,
              sqr.answer_boolean, sqr.answer_text, sqr.submitted_at
       FROM experiment_questionnaire_items eqi
       LEFT JOIN student_questionnaire_responses sqr ON eqi.question_id = sqr.question_id AND sqr.student_session_id = ?
       WHERE eqi.content_version_id = ?
       ORDER BY eqi.question_order ASC`,
      [session.session_id, session.content_version_id]
    );

    res.json({
      session,
      checklist: checklistProgress,
      questionnaire: questionnaireProgress
    });
  } catch (err) {
    console.error('Error fetching active session:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/sessions/progress - Update video elapsed time or complete a stage
router.put('/progress', sessionLimiter, authenticateToken, requireRole(['student']), async (req, res) => {
  const { session_id, stage, video_id, watched_seconds } = req.body;
  const studentId = req.user.user_id;

  if (!session_id) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    // Verify session ownership
    const sessions = await db.query('SELECT * FROM student_sessions WHERE session_id = ? AND student_id = ?', [session_id, studentId]);
    if (sessions.length === 0) {
      return res.status(403).json({ error: 'Unauthorized session access.' });
    }

    const session = sessions[0];

    if (session.session_completed_at || session.checklist_completed_at) {
      return res.status(400).json({ error: 'This experiment session is completed and read-only.' });
    }

    if (video_id && watched_seconds !== undefined) {
      // 1. Fetch content version video links to validate ID and min_duration
      const versions = await db.query(
        'SELECT video_links FROM experiment_content_versions WHERE content_version_id = ?',
        [session.content_version_id]
      );
      if (versions.length === 0) {
        return res.status(404).json({ error: 'Content version not found.' });
      }
      const videoLinks = typeof versions[0].video_links === 'string'
        ? JSON.parse(versions[0].video_links)
        : (versions[0].video_links || []);

      const video = videoLinks.find(v => v.id === video_id);
      if (!video) {
        return res.status(400).json({ error: 'Invalid video ID.' });
      }

      // 2. Validate format
      let seconds = parseFloat(watched_seconds);
      if (isNaN(seconds) || seconds < 0) {
        return res.status(400).json({ error: 'watched_seconds must be a non-negative number.' });
      }

      // 3. Update progress with clamping to prevent spoofing jumps
      const progress = typeof session.current_video_progress === 'string'
        ? JSON.parse(session.current_video_progress)
        : (session.current_video_progress || {});

      const prevProgress = parseFloat(progress[video_id] || '0');
      
      // Limit the increment to at most 15 seconds per sync to prevent instant skips
      if (seconds > prevProgress + 15) {
        seconds = prevProgress + 15;
      }

      // Clamp progress to maximum required min_duration
      if (seconds > video.min_duration) {
        seconds = video.min_duration;
      }

      progress[video_id] = seconds;

      await db.query(
        'UPDATE student_sessions SET current_video_progress = ? WHERE session_id = ?',
        [JSON.stringify(progress), session_id]
      );
    }

    if (stage) {
      const now = new Date();
      if (stage === 'learning') {
        if (!session.aruco_verified_at) {
          return res.status(400).json({ error: 'Cannot complete learning stage without verifying ArUco marker.' });
        }

        await db.query('UPDATE student_sessions SET learning_stage_completed_at = ? WHERE session_id = ?', [now, session_id]);
      } else if (stage === 'visual') {
        if (!session.learning_stage_completed_at) {
          return res.status(400).json({ error: 'Cannot complete visual stage before completing learning stage.' });
        }

        // Verify every video meets its required min_duration
        const versions = await db.query(
          'SELECT video_links FROM experiment_content_versions WHERE content_version_id = ?',
          [session.content_version_id]
        );
        if (versions.length === 0) {
          return res.status(404).json({ error: 'Content version not found.' });
        }
        const videoLinks = typeof versions[0].video_links === 'string'
          ? JSON.parse(versions[0].video_links)
          : (versions[0].video_links || []);

        const progress = typeof session.current_video_progress === 'string'
          ? JSON.parse(session.current_video_progress)
          : (session.current_video_progress || {});

        for (const video of videoLinks) {
          const watched = parseFloat(progress[video.id] || '0');
          if (watched < video.min_duration) {
            return res.status(400).json({
              error: `Cannot complete visual stage. Required video "${video.title}" must be watched for at least ${video.min_duration} seconds.`
            });
          }
        }

        await db.query('UPDATE student_sessions SET visual_stage_completed_at = ? WHERE session_id = ?', [now, session_id]);
      } else if (stage === 'checklist') {
        if (!session.visual_stage_completed_at) {
          return res.status(400).json({ error: 'Cannot complete checklist stage before completing visual stage.' });
        }
        const uncompleted = await db.query(
          'SELECT COUNT(*) as count FROM student_checklist_progress WHERE student_session_id = ? AND is_completed = false',
          [session_id]
        );
        if (parseInt(uncompleted[0].count, 10) > 0) {
          return res.status(400).json({ error: 'Cannot complete checklist stage. Some checklist items are not completed.' });
        }
        await db.query('UPDATE student_sessions SET checklist_completed_at = ? WHERE session_id = ?', [now, session_id]);
      } else if (stage === 'complete') {
        if (!session.checklist_completed_at) {
          return res.status(400).json({ error: 'Cannot complete session before completing checklist stage.' });
        }
        await db.query('UPDATE student_sessions SET session_completed_at = ? WHERE session_id = ?', [now, session_id]);
      }

      // Log audit event
      await logAction(studentId, 'COMPLETE_STAGE', 'SESSION', session_id, { stage, experiment_id: session.experiment_id });
    }

    res.json({ message: 'Session progress updated successfully.' });
  } catch (err) {
    console.error('Error updating session progress:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/sessions/checklist - Toggle checklist item completion
router.put('/checklist', sessionLimiter, authenticateToken, requireRole(['student']), validateBody(sessionChecklistItemSchema), async (req, res) => {
  const { session_id, checklist_item_id, is_completed } = req.body;
  const studentId = req.user.user_id;

  try {
    // Verify ownership
    const sessions = await db.query('SELECT * FROM student_sessions WHERE session_id = ? AND student_id = ?', [session_id, studentId]);
    if (sessions.length === 0) {
      return res.status(403).json({ error: 'Unauthorized session access.' });
    }

    if (sessions[0].session_completed_at || sessions[0].checklist_completed_at) {
      return res.status(400).json({ error: 'This experiment session is completed and read-only.' });
    }

    if (!sessions[0].visual_stage_completed_at) {
      return res.status(400).json({ error: 'Cannot update checklist progress before completing visual stage.' });
    }

    const itemCheck = await db.query(
      'SELECT 1 FROM student_checklist_progress WHERE student_session_id = ? AND checklist_item_id = ?',
      [session_id, checklist_item_id]
    );
    if (itemCheck.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found for this session.' });
    }

    const completedAt = is_completed ? new Date() : null;

    await db.query(
      `UPDATE student_checklist_progress 
       SET is_completed = ?, completed_at = ? 
       WHERE student_session_id = ? AND checklist_item_id = ?`,
      [is_completed ? true : false, completedAt, session_id, checklist_item_id]
    );

    // Log audit event
    await logAction(studentId, 'TOGGLE_CHECKLIST_ITEM', 'SESSION', session_id, { 
      checklist_item_id, 
      is_completed, 
      experiment_id: sessions[0].experiment_id 
    });

    res.json({ message: 'Checklist item updated.' });
  } catch (err) {
    console.error('Error updating checklist item:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/sessions/questionnaire - Submit or update student questionnaire responses (upsert)
router.post('/questionnaire', sessionLimiter, authenticateToken, requireRole(['student']), validateBody(sessionQuestionnaireSubmissionSchema), async (req, res) => {
  const { session_id, answers } = req.body;
  const studentId = req.user.user_id;

  try {
    // 1. Verify ownership
    const sessions = await db.query('SELECT * FROM student_sessions WHERE session_id = ? AND student_id = ?', [session_id, studentId]);
    if (sessions.length === 0) {
      return res.status(403).json({ error: 'Unauthorized session access.' });
    }

    const session = sessions[0];
    if (session.session_completed_at || session.checklist_completed_at) {
      return res.status(400).json({ error: 'This experiment session is completed and read-only.' });
    }

    if (!session.visual_stage_completed_at) {
      return res.status(400).json({ error: 'Cannot submit questionnaire answers before completing the visual stage.' });
    }

    // 2. Fetch all questions for this session's content version
    const questions = await db.query(
      'SELECT question_id, question_type FROM experiment_questionnaire_items WHERE content_version_id = ?',
      [session.content_version_id]
    );
    const questionsMap = new Map(questions.map(q => [q.question_id, q.question_type]));

    // 3. Process & upsert each answer in a transaction
    await executeTransaction(async (conn) => {
      for (const ans of answers) {
        const qType = questionsMap.get(ans.question_id);
        if (!qType) continue; // Question does not belong to this content version

        let answerBool = null;
        let answerTxt = null;

        if (qType === 'boolean') {
          if (ans.answer_boolean === true || ans.answer_boolean === false) {
            answerBool = ans.answer_boolean;
          } else if (ans.answer_text === 'true' || ans.answer_text === '1' || ans.answer_text === 'yes') {
            answerBool = true;
          } else if (ans.answer_text === 'false' || ans.answer_text === '0' || ans.answer_text === 'no') {
            answerBool = false;
          } else {
            answerBool = null;
          }
          answerTxt = null; // Explicitly NULL to satisfy chk_answer_type
        } else if (qType === 'text') {
          if (ans.answer_text && typeof ans.answer_text === 'string' && ans.answer_text.trim()) {
            answerTxt = ans.answer_text.trim();
          } else {
            answerTxt = null;
          }
          answerBool = null; // Explicitly NULL to satisfy chk_answer_type
        }

        // Only insert if exactly one is non-null
        if ((answerBool !== null && answerTxt === null) || (answerTxt !== null && answerBool === null)) {
          await conn.query(
            `INSERT INTO student_questionnaire_responses 
             (student_session_id, question_id, answer_boolean, answer_text, submitted_at) 
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (student_session_id, question_id) 
             DO UPDATE SET answer_boolean = EXCLUDED.answer_boolean, 
                           answer_text = EXCLUDED.answer_text, 
                           submitted_at = CURRENT_TIMESTAMP`,
            [session_id, ans.question_id, answerBool, answerTxt]
          );
        }
      }
    });

    // Audit log
    await logAction(studentId, 'SUBMIT_QUESTIONNAIRE', 'SESSION', session_id, {
      answers_count: answers.length,
      experiment_id: session.experiment_id
    });

    res.json({ message: 'Questionnaire responses submitted successfully.' });
  } catch (err) {
    console.error('Error submitting questionnaire responses:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/sessions/history & /api/sessions/my-history - Fetch experiment progress/history for student dashboard
const getStudentHistory = async (req, res) => {
  const studentId = req.user.user_id;
  try {
    // Fetch student's branch_id
    const users = await db.query('SELECT branch_id FROM users WHERE user_id = ?', [studentId]);
    const branchId = users.length > 0 ? users[0].branch_id : null;

    let queryStr = `
      SELECT DISTINCT l.lab_id, l.lab_name, l.location,
             e.experiment_id, e.experiment_name, e.description,
             ss.session_id, ss.session_started_at, ss.session_completed_at,
             ss.learning_stage_completed_at, ss.visual_stage_completed_at, ss.checklist_completed_at,
             ecv.version_number as session_version_number,
             (SELECT MAX(version_number) FROM experiment_content_versions WHERE experiment_id = e.experiment_id) as latest_version_number
      FROM labs l
    `;

    let params = [studentId];
    if (branchId) {
      queryStr += `
        INNER JOIN lab_branches lb ON l.lab_id = lb.lab_id
        LEFT JOIN experiments e ON l.lab_id = e.lab_id
        LEFT JOIN student_sessions ss ON e.experiment_id = ss.experiment_id AND ss.student_id = ?
        LEFT JOIN experiment_content_versions ecv ON ss.content_version_id = ecv.content_version_id
        WHERE lb.branch_id = ?
      `;
      params.push(branchId);
    } else {
      queryStr += `
        LEFT JOIN experiments e ON l.lab_id = e.lab_id
        LEFT JOIN student_sessions ss ON e.experiment_id = ss.experiment_id AND ss.student_id = ?
        LEFT JOIN experiment_content_versions ecv ON ss.content_version_id = ecv.content_version_id
      `;
    }

    queryStr += ` ORDER BY l.lab_name ASC, e.experiment_name ASC`;

    const rawHistory = await db.query(queryStr, params);

    // Group rows by experiment_id to synthesize pending latest versions
    const synthesizedHistory = [];
    const experimentsMap = {};

    for (const row of rawHistory) {
      if (!row.experiment_id) {
        // Lab without experiments
        synthesizedHistory.push(row);
        continue;
      }

      if (!experimentsMap[row.experiment_id]) {
        experimentsMap[row.experiment_id] = [];
      }
      experimentsMap[row.experiment_id].push(row);
    }

    for (const expId in experimentsMap) {
      const rows = experimentsMap[expId];
      const latestVersionNum = rows[0].latest_version_number || 1;
      const hasLatestSession = rows.some(r => r.session_id && r.session_version_number === latestVersionNum);
      const hasActiveSession = rows.some(r => r.session_id && !r.session_completed_at);

      // Add all existing sessions for this experiment to history
      for (const row of rows) {
        if (row.session_id) {
          synthesizedHistory.push(row);
        }
      }

      // If they have no active session and no session of the latest version, add a synthesized "Pending" row for the latest version
      if (!hasActiveSession && !hasLatestSession) {
        const baseRow = rows[0];
        synthesizedHistory.push({
          lab_id: baseRow.lab_id,
          lab_name: baseRow.lab_name,
          location: baseRow.location,
          experiment_id: baseRow.experiment_id,
          experiment_name: baseRow.experiment_name,
          description: baseRow.description,
          session_id: null,
          session_started_at: null,
          session_completed_at: null,
          learning_stage_completed_at: null,
          visual_stage_completed_at: null,
          checklist_completed_at: null,
          session_version_number: null,
          latest_version_number: latestVersionNum
        });
      }
    }

    res.json(synthesizedHistory);
  } catch (err) {
    console.error('Error fetching student history:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

router.get('/history', authenticateToken, requireRole(['student']), getStudentHistory);
router.get('/my-history', authenticateToken, requireRole(['student']), getStudentHistory);

module.exports = router;
