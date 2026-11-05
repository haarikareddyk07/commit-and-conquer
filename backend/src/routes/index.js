const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const masterRoutes = require('./master.routes');
const userRoutes = require('./user.routes');
const {
  energyRouter,
  hygieneRouter,
  productionRouter,
  wasteRouter
} = require('./record.routes');
const approvalRoutes = require('./approval.routes');
const uploadRoutes = require('./upload.routes');
const importRoutes = require('./import.routes');
const dashboardRoutes = require('./dashboard.routes');
const alertRoutes = require('./alert.routes');
const insightRoutes = require('./insight.routes');

const router = express.Router();

// Public routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Protected routes
router.use('/users', userRoutes);
router.use('/energy-records', energyRouter);
router.use('/hygiene-records', hygieneRouter);
router.use('/production-records', productionRouter);
router.use('/waste-records', wasteRouter);
router.use('/approvals', approvalRoutes);
router.use('/uploads', uploadRoutes);
router.use('/imports', importRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/alerts', alertRoutes);
router.use('/insights', insightRoutes);
router.use('/', masterRoutes);

module.exports = router;
