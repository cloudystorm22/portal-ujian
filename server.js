const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Body Parser & Static Files
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const examRoutes = require('./routes/exam');
const hasilRoutes = require('./routes/hasil');
const uploadRoutes = require('./routes/upload');
const pdfRoutes = require('./routes/pdf');

// Mounting Routes dengan Prefix yang Tepat:
// 1. Auth routes (menangani /api/admin/login, /api/peserta/login, /api/logout)
app.use('/api', authRoutes.router || authRoutes);

// 2. Admin routes (menangani /api/admin/* untuk dashboard, pengaturan, soal, dll)
app.use('/api/admin', adminRoutes.router || adminRoutes);

// 3. Exam & Hasil routes (menangani alur pengerjaan peserta & log hasil)
app.use('/api/exam', examRoutes.router || examRoutes);
app.use('/api/hasil', hasilRoutes.router || hasilRoutes);

// 4. Upload & PDF export
if (uploadRoutes) app.use('/api/upload', uploadRoutes.router || uploadRoutes);
if (pdfRoutes) app.use('/api/pdf', pdfRoutes.router || pdfRoutes);

app.listen(PORT, () => {
  console.log(`Server Portal Ujian aktif di http://localhost:${PORT}`);
});