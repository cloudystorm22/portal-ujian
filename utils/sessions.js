const crypto = require('crypto');

// Simpan token aktif di memory
const activeSessions = new Set();

function createSession(username) {
  const token = crypto.randomBytes(16).toString('hex');
  activeSessions.add(token);
  return token;
}

function verifySession(token) {
  if (!token) return false;
  return activeSessions.has(token);
}

function removeSession(token) {
  activeSessions.delete(token);
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!verifySession(token)) {
    return res.status(401).json({ 
      success: false, 
      message: 'Sesi admin tidak valid atau kedaluwarsa. Silakan login ulang.' 
    });
  }
  next();
}

module.exports = {
  createSession,
  verifySession,
  removeSession,
  requireAdmin
};