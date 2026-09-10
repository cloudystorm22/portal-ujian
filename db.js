const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'portal-ujian.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Gagal terhubung ke database SQLite:', err.message);
  } else {
    console.log('Terhubung ke database SQLite di:', dbPath);
  }
});

db.serialize(() => {
  // 1. Tabel Users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'peserta',
    nama TEXT,
    nomor_peserta TEXT,
    status_aktif TEXT DEFAULT 'true'
  )`);

  // 2. Tabel Paket Ujian
  db.run(`CREATE TABLE IF NOT EXISTS packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paket TEXT UNIQUE NOT NULL,
    token_ujian TEXT NOT NULL,
    durasi INTEGER NOT NULL DEFAULT 60,
    status_aktif TEXT DEFAULT 'true',
    tampil_nilai TEXT DEFAULT 'true',
    tampil_kunci TEXT DEFAULT 'true',
    acak_soal TEXT DEFAULT 'false',
    acak_opsi TEXT DEFAULT 'false',
    metode_skor TEXT DEFAULT 'irt_utbk',
    kesempatan_maks INTEGER DEFAULT 1
  )`);

  // 3. Tabel Soal
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paket TEXT NOT NULL,
    tipe TEXT NOT NULL DEFAULT 'pg',
    soal TEXT NOT NULL,
    url_gambar TEXT,
    opsi_a TEXT,
    opsi_b TEXT,
    opsi_c TEXT,
    opsi_d TEXT,
    opsi_e TEXT,
    kunci TEXT,
    poin_benar REAL DEFAULT 1,
    poin_kosong REAL DEFAULT 0,
    poin_salah REAL DEFAULT 0
  )`);

  // 4. Tabel Log Ujian
  db.run(`CREATE TABLE IF NOT EXISTS exam_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    paket TEXT,
    attempt_ke INTEGER DEFAULT 1,
    skor REAL,
    skor_maks REAL,
    benar INTEGER DEFAULT 0,
    kosong INTEGER DEFAULT 0,
    salah INTEGER DEFAULT 0,
    metode_skor_label TEXT,
    pelanggaran TEXT DEFAULT 'Aman',
    review_json TEXT,
    waktu_selesai DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed Data Default
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (row && row.count === 0) {
      const hashedAdmin = await bcrypt.hash('cbt2024', 10);
      const hashedPeserta = await bcrypt.hash('12345', 10);

      db.run(`INSERT INTO users (username, password, role, nama) VALUES (?, ?, ?, ?)`, 
        ['admin', hashedAdmin, 'admin', 'Administrator']);
      db.run(`INSERT INTO users (username, password, role, nama, nomor_peserta) VALUES (?, ?, ?, ?, ?)`, 
        ['peserta1', hashedPeserta, 'peserta', 'Peserta Ujian 1', '001']);

      db.run(`INSERT INTO packets (paket, token_ujian, durasi, metode_skor) VALUES (?, ?, ?, ?)`, 
        ['Paket 1', 'AKSES2026', 60, 'irt_utbk']);

      console.log('Default seed data berhasil dimasukkan.');
    }
  });
});

module.exports = db;