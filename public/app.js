/* Portal Ujian - frontend vanilla JS, memanggil REST API Express (lihat routes/*.js) */
const S = {
  currentUser: null, userSession: null, currentPage: 'landing',
  examSoalList: [], answers: {}, raguMap: {}, curIdx: 0, timer: null, timeLeft: 0, startTime: null, pelanggaranLog: [],
  currentReview: [], reviewIdx: 0, lastResult: null, selectedPaketUser: '',
  allConfig: [], allSoal: [], pesertaAccounts: [], adminAccounts: []
};

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function richText(s) {
  let t = esc(String(s == null ? '' : s)).replace(/\r\n/g, '\n');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return t.replace(/\n/g, '<br>');
}
function isTrue(v) { return String(v).toLowerCase() === 'true' || v === true; }
function normType(t) {
  const x = String(t || '').toLowerCase();
  if (x === 'pg') return 'pg'; if (x === 'mc') return 'mc'; if (x === 'isian') return 'isian'; if (x === 'essay') return 'essay';
  return 'pg';
}
function typeLabel(t) { t = normType(t); return { pg: 'Pilihan Ganda', mc: 'Pilihan Banyak', isian: 'Isian Singkat', essay: 'Essay' }[t]; }
function answerIsFilled(v) { return Array.isArray(v) ? v.length > 0 : String(v || '').trim() !== ''; }

function adminToken() { return localStorage.getItem('cbt_admin_token') || ''; }

async function api(path, opts) {
  opts = opts || {};
  const headers = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (path.startsWith('/admin')) headers['x-admin-token'] = adminToken();
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (res.status === 401 && path.startsWith('/admin')) {
    // Sesi admin habis/kadaluwarsa -> paksa login ulang
    localStorage.removeItem('cbt_admin_logged'); localStorage.removeItem('cbt_admin_token');
    showAlert(data.message || 'Sesi admin berakhir, silakan login ulang.');
    showPage('admin-login');
  }
  return data;
}

function setLoading(v) { $('g-loading').classList.toggle('hidden', !v); }
function toast(msg) {
  const t = $('g-toast'); t.textContent = msg || ''; t.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}
function showAppModal(title, message, actions) {
  $('modal-title').textContent = title || 'Pemberitahuan';
  $('modal-message').textContent = message || '';
  const box = $('modal-actions'); box.innerHTML = '';
  (actions && actions.length ? actions : [{ label: 'OK', primary: true }]).forEach(a => {
    const b = document.createElement('button');
    b.className = a.primary ? 'btn-primary text-xs py-2' : 'btn-muted text-xs py-2';
    b.textContent = a.label;
    b.onclick = () => { $('app-modal').classList.add('hidden'); if (a.onClick) a.onClick(); };
    box.appendChild(b);
  });
  $('app-modal').classList.remove('hidden');
}
function showAlert(msg) { showAppModal('Pemberitahuan', msg, [{ label: 'OK', primary: true }]); }
function showConfirm(title, msg, onYes) { showAppModal(title, msg, [{ label: 'Batal' }, { label: 'OK', primary: true, onClick: onYes }]); }
function fmtDate(v) { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? v : d.toLocaleString('id-ID'); }

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = $('page-' + name);
  if (el) el.classList.add('active');
  S.currentPage = name;
  window.scrollTo(0, 0);
}

/* ===================== PESERTA ===================== */
async function doPesertaLogin() {
  const username = $('p-user').value.trim(), password = $('p-pass').value.trim();
  if (!username || !password) return toast('Isi username dan password.');
  setLoading(true);
  const r = await api('/peserta/login', { method: 'POST', body: { username, password } });
  setLoading(false);
  if (!r.success) return toast(r.message);
  S.currentUser = r.user;
  localStorage.setItem('cbt_current_user', JSON.stringify(r.user));
  loadStudentPackages();
}
function logoutPeserta() { localStorage.removeItem('cbt_current_user'); S.currentUser = null; showPage('landing'); }

function renderStudentProfile(profile) {
  profile = profile || {};
  const data = [
    ['Paket selesai', `${profile.paket_selesai || 0} / ${profile.total_paket_aktif || 0}`, 'text-purple-600'],
    ['Total attempt', profile.total_attempt || 0, 'text-cyan-600'],
    ['Rata-rata', profile.rata_rata || 0, 'text-emerald-600'],
    ['Nilai terbaik', profile.nilai_terbaik || 0, 'text-amber-600']
  ];
  const grid = $('student-profile-grid'); grid.innerHTML = '';
  data.forEach(x => {
    const d = document.createElement('div'); d.className = 'card p-4';
    d.innerHTML = `<p class="text-[10px] font-black text-slate-400 uppercase mb-1">${x[0]}</p><p class="text-2xl font-black ${x[2]}">${esc(x[1])}</p>`;
    grid.appendChild(d);
  });
}

async function loadStudentPackages() {
  clearInterval(S.timer);
  if (!S.currentUser) return showPage('peserta-login');
  setLoading(true);
  const r = await api('/exam/packages?username=' + encodeURIComponent(S.currentUser.username));
  setLoading(false);
  if (!r.success) { toast(r.message); return logoutPeserta(); }
  S.currentUser = r.user;
  $('dashboard-title').textContent = 'Hi, ' + (r.user.nama || r.user.username);
  renderStudentProfile(r.profile);
  const grid = $('user-package-grid'); grid.innerHTML = '';
  if (!r.data.length) { grid.innerHTML = '<div class="card p-6 text-center text-sm font-bold text-slate-400">Tidak ada paket aktif.</div>'; }
  r.data.forEach(pkg => grid.appendChild(makePackageCard(pkg)));
  showPage('user-packages');
}

