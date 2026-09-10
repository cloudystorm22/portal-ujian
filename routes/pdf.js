const express = require('express');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { verifySession } = require('../utils/sessions');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const norm = (str) => (str ? String(str).trim() : '');
const isTrue = (v) => String(v).toLowerCase() === 'true' || v === true;

router.get('/export', (req, res) => {
  if (!verifySession(req.query.token)) {
    return res.status(401).json({ success: false, message: 'Sesi admin tidak valid atau kedaluwarsa. Silakan login ulang.' });
  }
  const paket = norm(req.query.paket);
  const includeKunci = isTrue(req.query.include_kunci);
  if (!paket) return res.status(400).json({ success: false, message: 'Pilih satu paket dulu untuk diekspor.' });

  db.all('SELECT * FROM questions WHERE paket = ?', [paket], (err, soal) => {
    if (err || !soal || !soal.length) return res.status(400).json({ success: false, message: 'Tidak ada soal pada paket ini.' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Modul-Soal-${paket.replace(/[^a-z0-9]+/gi, '_')}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text(`Modul Soal - ${paket}`);
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
      .text(`Jumlah soal: ${soal.length}  |  Diekspor: ${new Date().toLocaleString('id-ID')}`);
    doc.moveDown();
    doc.fillColor('#111827');

    soal.forEach((s, idx) => {
      const tipe = norm(s.tipe || 'pg').toLowerCase();
      doc.moveDown(0.5);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#5b21b6')
        .text(`Soal ${idx + 1} [${tipe.toUpperCase()}]`);
      doc.fontSize(11).font('Helvetica').fillColor('#111827').text(s.soal || '(Soal kosong)', { align: 'left' });

      if (norm(s.url_gambar)) {
        try {
          const filename = String(s.url_gambar).split('/').pop();
          const localPath = path.join(UPLOAD_DIR, filename);
          if (fs.existsSync(localPath)) {
            doc.moveDown(0.3);
            doc.image(localPath, { fit: [420, 260] });
          }
        } catch (e) { /* Abaikan jika gambar gagal dimuat */ }
      }

      if (tipe === 'pg' || tipe === 'mc') {
        ['A', 'B', 'C', 'D', 'E'].forEach(k => {
          const txt = s['opsi_' + k.toLowerCase()];
          if (norm(txt)) doc.fontSize(11).text(`${k}. ${txt}`);
        });
      } else {
        doc.fontSize(11).text('Jawaban: ________________________________');
      }

      if (includeKunci) {
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('#065f46')
          .text(`Kunci: ${norm(s.kunci) || '-'}   |   Poin: benar ${s.poin_benar || 1}, kosong ${s.poin_kosong || 0}, salah ${s.poin_salah || 0}`);
        doc.fillColor('#111827');
      }
      doc.moveDown(0.5);
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    });

    doc.end();
  });
});

module.exports = router;