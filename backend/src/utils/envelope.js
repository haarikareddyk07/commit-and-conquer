/**
 * Shared Contract Section F: API conventions
 * Envelope format:
 * Success: { "success": true, "data": ..., "meta": {...} }
 * Error: { "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
 */

function successEnvelope(data = null, meta = {}) {
  const response = {
    success: true,
    data: data !== undefined ? data : null
  };
  if (meta && Object.keys(meta).length > 0) {
    response.meta = meta;
  }
  return response;
}

function errorEnvelope(code, message, details = []) {
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };
  if (Array.isArray(details) && details.length > 0) {
    response.error.details = details;
  }
  return response;
}

module.exports = {
  successEnvelope,
  errorEnvelope
};