function makePackageCard(pkg) {
  const done = isTrue(pkg.sudah_dikerjakan), canStart = isTrue(pkg.can_start);
  const div = document.createElement('div');
  div.className = 'card p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between';
  const skorTampil = (pkg.skor === '' || pkg.skor == null) ? 'Menunggu' : pkg.skor;
  const scoreInfo = done ? (isTrue(pkg.tampil_nilai) ? `<span class="text-emerald-700 font-black">Skor: ${esc(skorTampil)}${skorTampil !== 'Menunggu' && pkg.skor_maks ? ' / ' + esc(pkg.skor_maks) : ''}</span>` : '<span class="text-slate-400 font-bold">Nilai akan diumumkan</span>') : '<span class="text-slate-400 font-bold">Belum ada nilai</span>';
  const attemptLabel = Number(pkg.kesempatan_maks) === 0 ? `${pkg.attempt_count} / ∞` : `${pkg.attempt_count} / ${pkg.kesempatan_label}`;
  div.innerHTML = `<div class="min-w-0">
      <div class="flex flex-wrap gap-2 items-center">
        <h4 class="font-black text-base">${esc(pkg.paket)}</h4>
        ${done ? '<span class="pill bg-emerald-50 text-emerald-700 border border-emerald-200">SUDAH</span>' : '<span class="pill bg-purple-50 text-purple-700 border border-purple-200">BELUM</span>'}
        ${canStart ? '<span class="pill bg-blue-50 text-blue-700 border border-blue-200">BISA DIKERJAKAN</span>' : '<span class="pill bg-slate-100 text-slate-500 border">HABIS</span>'}
      </div>
      <p class="text-xs text-slate-400 font-bold mt-1">⏱️ ${esc(pkg.durasi)} menit | 📝 ${esc(pkg.jumlah_soal)} soal | 🔁 ${attemptLabel}</p>
      <p class="text-xs mt-2">${scoreInfo}</p>
    </div>`;
  const actions = document.createElement('div'); actions.className = 'flex flex-wrap gap-2 shrink-0';
  if (done) { const b = document.createElement('button'); b.className = 'btn-muted text-xs py-2'; b.textContent = 'Lihat Hasil'; b.onclick = () => lihatHasilPaket(pkg.paket); actions.appendChild(b); }
  if (canStart) { const b = document.createElement('button'); b.className = 'btn-primary text-xs py-2'; b.textContent = done ? 'Kerjakan Lagi' : 'Kerjakan'; b.onclick = () => selectPackageForExam(pkg.paket); actions.appendChild(b); }
  div.appendChild(actions);
  return div;
}

function selectPackageForExam(pName) { S.selectedPaketUser = pName; $('token-package-title').textContent = pName; $('u-token').value = ''; showPage('token'); }

async function submitTokenPaket() {
  const token = $('u-token').value.trim();
  if (!token) return toast('Masukkan token akses.');
  setLoading(true);
  const r = await api('/exam/verify-access', { method: 'POST', body: { username: S.currentUser.username, paket: S.selectedPaketUser, token } });
  if (!r.success) { setLoading(false); return toast(r.message); }
  S.userSession = r.session;
  const resSoal = await api(`/exam/soal?paket=${encodeURIComponent(S.userSession.paket)}&acak_soal=${S.userSession.acak_soal}&acak_opsi=${S.userSession.acak_opsi}`);
  setLoading(false);
  if (!resSoal.success) return toast(resSoal.message);
  S.examSoalList = resSoal.data || [];
  if (!S.examSoalList.length) return toast('Paket ini belum memiliki soal.');
  $('instr-paket').textContent = S.userSession.paket;
  $('instr-durasi').textContent = S.userSession.durasi;
  $('instr-soal').textContent = S.examSoalList.length;
  $('instr-attempt').textContent = S.userSession.attempt_ke + (Number(S.userSession.kesempatan_maks) === 0 ? ' / tidak terbatas' : ' / ' + S.userSession.kesempatan_maks);
  showPage('instructions');
}

async function lihatHasilPaket(paket) {
  setLoading(true);
  const r = await api(`/exam/review?username=${encodeURIComponent(S.currentUser.username)}&paket=${encodeURIComponent(paket)}`);
  setLoading(false);
  if (!r.success) return toast(r.message);
  renderResult(r);
}

/* ===================== EXAM ===================== */
function startExam() {
  S.answers = {}; S.raguMap = {}; S.curIdx = 0; S.startTime = new Date().toISOString(); S.pelanggaranLog = [];
  S.timeLeft = (parseInt(S.userSession.durasi, 10) || 60) * 60;
  $('exam-paket-name').textContent = S.userSession.paket;
  showPage('exam'); renderQ(0); buildNavGrid(); updateTimerDisplay();
  clearInterval(S.timer);
  S.timer = setInterval(() => {
    S.timeLeft--; updateTimerDisplay();
    if (S.timeLeft <= 0) { clearInterval(S.timer); executeSubmitExam(); }
  }, 1000);
}

function getOptions(q) {
  const arr = [];
  if (normType(q.tipe) !== 'pg' && normType(q.tipe) !== 'mc') return arr;
  ['A', 'B', 'C', 'D', 'E'].forEach(k => { const t = q['opsi_' + k.toLowerCase()]; if (String(t || '').trim()) arr.push({ k, txt: t }); });
  return arr;
}
function optionStoredKey(q, k) { return (q.option_map && q.option_map[k]) ? q.option_map[k] : k; }

