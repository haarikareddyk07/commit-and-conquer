const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

describe('Auth API Endpoints', () => {
  let employeeToken;

  it('POST /api/v1/auth/login - should authenticate employee with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@smarttrust.demo',
        password: 'Demo@1234'
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token, 'Token must be returned');
    assert.strictEqual(res.body.data.user.email, 'employee@smarttrust.demo');
    assert.strictEqual(res.body.data.user.role, 'EMPLOYEE');

    employeeToken = res.body.data.token;
  });

  it('POST /api/v1/auth/login - should authenticate supervisor and manager', async () => {
    const supRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'supervisor@smarttrust.demo', password: 'Demo@1234' });
    assert.strictEqual(supRes.status, 200);
    assert.strictEqual(supRes.body.data.user.role, 'SUPERVISOR');

    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@smarttrust.demo', password: 'Demo@1234' });
    assert.strictEqual(mgrRes.status, 200);
    assert.strictEqual(mgrRes.body.data.user.role, 'MANAGER');
  });

  it('POST /api/v1/auth/login - should reject invalid password with generic message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@smarttrust.demo',
        password: 'WrongPassword999'
      });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHENTICATED');
    assert.strictEqual(res.body.error.message, 'Invalid email or password.');
  });

  it('GET /api/v1/auth/me - should return authenticated user details', async () => {
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.success, true);
    assert.strictEqual(meRes.body.data.email, 'employee@smarttrust.demo');
    assert.strictEqual(meRes.body.data.role, 'EMPLOYEE');
    assert.strictEqual(meRes.body.data.password_hash, undefined, 'Password hash must never be returned');
  });

  it('GET /api/v1/auth/me - should reject request without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHENTICATED');
  });

  it('POST /api/v1/auth/logout - should log out authenticated user', async () => {
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.body.success, true);
  });
});
