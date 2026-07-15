// İncil Şərhləri — sayt məntiqi
// - Kitab/Fəsil seçici modalı (YouVersion-vari: əvvəl kitab, sonra fəsil grid-i)
// - Üzən əvvəlki/növbəti fəsil düymələri (sənədin əsas scroll-unu pozmadan, fixed mövqedə)
// - Ayəyə toxunanda modal: şərhlər + şəxsi qeyd (localStorage-da saxlanılır)
// - Açar söz axtarışı: mövcud olan bütün fəsillər üzrə axtarır (irəlicə yüklənmiş fəsillər keşlənir)
// - 3 tema: Ağ / Tünd / Krem, oxu şrifti ölçüsü ayrıca dəyişkəndə saxlanılır (UI-ni pozmur)

const NOTE_PREFIX = 'incil-qeyd:';
const THEME_KEY = 'incil-tema';
const FONT_KEY = 'incil-oxu-olcusu';
const LAST_READ_KEY = 'incil-son-oxunan';

let KITABLAR = null;
let BOOK_LIST = [];           // [{ad, slug, fesil_sayi, ehd}, ...] — Əhdi-Ətiq + Əhdi-Cədid ardıcıl
let CURRENT = { ehd: null, kitabSlug: null, kitabAdi: null, fesil: null, data: null };
let bookOrderMode = 'geleneksel';
let pickerStep = 'books';
let pickerActiveBook = null;

const reader = document.getElementById('reader');
const emptyState = document.getElementById('empty-state');
const notesView = document.getElementById('notes-view');
const notesList = document.getElementById('notes-list');
const notesStats = document.getElementById('notes-stats');
const notesSearch = document.getElementById('notes-search');
const notesExportBtn = document.getElementById('notes-export');
const notesImportInput = document.getElementById('notes-import');
const demoBtn = document.getElementById('demo-btn');
const viewTabs = document.querySelectorAll('.view-tab');
const continueSlot = document.getElementById('continue-slot');

const pickerPillText = document.getElementById('picker-pill-text');
const pickerOpenBtn = document.getElementById('picker-open-btn');
const pickerBackdrop = document.getElementById('picker-backdrop');
const pickerCloseBtn = document.getElementById('picker-close-btn');
const pickerBackBtn = document.getElementById('picker-back-btn');
const pickerTitle = document.getElementById('picker-modal-title');
const pickerBody = document.getElementById('picker-modal-body');
const orderToggle = document.getElementById('book-order-toggle');

const searchOpenBtn = document.getElementById('search-open-btn');
const searchBackdrop = document.getElementById('search-backdrop');
const searchCloseBtn = document.getElementById('search-close-btn');
const globalSearchInput = document.getElementById('global-search-input');
const globalSearchStatus = document.getElementById('global-search-status');
const globalSearchResults = document.getElementById('global-search-results');

const prevChapterBtn = document.getElementById('prev-chapter-btn');
const nextChapterBtn = document.getElementById('next-chapter-btn');

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

const appearanceBtn = document.getElementById('appearance-btn');
const appearanceMenu = document.getElementById('appearance-menu');

let activeVerseKey = null;
let activeVerseRef = null;
let activeVerseText = null;

init();

