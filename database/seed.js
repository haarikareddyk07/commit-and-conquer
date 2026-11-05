const path = require('path');
// Ensure module lookup checks backend/node_modules
const backendNodeModules = path.resolve(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.push(backendNodeModules);
}

const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, 'smarttrust.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

console.log('Seeding SmartTrust database at:', dbPath);

// Initialize schema
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Clean up existing demo data if needed for idempotent seed
const runSeed = db.transaction(() => {
  // Clear tables in reverse dependency order
  db.exec('DELETE FROM audit_log');
  db.exec('DELETE FROM alerts');
  db.exec('DELETE FROM energy_baselines');
  db.exec('DELETE FROM approval_history');
  db.exec('DELETE FROM waste_records');
  db.exec('DELETE FROM production_records');
  db.exec('DELETE FROM hygiene_records');
  db.exec('DELETE FROM energy_records');
  db.exec('DELETE FROM uploads');
  db.exec('DELETE FROM sanitation_schedules');
  db.exec('DELETE FROM areas');
  db.exec('DELETE FROM machines');
  db.exec('DELETE FROM materials');
  db.exec('DELETE FROM products');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM departments');

  // Reset auto-increment
  try {
    db.exec("DELETE FROM sqlite_sequence");
  } catch(e) {}

  // 1. Departments
  const deptStmt = db.prepare('INSERT INTO departments (id, name) VALUES (?, ?)');
  deptStmt.run(1, 'Receiving');
  deptStmt.run(2, 'Pasteurisation');
  deptStmt.run(3, 'Packaging');
  deptStmt.run(4, 'Cold Storage');
  deptStmt.run(5, 'Cleaning');

  // 2. Users (bcrypt hash for Demo@1234)
  const passwordHash = bcrypt.hashSync('Demo@1234', 10);
  const userStmt = db.prepare('INSERT INTO users (id, full_name, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
  userStmt.run(1, 'Emma Watson (Employee)', 'employee@smarttrust.demo', passwordHash, 'EMPLOYEE', 2, 1);
  userStmt.run(2, 'Sarah Jenkins (Supervisor)', 'supervisor@smarttrust.demo', passwordHash, 'SUPERVISOR', 2, 1);
  userStmt.run(3, 'Michael Chang (Manager)', 'manager@smarttrust.demo', passwordHash, 'MANAGER', null, 1);

  // 3. Machines
  const machineStmt = db.prepare('INSERT INTO machines (id, machine_code, name, department_id, machine_type, rated_power_kw, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
  machineStmt.run(1, 'PAST-01', 'High-Temp Pasteuriser 1', 2, 'PASTEURISER', 75.0, 1);
  machineStmt.run(2, 'HOMO-01', 'Milk Homogeniser A', 2, 'HOMOGENISER', 45.0, 1);
  machineStmt.run(3, 'CHIL-01', 'Primary Glycol Chiller', 4, 'CHILLER', 90.0, 1);
  machineStmt.run(4, 'PACK-01', 'Tetra Pak Filling Line 1', 3, 'FILLING_LINE', 35.0, 1);
  machineStmt.run(5, 'CIP-01', 'Automated CIP Skid 1', 5, 'CIP_UNIT', 30.0, 1);

  // 4. Areas
  const areaStmt = db.prepare('INSERT INTO areas (id, name, department_id, area_type) VALUES (?, ?, ?, ?)');
  areaStmt.run(1, 'Pasteuriser Holding Tube & Plates', 2, 'EQUIPMENT');
  areaStmt.run(2, 'Processing Room Central Floor', 2, 'FLOOR');
  areaStmt.run(3, 'Raw Milk Silo Tank 1', 1, 'TANK');
  areaStmt.run(4, 'Pasteurised Milk Transfer Line B', 2, 'PIPELINE');
  areaStmt.run(5, 'Packaging Cleanroom Floor', 3, 'FLOOR');

  // 5. Sanitation Schedules
  const schedStmt = db.prepare(`
    INSERT INTO sanitation_schedules (id, area_id, task_name, frequency, shift, due_time, grace_minutes, required_chemical, min_concentration_percent, max_concentration_percent, min_contact_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  schedStmt.run(1, 1, 'Pasteuriser Caustic & Acid CIP Wash', 'PER_SHIFT', 'MORNING', '06:00', 30, 'Sodium Hydroxide 2%', 1.8, 2.2, 20);
  schedStmt.run(2, 2, 'Processing Floor Sanitising Rinse', 'DAILY', 'AFTERNOON', '14:00', 45, 'Peracetic Acid 0.5%', 0.4, 0.6, 15);
  schedStmt.run(3, 3, 'Raw Milk Tank Deep Sanitisation', 'WEEKLY', 'NIGHT', '22:00', 60, 'Chlorine Dioxide 100ppm', 1.0, 1.5, 30);
  schedStmt.run(4, 4, 'Pipeline Sanitisation Flush', 'PER_SHIFT', 'MORNING', '07:00', 30, 'Peracetic Acid 0.2%', 0.15, 0.25, 10);
  schedStmt.run(5, 5, 'Packaging Line Scrub & Disinfection', 'DAILY', 'NIGHT', '23:00', 45, 'Quaternary Ammonium 1%', 0.8, 1.2, 20);

  // 6. Products
  const prodStmt = db.prepare('INSERT INTO products (id, product_code, name, unit, expected_loss_percent) VALUES (?, ?, ?, ?, ?)');
  prodStmt.run(1, 'PROD-MILK-1L', 'Toned Milk 1L Pouch', 'LITRE', 2.5);
  prodStmt.run(2, 'PROD-CURD-500G', 'Standard Curd 500g Tub', 'KG', 3.0);
  prodStmt.run(3, 'PROD-BTR-200G', 'Salted Table Butter 200g', 'KG', 1.8);
  prodStmt.run(4, 'PROD-PAN-1KG', 'Fresh Malai Paneer 1kg', 'KG', 4.0);

  // 7. Materials
  const matStmt = db.prepare('INSERT INTO materials (id, material_code, name, unit, expected_loss_percent) VALUES (?, ?, ?, ?, ?)');
  matStmt.run(1, 'MAT-RAW-MILK', 'Raw Whole Milk', 'LITRE', 2.0);
  matStmt.run(2, 'MAT-POLY-FILM', 'LDPE Pouch Film Rolls', 'KG', 1.5);
  matStmt.run(3, 'MAT-SALT', 'Vacuum Iodised Salt', 'KG', 0.5);
  matStmt.run(4, 'MAT-TUB-500', 'Polypropylene 500g Tubs', 'KG', 1.0);

  // 8. Historical Energy Records (45 days to support 30 approved records baseline)
  const energyStmt = db.prepare(`
    INSERT INTO energy_records (id, machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh, consumption_kwh, runtime_hours, notes, status, reviewed_by, reviewed_at, review_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let energyId = 1;
  const now = new Date();
  for (let i = 45; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    
    // Machine 1: Pasteuriser, morning shift. Mean consumption ~350 kWh
    const baseConsumption = 345 + (i % 7) * 2;
    const start = 10000 + (45 - i) * 360;
    const end = start + baseConsumption;
    energyStmt.run(
      energyId++,
      1,
      1,
      dateStr,
      'MORNING',
      start,
      end,
      baseConsumption,
      7.5,
      `Standard morning shift run day -${i}`,
      'APPROVED',
      2,
      `${dateStr}T15:30:00Z`,
      'Approved after shift audit'
    );
  }

  // Add 1 Pending Energy Record
  const todayStr = now.toISOString().split('T')[0];
  energyStmt.run(
    energyId++,
    1,
    1,
    todayStr,
    'MORNING',
    27000,
    27360,
    360,
    7.5,
    'Current morning shift pending approval',
    'PENDING',
    null,
    null,
    null
  );

  // 9. Historical Production Records
  const prodRecStmt = db.prepare(`
    INSERT INTO production_records (id, product_id, batch_no, production_date, shift, raw_input_qty, actual_output_qty, unit, entered_by, notes, status, reviewed_by, reviewed_at, review_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let prodId = 1;
  for (let i = 15; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    // Product 1: Expected loss 2.5%, raw 5000L, actual 4880L (2.4% loss)
    prodRecStmt.run(
      prodId++,
      1,
      `BATCH-MK-${20261000 + i}`,
      dateStr,
      'MORNING',
      5000.0,
      4880.0,
      'LITRE',
      1,
      `Batch MK ${i} regular production`,
      'APPROVED',
      2,
      `${dateStr}T16:00:00Z`,
      'Approved within yield tolerance'
    );
  }

  // 10. Historical Hygiene Records
  const hygStmt = db.prepare(`
    INSERT INTO hygiene_records (id, schedule_id, area_id, entered_by, scheduled_date, completed_at, chemical_used, concentration_percent, contact_minutes, checklist_json, notes, status, reviewed_by, reviewed_at, review_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let hygId = 1;
  for (let i = 15; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    hygStmt.run(
      hygId++,
      1,
      1,
      1,
      dateStr,
      `${dateStr}T06:15:00Z`,
      'Sodium Hydroxide 2%',
      2.0,
      22,
      JSON.stringify({ rinse_clear: true, temp_above_70c: true, ph_neutral_after_rinse: true }),
      `CIP cycle completed on schedule day -${i}`,
      'APPROVED',
      2,
      `${dateStr}T08:00:00Z`,
      'Approved on-time CIP log'
    );
  }

  // 11. Historical Waste Records
  const wasteStmt = db.prepare(`
    INSERT INTO waste_records (id, production_record_id, material_id, record_date, shift, waste_type, quantity, unit, cause, entered_by, status, reviewed_by, reviewed_at, review_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let wasteId = 1;
  for (let i = 10; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    wasteStmt.run(
      wasteId++,
      i,
      1,
      dateStr,
      'MORNING',
      'CLEANING_LOSS',
      35.0,
      'LITRE',
      'Residual pipe drain during CIP switchover',
      1,
      'APPROVED',
      2,
      `${dateStr}T16:30:00Z`,
      'Approved standard cleaning loss'
    );
  }

  // 12. Energy Baseline for Machine 1, Morning
  const baseStmt = db.prepare(`
    INSERT INTO energy_baselines (id, machine_id, shift, mean_kwh, std_dev_kwh, sample_count, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  baseStmt.run(1, 1, 'MORNING', 351.0, 6.2, 30, new Date().toISOString());

  // 13. Approval history entries
  const histStmt = db.prepare(`
    INSERT INTO approval_history (record_type, record_id, action, acted_by, comment, acted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  histStmt.run('energy', energyId - 1, 'SUBMITTED', 1, 'Submitted morning meter reading', new Date().toISOString());
});

runSeed();
console.log('Seed completed successfully!');
db.close();