function renderQ(idx) {
  if (!S.examSoalList.length) return;
  S.curIdx = idx;
  const q = S.examSoalList[idx], tipe = normType(q.tipe);
  $('exam-cur').textContent = idx + 1; $('exam-tot').textContent = S.examSoalList.length;
  $('exam-qtxt').innerHTML = richText(q.soal || '(Soal kosong)');
  $('chk-ragu').checked = !!S.raguMap[q.id];
  const imgwrap = $('exam-imgwrap');
  if (q.url_gambar) { $('exam-img').src = q.url_gambar; imgwrap.classList.remove('hidden'); } else { imgwrap.classList.add('hidden'); }

  const area = $('exam-answer-area'); area.innerHTML = '';
  if (tipe === 'pg') {
    getOptions(q).forEach(o => {
      const stored = optionStoredKey(q, o.k);
      const btn = document.createElement('button');
      btn.className = 'opt ' + (S.answers[q.id] === stored ? 'sel' : '');
      btn.onclick = () => { S.answers[q.id] = stored; renderQ(S.curIdx); buildNavGrid(); };
      btn.innerHTML = `<div class="opt-k">${o.k}</div><span class="text-sm">${richText(o.txt)}</span>`;
      area.appendChild(btn);
    });
  } else if (tipe === 'mc') {
    let current = S.answers[q.id] || [];
    if (typeof current === 'string') current = current.split(',').filter(Boolean);
    getOptions(q).forEach(o => {
      const stored = optionStoredKey(q, o.k);
      const checked = current.indexOf(stored) >= 0;
      const lbl = document.createElement('label');
      lbl.className = 'flex items-center gap-3 p-3.5 border rounded-xl bg-white mb-2 cursor-pointer text-sm ' + (checked ? 'border-purple-600 bg-purple-50' : 'border-slate-200');
      lbl.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}> <span><b>${o.k}.</b> ${richText(o.txt)}</span>`;
      lbl.querySelector('input').onchange = e => {
        if (e.target.checked) { if (current.indexOf(stored) < 0) current.push(stored); }
        else current = current.filter(x => x !== stored);
        S.answers[q.id] = current; buildNavGrid();
      };
      area.appendChild(lbl);
    });
  } else if (tipe === 'isian') {
    area.innerHTML = `<input type="text" class="inp bg-white" placeholder="Jawaban singkat..." value="${esc(S.answers[q.id] || '')}">`;
    area.querySelector('input').oninput = e => { S.answers[q.id] = e.target.value; buildNavGrid(); };
  } else {
    area.innerHTML = `<textarea rows="5" class="inp bg-white" placeholder="Jawaban uraian...">${esc(S.answers[q.id] || '')}</textarea>`;
    area.querySelector('textarea').oninput = e => { S.answers[q.id] = e.target.value; buildNavGrid(); };
  }
  $('btn-prev').disabled = idx === 0; $('btn-next').disabled = idx === S.examSoalList.length - 1;
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([$('page-exam')]).catch(() => {});
}
function toggleRagu() { const q = S.examSoalList[S.curIdx]; if (!q) return; S.raguMap[q.id] = $('chk-ragu').checked; buildNavGrid(); }
function navQ(d) { const n = S.curIdx + d; if (n >= 0 && n < S.examSoalList.length) renderQ(n); }
function updateTimerDisplay() {
  const m = Math.floor(S.timeLeft / 60), s = S.timeLeft % 60, el = $('exam-timer');
  el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  el.classList.toggle('danger', S.timeLeft <= 60);
}
function buildNavGrid() {
  const g = $('exam-navgrid'); g.innerHTML = '';
  S.examSoalList.forEach((s, i) => {
    const answered = answerIsFilled(S.answers[s.id]);
    const cls = i === S.curIdx ? 'cu' : S.raguMap[s.id] ? 'rg' : answered ? 'an' : 'un';
    const b = document.createElement('button'); b.className = 'nsq ' + cls; b.textContent = i + 1; b.onclick = () => renderQ(i);
    g.appendChild(b);
  });
}
function confirmSubmit() { showConfirm('Kumpulkan Jawaban', 'Kumpulkan lembar jawaban sekarang?', () => { clearInterval(S.timer); executeSubmitExam(); }); }
async function executeSubmitExam() {
  setLoading(true);
  const pelanggaran = S.pelanggaranLog.length ? S.pelanggaranLog.join('; ') : 'Aman';
  const r = await api('/exam/submit', { method: 'POST', body: { username: S.currentUser.username, paket: S.userSession.paket, waktu_mulai: S.startTime, jawaban: S.answers, pelanggaran } });
  setLoading(false);
  if (!r.success) return showAlert(r.message || 'Gagal submit.');
  renderResult(r);
}

// Anti-kecurangan sederhana (client-side saja; mudah dilewati orang yang niat, tapi cukup untuk mencegah kecurangan kasual)
document.addEventListener('contextmenu', e => { if (S.currentPage === 'exam') e.preventDefault(); });
document.addEventListener('copy', e => { if (S.currentPage === 'exam') { e.preventDefault(); catatPelanggaran('Mencoba copy'); } });
window.addEventListener('blur', () => { if (S.currentPage === 'exam') catatPelanggaran('Keluar fokus halaman'); });
document.addEventListener('visibilitychange', () => { if (S.currentPage === 'exam' && document.hidden) catatPelanggaran('Pindah tab/minimize'); });
function catatPelanggaran(jenis) { const log = `[${new Date().toLocaleTimeString('id-ID')}] ${jenis}`; if (!S.pelanggaranLog.includes(log)) S.pelanggaranLog.push(log); }

/* ===================== HASIL & REVIEW ===================== */
function renderResult(r) {
  clearInterval(S.timer); S.lastResult = r; S.currentReview = r.review || []; S.reviewIdx = 0;
  $('res-name').textContent = `${r.nama || ''} • ${r.paket || ''}${r.attempt_ke ? ' • Attempt ' + r.attempt_ke : ''}`;
  if (isTrue(r.tampil_nilai)) {
    $('result-dashboard-view').style.display = 'block'; $('result-hidden-score').classList.add('hidden');
    if (r.irt_pending || r.skor === '' || r.skor == null) {
      $('res-score').textContent = 'Menunggu';
      $('res-score-max').textContent = 'Skor muncul setelah minimal 2 peserta mengerjakan';
    } else {
      $('res-score').textContent = r.skor;
      $('res-score-max').textContent = r.skor_maks ? 'Skor Akhir / Maks: ' + r.skor_maks : 'Skor Akhir';
    }
    $('res-benar').textContent = r.benar || 0; $('res-kosong').textContent = r.kosong || 0; $('res-salah').textContent = r.salah || 0;
  } else { $('result-dashboard-view').style.display = 'none'; $('result-hidden-score').classList.remove('hidden'); }
  if (isTrue(r.tampil_kunci) && S.currentReview.length) { $('btn-review-result').classList.remove('hidden'); $('result-hidden-review').classList.add('hidden'); }
  else { $('btn-review-result').classList.add('hidden'); $('result-hidden-review').classList.remove('hidden'); }
  showPage('results');
}
function returnToPackages() { if (!S.currentUser) return showPage('peserta-login'); loadStudentPackages(); }
function openReviewFromResult() { if (!S.currentReview.length) return toast('Review belum tersedia.'); renderReviewQuestion(0); showPage('review'); }
function navReview(d) { const n = S.reviewIdx + d; if (n >= 0 && n < S.currentReview.length) renderReviewQuestion(n); }
function renderReviewQuestion(idx) {
  S.reviewIdx = idx;
  const q = S.currentReview[idx], tipe = normType(q.tipe);
  $('review-title').textContent = 'Review ' + (S.lastResult ? S.lastResult.paket : '');
  $('review-meta').textContent = S.lastResult ? `${S.lastResult.nama || ''} • ${S.lastResult.skor !== '' ? 'Skor ' + S.lastResult.skor : 'Menunggu'}` : '';
  $('review-cur').textContent = idx + 1; $('review-tot').textContent = S.currentReview.length;
  $('review-qtxt').innerHTML = richText(q.soal || '(Soal tidak ditemukan)');
  if (q.url_gambar) { $('review-img').src = q.url_gambar; $('review-imgwrap').classList.remove('hidden'); } else { $('review-imgwrap').classList.add('hidden'); }
  const area = $('review-answer-area'); area.innerHTML = '';
  const ans = q.jawaban_user;
  const key = String(q.kunci || '').toUpperCase().split(',').map(x => x.trim()).filter(Boolean);
  if (tipe === 'pg' || tipe === 'mc') {
    getOptions(q).forEach(o => {
      const picked = Array.isArray(ans) ? ans.indexOf(o.k) >= 0 : String(ans || '').toUpperCase() === o.k;
      const isKey = key.indexOf(o.k) >= 0;
      const cls = isKey ? 'correct' : (picked && !isKey ? 'wrong' : '');
      const d = document.createElement('div'); d.className = 'opt ' + cls;
      d.innerHTML = `<div class="opt-k">${o.k}</div><span class="text-sm">${richText(o.txt)}</span>`;
      area.appendChild(d);
    });
  } else {
    const isCorrect = isTrue(q.benar);
    area.innerHTML = `<div class="p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}"><div class="text-xs font-black uppercase mb-1">Jawaban kamu</div><div class="text-sm font-bold whitespace-pre-wrap">${richText(ans || 'Kosong')}</div></div>
      <div class="p-4 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-700 mt-3"><div class="text-xs font-black uppercase mb-1">Kunci</div><div class="text-sm font-bold whitespace-pre-wrap">${richText(q.kunci || '-')}</div></div>`;
  }
  buildReviewNavGrid();
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([$('page-review')]).catch(() => {});
}
function buildReviewNavGrid() {
  const g = $('review-navgrid'); g.innerHTML = '';
  S.currentReview.forEach((s, i) => {
    const cls = i === S.reviewIdx ? 'cu' : (s.benar ? 'ok' : (s.kosong ? 'un' : 'bad'));
    const b = document.createElement('button'); b.className = 'nsq ' + cls; b.textContent = i + 1; b.onclick = () => renderReviewQuestion(i);
    g.appendChild(b);
  });
}

/* ===================== ADMIN ===================== */
async function doAdminLogin() {
  const u = $('a-user').value.trim(), p = $('a-pass').value.trim();
  if (!u || !p) return toast('Isi username dan password admin.');
  setLoading(true);
  const r = await api('/admin/login', { method: 'POST', body: { username: u, password: p } });
  setLoading(false);
  if (!r.success) return toast(r.message);
  localStorage.setItem('cbt_admin_logged', 'true');
  localStorage.setItem('cbt_admin_token', r.token || '');
  showPage('admin'); switchTab('dashboard');
}
function doAdminLogout() { localStorage.removeItem('cbt_admin_logged'); localStorage.removeItem('cbt_admin_token'); showPage('landing'); }

function switchTab(n) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.snav').forEach(b => b.classList.remove('on'));
  $('tab-' + n).classList.add('on'); $('snav-' + n).classList.add('on');
  const titles = { dashboard: 'Dashboard', pengaturan: 'Parameter Paket', soal: 'Modul Soal', peserta: 'Akun Peserta', adminakun: 'Akun Admin', hasil: 'Log Nilai' };
  $('admin-title').textContent = titles[n];
  if (n === 'dashboard') loadDashboardStats();
  if (n === 'pengaturan') fetchAdminConfigTable();
  if (n === 'soal') loadSoalAdminPanel();
  if (n === 'peserta') fetchPesertaTable();
  if (n === 'adminakun') fetchAdminAccountsTable();
  if (n === 'hasil') { fillIrtPaketOptions(); fetchHasilAdmin(); }
}
async function loadDashboardStats() {
  const r = await api('/admin/dashboard-stats');
  if (!r.success) return;
  $('stat-soal').textContent = r.jumlahSoal; $('stat-peserta').textContent = r.jumlahPeserta;
  $('stat-paket').textContent = r.jumlahPaket; $('stat-hasil').textContent = r.jumlahHasil;
}

/* ---- Pengaturan Paket ---- */
async function fetchAdminConfigTable() {
  setLoading(true); const r = await api('/admin/pengaturan'); setLoading(false);
  S.allConfig = r.data || []; renderSettingTable();
}
function selectBoolCell(v, onchange, yes, no) {
  return `<td class="p-2"><select class="p-2 border text-xs rounded-xl bg-white" onchange="${onchange}">
    <option value="true" ${isTrue(v) ? 'selected' : ''}>${yes}</option>
    <option value="false" ${!isTrue(v) ? 'selected' : ''}>${no}</option></select></td>`;
}
function scoreModeCell(v, onchange) {
  v = v || 'irt_utbk';
  return `<td class="p-2"><select class="p-2 border text-xs rounded-xl bg-white min-w-[180px]" onchange="${onchange}">
    <option value="irt_utbk" ${v === 'irt_utbk' ? 'selected' : ''}>IRT-like UTBK</option>
    <option value="poin_benar" ${v === 'poin_benar' ? 'selected' : ''}>Poin benar saja</option>
    <option value="poin_lengkap" ${v === 'poin_lengkap' ? 'selected' : ''}>Poin benar/kosong/salah</option></select></td>`;
}
function renderSettingTable() {
  const tbody = $('tbl-setting-body'); tbody.innerHTML = '';
  if (!S.allConfig.length) { tbody.innerHTML = '<tr><td colspan="11" class="p-4 text-center text-slate-400 font-bold">Belum ada paket.</td></tr>'; return; }
  S.allConfig.forEach((row, i) => {
    const tr = document.createElement('tr'); tr.className = 'hover:bg-slate-50';
    tr.innerHTML =
      `<td class="p-2"><input value="${esc(row.paket || '')}" class="inp p-2 text-xs font-bold" onchange="S.allConfig[${i}].paket=this.value"></td>
      <td class="p-2"><input value="${esc(row.token_ujian || '')}" class="inp p-2 text-xs font-mono uppercase text-center" onchange="S.allConfig[${i}].token_ujian=this.value"></td>
      <td class="p-2"><input type="number" value="${esc(row.durasi || 60)}" class="inp p-2 text-xs text-center" onchange="S.allConfig[${i}].durasi=this.value"></td>` +
      selectBoolCell(row.status_aktif, `S.allConfig[${i}].status_aktif=this.value`, 'Aktif', 'Non') +
      selectBoolCell(row.tampil_nilai, `S.allConfig[${i}].tampil_nilai=this.value`, 'Tampil', 'Sembunyi') +
      selectBoolCell(row.tampil_kunci, `S.allConfig[${i}].tampil_kunci=this.value`, 'Tampil', 'Sembunyi') +
      selectBoolCell(row.acak_soal, `S.allConfig[${i}].acak_soal=this.value`, 'Acak', 'Urut') +
      selectBoolCell(row.acak_opsi, `S.allConfig[${i}].acak_opsi=this.value`, 'Acak', 'Urut') +
      scoreModeCell(row.metode_skor, `S.allConfig[${i}].metode_skor=this.value`) +
      `<td class="p-2"><input type="number" min="0" value="${row.kesempatan_maks ?? 1}" class="inp p-2 text-xs text-center" onchange="S.allConfig[${i}].kesempatan_maks=this.value"></td>
      <td class="p-2 text-center"><button onclick="S.allConfig.splice(${i},1);renderSettingTable();" class="text-red-500 font-black">✕</button></td>`;
    tbody.appendChild(tr);
  });
}
function addNewPackageRow() {
  S.allConfig.push({ paket: 'Paket Baru', token_ujian: 'TOKEN123', durasi: 60, status_aktif: 'true', tampil_nilai: 'true', tampil_kunci: 'true', acak_soal: 'false', acak_opsi: 'false', metode_skor: 'irt_utbk', kesempatan_maks: 1 });
  renderSettingTable();
}
async function saveAllSettingsMulti() {
  setLoading(true);
  const r = await api('/admin/pengaturan', { method: 'POST', body: { rows: S.allConfig } });
  setLoading(false);
  if (!r.success) return toast(r.message);
  toast('Parameter disimpan.'); loadDashboardStats();
}

/* ---- Modul Soal ---- */
function renderKunciFormAdmin() {
  const box = $('box-kunci-options'); box.innerHTML = '';
  ['A', 'B', 'C', 'D', 'E'].forEach(o => {
    const lbl = document.createElement('label');
    lbl.className = 'flex items-center gap-1.5 text-xs font-bold bg-slate-100 px-3 py-2 border rounded-xl cursor-pointer';
    lbl.innerHTML = `<input type="checkbox" value="${o}" class="kunci-chk-node"> <span>${o}</span>`;
    box.appendChild(lbl);
  });
}
function adjustFormTipeSoal() {
  const t = normType($('inp-tipe').value);
  const opts = $('wrapper-opsi-pg'), text = $('inp-kunci-teks'), box = $('box-kunci-options');
  document.querySelectorAll('.kunci-chk-node').forEach(n => n.checked = false); $('inp-kunci-teks').value = '';
  if (t === 'pg' || t === 'mc') { opts.style.display = 'block'; box.style.display = 'flex'; text.classList.add('hidden'); }
  else { opts.style.display = 'none'; box.style.display = 'none'; text.classList.remove('hidden'); }
}
function packageKey(v) { return String(v || '').trim().toLowerCase(); }
async function loadSoalAdminPanel() {
  setLoading(true);
  const rc = await api('/admin/pengaturan'); S.allConfig = rc.data || [];
  const rs = await api('/admin/soal'); S.allSoal = rs.data || [];
  setLoading(false);
  const optTarget = $('inp-target-paket'); optTarget.innerHTML = '';
  const optFilter = $('filter-soal-paket'); const prev = optFilter.value; optFilter.innerHTML = '<option value="ALL">Semua Paket</option>';
  const seen = {};
  S.allConfig.forEach(c => {
    if (!packageKey(c.paket) || seen[packageKey(c.paket)]) return; seen[packageKey(c.paket)] = true;
    optTarget.innerHTML += `<option value="${esc(c.paket)}">${esc(c.paket)}</option>`;
    optFilter.innerHTML += `<option value="${esc(c.paket)}">${esc(c.paket)}</option>`;
  });
  if (prev && [...optFilter.options].some(o => o.value === prev)) optFilter.value = prev;
  renderSoalListFiltered(); adjustFormTipeSoal(); renderKunciFormAdmin();
}
function renderSoalListFiltered() {
  const filter = $('filter-soal-paket').value; const wrapper = $('soal-list-wrapper'); wrapper.innerHTML = '';
  const list = filter === 'ALL' ? S.allSoal : S.allSoal.filter(s => packageKey(s.paket) === packageKey(filter));
  if (!list.length) { wrapper.innerHTML = '<p class="text-center text-slate-400 py-4 text-xs font-medium">Belum ada soal.</p>'; return; }
  list.forEach(s => {
    const tipe = normType(s.tipe);
    const opts = (tipe === 'pg' || tipe === 'mc') ? getOptions(s).map(o => `<span class="bg-white border rounded-lg px-2 py-1"><b>${o.k}.</b> ${richText(o.txt)}</span>`).join(' ') : '';
    const div = document.createElement('div'); div.className = 'p-4 border rounded-2xl bg-slate-50 space-y-2 text-xs';
    const img = s.url_gambar ? `<img src="${esc(s.url_gambar)}" class="max-h-24 rounded-xl border object-contain bg-white p-1">` : '';
    div.innerHTML = `<div class="flex justify-between gap-3">
      <div class="flex gap-1.5 flex-wrap">
        <span class="bg-blue-600 text-white font-bold px-2 py-0.5 rounded">${esc(s.paket)}</span>
        <span class="bg-slate-700 text-white font-bold px-2 py-0.5 rounded">${typeLabel(s.tipe)}</span>
        <span class="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">Kunci: ${esc(s.kunci)}</span>
        <span class="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded">Poin: ${esc(s.poin_benar)}/${esc(s.poin_kosong)}/${esc(s.poin_salah)}</span>
      </div>
      <div class="flex gap-1 shrink-0"><button class="text-purple-600 font-bold" data-act="edit">Edit</button><button class="text-red-500 font-bold" data-act="del">Hapus</button></div>
    </div>
    <div class="flex gap-3 items-start">${img}<p class="font-medium flex-1">${richText(s.soal)}</p></div>
    ${opts ? `<div class="flex flex-wrap gap-1.5">${opts}</div>` : '<div class="text-slate-400 font-bold">Tidak memakai opsi.</div>'}`;
    div.querySelector('[data-act=edit]').onclick = () => editSoalAdmin(s.id);
    div.querySelector('[data-act=del]').onclick = () => deleteSoalAdmin(s.id);
    wrapper.appendChild(div);
  });
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([wrapper]).catch(() => {});
}
function collectSoalData() {
  const t = normType($('inp-tipe').value); let finalKunci = '';
  if (t === 'pg' || t === 'mc') {
    const checked = [...document.querySelectorAll('.kunci-chk-node:checked')].map(n => n.value);
    if (t === 'pg' && checked.length !== 1) { showAlert('Pilihan ganda harus punya tepat 1 kunci.'); return null; }
    if (t === 'mc' && !checked.length) { showAlert('Pilih minimal 1 kunci.'); return null; }
    finalKunci = checked.join(',');
  } else {
    finalKunci = $('inp-kunci-teks').value.trim();
    if (!finalKunci) { showAlert('Kunci/rubrik wajib diisi.'); return null; }
  }
  const data = {
    id: $('editing-soal-id').value, paket: $('inp-target-paket').value, tipe: t, soal: $('inp-soal').value,
    url_gambar: $('inp-gambar').value, opsi_a: $('inp-a').value, opsi_b: $('inp-b').value, opsi_c: $('inp-c').value,
    opsi_d: $('inp-d').value, opsi_e: $('inp-e').value, kunci: finalKunci,
    poin_benar: $('inp-poin-benar').value, poin_kosong: $('inp-poin-kosong').value, poin_salah: $('inp-poin-salah').value
  };
  if (!data.paket || !data.soal.trim()) { showAlert('Target paket dan teks soal wajib diisi.'); return null; }
  return data;
}
async function submitSoalForm() {
  const data = collectSoalData(); if (!data) return;
  setLoading(true);
  const r = data.id ? await api('/admin/soal/' + data.id, { method: 'PUT', body: data }) : await api('/admin/soal', { method: 'POST', body: data });
  setLoading(false);
  if (!r.success) return toast(r.message);
  toast(data.id ? 'Soal diperbarui.' : 'Soal disimpan.'); resetSoalForm(); loadSoalAdminPanel(); loadDashboardStats();
}
function editSoalAdmin(id) {
  const s = S.allSoal.find(x => String(x.id) === String(id)); if (!s) return toast('Soal tidak ditemukan.');
  $('editing-soal-id').value = s.id; $('form-soal-title').textContent = 'Edit Soal'; $('btn-submit-soal').textContent = 'Update Soal'; $('btn-cancel-edit').classList.remove('hidden');
  $('inp-target-paket').value = s.paket; $('inp-tipe').value = normType(s.tipe); adjustFormTipeSoal();
  $('inp-soal').value = s.soal || ''; $('inp-gambar').value = s.url_gambar || ''; updatePreviewGambar();
  $('inp-a').value = s.opsi_a || ''; $('inp-b').value = s.opsi_b || ''; $('inp-c').value = s.opsi_c || ''; $('inp-d').value = s.opsi_d || ''; $('inp-e').value = s.opsi_e || '';
  $('inp-poin-benar').value = s.poin_benar || 1; $('inp-poin-kosong').value = s.poin_kosong || 0; $('inp-poin-salah').value = s.poin_salah || 0;
  document.querySelectorAll('.kunci-chk-node').forEach(n => n.checked = false);
  if (normType(s.tipe) === 'pg' || normType(s.tipe) === 'mc') {
    String(s.kunci || '').split(',').forEach(k => { const n = document.querySelector(`.kunci-chk-node[value="${k.trim().toUpperCase()}"]`); if (n) n.checked = true; });
  } else { $('inp-kunci-teks').value = s.kunci || ''; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetSoalForm() {
  $('editing-soal-id').value = ''; $('form-soal-title').textContent = 'Input Soal'; $('btn-submit-soal').textContent = 'Simpan Soal'; $('btn-cancel-edit').classList.add('hidden');
  ['inp-soal', 'inp-gambar', 'inp-a', 'inp-b', 'inp-c', 'inp-d', 'inp-e', 'inp-kunci-teks', 'file-gambar'].forEach(id => $(id).value = '');
  $('inp-poin-benar').value = 1; $('inp-poin-kosong').value = 0; $('inp-poin-salah').value = 0;
  document.querySelectorAll('.kunci-chk-node').forEach(n => n.checked = false);
  updatePreviewGambar(); adjustFormTipeSoal();
}
function deleteSoalAdmin(id) {
  showConfirm('Hapus Soal', 'Hapus soal ini?', async () => {
    setLoading(true); const r = await api('/admin/soal/' + id, { method: 'DELETE' }); setLoading(false);
    if (!r.success) return toast(r.message);
    toast('Soal dihapus.'); loadSoalAdminPanel(); loadDashboardStats();
  });
}
async function uploadGambarAdmin() {
  const f = $('file-gambar').files[0]; if (!f) return toast('Pilih file gambar dulu.');
  if (f.size > 8 * 1024 * 1024) return toast('Ukuran gambar maksimal 8 MB.');
  $('upload-status').textContent = 'Upload...'; setLoading(true);
  const fd = new FormData(); fd.append('file', f);
  try {
    const res = await fetch('/api/upload/image', { method: 'POST', headers: { 'x-admin-token': adminToken() }, body: fd });
    const r = await res.json();
    setLoading(false);
    if (!r.success) { $('upload-status').textContent = 'Gagal: ' + r.message; return; }
    $('inp-gambar').value = r.url; $('upload-status').textContent = 'Upload berhasil.'; updatePreviewGambar();
  } catch (e) { setLoading(false); $('upload-status').textContent = 'Gagal upload: ' + e.message; }
}
function updatePreviewGambar() {
  const url = $('inp-gambar').value; const img = $('img-preview');
  if (url) { img.src = url; img.classList.remove('hidden'); } else { img.src = ''; img.classList.add('hidden'); }
}
function clearGambarAdmin() { $('inp-gambar').value = ''; $('file-gambar').value = ''; $('upload-status').textContent = ''; updatePreviewGambar(); }
function exportModulePdfAdmin() {
  let paket = $('filter-soal-paket').value; if (paket === 'ALL') paket = $('inp-target-paket').value;
  if (!paket) return toast('Pilih paket dulu.');
  const includeKunci = $('pdf-include-kunci').checked;
  window.open(`/api/pdf/export?paket=${encodeURIComponent(paket)}&include_kunci=${includeKunci}&token=${encodeURIComponent(adminToken())}`, '_blank');
}

/* ---- Akun Peserta & Admin ---- */
async function fetchPesertaTable() { setLoading(true); const r = await api('/admin/peserta-accounts'); setLoading(false); S.pesertaAccounts = r.data || []; renderPesertaTable(); }
function renderPesertaTable() {
  const tb = $('tbl-peserta-body'); tb.innerHTML = '';
  S.pesertaAccounts.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="p-2"><input class="inp p-2 text-xs" value="${esc(r.username)}" onchange="S.pesertaAccounts[${i}].username=this.value"></td>
      <td class="p-2"><input class="inp p-2 text-xs" placeholder="(tidak berubah)" onchange="S.pesertaAccounts[${i}].password=this.value"></td>
      <td class="p-2"><input class="inp p-2 text-xs" value="${esc(r.nama)}" onchange="S.pesertaAccounts[${i}].nama=this.value"></td>
      <td class="p-2"><input class="inp p-2 text-xs" value="${esc(r.nomor_peserta)}" onchange="S.pesertaAccounts[${i}].nomor_peserta=this.value"></td>` +
      selectBoolCell(r.status_aktif, `S.pesertaAccounts[${i}].status_aktif=this.value`, 'Aktif', 'Nonaktif') +
      `<td class="p-2 text-center"><button onclick="S.pesertaAccounts.splice(${i},1);renderPesertaTable();" class="text-red-500 font-black">✕</button></td>`;
    tb.appendChild(tr);
  });
}
function addPesertaRow() { S.pesertaAccounts.push({ username: 'peserta' + (S.pesertaAccounts.length + 1), password: '12345', nama: 'Nama Peserta', nomor_peserta: String(S.pesertaAccounts.length + 1).padStart(3, '0'), status_aktif: 'true' }); renderPesertaTable(); }
async function savePesertaTable() {
  setLoading(true); const r = await api('/admin/peserta-accounts', { method: 'POST', body: { rows: S.pesertaAccounts } }); setLoading(false);
  if (!r.success) return toast(r.message); toast('Akun peserta disimpan.'); loadDashboardStats(); fetchPesertaTable();
}
async function fetchAdminAccountsTable() { setLoading(true); const r = await api('/admin/admin-accounts'); setLoading(false); S.adminAccounts = r.data || []; renderAdminAccountsTable(); }
function renderAdminAccountsTable() {
  const tb = $('tbl-admin-body'); tb.innerHTML = '';
  S.adminAccounts.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="p-2"><input class="inp p-2 text-xs" value="${esc(r.username)}" onchange="S.adminAccounts[${i}].username=this.value"></td>
      <td class="p-2"><input class="inp p-2 text-xs" placeholder="(tidak berubah)" onchange="S.adminAccounts[${i}].password=this.value"></td>
      <td class="p-2"><input class="inp p-2 text-xs" value="${esc(r.nama)}" onchange="S.adminAccounts[${i}].nama=this.value"></td>` +
      selectBoolCell(r.status_aktif, `S.adminAccounts[${i}].status_aktif=this.value`, 'Aktif', 'Nonaktif') +
      `<td class="p-2 text-center"><button onclick="S.adminAccounts.splice(${i},1);renderAdminAccountsTable();" class="text-red-500 font-black">✕</button></td>`;
    tb.appendChild(tr);
  });
}
function addAdminRow() { S.adminAccounts.push({ username: 'admin' + (S.adminAccounts.length + 1), password: 'password', nama: 'Admin Baru', status_aktif: 'true' }); renderAdminAccountsTable(); }
async function saveAdminTable() {
  setLoading(true); const r = await api('/admin/admin-accounts', { method: 'POST', body: { rows: S.adminAccounts } }); setLoading(false);
  if (!r.success) return toast(r.message); toast('Akun admin disimpan.'); fetchAdminAccountsTable();
}

/* ---- Hasil & IRT ---- */
async function fillIrtPaketOptions() {
  const r = await api('/admin/pengaturan'); const sel = $('irt-recalc-paket'); sel.innerHTML = '';
  (r.data || []).forEach(c => sel.innerHTML += `<option value="${esc(c.paket)}">${esc(c.paket)}</option>`);
}
async function recalculateIrtAdmin() {
  const paket = $('irt-recalc-paket').value; if (!paket) return toast('Pilih paket dulu.');
  setLoading(true); const r = await api('/admin/irt/recalculate', { method: 'POST', body: { paket } }); setLoading(false);
  if (!r.success) return showAlert(r.message || 'Gagal hitung ulang IRT.');
  toast(r.message || 'Skor IRT diperbarui.'); fetchHasilAdmin(); loadDashboardStats();
  if (!$('irt-weight-box').classList.contains('hidden')) showIrtWeightsAdmin();
}
async function showIrtWeightsAdmin() {
  const paket = $('irt-recalc-paket').value; if (!paket) return toast('Pilih paket dulu.');
  const box = $('irt-weight-box'); box.classList.remove('hidden'); box.innerHTML = '<div class="text-xs font-bold text-slate-400">Memuat...</div>';
  const r = await api('/admin/irt/weights?paket=' + encodeURIComponent(paket));
  if (!r.success) { box.innerHTML = `<div class="text-xs font-bold text-rose-600">${esc(r.message)}</div>`; return; }
  if (r.pending) { box.innerHTML = `<div class="text-xs font-bold text-amber-600">${esc(r.message)}</div>`; return; }
  let html = `<div class="flex justify-between gap-2 mb-3"><p class="text-sm font-black">Bobot IRT - ${esc(paket)}</p><button onclick="document.getElementById('irt-weight-box').classList.add('hidden')" class="text-xs font-bold text-slate-400">Tutup</button></div>
    <div class="overflow-x-auto"><table class="w-full text-left text-xs min-w-[800px]"><thead><tr class="bg-slate-100"><th class="p-2">No</th><th class="p-2">Soal</th><th class="p-2">Bobot</th><th class="p-2">Benar</th><th class="p-2">Kosong</th><th class="p-2">Salah</th><th class="p-2">%Benar</th></tr></thead><tbody>`;
  (r.data || []).forEach(x => {
    html += `<tr class="border-b"><td class="p-2 font-bold">${x.nomor}</td><td class="p-2 max-w-[300px] truncate">${esc(x.soal)}</td><td class="p-2 font-black text-purple-700">${x.bobot}</td><td class="p-2 text-emerald-700 font-bold">${x.benar}</td><td class="p-2 text-slate-500 font-bold">${x.kosong}</td><td class="p-2 text-rose-700 font-bold">${x.salah}</td><td class="p-2 font-bold">${x.persen_benar}%</td></tr>`;
  });
  html += '</tbody></table></div>'; box.innerHTML = html;
}
async function fetchHasilAdmin() {
  setLoading(true); const r = await api('/admin/hasil'); setLoading(false);
  const tbody = $('hasil-tbody'); tbody.innerHTML = '';
  if (!r.success || !r.data.length) { tbody.innerHTML = '<tr><td colspan="11" class="p-4 text-center text-slate-400 font-medium">Belum ada data.</td></tr>'; return; }
  r.data.forEach(h => {
    const tr = document.createElement('tr'); tr.className = 'hover:bg-slate-50 text-xs';
    const badge = h.pelanggaran === 'Aman' ? '<span class="bg-emerald-50 text-emerald-700 border px-2 py-0.5 rounded font-bold">Aman</span>' : `<span class="bg-rose-50 text-rose-700 border px-2 py-0.5 rounded font-bold" title="${esc(h.pelanggaran)}">⚠️ Pelanggaran</span>`;
    tr.innerHTML = `<td class="p-3 font-bold text-purple-700">${esc(h.paket)}</td><td class="p-3">${esc(h.nama)}</td><td class="p-3 font-mono">${esc(h.username || '—')}</td><td class="p-3 font-mono">${esc(h.nomor_peserta)}</td>
      <td class="p-3 text-center font-bold">${h.attempt_ke}</td><td class="p-3 text-center font-black text-purple-600">${esc(h.skor)}${h.skor_maks ? ' / ' + esc(h.skor_maks) : ''}</td>
      <td class="p-3 text-center font-bold">${h.benar}/${h.kosong}/${h.salah}</td><td class="p-3 text-slate-500 font-bold">${esc(h.metode_skor_label)}</td>
      <td class="p-3 text-center">${badge}</td><td class="p-3 text-slate-400">${fmtDate(h.waktu_selesai)}</td>
      <td class="p-3 text-center"><button class="text-red-500 font-black" data-id="${h.row_id}">Hapus</button></td>`;
    tr.querySelector('button').onclick = () => deleteHasilAdmin(h.row_id);
    tbody.appendChild(tr);
  });
}
function deleteHasilAdmin(id) {
  showConfirm('Hapus Log Nilai', 'Hapus log nilai ini? Kesempatan peserta akan berkurang.', async () => {
    setLoading(true); const r = await api('/admin/hasil/' + id, { method: 'DELETE' }); setLoading(false);
    if (!r.success) return showAlert(r.message);
    toast(r.message); fetchHasilAdmin(); loadDashboardStats();
  });
}

/* ===================== INIT ===================== */
function initApp() {
  if (localStorage.getItem('cbt_admin_logged') === 'true') { showPage('admin'); switchTab('dashboard'); return; }
  const u = localStorage.getItem('cbt_current_user');
  if (u) {
    try { S.currentUser = JSON.parse(u); loadStudentPackages(); return; } catch (e) { localStorage.removeItem('cbt_current_user'); }
  }
  showPage('landing');
}
window.addEventListener('DOMContentLoaded', initApp);