async function init() {
  try {
    const res = await fetch('data/kitablar.json');
    KITABLAR = await res.json();
    buildBookList();
    renderContinueCard();
  } catch (err) {
    console.error('Kitab siyahısı yüklənmədi:', err);
    emptyState.innerHTML = `<h2>Kitab siyahısı yüklənmədi</h2><p>"data/kitablar.json" tapılmadı. GitHub Pages üzərindən açdığınızdan əmin olun.</p>`;
  }

  demoBtn.addEventListener('click', () => jumpTo({ ehd: 'ehdi_etiq', slug: 'yaradilish', fesil: 1 }));
  viewTabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));

  // Ayə modalı
  modalClose.addEventListener('click', closeVerseModal);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeVerseModal(); });
  noteSaveBtn.addEventListener('click', saveNote);
  noteDeleteBtn.addEventListener('click', deleteNote);
  copyVerseBtn.addEventListener('click', copyActiveVerse);

  // Kitab/Fəsil seçici
  pickerOpenBtn.addEventListener('click', openPicker);
  pickerCloseBtn.addEventListener('click', closePicker);
  pickerBackdrop.addEventListener('click', (e) => { if (e.target === pickerBackdrop) closePicker(); });
  pickerBackBtn.addEventListener('click', () => { pickerStep = 'books'; renderPickerStep(); });
  orderToggle.querySelectorAll('.order-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      bookOrderMode = btn.dataset.order;
      orderToggle.querySelectorAll('.order-opt').forEach(b => b.classList.toggle('active', b === btn));
      renderPickerStep();
    });
  });

  // Açar söz axtarışı
  searchOpenBtn.addEventListener('click', openSearch);
  searchCloseBtn.addEventListener('click', closeSearch);
  searchBackdrop.addEventListener('click', (e) => { if (e.target === searchBackdrop) closeSearch(); });
  let searchTimer = null;
  globalSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runGlobalSearch(globalSearchInput.value), 350);
  });

  // Üzən fəsil naviqasiyası
  prevChapterBtn.addEventListener('click', () => { const n = getAdjacentChapters().prev; if (n) jumpTo(n); });
  nextChapterBtn.addEventListener('click', () => { const n = getAdjacentChapters().next; if (n) jumpTo(n); });

  // Görünüş menyusu
  appearanceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = appearanceMenu.classList.contains('hidden');
    appearanceMenu.classList.toggle('hidden');
    appearanceBtn.setAttribute('aria-expanded', String(willOpen));
  });
  document.addEventListener('click', (e) => {
    if (!appearanceMenu.classList.contains('hidden') && !appearanceMenu.contains(e.target) && e.target !== appearanceBtn) {
      appearanceMenu.classList.add('hidden');
      appearanceBtn.setAttribute('aria-expanded', 'false');
    }
  });
  appearanceMenu.querySelectorAll('.appearance-opt').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.choice));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modalBackdrop.classList.contains('hidden')) closeVerseModal();
    else if (!pickerBackdrop.classList.contains('hidden')) closePicker();
    else if (!searchBackdrop.classList.contains('hidden')) closeSearch();
    else if (!appearanceMenu.classList.contains('hidden')) { appearanceMenu.classList.add('hidden'); appearanceBtn.setAttribute('aria-expanded', 'false'); }
  });

  notesSearch.addEventListener('input', () => renderNotesList());
  notesExportBtn.addEventListener('click', exportNotes);
  notesImportInput.addEventListener('change', importNotes);

  initThemeAndFont();
}

/* ---------------- Book list / navigation model ---------------- */

function buildBookList() {
  BOOK_LIST = [
    ...KITABLAR.ehdi_etiq.map(k => ({ ...k, ehd: 'ehdi_etiq' })),
    ...KITABLAR.ehdi_cedid.map(k => ({ ...k, ehd: 'ehdi_cedid' }))
  ];
}

function findBook(slug) {
  return BOOK_LIST.find(b => b.slug === slug);
}

function switchView(view) {
  viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'reader') {
    reader.classList.remove('hidden');
    notesView.classList.add('hidden');
    updateFloatNavVisibility();
  } else {
    reader.classList.add('hidden');
    notesView.classList.remove('hidden');
    prevChapterBtn.classList.add('hidden');
    nextChapterBtn.classList.add('hidden');
    notesSearch.value = '';
    renderNotesList();
  }
}

/* ---------------- Chapter loading & rendering ---------------- */

async function loadChapter(ehd, slug, fesil) {
  const book = findBook(slug);
  if (!book) return false;

  reader.innerHTML = `
    <div class="skeleton-lines">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>`;

  try {
    const data = await getChapterCached(slug, fesil);
    if (!data) throw new Error('tapılmadı');
    CURRENT = { ehd, kitabSlug: slug, kitabAdi: book.ad, fesil: String(fesil), data };
    renderChapter();
    saveLastRead();
    pickerPillText.textContent = `${book.ad} ${fesil}`;
    updateFloatNavVisibility();
    return true;
  } catch (err) {
    renderUnavailable(book.ad, fesil, slug);
    updateFloatNavVisibility();
    return false;
  }
}

async function jumpTo(ref) {
  switchView('reader');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return loadChapter(ref.ehd, ref.slug, ref.fesil);
}

