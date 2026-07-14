// İncil Şərhləri — sayt məntiqi
// - Kitab/fəsil naviqasiyası (əvvəlki/növbəti fəsil daxil)
// - Ayəyə toxunanda modal: şərhlər + şəxsi qeyd (localStorage-da saxlanılır)
// - "Qeydlərim" görünüşü: axtarış, statistika, ehtiyat nüsxə (export/import)
// - Tema və şrift ölçüsü seçimləri yadda saxlanılır, son oxunan yerə davam etmək mümkündür

const NOTE_PREFIX = 'incil-qeyd:';
const THEME_KEY = 'incil-tema';
const FONT_KEY = 'incil-shrift';
const LAST_READ_KEY = 'incil-son-oxunan';

let KITABLAR = null;
let CURRENT = { ehd: null, kitabSlug: null, kitabAdi: null, fesil: null, data: null };

const ehdSelect = document.getElementById('ehd-select');
const kitabSelect = document.getElementById('kitab-select');
const fesilSelect = document.getElementById('fesil-select');
const getBtn = document.getElementById('get-btn');
const reader = document.getElementById('reader');
const notesView = document.getElementById('notes-view');
const notesList = document.getElementById('notes-list');
const notesStats = document.getElementById('notes-stats');
const notesSearch = document.getElementById('notes-search');
const notesExportBtn = document.getElementById('notes-export');
const notesImportInput = document.getElementById('notes-import');
const demoBtn = document.getElementById('demo-btn');
const viewTabs = document.querySelectorAll('.view-tab');
const continueSlot = document.getElementById('continue-slot');

const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalRef = document.getElementById('modal-ref');
const modalVerseText = document.getElementById('modal-verse-text');
const modalCommentary = document.getElementById('modal-commentary');
const copyVerseBtn = document.getElementById('copy-verse-btn');
const copyVerseLabel = document.getElementById('copy-verse-label');
const noteInput = document.getElementById('note-input');
const noteSaveBtn = document.getElementById('note-save');
const noteDeleteBtn = document.getElementById('note-delete');
const noteStatus = document.getElementById('note-status');

let activeVerseKey = null; // "incil-qeyd:kitabSlug:fesil:aye"
let activeVerseRef = null;
let activeVerseText = null;

init();

async function init() {
  try {
    const res = await fetch('data/kitablar.json');
    KITABLAR = await res.json();
    populateKitabSelect();
    populateFesilSelect();
    renderContinueCard();
  } catch (err) {
    console.error('Kitab siyahısı yüklənmədi:', err);
  }

  ehdSelect.addEventListener('change', () => { populateKitabSelect(); populateFesilSelect(); });
  kitabSelect.addEventListener('change', populateFesilSelect);
  getBtn.addEventListener('click', loadChapter);
  demoBtn.addEventListener('click', () => {
    ehdSelect.value = 'ehdi_etiq';
    populateKitabSelect();
    kitabSelect.value = 'yaradilish';
    populateFesilSelect();
    fesilSelect.value = '1';
    loadChapter();
  });

  viewTabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) closeModal();
  });
  noteSaveBtn.addEventListener('click', saveNote);
  noteDeleteBtn.addEventListener('click', deleteNote);
  copyVerseBtn.addEventListener('click', copyActiveVerse);

  notesSearch.addEventListener('input', () => renderNotesList());
  notesExportBtn.addEventListener('click', exportNotes);
  notesImportInput.addEventListener('change', importNotes);

  initThemeAndFont();
}

/* ---------------- Navigation / picker ---------------- */

function populateKitabSelect() {
  const list = KITABLAR[ehdSelect.value];
  kitabSelect.innerHTML = list.map(k => `<option value="${k.slug}">${k.ad}</option>`).join('');
}

function populateFesilSelect() {
  const list = KITABLAR[ehdSelect.value];
  const kitab = list.find(k => k.slug === kitabSelect.value) || list[0];
  const options = [];
  for (let i = 1; i <= kitab.fesil_sayi; i++) options.push(`<option value="${i}">${i}</option>`);
  fesilSelect.innerHTML = options.join('');
}

