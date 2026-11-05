const { getDatabase } = require('../config/database');

const masterRepository = {
  // Departments
  getDepartments() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM departments ORDER BY id ASC').all();
  },
  createDepartment(name) {
    const db = getDatabase();
    const res = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
    return db.prepare('SELECT * FROM departments WHERE id = ?').get(res.lastInsertRowid);
  },

  // Machines
  getMachines(departmentId) {
    const db = getDatabase();
    let query = `
      SELECT m.*, d.name as department_name
      FROM machines m
      JOIN departments d ON m.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (departmentId) {
      query += ' AND m.department_id = ?';
      params.push(departmentId);
    }
    query += ' ORDER BY m.machine_code ASC';
    return db.prepare(query).all(...params);
  },
  getMachineById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT m.*, d.name as department_name
      FROM machines m
      JOIN departments d ON m.department_id = d.id
      WHERE m.id = ?
    `).get(id);
  },
  createMachine(data) {
    const db = getDatabase();
    const res = db.prepare(`
      INSERT INTO machines (machine_code, name, department_id, machine_type, rated_power_kw, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.machine_code, data.name, data.department_id, data.machine_type, data.rated_power_kw, data.is_active ?? 1);
    return this.getMachineById(res.lastInsertRowid);
  },
  updateMachine(id, data) {
    const db = getDatabase();
    const setClauses = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
    values.push(id);
    db.prepare(`UPDATE machines SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getMachineById(id);
  },

  // Areas
  getAreas(departmentId) {
    const db = getDatabase();
    let query = `
      SELECT a.*, d.name as department_name
      FROM areas a
      JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (departmentId) {
      query += ' AND a.department_id = ?';
      params.push(departmentId);
    }
    query += ' ORDER BY a.name ASC';
    return db.prepare(query).all(...params);
  },
  getAreaById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT a.*, d.name as department_name
      FROM areas a
      JOIN departments d ON a.department_id = d.id
      WHERE a.id = ?
    `).get(id);
  },
  createArea(data) {
    const db = getDatabase();
    const res = db.prepare(`
      INSERT INTO areas (name, department_id, area_type)
      VALUES (?, ?, ?)
    `).run(data.name, data.department_id, data.area_type);
    return this.getAreaById(res.lastInsertRowid);
  },
  updateArea(id, data) {
    const db = getDatabase();
    const setClauses = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
    values.push(id);
    db.prepare(`UPDATE areas SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getAreaById(id);
  },

  // Sanitation Schedules
  getSchedules(areaId) {
    const db = getDatabase();
    let query = `
      SELECT ss.*, a.name as area_name, a.department_id, d.name as department_name
      FROM sanitation_schedules ss
      JOIN areas a ON ss.area_id = a.id
      JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (areaId) {
      query += ' AND ss.area_id = ?';
      params.push(areaId);
    }
    query += ' ORDER BY ss.due_time ASC';
    return db.prepare(query).all(...params);
  },
  getScheduleById(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT ss.*, a.name as area_name, a.department_id, d.name as department_name
      FROM sanitation_schedules ss
      JOIN areas a ON ss.area_id = a.id
      JOIN departments d ON a.department_id = d.id
      WHERE ss.id = ?
    `).get(id);
  },
  createSchedule(data) {
    const db = getDatabase();
    const res = db.prepare(`
      INSERT INTO sanitation_schedules (
        area_id, task_name, frequency, shift, due_time, grace_minutes,
        required_chemical, min_concentration_percent, max_concentration_percent, min_contact_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.area_id, data.task_name, data.frequency, data.shift || null, data.due_time,
      data.grace_minutes ?? 30, data.required_chemical, data.min_concentration_percent,
      data.max_concentration_percent, data.min_contact_minutes
    );
    return this.getScheduleById(res.lastInsertRowid);
  },
  updateSchedule(id, data) {
    const db = getDatabase();
    const setClauses = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
    values.push(id);
    db.prepare(`UPDATE sanitation_schedules SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getScheduleById(id);
  },

  // Products
  getProducts() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  },
  getProductById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },
  createProduct(data) {
    const db = getDatabase();
    const res = db.prepare(`
      INSERT INTO products (product_code, name, unit, expected_loss_percent)
      VALUES (?, ?, ?, ?)
    `).run(data.product_code, data.name, data.unit, data.expected_loss_percent);
    return this.getProductById(res.lastInsertRowid);
  },
  updateProduct(id, data) {
    const db = getDatabase();
    const setClauses = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
    values.push(id);
    db.prepare(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getProductById(id);
  },

  // Materials
  getMaterials() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM materials ORDER BY name ASC').all();
  },
  getMaterialById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
  },
  createMaterial(data) {
    const db = getDatabase();
    const res = db.prepare(`
      INSERT INTO materials (material_code, name, unit, expected_loss_percent)
      VALUES (?, ?, ?, ?)
    `).run(data.material_code, data.name, data.unit, data.expected_loss_percent);
    return this.getMaterialById(res.lastInsertRowid);
  },
  updateMaterial(id, data) {
    const db = getDatabase();
    const setClauses = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
    values.push(id);
    db.prepare(`UPDATE materials SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getMaterialById(id);
  }
};

module.exports = masterRepository;
