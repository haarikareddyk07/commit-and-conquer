const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

describe('Full Record Lifecycle & Approval Flow', () => {
  let employeeToken;
  let supervisorToken;
  let managerToken;
  let recordId;

  before(async () => {
    const emp = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@smarttrust.demo', password: 'Demo@1234' });
    employeeToken = emp.body.data.token;

    const sup = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'supervisor@smarttrust.demo', password: 'Demo@1234' });
    supervisorToken = sup.body.data.token;

    const mgr = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@smarttrust.demo', password: 'Demo@1234' });
    managerToken = mgr.body.data.token;
  });

  it('Step 1: Employee creates an energy record -> PENDING, consumption calculated, approval history SUBMITTED', async () => {
    const res = await request(app)
      .post('/api/v1/energy-records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        machine_id: 1,
        record_date: '2026-10-20',
        shift: 'MORNING',
        reading_start_kwh: 50000.0,
        reading_end_kwh: 50350.0,
        runtime_hours: 7.0,
        notes: 'Initial test entry'
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'PENDING');
    assert.strictEqual(res.body.data.consumption_kwh, 350.0);
    recordId = res.body.data.id;

    // Check approval history via GET
    const histRes = await request(app)
      .get(`/api/v1/approvals/history?record_type=energy&record_id=${recordId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(histRes.status, 200);
    assert.strictEqual(histRes.body.data.length, 1);
    assert.strictEqual(histRes.body.data[0].action, 'SUBMITTED');
  });

  it('Step 2: Record appears in pending approval queue for Supervisor and Manager', async () => {
    const queueRes = await request(app)
      .get('/api/v1/approvals/pending?type=energy')
      .set('Authorization', `Bearer ${supervisorToken}`);

    assert.strictEqual(queueRes.status, 200);
    const found = queueRes.body.data.some(r => r.record_id === recordId && r.record_type === 'energy');
    assert.strictEqual(found, true, 'Record should be present in supervisor pending queue');
  });

  it('Step 3: Supervisor requests correction with a comment -> CORRECTION_REQUESTED', async () => {
    // Comment is required for REQUEST_CORRECTION
    const resWithoutComment = await request(app)
      .post(`/api/v1/approvals/energy/${recordId}/decision`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ decision: 'REQUEST_CORRECTION' });

    assert.strictEqual(resWithoutComment.status, 400);
    assert.match(resWithoutComment.body.error.message, /comment/i);

    const res = await request(app)
      .post(`/api/v1/approvals/energy/${recordId}/decision`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({
        decision: 'REQUEST_CORRECTION',
        comment: 'Please verify the meter start reading from log sheet.'
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'CORRECTION_REQUESTED');
    assert.strictEqual(res.body.data.review_comment, 'Please verify the meter start reading from log sheet.');
  });

  it('Step 4: Employee corrects record -> re-enters as PENDING with action RESUBMITTED', async () => {
    const updateRes = await request(app)
      .put(`/api/v1/energy-records/${recordId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        reading_start_kwh: 50010.0,
        reading_end_kwh: 50350.0,
        notes: 'Corrected start reading per log sheet'
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.status, 'PENDING');
    assert.strictEqual(updateRes.body.data.consumption_kwh, 340.0);

    // Verify approval history has SUBMITTED, CORRECTION_REQUESTED, RESUBMITTED
    const histRes = await request(app)
      .get(`/api/v1/approvals/history?record_type=energy&record_id=${recordId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(histRes.status, 200);
    const actions = histRes.body.data.map(h => h.action);
    assert.deepStrictEqual(actions, ['SUBMITTED', 'CORRECTION_REQUESTED', 'RESUBMITTED']);
  });

  it('Step 5: Manager approves the record -> status APPROVED, baselines recomputed', async () => {
    const approveRes = await request(app)
      .post(`/api/v1/approvals/energy/${recordId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'APPROVE',
        comment: 'Verified and approved'
      });

    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.data.status, 'APPROVED');

    // Verify full approval history has 4 actions
    const histRes = await request(app)
      .get(`/api/v1/approvals/history?record_type=energy&record_id=${recordId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    const actions = histRes.body.data.map(h => h.action);
    assert.deepStrictEqual(actions, ['SUBMITTED', 'CORRECTION_REQUESTED', 'RESUBMITTED', 'APPROVED']);
  });

  it('Step 6: Approved record cannot be updated by employee anymore', async () => {
    const updateRes = await request(app)
      .put(`/api/v1/energy-records/${recordId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        reading_start_kwh: 50020.0
      });

    assert.strictEqual(updateRes.status, 400);
    assert.match(updateRes.body.error.message, /Cannot update record with status "APPROVED"/i);
  });
});