function switchView(view) {
  viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'reader') {
    reader.classList.remove('hidden');
    notesView.classList.add('hidden');
  } else {
    reader.classList.add('hidden');
    notesView.classList.remove('hidden');
    notesSearch.value = '';
    renderNotesList();
  }
}

/* ---------------- Chapter loading & rendering ---------------- */

async function loadChapter(overrideEhd, overrideSlug, overrideFesil) {
  const ehd = overrideEhd || ehdSelect.value;
  const list = KITABLAR[ehd];
  const kitab = list.find(k => k.slug === (overrideSlug || kitabSelect.value)) || list[0];
  const fesil = overrideFesil || fesilSelect.value;

  reader.innerHTML = `
    <div class="skeleton-lines">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>`;

  try {
    const res = await fetch(`data/${kitab.slug}/${fesil}.json`);
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    CURRENT = { ehd, kitabSlug: kitab.slug, kitabAdi: kitab.ad, fesil: String(fesil), data };
    renderChapter();
    saveLastRead();
  } catch (err) {
    renderUnavailable(kitab.ad, fesil);
  }
}

function renderChapter() {
  const { kitabAdi, data } = CURRENT;
  const total = data.ayeler.length;
  const notedCount = data.ayeler.filter(v => !!getNote(noteKey(CURRENT.kitabSlug, data.fesil, v.aye))).length;

  const flow = data.ayeler.map(v => {
    const key = noteKey(CURRENT.kitabSlug, data.fesil, v.aye);
    const hasNote = !!getNote(key);
    const cls = 'v-tap has-commentary' + (hasNote ? ' has-note' : '');
    return `<span class="${cls}" data-aye="${v.aye}" tabindex="0" role="button">` +
           `<sup class="v-num">${v.aye}</sup>${escapeHtml(v.metn_qisa)}</span> `;
  }).join('');

  const nav = getAdjacentChapters();

  reader.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-head-main">
        <p class="chapter-eyebrow">Protestant şərh külliyyatı</p>
        <h2 class="chapter-title">${kitabAdi} ${data.fesil}</h2>
        ${notedCount ? `<p class="chapter-progress"><span class="dot"></span>${notedCount}/${total} ayədə qeydiniz var</p>` : ''}
      </div>
      <div class="chapter-nav">
        <button class="chapter-nav-btn" id="prev-chapter-btn" ${nav.prev ? '' : 'disabled'} title="Əvvəlki fəsil">
          ‹ <span class="nav-label">Əvvəlki</span>
        </button>
        <button class="chapter-nav-btn" id="next-chapter-btn" ${nav.next ? '' : 'disabled'} title="Növbəti fəsil">
          <span class="nav-label">Növbəti</span> ›
        </button>
      </div>
    </div>
    <p class="reading-flow">${flow}</p>
  `;

  reader.querySelectorAll('.v-tap').forEach(el => {
    el.addEventListener('click', () => openVerse(parseInt(el.dataset.aye, 10)));
    el.addEventListener('keypress', (e) => { if (e.key === 'Enter') openVerse(parseInt(el.dataset.aye, 10)); });
  });

  const prevBtn = document.getElementById('prev-chapter-btn');
  const nextBtn = document.getElementById('next-chapter-btn');
  if (nav.prev) prevBtn.addEventListener('click', () => jumpTo(nav.prev));
  if (nav.next) nextBtn.addEventListener('click', () => jumpTo(nav.next));
}

// Kitab siyahısındakı sıraya görə əvvəlki/növbəti fəsli tapır (kitab sərhədini keçə bilir)
function getAdjacentChapters() {
  const list = KITABLAR[CURRENT.ehd];
  const idx = list.findIndex(k => k.slug === CURRENT.kitabSlug);
  const fesilNum = parseInt(CURRENT.fesil, 10);
  const kitab = list[idx];

  let prev = null, next = null;

  if (fesilNum > 1) {
    prev = { ehd: CURRENT.ehd, slug: kitab.slug, fesil: fesilNum - 1 };
  } else if (idx > 0) {
    const prevKitab = list[idx - 1];
    prev = { ehd: CURRENT.ehd, slug: prevKitab.slug, fesil: prevKitab.fesil_sayi };
  }

  if (fesilNum < kitab.fesil_sayi) {
    next = { ehd: CURRENT.ehd, slug: kitab.slug, fesil: fesilNum + 1 };
  } else if (idx < list.length - 1) {
    next = { ehd: CURRENT.ehd, slug: list[idx + 1].slug, fesil: 1 };
  }

  return { prev, next };
}

function jumpTo(ref) {
  ehdSelect.value = ref.ehd;
  populateKitabSelect();
  kitabSelect.value = ref.slug;
  populateFesilSelect();
  fesilSelect.value = String(ref.fesil);
  loadChapter(ref.ehd, ref.slug, ref.fesil);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderUnavailable(kitabAdi, fesil) {
  reader.innerHTML = `
    <div class="chapter-unavailable">
      <h2>${kitabAdi} ${fesil} hələ hazır deyil</h2>
      <p>Bu fəslin şərhləri hələ əlavə olunmayıb. Hazırda tam nümunə olaraq yalnız
      <button class="link-btn" onclick="document.getElementById('demo-btn').click()">Yaradılış 1</button>
      mövcuddur.</p>
    </div>
  `;
}

/* ---------------- Continue reading ---------------- */

function saveLastRead() {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify({
      ehd: CURRENT.ehd, slug: CURRENT.kitabSlug, kitabAdi: CURRENT.kitabAdi, fesil: CURRENT.fesil
    }));
  } catch (e) { /* yaddaş əlçatan deyil, sükutla keç */ }
}

function renderContinueCard() {
  let last = null;
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    last = raw ? JSON.parse(raw) : null;
  } catch (e) { last = null; }

  if (!last) { continueSlot.innerHTML = ''; return; }

  continueSlot.innerHTML = `
    <div class="continue-card">
      <div>
        <p class="continue-card-label">Davam edin</p>
        <p class="continue-card-ref">${escapeHtml(last.kitabAdi)} ${escapeHtml(String(last.fesil))}</p>
      </div>
      <button class="continue-card-btn" id="continue-btn">Oxumağa davam et</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => jumpTo({ ehd: last.ehd, slug: last.slug, fesil: last.fesil }));
}

