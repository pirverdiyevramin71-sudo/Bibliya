// İncil Şərhləri — sayt məntiqi
// - Kitab/fəsil naviqasiyası
// - Ayəyə toxunanda modal: şərhlər + şəxsi qeyd (localStorage-da saxlanılır)
// - "Qeydlərim" görünüşü: bütün saxlanmış qeydlərin siyahısı

let KITABLAR = null;
let CURRENT = { kitabSlug: null, kitabAdi: null, fesil: null, data: null };

const ehdSelect = document.getElementById('ehd-select');
const kitabSelect = document.getElementById('kitab-select');
const fesilSelect = document.getElementById('fesil-select');
const getBtn = document.getElementById('get-btn');
const reader = document.getElementById('reader');
const notesView = document.getElementById('notes-view');
const notesList = document.getElementById('notes-list');
const demoBtn = document.getElementById('demo-btn');
const viewTabs = document.querySelectorAll('.view-tab');

const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalRef = document.getElementById('modal-ref');
const modalVerseText = document.getElementById('modal-verse-text');
const modalCommentary = document.getElementById('modal-commentary');
const noteInput = document.getElementById('note-input');
const noteSaveBtn = document.getElementById('note-save');
const noteDeleteBtn = document.getElementById('note-delete');
const noteStatus = document.getElementById('note-status');

let activeVerseKey = null; // "kitabSlug:fesil:aye"
let activeVerseRef = null;
let activeVerseText = null;

init();

async function init() {
  try {
    const res = await fetch('data/kitablar.json');
    KITABLAR = await res.json();
    populateKitabSelect();
    populateFesilSelect();
  } catch (err) {
    console.error('Kitab siyahısı yüklənmədi:', err);
  }

  ehdSelect.addEventListener('change', () => { populateKitabSelect(); populateFesilSelect(); });
  kitabSelect.addEventListener('change', populateFesilSelect);
  getBtn.addEventListener('click', loadChapter);
  demoBtn.addEventListener('click', () => {
    ehdSelect.value = 'ehdi_cedid';
    populateKitabSelect();
    kitabSelect.value = 'matta';
    populateFesilSelect();
    fesilSelect.value = '5';
    loadChapter();
  });

  viewTabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
  noteSaveBtn.addEventListener('click', saveNote);
  noteDeleteBtn.addEventListener('click', deleteNote);

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
    renderNotesList();
  }
}

/* ---------------- Chapter loading & rendering ---------------- */

async function loadChapter() {
  const list = KITABLAR[ehdSelect.value];
  const kitab = list.find(k => k.slug === kitabSelect.value) || list[0];
  const fesil = fesilSelect.value;

  reader.innerHTML = `<div class="empty-state"><p class="empty-mark">…</p><p>Yüklənir</p></div>`;

  try {
    const res = await fetch(`data/${kitab.slug}/${fesil}.json`);
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    CURRENT = { kitabSlug: kitab.slug, kitabAdi: kitab.ad, fesil: fesil, data };
    renderChapter();
  } catch (err) {
    renderUnavailable(kitab.ad, fesil);
  }
}

function renderChapter() {
  const { kitabAdi, data } = CURRENT;

  const flow = data.ayeler.map(v => {
    const key = noteKey(CURRENT.kitabSlug, data.fesil, v.aye);
    const hasNote = !!getNote(key);
    const cls = 'v-tap has-commentary' + (hasNote ? ' has-note' : '');
    return `<span class="${cls}" data-aye="${v.aye}" tabindex="0" role="button">` +
           `<sup class="v-num">${v.aye}</sup>${escapeHtml(v.metn_qisa)}</span> `;
  }).join('');

  reader.innerHTML = `
    <div class="chapter-head">
      <p class="chapter-eyebrow">Protestant şərh külliyyatı</p>
      <h2 class="chapter-title">${kitabAdi} ${data.fesil}</h2>
    </div>
    <p class="reading-flow">${flow}</p>
  `;

  reader.querySelectorAll('.v-tap').forEach(el => {
    el.addEventListener('click', () => openVerse(parseInt(el.dataset.aye, 10)));
    el.addEventListener('keypress', (e) => { if (e.key === 'Enter') openVerse(parseInt(el.dataset.aye, 10)); });
  });
}

function renderUnavailable(kitabAdi, fesil) {
  reader.innerHTML = `
    <div class="chapter-unavailable">
      <h2>${kitabAdi} ${fesil} hələ hazır deyil</h2>
      <p>Bu fəslin şərhləri hələ əlavə olunmayıb. Hazırda tam nümunə olaraq yalnız
      <button class="link-btn" onclick="document.getElementById('demo-btn').click()">Matta 5</button>
      mövcuddur.</p>
    </div>
  `;
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

/* ---------------- Notes (localStorage) ---------------- */

function noteKey(kitabSlug, fesil, aye) {
  return `incil-qeyd:${kitabSlug}:${fesil}:${aye}`;
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
}

function markVerseHasNote(has) {
  const aye = activeVerseKey.split(':').pop();
  const el = reader.querySelector(`.v-tap[data-aye="${aye}"]`);
  if (el) el.classList.toggle('has-note', has);
}

function renderNotesList() {
  let keys = [];
  try {
    keys = Object.keys(localStorage).filter(k => k.startsWith('incil-qeyd:'));
  } catch (e) {
    notesList.innerHTML = `<p class="notes-empty">Qeydlərə giriş mümkün olmadı.</p>`;
    return;
  }

  if (!keys.length) {
    notesList.innerHTML = `<p class="notes-empty">Hələ heç bir qeyd saxlamamısınız. Bir ayəyə toxunub fikrinizi yazın.</p>`;
    return;
  }

  const items = keys.map(k => {
    try { return { key: k, ...JSON.parse(localStorage.getItem(k)) }; }
    catch (e) { return null; }
  }).filter(Boolean).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  notesList.innerHTML = items.map(it => `
    <div class="note-item" data-key="${it.key}">
      <p class="note-item-ref">${escapeHtml(it.ref)}</p>
      <p class="note-item-text">${escapeHtml(it.text)}</p>
    </div>
  `).join('');

  notesList.querySelectorAll('.note-item').forEach(el => {
    el.addEventListener('click', () => {
      const parts = el.dataset.key.split(':'); // incil-qeyd:kitab:fesil:aye
      const kitabSlug = parts[1], fesil = parts[2], aye = parts[3];
      // Naviqasiyanı həmin kitab/fəsilə köçür və oxu görünüşünə keç
      const inNT = KITABLAR.ehdi_cedid.some(k => k.slug === kitabSlug);
      ehdSelect.value = inNT ? 'ehdi_cedid' : 'ehdi_etiq';
      populateKitabSelect();
      kitabSelect.value = kitabSlug;
      populateFesilSelect();
      fesilSelect.value = fesil;
      switchView('reader');
      loadChapter().then(() => openVerse(parseInt(aye, 10)));
    });
  });
}

/* ---------------- Theme & font size ---------------- */

function initThemeAndFont() {
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');

  themeBtn.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeIcon.textContent = isDark ? '🌙' : '☀️';
    themeText.textContent = isDark ? 'Tünd rejim' : 'Açıq rejim';
  });

  let scale = 1;
  const MIN = 0.8, MAX = 1.4, STEP = 0.1;
  const applyScale = () => { root.style.fontSize = (16 * scale) + 'px'; };

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
