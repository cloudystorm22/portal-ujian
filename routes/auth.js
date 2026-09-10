const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { createSession, removeSession } = require('../utils/sessions');

const router = express.Router();

// Helper fungsi untuk membersihkan/normalisasi input string
const norm = (str) => (str ? String(str).trim() : '');

// -----------------------------------------------------------------------------
// 1. LOGIN ADMIN
// -----------------------------------------------------------------------------
router.post('/admin/login', (req, res) => {
  const username = norm(req.body.username);
  const password = norm(req.body.password);

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password admin wajib diisi.' });
  }

  // Cari user di database yang ber-role 'admin'
  db.get('SELECT * FROM users WHERE username = ? AND role = "admin"', [username], async (err, row) => {
    if (err) {
      console.error('Error Admin Login:', err.message);
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }

    if (!row) {
      return res.status(401).json({ success: false, message: 'Username atau password admin salah / akun nonaktif.' });
    }

    // Verifikasi password bcrypt
    try {
      const match = await bcrypt.compare(password, row.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Username atau password admin salah / akun nonaktif.' });
      }

      // Buat token sesi baru
      const token = createSession(row.username);

      return res.json({
        success: true,
        admin: {
          username: row.username,
          nama: row.nama || row.username
        },
        token
      });
    } catch (bcryptErr) {
      return res.status(500).json({ success: false, message: 'Gagal memverifikasi kata sandi.' });
    }
  });
});

// -----------------------------------------------------------------------------
// 2. LOGIN PESERTA
// -----------------------------------------------------------------------------
router.post('/peserta/login', (req, res) => {
  const username = norm(req.body.username);
  const password = norm(req.body.password);

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password peserta wajib diisi.' });
  }

  // Cari user di database yang ber-role 'peserta'
  db.get('SELECT * FROM users WHERE username = ? AND role = "peserta"', [username], async (err, row) => {
    if (err) {
      console.error('Error Peserta Login:', err.message);
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }

    if (!row) {
      return res.status(401).json({ success: false, message: 'Username atau password peserta salah / akun nonaktif.' });
    }

    // Verifikasi password bcrypt
    try {
      const match = await bcrypt.compare(password, row.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Username atau password peserta salah / akun nonaktif.' });
      }

      return res.json({
        success: true,
        user: {
          username: row.username,
          nama: row.nama || row.username,
          nomor_peserta: row.username
        }
      });
    } catch (bcryptErr) {
      return res.status(500).json({ success: false, message: 'Gagal memverifikasi kata sandi.' });
    }
  });
});

// -----------------------------------------------------------------------------
// 3. LOGOUT ADMIN
// -----------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  const token = req.headers['x-admin-token'] || req.body.token;
  if (token) {
    removeSession(token);
  }
  res.json({ success: true, message: 'Berhasil keluar dari sistem.' });
});

module.exports = router;