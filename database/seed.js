/**
 * SmartTrust Dairy Plant Management System - Deterministic Database Seeder
 * Populates realistic dairy plant master data, 45 days of historical APPROVED records,
 * energy baselines, and deliberate operational deviations (energy anomaly, hygiene violation, high-waste batch).
 *
 * Rules:
 *  - Passwords stored as bcrypt hashes only (Demo@1234).
 *  - Deterministic pseudo-random generation using Mulberry32 PRNG (seed = 987654321).
 *  - Idempotent: can be run repeatedly without duplicates or errors.
 *  - Seed data clearly tagged with [DEMO_DATA].
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

// Deterministic Pseudo-Random Number Generator (Mulberry32)
function createRng(initialSeed) {
  let s = initialSeed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed(customDbPath) {
  const dbPath = customDbPath || process.env.DB_PATH || path.join(__dirname, 'smarttrust.db');
  console.log(`[Seed] Seeding database at: ${dbPath}`);

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  const rng = createRng(987654321);

  // Helper for random floats in range [min, max]
  function randFloat(min, max, decimals = 2) {
    const val = min + rng() * (max - min);
    return Number(val.toFixed(decimals));
  }

  // Helper for random integers in range [min, max]
  function randInt(min, max) {
    return Math.floor(min + rng() * (max - min + 1));
  }

  const runSeeder = db.transaction(() => {
    console.log('[Seed] Clearing existing demo records (idempotent reset)...');
    db.prepare('DELETE FROM alerts').run();
    db.prepare('DELETE FROM audit_log').run();
    db.prepare('DELETE FROM energy_baselines').run();
    db.prepare('DELETE FROM approval_history').run();
    db.prepare('DELETE FROM waste_records').run();
    db.prepare('DELETE FROM production_records').run();
    db.prepare('DELETE FROM hygiene_records').run();
    db.prepare('DELETE FROM energy_records').run();
    db.prepare('DELETE FROM uploads').run();
    db.prepare('DELETE FROM sanitation_schedules').run();
    db.prepare('DELETE FROM areas').run();
    db.prepare('DELETE FROM machines').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM materials').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM departments').run();

    // Reset sqlite sequence
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('alerts','audit_log','energy_baselines','approval_history','waste_records','production_records','hygiene_records','energy_records','uploads','sanitation_schedules','areas','machines','products','materials','users','departments')").run();

    // ------------------------------------------------------------------------
    // 1. Departments Master Data
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting departments...');
    const insertDept = db.prepare('INSERT INTO departments (id, name) VALUES (?, ?)');
    const departments = [
      { id: 1, name: 'Receiving' },
      { id: 2, name: 'Pasteurisation' },
      { id: 3, name: 'Packaging' },
      { id: 4, name: 'Cold Storage' },
      { id: 5, name: 'Cleaning' }
    ];
    for (const d of departments) {
      insertDept.run(d.id, d.name);
    }

    // ------------------------------------------------------------------------
    // 2. Demo Users (bcrypt hash for "Demo@1234")
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting demo users with bcrypt hashes...');
    const demoPasswordHash = bcrypt.hashSync('Demo@1234', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, role, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const users = [
      { id: 1, full_name: 'Ramesh Kumar', email: 'employee@smarttrust.demo', role: 'EMPLOYEE', department_id: 2 },
      { id: 2, full_name: 'Priya Sharma', email: 'supervisor@smarttrust.demo', role: 'SUPERVISOR', department_id: 2 },
      { id: 3, full_name: 'Vikram Malhotra', email: 'manager@smarttrust.demo', role: 'MANAGER', department_id: 2 }
    ];
    for (const u of users) {
      insertUser.run(u.id, u.full_name, u.email, demoPasswordHash, u.role, u.department_id);
    }

    // ------------------------------------------------------------------------
    // 3. Machines Master Data
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting machines...');
    const insertMachine = db.prepare(`
      INSERT INTO machines (id, machine_code, name, department_id, machine_type, rated_power_kw, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const machines = [
      { id: 1, machine_code: 'PST-01', name: 'HTST Pasteuriser 01', department_id: 2, machine_type: 'PASTEURISER', rated_power_kw: 45.0 },
      { id: 2, machine_code: 'HOM-01', name: 'High Pressure Homogeniser 01', department_id: 2, machine_type: 'HOMOGENISER', rated_power_kw: 30.0 },
      { id: 3, machine_code: 'CHL-01', name: 'Glycol Industrial Chiller 01', department_id: 4, machine_type: 'CHILLER', rated_power_kw: 55.0 },
      { id: 4, machine_code: 'FIL-01', name: 'Aseptic Pouch Filling Line 01', department_id: 3, machine_type: 'FILLER', rated_power_kw: 22.5 },
      { id: 5, machine_code: 'CIP-01', name: 'Automated Central CIP Unit 01', department_id: 5, machine_type: 'CIP_SYSTEM', rated_power_kw: 37.0 }
    ];
    for (const m of machines) {
      insertMachine.run(m.id, m.machine_code, m.name, m.department_id, m.machine_type, m.rated_power_kw);
    }

    // ------------------------------------------------------------------------
    // 4. Areas Master Data
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting areas...');
    const insertArea = db.prepare(`
      INSERT INTO areas (id, name, department_id, area_type)
      VALUES (?, ?, ?, ?)
    `);
    const areas = [
      { id: 1, name: 'Milk Reception Bay', department_id: 1, area_type: 'FLOOR' },
      { id: 2, name: 'Pasteuriser Line P1', department_id: 2, area_type: 'EQUIPMENT' },
      { id: 3, name: 'Raw Milk Silo Tanks', department_id: 1, area_type: 'TANK' },
      { id: 4, name: 'Transfer Pipeline Loop A', department_id: 2, area_type: 'PIPELINE' },
      { id: 5, name: 'Packaging Hall Floor', department_id: 3, area_type: 'FLOOR' },
      { id: 6, name: 'Cold Storage Room 1', department_id: 4, area_type: 'FLOOR' },
      { id: 7, name: 'Central CIP Loop Tanks', department_id: 5, area_type: 'TANK' }
    ];
    for (const a of areas) {
      insertArea.run(a.id, a.name, a.department_id, a.area_type);
    }

    // ------------------------------------------------------------------------
    // 5. Sanitation Schedules Master Data
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting sanitation schedules...');
    const insertSchedule = db.prepare(`
      INSERT INTO sanitation_schedules (
        id, area_id, task_name, frequency, shift, due_time, grace_minutes,
        required_chemical, min_concentration_percent, max_concentration_percent, min_contact_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const schedules = [
      {
        id: 1,
        area_id: 2,
        task_name: 'CIP Alkaline Wash',
        frequency: 'PER_SHIFT',
        shift: 'MORNING',
        due_time: '13:30',
        grace_minutes: 30,
        required_chemical: 'Sodium Hydroxide (Caustic Soda)',
        min_concentration_percent: 1.5,
        max_concentration_percent: 2.5,
        min_contact_minutes: 20
      },
      {
        id: 2,
        area_id: 2,
        task_name: 'CIP Acid Rinse',
        frequency: 'PER_SHIFT',
        shift: 'AFTERNOON',
        due_time: '21:30',
        grace_minutes: 30,
        required_chemical: 'Nitric Acid',
        min_concentration_percent: 0.8,
        max_concentration_percent: 1.5,
        min_contact_minutes: 15
      },
      {
        id: 3,
        area_id: 3,
        task_name: 'Sanitizing Cold Spray',
        frequency: 'DAILY',
        shift: 'NIGHT',
        due_time: '05:00',
        grace_minutes: 45,
        required_chemical: 'Peracetic Acid (PAA)',
        min_concentration_percent: 0.15,
        max_concentration_percent: 0.30,
        min_contact_minutes: 10
      },
      {
        id: 4,
        area_id: 4,
        task_name: 'Pipeline Sanitization Loop',
        frequency: 'PER_SHIFT',
        shift: 'MORNING',
        due_time: '14:00',
        grace_minutes: 30,
        required_chemical: 'Sodium Hypochlorite',
        min_concentration_percent: 0.5,
        max_concentration_percent: 1.0,
        min_contact_minutes: 15
      },
      {
        id: 5,
        area_id: 5,
        task_name: 'Packaging Floor & Conveyor Sanitization',
        frequency: 'DAILY',
        shift: 'AFTERNOON',
        due_time: '18:00',
        grace_minutes: 60,
        required_chemical: 'Quaternary Ammonium (QAC)',
        min_concentration_percent: 1.0,
        max_concentration_percent: 2.0,
        min_contact_minutes: 15
      }
    ];
    for (const s of schedules) {
      insertSchedule.run(
        s.id, s.area_id, s.task_name, s.frequency, s.shift, s.due_time, s.grace_minutes,
        s.required_chemical, s.min_concentration_percent, s.max_concentration_percent, s.min_contact_minutes
      );
    }

    // ------------------------------------------------------------------------
    // 6. Products Master Data
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting products...');
    const insertProduct = db.prepare(`
      INSERT INTO products (id, product_code, name, unit, expected_loss_percent)
      VALUES (?, ?, ?, ?, ?)
    `);
    const products = [
      { id: 1, product_code: 'PRD-MLK', name: 'Pasteurised Toned Milk', unit: 'LITRE', expected_loss_percent: 1.5 },
      { id: 2, product_code: 'PRD-CRD', name: 'Standard Curd (Dahi)', unit: 'KG', expected_loss_percent: 2.0 },
      { id: 3, product_code: 'PRD-BTR', name: 'Table Butter', unit: 'KG', expected_loss_percent: 3.5 },
      { id: 4, product_code: 'PRD-PNR', name: 'Fresh Paneer', unit: 'KG', expected_loss_percent: 4.0 }
    ];
    for (const p of products) {
      insertProduct.run(p.id, p.product_code, p.name, p.unit, p.expected_loss_percent);
    }

    // ------------------------------------------------------------------------
    // 7. Materials Master Data
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting materials...');
    const insertMaterial = db.prepare(`
      INSERT INTO materials (id, material_code, name, unit, expected_loss_percent)
      VALUES (?, ?, ?, ?, ?)
    `);
    const materials = [
      { id: 1, material_code: 'MAT-RAW-MILK', name: 'Raw Whole Milk', unit: 'LITRE', expected_loss_percent: 1.5 },
      { id: 2, material_code: 'MAT-SKIM-MILK', name: 'Skimmed Milk', unit: 'LITRE', expected_loss_percent: 1.5 },
      { id: 3, material_code: 'MAT-STR-CULT', name: 'Lactic Starter Culture', unit: 'KG', expected_loss_percent: 1.0 },
      { id: 4, material_code: 'MAT-CRM-BULK', name: 'Bulk Heavy Cream', unit: 'LITRE', expected_loss_percent: 2.5 },
      { id: 5, material_code: 'MAT-PKG-POUCH', name: 'LDPE Milk Packaging Film', unit: 'KG', expected_loss_percent: 2.0 },
      { id: 6, material_code: 'MAT-CIT-ACID', name: 'Citric Acid Food Grade', unit: 'KG', expected_loss_percent: 0.5 }
    ];
    for (const mat of materials) {
      insertMaterial.run(mat.id, mat.material_code, mat.name, mat.unit, mat.expected_loss_percent);
    }

    // ------------------------------------------------------------------------
    // 8. 45 Days of Historical APPROVED Data Generation
    // Date range: 2026-09-22 to 2026-11-05 (45 days)
    // ------------------------------------------------------------------------
    console.log('[Seed] Generating 45 days of realistic dairy operations data...');

    const insertEnergy = db.prepare(`
      INSERT INTO energy_records (
        machine_id, entered_by, record_date, shift, reading_start_kwh, reading_end_kwh,
        consumption_kwh, runtime_hours, notes, status, reviewed_by, reviewed_at, review_comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHygiene = db.prepare(`
      INSERT INTO hygiene_records (
        schedule_id, area_id, entered_by, scheduled_date, completed_at,
        chemical_used, concentration_percent, contact_minutes, checklist_json,
        notes, status, reviewed_by, reviewed_at, review_comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertProduction = db.prepare(`
      INSERT INTO production_records (
        product_id, batch_no, production_date, shift, raw_input_qty,
        actual_output_qty, unit, entered_by, notes, status, reviewed_by, reviewed_at, review_comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertWaste = db.prepare(`
      INSERT INTO waste_records (
        production_record_id, material_id, record_date, shift, waste_type,
        quantity, unit, cause, entered_by, status, reviewed_by, reviewed_at, review_comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHistory = db.prepare(`
      INSERT INTO approval_history (record_type, record_id, action, acted_by, comment, acted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Meter cumulative readings starting state
    const meterReadings = {
      1: 15200.0, // PST-01
      2: 9800.0,  // HOM-01
      3: 24500.0, // CHL-01
      4: 7400.0,  // FIL-01
      5: 11200.0  // CIP-01
    };

    const startDate = new Date('2026-09-22T00:00:00Z');
    const totalDays = 45;

    // Track historical consumption to compute exact baselines
    const baselineSamples = {}; // key: `${machine_id}_${shift}` => array of kWh

    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const current = new Date(startDate.getTime() + dayIdx * 86400000);
      const dateStr = current.toISOString().slice(0, 10);
      const isDeviationDay = (dayIdx === 43); // 2026-11-04 (deliberate anomalies)
      const isCurrentDay = (dayIdx === 44);   // 2026-11-05 (pending items)

      // --- A. ENERGY RECORDS ---
      // PST-01 (Morning shift, rated 45kW)
      // Normal: ~290 kWh (runtime 7.2h, ~40.2 kW load)
      const shiftsPst = ['MORNING', 'AFTERNOON'];
      for (const shift of shiftsPst) {
        const startKwh = Number(meterReadings[1].toFixed(2));
        let consumption;
        let runtime = randFloat(6.8, 7.5, 1);
        let status = 'APPROVED';
        let reviewedBy = 2;
        let reviewedAt = `${dateStr}T16:00:00Z`;
        let reviewComment = 'Verified against panel meter';

        if (isDeviationDay && shift === 'MORNING') {
          // DELIBERATE ANOMALY 1: High Energy Consumption Anomaly
          consumption = 412.00;
          runtime = 7.8;
          reviewComment = 'Flagged for review due to high load reading';
        } else if (isCurrentDay && shift === 'AFTERNOON') {
          // PENDING record for today
          consumption = randFloat(285, 295, 2);
          status = 'PENDING';
          reviewedBy = null;
          reviewedAt = null;
          reviewComment = null;
        } else {
          consumption = randFloat(280.0, 300.0, 2);
        }

        const endKwh = Number((startKwh + consumption).toFixed(2));
        meterReadings[1] = endKwh;

        const info = insertEnergy.run(
          1, 1, dateStr, shift, startKwh, endKwh, consumption, runtime,
          '[DEMO_DATA] Daily dairy pasteurisation shift run', status, reviewedBy, reviewedAt, reviewComment
        );
        const erId = info.lastInsertRowid;

        insertHistory.run('energy', erId, 'SUBMITTED', 1, '[DEMO_DATA] Shift meter log entered', `${dateStr}T14:10:00Z`);
        if (status === 'APPROVED') {
          insertHistory.run('energy', erId, 'APPROVED', 2, '[DEMO_DATA] Shift energy log approved', reviewedAt);
          const key = `1_${shift}`;
          if (!baselineSamples[key]) baselineSamples[key] = [];
          baselineSamples[key].push(consumption);
        }

        // DELIBERATE ANOMALY 1 ALERT CREATION
        if (isDeviationDay && shift === 'MORNING') {
          db.prepare(`
            INSERT INTO alerts (
              alert_type, source_record_type, source_record_id, severity, status,
              title, explanation, evidence_json, recommended_action, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'ENERGY', 'energy', erId, 'HIGH', 'OPEN',
            'High Energy Consumption Detected: HTST Pasteuriser 01',
            `HTST Pasteuriser 01 (PST-01) consumed 412.00 kWh on MORNING shift of ${dateStr}. The 30-day baseline for this shift is 290.40 kWh (std dev: 12.15 kWh). Consumption exceeds the upper limit (mean + 3·std = 326.85 kWh) by 26.1%.`,
            JSON.stringify({
              machine_code: 'PST-01',
              shift: 'MORNING',
              consumption_kwh: 412.0,
              baseline_mean: 290.4,
              baseline_std: 12.15,
              threshold_high: 326.85,
              excess_percent: 26.1
            }),
            'Inspect plate heat exchanger for milk stone fouling or scale accumulation. Verify product flow rate, valve bypasses, and check for motor heating or mechanical drag.',
            `${dateStr}T14:15:00Z`
          );
        }
      }

      // HOM-01 (Morning shift, rated 30kW)
      {
        const startKwh = Number(meterReadings[2].toFixed(2));
        const consumption = randFloat(180.0, 198.0, 2);
        const endKwh = Number((startKwh + consumption).toFixed(2));
        meterReadings[2] = endKwh;
        const runtime = randFloat(6.5, 7.2, 1);
        const info = insertEnergy.run(
          2, 1, dateStr, 'MORNING', startKwh, endKwh, consumption, runtime,
          '[DEMO_DATA] Milk homogenization batch run', 'APPROVED', 2, `${dateStr}T16:00:00Z`, 'Within target range'
        );
        insertHistory.run('energy', info.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Logged', `${dateStr}T14:10:00Z`);
        insertHistory.run('energy', info.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T16:00:00Z`);
        const key = '2_MORNING';
        if (!baselineSamples[key]) baselineSamples[key] = [];
        baselineSamples[key].push(consumption);
      }

      // CHL-01 (Industrial Chiller, operates MORNING, AFTERNOON, NIGHT, rated 55kW)
      for (const shift of ['MORNING', 'AFTERNOON', 'NIGHT']) {
        const startKwh = Number(meterReadings[3].toFixed(2));
        let consumption;
        const runtime = 8.0;
        let isMediumAnomaly = (isDeviationDay && shift === 'AFTERNOON');

        if (isMediumAnomaly) {
          // DELIBERATE ANOMALY 2: Medium Energy Anomaly
          consumption = 388.50; // mean ~348, std ~14.2 -> > mean + 2*std (376.4)
        } else {
          consumption = randFloat(340.0, 355.0, 2);
        }

        const endKwh = Number((startKwh + consumption).toFixed(2));
        meterReadings[3] = endKwh;

        const info = insertEnergy.run(
          3, 1, dateStr, shift, startKwh, endKwh, consumption, runtime,
          '[DEMO_DATA] Glycol continuous chilling cycle', 'APPROVED', 2, `${dateStr}T16:00:00Z`, 'Approved'
        );
        const erId = info.lastInsertRowid;
        insertHistory.run('energy', erId, 'SUBMITTED', 1, '[DEMO_DATA] Logged', `${dateStr}T14:10:00Z`);
        insertHistory.run('energy', erId, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T16:00:00Z`);

        const key = `3_${shift}`;
        if (!baselineSamples[key]) baselineSamples[key] = [];
        baselineSamples[key].push(consumption);

        // DELIBERATE ANOMALY 2 ALERT
        if (isMediumAnomaly) {
          db.prepare(`
            INSERT INTO alerts (
              alert_type, source_record_type, source_record_id, severity, status,
              title, explanation, evidence_json, recommended_action, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'ENERGY', 'energy', erId, 'MEDIUM', 'UNDER_REVIEW',
            'Elevated Chiller Power Consumption: Glycol Industrial Chiller 01',
            `Glycol Chiller (CHL-01) consumed 388.50 kWh on AFTERNOON shift of ${dateStr}. Mean baseline is 348.00 kWh (std dev: 14.20 kWh). Consumption exceeds mean + 2·std (376.40 kWh) by 3.2%.`,
            JSON.stringify({
              machine_code: 'CHL-01',
              shift: 'AFTERNOON',
              consumption_kwh: 388.5,
              baseline_mean: 348.0,
              baseline_std: 14.2,
              threshold_medium: 376.4
            }),
            'Check condenser coil for dust blockage or scaling. Verify secondary glycol temperature setpoint and ambient heat load.',
            `${dateStr}T22:15:00Z`
          );
        }
      }

      // FIL-01 (Filling Line, Morning shift, rated 22.5kW)
      {
        const startKwh = Number(meterReadings[4].toFixed(2));
        const consumption = randFloat(135.0, 150.0, 2);
        const endKwh = Number((startKwh + consumption).toFixed(2));
        meterReadings[4] = endKwh;
        const info = insertEnergy.run(
          4, 1, dateStr, 'MORNING', startKwh, endKwh, consumption, 7.0,
          '[DEMO_DATA] Pouch filling operational run', 'APPROVED', 2, `${dateStr}T16:00:00Z`, 'Normal'
        );
        insertHistory.run('energy', info.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Logged', `${dateStr}T14:10:00Z`);
        insertHistory.run('energy', info.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T16:00:00Z`);
        const key = '4_MORNING';
        if (!baselineSamples[key]) baselineSamples[key] = [];
        baselineSamples[key].push(consumption);
      }

      // CIP-01 (CIP System, Morning shift, rated 37kW)
      {
        const startKwh = Number(meterReadings[5].toFixed(2));
        const consumption = randFloat(200.0, 220.0, 2);
        const endKwh = Number((startKwh + consumption).toFixed(2));
        meterReadings[5] = endKwh;
        const info = insertEnergy.run(
          5, 1, dateStr, 'MORNING', startKwh, endKwh, consumption, 6.0,
          '[DEMO_DATA] Daily automated CIP circulation cycle', 'APPROVED', 2, `${dateStr}T16:00:00Z`, 'Normal'
        );
        insertHistory.run('energy', info.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Logged', `${dateStr}T14:10:00Z`);
        insertHistory.run('energy', info.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T16:00:00Z`);
        const key = '5_MORNING';
        if (!baselineSamples[key]) baselineSamples[key] = [];
        baselineSamples[key].push(consumption);
      }

      // --- B. HYGIENE RECORDS ---
      // Schedule 1: CIP Alkaline Wash (Sodium Hydroxide 1.5 - 2.5%, 20m)
      {
        let chem = 'Sodium Hydroxide (Caustic Soda)';
        let conc = randFloat(1.8, 2.2, 2);
        let contact = randInt(22, 28);
        let status = 'APPROVED';
        let reviewComment = 'Chemical titration verified in range';
        let isHygieneViolation = (isDeviationDay);

        if (isHygieneViolation) {
          // DELIBERATE ANOMALY 3: Hygiene Non-Compliance
          conc = 0.80; // Below 1.5% min!
          contact = 12; // Below 20m min!
          status = 'CORRECTION_REQUESTED';
          reviewComment = 'Caustic concentration 0.8% is below mandatory minimum 1.50%. Contact time 12 min is insufficient. Please perform re-wash and resubmit.';
        } else if (isCurrentDay) {
          status = 'PENDING';
          reviewComment = null;
        }

        const info = insertHygiene.run(
          1, 2, 1, dateStr, `${dateStr}T13:45:00Z`, chem, conc, contact,
          JSON.stringify({ pre_rinse_done: true, temp_above_75c: true, titration_checked: true, post_rinse_ph_neutral: true }),
          '[DEMO_DATA] Daily CIP alkaline wash cycle', status, (status === 'PENDING' ? null : 2), (status === 'PENDING' ? null : `${dateStr}T16:00:00Z`), reviewComment
        );
        const hrId = info.lastInsertRowid;
        insertHistory.run('hygiene', hrId, 'SUBMITTED', 1, '[DEMO_DATA] Submitted cleaning log', `${dateStr}T13:50:00Z`);
        if (status === 'APPROVED') {
          insertHistory.run('hygiene', hrId, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T16:00:00Z`);
        } else if (status === 'CORRECTION_REQUESTED') {
          insertHistory.run('hygiene', hrId, 'CORRECTION_REQUESTED', 2, reviewComment, `${dateStr}T16:00:00Z`);

          // DELIBERATE ANOMALY 3 ALERT CREATION
          db.prepare(`
            INSERT INTO alerts (
              alert_type, source_record_type, source_record_id, severity, status,
              title, explanation, evidence_json, recommended_action, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'HYGIENE', 'hygiene', hrId, 'HIGH', 'OPEN',
            'Hygiene Specification Violation: Pasteuriser Line P1',
            `CIP Alkaline Wash recorded on ${dateStr} used chemical concentration 0.80%, which is below the mandatory minimum of 1.50% (range: 1.50%–2.50%). Contact time was 12 minutes (minimum required: 20 minutes).`,
            JSON.stringify({
              schedule_id: 1,
              task: 'CIP Alkaline Wash',
              chemical: 'Sodium Hydroxide (Caustic Soda)',
              actual_concentration: 0.80,
              min_concentration: 1.50,
              max_concentration: 2.50,
              actual_contact_minutes: 12,
              min_contact_minutes: 20
            }),
            'Initiate mandatory re-wash cycle immediately before release for production. Recalibrate dosing pump and audit chemical preparation logs.',
            `${dateStr}T14:00:00Z`
          );
        }
      }

      // Schedule 2: CIP Acid Rinse (Nitric Acid 0.8 - 1.5%, 15m)
      {
        const conc = randFloat(0.9, 1.3, 2);
        const contact = randInt(16, 20);
        const info = insertHygiene.run(
          2, 2, 1, dateStr, `${dateStr}T21:40:00Z`, 'Nitric Acid', conc, contact,
          JSON.stringify({ acid_circulation_done: true, temp_above_60c: true, rinse_complete: true }),
          '[DEMO_DATA] CIP acid de-scaling rinse', 'APPROVED', 2, `${dateStr}T22:00:00Z`, 'Clean'
        );
        insertHistory.run('hygiene', info.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Submitted', `${dateStr}T21:45:00Z`);
        insertHistory.run('hygiene', info.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T22:00:00Z`);
      }

      // Schedule 3: Silo Cold Spray
      {
        const conc = randFloat(0.18, 0.25, 3);
        const contact = randInt(11, 14);
        const info = insertHygiene.run(
          3, 3, 1, dateStr, `${dateStr}T05:20:00Z`, 'Peracetic Acid (PAA)', conc, contact,
          JSON.stringify({ spray_balls_checked: true, drain_opened: true }),
          '[DEMO_DATA] Silo spray sanitization', 'APPROVED', 2, `${dateStr}T06:00:00Z`, 'Verified'
        );
        insertHistory.run('hygiene', info.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Submitted', `${dateStr}T05:25:00Z`);
        insertHistory.run('hygiene', info.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T06:00:00Z`);
      }

      // --- C. PRODUCTION & WASTE RECORDS ---
      // Batch 1: Pasteurised Toned Milk (PRD-MLK, expected loss 1.5%)
      {
        const rawInput = 5000.0;
        const lossPercent = randFloat(1.3, 1.6, 2);
        const output = Number((rawInput * (1 - lossPercent / 100)).toFixed(2));
        const batchNo = `BAT-MLK-${dateStr.replace(/-/g, '')}-01`;

        const pInfo = insertProduction.run(
          1, batchNo, dateStr, 'MORNING', rawInput, output, 'LITRE',
          1, '[DEMO_DATA] Daily toned milk pasteurisation batch', 'APPROVED', 2, `${dateStr}T16:00:00Z`, 'Batch yields within standard'
        );
        const prId = pInfo.lastInsertRowid;
        insertHistory.run('production', prId, 'SUBMITTED', 1, '[DEMO_DATA] Batch record submitted', `${dateStr}T14:30:00Z`);
        insertHistory.run('production', prId, 'APPROVED', 2, '[DEMO_DATA] Batch approved', `${dateStr}T16:00:00Z`);

        // Associated normal waste
        const wasteQty = Number((rawInput - output).toFixed(2));
        const wInfo = insertWaste.run(
          prId, 1, dateStr, 'MORNING', 'CLEANING_LOSS', wasteQty, 'LITRE',
          'Standard pipeline flush and filter residue', 1, 'APPROVED', 2, `${dateStr}T16:00:00Z`, 'Normal loss'
        );
        insertHistory.run('waste', wInfo.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Waste log submitted', `${dateStr}T14:35:00Z`);
        insertHistory.run('waste', wInfo.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T16:00:00Z`);
      }

      // Batch 2: Table Butter (PRD-BTR, expected loss 3.5%)
      {
        const rawInput = 1200.0;
        let lossPercent;
        let isWasteAnomaly = isCurrentDay; // DELIBERATE ANOMALY 4 on day 44 (2026-11-05)

        if (isWasteAnomaly) {
          // DELIBERATE ANOMALY 4: High-Waste Batch (> 2.0x expected loss => HIGH alert)
          lossPercent = 9.17; // 110 kg lost / 1200 kg = 9.17% (expected is 3.5% -> 2.62x)
        } else {
          lossPercent = randFloat(3.1, 3.8, 2);
        }

        const output = Number((rawInput * (1 - lossPercent / 100)).toFixed(2));
        const batchNo = `BAT-BTR-${dateStr.replace(/-/g, '')}-01`;

        const pInfo = insertProduction.run(
          3, batchNo, dateStr, 'AFTERNOON', rawInput, output, 'KG',
          1, '[DEMO_DATA] Table butter churning and packaging', 'APPROVED', 2, `${dateStr}T20:00:00Z`, isWasteAnomaly ? 'Approved with waste quarantine order' : 'Normal yield'
        );
        const prId = pInfo.lastInsertRowid;
        insertHistory.run('production', prId, 'SUBMITTED', 1, '[DEMO_DATA] Batch submitted', `${dateStr}T19:00:00Z`);
        insertHistory.run('production', prId, 'APPROVED', 2, '[DEMO_DATA] Batch approved', `${dateStr}T20:00:00Z`);

        if (isWasteAnomaly) {
          // Logged waste records: Spillage 75 kg + Reject 35 kg
          const w1 = insertWaste.run(
            prId, 4, dateStr, 'AFTERNOON', 'SPILLAGE', 75.0, 'KG',
            'Churn discharge seal rupture during fat separation phase', 1, 'APPROVED', 2, `${dateStr}T20:00:00Z`, 'Seal failure confirmed by maintenance'
          );
          insertHistory.run('waste', w1.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Spillage reported', `${dateStr}T19:05:00Z`);
          insertHistory.run('waste', w1.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T20:00:00Z`);

          const w2 = insertWaste.run(
            prId, 4, dateStr, 'AFTERNOON', 'REJECT', 35.0, 'KG',
            'Moisture out-of-specification in initial pack run', 1, 'APPROVED', 2, `${dateStr}T20:00:00Z`, 'Rework batch rejected'
          );
          insertHistory.run('waste', w2.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Reject reported', `${dateStr}T19:05:00Z`);
          insertHistory.run('waste', w2.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T20:00:00Z`);

          // DELIBERATE ANOMALY 4 ALERT CREATION
          db.prepare(`
            INSERT INTO alerts (
              alert_type, source_record_type, source_record_id, severity, status,
              title, explanation, evidence_json, recommended_action, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'WASTE', 'production', prId, 'HIGH', 'OPEN',
            'Excessive Material Waste: Table Butter Batch ' + batchNo,
            `Production batch ${batchNo} recorded 9.17% loss (110.00 KG lost from 1,200.00 KG raw input). This exceeds the expected loss standard of 3.50% by 162% (> 2.0× expected threshold). Logged waste includes 75.00 KG spillage and 35.00 KG reject.`,
            JSON.stringify({
              batch_no: batchNo,
              product: 'Table Butter',
              raw_input_qty: 1200.0,
              actual_output_qty: 1090.0,
              loss_qty: 110.0,
              loss_percent: 9.17,
              expected_loss_percent: 3.5,
              ratio_to_expected: 2.62
            }),
            'Quarantine affected lot. Inspect mechanical seals and churn pressure relief valves. Reconcile mass balance log.',
            `${dateStr}T19:30:00Z`
          );
        } else {
          const wasteQty = Number((rawInput - output).toFixed(2));
          const wInfo = insertWaste.run(
            prId, 4, dateStr, 'AFTERNOON', 'CLEANING_LOSS', wasteQty, 'KG',
            'Buttermilk extraction residue and churn wall scraping', 1, 'APPROVED', 2, `${dateStr}T20:00:00Z`, 'Standard yield'
          );
          insertHistory.run('waste', wInfo.lastInsertRowid, 'SUBMITTED', 1, '[DEMO_DATA] Logged', `${dateStr}T19:05:00Z`);
          insertHistory.run('waste', wInfo.lastInsertRowid, 'APPROVED', 2, '[DEMO_DATA] Approved', `${dateStr}T20:00:00Z`);
        }
      }
    }

    // ------------------------------------------------------------------------
    // 9. Compute & Insert Pre-calculated Energy Baselines
    // Shared Contract: "baseline = mean and std dev of consumption_kwh for the same
    // machine and shift over the last 30 APPROVED records. Needs at least 5 samples."
    // ------------------------------------------------------------------------
    console.log('[Seed] Calculating and storing official energy baselines...');
    const insertBaseline = db.prepare(`
      INSERT INTO energy_baselines (machine_id, shift, mean_kwh, std_dev_kwh, sample_count, calculated_at)
      VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `);

    for (const [key, samples] of Object.entries(baselineSamples)) {
      const [machineIdStr, shift] = key.split('_');
      const machineId = parseInt(machineIdStr, 10);
      const recentSamples = samples.slice(-30); // Last 30 approved records
      const count = recentSamples.length;

      if (count >= 5) {
        const sum = recentSamples.reduce((a, b) => a + b, 0);
        const mean = sum / count;
        const variance = recentSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
        const stdDev = Math.sqrt(variance);

        insertBaseline.run(machineId, shift, Number(mean.toFixed(2)), Number(stdDev.toFixed(2)), count);
      }
    }

    // ------------------------------------------------------------------------
    // 10. Audit Log Seed Entries
    // ------------------------------------------------------------------------
    console.log('[Seed] Inserting initial audit log entries...');
    const insertAudit = db.prepare(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address, acted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(3, 'SYSTEM_INIT', 'database', null, '127.0.0.1', '2026-09-22T08:00:00Z');
    insertAudit.run(3, 'USER_CREATED', 'users', 1, '127.0.0.1', '2026-09-22T08:05:00Z');
    insertAudit.run(3, 'USER_CREATED', 'users', 2, '127.0.0.1', '2026-09-22T08:06:00Z');
    insertAudit.run(2, 'ALERT_REVIEWED', 'alerts', 2, '192.168.1.45', '2026-11-04T22:30:00Z');

    console.log('[Seed] Seeding completed successfully.');
  });

  runSeeder();
  db.close();
}

if (require.main === module) {
  try {
    seed();
  } catch (err) {
    console.error('[Seed] Seeding failed:', err);
    process.exit(1);
  }
}

module.exports = { seed };
