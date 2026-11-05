const authService = require('../services/auth.service');
const { successEnvelope } = require('../utils/envelope');

const authController = {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.login({ email, password, ipAddress });
      res.json(successEnvelope(result));
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.me(req.user.id);
      res.json(successEnvelope(user));
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.logout(req.user.id, ipAddress);
      res.json(successEnvelope(result));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
