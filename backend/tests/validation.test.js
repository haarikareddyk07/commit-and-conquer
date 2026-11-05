const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

describe('Input Validation & Error Format', () => {
  let employeeToken;

  before(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@smarttrust.demo', password: 'Demo@1234' });
    employeeToken = res.body.data.token;
  });

  it('rejects energy record where reading_end_kwh is less than reading_start_kwh', async () => {
    const res = await request(app)
      .post('/api/v1/energy-records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        machine_id: 1,
        record_date: '2026-10-15',
        shift: 'MORNING',
        reading_start_kwh: 500.0,
        reading_end_kwh: 450.0, // IMPOSSIBLE: end < start
        runtime_hours: 6.0
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /end reading cannot be less than start reading/i);
  });

  it('rejects energy record with negative reading or negative runtime', async () => {
    const res = await request(app)
      .post('/api/v1/energy-records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        machine_id: 1,
        record_date: '2026-10-15',
        shift: 'MORNING',
        reading_start_kwh: -50.0,
        reading_end_kwh: 100.0,
        runtime_hours: -2.0
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects record with future dates', async () => {
    const futureDate = '2099-01-01';
    const res = await request(app)
      .post('/api/v1/energy-records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        machine_id: 1,
        record_date: futureDate,
        shift: 'MORNING',
        reading_start_kwh: 100.0,
        reading_end_kwh: 150.0,
        runtime_hours: 4.0
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /future/i);
  });

  it('rejects hygiene record with concentration outside 0-100', async () => {
    const res = await request(app)
      .post('/api/v1/hygiene-records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        schedule_id: 1,
        area_id: 1,
        scheduled_date: '2026-10-15',
        completed_at: '2026-10-15T06:30:00Z',
        chemical_used: 'Sodium Hydroxide 2%',
        concentration_percent: 150.0, // IMPOSSIBLE: > 100%
        contact_minutes: 20
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /concentration/i);
  });

  it('rejects waste record with negative quantity', async () => {
    const res = await request(app)
      .post('/api/v1/waste-records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        material_id: 1,
        record_date: '2026-10-15',
        shift: 'MORNING',
        waste_type: 'SPILLAGE',
        quantity: -15.5, // Negative quantity
        unit: 'LITRE'
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /cannot be negative/i);
  });
});
