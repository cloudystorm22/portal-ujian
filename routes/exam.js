const express = require('express');
const db = require('../db');
const { buildReview } = require('../utils/scoring');

const router = express.Router();

// 1. Get Paket Ujian Aktif untuk Peserta
router.get('/packages', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username wajib diisi.' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    // Mengambil paket aktif beserta jumlah soalnya menggunakan subquery agar efisien
    const sqlPackets = `
      SELECT p.*, 
        (SELECT COUNT(*) FROM questions q WHERE q.paket = p.paket) AS jumlah_soal 
      FROM packets p 
      WHERE p.status_aktif = "true"
    `;

    db.all(sqlPackets, [], (err, packets) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      db.all('SELECT * FROM exam_logs WHERE username = ?', [username], (err, logs) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        logs = logs || [];
        const processed = (packets || []).map(pkg => {
          const userLogs = logs.filter(l => l.paket === pkg.paket);
          const attemptCount = userLogs.length;
          const maxK = parseInt(pkg.kesempatan_maks, 10);
          const canStart = maxK === 0 || attemptCount < maxK;
          const lastLog = userLogs[userLogs.length - 1];

          return {
            ...pkg,
            sudah_dikerjakan: userLogs.length > 0,
            can_start: canStart,
            attempt_count: attemptCount,
            kesempatan_label: maxK === 0 ? '∞' : maxK,
            skor: lastLog ? lastLog.skor : null,
            skor_maks: lastLog ? lastLog.skor_maks : null,
            jumlah_soal: pkg.jumlah_soal || 0
          };
        });

        return res.json({
          success: true,
          user: { username: user.username, nama: user.nama || user.username },
          profile: {
            paket_selesai: processed.filter(p => p.sudah_dikerjakan).length,
            total_paket_aktif: processed.length,
            total_attempt: logs.length,
            rata_rata: logs.length ? (logs.reduce((a, b) => a + (b.skor || 0), 0) / logs.length).toFixed(1) : 0,
            nilai_terbaik: logs.length ? Math.max(...logs.map(l => l.skor || 0)) : 0
          },
          data: processed
        });
      });
    });
  });
});

// 2. Verifikasi Token Ujian
router.post('/verify-access', (req, res) => {
  const { username, paket, token } = req.body;
  db.get('SELECT * FROM packets WHERE paket = ? AND token_ujian = ?', [paket, token], (err, pkg) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!pkg) return res.json({ success: false, message: 'Token ujian salah!' });

    db.all('SELECT * FROM exam_logs WHERE username = ? AND paket = ?', [username, paket], (err, logs) => {
      logs = logs || [];
      const attemptKe = logs.length + 1;
      const maxK = parseInt(pkg.kesempatan_maks, 10);
      if (maxK !== 0 && logs.length >= maxK) {
        return res.json({ success: false, message: 'Kesempatan mengerjakan paket ini sudah habis.' });
      }

      res.json({
        success: true,
        session: {
          paket: pkg.paket,
          durasi: pkg.durasi,
          acak_soal: pkg.acak_soal,
          acak_opsi: pkg.acak_opsi,
          attempt_ke: attemptKe,
          kesempatan_maks: pkg.kesempatan_maks
        }
      });
    });
  });
});

// 3. Ambil Soal Ujian
router.get('/soal', (req, res) => {
  const { paket } = req.query;
  db.all('SELECT * FROM questions WHERE paket = ?', [paket], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
});

// 4. Submit Jawaban Ujian
router.post('/submit', (req, res) => {
  const { username, paket, jawaban, pelanggaran } = req.body;

  db.get('SELECT * FROM packets WHERE paket = ?', [paket], (err, pkg) => {
    if (err || !pkg) return res.status(400).json({ success: false, message: 'Paket tidak ditemukan.' });

    db.all('SELECT * FROM questions WHERE paket = ?', [paket], (err, questions) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      const result = buildReview(questions || [], jawaban || {}, pkg.metode_skor, null);

      db.all('SELECT id FROM exam_logs WHERE username = ? AND paket = ?', [username, paket], (err, logs) => {
        logs = logs || [];
        const attemptKe = logs.length + 1;

        db.run(
          `INSERT INTO exam_logs (username, paket, attempt_ke, skor, skor_maks, benar, kosong, salah, metode_skor_label, pelanggaran, review_json) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            username, paket, attemptKe, result.skor, result.skor_maks,
            result.benar, result.kosong, result.salah,
            result.mode_label, pelanggaran || 'Aman', JSON.stringify(result.review)
          ],
          function (err) {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({
              success: true,
              nama: username,
              paket: paket,
              attempt_ke: attemptKe,
              skor: result.skor,
              skor_maks: result.skor_maks,
              benar: result.benar,
              kosong: result.kosong,
              salah: result.salah,
              tampil_nilai: pkg.tampil_nilai,
              tampil_kunci: pkg.tampil_kunci,
              review: result.review
            });
          }
        );
      });
    });
  });
});

// 5. Review Hasil Ujian Peserta
router.get('/review', (req, res) => {
  const { username, paket } = req.query;
  db.get('SELECT * FROM packets WHERE paket = ?', [paket], (err, pkg) => {
    if (err || !pkg) return res.status(400).json({ success: false, message: 'Paket tidak ditemukan.' });

    db.get('SELECT * FROM exam_logs WHERE username = ? AND paket = ? ORDER BY id DESC LIMIT 1', [username, paket], (err, log) => {
      if (err || !log) return res.status(404).json({ success: false, message: 'Hasil tidak ditemukan.' });

      let review = [];
      try { review = JSON.parse(log.review_json || '[]'); } catch (e) {}

      res.json({
        success: true,
        nama: username,
        paket: paket,
        attempt_ke: log.attempt_ke,
        skor: log.skor,
        skor_maks: log.skor_maks,
        benar: log.benar,
        kosong: log.kosong,
        salah: log.salah,
        tampil_nilai: pkg.tampil_nilai,
        tampil_kunci: pkg.tampil_kunci,
        review: review
      });
    });
  });
});

module.exports = router;