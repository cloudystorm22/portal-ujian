const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../utils/sessions');

const router = express.Router();

// Terapkan proteksi admin untuk seluruh rute di file ini
router.use(requireAdmin);

const norm = (str) => (str ? String(str).trim() : '');

// 1. Dashboard Stats
router.get('/dashboard-stats', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM questions', [], (err, r1) => {
    db.get('SELECT COUNT(*) as count FROM users WHERE role = "peserta"', [], (err, r2) => {
      db.get('SELECT COUNT(*) as count FROM packets', [], (err, r3) => {
        db.get('SELECT COUNT(*) as count FROM exam_logs', [], (err, r4) => {
          res.json({
            success: true,
            jumlahSoal: r1 ? r1.count : 0,
            jumlahPeserta: r2 ? r2.count : 0,
            jumlahPaket: r3 ? r3.count : 0,
            jumlahHasil: r4 ? r4.count : 0
          });
        });
      });
    });
  });
});

// 2. Get Pengaturan Paket
router.get('/pengaturan', (req, res) => {
  db.all('SELECT * FROM packets ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
});

// 3. Save Pengaturan Paket (Bulk / Multi)
router.post('/pengaturan', (req, res) => {
  const rows = req.body.rows || [];
  
  db.serialize(() => {
    db.run('DELETE FROM packets', (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      const stmt = db.prepare(`
        INSERT INTO packets (paket, token_ujian, durasi, status_aktif, tampil_nilai, tampil_kunci, acak_soal, acak_opsi, metode_skor, kesempatan_maks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      rows.forEach(r => {
        stmt.run([
          norm(r.paket) || 'Paket Ujian',
          norm(r.token_ujian) || 'AKSES2026',
          parseInt(r.durasi, 10) || 60,
          String(r.status_aktif) === 'false' ? 'false' : 'true',
          String(r.tampil_nilai) === 'false' ? 'false' : 'true',
          String(r.tampil_kunci) === 'false' ? 'false' : 'true',
          String(r.acak_soal) === 'true' ? 'true' : 'false',
          String(r.acak_opsi) === 'true' ? 'true' : 'false',
          norm(r.metode_skor) || 'irt_utbk',
          parseInt(r.kesempatan_maks, 10) ?? 1
        ]);
      });

      stmt.finalize((err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Pengaturan paket berhasil disimpan.' });
      });
    });
  });
});

// 4. Get Soal Admin
router.get('/soal', (req, res) => {
  db.all('SELECT * FROM questions ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
});

// 5. Tambah Soal
router.post('/soal', (req, res) => {
  const { paket, tipe, soal, url_gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, poin_benar, poin_kosong, poin_salah } = req.body;
  
  db.run(
    `INSERT INTO questions (paket, tipe, soal, url_gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, poin_benar, poin_kosong, poin_salah)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      norm(paket), norm(tipe) || 'pg', norm(soal), norm(url_gambar),
      norm(opsi_a), norm(opsi_b), norm(opsi_c), norm(opsi_d), norm(opsi_e),
      norm(kunci), parseFloat(poin_benar) || 1, parseFloat(poin_kosong) || 0, parseFloat(poin_salah) || 0
    ],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Soal berhasil disimpan.', id: this.lastID });
    }
  );
});

// 6. Update Soal
router.put('/soal/:id', (req, res) => {
  const { paket, tipe, soal, url_gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, poin_benar, poin_kosong, poin_salah } = req.body;

  db.run(
    `UPDATE questions SET paket=?, tipe=?, soal=?, url_gambar=?, opsi_a=?, opsi_b=?, opsi_c=?, opsi_d=?, opsi_e=?, kunci=?, poin_benar=?, poin_kosong=?, poin_salah=?
     WHERE id=?`,
    [
      norm(paket), norm(tipe) || 'pg', norm(soal), norm(url_gambar),
      norm(opsi_a), norm(opsi_b), norm(opsi_c), norm(opsi_d), norm(opsi_e),
      norm(kunci), parseFloat(poin_benar) || 1, parseFloat(poin_kosong) || 0, parseFloat(poin_salah) || 0,
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Soal berhasil diperbarui.' });
    }
  );
});

// 7. Hapus Soal
router.delete('/soal/:id', (req, res) => {
  db.run('DELETE FROM questions WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: 'Soal berhasil dihapus.' });
  });
});

// 8. Accounts Peserta
router.get('/peserta-accounts', (req, res) => {
  db.all('SELECT id, username, nama, nomor_peserta, status_aktif FROM users WHERE role = "peserta" ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
});

router.post('/peserta-accounts', async (req, res) => {
  const rows = req.body.rows || [];
  for (const r of rows) {
    if (!r.username) continue;
    const existing = await new Promise(resolve => db.get('SELECT * FROM users WHERE username = ?', [r.username], (e, row) => resolve(row)));
    
    if (existing) {
      if (r.password && r.password.trim()) {
        const hash = await bcrypt.hash(r.password.trim(), 10);
        db.run('UPDATE users SET password = ?, nama = ?, nomor_peserta = ?, status_aktif = ? WHERE username = ?', [hash, r.nama, r.nomor_peserta, r.status_aktif || 'true', r.username]);
      } else {
        db.run('UPDATE users SET nama = ?, nomor_peserta = ?, status_aktif = ? WHERE username = ?', [r.nama, r.nomor_peserta, r.status_aktif || 'true', r.username]);
      }
    } else {
      const pass = (r.password && r.password.trim()) ? r.password.trim() : '12345';
      const hash = await bcrypt.hash(pass, 10);
      db.run('INSERT INTO users (username, password, role, nama, nomor_peserta, status_aktif) VALUES (?, ?, "peserta", ?, ?, ?)', [r.username, hash, r.nama, r.nomor_peserta, r.status_aktif || 'true']);
    }
  }
  res.json({ success: true, message: 'Data peserta berhasil disimpan.' });
});

// 9. Accounts Admin
router.get('/admin-accounts', (req, res) => {
  db.all('SELECT id, username, nama, status_aktif FROM users WHERE role = "admin" ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
});

router.post('/admin-accounts', async (req, res) => {
  const rows = req.body.rows || [];
  for (const r of rows) {
    if (!r.username) continue;
    const existing = await new Promise(resolve => db.get('SELECT * FROM users WHERE username = ?', [r.username], (e, row) => resolve(row)));
    
    if (existing) {
      if (r.password && r.password.trim()) {
        const hash = await bcrypt.hash(r.password.trim(), 10);
        db.run('UPDATE users SET password = ?, nama = ?, status_aktif = ? WHERE username = ?', [hash, r.nama, r.status_aktif || 'true', r.username]);
      } else {
        db.run('UPDATE users SET nama = ?, status_aktif = ? WHERE username = ?', [r.nama, r.status_aktif || 'true', r.username]);
      }
    } else {
      const pass = (r.password && r.password.trim()) ? r.password.trim() : 'cbt2024';
      const hash = await bcrypt.hash(pass, 10);
      db.run('INSERT INTO users (username, password, role, nama, status_aktif) VALUES (?, ?, "admin", ?, ?)', [r.username, hash, r.nama, r.status_aktif || 'true']);
    }
  }
  res.json({ success: true, message: 'Data admin berhasil disimpan.' });
});

// 10. Log Hasil
router.get('/hasil', (req, res) => {
  db.all('SELECT e.*, u.nama, u.nomor_peserta, e.id as row_id FROM exam_logs e LEFT JOIN users u ON e.username = u.username ORDER BY e.id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
});

router.delete('/hasil/:id', (req, res) => {
  db.run('DELETE FROM exam_logs WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: 'Log hasil berhasil dihapus.' });
  });
});

module.exports = router;