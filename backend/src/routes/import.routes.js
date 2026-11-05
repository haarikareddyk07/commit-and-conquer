const express = require('express');
const multer = require('multer');
const importController = require('../controllers/import.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// Memory storage for previewing imports before saving
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/preview', memoryUpload.single('file'), importController.preview);
router.post('/commit', importController.commit);

module.exports = router;
