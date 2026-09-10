const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAdmin } = require('../utils/sessions');

const router = express.Router();

// Proteksi sesi admin
router.use(requireAdmin);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, crypto.randomBytes(12).toString('hex') + safeExt);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // Maksimal 6 MB
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('File harus berupa gambar.'));
    cb(null, true);
  }
});

router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ success: false, message: 'File gambar kosong.' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ success: true, url, fileId: req.file.filename });
});

// Penanganan error multer
router.use((err, req, res, next) => {
  res.json({ success: false, message: err.message || 'Upload gagal.' });
});

module.exports = router;