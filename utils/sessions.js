// utils/sessions.js
const crypto = require('crypto');

// Menggunakan hash/signature sederhana tanpa menyimpan ke RAM server
const SECRET = process.env.TURSO_AUTH_TOKEN || 'portal-ujian-secret-key';

function createSession(userData) {
  const payload = JSON.stringify({ ...userData, exp: Date.now() + (24 * 60 * 60 * 1000) });
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + signature;
}

function verifySession(token) {
  if (!token) return null;
  try {
    const [base64Payload, signature] = token.split('.');
    const payloadText = Buffer.from(base64Payload, 'base64').toString('utf-8');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(payloadText).digest('hex');

    if (signature !== expectedSignature) return null;

    const data = JSON.parse(payloadText);
    if (Date.now() > data.exp) return null;

    return data;
  } catch (err) {
    return null;
  }
}

function destroySession(token) {
  return true;
}

module.exports = { createSession, verifySession, destroySession };