function renderChapter() {
  const { kitabAdi, data } = CURRENT;
  const total = data.ayeler.length;
  const notedCount = data.ayeler.filter(v => !!getNote(noteKey(CURRENT.kitabSlug, data.fesil, v.aye))).length;

  const flow = data.ayeler.map(v => {
    const key = noteKey(CURRENT.kitabSlug, data.fesil, v.aye);
    const hasNote = !!getNote(key);
    return `<span class="v-tap" data-aye="${v.aye}" tabindex="0" role="button">` +
           `<sup class="v-num">${v.aye}</sup>${escapeHtml(v.metn_qisa)}` +
           `<span class="v-icon${hasNote ? ' has-note' : ''}" aria-hidden="true">${verseIconSVG()}</span></span> `;
  }).join('');

  reader.innerHTML = `
    <div class="chapter-head">
      <p class="chapter-eyebrow">Protestant şərh külliyyatı</p>
      <h2 class="chapter-title">${escapeHtml(kitabAdi)} ${data.fesil}</h2>
      ${notedCount ? `<p class="chapter-progress"><span class="dot"></span>${notedCount}/${total} ayədə qeydiniz var</p>` : ''}
    </div>
    <div class="reading-flow"><p>${flow}</p></div>
  `;

  reader.querySelectorAll('.v-tap').forEach(el => {
    el.addEventListener('click', () => openVerse(parseInt(el.dataset.aye, 10)));
    el.addEventListener('keypress', (e) => { if (e.key === 'Enter') openVerse(parseInt(el.dataset.aye, 10)); });
  });
}

function verseIconSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2Z"/></svg>`;
}

function getAdjacentChapters() {
  if (!CURRENT.kitabSlug) return { prev: null, next: null };
  const idx = BOOK_LIST.findIndex(b => b.slug === CURRENT.kitabSlug);
  const fesilNum = parseInt(CURRENT.fesil, 10);
  const book = BOOK_LIST[idx];
  let prev = null, next = null;

  if (fesilNum > 1) {
    prev = { ehd: CURRENT.ehd, slug: book.slug, fesil: fesilNum - 1 };
  } else if (idx > 0) {
    const prevBook = BOOK_LIST[idx - 1];
    prev = { ehd: prevBook.ehd, slug: prevBook.slug, fesil: prevBook.fesil_sayi };
  }

  if (fesilNum < book.fesil_sayi) {
    next = { ehd: CURRENT.ehd, slug: book.slug, fesil: fesilNum + 1 };
  } else if (idx < BOOK_LIST.length - 1) {
    const nextBook = BOOK_LIST[idx + 1];
    next = { ehd: nextBook.ehd, slug: nextBook.slug, fesil: 1 };
  }

  return { prev, next };
}

function updateFloatNavVisibility() {
  const inReader = !reader.classList.contains('hidden');
  const hasChapter = !!CURRENT.kitabSlug;
  if (!inReader || !hasChapter) {
    prevChapterBtn.classList.add('hidden');
    nextChapterBtn.classList.add('hidden');
    return;
  }
  const nav = getAdjacentChapters();
  prevChapterBtn.classList.remove('hidden');
  nextChapterBtn.classList.remove('hidden');
  prevChapterBtn.disabled = !nav.prev;
  nextChapterBtn.disabled = !nav.next;
}

function renderUnavailable(kitabAdi, fesil, slug) {
  reader.innerHTML = `
    <div class="chapter-unavailable">
      <h2>${escapeHtml(kitabAdi)} ${fesil} hələ hazır deyil</h2>
      <p>Bu fəslin şərhləri hələ əlavə olunmayıb.</p>
      <p class="tech-hint">Axtarılan fayl: <code>data/${escapeHtml(slug)}/${fesil}.json</code> — GitHub-da bu faylın düz adla mövcud olduğunu yoxlayın.</p>
    </div>
  `;
}

/* ---------------- Kitab / Fəsil seçici modalı ---------------- */

