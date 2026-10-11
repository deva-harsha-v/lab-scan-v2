const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool, query } = require('./db');
const { runMigration } = require('./migrate');

async function runSeed() {
  console.log('Starting comprehensive database seeding with labs, experiments, questionnaires, and resources...');

  // 1. Run migrations first programmatically
  await runMigration(false);

  // 2. Clean existing experiment and session tables in correct foreign key order
  console.log('Cleaning existing experimental and session data...');
  const tablesToClear = [
    'audit_logs',
    'student_questionnaire_responses',
    'student_checklist_progress',
    'student_sessions',
    'refresh_tokens',
    'experiment_questionnaire_items',
    'experiment_book_references',
    'virtual_lab_links',
    'experiment_manual_documents',
    'checklist_items',
    'experiment_content_versions',
    'experiments',
    'lab_branches',
    'labs'
  ];

  for (const table of tablesToClear) {
    try {
      await query(`DELETE FROM \`${table}\``);
    } catch (err) {
      console.warn(`Could not clear table ${table}:`, err.message);
    }
  }

  // 3. Ensure Institution exists
  console.log('Configuring institution...');
  const instId = '11111111-1111-1111-1111-111111111111';
  const existingInst = await query('SELECT institution_id FROM institutions WHERE institution_id = ?', [instId]);
  if (existingInst.length === 0) {
    await query(
      `INSERT INTO institutions (institution_id, name, short_name, logo) VALUES (?, ?, ?, ?)`,
      [instId, 'St. Jude Engineering College', 'SJC', '']
    );
  } else {
    await query(
      `UPDATE institutions SET name = ?, short_name = ? WHERE institution_id = ?`,
      ['St. Jude Engineering College', 'SJC', instId]
    );
  }

  // 4. Ensure Branches exist (CSE, ECE, Mechanical)
  console.log('Configuring academic branches...');
  const branchCSEId = '22222222-2222-2222-2222-222222222221';
  const branchECEId = '22222222-2222-2222-2222-222222222222';
  const branchMECHId = '22222222-2222-2222-2222-222222222223';

  const branches = [
    { id: branchCSEId, name: 'CSE' },
    { id: branchECEId, name: 'ECE' },
    { id: branchMECHId, name: 'Mechanical' }
  ];

  for (const b of branches) {
    const existingBranch = await query('SELECT branch_id FROM branches WHERE branch_id = ?', [b.id]);
    if (existingBranch.length === 0) {
      await query(`INSERT INTO branches (branch_id, name) VALUES (?, ?)`, [b.id, b.name]);
    }
  }

  // 5. Configure Users (admin + sample students)
  console.log('Configuring users (admin, students)...');
  const adminId = '33333333-3333-3333-3333-333333333333';
  const student1Id = '44444444-4444-4444-4444-444444444441';
  const student2Id = '44444444-4444-4444-4444-444444444442';

  const defaultPassword = 'Password@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // Admin user
  const existingAdmin = await query('SELECT user_id FROM users WHERE username = ?', ['admin']);
  if (existingAdmin.length === 0) {
    await query(
      `INSERT INTO users (user_id, username, password_hash, role, full_name, institution_id, force_password_change) 
       VALUES (?, ?, ?, ?, ?, ?, false)`,
      [adminId, 'admin', passwordHash, 'admin', 'System Administrator', instId]
    );
  } else {
    await query(
      `UPDATE users SET password_hash = ?, role = 'admin', institution_id = ?, force_password_change = false WHERE username = 'admin'`,
      [passwordHash, instId]
    );
  }

  // Student 1 (CSE)
  const existingStudent1 = await query('SELECT user_id FROM users WHERE username = ?', ['student1']);
  if (existingStudent1.length === 0) {
    await query(
      `INSERT INTO users (user_id, username, password_hash, role, full_name, roll_number, branch_id, institution_id, force_password_change) 
       VALUES (?, ?, ?, 'student', 'Amit Kumar', '2024CSE001', ?, ?, false)`,
      [student1Id, 'student1', passwordHash, branchCSEId, instId]
    );
  } else {
    await query(
      `UPDATE users SET password_hash = ?, branch_id = ?, force_password_change = false WHERE username = 'student1'`,
      [passwordHash, branchCSEId]
    );
  }

  // Student 2 (ECE)
  const existingStudent2 = await query('SELECT user_id FROM users WHERE username = ?', ['student2']);
  if (existingStudent2.length === 0) {
    await query(
      `INSERT INTO users (user_id, username, password_hash, role, full_name, roll_number, branch_id, institution_id, force_password_change) 
       VALUES (?, ?, ?, 'student', 'John Doe', '2024ECE002', ?, ?, false)`,
      [student2Id, 'student2', passwordHash, branchECEId, instId]
    );
  } else {
    await query(
      `UPDATE users SET password_hash = ?, branch_id = ?, force_password_change = false WHERE username = 'student2'`,
      [passwordHash, branchECEId]
    );
  }

  // 6. Create 2 Laboratories
  console.log('Seeding 2 laboratories...');
  const physicsLabId = '55555555-5555-5555-5555-555555555551';
  const chemistryLabId = '55555555-5555-5555-5555-555555555552';

  await query(
    `INSERT INTO labs (lab_id, lab_name, description, location, admin_id) VALUES (?, ?, ?, ?, ?)`,
    [
      physicsLabId,
      'Physics & Electronics Laboratory',
      'Core undergraduate physics and foundational electronics laboratory covering optics, mechanics, circuit laws, and electromagnetic phenomena.',
      'Science Block A, Room 204',
      adminId
    ]
  );

  await query(
    `INSERT INTO labs (lab_id, lab_name, description, location, admin_id) VALUES (?, ?, ?, ?, ?)`,
    [
      chemistryLabId,
      'Advanced Chemistry & Materials Laboratory',
      'Equipped for analytical chemistry, volumetric titration, acid-base equilibria, chemical reaction kinetics, and water quality diagnostics.',
      'Chemical Sciences Wing, Room 310',
      adminId
    ]
  );

  // 7. Map Labs to Branches
  console.log('Mapping laboratory access to academic branches...');
  // Physics lab assigned to CSE and ECE
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [physicsLabId, branchCSEId]);
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [physicsLabId, branchECEId]);

  // Chemistry lab assigned to CSE, ECE, and Mechanical
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [chemistryLabId, branchCSEId]);
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [chemistryLabId, branchECEId]);
  await query(`INSERT INTO lab_branches (lab_id, branch_id) VALUES (?, ?)`, [chemistryLabId, branchMECHId]);

  // 8. Create Experiments
  console.log('Seeding experiments, theory, YouTube links, checklists, questionnaires, book references & virtual labs...');

  // -------------------------------------------------------------
  // EXPERIMENT 1: Verification of Ohm's Law (Physics Lab, Marker 1)
  // -------------------------------------------------------------
  const expOhmId = '66666666-6666-6666-6666-666666666661';
  const ohmVerId = '77777777-7777-7777-7777-777777777771';

  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [
      expOhmId,
      physicsLabId,
      "Verification of Ohm's Law",
      "Investigate and verify the direct proportional relationship between voltage (V) and current (I) across a metallic conductor at constant temperature.",
      1
    ]
  );

  const ohmTheory = [
    { type: "heading", text: "Objective & Theoretical Foundation" },
    { type: "text", text: "Ohm's Law states that the electric current (I) flowing through an ideal conductor between two points is directly proportional to the potential difference (V) across the two points, provided physical conditions such as temperature remain constant." },
    { type: "equation", text: "V = I * R  =>  R = V / I" },
    { type: "text", text: "Where V is potential difference in Volts (V), I is current in Amperes (A), and R is resistance in Ohms (Ω). The V-I characteristic graph of an ohmic conductor yields a straight line passing through the origin, whose slope represents the resistance R." },
    { type: "warning", text: "Ensure the DC power supply dial is set to 0V before switching on the power mains to prevent ammeter needle deflection damage." },
    { type: "heading", text: "Step-by-Step Experimental Procedure" },
    { type: "text", text: "1. Connect the resistance coil, ammeter (0-3A), battery eliminator, key, and rheostat in series.\n2. Connect the voltmeter (0-5V) in parallel across the resistance coil.\n3. Verify all terminals are clean and screwed tight.\n4. Close the circuit key and adjust the rheostat slider to obtain minimum readable deflection on both meters.\n5. Incrementally increase the voltage in steps of 0.5V and record corresponding current and voltage values for 5 distinct trials.\n6. Compute R = V / I for each reading and plot the V versus I curve." }
  ];

  const ohmVideos = [
    {
      id: "v-ohm-1",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=Ke5N399gT3c",
      title: "Ohm's Law Circuit Setup & Demonstration",
      min_duration: 60
    },
    {
      id: "v-ohm-2",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=HsLLq6Rm54U",
      title: "Understanding Resistors, Voltage and Current Flow",
      min_duration: 60
    }
  ];

  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [ohmVerId, expOhmId, 1, JSON.stringify(ohmTheory), JSON.stringify(ohmVideos)]
  );

  const ohmChecklist = [
    "Verify multimeter leads are set to DC mode (Ammeter in series, Voltmeter in parallel).",
    "Confirm DC power supply is dialed to 0V before switching on workbench power.",
    "Ensure all circuit terminal connections are firm and contact points are clean.",
    "Record 5 distinct sets of (V, I) readings at incremental intervals of 0.5V.",
    "Plot V vs I characteristic graph and calculate the slope to determine resistance R."
  ];

  for (let i = 0; i < ohmChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), ohmVerId, ohmChecklist[i], i + 1]
    );
  }

  const ohmQuestions = [
    { text: "Does the resistance of a pure metallic conductor remain constant when temperature increases significantly?", type: "boolean", order: 1, correct_bool: false, correct_text: null, marks: 1 },
    { text: "Is an ideal voltmeter connected in parallel across the resistor under test?", type: "boolean", order: 2, correct_bool: true, correct_text: null, marks: 1 },
    { text: "What is the physical significance of the slope of the V-I characteristic curve?", type: "text", order: 3, correct_bool: null, correct_text: "Resistance / Electrical Resistance (R = V/I)", marks: 1 },
    { text: "Can Ohm's law be applied directly to non-linear components such as semiconductor diodes?", type: "boolean", order: 4, correct_bool: false, correct_text: null, marks: 1 },
    { text: "State one primary source of experimental error during current measurement in this circuit.", type: "text", order: 5, correct_bool: null, correct_text: "Joule heating / Contact resistance / Parallax error / Instrument zero error", marks: 1 }
  ];

  for (const q of ohmQuestions) {
    await query(
      `INSERT INTO experiment_questionnaire_items (question_id, content_version_id, question_text, question_type, question_order, correct_answer_boolean, correct_answer_text, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), ohmVerId, q.text, q.type, q.order, q.correct_bool, q.correct_text, q.marks || 1]
    );
  }

  const ohmBooks = [
    { title: "Fundamentals of Physics (10th Edition)", author: "David Halliday, Robert Resnick, Jearl Walker", link: "https://www.wiley.com/en-us/Fundamentals+of+Physics%2C+10th+Edition-p-9781118230718" },
    { title: "Practical Physics for Degree Students", author: "C. L. Arora", link: "https://www.s-chand.com/practical-physics" }
  ];

  for (const b of ohmBooks) {
    await query(
      `INSERT INTO experiment_book_references (reference_id, content_version_id, title, author, link) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), ohmVerId, b.title, b.author, b.link]
    );
  }

  const ohmVirtualLabs = [
    {
      title: "Ohm's Law Virtual Lab Simulator",
      url: "https://vlab.amrita.edu/?sub=1&brch=192&sim=546&cnt=1",
      provider: "Amrita Virtual Labs / Ministry of Education",
      desc: "Interactive circuit simulator for verifying Ohm's Law with variable resistors and DC meters."
    },
    {
      title: "PhET Circuit Construction Kit: DC",
      url: "https://phet.colorado.edu/en/simulations/circuit-construction-kit-dc",
      provider: "PhET Interactive Simulations (Univ. of Colorado)",
      desc: "Interactive simulator to build circuits with resistors, light bulbs, batteries, and ammeters."
    }
  ];

  for (const vl of ohmVirtualLabs) {
    await query(
      `INSERT INTO virtual_lab_links (link_id, content_version_id, title, url, provider_name, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), ohmVerId, vl.title, vl.url, vl.provider, vl.desc]
    );
  }

  await query(
    `INSERT INTO experiment_manual_documents (document_id, content_version_id, title, document_url, file_type) VALUES (?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      ohmVerId,
      "Ohm's Law Laboratory Manual & Observation Guide",
      "https://www.vlab.co.in/broad-area-physical-sciences",
      "pdf"
    ]
  );

  // -------------------------------------------------------------
  // EXPERIMENT 2: Simple Pendulum (Physics Lab, Marker 2)
  // -------------------------------------------------------------
  const expPenId = '66666666-6666-6666-6666-666666666662';
  const penVerId = '77777777-7777-7777-7777-777777777772';

  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [
      expPenId,
      physicsLabId,
      "Simple Pendulum & Acceleration Due to Gravity",
      "Measure local acceleration due to gravity (g) using a simple harmonic pendulum and evaluate experimental percentage error.",
      2
    ]
  );

  const penTheory = [
    { type: "heading", text: "Principle of the Simple Pendulum" },
    { type: "text", text: "A simple pendulum consists of a small heavy spherical bob suspended by a light, inextensible thread from a rigid clamp. When displaced through a small angle and released, it executes simple harmonic motion." },
    { type: "equation", text: "T = 2 * pi * sqrt(L / g)  =>  g = 4 * pi^2 * (L / T^2)" },
    { type: "text", text: "Where T is the time period for one complete oscillation, L is effective length (thread length + radius of bob), and g is acceleration due to gravity." },
    { type: "warning", text: "Keep angular amplitude strictly under 15 degrees. Large angles introduce non-linear restoring forces invalidating the small-angle approximation sin(θ) ≈ θ." },
    { type: "heading", text: "Step-by-Step Experimental Procedure" },
    { type: "text", text: "1. Measure bob diameter using vernier calipers at two perpendicular directions and determine radius r.\n2. Suspend the bob from a rigid clamp using a cotton thread.\n3. Measure length from clamp to top of the bob; add radius r to determine effective length L.\n4. Displace bob slightly (under 15°) and release it in a single vertical plane without wobbling.\n5. Using a digital stopwatch, record time taken for 20 oscillations and calculate period T.\n6. Repeat for 5 different lengths (60cm, 70cm, 80cm, 90cm, 100cm).\n7. Plot L vs T^2 graph and compute g from the slope." }
  ];

  const penVideos = [
    {
      id: "v-pen-1",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=02w9lSii_Hs",
      title: "Simple Pendulum Physics Concept & Execution",
      min_duration: 60
    }
  ];

  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [penVerId, expPenId, 1, JSON.stringify(penTheory), JSON.stringify(penVideos)]
  );

  const penChecklist = [
    "Measure bob radius using vernier calipers and record instrument zero error.",
    "Ensure the angular amplitude of oscillation is strictly under 15 degrees.",
    "Confirm bob oscillates in a single vertical plane without circular precession.",
    "Record time taken for 20 oscillations across 5 distinct suspension lengths.",
    "Plot L vs T^2 graph and calculate local gravitational acceleration g."
  ];

  for (let i = 0; i < penChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), penVerId, penChecklist[i], i + 1]
    );
  }

  const penQuestions = [
    { text: "Does the time period of a simple pendulum depend on the mass or density of the bob?", type: "boolean", order: 1, correct_bool: false, correct_text: null, marks: 1 },
    { text: "Is the small-angle approximation (sin θ ≈ θ) valid for angular displacements exceeding 30 degrees?", type: "boolean", order: 2, correct_bool: false, correct_text: null, marks: 1 },
    { text: "Why should the oscillation amplitude be kept strictly below 15 degrees during this experiment?", type: "text", order: 3, correct_bool: null, correct_text: "To satisfy simple harmonic motion condition / small angle approximation sin θ ≈ θ", marks: 1 },
    { text: "How would the calculated value of 'g' differ if this experiment were conducted on the Moon?", type: "text", order: 4, correct_bool: null, correct_text: "Lower value / approximately 1.62 m/s² / 1/6th of Earth's gravity", marks: 1 }
  ];

  for (const q of penQuestions) {
    await query(
      `INSERT INTO experiment_questionnaire_items (question_id, content_version_id, question_text, question_type, question_order, correct_answer_boolean, correct_answer_text, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), penVerId, q.text, q.type, q.order, q.correct_bool, q.correct_text, q.marks || 1]
    );
  }

  const penBooks = [
    { title: "University Physics with Modern Physics", author: "Hugh D. Young, Roger A. Freedman", link: "https://www.pearson.com/en-us/subject-catalog/p/university-physics-with-modern-physics/P200000003309" }
  ];

  for (const b of penBooks) {
    await query(
      `INSERT INTO experiment_book_references (reference_id, content_version_id, title, author, link) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), penVerId, b.title, b.author, b.link]
    );
  }

  const penVirtualLabs = [
    {
      title: "Simple Pendulum Virtual Simulation",
      url: "https://vlab.amrita.edu/?sub=1&brch=280&sim=152&cnt=1",
      provider: "Amrita Virtual Labs",
      desc: "Simulate pendulum oscillation with adjustable thread length, bob mass, and local gravity."
    },
    {
      title: "PhET Pendulum Lab",
      url: "https://phet.colorado.edu/en/simulations/pendulum-lab",
      provider: "PhET Interactive Simulations",
      desc: "Interactive multi-pendulum simulator with friction, period timer, and energy breakdown graphs."
    }
  ];

  for (const vl of penVirtualLabs) {
    await query(
      `INSERT INTO virtual_lab_links (link_id, content_version_id, title, url, provider_name, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), penVerId, vl.title, vl.url, vl.provider, vl.desc]
    );
  }

  await query(
    `INSERT INTO experiment_manual_documents (document_id, content_version_id, title, document_url, file_type) VALUES (?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      penVerId,
      "Classical Mechanics Simple Pendulum Laboratory Guide",
      "https://www.vlab.co.in/ba-nptel-labs-physics",
      "pdf"
    ]
  );

  // -------------------------------------------------------------
  // EXPERIMENT 3: Acid-Base Titration (Chemistry Lab, Marker 3)
  // -------------------------------------------------------------
  const expTitId = '66666666-6666-6666-6666-666666666663';
  const titVerId = '77777777-7777-7777-7777-777777777773';

  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [
      expTitId,
      chemistryLabId,
      "Acid-Base Neutralization Titration",
      "Determine the exact molarity and strength of an unknown Hydrochloric Acid (HCl) solution using standardized 0.1M Sodium Hydroxide (NaOH).",
      3
    ]
  );

  const titTheory = [
    { type: "heading", text: "Neutralization Reaction & Volumetric Principles" },
    { type: "text", text: "Titration is an analytical quantitative method where a standard solution of known concentration (titrant, NaOH) reacts completely with an analyte of unknown concentration (HCl). At stoichiometric equivalence, moles of H+ ions equal moles of OH- ions." },
    { type: "equation", text: "HCl + NaOH -> NaCl + H2O  =>  M1 * V1 = M2 * V2" },
    { type: "text", text: "Where M1 and V1 are molarity and volume of HCl, while M2 and V2 are molarity and volume of NaOH. Phenolphthalein indicator is colorless in acidic solution and changes to faint pink at pH 8.2-10.0 indicating the endpoint." },
    { type: "warning", text: "Hydrochloric Acid and Sodium Hydroxide are caustic. Always wear chemical splash goggles, protective lab coats, and nitrile gloves." },
    { type: "heading", text: "Step-by-Step Experimental Procedure" },
    { type: "text", text: "1. Rinse and fill the 50 mL burette with standardized 0.1M NaOH solution; expel air bubbles from nozzle.\n2. Rinse a 10 mL pipette with unknown HCl solution, then transfer exactly 10.0 mL of HCl into a clean 250 mL conical flask.\n3. Add 2 drops of Phenolphthalein indicator (solution remains colorless).\n4. Place white tile under flask to clearly visualize color transition.\n5. Slowly titrate with NaOH while swirling continuously until a faint permanent pink color persists for 30 seconds.\n6. Note final burette reading. Repeat until three concordant values (within 0.1 mL) are obtained." }
  ];

  const titVideos = [
    {
      id: "v-tit-1",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=sFpFCPTDv2w",
      title: "Standard Titration Technique & Meniscus Reading",
      min_duration: 60
    },
    {
      id: "v-tit-2",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=r3Hk1dF4e34",
      title: "Acid-Base Titration Calculation & Equivalence Point",
      min_duration: 60
    }
  ];

  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [titVerId, expTitId, 1, JSON.stringify(titTheory), JSON.stringify(titVideos)]
  );

  const titChecklist = [
    "Rinse burette with standardized NaOH and check for air bubble at the nozzle tip.",
    "Pipette out exactly 10.0 mL of unknown HCl into an Erlenmeyer conical flask.",
    "Add exactly 2 drops of Phenolphthalein indicator into the flask.",
    "Titrate dropwise with continuous swirling until a permanent faint pink endpoint appears.",
    "Record initial and final burette readings for three concordant runs (within 0.1 mL)."
  ];

  for (let i = 0; i < titChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), titVerId, titChecklist[i], i + 1]
    );
  }

  const titQuestions = [
    { text: "Does Phenolphthalein indicator exhibit a pink coloration in acidic solutions?", type: "boolean", order: 1, correct_bool: false, correct_text: null, marks: 1 },
    { text: "Should the burette be rinsed with the solution to be filled in it prior to titration?", type: "boolean", order: 2, correct_bool: true, correct_text: null, marks: 1 },
    { text: "Distinguish between the equivalence point and the endpoint of a chemical titration.", type: "text", order: 3, correct_bool: null, correct_text: "Equivalence point is theoretical stoichiometric completion; endpoint is physical indicator color change", marks: 1 },
    { text: "Why must any air bubbles trapped in the burette nozzle be expelled before recording the initial reading?", type: "text", order: 4, correct_bool: null, correct_text: "To prevent volume measurement error / ensure accurate titer volume", marks: 1 }
  ];

  for (const q of titQuestions) {
    await query(
      `INSERT INTO experiment_questionnaire_items (question_id, content_version_id, question_text, question_type, question_order, correct_answer_boolean, correct_answer_text, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), titVerId, q.text, q.type, q.order, q.correct_bool, q.correct_text, q.marks || 1]
    );
  }

  const titBooks = [
    { title: "Vogel's Textbook of Quantitative Chemical Analysis (6th Edition)", author: "J. Mendham, R. C. Denney, J. D. Barnes, M. J. K. Thomas", link: "https://www.pearson.com/en-gb/subject-catalog/p/vogels-textbook-of-quantitative-chemical-analysis/P200000005722" }
  ];

  for (const b of titBooks) {
    await query(
      `INSERT INTO experiment_book_references (reference_id, content_version_id, title, author, link) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), titVerId, b.title, b.author, b.link]
    );
  }

  const titVirtualLabs = [
    {
      title: "Acid-Base Titration Virtual Laboratory",
      url: "https://vlab.amrita.edu/?sub=2&brch=193&sim=352&cnt=1",
      provider: "Amrita Virtual Labs",
      desc: "Perform interactive acid-base neutralization titrations with animated burette drop controls."
    }
  ];

  for (const vl of titVirtualLabs) {
    await query(
      `INSERT INTO virtual_lab_links (link_id, content_version_id, title, url, provider_name, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), titVerId, vl.title, vl.url, vl.provider, vl.desc]
    );
  }

  await query(
    `INSERT INTO experiment_manual_documents (document_id, content_version_id, title, document_url, file_type) VALUES (?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      titVerId,
      "Volumetric Analysis Protocol & Safety Manual",
      "https://www.vlab.co.in/broad-area-chemical-sciences",
      "pdf"
    ]
  );

  // -------------------------------------------------------------
  // EXPERIMENT 4: Water Hardness via EDTA (Chemistry Lab, Marker 4)
  // -------------------------------------------------------------
  const expEdtaId = '66666666-6666-6666-6666-666666666664';
  const edtaVerId = '77777777-7777-7777-7777-777777777774';

  await query(
    `INSERT INTO experiments (experiment_id, lab_id, experiment_name, description, ar_qr_marker_id) VALUES (?, ?, ?, ?, ?)`,
    [
      expEdtaId,
      chemistryLabId,
      "Determination of Water Hardness via EDTA Titration",
      "Estimate total temporary and permanent hardness of a water sample using standard EDTA complexometric titration.",
      4
    ]
  );

  const edtaTheory = [
    { type: "heading", text: "Complexometric Titration Principle" },
    { type: "text", text: "Hardness in water is caused by dissolved bivalent cations, predominantly Ca2+ and Mg2+. Disodium salt of Ethylene Diamine Tetraacetic Acid (EDTA) forms stable 1:1 hexadentate chelate complexes with these ions at pH 10." },
    { type: "equation", text: "M^{2+} + [EDTA]^{4-} -> [M-EDTA]^{2-}" },
    { type: "text", text: "Eriochrome Black T (EBT) indicator forms a weaker wine-red complex with metal ions. When EDTA displaces EBT at the endpoint, free EBT imparts a clear steel-blue color." },
    { type: "warning", text: "Ammonia buffer produces pungent fumes. Handle in a well-ventilated fume hood or workspace." },
    { type: "heading", text: "Step-by-Step Experimental Procedure" },
    { type: "text", text: "1. Fill the burette with standardized 0.01M EDTA solution.\n2. Pipette 50 mL of water sample into a conical flask.\n3. Add 2 mL of NH4Cl-NH4OH buffer solution to maintain pH at 10.0.\n4. Add 2-3 drops of Eriochrome Black T indicator; solution turns wine red.\n5. Titrate against EDTA solution until the wine red color sharply transitions to steel blue.\n6. Calculate total hardness in ppm (mg/L) equivalent of CaCO3." }
  ];

  const edtaVideos = [
    {
      id: "v-edta-1",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=wXWk0X2e3qg",
      title: "Determination of Total Hardness of Water by EDTA Method",
      min_duration: 60
    }
  ];

  await query(
    `INSERT INTO experiment_content_versions (content_version_id, experiment_id, version_number, theory_procedure_json, video_links) VALUES (?, ?, ?, ?, ?)`,
    [edtaVerId, expEdtaId, 1, JSON.stringify(edtaTheory), JSON.stringify(edtaVideos)]
  );

  const edtaChecklist = [
    "Buffer water sample to pH 10 using NH4OH-NH4Cl buffer solution.",
    "Add a pinch of Eriochrome Black T indicator; verify wine-red complex coloration.",
    "Titrate against 0.01M EDTA solution until sharp color change to pure steel blue occurs.",
    "Calculate total hardness in parts per million (ppm) of CaCO3 equivalent."
  ];

  for (let i = 0; i < edtaChecklist.length; i++) {
    await query(
      `INSERT INTO checklist_items (checklist_item_id, content_version_id, item_text, item_order) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), edtaVerId, edtaChecklist[i], i + 1]
    );
  }

  const edtaQuestions = [
    { text: "Does temporary hardness of water arise from dissolved bicarbonates of calcium and magnesium?", type: "boolean", order: 1, correct_bool: true, correct_text: null, marks: 1 },
    { text: "Does Eriochrome Black T indicator turn wine red in the presence of free calcium and magnesium ions at pH 10?", type: "boolean", order: 2, correct_bool: true, correct_text: null, marks: 1 },
    { text: "Why is an ammonia-ammonium chloride buffer solution added to maintain the pH strictly around 10 during EDTA titration?", type: "text", order: 3, correct_bool: null, correct_text: "To maintain pH 10 for optimal stability of Ca-EDTA and Mg-EDTA chelate complexes and sharp EBT endpoint", marks: 1 }
  ];

  for (const q of edtaQuestions) {
    await query(
      `INSERT INTO experiment_questionnaire_items (question_id, content_version_id, question_text, question_type, question_order, correct_answer_boolean, correct_answer_text, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), edtaVerId, q.text, q.type, q.order, q.correct_bool, q.correct_text, q.marks || 1]
    );
  }

  const edtaBooks = [
    { title: "Engineering Chemistry", author: "P. C. Jain and Monika Jain", link: "https://www.dhanpatrai.com/engineering-chemistry" }
  ];

  for (const b of edtaBooks) {
    await query(
      `INSERT INTO experiment_book_references (reference_id, content_version_id, title, author, link) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), edtaVerId, b.title, b.author, b.link]
    );
  }

  const edtaVirtualLabs = [
    {
      title: "Water Hardness Estimation Virtual Experiment",
      url: "https://vlab.amrita.edu/?sub=2&brch=193&sim=575&cnt=1",
      provider: "Amrita Virtual Labs",
      desc: "Interactive complexometric titration for water quality and total hardness testing."
    }
  ];

  for (const vl of edtaVirtualLabs) {
    await query(
      `INSERT INTO virtual_lab_links (link_id, content_version_id, title, url, provider_name, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), edtaVerId, vl.title, vl.url, vl.provider, vl.desc]
    );
  }

  await query(
    `INSERT INTO experiment_manual_documents (document_id, content_version_id, title, document_url, file_type) VALUES (?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      edtaVerId,
      "Water Quality Testing & Hardness Standard Operating Procedure",
      "https://www.vlab.co.in/broad-area-chemical-sciences",
      "pdf"
    ]
  );

  // 9. Seed Audit Log
  console.log('Seeding audit logs...');
  await query(
    `INSERT INTO audit_logs (log_id, actor_id, action_type, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      adminId,
      'SEED_DATABASE',
      'SYSTEM',
      null,
      JSON.stringify({ message: "Comprehensive test data induced: 2 Labs, 4 Experiments, Questionnaires, YouTube links, Virtual Lab links, Book references, Lab manuals." })
    ]
  );

  console.log('==================================================');
  console.log('Database seeded successfully!');
  console.log('Seeded Laboratories:');
  console.log('  1. Physics & Electronics Laboratory (CSE, ECE)');
  console.log('     - Verification of Ohm\'s Law (Marker #1)');
  console.log('     - Simple Pendulum & Acceleration Due to Gravity (Marker #2)');
  console.log('  2. Advanced Chemistry & Materials Laboratory (CSE, ECE, Mechanical)');
  console.log('     - Acid-Base Neutralization Titration (Marker #3)');
  console.log('     - Determination of Water Hardness via EDTA Titration (Marker #4)');
  console.log('Credentials:');
  console.log(`  Admin:    admin    / ${defaultPassword}`);
  console.log(`  Student1: student1 / ${defaultPassword} (CSE)`);
  console.log(`  Student2: student2 / ${defaultPassword} (ECE)`);
  console.log('==================================================');

  const activePool = await getPool();
  await activePool.end();
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