/* ---------------- Verse modal ---------------- */

function openVerse(aye) {
  const v = CURRENT.data.ayeler.find(x => x.aye === aye);
  if (!v) return;

  activeVerseKey = noteKey(CURRENT.kitabSlug, CURRENT.fesil, aye);
  activeVerseRef = `${CURRENT.kitabAdi} ${CURRENT.fesil}:${aye}`;
  activeVerseText = v.metn_qisa;

  modalRef.textContent = activeVerseRef;
  modalVerseText.textContent = v.metn_qisa;
  resetCopyButton();

  if (v.serhler && v.serhler.length) {
    modalCommentary.innerHTML = v.serhler.map(s => `
      <div class="commentary-card">
        <p class="commentary-author">${escapeHtml(s.muellif)}</p>
        <p class="commentary-tradition">${escapeHtml(s['ənənə'])}</p>
        <p class="commentary-text">${escapeHtml(s.serh)}</p>
      </div>
    `).join('');
  } else {
    modalCommentary.innerHTML = `<p class="pending-note">${escapeHtml(v.qeyd || 'Bu ayə üçün şərh hələ əlavə olunmayıb.')}</p>`;
  }

  const existing = getNote(activeVerseKey);
  noteInput.value = existing ? existing.text : '';
  noteDeleteBtn.classList.toggle('hidden', !existing);
  noteStatus.textContent = '';

  modalBackdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
  document.body.style.overflow = '';
}

