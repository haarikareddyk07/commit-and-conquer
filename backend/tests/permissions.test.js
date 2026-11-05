const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

describe('Role-Based Access Control (RBAC)', () => {
  let employeeToken;
  let supervisorToken;
  let managerToken;

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

  it('EMPLOYEE cannot access /users (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('SUPERVISOR cannot access /users (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${supervisorToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('MANAGER can access /users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('EMPLOYEE cannot access /approvals/pending (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/approvals/pending')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('SUPERVISOR and MANAGER can access /approvals/pending', async () => {
    const supRes = await request(app)
      .get('/api/v1/approvals/pending')
      .set('Authorization', `Bearer ${supervisorToken}`);
    assert.strictEqual(supRes.status, 200);

    const mgrRes = await request(app)
      .get('/api/v1/approvals/pending')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.strictEqual(mgrRes.status, 200);
  });

  it('EMPLOYEE cannot create master data (e.g. machines)', async () => {
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        machine_code: 'TEST-01',
        name: 'Test Machine',
        department_id: 1,
        machine_type: 'PUMP',
        rated_power_kw: 15.0
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('MANAGER can create master data (e.g. machines)', async () => {
    const randomCode = `TEST-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        machine_code: randomCode,
        name: 'Automated Test Homogeniser',
        department_id: 2,
        machine_type: 'HOMOGENISER',
        rated_power_kw: 25.0
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.machine_code, randomCode);
  });
});
