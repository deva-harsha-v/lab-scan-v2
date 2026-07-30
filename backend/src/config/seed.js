const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool, query } = require('./db');
const { runMigration } = require('./migrate');

async function runSeed() {
  console.log('Starting database seeding with branches and institutions...');
  
  // 1. Run migrations first programmatically
  await runMigration(false);

  // 2. Clean existing data
  console.log('Cleaning existing seed data...');
  const tables = [
    'audit_logs',
    'student_checklist_progress',
    'student_sessions',
    'checklist_items',
    'experiment_content_versions',
    'experiments',
    'lab_branches',
    'labs',
    'users',
    'branches',
    'institutions'
  ];
  
  for (const table of tables) {
    try {
      await query(`DELETE FROM \`${table}\``);
    } catch (err) {
      console.warn(`Could not truncate table ${table}:`, err.message);
    }
  }

  // 3. Seed Institution
  console.log('Seeding institution...');
  const instId = crypto.randomUUID();
  await query(
    `INSERT INTO institutions (institution_id, name, short_name, logo) VALUES (?, ?, ?, ?)`,
    [instId, 'St. Jude Engineering College', 'SJC', '']
  );

  // 4. Seed Branches
  console.log('Seeding branches...');
  const branchCSEId = crypto.randomUUID();
  const branchECEId = crypto.randomUUID();
  const branchMECHId = crypto.randomUUID();

  await query(`INSERT INTO branches (branch_id, name) VALUES (?, ?)`, [branchCSEId, 'CSE']);
  await query(`INSERT INTO branches (branch_id, name) VALUES (?, ?)`, [branchECEId, 'ECE']);
  await query(`INSERT INTO branches (branch_id, name) VALUES (?, ?)`, [branchMECHId, 'Mechanical']);

  // 5. Create Users
  console.log('Seeding users...');
  const adminId = crypto.randomUUID();
  const student1Id = crypto.randomUUID();
  const student2Id = crypto.randomUUID();

  const isProduction = process.env.NODE_ENV === 'production';
  const adminPassword = isProduction ? crypto.randomBytes(8).toString('hex') : 'admin123';
  const studentPassword = isProduction ? crypto.randomBytes(8).toString('hex') : 'student123';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const studentHash = await bcrypt.hash(studentPassword, 10);

  // Admin
  await query(
    `INSERT INTO users (user_id, username, password_hash, role, full_name, institution_id, force_password_change) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, 'admin', adminHash, 'admin', 'System Administrator', instId, isProduction]
  );
  // Student 1 (CSE, No forced password change in dev, true in prod)
  await query(
    `INSERT INTO users (user_id, username, password_hash, role, full_name, roll_number, branch_id, institution_id, force_password_change) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [student1Id, 'student1', studentHash, 'student', 'Amit Kumar', 'student1', branchCSEId, instId, isProduction]
  );
  // Student 2 (ECE, Forced password change = true)
  await query(
    `INSERT INTO users (user_id, username, password_hash, role, full_name, roll_number, branch_id, institution_id, force_password_change) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)`,
    [student2Id, 'student2', studentHash, 'student', 'John Doe', 'student2', branchECEId, instId]
  );

  if (isProduction) {
    const credsPath = path.join(__dirname, '../../seed_credentials.txt');
    const credsContent = `=== LabScan Production Seeded Credentials ===
Admin - Username: admin, Password: ${adminPassword}
Student 1 - Username: student1, Password: ${studentPassword}
Student 2 - Username: student2, Password: ${studentPassword}

Please record these passwords immediately, enforce password changes on login, and DELETE this file!
`;
    fs.writeFileSync(credsPath, credsContent, { mode: 0o600 });
    console.log(`[SECURITY INFO] Production credentials written securely to local file: ${credsPath}`);
  } else {
    console.log('--------------------------------------------------');
    console.log('Seeded Users Credentials (Development):');
    console.log(`Admin - Username: admin, Password: ${adminPassword}`);
    console.log(`Student 1 - Username: student1, Password: ${studentPassword}`);
    console.log(`Student 2 - Username: student2, Password: ${studentPassword}`);
    console.log('--------------------------------------------------');
  }

  // 6. Create Labs
  console.log('Seeding labs...');
  const physicsLabId = crypto.randomUUID();
  const chemistryLabId = crypto.randomUUID();

  await query(
    `INSERT INTO labs (lab_id, lab_name, description, location, admin_id) VALUES (?, ?, ?, ?, ?)`,
    [physicsLabId, 'Physics Laboratory', 'General and Advanced Physics experiments, covering electromagnetism, optics, and classical mechanics.', 'Block 1, Room 105', adminId]
  );
  await query(
    `INSERT INTO labs (lab_id, lab_name, description, location, admin_id) VALUES (?, ?, ?, ?, ?)`,
    [chemistryLabId, 'Chemistry Laboratory', 'General Chemistry experiments, covering organic synthesis, titration, and analytical chemistry.', 'Block 4, Room 302', adminId]
  );

  // 7. Map Labs to Branches
  console.log('Mapping labs to branches...');
  // Physics lab allowed for CSE & ECE
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [physicsLabId, branchCSEId]);
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [physicsLabId, branchECEId]);

  // Chemistry lab allowed for CSE, ECE, & Mechanical
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [chemistryLabId, branchCSEId]);
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [chemistryLabId, branchECEId]);
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [chemistryLabId, branchMECHId]);

  // 8. Create Experiments
  console.log('Seeding experiments...');
  const expOhmId = crypto.randomUUID();
  const expPendulumId = crypto.randomUUID();
  const expTitrationId = crypto.randomUUID();

  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [expOhmId, physicsLabId, "Verification of Ohm's Law", 'Verify the linear relationship between voltage and current in a metallic conductor.', 1]
  );
  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [expPendulumId, physicsLabId, 'Simple Pendulum Experiment', 'Determine the acceleration due to gravity using a simple pendulum.', 2]
  );
  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [expTitrationId, chemistryLabId, 'Acid-Base Titration', 'Determine the concentration of an unknown hydrochloric acid solution using sodium hydroxide.', 3]
  );

  // 9. Create Experiment Content Versions & Checklists
  console.log('Seeding content versions and checklist items...');

  // Ohm's Law Content
  const ohmVerId = crypto.randomUUID();
  const ohmTheory = [
    { type: "heading", text: "Introduction to Ohm's Law" },
    { type: "text", text: "Ohm's Law states that the current (I) flowing through a conductor is directly proportional to the potential difference (V) applied across its ends, provided the physical conditions (like temperature) remain constant." },
    { type: "equation", text: "V = I * R" },
    { type: "text", text: "Where V is voltage in volts, I is current in amperes, and R is resistance in ohms (Ω)." },
    { type: "warning", text: "Ensure the power supply is set to 0V before starting connections to avoid damaging the ammeter or voltmeter." },
    { type: "heading", text: "Experimental Procedure" },
    { type: "text", text: "1. Connect the resistance wire, ammeter, battery, rheostat, and key in series.\n2. Connect the voltmeter in parallel across the resistance wire.\n3. Close the key and adjust the rheostat to get the minimum reading on the ammeter and voltmeter.\n4. Note the readings of V and I.\n5. Gradually increase the voltage and take 5 distinct sets of readings." }
  ];
  const ohmVideos = [
    { id: "v-ohm-yt", type: "youtube", url: "https://www.youtube.com/watch?v=Ke5N399gT3c", title: "Ohm's Law Animation & Demonstration", min_duration: 60 },
    { id: "v-ohm-fac", type: "faculty", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", title: "Faculty Instruction: Ohm's Law Circuit Setup", min_duration: 300 }
  ];
  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [ohmVerId, expOhmId, 1, JSON.stringify(ohmTheory), JSON.stringify(ohmVideos)]
  );

  const ohmChecklist = [
    "Verify ammeter is in series and voltmeter is in parallel.",
    "Ensure power supply is set to 0V before switching on the power source.",
    "Record 5 distinct current (I) and voltage (V) values from the instruments.",
    "Calculate resistance (R) for each pair of values and find the average."
  ];
  for (let i = 0; i < ohmChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), ohmVerId, ohmChecklist[i], i + 1]
    );
  }

  // Pendulum Content
  const penVerId = crypto.randomUUID();
  const penTheory = [
    { type: "heading", text: "The Simple Pendulum" },
    { type: "text", text: "A simple pendulum consists of a small metallic bob suspended by a light, inextensible string from a rigid support. When pulled aside and released, it executes simple harmonic motion." },
    { type: "equation", text: "T = 2 * pi * sqrt(L / g)" },
    { type: "text", text: "Where T is the time period, L is the length of the pendulum, and g is the acceleration due to gravity." },
    { type: "heading", text: "Experimental Procedure" },
    { type: "text", text: "1. Measure the diameter of the bob using calipers and find its radius.\n2. Tie a thread to the bob and suspend it from a clamp. Measure the length from the suspension point to the top of the bob.\n3. Displace the bob slightly and release it, ensuring it oscillates in a straight line without spinning.\n4. Measure the time for 20 oscillations using a stopwatch.\n5. Repeat for three different lengths of the string." }
  ];
  const penVideos = [
    { id: "v-pen-yt", type: "youtube", url: "https://www.youtube.com/watch?v=02w9lSii_Hs", title: "Simple Pendulum Physics Concept", min_duration: 60 }
  ];
  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [penVerId, expPendulumId, 1, JSON.stringify(penTheory), JSON.stringify(penVideos)]
  );

  const penChecklist = [
    "Measure and record the radius of the pendulum bob.",
    "Ensure the amplitude of oscillation is small (less than 15 degrees).",
    "Record time taken for 20 oscillations for 3 different string lengths.",
    "Plot L vs T^2 graph and determine the slope to calculate 'g'."
  ];
  for (let i = 0; i < penChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), penVerId, penChecklist[i], i + 1]
    );
  }

  // Titration Content
  const titVerId = crypto.randomUUID();
  const titTheory = [
    { type: "heading", text: "Volumetric Analysis: Titration" },
    { type: "text", text: "Titration is a technique where a solution of known concentration (titrant) is used to determine the concentration of an unknown solution (analyte). In an acid-base neutralization titration, an indicator is used to detect the endpoint." },
    { type: "equation", text: "M1 * V1 = M2 * V2" },
    { type: "warning", text: "HCl and NaOH are corrosive. Wear safety goggles and gloves at all times." },
    { type: "heading", text: "Experimental Procedure" },
    { type: "text", text: "1. Rinse and fill the burette with the standard 0.1M NaOH solution.\n2. Pipette 10ml of the unknown HCl solution into a clean conical flask.\n3. Add 2-3 drops of Phenolphthalein indicator to the flask (it should remain colorless).\n4. Slowly add NaOH from the burette while swirling, until a permanent faint pink color persists.\n5. Note the final burette reading." }
  ];
  const titVideos = [
    { id: "v-tit-yt", type: "youtube", url: "https://www.youtube.com/watch?v=sFpFCPTDv2w", title: "Standard Titration Technique Walkthrough", min_duration: 60 }
  ];
  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [titVerId, expTitrationId, 1, JSON.stringify(titTheory), JSON.stringify(titVideos)]
  );

  const titChecklist = [
    "Rinse burette with NaOH and pipette with HCl before starting.",
    "Ensure there are no air bubbles in the nozzle of the burette.",
    "Add exactly 2-3 drops of Phenolphthalein indicator.",
    "Titrate to a permanent faint pink color (endpoint).",
    "Record initial and final volumes for three concordant runs."
  ];
  for (let i = 0; i < titChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), titVerId, titChecklist[i], i + 1]
    );
  }

  // 10. Seed Audit Log
  console.log('Seeding audit logs...');
  await query(
    `INSERT INTO audit_logs (log_id, actor_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      adminId,
      'SEED_DATABASE',
      'SYSTEM',
      null,
      JSON.stringify({ message: "Initial SJC university seed loaded with CSE, ECE, MECH branches, linked lab access controls." })
    ]
  );

  console.log('Database seeded successfully!');
  
  const activePool = await getPool();
  await activePool.end();
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