function openPicker() {
  pickerStep = 'books';
  pickerActiveBook = CURRENT.kitabSlug ? findBook(CURRENT.kitabSlug) : null;
  renderPickerStep();
  pickerBackdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePicker() {
  pickerBackdrop.classList.add('hidden');
  document.body.style.overflow = '';
}

function sortedBookList() {
  if (bookOrderMode === 'alfabetik') {
    return [...BOOK_LIST].sort((a, b) => a.ad.localeCompare(b.ad, 'az'));
  }
  return BOOK_LIST;
}

function renderPickerStep() {
  if (pickerStep === 'books') {
    pickerBackBtn.classList.add('hidden');
    pickerTitle.textContent = 'Kitablar';
    orderToggle.classList.remove('hidden');

    const list = sortedBookList();
    let html = '';
    let lastEhd = null;
    list.forEach(b => {
      if (bookOrderMode === 'geleneksel' && b.ehd !== lastEhd) {
        html += `<p class="picker-section-label">${b.ehd === 'ehdi_etiq' ? 'Əhdi-Ətiq' : 'Əhdi-Cədid'}</p>`;
        lastEhd = b.ehd;
      }
      const active = CURRENT.kitabSlug === b.slug ? ' active' : '';
      html += `<button class="picker-book-row${active}" data-slug="${b.slug}">${escapeHtml(b.ad)}</button>`;
    });
    pickerBody.innerHTML = html;

    pickerBody.querySelectorAll('.picker-book-row').forEach(btn => {
      btn.addEventListener('click', () => {
        pickerActiveBook = findBook(btn.dataset.slug);
        pickerStep = 'chapters';
        renderPickerStep();
      });
    });
  } else {
    pickerBackBtn.classList.remove('hidden');
    pickerTitle.textContent = pickerActiveBook.ad;
    orderToggle.classList.add('hidden');

    const cells = [];
    for (let i = 1; i <= pickerActiveBook.fesil_sayi; i++) {
      const active = CURRENT.kitabSlug === pickerActiveBook.slug && String(CURRENT.fesil) === String(i);
      cells.push(`<button class="picker-chapter-cell${active ? ' active' : ''}" data-fesil="${i}">${i}</button>`);
    }
    pickerBody.innerHTML = `<div class="picker-chapter-grid">${cells.join('')}</div>`;

    pickerBody.querySelectorAll('.picker-chapter-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        closePicker();
        jumpTo({ ehd: pickerActiveBook.ehd, slug: pickerActiveBook.slug, fesil: parseInt(btn.dataset.fesil, 10) });
      });
    });
  }
}

/* ---------------- Açar söz axtarışı ---------------- */

const chapterCache = new Map(); // "slug:fesil" -> data | null
let searchAbort = false;

async function getChapterCached(slug, fesil) {
  const key = `${slug}:${fesil}`;
  if (chapterCache.has(key)) return chapterCache.get(key);
  try {
    const res = await fetch(`data/${slug}/${fesil}.json`);
    if (!res.ok) { chapterCache.set(key, null); return null; }
    const data = await res.json();
    chapterCache.set(key, data);
    return data;
  } catch (e) {
    chapterCache.set(key, null);
    return null;
  }
}

function openSearch() {
  searchBackdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  globalSearchInput.value = '';
  globalSearchStatus.textContent = 'Axtarmaq üçün açar söz yazın.';
  globalSearchResults.innerHTML = '';
  setTimeout(() => globalSearchInput.focus(), 50);
}

function closeSearch() {
  searchAbort = true;
  searchBackdrop.classList.add('hidden');
  document.body.style.overflow = '';
}

