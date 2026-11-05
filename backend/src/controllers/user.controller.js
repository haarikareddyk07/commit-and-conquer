const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const auditService = require('../services/audit.service');
const { successEnvelope } = require('../utils/envelope');
const { NotFoundError, ConflictError } = require('../utils/errors');

const userController = {
  listUsers(req, res, next) {
    try {
      const { rows, total } = userRepository.findAll(req.query);
      const sanitized = rows.map(({ password_hash, ...u }) => u);
      res.json(successEnvelope(sanitized, {
        total,
        page: req.query.page || 1,
        pageSize: req.query.pageSize || 20
      }));
    } catch (err) {
      next(err);
    }
  },

  getUser(req, res, next) {
    try {
      const user = userRepository.findById(req.params.id);
      if (!user) throw new NotFoundError('User not found');
      const { password_hash, ...sanitized } = user;
      res.json(successEnvelope(sanitized));
    } catch (err) {
      next(err);
    }
  },

  async createUser(req, res, next) {
    try {
      const { full_name, email, password, role, department_id, is_active } = req.body;
      const existing = userRepository.findByEmail(email.toLowerCase().trim());
      if (existing) {
        throw new ConflictError('A user with this email address already exists.');
      }

      const password_hash = await bcrypt.hash(password, 10);
      const user = userRepository.create({
        full_name,
        email: email.toLowerCase().trim(),
        password_hash,
        role,
        department_id,
        is_active: is_active ?? 1
      });

      auditService.log(req.user.id, 'CREATE_USER', 'users', user.id, req.ip);
      const { password_hash: _, ...sanitized } = user;
      res.status(201).json(successEnvelope(sanitized));
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const { full_name, email, password, role, department_id, is_active } = req.body;
      const user = userRepository.findById(req.params.id);
      if (!user) throw new NotFoundError('User not found');

      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (email !== undefined) {
        const existing = userRepository.findByEmail(email.toLowerCase().trim());
        if (existing && existing.id !== Number(req.params.id)) {
          throw new ConflictError('Email address is already in use by another account.');
        }
        updates.email = email.toLowerCase().trim();
      }
      if (password) {
        updates.password_hash = await bcrypt.hash(password, 10);
      }
      if (role !== undefined) updates.role = role;
      if (department_id !== undefined) updates.department_id = department_id;
      if (is_active !== undefined) updates.is_active = is_active;

      const updated = userRepository.update(req.params.id, updates);
      auditService.log(req.user.id, 'UPDATE_USER', 'users', updated.id, req.ip);
      const { password_hash: _, ...sanitized } = updated;
      res.json(successEnvelope(sanitized));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = userController;
