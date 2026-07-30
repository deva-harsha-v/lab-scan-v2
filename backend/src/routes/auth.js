const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { logAction } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Import Zod validator components
const { 
  validateBody, 
  loginSchema, 
  registerStudentSchema, 
  editStudentSchema, 
  resetPasswordSchema, 
  updateProfileSchema,
  passwordSchema
} = require('../utils/validators');

// Rate limiting: tight security profile (5 requests / 15 minutes) for sensitive auth endpoints
const tightLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.NODE_ENV === 'test'
});

// Rate limiting: moderate profile (20 requests / 15 minutes) for administrative actions
const moderateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.NODE_ENV === 'test'
});

// Helper to set HttpOnly cookies for JWTs and CSRF token
function setAuthCookies(res, user, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAMESITE || 'Lax';
  const domain = process.env.COOKIE_DOMAIN || undefined;

  // Generate a random CSRF token
  const csrfToken = crypto.randomBytes(32).toString('hex');

  const cookieOptions = {
    secure: isProd,
    sameSite: sameSite === 'None' ? 'none' : (sameSite === 'Strict' ? 'strict' : 'lax'),
    domain: domain
  };

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.cookie('csrfToken', csrfToken, {
    ...cookieOptions,
    httpOnly: false, // Must be readable by client JS to attach in custom header
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// Helpers to generate tokens
function generateAccessToken(user) {
  return jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
}

function generateRefreshToken(user, tokenId) {
  return jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role, jti: tokenId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
}

// POST /api/auth/login
router.post('/login', tightLimiter, validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = users[0];

    // Lockout check for students
    if (user.role === 'student' && user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.lockout_until) - new Date()) / 60000);
      return res.status(423).json({ error: `Account is temporarily locked. Try again in ${minutesLeft} minutes.` });
    }

    // Admin lockout mitigation (non-blocking delay before verifying password)
    if (user.role === 'admin' && user.failed_attempts > 0) {
      const delayMs = Math.min(user.failed_attempts * 2000, 15000); // max 15s delay
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      if (user.role === 'student') {
        const newAttempts = (user.failed_attempts || 0) + 1;
        let lockoutUntil = null;
        if (newAttempts >= 5) {
          lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lockout
        }
        await db.query('UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE user_id = ?', [newAttempts, lockoutUntil, user.user_id]);
        if (newAttempts >= 5) {
          return res.status(423).json({ error: 'Account is temporarily locked due to too many failed attempts. Try again in 15 minutes.' });
        }
      } else if (user.role === 'admin') {
        const newAttempts = (user.failed_attempts || 0) + 1;
        await db.query('UPDATE users SET failed_attempts = ? WHERE user_id = ?', [newAttempts, user.user_id]);
      }
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Successful Login
    // Reset failed attempts & lockout
    await db.query('UPDATE users SET failed_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

    const accessToken = generateAccessToken(user);
    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken(user, tokenId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store refresh token in database
    await db.query(
      'INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [tokenId, user.user_id, tokenHash, expiresAt]
    );

    // Opportunistic cleanup of expired refresh tokens
    await db.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');

    // Log logins
    if (user.role === 'admin') {
      await logAction(user.user_id, 'ADMIN_LOGIN', 'USER', user.user_id, { username: user.username });
    } else if (user.role === 'student') {
      await logAction(user.user_id, 'STUDENT_LOGIN', 'USER', user.user_id, { username: user.username });
    }

    setAuthCookies(res, user, accessToken, refreshToken);

    res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        force_password_change: !!user.force_password_change
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required.' });
  }

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired refresh token.' });
    }

    try {
      // Look up in DB
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const dbTokens = await db.query(
        'SELECT * FROM refresh_tokens WHERE token_id = ? AND token_hash = ? AND expires_at > NOW()',
        [decoded.jti, tokenHash]
      );

      if (dbTokens.length === 0) {
        return res.status(403).json({ error: 'Revoked or expired refresh token.' });
      }

      // Revoke old token
      await db.query('DELETE FROM refresh_tokens WHERE token_id = ?', [decoded.jti]);

      // Issue new tokens
      const user = { user_id: decoded.user_id, username: decoded.username, role: decoded.role };
      const accessToken = generateAccessToken(user);
      const newTokenId = crypto.randomUUID();
      const newRefreshToken = generateRefreshToken(user, newTokenId);
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

      await db.query(
        'INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [newTokenId, user.user_id, newTokenHash, newExpiresAt]
      );

      // Clean expired
      await db.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');

      setAuthCookies(res, user, accessToken, newRefreshToken);

      res.json({
        user: {
          user_id: user.user_id,
          username: user.username,
          role: user.role
        }
      });
    } catch (dbErr) {
      console.error('Database error during token refresh:', dbErr);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = jwt.decode(refreshToken);
      if (decoded && decoded.jti) {
        // Delete refresh token from DB
        await db.query('DELETE FROM refresh_tokens WHERE token_id = ?', [decoded.jti]);
      }
    } catch (err) {
      console.error('Error during token revocation on logout:', err);
    }
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('csrfToken');
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/profile & /api/auth/me - Fetch logged in user profile (joined branch/inst)
const getProfile = async (req, res) => {
  try {
    const instList = await db.query('SELECT name, short_name, logo FROM institutions LIMIT 1');
    const defaultInst = instList.length > 0 ? instList[0] : { name: 'St. Jude Engineering College', short_name: 'SJC', logo: '' };

    const users = await db.query(`
      SELECT u.user_id, u.username, u.full_name, u.roll_number, u.role, u.force_password_change, u.created_at,
             b.branch_id, b.name as branch_name,
             i.institution_id, i.name as institution_name, i.short_name as institution_short_name, i.logo as institution_logo
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      WHERE u.user_id = ?
    `, [req.user.user_id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const profile = users[0];
    profile.institution_name = profile.institution_name || defaultInst.name;
    profile.institution_short_name = profile.institution_short_name || defaultInst.short_name;
    profile.branch_name = profile.branch_name || 'General Academic Branch';

    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

router.get('/profile', authenticateToken, getProfile);
router.get('/me', authenticateToken, getProfile);

// PUT & POST /api/auth/change-password - Change own password
const handleChangePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const passwordValidation = passwordSchema.safeParse(newPassword);
  if (!passwordValidation.success) {
    return res.status(400).json({ error: 'Validation failed: ' + passwordValidation.error.issues.map(e => e.message).join(' ') });
  }

  try {
    const users = await db.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Current password verification failed. Please check your temporary password.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, force_password_change = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [hashed, req.user.user_id]
    );

    await logAction(req.user.user_id, 'PASSWORD_CHANGE', 'USER', req.user.user_id, { self: true });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

router.put('/change-password', tightLimiter, authenticateToken, handleChangePassword);
router.post('/change-password', tightLimiter, authenticateToken, handleChangePassword);

// PUT /api/auth/admin-profile - Admin profile update (Name, Password, Institution details)
router.put('/admin-profile', authenticateToken, requireRole(['admin']), validateBody(updateProfileSchema), async (req, res) => {
  const { username, full_name, password, institution_name, institution_short_name } = req.body;

  try {
    // 1. Update username, full name & password in users
    if (username && username.trim()) {
      const existing = await db.query('SELECT user_id FROM users WHERE username = ? AND user_id != ?', [username.trim(), req.user.user_id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username is already taken by another account.' });
      }
      await db.query('UPDATE users SET username = ? WHERE user_id = ?', [username.trim(), req.user.user_id]);
    }
    if (full_name) {
      await db.query('UPDATE users SET full_name = ? WHERE user_id = ?', [full_name, req.user.user_id]);
    }
    if (password && password.trim()) {
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashed, req.user.user_id]);
    }

    // 2. Update institution details
    if (institution_name) {
      const list = await db.query('SELECT * FROM institutions LIMIT 1');
      if (list.length === 0) {
        const instId = crypto.randomUUID();
        await db.query(
          'INSERT INTO institutions (institution_id, name, short_name, logo) VALUES (?, ?, ?, ?)',
          [instId, institution_name, institution_short_name || '', '']
        );
        // Link admin and all users
        await db.query('UPDATE users SET institution_id = ?', [instId]);
      } else {
        const inst = list[0];
        await db.query(
          'UPDATE institutions SET name = ?, short_name = ? WHERE institution_id = ?',
          [institution_name, institution_short_name || '', inst.institution_id]
        );
      }
    }

    await logAction(req.user.user_id, 'UPDATE_ADMIN_PROFILE', 'USER', req.user.user_id, { full_name, username });

    // Fetch updated user to issue fresh tokens
    const updatedUsers = await db.query('SELECT user_id, username, role, full_name FROM users WHERE user_id = ?', [req.user.user_id]);
    const updatedUser = updatedUsers[0];
    const accessToken = generateAccessToken(updatedUser);
    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken(updatedUser, tokenId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await db.query(
      'INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [tokenId, updatedUser.user_id, tokenHash, expiresAt]
    );

    setAuthCookies(res, updatedUser, accessToken, refreshToken);

    res.json({ 
      message: 'Profile and institution details updated successfully.',
      user: {
        user_id: updatedUser.user_id,
        username: updatedUser.username,
        role: updatedUser.role,
        full_name: updatedUser.full_name
      }
    });
  } catch (err) {
    console.error('Error updating admin profile:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/students - Enhanced university student list with pagination, search & filters
router.get('/students', authenticateToken, requireRole(['admin']), async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  const search = req.query.search || '';
  const branch_id = req.query.branch_id || '';
  const force_password_change = req.query.force_password_change || '';

  const offset = (page - 1) * limit;

  try {
    let whereClause = "WHERE u.role = 'student'";
    const params = [];

    if (search) {
      whereClause += ' AND (u.full_name ILIKE ? OR u.roll_number ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (branch_id) {
      whereClause += ' AND u.branch_id = ?';
      params.push(branch_id);
    }
    if (force_password_change) {
      whereClause += ' AND u.force_password_change = ?';
      params.push(force_password_change === 'true');
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM users u
      ${whereClause}
    `, params);
    const totalRecords = parseInt(countResult[0].count, 10);

    // Get paginated list
    const limitParams = [...params, limit, offset];
    const students = await db.query(`
      SELECT u.user_id, u.username, u.full_name, u.roll_number, u.force_password_change, u.created_at, u.updated_at,
             b.name as branch_name, b.branch_id
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, limitParams);

    // Fetch summary counts for the metrics cards
    const totalStudentsRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalBranchesRes = await db.query("SELECT COUNT(*) as count FROM branches");
    const activeStudentsRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND force_password_change = false");
    const importedTodayRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND created_at >= NOW() - INTERVAL '1 day'");
    const pendingPasswordRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND force_password_change = true");

    res.json({
      students,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      },
      summary: {
        totalStudents: totalStudentsRes[0].count,
        totalBranches: totalBranchesRes[0].count,
        activeStudents: activeStudentsRes[0].count,
        importedToday: importedTodayRes[0].count,
        pendingPasswordChange: pendingPasswordRes[0].count
      }
    });
  } catch (err) {
    console.error('Error fetching students list:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/student-profile/:id - Detailed student profile drawer info
router.get('/student-profile/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const studentId = req.params.id;

  try {
    const users = await db.query(`
      SELECT u.user_id, u.username, u.full_name, u.roll_number, u.force_password_change, u.created_at, u.updated_at,
             b.name as branch_name, i.name as institution_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      WHERE u.user_id = ? AND u.role = 'student'
    `, [studentId]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const studentInfo = users[0];

    // Fetch laboratory and session status for this student
    // Join labs and sessions to see progress
    const sessions = await db.query(`
      SELECT l.lab_name, e.experiment_name, s.session_started_at, s.session_completed_at, s.checklist_completed_at, s.visual_stage_completed_at
      FROM student_sessions s
      JOIN experiments e ON s.experiment_id = e.experiment_id
      JOIN labs l ON e.lab_id = l.lab_id
      WHERE s.student_id = ?
    `, [studentId]);

    res.json({
      profile: studentInfo,
      worksheets: sessions
    });
  } catch (err) {
    console.error('Error fetching student drawer profile:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register-student - Manual individual student enrollment
router.post('/register-student', moderateLimiter, authenticateToken, requireRole(['admin']), validateBody(registerStudentSchema), async (req, res) => {
  const { full_name, roll_number, branch_id, password } = req.body;

  try {
    // Get current global institution
    const instResult = await db.query('SELECT institution_id FROM institutions LIMIT 1');
    const institutionId = instResult.length > 0 ? instResult[0].institution_id : null;

    const studentId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await db.executeTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO users (user_id, username, password_hash, role, full_name, roll_number, branch_id, institution_id, force_password_change) 
         VALUES (?, ?, ?, 'student', ?, ?, ?, ?, true)`,
        [studentId, roll_number, passwordHash, full_name, roll_number, branch_id, institutionId]
      );
    });

    await logAction(req.user.user_id, 'CREATE_STUDENT_ACCOUNT', 'USER', studentId, { roll_number, full_name });

    res.status(201).json({
      message: 'Student account registered successfully.',
      student: { user_id: studentId, roll_number, full_name }
    });
  } catch (err) {
    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A student account with this roll number already exists.' });
    }
    console.error('Error enrolling student:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/auth/students/:id - Edit student profile (Name, Branch)
router.put('/students/:id', authenticateToken, requireRole(['admin']), (req, res, next) => {
  req.body.user_id = req.params.id;
  next();
}, validateBody(editStudentSchema), async (req, res) => {
  const { user_id, full_name, branch_id } = req.body;

  try {
    const existing = await db.query("SELECT * FROM users WHERE user_id = ? AND role = 'student'", [user_id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    await db.query(
      'UPDATE users SET full_name = ?, branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [full_name, branch_id, user_id]
    );

    await logAction(req.user.user_id, 'EDIT_STUDENT_ACCOUNT', 'USER', user_id, { full_name });

    res.json({ message: 'Student details updated successfully.' });
  } catch (err) {
    console.error('Error editing student details:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/auth/students/:id/reset-password - Reset password from admin panel
router.put('/students/:id/reset-password', tightLimiter, authenticateToken, requireRole(['admin']), (req, res, next) => {
  req.body.user_id = req.params.id;
  next();
}, validateBody(resetPasswordSchema), async (req, res) => {
  const { user_id, password } = req.body;

  try {
    const existing = await db.query("SELECT username FROM users WHERE user_id = ? AND role = 'student'", [user_id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, force_password_change = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [hashed, user_id]
    );

    await logAction(req.user.user_id, 'RESET_STUDENT_PASSWORD', 'USER', user_id, { roll_number: existing[0].username });

    res.json({ message: 'Password reset successfully. The student will be forced to change it on next login.' });
  } catch (err) {
    console.error('Error resetting student password:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/bulk-import - Bulk Excel student ingestion endpoint
router.post('/bulk-import', moderateLimiter, authenticateToken, requireRole(['admin']), async (req, res) => {
  const { students, default_password, dry_run } = req.body;

  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'A list of students is required.' });
  }

  if (students.length > 500) {
    return res.status(400).json({ error: 'Bulk import limit exceeded. Maximum 500 rows allowed per sheet.' });
  }

  const passwordValidation = passwordSchema.safeParse(default_password);
  if (!passwordValidation.success) {
    return res.status(400).json({ error: 'Validation failed: ' + passwordValidation.error.issues.map(e => e.message).join(' ') });
  }

  try {
    const result = await db.executeTransaction(async (conn) => {
      // 1. Fetch all branches to map names to IDs
      const [branches] = await conn.query('SELECT * FROM branches');
      const branchMap = {};
      branches.forEach(b => {
        branchMap[b.name.trim().toUpperCase()] = b.branch_id;
      });

      // 2. Fetch current global institution
      const [instResult] = await conn.query('SELECT institution_id FROM institutions LIMIT 1');
      const institutionId = instResult.length > 0 ? instResult[0].institution_id : null;

      // 3. Fetch existing usernames/rolls to prevent duplicates in DB
      const [existingUsers] = await conn.query('SELECT username FROM users');
      const dbUsernames = new Set(existingUsers.map(u => u.username.trim().toUpperCase()));

      const imported = [];
      const duplicates = [];
      const invalidRows = [];
      const processedRolls = new Set();
      const rowsToInsert = [];

      // Only hash password if it's a real import, saving processing power during dry-run previews
      const passwordHash = !dry_run ? await bcrypt.hash(default_password, 10) : null;

      for (let idx = 0; idx < students.length; idx++) {
        const row = students[idx];
        const name = (row.full_name || row['Student Name'] || '').toString().trim();
        const roll = (row.roll_number || row['Roll Number'] || '').toString().trim();
        const branchName = (row.branch || row['Branch'] || '').toString().trim().toUpperCase();

        if (!name || !roll || !branchName) {
          invalidRows.push({ row: idx + 1, error: 'Missing required columns (Name, Roll, or Branch).' });
          continue;
        }

        // Check duplicate in input array
        if (processedRolls.has(roll.toUpperCase())) {
          duplicates.push({ row: idx + 1, roll_number: roll, error: 'Duplicate roll number in the import file.' });
          continue;
        }
        processedRolls.add(roll.toUpperCase());

        // Check duplicate in Database
        if (dbUsernames.has(roll.toUpperCase())) {
          duplicates.push({ row: idx + 1, roll_number: roll, error: 'Roll number already exists in system database.' });
          continue;
        }

        // Map branch name to ID
        const branchId = branchMap[branchName];
        if (!branchId) {
          invalidRows.push({ row: idx + 1, roll_number: roll, error: `Invalid branch name: "${row.branch || row['Branch']}". Configure it in Branch settings first.` });
          continue;
        }

        const studentId = crypto.randomUUID();
        rowsToInsert.push({ studentId, roll, name, branchId });
        imported.push({ student_id: studentId, roll_number: roll, full_name: name });
      }

      if (rowsToInsert.length > 0 && !dry_run) {
        const valuePlaceholders = [];
        const params = [];
        
        for (let i = 0; i < rowsToInsert.length; i++) {
          const r = rowsToInsert[i];
          valuePlaceholders.push('(?, ?, ?, \'student\', ?, ?, ?, ?, true)');
          params.push(
            r.studentId,
            r.roll,
            passwordHash,
            r.name,
            r.roll,
            r.branchId,
            institutionId
          );
        }

        const batchSql = `
          INSERT INTO users (user_id, username, password_hash, role, full_name, roll_number, branch_id, institution_id, force_password_change) 
          VALUES ${valuePlaceholders.join(', ')}
        `;
        
        await conn.query(batchSql, params);
      }

      return { imported, duplicates, invalidRows };
    });

    const { imported, duplicates, invalidRows } = result;

    if (!dry_run) {
      // Log the bulk import
      await logAction(req.user.user_id, 'BULK_IMPORT_STUDENTS', 'SYSTEM', null, {
        total: students.length,
        imported: imported.length,
        duplicates: duplicates.length,
        invalid: invalidRows.length
      });
    }

    res.json({
      message: dry_run
        ? `Bulk import preview generated. ${imported.length} students ready to import.`
        : `Bulk import completed. Successfully imported ${imported.length} students.`,
      dry_run: !!dry_run,
      summary: {
        total: students.length,
        importedCount: imported.length,
        duplicatesCount: duplicates.length,
        invalidCount: invalidRows.length
      },
      duplicates,
      invalidRows
    });
  } catch (err) {
    console.error('Error during bulk import:', err);
    res.status(500).json({ error: 'Internal server error during processing.' });
  }
});

// DELETE /api/auth/students/:id (Admin only, to delete student accounts)
router.delete('/students/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const studentId = req.params.id;
  try {
    const users = await db.query("SELECT username FROM users WHERE user_id = ? AND role = 'student'", [studentId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const username = users[0].username;

    // Pre-check for session records to provide a friendly error message
    const sessions = await db.query('SELECT COUNT(*) as count FROM student_sessions WHERE student_id = ?', [studentId]);
    if (sessions[0].count > 0) {
      return res.status(400).json({ error: 'This student account has active or completed experiment worksheets and cannot be deleted for academic record retention.' });
    }

    await db.query('DELETE FROM users WHERE user_id = ?', [studentId]);

    // Audit logging
    await logAction(req.user.user_id, 'DELETE_STUDENT_ACCOUNT', 'USER', studentId, { student_username: username });

    res.json({ message: 'Student account deleted successfully.' });
  } catch (err) {
    if (err.code === '23503' || err.code === '1451') {
      return res.status(400).json({ error: 'This student account has active or completed experiment worksheets and cannot be deleted for academic record retention.' });
    }
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