async function runGlobalSearch(rawQuery) {
  searchAbort = false;
  const myRun = Symbol();
  runGlobalSearch._token = myRun;
  const q = rawQuery.trim().toLowerCase();

  if (!q) {
    globalSearchResults.innerHTML = '';
    globalSearchStatus.textContent = 'Axtarmaq üçün açar söz yazın.';
    return;
  }
  if (q.length < 2) {
    globalSearchResults.innerHTML = '';
    globalSearchStatus.textContent = 'Ən azı 2 hərf yazın.';
    return;
  }

  const tasks = [];
  BOOK_LIST.forEach(b => {
    for (let f = 1; f <= b.fesil_sayi; f++) tasks.push({ b, f });
  });
  const total = tasks.length;
  let checked = 0;
  const matches = [];
  globalSearchResults.innerHTML = '';
  globalSearchStatus.innerHTML = `Axtarılır… (0/${total}) <button class="search-cancel-link" id="search-cancel-link">Dayandır</button>`;
  document.getElementById('search-cancel-link').addEventListener('click', () => { searchAbort = true; });

  const CONCURRENCY = 16;
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      if (searchAbort || runGlobalSearch._token !== myRun) return;
      const t = tasks[idx++];
      const data = await getChapterCached(t.b.slug, t.f);
      checked++;
      if (data) {
        data.ayeler.forEach(v => {
          if (v.metn_qisa.toLowerCase().includes(q)) {
            matches.push({ kitabAdi: t.b.ad, ehd: t.b.ehd, slug: t.b.slug, fesil: t.f, aye: v.aye, text: v.metn_qisa });
          }
        });
        if (runGlobalSearch._token === myRun) renderSearchResults(matches, q);
      }
      if (runGlobalSearch._token === myRun && (checked % 8 === 0 || checked === total)) {
        globalSearchStatus.innerHTML = `Axtarılır… (${checked}/${total}) <button class="search-cancel-link" id="search-cancel-link">Dayandır</button>`;
        const link = document.getElementById('search-cancel-link');
        if (link) link.addEventListener('click', () => { searchAbort = true; });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (runGlobalSearch._token !== myRun) return;
  if (searchAbort) {
    globalSearchStatus.textContent = `Dayandırıldı — indiyədək ${matches.length} nəticə tapıldı.`;
  } else {
    globalSearchStatus.textContent = matches.length
      ? `${matches.length} nəticə tapıldı`
      : 'Heç bir nəticə tapılmadı (yalnız hazırda əlavə olunmuş fəsillər axtarılır).';
  }
}

function renderSearchResults(matches, q) {
  if (!matches.length) { globalSearchResults.innerHTML = ''; return; }
  globalSearchResults.innerHTML = matches.slice(0, 150).map((m, i) => `
    <div class="note-item search-result" data-i="${i}">
      <p class="note-item-ref">${escapeHtml(m.kitabAdi)} ${m.fesil}:${m.aye}</p>
      <p class="note-item-text">${highlight(m.text, q)}</p>
    </div>
  `).join('');
  globalSearchResults.querySelectorAll('.search-result').forEach((el, i) => {
    el.addEventListener('click', async () => {
      const m = matches[i];
      closeSearch();
      await jumpTo({ ehd: m.ehd, slug: m.slug, fesil: m.fesil });
      openVerse(m.aye);
    });
  });
}

function highlight(str, q) {
  const esc = escapeHtml(str);
  if (!q) return esc;
  const escQ = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escQ, 'ig');
  return esc.replace(re, (m) => `<mark>${m}</mark>`);
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

  if (!last || !findBook(last.slug)) { continueSlot.innerHTML = ''; return; }

  continueSlot.innerHTML = `
    <div class="continue-card">
      <div>
        <p class="continue-card-label">Davam edin</p>
        <p class="continue-card-ref">${escapeHtml(last.kitabAdi)} ${escapeHtml(String(last.fesil))}</p>
      </div>
      <button class="continue-card-btn" id="continue-btn">Oxumağa davam et</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => {
    jumpTo({ ehd: last.ehd, slug: last.slug, fesil: last.fesil });
  });
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

function closeVerseModal() {
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
  } catch (e) { /* kopyalama mümkün olmadı */ }
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
  const el = reader.querySelector(`.v-tap[data-aye="${aye}"] .v-icon`);
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
    const head = reader.querySelector('.chapter-head');
    if (head) head.insertAdjacentHTML('beforeend', `<p class="chapter-progress">${html}</p>`);
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

  notesList.innerHTML = filtered.map(it => `
    <div class="note-item" data-key="${it.key}">
      <p class="note-item-ref">${highlight(it.ref || '', q)}</p>
      <p class="note-item-text">${highlight(it.text || '', q)}</p>
      ${it.savedAt ? `<p class="note-item-date">${formatDate(it.savedAt)}</p>` : ''}
    </div>
  `).join('');

  notesList.querySelectorAll('.note-item').forEach(el => {
    el.addEventListener('click', async () => {
      const parts = el.dataset.key.split(':'); // incil-qeyd:kitab:fesil:aye
      const kitabSlug = parts[1], fesil = parts[2], aye = parts[3];
      const book = findBook(kitabSlug);
      if (!book) return;
      await jumpTo({ ehd: book.ehd, slug: kitabSlug, fesil });
      openVerse(parseInt(aye, 10));
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
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
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
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const items = JSON.parse(fr.result);
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
  fr.readAsText(file);
  notesImportInput.value = '';
}

/* ---------------- Tema (3 rejim) & oxu şrifti ölçüsü ---------------- */

function setTheme(choice) {
  document.documentElement.setAttribute('data-theme', choice);
  try { localStorage.setItem(THEME_KEY, choice); } catch (e) {}
  appearanceMenu.querySelectorAll('.appearance-opt').forEach(b => b.classList.toggle('active', b.dataset.choice === choice));
  appearanceMenu.classList.add('hidden');
  appearanceBtn.setAttribute('aria-expanded', 'false');
}

function initThemeAndFont() {
  const current = document.documentElement.getAttribute('data-theme') || 'ag';
  appearanceMenu.querySelectorAll('.appearance-opt').forEach(b => b.classList.toggle('active', b.dataset.choice === current));

  const MIN = 0.8, MAX = 1.5, STEP = 0.1;
  let scale = 1;
  try {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    if (!isNaN(saved) && saved >= MIN && saved <= MAX) scale = saved;
  } catch (e) {}

  const applyScale = () => {
    document.documentElement.style.setProperty('--reading-scale', String(scale));
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
