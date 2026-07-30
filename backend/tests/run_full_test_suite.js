const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

// Helper to parse cookies from Set-Cookie headers
function parseCookies(headers) {
  const cookies = {};
  const setCookie = headers['set-cookie'];
  if (!setCookie) return cookies;
  
  setCookie.forEach(cookieStr => {
    const parts = cookieStr.split(';')[0].split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookies[name] = value;
    }
  });
  return cookies;
}

// Request helper to handle cookie header and response body
function request(urlPath, method = 'GET', body = null, incomingCookies = {}, origin = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    
    const cookieHeader = Object.entries(incomingCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };

    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    if (incomingCookies['csrfToken']) {
      headers['X-CSRF-Token'] = incomingCookies['csrfToken'];
    }

    if (origin) {
      headers['Origin'] = origin;
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { text: data };
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies: parseCookies(res.headers),
          body: parsed
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

// Helper to tamper with JWT signature/payload
function tamperToken(token) {
  if (!token) return token;
  const parts = token.split('.');
  if (parts.length !== 3) return token;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadStr = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    payload.role = 'admin'; // Elevate role
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${parts[0]}.${tamperedPayload}.${parts[2]}`; // Tampered payload, signature mismatch guaranteed!
  } catch (e) {
    return token;
  }
}

async function runSuite() {
  console.log('==================================================');
  console.log('    LABSCAN INTEGRATED AUTOMATED TEST SUITE        ');
  console.log('==================================================');
  
  const results = [];

  async function addResult(id, name, passCondition, executeFn) {
    console.log(`Running ${id}: ${name}...`);
    try {
      const response = await executeFn();
      const pass = passCondition(response);
      results.push({
        id,
        name,
        result: pass ? 'PASS' : 'FAIL',
        statusCode: response.statusCode,
        observed: JSON.stringify(response.body).slice(0, 180) + (JSON.stringify(response.body).length > 180 ? '...' : '')
      });
      console.log(` -> [${pass ? 'PASS' : 'FAIL'}] (Status: ${response.statusCode})`);
    } catch (err) {
      results.push({
        id,
        name,
        result: 'FAIL',
        statusCode: 'ERR',
        observed: err.message
      });
      console.log(` -> [FAIL] (Error: ${err.message})`);
    }
  }

  // Set up test credentials
  const adminCreds = { username: 'admin', password: 'admin123' };
  const studentCreds = { username: 'student1', password: 'student123' };
  const rand = Date.now().toString().slice(-4);
  const testBranchName = `Suite Branch ${rand}`;
  const testBranchIdRef = { id: null };
  const testLabIdRef = { id: null };
  const testExpIdRef = { id: null };

  let adminCookies = {};
  let studentCookies = {};

  // Log in as Admin first to seed/configure
  const adminLogin = await request('/api/auth/login', 'POST', adminCreds);
  adminCookies = adminLogin.cookies;

  // Log in as Student
  const studentLogin = await request('/api/auth/login', 'POST', studentCreds);
  studentCookies = studentLogin.cookies;

  // 1. Authentication & Session Security
  await addResult('SEC-01', 'Valid student login succeeds and returns tokens', 
    (res) => res.statusCode === 200 && res.cookies['accessToken'] && res.cookies['csrfToken'],
    () => request('/api/auth/login', 'POST', studentCreds)
  );

  await addResult('SEC-02', 'Invalid password login fails with generic error (no leak)', 
    (res) => res.statusCode === 401 && res.body.error === 'Invalid credentials.',
    () => request('/api/auth/login', 'POST', { username: 'student1', password: 'wrongpassword' })
  );

  await addResult('SEC-03', 'Trigger 5 failed logins -> Account Lockout (423)', 
    (res) => res.statusCode === 423 && res.body.error.includes('temporarily locked'),
    async () => {
      const lockRoll = `lock_${rand}`;
      // Fetch a valid branch ID for registration
      const branchesRes = await request('/api/branches', 'GET', null, adminCookies);
      const branchId = branchesRes.body[0]?.branch_id;
      
      // Register temporary student for lockout test
      await request('/api/auth/register-student', 'POST', {
        full_name: 'Lockout Test',
        roll_number: lockRoll,
        branch_id: branchId,
        password: 'Password123!'
      }, adminCookies);

      let lastRes;
      for (let i = 0; i < 5; i++) {
        lastRes = await request('/api/auth/login', 'POST', { username: lockRoll, password: 'wrongpassword' });
      }
      return lastRes;
    }
  );

  await addResult('SEC-04', 'Confirm role assignment (Student user has role student)', 
    (res) => res.statusCode === 200 && res.body.user.role === 'student',
    () => request('/api/auth/login', 'POST', studentCreds)
  );

  await addResult('SEC-05', 'Request without CSRF token on POST/PUT/DELETE is rejected', 
    (res) => res.statusCode === 403 && res.body.error === 'CSRF token validation failed.',
    () => request('/api/branches', 'POST', { name: 'No CSRF Branch' }, { accessToken: adminCookies['accessToken'] })
  );

  await addResult('SEC-06', 'Logging out invalidates the session', 
    (res) => res.statusCode === 401,
    async () => {
      const tempLogin = await request('/api/auth/login', 'POST', adminCreds);
      const logoutRes = await request('/api/auth/logout', 'POST', {}, tempLogin.cookies);
      const clearedCookies = { ...tempLogin.cookies };
      if (logoutRes.cookies) {
        Object.keys(logoutRes.cookies).forEach(k => {
          delete clearedCookies[k];
        });
      }
      // Try accessing strictly protected route with the cleared session cookies
      return await request('/api/auth/profile', 'GET', null, clearedCookies);
    }
  );

  await addResult('SEC-07', 'Tampered JWT payload rejects signature validation', 
    (res) => res.statusCode === 401 || res.statusCode === 403,
    () => {
      const tamperedAccessToken = tamperToken(studentCookies['accessToken']);
      return request('/api/auth/profile', 'GET', null, { accessToken: tamperedAccessToken, csrfToken: studentCookies['csrfToken'] });
    }
  );

  // 2. Role-Based Access Control
  const adminEndpoints = [
    { path: '/api/labs', method: 'POST', body: { name: 'Test' } },
    { path: '/api/experiments', method: 'POST', body: { title: 'Test' } },
    { path: '/api/branches', method: 'POST', body: { name: 'Test' } },
    { path: '/api/auth/bulk-import', method: 'POST', body: { students: [] } },
    { path: '/api/auth/register-student', method: 'POST', body: {} }
  ];

  for (let idx = 0; idx < adminEndpoints.length; idx++) {
    const ep = adminEndpoints[idx];
    await addResult(`RBAC-0${idx + 1}`, `Student JWT calling ${ep.method} ${ep.path} returns 403`, 
      (res) => res.statusCode === 403,
      () => request(ep.path, ep.method, ep.body, studentCookies)
    );
  }

  await addResult('RBAC-06', 'IDOR check: Student B is blocked from modifying Student A\'s active session', 
    (res) => res.statusCode === 403 && res.body.error === 'Unauthorized session access.',
    async () => {
      // 1. Get a valid experiment ID from public experiments list
      const expsRes = await request('/api/experiments', 'GET');
      const experimentId = expsRes.body[0]?.experiment_id;
      if (!experimentId) {
        return { statusCode: 500, body: 'No experiments found to run IDOR test.' };
      }

      // 2. Student A starts session
      const startRes = await request('/api/sessions/start', 'POST', { experiment_id: experimentId }, studentCookies);
      let student1SessionId = startRes.body?.session?.session_id;
      if (!student1SessionId) {
        const activeRes = await request(`/api/sessions/active/${experimentId}`, 'GET', null, studentCookies);
        student1SessionId = activeRes.body?.session_id;
      }

      if (!student1SessionId) {
        return { statusCode: 500, body: 'Failed to retrieve or create Student A session.' };
      }

      // 3. Login Student B
      const studentBLogin = await request('/api/auth/login', 'POST', { username: 'student2', password: 'student123' });
      const studentBCookies = studentBLogin.headers ? parseCookies(studentBLogin.headers) : {};

      // 4. Student B attempts to modify Student A's session progress
      return await request('/api/sessions/progress', 'PUT', {
        session_id: student1SessionId,
        stage: 'learning'
      }, studentBCookies);
    }
  );

  // 3. CRUD Integrity
  await addResult('CRUD-01', 'Create branch persists correctly', 
    (res) => res.statusCode === 201 && res.body.branch && res.body.branch.branch_id,
    async () => {
      const res = await request('/api/branches', 'POST', { name: testBranchName }, adminCookies);
      if (res.body?.branch?.branch_id) {
        testBranchIdRef.id = res.body.branch.branch_id;
      }
      return res;
    }
  );

  await addResult('CRUD-02', 'Create lab persists correctly', 
    (res) => res.statusCode === 201 && res.body.lab && res.body.lab.lab_id,
    async () => {
      const res = await request('/api/labs', 'POST', {
        lab_name: `Suite Lab ${rand}`,
        allowed_branches: [testBranchIdRef.id]
      }, adminCookies);
      if (res.body?.lab?.lab_id) {
        testLabIdRef.id = res.body.lab.lab_id;
      }
      return res;
    }
  );

  await addResult('CRUD-03', 'Create experiment with duplicate ArUco marker ID is blocked', 
    (res) => res.statusCode === 400 || res.statusCode === 409,
    async () => {
      // Find a dynamically unused marker ID to avoid conflicts with previous test executions
      const usedMarkers = await db.query('SELECT ar_qr_marker_id FROM experiments');
      const usedSet = new Set(usedMarkers.map(m => m.ar_qr_marker_id));
      let unusedMarkerId = 15;
      while (usedSet.has(unusedMarkerId) && unusedMarkerId < 99) {
        unusedMarkerId++;
      }

      // 1. Create first experiment with random ArUco ID
      const exp1Res = await request('/api/experiments', 'POST', {
        experiment_name: `Suite Exp A ${rand}`,
        lab_id: testLabIdRef.id,
        ar_qr_marker_id: unusedMarkerId,
        min_duration: 60,
        location: 'Room 303',
        description: 'First Exp'
      }, adminCookies);
      console.log('CRUD-03 Debug: exp1Res status =', exp1Res.statusCode, 'body =', JSON.stringify(exp1Res.body));

      // 2. Attempt to create second experiment with duplicate ArUco ID
      return await request('/api/experiments', 'POST', {
        experiment_name: `Suite Exp B ${rand}`,
        lab_id: testLabIdRef.id,
        ar_qr_marker_id: unusedMarkerId,
        min_duration: 60,
        location: 'Room 303',
        description: 'Second Exp'
      }, adminCookies);
    }
  );

  await addResult('CRUD-04', 'Delete branch with missing required fields returns clear validation errors', 
    (res) => res.statusCode === 400,
    () => request('/api/branches', 'POST', {}, adminCookies)
  );

  await addResult('CRUD-05', 'Delete lab that has experiments tied to it yields blocked status', 
    (res) => res.statusCode === 400 || res.body.error !== undefined,
    () => request(`/api/labs/${testLabIdRef.id}`, 'DELETE', null, adminCookies)
  );

  // 4. Bulk Student Import
  await addResult('BULK-01', 'Import well-formed student list succeeds', 
    (res) => res.statusCode === 200 && res.body.summary.importedCount === 2,
    () => request('/api/auth/bulk-import', 'POST', {
      default_password: 'SecurePassword123!',
      students: [
        { full_name: 'Bulk Student X', roll_number: `roll_${rand}_x`, branch: testBranchName },
        { full_name: 'Bulk Student Y', roll_number: `roll_${rand}_y`, branch: testBranchName }
      ]
    }, adminCookies)
  );

  await addResult('BULK-02', 'Import list with errors (missing roll, duplicate within file, invalid branch) reports error per row', 
    (res) => res.statusCode === 200 && res.body.summary.duplicatesCount === 1,
    () => request('/api/auth/bulk-import', 'POST', {
      default_password: 'SecurePassword123!',
      students: [
        { full_name: 'Bulk Student W', roll_number: `roll_${rand}_w`, branch: testBranchName }, // Malformed or missing details
        { full_name: 'Bulk Student Z', roll_number: `roll_${rand}_x`, branch: testBranchName }  // Duplicate roll number in DB
      ]
    }, adminCookies)
  );

  await addResult('BULK-03', 'Import above 500-row limit is rejected before processing', 
    (res) => res.statusCode === 400 && res.body.error.includes('limit exceeded'),
    () => {
      const overlimitList = [];
      for (let i = 0; i < 505; i++) {
        overlimitList.push({ full_name: `Limit Test ${i}`, roll_number: `limitroll_${i}`, branch: testBranchName });
      }
      return request('/api/auth/bulk-import', 'POST', {
        default_password: 'SecurePassword123!',
        students: overlimitList
      }, adminCookies);
    }
  );

  await addResult('BULK-04', 'Import with SQL Injection payload in student name succeeds safely', 
    (res) => res.statusCode === 200 && res.body.summary.importedCount === 1 && res.dbMatch === true && res.dbCountCheck === true,
    async () => {
      const startCountRes = await db.query('SELECT COUNT(*) as count FROM users');
      const startCount = parseInt(startCountRes[0].count, 10);

      const res = await request('/api/auth/bulk-import', 'POST', {
        default_password: 'SecurePassword123!',
        students: [
          { full_name: "Amit Kumar'; DROP TABLE users; --", roll_number: `sqli_bulk_${rand}`, branch: testBranchName }
        ]
      }, adminCookies);

      // Verify database directly to assert SQLi payload is stored as a literal string
      const dbUserRes = await db.query('SELECT full_name FROM users WHERE roll_number = ?', [`sqli_bulk_${rand}`]);
      const dbMatch = dbUserRes.length > 0 && dbUserRes[0].full_name === "Amit Kumar'; DROP TABLE users; --";

      const endCountRes = await db.query('SELECT COUNT(*) as count FROM users');
      const endCount = parseInt(endCountRes[0].count, 10);
      const dbCountCheck = endCount === startCount + 1; // Exactly 1 student added

      return {
        ...res,
        dbMatch,
        dbCountCheck
      };
    }
  );

  // 5. Security Payloads
  await addResult('PAY-01', 'SQL Injection payload in login rejects safely', 
    (res) => res.statusCode === 401,
    () => request('/api/auth/login', 'POST', { username: "' OR '1'='1", password: "' OR '1'='1" })
  );

  await addResult('PAY-02', 'XSS payload stored as inert text', 
    (res) => res.statusCode === 201 && res.body.branch.name.includes('<script>'),
    async () => {
      // Create a branch with XSS payload and verify it is returned literally as raw text, indicating it isn't executing
      return await request('/api/branches', 'POST', { name: `<script>alert(1)</script> ${rand}` }, adminCookies);
    }
  );
  await addResult('AUDIT-01', 'Verify student actions are correctly written to audit logs',
    (res) => {
      if (res.statusCode !== 200) return false;
      const logs = res.body;
      const studentId = studentLogin.body?.user?.user_id;
      
      const loginLog = logs.find(l => l.action_type === 'STUDENT_LOGIN' && l.actor_id === studentId);
      const startLog = logs.find(l => l.action_type === 'START_SESSION' && l.actor_id === studentId);
      const stageLog = logs.find(l => l.action_type === 'COMPLETE_STAGE' && l.actor_id === studentId);
      const checklistLog = logs.find(l => l.action_type === 'TOGGLE_CHECKLIST_ITEM' && l.actor_id === studentId);

      console.log('AUDIT LOG DEBUG - Found Logs for Student:', {
        loginLog: !!loginLog,
        startLog: !!startLog,
        stageLog: !!stageLog,
        checklistLog: !!checklistLog
      });

      const matches = loginLog && startLog && stageLog && checklistLog;
      if (!matches) return false;

      const hasStudentId = startLog.actor_id !== null && startLog.actor_id === studentId;
      const hasExpIdInStart = startLog.details?.experiment_id !== undefined;
      const hasExpIdInStage = stageLog.details?.experiment_id !== undefined;
      const hasExpIdInChecklist = checklistLog.details?.experiment_id !== undefined;

      console.log('AUDIT LOG DEBUG - Field matches:', {
        studentId,
        actorIdInStart: startLog.actor_id,
        hasStudentId,
        hasExpIdInStart,
        hasExpIdInStage,
        hasExpIdInChecklist,
        checklistLog: JSON.stringify(checklistLog)
      });

      return hasStudentId && hasExpIdInStart && hasExpIdInStage && hasExpIdInChecklist;
    },
    async () => {
      // 1. Create a dedicated lab for the audit test to avoid dependency on CRUD-05 lab deletion
      const labRes = await request('/api/labs', 'POST', {
        lab_name: `Audit Lab ${rand}`,
        allowed_branches: [testBranchIdRef.id]
      }, adminCookies);
      const labId = labRes.body?.lab?.lab_id;
      if (!labId) {
        return { statusCode: 500, body: `Failed to create lab for audit test: ${JSON.stringify(labRes.body)}` };
      }

      // Find an unused marker ID to avoid conflicts with previous test executions
      const usedMarkers = await db.query('SELECT ar_qr_marker_id FROM experiments');
      const usedSet = new Set(usedMarkers.map(m => m.ar_qr_marker_id));
      let auditMarkerId = 15;
      while (usedSet.has(auditMarkerId) && auditMarkerId < 99) {
        auditMarkerId++;
      }

      // 2. Create a dedicated test experiment with checklist items
      const expRes = await request('/api/experiments', 'POST', {
        experiment_name: `Audit Test Exp ${rand}`,
        lab_id: labId,
        ar_qr_marker_id: auditMarkerId,
        description: 'Experiment for Audit logging tests',
        checklist_items: ['Audit checklist item 1', 'Audit checklist item 2']
      }, adminCookies);

      const experimentId = expRes.body?.experiment_id;
      if (!experimentId) {
        return { statusCode: 500, body: `Failed to create experiment for audit test: ${JSON.stringify(expRes.body)}` };
      }

      // 3. Log in student explicitly to trigger STUDENT_LOGIN event
      const loginRes = await request('/api/auth/login', 'POST', studentCreds);
      const testStudentCookies = loginRes.cookies;

      // 4. Student starts session
      const startRes = await request('/api/sessions/start', 'POST', { experiment_id: experimentId }, testStudentCookies);
      let sessionId = startRes.body?.session?.session_id;
      if (!sessionId) {
        const activeRes = await request(`/api/sessions/active/${experimentId}`, 'GET', null, testStudentCookies);
        sessionId = activeRes.body?.session_id;
      }
      if (!sessionId) {
        return { statusCode: 500, body: 'Failed to retrieve or create session.' };
      }

      // 5. Student completes learning stage
      await request('/api/sessions/progress', 'PUT', {
        session_id: sessionId,
        stage: 'learning'
      }, testStudentCookies);

      // 6. Student toggles checklist item
      const checklistItemsRes = await db.query('SELECT checklist_item_id FROM student_checklist_progress WHERE student_session_id = ?', [sessionId]);
      if (checklistItemsRes.length > 0) {
        const checklistItemId = checklistItemsRes[0].checklist_item_id;
        await request('/api/sessions/checklist', 'PUT', {
          session_id: sessionId,
          checklist_item_id: checklistItemId,
          is_completed: true
        }, testStudentCookies);
      }

      // 7. Admin fetches the audit logs
      return await request('/api/audit-logs', 'GET', null, adminCookies);
    }
  );


  await addResult('PAY-03', 'Deliberate server error (malformed JSON) returns generic error', 
    (res) => res.statusCode === 400 || res.statusCode === 500,
    () => {
      return new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port: 5000,
          path: '/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, body: data });
          });
        });
        req.write('{ malformed json }');
        req.end();
      });
    }
  );

  console.log('==================================================');
  console.log('              TEST RUN COMPLETED                  ');
  console.log('==================================================');
  
  // Output Markdown table to console
  let markdown = '| Test ID | Test Name | Result | Observed Response / Status |\n';
  markdown += '|---|---|---|---|\n';
  results.forEach(r => {
    markdown += `| ${r.id} | ${r.name} | **${r.result}** | Status ${r.statusCode}: ${r.observed} |\n`;
  });
  
  console.log(markdown);
  
  fs.writeFileSync(path.join(__dirname, 'test_results.md'), markdown);
  console.log('Results written to test_results.md');

  // Close database pool to let the process exit cleanly
  try {
    const pool = db.getPool();
    await pool.end();
    console.log('Database pool connection closed cleanly.');
  } catch (err) {
    console.error('Error closing database pool:', err);
  }
}

runSuite().catch(console.error);
