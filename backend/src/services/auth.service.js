const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const { UnauthenticatedError } = require('../utils/errors');

const authService = {
  async login({ email, password, ipAddress }) {
    const user = userRepository.findByEmail(email.toLowerCase().trim());
    if (!user || !user.is_active) {
      throw new UnauthenticatedError('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthenticatedError('Invalid email or password.');
    }

    // JWT with 8-hour expiry
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        departmentId: user.department_id
      },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    auditService.log(user.id, 'LOGIN', 'users', user.id, ipAddress);

    return {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id
      }
    };
  },

  async me(userId) {
    const user = userRepository.findById(userId);
    if (!user || !user.is_active) {
      throw new UnauthenticatedError('User account not found or inactive');
    }
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      created_at: user.created_at
    };
  },

  async logout(userId, ipAddress) {
    auditService.log(userId, 'LOGOUT', 'users', userId, ipAddress);
    return { message: 'Logged out successfully' };
  }
};

module.exports = authService;
