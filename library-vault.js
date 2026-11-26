// ==================== 藏往 V7：藏书阁、苹果笔记、侧栏档案库、大扩容断法宝典与中文观星任意门 ====================
const COVER_PALETTES = [
  'linear-gradient(155deg, #2D2D32, #18181B)',
  'linear-gradient(155deg, #2B4C47, #172C29)',
  'linear-gradient(155deg, #7B2E24, #471813)',
  'linear-gradient(155deg, #273D57, #152333)',
  'linear-gradient(155deg, #564738, #30271F)',
  'linear-gradient(155deg, #433952, #251F30)'
];

// ==================== 1. 书架管理 ====================
function renderShelfPanel(wrap) {
  let catBooks = state.books.filter(b => b.category === state.category);
  if (state.shelfSort === 'recent') catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || (b.lastReadAt||0)-(a.lastReadAt||0) || b.createdAt-a.createdAt);
  else if (state.shelfSort === 'newest') catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || b.createdAt-a.createdAt);
  else if (state.shelfSort === 'name') catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || a.title.localeCompare(b.title,'zh'));
  else catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || (a.order??999)-(b.order??999));

  const toolbar = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:6px;">
      <div style="display:flex;gap:6px;">
        <button class="chip ${state.shelfView==='grid'?'accent':''}" onclick="state.shelfView='grid';renderDivineView()">九宫格</button>
        <button class="chip ${state.shelfView==='list'?'accent':''}" onclick="state.shelfView='list';renderDivineView()">列表</button>
        <select class="chip" style="border:none;" onchange="state.shelfSort=this.value;renderDivineView()">
          <option value="recent" ${state.shelfSort==='recent'?'selected':''}>最近阅读</option>
          <option value="newest" ${state.shelfSort==='newest'?'selected':''}>最新导入</option>
          <option value="name" ${state.shelfSort==='name'?'selected':''}>书名排序</option>
          <option value="custom" ${state.shelfSort==='custom'?'selected':''}>自定义序</option>
        </select>
      </div>
      <button class="chip accent" onclick="openSheet('sheet-import')">+ 导书</button>
    </div>
  `;

  if (!catBooks.length) {
    wrap.innerHTML = toolbar + `<div class="empty-box">
      <p>「${state.category}」藏书阁目前为空<br/>支持导入 PDF 原版古籍（1:1 保留原书排版）或 TXT 文本<br/>传完即可在排盘结果页选书断卦与多书 PK</p>
      <button class="btn-primary" onclick="openSheet('sheet-import')">导入第一本典籍</button>
    </div>`;
    return;
  }

  const lastReadId = catBooks.find(b => b.lastReadAt)?.id;
  if (state.shelfView === 'grid') {
    wrap.innerHTML = toolbar + `<div class="books-grid">${catBooks.map((b, i) => {
      const bg = COVER_PALETTES[(b.coverIdx ?? i) % COVER_PALETTES.length];
      const total = Math.max(1, b.totalPages || state.chapters.filter(c => c.bookId === b.id).length);
      const cur = b.hasPdf ? (b.lastPageNum || 1) : ((b.lastChapIdx || 0) + 1);
      const prog = Math.min(100, Math.round(cur / total * 100));
      return `<div class="book-item" onclick="openReader('${b.id}')">
        <div class="book-cover" style="background:${bg};">
          ${b.pinned ? '<span class="reading-badge" style="left:6px;right:auto;background:rgba(0,0,0,0.55);">顶</span>' : ''}
          ${b.id === lastReadId ? '<span class="reading-badge">在读</span>' : ''}
          <div class="book-cover-title">${escapeHtml(b.title)}</div>
          <div class="book-cover-foot"><span>${b.hasPdf ? 'PDF' : '文本'}</span><span>${b.aiProfile ? '已索引' : total + '页'}</span></div>
        </div>
        <div class="book-meta">
          <div style="min-width:0;flex:1;"><div class="book-name">${escapeHtml(b.title)}</div><div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">已读 ${prog}%</div></div>
          <button style="padding:2px 6px;color:var(--text-3);font-size:16px;" onclick="event.stopPropagation();openBookEditSheet('${b.id}')">⋮</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  } else {
    wrap.innerHTML = toolbar + catBooks.map((b, i) => {
      const bg = COVER_PALETTES[(b.coverIdx ?? i) % COVER_PALETTES.length];
      const total = Math.max(1, b.totalPages || state.chapters.filter(c => c.bookId === b.id).length);
      const cur = b.hasPdf ? (b.lastPageNum || 1) : ((b.lastChapIdx || 0) + 1);
      return `<div class="book-list-row" onclick="openReader('${b.id}')">
        <div class="book-mini-cover" style="background:${bg};">${escapeHtml(b.title.slice(0,4))}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.pinned?'📌 ':''}${escapeHtml(b.title)}</div>
          <div style="font-size:12.5px;color:var(--text-3);margin-top:3px;">${b.hasPdf ? '1:1 原版 PDF' : '文本书'} · 第 ${cur}/${total} 页 ${b.aiProfile ? '· ✓ 已建索引' : ''}</div>
        </div>
        <button class="pill-mini" onclick="event.stopPropagation();openBookEditSheet('${b.id}')">管理</button>
      </div>`;
    }).join('');
  }
}

function openBookEditSheet(bookId) {
  const b = state.books.find(x => x.id === bookId); if (!b) return;
  document.getElementById('bookEditPanel').innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 12px;font-size:17px;">管理典籍</h3>
    <div class="form-field"><label class="form-label">书名</label><input type="text" id="editBookName" class="form-input" value="${escapeHtml(b.title)}" /></div>
    <div class="form-field"><label class="form-label">所属门类</label><select id="editBookCat" class="form-select">${CATEGORIES.map(c => `<option ${b.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-field"><label class="form-label">封面配色</label><div style="display:flex;gap:10px;">${COVER_PALETTES.map((bg, idx) => `<button style="width:32px;height:32px;border-radius:8px;background:${bg};border:${(b.coverIdx||0)===idx?'2px solid var(--accent)':'none'};" onclick="setBookCoverColor('${b.id}',${idx})"></button>`).join('')}</div></div>
    <div class="form-field"><label class="form-label">AI 流派身份证</label><div style="font-size:13px;color:var(--text-2);background:var(--bg);padding:9px 11px;border-radius:11px;margin-bottom:8px;">${escapeHtml(b.aiProfile || '尚未建立，点下方静默分析目录与序言。')}</div><button class="btn-secondary" style="width:100%;" onclick="buildBookAiProfile('${b.id}')">建立本书 AI 断法索引与流派画像</button></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
      <button class="btn-secondary" onclick="toggleBookPin('${b.id}')">${b.pinned?'取消置顶':'置顶'}</button>
      <button class="btn-secondary" onclick="moveBookOrder('${b.id}', -1)">上移</button>
      <button class="btn-secondary" onclick="moveBookOrder('${b.id}', 1)">下移</button>
    </div>
    <div style="display:flex;gap:8px;"><button class="btn-primary" style="flex:1;" onclick="saveBookEdit('${b.id}')">保存</button><button class="btn-secondary" style="color:var(--danger);" onclick="deleteBookConfirm('${b.id}')">删除</button></div>
  `;
  openSheet('sheet-book-edit');
}
async function saveBookEdit(id) { const b = state.books.find(x => x.id === id); if (!b) return; b.title = document.getElementById('editBookName').value.trim() || b.title; b.category = document.getElementById('editBookCat').value; await dbPut('books', b); await markDirty(); closeSheet('sheet-book-edit'); renderDivineView(); showToast('已更新'); }
async function setBookCoverColor(id, idx) { const b = state.books.find(x => x.id === id); if (!b) return; b.coverIdx = idx; await dbPut('books', b); openBookEditSheet(id); renderDivineView(); }
async function toggleBookPin(id) { const b = state.books.find(x => x.id === id); if (!b) return; b.pinned = !b.pinned; await dbPut('books', b); closeSheet('sheet-book-edit'); renderDivineView(); }
async function moveBookOrder(id, delta) {
  state.shelfSort = 'custom';
  const list = state.books.filter(x => x.category === state.category).sort((a,b) => (a.order??999)-(b.order??999));
  list.forEach((x, i) => x.order = i);
  const idx = list.findIndex(x => x.id === id), target = idx + delta;
  if (target < 0 || target >= list.length) return showToast('已到边界');
  const tmp = list[idx].order; list[idx].order = list[target].order; list[target].order = tmp;
  await dbPut('books', list[idx]); await dbPut('books', list[target]); renderDivineView(); showToast('顺序已调整');
}
async function deleteBookConfirm(id) {
  const b = state.books.find(x => x.id === id); if (!b || !confirm(`确定删除《${b.title}》？`)) return;
  await dbDel('books', id); await dbDel('pdfBlobs', id);
  for (const c of state.chapters.filter(c => c.bookId === id)) await dbDel('chapters', c.id);
  state.books = state.books.filter(x => x.id !== id); state.chapters = state.chapters.filter(c => c.bookId !== id);
  await markDirty(); closeSheet('sheet-book-edit'); renderDivineView(); showToast('已删除');
}

// ==================== 2. PDF / 文本导入与双引擎阅读器 ====================
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(); };
    s.onerror = rej; document.head.appendChild(s);
  });
}
function extractStructuredLines(tc) {
  const items = tc.items.filter(it => it.str && it.str.trim() !== ''); if (!items.length) return '';
  const lines = [];
  items.forEach(it => {
    const y = Math.round(it.transform[5] / 4) * 4, x = it.transform[4];
    let row = lines.find(l => Math.abs(l.y - y) <= 4);
    if (!row) { row = { y, parts: [] }; lines.push(row); }
    row.parts.push({ x, str: it.str });
  });
  lines.sort((a, b) => b.y - a.y);
  let out = '', prevY = null;
  lines.forEach(l => {
    l.parts.sort((a, b) => a.x - b.x);
    let s = '';
    l.parts.forEach((p, idx) => { if (idx > 0 && p.x - l.parts[idx-1].x > 26) s += '　'; s += p.str; });
    if (prevY !== null && (prevY - l.y) > 22) out += '\n';
    out += s.trim() + '\n'; prevY = l.y;
  });
  return out.trim();
}
async function handleBookFileSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const title = file.name.replace(/\.(pdf|txt|md)$/i, '');
  if (/\.pdf$/i.test(file.name)) {
    showToast('正在导入 1:1 原版 PDF 并解析目录...');
    try {
      await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const bookId = uid('bk');
      await dbPut('pdfBlobs', { id: bookId, data: buf });
      let toc = [];
      try {
        const outline = await pdf.getOutline();
        if (outline?.length) {
          for (const item of outline.slice(0, 80)) {
            let pIdx = 0;
            try { const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest; if (dest?.[0]) pIdx = await pdf.getPageIndex(dest[0]); } catch (er) {}
            toc.push({ title: item.title, pageNum: pIdx + 1 });
          }
        }
      } catch (er) {}
      const book = { id: bookId, title, category: state.category, hasPdf: true, totalPages: pdf.numPages, lastPageNum: 1, toc, aiProfile: '', coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0, order: state.books.length };
      await dbPut('books', book); state.books.push(book);
      for (let p = 1; p <= Math.min(pdf.numPages, 600); p++) {
        const page = await pdf.getPage(p);
        const ch = { id: uid('ch'), bookId, idx: p - 1, pageNum: p, title: `第 ${p} 页`, content: extractStructuredLines(await page.getTextContent()), modernText: '' };
        await dbPut('chapters', ch); state.chapters.push(ch);
      }
      await markDirty(); closeSheet('sheet-import'); renderDivineView();
      showToast(`《${title}》已导入（${pdf.numPages} 页）`);
    } catch (err) { showToast('PDF 导入失败：' + err.message); }
  } else await importPlainTextBook(title, await file.text());
  e.target.value = '';
}
async function importPlainTextBook(title, rawText) {
  const clean = rawText.replace(/\r\n/g, '\n').trim();
  const re = /(?:^|\n)\s*((?:第[零一二三四五六七八九十百千0-9]+[章节卷篇回]|卷[零一二三四五六七八九十0-9]+)\s+[^\n]{1,34})(?=\n)/g;
  const hits = []; let m; while ((m = re.exec(clean)) !== null) hits.push({ title: m[1].trim(), index: m.index });
  const parts = [];
  if (hits.length >= 2) {
    if (hits[0].index > 100) parts.push({ title: '卷首 / 序言', content: clean.slice(0, hits[0].index).trim() });
    for (let i = 0; i < hits.length; i++) parts.push({ title: hits[i].title, content: clean.slice(hits[i].index, i + 1 < hits.length ? hits[i+1].index : clean.length).trim() });
  } else {
    for (let i = 0; i < clean.length; i += 2400) parts.push({ title: `第 ${parts.length + 1} 节`, content: clean.slice(i, i + 2400).trim() });
  }
  const bookId = uid('bk');
  const book = { id: bookId, title: title || '自录典籍', category: state.category, hasPdf: false, totalPages: parts.length, lastPageNum: 1, toc: parts.map((p,i)=>({title:p.title,pageNum:i+1})), aiProfile: '', coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0, order: state.books.length };
  await dbPut('books', book); state.books.push(book);
  for (let i = 0; i < parts.length; i++) { const ch = { id: uid('ch'), bookId, idx: i, pageNum: i + 1, title: parts[i].title, content: parts[i].content, modernText: '' }; await dbPut('chapters', ch); state.chapters.push(ch); }
  await markDirty(); closeSheet('sheet-import'); renderDivineView(); showToast(`已导入《${book.title}》`);
}
async function importPastedBook() {
  const title = document.getElementById('pasteBookTitle').value.trim(), content = document.getElementById('pasteBookContent').value.trim();
  if (!content) return showToast('请粘贴正文');
  await importPlainTextBook(title || '自录典籍', content);
  document.getElementById('pasteBookTitle').value = ''; document.getElementById('pasteBookContent').value = '';
}

async function openReader(bookId, pageNum) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  state.reader.bookId = bookId;
  state.reader.totalPages = Math.max(1, book.totalPages || state.chapters.filter(c => c.bookId === bookId).length);
  state.reader.pageNum = typeof pageNum === 'number' ? Math.max(1, Math.min(state.reader.totalPages, pageNum)) : (book.lastPageNum || 1);
  state.reader.engine = book.hasPdf ? 'pdf' : 'text';
  state.reader.barsHidden = true;
  document.getElementById('readerOverlay').classList.add('bars-hidden');
  applyTypoSettings(); openOverlay('readerOverlay'); markStudyFootprint();
  if (book.hasPdf) {
    try {
      await loadPdfJs();
      const blobRec = await dbGet('pdfBlobs', bookId);
      if (blobRec?.data) {
        if (state.reader.pdfDoc) { try { state.reader.pdfDoc.destroy(); } catch (e) {} }
        state.reader.pdfDoc = await window.pdfjsLib.getDocument({ data: blobRec.data.slice(0) }).promise;
      } else state.reader.engine = 'text';
    } catch (e) { state.reader.engine = 'text'; }
  }
  await renderReaderPage();
}
function closeReader() { stopTts(); closeOverlay('readerOverlay'); document.getElementById('selPopover').classList.remove('show'); renderDivineView(); }
async function renderReaderPage() {
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  const pNum = state.reader.pageNum; book.lastPageNum = pNum; book.lastReadAt = Date.now(); await dbPut('books', book);
  document.getElementById('readerBookTitle').textContent = book.title;
  const ch = state.chapters.find(c => c.bookId === book.id && (c.pageNum === pNum || c.idx === pNum - 1));
  document.getElementById('readerChapTitle').textContent = ch ? ch.title : `第 ${pNum} 页`;
  document.getElementById('readerFootLeft').textContent = book.title;
  document.getElementById('readerFootRight').textContent = `${pNum} / ${state.reader.totalPages}`;
  const rng = document.getElementById('readerRange'); rng.min = 1; rng.max = state.reader.totalPages; rng.value = pNum;
  document.getElementById('readerRangeText').textContent = `${pNum}/${state.reader.totalPages}`;
  document.getElementById('readerEngineBtn').textContent = state.reader.engine === 'pdf' ? '原版PDF' : '文本/白话';
  const pdfStage = document.getElementById('readerPdfStage'), txtStage = document.getElementById('readerTextStage');
  if (state.reader.engine === 'pdf' && state.reader.pdfDoc) {
    pdfStage.style.display = 'block'; txtStage.style.display = 'none';
    const page = await state.reader.pdfDoc.getPage(pNum);
    const canvas = document.getElementById('pdfCanvas'), ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1.5, 2.2), targetW = Math.min(window.innerWidth - 36, 520);
    const vp = page.getViewport({ scale: (targetW / page.getViewport({ scale: 1 }).width) * dpr });
    canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = targetW + 'px'; canvas.style.height = (vp.height / dpr) + 'px';
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    document.getElementById('pdfPageHint').textContent = `1:1 原版排版 · 第 ${pNum} 页`;
  } else {
    pdfStage.style.display = 'none'; txtStage.style.display = 'block';
    const orig = (ch?.content || '本页暂无文本').split(/\n+/).map(s => s.trim()).filter(Boolean);
    const mod = (ch?.modernText || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    let html = `<h3 style="margin:0 0 14px;">${escapeHtml(ch?.title || '第 ' + pNum + ' 页')}</h3>`;
    html += (state.reader.textMode === 'both' && mod.length)
      ? orig.map((p, i) => `<p class="reader-para">${escapeHtml(p)}</p>${mod[i]?`<div class="reader-modern-block">${escapeHtml(mod[i])}</div>`:''}`).join('')
      : orig.map(p => `<p class="reader-para">${escapeHtml(p)}</p>`).join('');
    txtStage.innerHTML = html;
  }
  document.getElementById('readerContentWrap').scrollTop = 0;
}
function toggleReaderEngine() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  if (book?.hasPdf && state.reader.pdfDoc) { state.reader.engine = state.reader.engine === 'pdf' ? 'text' : 'pdf'; state.reader.textMode = 'both'; }
  else state.reader.textMode = state.reader.textMode === 'orig' ? 'both' : 'orig';
  renderReaderPage();
}
function readerStep(d) { stopTts(); const n = state.reader.pageNum + d; if (n < 1 || n > state.reader.totalPages) return showToast(d < 0 ? '已是第一页' : '已是最后一页'); state.reader.pageNum = n; renderReaderPage(); }
function readerJump(p) { stopTts(); state.reader.pageNum = p; renderReaderPage(); }
function handleReaderTap(e) {
  const sel = window.getSelection ? window.getSelection().toString().trim() : '';
  if (sel.length >= 2) {
    state.reader.selText = sel;
    const m = HEX_DATA.list.find(h => sel.includes(h.name));
    state.reader.selHexKey = m ? m.key : null;
    document.getElementById('selHexBtn').style.display = m ? 'inline-block' : 'none';
    document.getElementById('selPopover').classList.add('show');
    return;
  }
  document.getElementById('selPopover').classList.remove('show');
  if (e.target.closest('button')) return;
  state.reader.barsHidden = !state.reader.barsHidden;
  document.getElementById('readerOverlay').classList.toggle('bars-hidden', state.reader.barsHidden);
}
function openReaderToc() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  const toc = book?.toc?.length ? book.toc : state.chapters.filter(c => c.bookId === book.id).slice(0, 120).map(c => ({ title: c.title, pageNum: c.pageNum }));
  document.getElementById('readerTocList').innerHTML = toc.map(t => `<div style="padding:11px 4px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;cursor:pointer;font-size:14.5px;" onclick="readerJump(${t.pageNum});closeSheet('sheet-toc')"><span>${escapeHtml(t.title)}</span><span style="color:var(--text-3);">P.${t.pageNum}</span></div>`).join('');
  openSheet('sheet-toc');
}
function applyTypoSettings() {
  const s = state.settings;
  document.getElementById('readerOverlay').setAttribute('data-paper', s.paper || 'warm');
  const st = document.getElementById('readerTextStage');
  st.style.fontSize = (s.fontSize || 17) + 'px'; st.style.lineHeight = s.lineHeight || 1.9;
  document.getElementById('typoSizeVal').textContent = s.fontSize || 17;
  document.getElementById('typoSizeRange').value = s.fontSize || 17;
}
async function updateTypo(k, v) { state.settings[k] = v; applyTypoSettings(); await saveSettingsMeta(); }
function setTtsOpt(k, v) { state.tts[k] = v; document.getElementById('ttsRateLabel').textContent = state.tts.rate + 'x'; if (state.tts.playing) { stopTts(); toggleTtsPlay(); } }
function toggleTtsPlay() {
  if (!('speechSynthesis' in window)) return showToast('浏览器不支持听书');
  if (state.tts.playing) { stopTts(); return; }
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch) return;
  const orig = (ch.content || '').split(/\n+/).filter(Boolean), mod = (ch.modernText || '').split(/\n+/).filter(Boolean);
  state.tts.queue = (state.tts.mode === 'modern' && mod.length) ? mod : orig;
  state.tts.qIdx = 0; state.tts.playing = true; document.getElementById('ttsPlayBtn').textContent = '暂停';
  speakNextTts(); closeSheet('sheet-tts');
}
function speakNextTts() {
  if (!state.tts.playing || state.tts.qIdx >= state.tts.queue.length) { stopTts(); return; }
  const u = new SpeechSynthesisUtterance(state.tts.queue[state.tts.qIdx]); u.lang = 'zh-CN'; u.rate = state.tts.rate || 1.0;
  u.onend = () => { state.tts.qIdx++; speakNextTts(); };
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}
function stopTts() { state.tts.playing = false; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); const b = document.getElementById('ttsPlayBtn'); if (b) b.textContent = '开始朗读'; }
function selActionAsk() { const t = state.reader.selText; document.getElementById('selPopover').classList.remove('show'); closeReader(); switchMainTab('canwu'); switchCanwuRoom(state.category); document.getElementById('chatInput').value = `精讲这段原书条文：「${t}」`; sendCanwuMessage(); }
function selActionNote() { const b = state.books.find(x => x.id === state.reader.bookId); document.getElementById('selPopover').classList.remove('show'); createAndOpenNote({ title: state.reader.selText.slice(0, 18), body: `${state.reader.selText}\n\n出处：《${b?.title||''}》第${state.reader.pageNum}页` }); }
function selActionHex() { document.getElementById('selPopover').classList.remove('show'); if (state.reader.selHexKey) openHexDetail(state.reader.selHexKey); }

// ==================== 3. 苹果风笔记 ====================
let noteSaveTimer = null;
function renderNotesPanel(wrap) {
  const q = state.noteSearch.trim().toLowerCase();
  const list = state.notes.filter(n => n.category === state.category && (!q || (n.title + n.body).toLowerCase().includes(q)))
    .sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  wrap.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <input type="text" class="form-input" placeholder="搜索「${state.category}笔记」..." value="${escapeHtml(state.noteSearch)}" oninput="state.noteSearch=this.value;renderDivineView()" />
      <button class="btn-primary" style="padding:9px 16px;flex-shrink:0;" onclick="createAndOpenNote()">+ 新建</button>
    </div>
    ${!list.length ? `<div class="empty-box"><p>像苹果备忘录一样记录读经心得与断卦灵感。</p><button class="btn-secondary" onclick="createAndOpenNote()">写第一篇${state.category}笔记</button></div>` :
    list.map(n => `<div class="card" style="cursor:pointer;padding:14px 16px;" onclick="openNoteEditor('${n.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><strong style="font-size:16px;">${n.pinned?'📌 ':''}${escapeHtml(n.title||'无标题备忘')}</strong><span style="font-size:12px;color:var(--text-3);">${formatDateKey(new Date(n.updatedAt||n.createdAt))}</span></div>
      <div class="priv-blur" style="font-size:14px;color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55;">${escapeHtml((n.body||'').replace(/\n/g,' '))||'轻点开始编辑...'}</div>
    </div>`).join('')}
  `;
}
async function createAndOpenNote(preset = {}) {
  const note = { id: uid('nt'), category: state.category, pinned: false, title: preset.title || '', body: preset.body || '', createdAt: Date.now(), updatedAt: Date.now() };
  await dbPut('notes', note); state.notes.push(note); await markDirty(); openNoteEditor(note.id);
}
function openNoteEditor(id) {
  const n = state.notes.find(x => x.id === id); if (!n) return;
  state.editingNoteId = id;
  document.getElementById('noteEditorMeta').textContent = n.category + '笔记 · 自动保存';
  document.getElementById('notePinBtn').className = 'pill-mini ' + (n.pinned ? 'accent' : '');
  document.getElementById('noteTitleField').value = n.title || '';
  document.getElementById('noteBodyArea').value = n.body || '';
  document.getElementById('noteFolderSelect').innerHTML = CATEGORIES.map(c => `<option ${c===n.category?'selected':''}>${c}</option>`).join('');
  openOverlay('noteEditorOverlay');
}
function scheduleNoteAutoSave() { clearTimeout(noteSaveTimer); noteSaveTimer = setTimeout(saveCurrentNoteNow, 350); }
async function saveCurrentNoteNow() {
  const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return;
  n.title = document.getElementById('noteTitleField').value.trim(); n.body = document.getElementById('noteBodyArea').value; n.updatedAt = Date.now();
  await dbPut('notes', n); await markDirty();
}
async function closeNoteEditor() { await saveCurrentNoteNow(); closeOverlay('noteEditorOverlay'); renderDivineView(); }
async function toggleCurrentNotePin() { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.pinned = !n.pinned; await dbPut('notes', n); document.getElementById('notePinBtn').className = 'pill-mini ' + (n.pinned ? 'accent' : ''); }
async function changeCurrentNoteFolder(cat) { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.category = cat; await dbPut('notes', n); showToast('已移至「' + cat + '」'); }
async function deleteCurrentNote() { if (!confirm('删除这篇笔记？')) return; await dbDel('notes', state.editingNoteId); state.notes = state.notes.filter(x => x.id !== state.editingNoteId); await markDirty(); closeOverlay('noteEditorOverlay'); renderDivineView(); }
function noteInsertChecklist() { const ta = document.getElementById('noteBodyArea'); ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + '☐ '; ta.focus(); scheduleNoteAutoSave(); }
function noteInsertGanZhi() { const info = getAstroDayInfo(new Date()), ta = document.getElementById('noteBodyArea'); ta.value += `\n【${formatDateKey(new Date())} ${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时 空${info.xunkong}】\n`; scheduleNoteAutoSave(); }
function noteInsertHexPicker() { const name = prompt('输入卦名（如 地山谦）：'); if (!name) return; const h = HEX_DATA.list.find(x => x.name.includes(name.trim())); if (!h) return showToast('未找到'); document.getElementById('noteBodyArea').value += `\n【${h.name}（${h.palaceName}·世${h.shi}应${h.ying}）】${h.guaci}\n`; scheduleNoteAutoSave(); }

// ==================== 4. 侧栏与顶部呼出的独立实战档案库 ====================
function openArchivesOverlay() {
  state.archCategory = state.category;
  renderArchivesView();
  openOverlay('archivesOverlay');
}
function renderArchivesView() {
  document.getElementById('archHeaderSub').textContent = state.archCategory + '档案库';
  document.getElementById('baziCompareBtn').style.display = state.archCategory === '八字' ? 'inline-flex' : 'none';
  document.getElementById('archCatStrip').innerHTML = CATEGORIES.map(c => `<button class="cat-pill ${c===state.archCategory?'active':''}" onclick="state.archCategory='${c}';state.archGroup='全部';renderArchivesView()">${c}</button>`).join('');
  const groups = ['全部', ...(state.settings.groups || [])];
  document.getElementById('archGroupStrip').innerHTML = groups.map(g => `<button class="chip ${g===state.archGroup?'accent':''}" onclick="state.archGroup='${escapeHtml(g)}';renderArchivesView()">${escapeHtml(g)}</button>`).join('');

  const catList = state.archives.filter(a => a.category === state.archCategory).sort((a,b) => (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  const filtered = state.archGroup === '全部' ? catList : catList.filter(a => a.group === state.archGroup);
  const verified = catList.filter(a => a.verdict === 'hit' || a.verdict === 'miss');
  const rate = verified.length ? Math.round(verified.filter(a => a.verdict === 'hit').length / verified.length * 100) : 0;

  document.getElementById('archivesScrollArea').innerHTML = `
    ${catList.length ? `<div class="card" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:13.5px;color:var(--text-2);">共 <strong>${catList.length}</strong> 份 · 已验证 ${verified.length} 例 ${verified.length ? `· 准确率 <strong style="color:var(--accent);">${rate}%</strong>` : ''}</div>
      <span class="pill-mini">${getCultivationRank()}</span>
    </div>` : ''}
    ${!filtered.length ? `<div class="empty-box"><p>「${state.archCategory} · ${state.archGroup}」暂无档案</p></div>` :
    filtered.map(a => `<div class="card" style="cursor:pointer;" onclick="openSavedArchive('${a.id}')">
      <div class="card-head" style="margin-bottom:6px;"><div class="card-title priv-blur">${escapeHtml(a.title)}</div><span class="pill-mini ${a.verdict==='hit'?'accent':''}">${a.verdict==='hit'?'已应验':(a.verdict==='miss'?'有偏差':'待验证')}</span></div>
      <div style="font-size:13px;color:var(--text-3);display:flex;justify-content:space-between;"><span>${escapeHtml(a.castTimeStr||'')} · ${escapeHtml(a.group||'默认')}</span><span>${a.reports?.length ? a.reports.length+'份AI报告' : ''}</span></div>
      ${a.outcome ? `<div class="priv-blur" style="font-size:13.5px;color:var(--accent);margin-top:6px;">应验：${escapeHtml(a.outcome)}</div>` : ''}
      <div style="display:flex;justify-content:flex-end;margin-top:8px;"><button style="font-size:12.5px;color:var(--text-3);" onclick="event.stopPropagation();deleteArchive('${a.id}')">删除</button></div>
    </div>`).join('')}
  `;
}
function openSavedArchive(id) { const a = state.archives.find(x => x.id === id); if (!a) return; if (a.category === '六爻') openLiuyaoResult(a); else openGenericResult(a); }
async function deleteArchive(id) { if (!confirm('删除这份档案？')) return; await dbDel('archives', id); state.archives = state.archives.filter(a => a.id !== id); await markDirty(); renderArchivesView(); }
function openGroupEditor() { renderGroupEditorList(); openSheet('sheet-groups'); }
function renderGroupEditorList() {
  document.getElementById('groupEditList').innerHTML = (state.settings.groups || []).map((g, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:15px;">${escapeHtml(g)}</span><div style="display:flex;gap:8px;"><button class="pill-mini" onclick="renameArchiveGroup(${i})">改名</button><button class="pill-mini" onclick="removeArchiveGroup(${i})">删</button></div></div>`).join('');
}
async function addArchiveGroup() { const inp = document.getElementById('newGroupInput'), v = inp.value.trim(); if (!v) return; if (!state.settings.groups.includes(v)) state.settings.groups.push(v); inp.value = ''; await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView(); }
async function renameArchiveGroup(i) { const nv = prompt('新名称：', state.settings.groups[i]); if (!nv?.trim()) return; const old = state.settings.groups[i]; state.settings.groups[i] = nv.trim(); state.archives.forEach(a => { if (a.group === old) { a.group = nv.trim(); dbPut('archives', a); } }); await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView(); }
async function removeArchiveGroup(i) { state.settings.groups.splice(i, 1); await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView(); }

let baziComparePair = ['', ''];
function openBaziCompare() {
  const list = state.archives.filter(a => a.category === '八字');
  if (list.length < 2) return showToast('请先在「八字」保存至少 2 份命盘档案');
  baziComparePair = [list[0].id, list[1].id]; renderBaziCompareBody(); openOverlay('baziCompareOverlay');
}
function renderBaziCompareBody() {
  const list = state.archives.filter(a => a.category === '八字');
  const a1 = list.find(x => x.id === baziComparePair[0]) || list[0], a2 = list.find(x => x.id === baziComparePair[1]) || list[1];
  const rCol = a => a.data.pillars.map(p => `<span class="wx-${p.swx}" style="font-weight:700;">${p.s}</span><span class="wx-${p.bwx}" style="font-weight:700;">${p.b}</span>`).join(' · ');
  document.getElementById('baziCompareBody').innerHTML = `
    <div class="card">
      <div class="form-field"><label class="form-label">命盘甲</label><select class="form-select" onchange="baziComparePair[0]=this.value;renderBaziCompareBody()">${list.map(x => `<option value="${x.id}" ${x.id===a1.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><div style="margin-top:8px;font-size:16px;">${rCol(a1)}</div></div>
      <div class="form-field"><label class="form-label">命盘乙</label><select class="form-select" onchange="baziComparePair[1]=this.value;renderBaziCompareBody()">${list.map(x => `<option value="${x.id}" ${x.id===a2.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><div style="margin-top:8px;font-size:16px;">${rCol(a2)}</div></div>
    </div>
    <div id="baziCompareAiBox" class="card" style="font-size:15px;line-height:1.75;color:var(--text-2);">点右上角「AI 合盘」获取深度合盘分析。</div>
  `;
}
async function analyzeBaziCompareWithAI() {
  if (!ensureApiKey()) return;
  const list = state.archives.filter(a => a.category === '八字'), a1 = list.find(x => x.id === baziComparePair[0]), a2 = list.find(x => x.id === baziComparePair[1]);
  const box = document.getElementById('baziCompareAiBox'); box.textContent = '参悟合盘中...';
  try {
    const res = await callLLM([{ role:'user', content:`用 1. 2. 3. 编号清单（重点用【】标注，严禁星号）分析以下两个八字的合盘互补、日支关系与相处建议：\n甲(${a1.gender})：${a1.data.pillars.map(p=>p.gz).join(' ')}\n乙(${a2.gender})：${a2.data.pillars.map(p=>p.gz).join(' ')}` }]);
    box.innerHTML = formatRichText(res);
  } catch (e) { box.textContent = '失败：' + e.message; }
}

// ==================== 5. 大幅扩容的断法宝典（基础 + 进阶实战 + 六十甲子 + 八字奇门）+ 中文观星 ====================
const METHODS_DICT = {
  '基础知识': [
    { name:'五行生克旺衰', content:'相生：木生火、火生土、土生金、金生水、水生木。\n相克：木克土、土克水、水克火、火克金、金克木。\n\n【四季旺相休囚死】\n当令者旺，令生者相，生令者休，克令者囚，令克者死。春木旺火相、夏火旺土相、秋金旺水相、冬水旺木相、四季月（辰戌丑未）土旺金相。' },
    { name:'天干五合', content:'甲己合化土（中正之合）、乙庚合化金（仁义之合）、丙辛合化水（威制之合）、丁壬合化木（淫匿之合）、戊癸合化火（无情之合）。\n\n【实战要义】八字论合化必视月令是否得助；若化神不当令，多论「合绊」而不论真化。' },
    { name:'地支六冲', content:'子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲。\n\n【六爻铁律】\n1. 月建冲爻谓之【月破】，当下无力生克他爻。\n2. 日辰冲旺相静爻谓之【暗动】，如明动一般有力；冲休囚静爻谓之【日破】。\n3. 冲散与冲起：动爻逢合为绊，逢冲则解绊；旬空逢冲则冲实应事。' },
    { name:'地支六合与刑害', content:'【六合】子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土。\n【三刑】寅巳申无恩之刑、丑戌未恃势之刑、子卯无礼之刑、辰午酉亥自刑。\n【六害（穿）】子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害。\n\n【实战要点】六爻重冲合、轻刑害（刑害多作细节佐证）；八字则刑穿破坏力极大，须结合喜忌细辨。' },
    { name:'十二长生', content:'阳干顺行、阴干逆行（六爻与增删体系多以五行阳长生统论：木长生在亥、火长生在寅、金长生在巳、水土长生在申）。\n\n【核心四位】实战紧盯【长生、帝旺、墓库、绝地】四处：长生主初生源源不断，帝旺主极盛，入墓主受困收藏（逢冲开墓），化绝主断绝无继。' },
    { name:'旬空真假', content:'1. 【假空】：旺相之空、动而之空、有日辰动爻生扶之空。出空之日、填实之日或冲空之日即应事。\n2. 【真空】：休囚无气、伏藏受克、月破化绝之空。到底无成。\n3. 【避空】：忌神旬空或动化空，短期反而护佑用神。' },
    { name:'月破精论', content:'1. 月破在当月如朽木，难以生克他爻。\n2. 【破而有救】：临日辰、得日辰生扶、日辰合之（合起）、或自身发动化回头生、化进神者，非真破，出月或逢合填实即应吉。\n3. 【彻底真破】：休囚无助又被日克、动化退神或回头克者，终究无用。' },
    { name:'六亲与六神象意', content:'【六亲】父母（文书合同、房产车辆、长辈辛苦）、兄弟（同辈竞争、破财阻隔）、子孙（福神财源、医药解忧、自由）、妻财（钱财利润、妻妾、饮食）、官鬼（事业名位、上司丈夫、疾病灾祸忧虑）。\n\n【六神】青龙（喜庆正财新局）、朱雀（口舌文书沟通）、勾陈（滞留田土熟人固执）、螣蛇（惊疑怪异虚缠）、白虎（刚猛急迫血光权柄）、玄武（隐秘暗昧谋划）。' },
    { name:'八卦万物类象', content:'乾（天/父/领导/金属/西北/圆满）· 坤（地/母/大众/田土/西南/包容）\n震（雷/长男/变动/声响/正东/急躁）· 巽（风/长女/信息/名利/东南/渗透）\n坎（水/中男/险阻/隐秘/正北/流动）· 离（火/中女/光明/文书/正南/依附）\n艮（山/少男/停止/阻隔/东北/稳重）· 兑（泽/少女/口舌/喜悦/正西/缺损）' }
  ],
  '进阶实战': [
    { name:'六爻取用神总诀', content:'实战 80% 的误断源于取错用神：\n1. 求财开单、生意利润取【妻财】；但问工程中标、合同签约、考试证书须优先看【父母】。\n2. 求职升迁、问官司、女测夫取【官鬼】；但防官鬼克世反主压力与是非。\n3. 治病求医、避灾解忧、寻开心取【子孙】（子孙为克鬼之药神）。\n4. 凡事须【世爻与用神兼看】：用神旺而世爻休囚受克，多主东西虽好我却无福消受。' },
    { name:'复合动爻简化法则', content:'多爻齐动切忌一团浆糊，严格按三步简化：\n1. 先剔除【无用动爻】：凡动化回头克、动化绝、动化破且无日月救应者，自顾不暇，剔出吉凶主线。\n2. 找【联动路线】：看余下有用动爻是否构成连环相生（如兄动生子、子动生财）或组成三合局。\n3. 严分【吉凶层面】与【细节层面】：成败只听最硬的动变生克；六神、伏吟、卦辞留到第二层讲过程细节。' },
    { name:'化进神与化退神', content:'【化进神】亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌、戌化丑。主事态由弱转强、步步递增。\n【化退神】子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未、丑化戌。主热情减退、规模缩水、半途撤回。\n\n【关键细节】用神化进喜旺相，忌神化进最凶；忌神化退反而是坏事逐步消散之喜象。' },
    { name:'飞伏神出伏条件', content:'用神不上卦而伏藏于本宫首卦之下，飞神在上、伏神在下。\n【伏神有用六法】：1.伏神得日月生扶；2.伏神旺相；3.飞神生伏神；4.动爻生伏神；5.日月动爻冲克飞神（掀开盖子）；6.飞神空破休囚墓绝。反之为伏而难出。' },
    { name:'反吟与伏吟', content:'【卦变反吟】主卦与变卦六爻地支全冲，主事情反复折腾、去而复返、半途大翻盘（须细看冲后用神旺衰定终局）。\n【卦变伏吟】主卦与变卦地支相同，主停滞呻吟、内心纠结、拖延难决；逢冲动之日方能破局。' },
    { name:'三合局成局与待合', content:'申子辰水局、亥卯未木局、寅午戌火局、巳酉丑金局。\n1. 卦中三爻俱动、或两动一变、或一动配日月皆可论合局。\n2. 【虚一待用】：缺一字成局者，往往在补齐缺字的那一天或那一月应事。\n3. 合局生世/用大吉，合局克世/用大凶。' },
    { name:'游魂与归魂', content:'【游魂卦】本宫第七卦（如火地晋、水天需等），主心神不定、漂泊变动、外出远行或犹豫不决。\n【归魂卦】本宫第八卦（如火天大有、水地比等），主回归原处、守成不变、出外思归、破镜重圆。' }
  ],
  '六十甲子': Array.from({length: 60}, (_, i) => {
    const gz = STEMS[i % 10] + BRANCHES[i % 12];
    const nayin30 = ['海中金','炉中火','大林木','路旁土','剑锋金','山头火','涧下水','城头土','白蜡金','杨柳木','泉中水','屋上土','霹雳火','松柏木','长流水','沙中金','山下火','平地木','壁上土','金箔金','覆灯火','天河水','大驿土','钗钏金','桑柘木','大溪水','沙中土','天上火','石榴木','大海水'];
    const k1 = (i % 12 - i % 10 + 22) % 12;
    return { name: gz + '日', content: `【${gz}日柱精览】\n1. 纳音五行：${nayin30[Math.floor(i/2)]}\n2. 干支结构：${STEMS[i%10]}(${STEM_WX[i%10]}) 坐 ${BRANCHES[i%12]}(${BRANCH_WX[i%12]}，藏干：${HIDDEN_STEMS[BRANCHES[i%12]]})\n3. 本旬空亡：${BRANCHES[k1]}${BRANCHES[(k1+1)%12]}\n4. 日支冲合：冲${LIU_CHONG[BRANCHES[i%12]]} · 合${LIU_HE[BRANCHES[i%12]]}` };
  }),
  '八字奇门': [
    { name:'八字十神格局', content:'正官（秩序责任）、七杀（魄力高压，喜食制印化）、正印（护佑学识）、偏印（灵感直觉，防枭神夺食）、食神（福禄才华）、伤官（锐气革新，忌见正官）、比劫（独立竞争）、正偏财（务实掌控与变现）。\n\n【看盘顺序】先定月令格局与日主强弱，再辨调候寒暖燥湿，最后看大运流年引动合冲。' },
    { name:'奇门八门九星克应', content:'【三吉门】开（启动事业）、休（贵人休养）、生（利润求财）。\n【四凶门】伤（竞争损耗）、死（停滞地产）、惊（口舌惊恐）、杜（隐藏技术）；景门主文书计划与火电。\n【九星】天辅（文教）、天心（医药谋略）、天任（稳重踏实）偏吉；天蓬（大盗冒险）、天芮（病星问题）须慎。\n【实战总纲】奇门看用神落宫旺衰、是否逢空逢墓逢击刑，再看天盘地盘干克应格局。' }
  ]
};

const DEFAULT_STAR_PORTALS = [
  { name:'Stellarium 在线天文馆（简体中文）', url:'https://stellarium-web.org/?lang=zh-CN', desc:'手机免登录高清实时星空，左下角可切中国传统星官线' },
  { name:'香港太空馆 · 中文星夜行与古星图', url:'https://hk.space.museum/sc/web/spm/resources/star-map.html', desc:'权威全中文三垣二十八宿与当月星图资料' },
  { name:'天文通 · 实时中文天象与观星', url:'https://www.tianwentong.com/', desc:'国内直连中文实时天象、月相、行星位置与观星条件' },
  { name:'国家天文科学数据中心（中文）', url:'https://nadc.china-vo.org/', desc:'中国科学院国家天文台官方中文天文数据与科普入口' }
];

function switchMethodsSub(sub) {
  state.methodsSub = sub;
  document.getElementById('methodsSlider').style.transform = `translateX(${['dict','hex','tools'].indexOf(sub) * 100}%)`;
  document.querySelectorAll('#view-methods .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.msub === sub));
  renderMethodsView();
}

function renderMethodsView() {
  const wrap = document.getElementById('methodsScrollArea');
  if (state.methodsSub === 'dict') {
    const groups = Object.keys(METHODS_DICT), items = METHODS_DICT[state.dictGroup] || [], cur = items[state.dictItemIdx] || items[0];
    wrap.innerHTML = `
      <div class="cat-strip" style="padding:0 0 12px;">
        ${groups.map(g => `<button class="cat-pill ${g===state.dictGroup?'active':''}" onclick="state.dictGroup='${g}';state.dictItemIdx=0;renderMethodsView()">${g}</button>`).join('')}
      </div>
      <div class="dict-layout">
        <div class="dict-left">${items.map((it, idx) => `<div class="dict-nav-item ${idx===state.dictItemIdx?'active':''}" onclick="state.dictItemIdx=${idx};renderMethodsView()">${escapeHtml(it.name)}</div>`).join('')}</div>
        <div class="dict-right">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><strong style="font-size:17px;">${escapeHtml(cur.name)}</strong><button class="pill-mini" onclick="saveDictToNote()">存笔记</button></div>
          <div style="font-size:15px;line-height:1.82;white-space:pre-wrap;">${formatRichText(cur.content)}</div>
          <button class="btn-secondary" style="width:100%;margin-top:18px;" onclick="askCanwuDictItem()">让参悟深讲「${escapeHtml(cur.name)}」</button>
        </div>
      </div>
    `;
  } else if (state.methodsSub === 'hex') {
    let items = [...HEX_DATA.list];
    if (state.hexSearch.trim()) { const q = state.hexSearch.trim(); items = items.filter(h => h.name.includes(q) || h.palaceName.includes(q) || h.guaci.includes(q)); }
    if (state.hexSort === 'seq') items.sort((a,b) => a.seq - b.seq);
    else if (state.hexPalaceFilter !== 'all') items = items.filter(h => h.palaceName === state.hexPalaceFilter);
    wrap.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input type="text" class="form-input" placeholder="搜卦名、八宫或卦辞..." value="${escapeHtml(state.hexSearch)}" oninput="state.hexSearch=this.value;renderMethodsView()" />
        <button class="chip ${state.hexSort==='palace'?'accent':''}" onclick="state.hexSort=state.hexSort==='palace'?'seq':'palace';renderMethodsView()">${state.hexSort==='palace'?'八宫序':'周易序'}</button>
      </div>
      ${state.hexSort==='palace' ? `<div class="cat-strip" style="padding:0 0 10px;"><button class="cat-pill ${state.hexPalaceFilter==='all'?'active':''}" onclick="state.hexPalaceFilter='all';renderMethodsView()">全部</button>${PALACE_ORDER.map(p => { const pn = TRIGRAMS[p].name+'宫'; return `<button class="cat-pill ${state.hexPalaceFilter===pn?'active':''}" onclick="state.hexPalaceFilter='${pn}';renderMethodsView()">${pn}</button>`; }).join('')}</div>` : ''}
      <div class="hex-mini-grid">${items.map(h => `<div class="hex-card-item" onclick="openHexDetail('${h.key}')"><div class="hex-mini-lines">${[5,4,3,2,1,0].map(i=>`<div class="yao-bar ${h.bits[i]?'yang':'yin'}"></div>`).join('')}</div><div style="min-width:0;"><div style="font-size:15px;font-weight:700;">${h.name}</div><div style="font-size:12px;color:var(--text-3);">${h.palaceName}·${h.genName}·第${h.seq}卦</div></div></div>`).join('')}</div>
    `;
  } else {
    const portals = [...DEFAULT_STAR_PORTALS, ...(state.settings.customPortals || [])];
    wrap.innerHTML = `
      <div class="card">
        <div class="card-head"><span class="card-title">中文观星与外部术数任意门</span><button class="pill-mini accent" onclick="openSheet('sheet-add-portal')">+ 添加</button></div>
        ${portals.map((p, idx) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);gap:10px;">
          <div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">${escapeHtml(p.name)}</div><div style="font-size:12.5px;color:var(--text-3);margin-top:3px;">${escapeHtml(p.desc || p.url)}</div></div>
          <div style="display:flex;gap:6px;"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="pill-mini accent" style="text-decoration:none;">直达 ↗</a>${idx >= DEFAULT_STAR_PORTALS.length ? `<button class="pill-mini" onclick="deleteCustomPortal(${idx - DEFAULT_STAR_PORTALS.length})">删</button>` : ''}</div>
        </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px;">汉字数理速算（梅花测字）</div>
        <div style="display:flex;gap:8px;"><input type="text" id="strokeWordInput" class="form-input" placeholder="输入汉字测对应卦象" /><button class="btn-primary" style="flex-shrink:0;" onclick="calcWordGua()">测算</button></div>
        <div id="strokeWordResult" style="margin-top:10px;font-size:14px;color:var(--text-2);"></div>
      </div>
    `;
  }
}

function saveDictToNote() { const cur = (METHODS_DICT[state.dictGroup] || [])[state.dictItemIdx]; if (cur) createAndOpenNote({ title: cur.name, body: cur.content }); }
function askCanwuDictItem() { const cur = (METHODS_DICT[state.dictGroup] || [])[state.dictItemIdx]; if (!cur) return; switchMainTab('canwu'); document.getElementById('chatInput').value = `结合我的书库，把「${cur.name}」的实战用法与例外反转彻底讲透。`; sendCanwuMessage(); }
async function saveCustomPortal() { const name = document.getElementById('portalNameInput').value.trim(), url = document.getElementById('portalUrlInput').value.trim(), desc = document.getElementById('portalDescInput').value.trim(); if (!name || !url) return showToast('请填名称和网址'); state.settings.customPortals.push({ name, url, desc }); await saveSettingsMeta(); closeSheet('sheet-add-portal'); renderMethodsView(); }
async function deleteCustomPortal(i) { state.settings.customPortals.splice(i, 1); await saveSettingsMeta(); renderMethodsView(); }
function calcWordGua() {
  const w = (document.getElementById('strokeWordInput').value || '').trim(); if (!w) return;
  const codes = Array.from(w).map(ch => ch.charCodeAt(0)), sum = codes.reduce((a,b)=>a+b, 0);
  const h = HEX_DATA.byKey[NUM_TO_TRI[codes[0]%8] + '_' + NUM_TO_TRI[codes[codes.length-1]%8]];
  document.getElementById('strokeWordResult').innerHTML = `感应主卦：<strong>${h.name}</strong>（第${(sum%6)||6}爻动） <button class="pill-mini accent" onclick="openHexDetail('${h.key}')">查详情</button>`;
}

async function openHexDetail(key) { state.currentHexKey = key; state.hexMovingSet = new Set(); await renderHexDetail(); openOverlay('hexDetailOverlay'); }
async function renderHexDetail() {
  const hex = HEX_DATA.byKey[state.currentHexKey]; if (!hex) return;
  const info = getAstroDayInfo(new Date()), exam = runLiuyaoPhysicalExam(hex, state.hexMovingSet, info.month.b, info.day.b, info.xunkong);
  const cached = await dbGet('hexCache', hex.key);
  document.getElementById('hexDetailTitle').textContent = hex.name;
  document.getElementById('hexDetailBody').innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:4px;">${hex.name}（第 ${hex.seq} 卦 · ${hex.palaceName}${hex.genName}）</div>
      <div style="font-size:13px;color:var(--text-2);margin-bottom:10px;">世${hex.shi}爻 · 应${hex.ying}爻 · 今日旬空：${info.xunkong}</div>
      ${[5,4,3,2,1,0].map(i => { const r = exam.examRows[i]; return `<div class="ly-row" onclick="toggleHexDetailMov(${r.pos})"><span>${r.liuqin}</span><span class="wx-${r.wx}" style="font-weight:700;">${r.branch}${r.wx}${info.xunkong.includes(r.branch)?'(空)':''}</span><div><span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span>${r.isShi?'世':(r.isYing?'应':'')}</div><span style="color:var(--accent);font-weight:700;">${r.isMov?(r.bit?'○':'×'):'静'}</span><span style="font-size:12px;color:var(--text-3);">${r.bian?'→'+r.bian.branch+r.bian.wx:(r.fushen?'伏'+r.fushen.label:'')}</span></div>`; }).join('')}
    </div>
    <div class="card"><div class="card-title" style="margin-bottom:6px;">原典卦辞</div><div style="font-size:15px;line-height:1.75;">${escapeHtml(hex.guaci)}</div></div>
    <div class="card"><div class="card-head"><span class="card-title">参悟深度白话详解</span><button class="pill-mini accent" onclick="generateHexDeepAI('${hex.key}')">${cached?'重生成':'AI生成'}</button></div><div style="font-size:15px;line-height:1.78;">${cached ? formatRichText(cached.text) : '<span style="color:var(--text-3);">点右上角生成一次即永久本地缓存。</span>'}</div></div>
  `;
}
function toggleHexDetailMov(pos) { if (state.hexMovingSet.has(pos)) state.hexMovingSet.delete(pos); else state.hexMovingSet.add(pos); renderHexDetail(); }
function askCanwuAboutHex() { const h = HEX_DATA.byKey[state.currentHexKey]; closeOverlay('hexDetailOverlay'); switchMainTab('canwu'); switchCanwuRoom('六爻'); document.getElementById('chatInput').value = `结合书库精讲「${h.name}」的实战断法与关键取象。`; sendCanwuMessage(); }

function openGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('globalSearchResults').innerHTML = '<div class="empty-box"><p>搜全库：书架原书页码、笔记、实战档案与断法宝典</p></div>';
  openOverlay('globalSearchOverlay');
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 200);
}
function runGlobalSearch(q) {
  const k = (q || '').trim(), wrap = document.getElementById('globalSearchResults'); if (!k) return;
  const bookHits = state.chapters.filter(c => (c.content || '').includes(k)).slice(0, 8);
  const archHits = state.archives.filter(a => (a.title + (a.note||'') + (a.outcome||'')).includes(k)).slice(0, 6);
  const noteHits = state.notes.filter(n => (n.title + n.body).includes(k)).slice(0, 6);
  const dictHits = [];
  Object.entries(METHODS_DICT).forEach(([g, arr]) => arr.forEach((it, idx) => { if ((it.name + it.content).includes(k)) dictHits.push({ g, idx, it }); }));
  let html = '';
  if (bookHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">原书命中</div>${bookHits.map(c => { const b = state.books.find(x => x.id === c.bookId), pos = c.content.indexOf(k); return `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openReader('${c.bookId}',${c.pageNum})"><div style="font-size:14px;font-weight:600;color:var(--accent);">《${escapeHtml(b?.title||'')}》第${c.pageNum}页</div><div style="font-size:13px;color:var(--text-2);">...${escapeHtml(c.content.slice(Math.max(0,pos-22), pos+60))}...</div></div>`; }).join('')}</div>`;
  if (archHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">实战档案命中</div>${archHits.map(a => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openSavedArchive('${a.id}')">[${a.category}] ${escapeHtml(a.title)}</div>`).join('')}</div>`;
  if (noteHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">笔记命中</div>${noteHits.map(n => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openNoteEditor('${n.id}')">[${n.category}] ${escapeHtml(n.title||'无标题')}</div>`).join('')}</div>`;
  if (dictHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">断法字典命中</div>${dictHits.slice(0,6).map(d => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');switchMainTab('methods');switchMethodsSub('dict');state.dictGroup='${d.g}';state.dictItemIdx=${d.idx};renderMethodsView()">${escapeHtml(d.it.name)}</div>`).join('')}</div>`;
  wrap.innerHTML = html || '<div class="empty-box"><p>未检索到匹配结果</p></div>';
}
