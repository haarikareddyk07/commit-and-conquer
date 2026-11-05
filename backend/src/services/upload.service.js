const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/env');
const uploadRepository = require('../repositories/upload.repository');
const { ValidationError, NotFoundError } = require('../utils/errors');

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = `${crypto.randomUUID()}${ext}`;
    cb(null, randomName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new ValidationError(`Unsupported file type: ${ext || file.mimetype}. Allowed types: pdf, png, jpg, csv, xlsx.`));
  }
  cb(null, true);
};

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter
});

const uploadService = {
  getMulter() {
    return multerUpload;
  },

  async handleUpload(file, { related_type, related_id }, userId) {
    if (!file) {
      throw new ValidationError('No file provided for upload.');
    }

    const uploadRecord = uploadRepository.create({
      original_name: file.originalname,
      stored_name: file.filename,
      mime_type: file.mimetype,
      size_bytes: file.size,
      uploaded_by: userId,
      related_type,
      related_id: related_id ? parseInt(related_id, 10) : null
    });

    return uploadRecord;
  },

  async getFileMetadata(id) {
    const record = uploadRepository.findById(id);
    if (!record) {
      throw new NotFoundError(`Upload record with ID ${id} not found.`);
    }

    const fullPath = path.join(config.uploadDir, record.stored_name);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError('Underlying physical file is missing from storage.');
    }

    return {
      record,
      fullPath
    };
  }
};

module.exports = uploadService;