function copyActiveVerse() {
  const text = `${activeVerseRef} — ${activeVerseText}`;
  const done = () => {
    copyVerseBtn.classList.add('copied');
    copyVerseLabel.textContent = 'Kopyalandı ✓';
    setTimeout(resetCopyButton, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch (e) { /* kopyalama mümkün olmadı, sükutla keç */ }
}

function resetCopyButton() {
  copyVerseBtn.classList.remove('copied');
  copyVerseLabel.textContent = 'Ayəni kopyala';
}

/* ---------------- Notes (localStorage) ---------------- */

function noteKey(kitabSlug, fesil, aye) {
  return `${NOTE_PREFIX}${kitabSlug}:${fesil}:${aye}`;
}

function getNote(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveNote() {
  const text = noteInput.value.trim();
  if (!text) { noteStatus.textContent = 'Boş qeyd saxlanmır.'; return; }
  try {
    localStorage.setItem(activeVerseKey, JSON.stringify({
      ref: activeVerseRef,
      verseText: activeVerseText,
      text: text,
      savedAt: new Date().toISOString()
    }));
    noteStatus.textContent = 'Saxlanıldı ✓';
    noteDeleteBtn.classList.remove('hidden');
    markVerseHasNote(true);
    refreshChapterProgress();
  } catch (e) {
    noteStatus.textContent = 'Saxlamaq mümkün olmadı (brauzer yaddaşı bloklanıb ola bilər).';
  }
}

function deleteNote() {
  try { localStorage.removeItem(activeVerseKey); } catch (e) {}
  noteInput.value = '';
  noteDeleteBtn.classList.add('hidden');
  noteStatus.textContent = 'Silindi.';
  markVerseHasNote(false);
  refreshChapterProgress();
}

function markVerseHasNote(has) {
  const aye = activeVerseKey.split(':').pop();
  const el = reader.querySelector(`.v-tap[data-aye="${aye}"]`);
  if (el) el.classList.toggle('has-note', has);
}

function refreshChapterProgress() {
  if (!CURRENT.data) return;
  const total = CURRENT.data.ayeler.length;
  const notedCount = CURRENT.data.ayeler.filter(v => !!getNote(noteKey(CURRENT.kitabSlug, CURRENT.fesil, v.aye))).length;
  const el = reader.querySelector('.chapter-progress');
  if (notedCount === 0) { if (el) el.remove(); return; }
  const html = `<span class="dot"></span>${notedCount}/${total} ayədə qeydiniz var`;
  if (el) { el.innerHTML = html; }
  else {
    const main = reader.querySelector('.chapter-head-main');
    if (main) main.insertAdjacentHTML('beforeend', `<p class="chapter-progress">${html}</p>`);
  }
}

function getAllNotes() {
  let keys = [];
  try {
    keys = Object.keys(localStorage).filter(k => k.startsWith(NOTE_PREFIX));
  } catch (e) {
    return [];
  }
  return keys.map(k => {
    try { return { key: k, ...JSON.parse(localStorage.getItem(k)) }; }
    catch (e) { return null; }
  }).filter(Boolean).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

function renderNotesList() {
  let items;
  try {
    items = getAllNotes();
  } catch (e) {
    notesList.innerHTML = `<p class="notes-empty">Qeydlərə giriş mümkün olmadı.</p>`;
    notesStats.textContent = '';
    return;
  }

  notesStats.textContent = items.length ? `${items.length} qeyd saxlanılıb` : '';

  if (!items.length) {
    notesList.innerHTML = `<p class="notes-empty">Hələ heç bir qeyd saxlamamısınız. Bir ayəyə toxunub fikrinizi yazın.</p>`;
    return;
  }

  const q = notesSearch.value.trim().toLowerCase();
  const filtered = q
    ? items.filter(it => (it.ref || '').toLowerCase().includes(q) || (it.text || '').toLowerCase().includes(q))
    : items;

  if (!filtered.length) {
    notesList.innerHTML = `<p class="notes-empty">"${escapeHtml(notesSearch.value)}" üçün nəticə tapılmadı.</p>`;
    return;
  }

  const highlight = (str) => {
    if (!q) return escapeHtml(str);
    const esc = escapeHtml(str);
    const escQ = escapeHtml(q);
    const re = new RegExp(escQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    return esc.replace(re, (m) => `<mark>${m}</mark>`);
  };

  notesList.innerHTML = filtered.map(it => `
    <div class="note-item" data-key="${it.key}">
      <p class="note-item-ref">${highlight(it.ref || '')}</p>
      <p class="note-item-text">${highlight(it.text || '')}</p>
      ${it.savedAt ? `<p class="note-item-date">${formatDate(it.savedAt)}</p>` : ''}
    </div>
  `).join('');

  notesList.querySelectorAll('.note-item').forEach(el => {
    el.addEventListener('click', () => {
      const parts = el.dataset.key.split(':'); // incil-qeyd:kitab:fesil:aye
      const kitabSlug = parts[1], fesil = parts[2], aye = parts[3];
      const inNT = KITABLAR.ehdi_cedid.some(k => k.slug === kitabSlug);
      const ehd = inNT ? 'ehdi_cedid' : 'ehdi_etiq';
      switchView('reader');
      jumpTo({ ehd, slug: kitabSlug, fesil });
      // Fəsil yükləndikdən sonra ayəni aç
      const check = setInterval(() => {
        if (CURRENT.kitabSlug === kitabSlug && CURRENT.fesil === String(fesil)) {
          clearInterval(check);
          openVerse(parseInt(aye, 10));
        }
      }, 60);
      setTimeout(() => clearInterval(check), 4000);
    });
  });
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return ''; }
}

function exportNotes() {
  const items = getAllNotes();
  if (!items.length) { notesStats.textContent = 'Ehtiyat nüsxə üçün əvvəlcə qeyd saxlayın.'; return; }
  const payload = items.map(({ key, ...rest }) => ({ key, ...rest }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `incil-qeydlerim-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importNotes(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader2 = new FileReader();
  reader2.onload = () => {
    try {
      const items = JSON.parse(reader2.result);
      if (!Array.isArray(items)) throw new Error('yanlış format');
      let count = 0;
      items.forEach(it => {
        if (it.key && it.key.startsWith(NOTE_PREFIX)) {
          const { key, ...rest } = it;
          localStorage.setItem(key, JSON.stringify(rest));
          count++;
        }
      });
      notesStats.textContent = `${count} qeyd bərpa olundu`;
      renderNotesList();
    } catch (err) {
      notesStats.textContent = 'Fayl oxuna bilmədi — düzgün ehtiyat nüsxə faylı seçin.';
    }
  };
  reader2.readAsText(file);
  notesImportInput.value = '';
}

/* ---------------- Theme & font size ---------------- */

function initThemeAndFont() {
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const themeText = document.getElementById('theme-text');

  const applyThemeLabel = () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    themeText.textContent = isDark ? 'Açıq rejim' : 'Tünd rejim';
    themeBtn.setAttribute('aria-pressed', String(isDark));
  };
  applyThemeLabel();

  themeBtn.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyThemeLabel();
  });

  const MIN = 0.8, MAX = 1.4, STEP = 0.1;
  let scale = 1;
  try {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    if (!isNaN(saved) && saved >= MIN && saved <= MAX) scale = saved;
  } catch (e) {}

  const applyScale = () => {
    root.style.fontSize = (16 * scale) + 'px';
    try { localStorage.setItem(FONT_KEY, String(scale)); } catch (e) {}
  };
  applyScale();

  document.getElementById('font-plus').addEventListener('click', () => {
    scale = Math.min(MAX, +(scale + STEP).toFixed(2)); applyScale();
  });
  document.getElementById('font-minus').addEventListener('click', () => {
    scale = Math.max(MIN, +(scale - STEP).toFixed(2)); applyScale();
  });
  document.getElementById('font-reset').addEventListener('click', () => {
    scale = 1; applyScale();
  });
}

/* ---------------- Utils ---------------- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}
