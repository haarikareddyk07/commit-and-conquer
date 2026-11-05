const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler.middleware');
const { NotFoundError } = require('./utils/errors');

const app = express();

// Security headers
app.use(helmet());

// CORS restricted to CORS_ORIGIN
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing with limit
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Mount API v1 base path
app.use('/api/v1', apiRoutes);

// Catch 404 for unmapped endpoints
app.use((req, res, next) => {
  next(new NotFoundError(`Endpoint not found: ${req.method} ${req.originalUrl}`));
});

// Central Error Handler returning contract envelope
app.use(errorHandler);

module.exports = app;
