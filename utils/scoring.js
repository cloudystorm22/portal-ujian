// Helper normalisasi string
const norm = (str) => (str ? String(str).trim() : '');

/**
 * Memeriksa apakah jawaban user cocok dengan kunci.
 */
function checkAnswer(q, userAns) {
  const tipe = norm(q.tipe || 'pg').toLowerCase();
  const kunci = norm(q.kunci);

  if (!userAns && userAns !== 0) {
    return { isCorrect: false, isEmpty: true };
  }

  if (tipe === 'pg') {
    const isCorrect = String(userAns).trim().toUpperCase() === kunci.toUpperCase();
    return { isCorrect, isEmpty: false };
  } 
  
  if (tipe === 'mc') {
    // Multiple Choice (pilihan banyak, kunci dipisah koma e.g. "A,C")
    const keys = kunci.toUpperCase().split(',').map(k => k.trim()).filter(Boolean);
    let userArr = Array.isArray(userAns) ? userAns : String(userAns).split(',');
    userArr = userArr.map(u => String(u).trim().toUpperCase()).filter(Boolean);

    if (userArr.length === 0) return { isCorrect: false, isEmpty: true };

    // Cocokkan jika isi array persis sama
    const isCorrect = keys.length === userArr.length && keys.every(k => userArr.includes(k));
    return { isCorrect, isEmpty: false };
  }

  if (tipe === 'isian' || tipe === 'essay') {
    const isCorrect = String(userAns).trim().toLowerCase() === kunci.toLowerCase();
    return { isCorrect, isEmpty: false };
  }

  return { isCorrect: false, isEmpty: true };
}

/**
 * Membangun hasil review dan menghitung skor berdasarkan metode penilaian.
 */
function buildReview(questions = [], answers = {}, method = 'irt_utbk', irtWeights = null) {
  let benar = 0;
  let kosong = 0;
  let salah = 0;
  let rawScore = 0;
  let maxPossibleScore = 0;

  const review = questions.map(q => {
    const userAns = answers[q.id];
    const { isCorrect, isEmpty } = checkAnswer(q, userAns);

    const poinBenar = parseFloat(q.poin_benar) || 1;
    const poinKosong = parseFloat(q.poin_kosong) || 0;
    const poinSalah = parseFloat(q.poin_salah) || 0;

    let qScore = 0;

    if (isEmpty) {
      kosong++;
      qScore = method === 'poin_lengkap' ? poinKosong : 0;
    } else if (isCorrect) {
      benar++;
      if (method === 'irt_utbk' && irtWeights && irtWeights[q.id]) {
        qScore = irtWeights[q.id]; // Gunakan bobot IRT jika ada
      } else {
        qScore = poinBenar;
      }
    } else {
      salah++;
      qScore = method === 'poin_lengkap' ? poinSalah : 0;
    }

    rawScore += qScore;

    // Hitung poin maksimal yang bisa didapat
    if (method === 'irt_utbk' && irtWeights && irtWeights[q.id]) {
      maxPossibleScore += irtWeights[q.id];
    } else {
      maxPossibleScore += poinBenar;
    }

    return {
      id: q.id,
      soal: q.soal,
      tipe: q.tipe,
      url_gambar: q.url_gambar,
      opsi_a: q.opsi_a,
      opsi_b: q.opsi_b,
      opsi_c: q.opsi_c,
      opsi_d: q.opsi_d,
      opsi_e: q.opsi_e,
      kunci: q.kunci,
      jawaban_user: userAns || '',
      benar: isCorrect,
      kosong: isEmpty,
      skor_soal: qScore
    };
  });

  // Skala skor ke 0 - 1000 jika menggunakan IRT, atau bulatkan 2 desimal
  let finalScore = 0;
  if (method === 'irt_utbk') {
    finalScore = maxPossibleScore > 0 ? Math.round((rawScore / maxPossibleScore) * 1000) : 0;
  } else {
    finalScore = Math.round(rawScore * 100) / 100;
  }

  const modeLabel = method === 'irt_utbk' ? 'IRT-like UTBK' : (method === 'poin_lengkap' ? 'Poin Lengkap' : 'Poin Benar');

  return {
    skor: finalScore,
    skor_maks: method === 'irt_utbk' ? 1000 : maxPossibleScore,
    benar,
    kosong,
    salah,
    mode_label: modeLabel,
    review
  };
}

module.exports = {
  checkAnswer,
  buildReview
};