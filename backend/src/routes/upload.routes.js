const express = require('express');
const uploadController = require('../controllers/upload.controller');
const uploadService = require('../services/upload.service');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

const upload = uploadService.getMulter();

router.post('/', upload.single('file'), uploadController.uploadFile);
router.get('/:id', uploadController.getFile);

module.exports = router;
