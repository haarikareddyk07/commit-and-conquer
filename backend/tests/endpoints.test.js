const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

describe('Dashboard, Alerts, Insights, Health, & Imports', () => {
  let managerToken;
  let employeeToken;

  before(async () => {
    const mgr = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@smarttrust.demo', password: 'Demo@1234' });
    managerToken = mgr.body.data.token;

    const emp = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@smarttrust.demo', password: 'Demo@1234' });
    employeeToken = emp.body.data.token;
  });

  it('GET /api/v1/health - responds with server health status', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'UP');
    assert.strictEqual(res.body.data.database, 'CONNECTED');
  });

  it('GET /api/v1/dashboard/summary - returns live dashboard metrics', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.data.pending_approvals_count === 'number');
    assert.ok(typeof res.body.data.open_alerts_count === 'number');
    assert.ok(typeof res.body.data.hygiene_compliance_percent === 'number');
    assert.ok(typeof res.body.data.energy_today === 'object');
  });

  it('GET /api/v1/dashboard/energy-trend - returns daily aggregated trend', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/energy-trend')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/v1/dashboard/hygiene-compliance - returns compliance by area', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/hygiene-compliance')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/v1/dashboard/waste-summary - returns waste breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/waste-summary')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.byWasteType));
    assert.ok(Array.isArray(res.body.data.byProduct));
  });

  it('GET /api/v1/insights/recommendations - returns rule-based recommendations', async () => {
    const res = await request(app)
      .get('/api/v1/insights/recommendations')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('POST /api/v1/imports/preview - parses CSV and returns row-by-row validation', async () => {
    const csvContent = `machine_id,record_date,shift,reading_start_kwh,reading_end_kwh,runtime_hours\n1,2026-10-18,MORNING,30000,30350,7.5\n1,2026-10-18,MORNING,30500,30200,6.0`;

    const res = await request(app)
      .post('/api/v1/imports/preview')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('type', 'energy')
      .attach('file', Buffer.from(csvContent), 'test_energy.csv');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.total_rows, 2);
    assert.strictEqual(res.body.data.valid_rows, 1);
    assert.strictEqual(res.body.data.error_rows, 1);
  });

  it('POST /api/v1/imports/commit - commits only valid rows as PENDING records', async () => {
    const validRows = [
      {
        machine_id: 1,
        record_date: '2026-10-19',
        shift: 'MORNING',
        reading_start_kwh: 31000,
        reading_end_kwh: 31350,
        runtime_hours: 7.5
      }
    ];

    const res = await request(app)
      .post('/api/v1/imports/commit')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        type: 'energy',
        rows: validRows
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.committed_count, 1);
    assert.strictEqual(res.body.data.records[0].status, 'PENDING');
  });
});
