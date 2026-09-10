const express = require('express');
const db = require('../db');

const router = express.Router();

// Get Log Hasil Ujian
router.get('/hasil', (req, res) => {
  db.all('SELECT * FROM exam_logs ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows });
  });
});

// Hapus Log Hasil Ujian
router.delete('/hasil/:id', (req, res) => {
  db.run('DELETE FROM exam_logs WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (this.changes === 0) return res.json({ success: false, message: 'Log tidak ditemukan.' });
    res.json({ success: true, message: 'Log berhasil dihapus.' });
  });
});

module.exports = router;