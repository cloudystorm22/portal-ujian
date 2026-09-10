# Portal Ujian (Node.js + Express + SQLite)

Migrasi dari Google Apps Script (Code.gs + Index.html) ke stack mandiri:
Node.js/Express sebagai backend, SQLite sebagai database, disimpan & di-*version-control*
di GitHub, dan di-hosting oleh layanan seperti **Render.com** (auto-deploy setiap push ke GitHub).

> **Penting:** GitHub sendiri tidak menjalankan server — cukup Pages untuk situs statis.
> Jadi alurnya: kode di GitHub → Render (atau Railway/Fly.io/VPS) menarik kode itu dan
> benar-benar menjalankannya sebagai server yang selalu menyala.

## Fitur yang sudah ada
- Login admin & peserta (password di-hash pakai bcrypt, bukan plaintext seperti versi lama)
- Kelola paket ujian: token, durasi, tampil nilai/kunci, acak soal/opsi, kesempatan maksimal
- 3 mode penilaian: IRT-like UTBK (bobot otomatis dari histori jawaban, min. 2 peserta unik),
  poin benar saja, poin benar/kosong/salah
- CRUD soal (PG, Multiple Choice, Isian, Essay) + upload gambar soal
- Ambil soal dengan acak soal/acak opsi, timer ujian, tandai ragu-ragu
- Submit ujian, skor otomatis, review hasil sesuai pengaturan admin
- Log nilai admin + hapus log (otomatis hitung ulang IRT) + laporan bobot soal per butir
- Ekspor modul soal ke PDF (pdfkit)
- Proteksi endpoint admin dengan session token (perbaikan dari versi Apps Script yang
  praktis tanpa pengecekan sesi per-panggilan)

## Menjalankan secara lokal
```bash
npm install
cp .env.example .env
npm start
# buka http://localhost:3000
```
Akun bawaan (dibuat otomatis saat pertama kali jalan):
- Admin: `admin` / `cbt2024`
- Peserta: `peserta1` / `12345`
- Paket contoh: `Paket 1`, token `AKSES2026`

**Segera ganti password default ini** lewat tab "Akun Admin"/"Akun Peserta" setelah deploy.

## Menyimpan ke GitHub
```bash
git init
git add .
git commit -m "Portal ujian - migrasi dari Google Apps Script"
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo>.git
git push -u origin main
```

## Deploy ke Render.com (gratis, auto-deploy dari GitHub)
1. Buat akun di https://render.com, hubungkan akun GitHub-mu.
2. **New +** → **Web Service** → pilih repo ini.
3. Isi:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Tambahkan **Persistent Disk** (menu "Disks"), mount ke path `/opt/render/project/src/data`
   dan `/opt/render/project/src/uploads` (atau gabung jadi satu disk, mount ke root proyek) —
   **wajib**, kalau tidak, database & gambar soal akan hilang setiap deploy ulang.
5. Klik **Create Web Service**. Render otomatis build & jalankan, dan setiap kamu `git push`
   ke GitHub, Render akan build ulang otomatis.
6. Setelah live, kamu dapat URL seperti `https://portal-ujian-xxxx.onrender.com`.

*(Free tier Render akan "tidur" setelah beberapa menit tanpa trafik dan perlu ~30 detik untuk
bangun lagi saat diakses. Kalau butuh selalu standby tanpa jeda, gunakan paket berbayar atau
pindah ke Railway/Fly.io/VPS.)*

## Struktur proyek
```
server.js          -> entry point Express
db.js               -> koneksi & schema SQLite + seed data awal
routes/auth.js      -> login admin & peserta
routes/admin.js     -> pengaturan paket, CRUD soal, akun admin/peserta
routes/hasil.js     -> log nilai, hapus log, hitung ulang & laporan IRT
routes/exam.js      -> alur peserta: daftar paket, verifikasi token, ambil soal, submit, review
routes/upload.js    -> upload gambar soal (disimpan di /uploads)
routes/pdf.js       -> ekspor modul soal ke PDF
utils/helpers.js    -> fungsi normalisasi (porting dari Code.gs)
utils/scoring.js    -> logika skor IRT-like & mode skor lain (porting dari Code.gs)
utils/sessions.js   -> session token sederhana untuk endpoint admin
public/             -> frontend (index.html, app.js, styles.css)
```

## Catatan migrasi & keterbatasan dibanding versi Apps Script
- **Database**: SQLite (file `data/portal-ujian.db`). Cukup untuk skala sekolah/kampus.
  Kalau nanti butuh menangani ratusan peserta bersamaan dalam skala besar, pindah ke
  PostgreSQL (struktur tabel di `db.js` mudah di-port ke `pg`/Prisma).
- **Upload gambar**: disimpan di folder `/uploads` di server (bukan Google Drive lagi).
  Wajib pakai *persistent disk* di hosting supaya tidak hilang saat re-deploy.
- **PDF export**: pakai `pdfkit` (layout lebih sederhana dibanding versi HTML-to-PDF Google).
- **Password**: sekarang di-hash dengan bcrypt (lebih aman dari versi lama yang plaintext
  di Google Sheets). Saat edit akun di panel admin, kosongkan kolom password kalau tidak
  ingin menggantinya.
- **Keamanan sesi admin**: ditambahkan session token (lihat `utils/sessions.js`) karena
  API ini sekarang publik di internet, bukan lagi tersembunyi di balik Apps Script.
  Sesi disimpan di memori server — kalau server restart, admin perlu login ulang (ini normal).
- **Frontend**: ditulis ulang lebih ringkas (tanpa puluhan lapis CSS iteratif dari versi asli),
  tetap responsif mobile/desktop, tapi styling detailnya tidak 1:1 sama persis dengan versi lama.
- **Anti-kecurangan**: cek dasar (blokir klik kanan/copy, deteksi keluar tab) masih di sisi
  klien, sama seperti versi lama — sifatnya sama-sama bisa dilewati orang yang niat.

## Rencana lanjutan (opsional, bisa diminta kapan saja)
- Pindah ke PostgreSQL untuk skala lebih besar / multi-instance
- Tambah export gambar/PDF ke cloud storage (S3/Cloudinary) agar tidak bergantung disk lokal
- Tambah role-based access / audit log admin
- Tambah test otomatis (Jest/Supertest) untuk setiap endpoint
