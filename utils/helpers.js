// utils/helpers.js
// Porting langsung dari fungsi-fungsi util di Code.gs (murni JS, tidak Apps-Script-specific).

function norm(v) {
  return String(v === undefined || v === null ? '' : v).trim();
}

function normToken(v) {
  return norm(v).replace(/\s+/g, '').toUpperCase();
}

function isTrue(v) {
  const s = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === 'ya' || s === 'yes' || s === '1' || v === true || v === 1;
}

function num(v, fallback) {
  const n = Number(String(v === undefined || v === null || v === '' ? fallback : v).replace(',', '.'));
  return isNaN(n) ? Number(fallback || 0) : n;
}

function normalizeType(t) {
  const x = norm(t).toLowerCase();
  if (x === 'pg' || x.indexOf('pilihan ganda') >= 0 || x.indexOf('single') >= 0) return 'pg';
  if (x === 'mc' || x.indexOf('multiple') >= 0 || x.indexOf('banyak') >= 0) return 'mc';
  if (x === 'isian' || x.indexOf('isian') >= 0 || x.indexOf('singkat') >= 0) return 'isian';
  if (x === 'essay' || x.indexOf('esai') >= 0 || x.indexOf('uraian') >= 0) return 'essay';
  return x || 'pg';
}

function normalizeScoreMode(v) {
  const x = norm(v).toLowerCase();
  if (x === 'irt' || x === 'irt_utbk' || x.indexOf('utbk') >= 0) return 'irt_utbk';
  if (x === 'poin_benar' || x === 'benar' || x.indexOf('benar saja') >= 0) return 'poin_benar';
  if (x === 'poin_lengkap' || x === 'poin_benar_kosong_salah' || x.indexOf('kosong') >= 0 || x.indexOf('salah') >= 0) return 'poin_lengkap';
  return 'irt_utbk';
}

function scoreModeLabel(mode) {
  mode = normalizeScoreMode(mode);
  if (mode === 'irt_utbk') return 'Pembobotan IRT-like UTBK';
  if (mode === 'poin_benar') return 'Poin benar saja';
  return 'Poin benar, kosong, dan salah';
}

function answerIsEmpty(ans) {
  if (Array.isArray(ans)) return ans.length === 0;
  return norm(ans) === '';
}

function isCorrectAnswer(soal, userAns) {
  const tipe = normalizeType(soal.tipe);
  const key = norm(soal.kunci);
  if (answerIsEmpty(userAns)) return false;

  if (tipe === 'pg') {
    return norm(userAns).toUpperCase() === key.toUpperCase();
  }
  if (tipe === 'mc') {
    const uArr = Array.isArray(userAns) ? userAns : String(userAns || '').split(',');
    const kArr = key.split(',');
    const u = uArr.map(x => norm(x).toUpperCase()).filter(Boolean).sort().join(',');
    const k = kArr.map(x => norm(x).toUpperCase()).filter(Boolean).sort().join(',');
    return u !== '' && u === k;
  }
  return norm(userAns).toUpperCase() === key.toUpperCase();
}

function irtAnswerKey(soal, ans) {
  if (answerIsEmpty(ans)) return '';
  const tipe = normalizeType(soal && soal.tipe);
  if (tipe === 'mc') {
    const arr = Array.isArray(ans) ? ans : String(ans || '').split(',');
    return arr.map(x => norm(x).toUpperCase()).filter(Boolean).sort().join(',');
  }
  if (tipe === 'pg') return norm(ans).toUpperCase();
  return norm(ans).toUpperCase().replace(/\s+/g, ' ').slice(0, 120);
}

function roundScore(v) {
  const n = Number(v || 0);
  return Math.round(n * 100) / 100;
}

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

module.exports = {
  norm, normToken, isTrue, num, normalizeType, normalizeScoreMode, scoreModeLabel,
  answerIsEmpty, isCorrectAnswer, irtAnswerKey, roundScore, safeJsonParse
};
