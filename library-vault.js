// ==================== 藏往 V6：双引擎书架与原版PDF阅读、苹果风笔记、自定义档案库、断法字典与百宝箱 ====================
const COVER_PALETTES = [
  'linear-gradient(155deg, #4A3728, #2B1F16)',
  'linear-gradient(155deg, #2E4C47, #1A2F2C)',
  'linear-gradient(155deg, #6E2D24, #3E1813)',
  'linear-gradient(155deg, #2D3F56, #192534)',
  'linear-gradient(155deg, #544638, #312820)',
  'linear-gradient(155deg, #433952, #251F30)'
];

// ==================== 1. 书架管理（九宫格/列表、排序、重命名、置顶、换门类、换封面、建AI索引） ====================
function renderShelfPanel(wrap) {
  let catBooks = state.books.filter(b => b.category === state.category);
  if (state.shelfSort === 'recent') catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || (b.lastReadAt||0)-(a.lastReadAt||0) || b.createdAt-a.createdAt);
  else if (state.shelfSort === 'newest') catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || b.createdAt-a.createdAt);
  else if (state.shelfSort === 'name') catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || a.title.localeCompare(b.title,'zh'));
  else catBooks.sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || (a.order??999)-(b.order??999));

  const toolbar = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:6px;">
      <div style="display:flex;gap:6px;">
        <button class="chip ${state.shelfView==='grid'?'accent':''}" onclick="state.shelfView='grid';renderDivineView()">九宫格</button>
        <button class="chip ${state.shelfView==='list'?'accent':''}" onclick="state.shelfView='list';renderDivineView()">正列</button>
        <select class="chip" style="border:none;" onchange="state.shelfSort=this.value;renderDivineView()">
          <option value="recent" ${state.shelfSort==='recent'?'selected':''}>最近阅读</option>
          <option value="newest" ${state.shelfSort==='newest'?'selected':''}>最新导入</option>
          <option value="name" ${state.shelfSort==='name'?'selected':''}>书名顺序</option>
          <option value="custom" ${state.shelfSort==='custom'?'selected':''}>自定义序</option>
        </select>
      </div>
      <button class="chip accent" onclick="openSheet('sheet-import')">+ 导书</button>
    </div>
  `;

  if (!catBooks.length) {
    wrap.innerHTML = toolbar + `<div class="empty-box">
      <div style="font-size:30px;opacity:0.4;">冊</div>
      <p>「${state.category}」书架目前为空<br/>导入 PDF 原版古籍（1:1 保留原书段落与卦象）或 TXT 文本<br/>传完后排盘页会自动识别并允许你选书断卦</p>
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
          <div class="book-cover-foot">
            <span>${b.hasPdf ? 'PDF原版' : '文本'}</span>
            <span>${b.aiProfile ? '已建索引' : total + '页'}</span>
          </div>
        </div>
        <div class="book-meta">
          <div style="min-width:0;flex:1;">
            <div class="book-name">${escapeHtml(b.title)}</div>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:2px;">已读 ${prog}%</div>
          </div>
          <button style="padding:2px 5px;color:var(--text-3);font-size:15px;" onclick="event.stopPropagation();openBookEditSheet('${b.id}')">⋮</button>
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
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.pinned?'📌 ':''}${escapeHtml(b.title)}</div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">${b.hasPdf ? '1:1 原版 PDF' : '文本书'} · 第 ${cur}/${total} 页 ${b.aiProfile ? '· ✓ 已建 AI 断法索引' : ''}</div>
          ${b.aiProfile ? `<div style="font-size:11px;color:var(--text-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(b.aiProfile)}</div>` : ''}
        </div>
        <button class="chip" onclick="event.stopPropagation();openBookEditSheet('${b.id}')">管理</button>
      </div>`;
    }).join('');
  }
}

function openBookEditSheet(bookId) {
  const b = state.books.find(x => x.id === bookId);
  if (!b) return;
  document.getElementById('bookEditPanel').innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 12px;font-size:16px;">管理典籍</h3>
    <div class="form-field">
      <label class="form-label">书名（重命名）</label>
      <input type="text" id="editBookName" class="form-input" value="${escapeHtml(b.title)}" />
    </div>
    <div class="form-field">
      <label class="form-label">所属术数门类</label>
      <select id="editBookCat" class="form-select">
        ${CATEGORIES.map(c => `<option ${b.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-field">
      <label class="form-label">封面配色</label>
      <div style="display:flex;gap:10px;">
        ${COVER_PALETTES.map((bg, idx) => `<button style="width:32px;height:32px;border-radius:8px;background:${bg};border:${(b.coverIdx||0)===idx?'2px solid var(--accent)':'none'};" onclick="setBookCoverColor('${b.id}',${idx})"></button>`).join('')}
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">AI 流派身份证（供选书断卦精准识别）</label>
      <div style="font-size:12px;color:var(--text-2);background:var(--bg);padding:8px 10px;border-radius:10px;margin-bottom:6px;">
        ${escapeHtml(b.aiProfile || '尚未建立流派画像，点下方按钮静默分析目录与序言。')}
      </div>
      <button class="btn-secondary" style="width:100%;" onclick="buildBookAiProfile('${b.id}')">为参悟建立本书断法索引与流派画像</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
      <button class="btn-secondary" onclick="toggleBookPin('${b.id}')">${b.pinned?'取消置顶':'置顶书架'}</button>
      <button class="btn-secondary" onclick="moveBookOrder('${b.id}', -1)">排序上移</button>
      <button class="btn-secondary" onclick="moveBookOrder('${b.id}', 1)">排序下移</button>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;" onclick="saveBookEdit('${b.id}')">保存修改</button>
      <button class="btn-secondary" style="color:var(--accent);" onclick="deleteBookConfirm('${b.id}')">删除</button>
    </div>
  `;
  openSheet('sheet-book-edit');
}

async function saveBookEdit(bookId) {
  const b = state.books.find(x => x.id === bookId);
  if (!b) return;
  b.title = document.getElementById('editBookName').value.trim() || b.title;
  b.category = document.getElementById('editBookCat').value;
  await dbPut('books', b);
  await markDirty();
  closeSheet('sheet-book-edit');
  renderDivineView();
  showToast('书籍信息已更新');
}
async function setBookCoverColor(bookId, idx) {
  const b = state.books.find(x => x.id === bookId);
  if (!b) return;
  b.coverIdx = idx; await dbPut('books', b); openBookEditSheet(bookId); renderDivineView();
}
async function toggleBookPin(bookId) {
  const b = state.books.find(x => x.id === bookId);
  if (!b) return;
  b.pinned = !b.pinned; await dbPut('books', b); closeSheet('sheet-book-edit'); renderDivineView();
}
async function moveBookOrder(bookId, delta) {
  state.shelfSort = 'custom';
  const list = state.books.filter(x => x.category === state.category).sort((a,b) => (a.order??999)-(b.order??999));
  list.forEach((x, i) => x.order = i);
  const idx = list.findIndex(x => x.id === bookId);
  const target = idx + delta;
  if (target < 0 || target >= list.length) return showToast('已到边界');
  const tmp = list[idx].order; list[idx].order = list[target].order; list[target].order = tmp;
  await dbPut('books', list[idx]); await dbPut('books', list[target]);
  renderDivineView(); showToast('已调整书架顺序');
}
async function deleteBookConfirm(bookId) {
  const b = state.books.find(x => x.id === bookId);
  if (!b || !confirm(`确定删除《${b.title}》吗？`)) return;
  await dbDel('books', bookId);
  await dbDel('pdfBlobs', bookId);
  const chs = state.chapters.filter(c => c.bookId === bookId);
  for (const c of chs) await dbDel('chapters', c.id);
  state.books = state.books.filter(x => x.id !== bookId);
  state.chapters = state.chapters.filter(c => c.bookId !== bookId);
  await markDirty();
  closeSheet('sheet-book-edit');
  renderDivineView();
  showToast('已删除');
}

// ==================== 2. 双引擎 PDF / 文本导入（原件1:1渲染 + 坐标级段落还原 + 真实目录） ====================
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      res();
    };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// 按坐标还原自然行与段落（彻底告别一长条）
function extractStructuredLines(textContent) {
  const items = textContent.items.filter(it => it.str && it.str.trim() !== '');
  if (!items.length) return '';
  const lines = [];
  items.forEach(it => {
    const y = Math.round(it.transform[5] / 4) * 4;
    const x = it.transform[4];
    let row = lines.find(l => Math.abs(l.y - y) <= 4);
    if (!row) { row = { y, parts: [] }; lines.push(row); }
    row.parts.push({ x, str: it.str });
  });
  lines.sort((a, b) => b.y - a.y);
  let out = '';
  let prevY = null;
  lines.forEach(l => {
    l.parts.sort((a, b) => a.x - b.x);
    let lineStr = '';
    l.parts.forEach((p, idx) => {
      if (idx > 0 && p.x - l.parts[idx-1].x > 26) lineStr += '　';
      lineStr += p.str;
    });
    if (prevY !== null && (prevY - l.y) > 22) out += '\n';
    out += lineStr.trim() + '\n';
    prevY = l.y;
  });
  return out.trim();
}

async function handleBookFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const title = file.name.replace(/\.(pdf|txt|md)$/i, '');
  if (/\.pdf$/i.test(file.name)) {
    showToast('正在保存原版 PDF 并解析真实目录与页码...');
    try {
      await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const bookId = uid('bk');
      await dbPut('pdfBlobs', { id: bookId, data: buf });

      // 读取真实书签目录
      let toc = [];
      try {
        const outline = await pdf.getOutline();
        if (outline && outline.length) {
          for (const item of outline.slice(0, 80)) {
            let pageIdx = 0;
            try {
              const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
              if (dest && dest[0]) pageIdx = await pdf.getPageIndex(dest[0]);
            } catch (er) {}
            toc.push({ title: item.title, pageNum: pageIdx + 1 });
          }
        }
      } catch (er) {}

      const book = {
        id: bookId, title, category: state.category, hasPdf: true,
        totalPages: pdf.numPages, lastPageNum: 1, lastChapIdx: 0,
        toc, aiProfile: '', coverIdx: state.books.length % COVER_PALETTES.length,
        createdAt: Date.now(), lastReadAt: 0, order: state.books.length
      };
      await dbPut('books', book);
      state.books.push(book);

      // 按页提取坐标还原文本（供 AI 检索、听书与白话对照）
      const maxExtract = Math.min(pdf.numPages, 600);
      for (let p = 1; p <= maxExtract; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const text = extractStructuredLines(tc);
        const ch = { id: uid('ch'), bookId, idx: p - 1, pageNum: p, title: `第 ${p} 页`, content: text, modernText: '' };
        await dbPut('chapters', ch);
        state.chapters.push(ch);
      }
      await markDirty();
      closeSheet('sheet-import');
      renderDivineView();
      showToast(`《${title}》已 1:1 原版导入（共 ${pdf.numPages} 页）！`);
    } catch (err) {
      showToast('PDF 导入失败：' + err.message);
    }
  } else {
    const txt = await file.text();
    await importPlainTextBook(title, txt);
  }
  e.target.value = '';
}

async function importPlainTextBook(title, rawText) {
  const clean = rawText.replace(/\r\n/g, '\n').trim();
  const re = /(?:^|\n)\s*((?:第[零一二三四五六七八九十百千0-9]+[章节卷篇回]|卷[零一二三四五六七八九十0-9]+)\s+[^\n]{1,34})(?=\n)/g;
  const hits = []; let m;
  while ((m = re.exec(clean)) !== null) hits.push({ title: m[1].trim(), index: m.index });
  const parts = [];
  if (hits.length >= 2) {
    if (hits[0].index > 100) parts.push({ title: '卷首 / 序言', content: clean.slice(0, hits[0].index).trim() });
    for (let i = 0; i < hits.length; i++) {
      const end = i + 1 < hits.length ? hits[i+1].index : clean.length;
      parts.push({ title: hits[i].title, content: clean.slice(hits[i].index, end).trim() });
    }
  } else {
    for (let i = 0; i < clean.length; i += 2400) {
      parts.push({ title: `第 ${parts.length + 1} 节`, content: clean.slice(i, i + 2400).trim() });
    }
  }
  const bookId = uid('bk');
  const book = {
    id: bookId, title: title || '自录典籍', category: state.category, hasPdf: false,
    totalPages: parts.length, lastPageNum: 1, lastChapIdx: 0,
    toc: parts.map((p, i) => ({ title: p.title, pageNum: i + 1 })),
    aiProfile: '', coverIdx: state.books.length % COVER_PALETTES.length,
    createdAt: Date.now(), lastReadAt: 0, order: state.books.length
  };
  await dbPut('books', book);
  state.books.push(book);
  for (let i = 0; i < parts.length; i++) {
    const ch = { id: uid('ch'), bookId, idx: i, pageNum: i + 1, title: parts[i].title, content: parts[i].content, modernText: '' };
    await dbPut('chapters', ch);
    state.chapters.push(ch);
  }
  await markDirty();
  closeSheet('sheet-import');
  renderDivineView();
  showToast(`已导入《${book.title}》（${parts.length} 节）`);
}

async function importPastedBook() {
  const title = document.getElementById('pasteBookTitle').value.trim();
  const content = document.getElementById('pasteBookContent').value.trim();
  if (!content) return showToast('请粘贴正文');
  await importPlainTextBook(title || '自录典籍', content);
  document.getElementById('pasteBookTitle').value = '';
  document.getElementById('pasteBookContent').value = '';
}

// ==================== 3. 双引擎沉浸阅读器（PDF 1:1 渲染 + 文本/听书 + 抽例盲测） ====================
async function openReader(bookId, pageNum) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;
  state.reader.bookId = bookId;
  state.reader.totalPages = Math.max(1, book.totalPages || state.chapters.filter(c => c.bookId === bookId).length);
  state.reader.pageNum = typeof pageNum === 'number' ? Math.max(1, Math.min(state.reader.totalPages, pageNum)) : (book.lastPageNum || 1);
  state.reader.engine = book.hasPdf ? 'pdf' : 'text';
  state.reader.barsHidden = true;
  document.getElementById('readerOverlay').classList.add('bars-hidden');
  applyTypoSettings();
  openOverlay('readerOverlay');
  markStudyFootprint();

  if (book.hasPdf) {
    try {
      await loadPdfJs();
      const blobRec = await dbGet('pdfBlobs', bookId);
      if (blobRec && blobRec.data) {
        if (state.reader.pdfDoc) { try { state.reader.pdfDoc.destroy(); } catch (e) {} }
        state.reader.pdfDoc = await window.pdfjsLib.getDocument({ data: blobRec.data.slice(0) }).promise;
      } else {
        state.reader.engine = 'text';
        showToast('本地未找到该书 PDF 原件，已自动切至坐标文本模式');
      }
    } catch (e) {
      state.reader.engine = 'text';
    }
  }
  await renderReaderPage();
}

function closeReader() {
  stopTts();
  closeOverlay('readerOverlay');
  document.getElementById('selPopover').classList.remove('show');
  renderDivineView();
}

async function renderReaderPage() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  if (!book) return;
  const pNum = state.reader.pageNum;
  book.lastPageNum = pNum; book.lastReadAt = Date.now();
  await dbPut('books', book);

  document.getElementById('readerBookTitle').textContent = book.title;
  const ch = state.chapters.find(c => c.bookId === book.id && (c.pageNum === pNum || c.idx === pNum - 1));
  document.getElementById('readerChapTitle').textContent = ch ? ch.title : `第 ${pNum} 页`;
  document.getElementById('readerFootLeft').textContent = book.title;
  document.getElementById('readerFootRight').textContent = `${pNum} / ${state.reader.totalPages}`;
  const rng = document.getElementById('readerRange');
  rng.min = 1; rng.max = state.reader.totalPages; rng.value = pNum;
  document.getElementById('readerRangeText').textContent = `${pNum}/${state.reader.totalPages}`;
  document.getElementById('readerEngineBtn').textContent = state.reader.engine === 'pdf' ? '原版PDF' : (state.reader.textMode === 'both' ? '古今对照' : '文本/白话');

  const pdfStage = document.getElementById('readerPdfStage');
  const txtStage = document.getElementById('readerTextStage');

  if (state.reader.engine === 'pdf' && state.reader.pdfDoc) {
    pdfStage.style.display = 'block';
    txtStage.style.display = 'none';
    const page = await state.reader.pdfDoc.getPage(pNum);
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1.5, 2.2);
    const targetW = Math.min(window.innerWidth - 36, 520);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = (targetW / unscaled.width) * dpr;
    const vp = page.getViewport({ scale });
    canvas.width = vp.width; canvas.height = vp.height;
    canvas.style.width = targetW + 'px';
    canvas.style.height = (vp.height / dpr) + 'px';
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    document.getElementById('pdfPageHint').textContent = `1:1 原版排版 · 第 ${pNum} 页（点右上角可切白话对照或听书）`;
  } else {
    pdfStage.style.display = 'none';
    txtStage.style.display = 'block';
    const origParas = (ch?.content || '本页暂无可提取文字').split(/\n+/).map(s => s.trim()).filter(Boolean);
    const modParas = (ch?.modernText || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    let html = `<h3 style="margin:0 0 14px;">${escapeHtml(ch?.title || '第 ' + pNum + ' 页')}</h3>`;
    if (state.reader.textMode === 'both' && modParas.length) {
      html += origParas.map((p, i) => `<p class="reader-para">${escapeHtml(p)}</p>${modParas[i]?`<div class="reader-modern-block">${escapeHtml(modParas[i])}</div>`:''}`).join('');
    } else if (state.reader.textMode === 'modern' && modParas.length) {
      html += modParas.map(p => `<p class="reader-para">${escapeHtml(p)}</p>`).join('');
    } else {
      html += origParas.map(p => `<p class="reader-para">${escapeHtml(p)}</p>`).join('');
    }
    txtStage.innerHTML = html;
  }
  document.getElementById('readerContentWrap').scrollTop = 0;
}

function toggleReaderEngine() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  if (book?.hasPdf && state.reader.pdfDoc) {
    if (state.reader.engine === 'pdf') { state.reader.engine = 'text'; state.reader.textMode = 'both'; }
    else { state.reader.engine = 'pdf'; }
  } else {
    state.reader.textMode = state.reader.textMode === 'orig' ? 'both' : 'orig';
  }
  renderReaderPage();
}

function readerStep(delta) {
  stopTts();
  const next = state.reader.pageNum + delta;
  if (next < 1 || next > state.reader.totalPages) return showToast(delta < 0 ? '已是第一页' : '已是最后一页');
  state.reader.pageNum = next;
  renderReaderPage();
}
function readerJump(p) { stopTts(); state.reader.pageNum = p; renderReaderPage(); }

function handleReaderTap(e) {
  const sel = window.getSelection ? window.getSelection().toString().trim() : '';
  if (sel.length >= 2) {
    state.reader.selText = sel;
    const matched = HEX_DATA.list.find(h => sel.includes(h.name));
    state.reader.selHexKey = matched ? matched.key : null;
    document.getElementById('selHexBtn').style.display = matched ? 'inline-block' : 'none';
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
  const toc = (book?.toc && book.toc.length) ? book.toc : state.chapters.filter(c => c.bookId === book.id).slice(0, 120).map(c => ({ title: c.title, pageNum: c.pageNum }));
  document.getElementById('readerTocList').innerHTML = toc.map(t => `
    <div style="padding:10px 4px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;cursor:pointer;font-size:13.5px;" onclick="readerJump(${t.pageNum});closeSheet('sheet-toc')">
      <span>${escapeHtml(t.title)}</span><span style="color:var(--text-3);">P.${t.pageNum}</span>
    </div>
  `).join('');
  openSheet('sheet-toc');
}

function applyTypoSettings() {
  const s = state.settings;
  document.getElementById('readerOverlay').setAttribute('data-paper', s.paper || 'warm');
  const st = document.getElementById('readerTextStage');
  st.style.fontSize = (s.fontSize || 16.5) + 'px';
  st.style.lineHeight = s.lineHeight || 1.88;
  const fm = { songhei:'-apple-system,"PingFang SC",sans-serif', song:'"Songti SC",serif', hei:'"PingFang SC",sans-serif', kai:'"Kaiti SC",serif' };
  st.style.fontFamily = fm[s.fontFamily || 'songhei'];
  document.getElementById('typoSizeVal').textContent = s.fontSize || 16.5;
  document.getElementById('typoSizeRange').value = s.fontSize || 16.5;
}
async function updateTypo(k, v) { state.settings[k] = v; applyTypoSettings(); await saveSettingsMeta(); }

// 听书（多语速 + 定时）
function setTtsOpt(k, v) {
  state.tts[k] = v;
  document.getElementById('ttsRateLabel').textContent = state.tts.rate + 'x';
  showToast(k === 'rate' ? `语速 ${v}x` : '已切听书模式');
  if (state.tts.playing) { stopTts(); toggleTtsPlay(); }
}
function setTtsTimer(min) {
  clearTimeout(state.tts.timerId);
  if (min > 0) { state.tts.timerId = setTimeout(() => { stopTts(); showToast('定时已到，停止听书'); }, min * 60000); showToast(`${min} 分钟后自动停止`); }
  else showToast('已取消定时');
}
function toggleTtsPlay() {
  if (!('speechSynthesis' in window)) return showToast('浏览器不支持语音朗读');
  if (state.tts.playing) { stopTts(); return; }
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch) return showToast('本页暂无可朗读文本');
  const orig = (ch.content || '').split(/\n+/).filter(Boolean);
  const mod = (ch.modernText || '').split(/\n+/).filter(Boolean);
  state.tts.queue = (state.tts.mode === 'modern' && mod.length) ? mod : (state.tts.mode === 'both' && mod.length ? orig.flatMap((p,i)=>[p, mod[i]?'白话：'+mod[i]:'']).filter(Boolean) : orig);
  state.tts.qIdx = 0; state.tts.playing = true;
  document.getElementById('ttsPlayBtn').textContent = '暂停朗读';
  speakNextTts();
  closeSheet('sheet-tts');
}
function speakNextTts() {
  if (!state.tts.playing || state.tts.qIdx >= state.tts.queue.length) { stopTts(); return; }
  const u = new SpeechSynthesisUtterance(state.tts.queue[state.tts.qIdx]);
  u.lang = 'zh-CN'; u.rate = state.tts.rate || 1.0;
  u.onend = () => { state.tts.qIdx++; speakNextTts(); };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
function stopTts() {
  state.tts.playing = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const btn = document.getElementById('ttsPlayBtn');
  if (btn) btn.textContent = '开始朗读';
}

function selActionAsk() {
  const txt = state.reader.selText;
  document.getElementById('selPopover').classList.remove('show');
  closeReader(); switchMainTab('canwu'); switchCanwuRoom(state.category);
  document.getElementById('chatInput').value = `精讲这段原书条文的实战用法与成立前提：「${txt}」`;
  sendCanwuMessage();
}
function selActionNote() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  const txt = state.reader.selText;
  document.getElementById('selPopover').classList.remove('show');
  createAndOpenNote({ title: txt.slice(0, 18), body: `${txt}\n\n出处：《${book?.title || ''}》第${state.reader.pageNum}页` });
}
function selActionHex() {
  document.getElementById('selPopover').classList.remove('show');
  if (state.reader.selHexKey) openHexDetail(state.reader.selHexKey);
}

// ==================== 4. 苹果备忘录风格笔记 ====================
let noteSaveTimer = null;

function renderNotesPanel(wrap) {
  const allCat = state.notes.filter(n => n.category === state.category);
  const q = state.noteSearch.trim().toLowerCase();
  const list = allCat
    .filter(n => !q || (n.title + n.body).toLowerCase().includes(q))
    .sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));

  wrap.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" class="form-input" placeholder="搜索「${state.category}笔记」..." value="${escapeHtml(state.noteSearch)}" oninput="state.noteSearch=this.value;renderDivineView()" />
      <button class="btn-primary" style="padding:8px 14px;flex-shrink:0;" onclick="createAndOpenNote()">+ 新建</button>
    </div>
    ${!list.length ? `<div class="empty-box"><p>像苹果备忘录一样随手记下读经感悟、外应灵感或待办清单。</p><button class="btn-secondary" onclick="createAndOpenNote()">写第一篇${state.category}笔记</button></div>` :
    list.map(n => `
      <div class="card" style="cursor:pointer;padding:12px 14px;" onclick="openNoteEditor('${n.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <strong style="font-size:15px;">${n.pinned ? '📌 ' : ''}${escapeHtml(n.title || '无标题备忘')}</strong>
          <span style="font-size:11px;color:var(--text-3);">${formatDateKey(new Date(n.updatedAt || n.createdAt))}</span>
        </div>
        <div class="priv-blur" style="font-size:13px;color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55;">
          ${escapeHtml((n.body || '').replace(/\n/g, ' ')) || '点击进入全屏白纸编辑...'}
        </div>
      </div>
    `).join('')}
  `;
}

async function createAndOpenNote(preset = {}) {
  const note = {
    id: uid('nt'), category: state.category, pinned: false,
    title: preset.title || '', body: preset.body || '',
    createdAt: Date.now(), updatedAt: Date.now()
  };
  await dbPut('notes', note);
  state.notes.push(note);
  await markDirty();
  openNoteEditor(note.id);
}

function openNoteEditor(id) {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  state.editingNoteId = id;
  document.getElementById('noteEditorMeta').textContent = n.category + '笔记 · 自动保存';
  document.getElementById('notePinBtn').className = 'chip ' + (n.pinned ? 'accent' : '');
  document.getElementById('noteTitleField').value = n.title || '';
  document.getElementById('noteBodyArea').value = n.body || '';
  document.getElementById('noteFolderSelect').innerHTML = CATEGORIES.map(c => `<option ${c===n.category?'selected':''}>${c}</option>`).join('');
  openOverlay('noteEditorOverlay');
}

function scheduleNoteAutoSave() {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(saveCurrentNoteNow, 350);
}

async function saveCurrentNoteNow() {
  const n = state.notes.find(x => x.id === state.editingNoteId);
  if (!n) return;
  n.title = document.getElementById('noteTitleField').value.trim();
  n.body = document.getElementById('noteBodyArea').value;
  n.updatedAt = Date.now();
  await dbPut('notes', n);
  await markDirty();
}

async function closeNoteEditor() {
  await saveCurrentNoteNow();
  closeOverlay('noteEditorOverlay');
  renderDivineView();
}
async function toggleCurrentNotePin() {
  const n = state.notes.find(x => x.id === state.editingNoteId);
  if (!n) return;
  n.pinned = !n.pinned; await dbPut('notes', n);
  document.getElementById('notePinBtn').className = 'chip ' + (n.pinned ? 'accent' : '');
}
async function changeCurrentNoteFolder(cat) {
  const n = state.notes.find(x => x.id === state.editingNoteId);
  if (!n) return;
  n.category = cat; await dbPut('notes', n); showToast('已移至「' + cat + '笔记」');
}
async function deleteCurrentNote() {
  if (!confirm('删除这篇笔记？')) return;
  await dbDel('notes', state.editingNoteId);
  state.notes = state.notes.filter(x => x.id !== state.editingNoteId);
  await markDirty();
  closeOverlay('noteEditorOverlay');
  renderDivineView();
}
function noteInsertChecklist() {
  const ta = document.getElementById('noteBodyArea');
  ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + '☐ ';
  ta.focus(); scheduleNoteAutoSave();
}
function noteInsertGanZhi() {
  const info = getAstroDayInfo(new Date());
  const ta = document.getElementById('noteBodyArea');
  ta.value += `\n【${formatDateKey(new Date())} ${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时 空${info.xunkong}】\n`;
  scheduleNoteAutoSave();
}
function noteInsertHexPicker() {
  const name = prompt('输入要插入的卦名（如 地山谦、既济）：');
  if (!name) return;
  const h = HEX_DATA.list.find(x => x.name.includes(name.trim()));
  if (!h) return showToast('未找到该卦名');
  const ta = document.getElementById('noteBodyArea');
  ta.value += `\n【卦象卡：${h.name}（${h.palaceName}·${h.genName}·世${h.shi}应${h.ying}）】\n${h.guaci}\n`;
  scheduleNoteAutoSave();
}

// ==================== 5. 实战档案库（按门类隔离 + 可编辑分组 + 命中率仪表盘 + 八字合盘） ====================
function renderArchivesView() {
  document.getElementById('archHeaderSub').textContent = state.archCategory + '卷宗库';
  document.getElementById('baziCompareBtn').style.display = state.archCategory === '八字' ? 'inline-flex' : 'none';
  document.getElementById('archCatStrip').innerHTML = CATEGORIES.map(c =>
    `<button class="cat-pill ${c===state.archCategory?'active':''}" onclick="state.archCategory='${c}';state.archGroup='全部';renderArchivesView()">${c}</button>`
  ).join('');
  const groups = ['全部', ...(state.settings.groups || [])];
  document.getElementById('archGroupStrip').innerHTML = groups.map(g =>
    `<button class="chip ${g===state.archGroup?'accent':''}" onclick="state.archGroup='${escapeHtml(g)}';renderArchivesView()">${escapeHtml(g)}</button>`
  ).join('');

  const catList = state.archives.filter(a => a.category === state.archCategory).sort((a,b) => (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  const filtered = state.archGroup === '全部' ? catList : catList.filter(a => a.group === state.archGroup);

  // 实战准确率仪表盘
  const verified = catList.filter(a => a.verdict === 'hit' || a.verdict === 'miss');
  const hits = verified.filter(a => a.verdict === 'hit').length;
  const rate = verified.length ? Math.round(hits / verified.length * 100) : 0;

  const wrap = document.getElementById('archivesScrollArea');
  wrap.innerHTML = `
    ${catList.length ? `<div class="card" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:12.5px;color:var(--text-2);">
        共 <strong>${catList.length}</strong> 份卷宗 · 已验证 ${verified.length} 例 ${verified.length ? `· 命中率 <strong style="color:var(--accent);">${rate}%</strong>` : ''}
      </div>
      <span class="chip">${getCultivationRank()}</span>
    </div>` : ''}
    ${!filtered.length ? `<div class="empty-box"><p>「${state.archCategory} · ${state.archGroup}」暂无档案<br/>起卦排盘并保存后，完整盘面、多书 AI 对比报告与复盘都会永久保存在这里。</p></div>` :
    filtered.map(a => `
      <div class="card" style="cursor:pointer;" onclick="openSavedArchive('${a.id}')">
        <div class="card-head" style="margin-bottom:5px;">
          <div class="card-title priv-blur" style="font-size:14.5px;">${escapeHtml(a.title)}</div>
          <span class="chip ${a.verdict==='hit'?'accent':''}">${a.verdict==='hit'?'已应验':(a.verdict==='miss'?'有偏差':'待验证')}</span>
        </div>
        <div style="font-size:12px;color:var(--text-3);display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>${escapeHtml(a.castTimeStr || '')} · 分组：${escapeHtml(a.group || '默认')}</span>
          <span>${a.reports?.length ? a.reports.length + '份AI报告' : ''}</span>
        </div>
        ${a.outcome ? `<div class="priv-blur" style="font-size:12.5px;color:var(--accent);margin-top:4px;">应验：${escapeHtml(a.outcome)}</div>` : ''}
        <div style="display:flex;justify-content:flex-end;margin-top:6px;">
          <button style="font-size:11.5px;color:var(--text-3);" onclick="event.stopPropagation();deleteArchive('${a.id}')">删除卷宗</button>
        </div>
      </div>
    `).join('')}
  `;
}

function openSavedArchive(id) {
  const a = state.archives.find(x => x.id === id);
  if (!a) return;
  if (a.category === '六爻') openLiuyaoResult(a);
  else openGenericResult(a);
}

async function deleteArchive(id) {
  if (!confirm('确定删除这份实战卷宗？')) return;
  await dbDel('archives', id);
  state.archives = state.archives.filter(a => a.id !== id);
  await markDirty();
  renderArchivesView();
}

function openGroupEditor() {
  renderGroupEditorList();
  openSheet('sheet-groups');
}
function renderGroupEditorList() {
  const gs = state.settings.groups || [];
  document.getElementById('groupEditList').innerHTML = gs.map((g, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:14px;">${escapeHtml(g)}</span>
      <div style="display:flex;gap:8px;">
        <button class="chip" onclick="renameArchiveGroup(${i})">改名</button>
        <button class="chip" onclick="removeArchiveGroup(${i})">删</button>
      </div>
    </div>
  `).join('');
}
async function addArchiveGroup() {
  const inp = document.getElementById('newGroupInput');
  const v = inp.value.trim();
  if (!v) return;
  if (!state.settings.groups.includes(v)) state.settings.groups.push(v);
  inp.value = ''; await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView();
}
async function renameArchiveGroup(i) {
  const nv = prompt('修改分组名称：', state.settings.groups[i]);
  if (!nv || !nv.trim()) return;
  const old = state.settings.groups[i];
  state.settings.groups[i] = nv.trim();
  state.archives.forEach(a => { if (a.group === old) { a.group = nv.trim(); dbPut('archives', a); } });
  await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView();
}
async function removeArchiveGroup(i) {
  state.settings.groups.splice(i, 1);
  await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView();
}

// 八字双盘对比 / 合盘
let baziComparePair = ['', ''];
function openBaziCompare() {
  const list = state.archives.filter(a => a.category === '八字');
  if (list.length < 2) return showToast('请先在「八字」里至少保存 2 份命盘档案');
  baziComparePair = [list[0].id, list[1].id];
  renderBaziCompareBody();
  openOverlay('baziCompareOverlay');
}
function renderBaziCompareBody() {
  const list = state.archives.filter(a => a.category === '八字');
  const a1 = list.find(x => x.id === baziComparePair[0]) || list[0];
  const a2 = list.find(x => x.id === baziComparePair[1]) || list[1];
  const renderCol = a => a.data.pillars.map(p => `<span class="wx-${p.swx}" style="font-weight:700;">${p.s}</span><span class="wx-${p.bwx}" style="font-weight:700;">${p.b}</span>`).join(' · ');
  document.getElementById('baziCompareBody').innerHTML = `
    <div class="card">
      <div class="form-field">
        <label class="form-label">命盘甲</label>
        <select class="form-select" onchange="baziComparePair[0]=this.value;renderBaziCompareBody()">
          ${list.map(x => `<option value="${x.id}" ${x.id===a1.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}
        </select>
        <div style="margin-top:6px;font-size:15px;">${renderCol(a1)}</div>
      </div>
      <div class="form-field">
        <label class="form-label">命盘乙</label>
        <select class="form-select" onchange="baziComparePair[1]=this.value;renderBaziCompareBody()">
          ${list.map(x => `<option value="${x.id}" ${x.id===a2.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}
        </select>
        <div style="margin-top:6px;font-size:15px;">${renderCol(a2)}</div>
      </div>
    </div>
    <div id="baziCompareAiBox" class="card" style="font-size:14px;line-height:1.75;color:var(--text-2);">点右上角「AI 合盘」，由参悟结合你的八字书库分析两人五行互补、日柱合冲与相处建议。</div>
  `;
}
async function analyzeBaziCompareWithAI() {
  if (!ensureApiKey()) return;
  const list = state.archives.filter(a => a.category === '八字');
  const a1 = list.find(x => x.id === baziComparePair[0]), a2 = list.find(x => x.id === baziComparePair[1]);
  if (!a1 || !a2) return;
  const g1 = a1.data.pillars.map(p => p.gz).join(' '), g2 = a2.data.pillars.map(p => p.gz).join(' ');
  const box = document.getElementById('baziCompareAiBox');
  box.textContent = '参悟正在深度合盘推演...';
  try {
    const res = await callLLM([{ role:'user', content:`请用 1. 2. 3. 4. 编号清单（重点用【】标注，严禁星号）分析以下两个八字的合盘互补、日支关系、事业合作或感情相处契合度与磨合建议：\n命盘甲（${a1.gender}）：${g1}\n命盘乙（${a2.gender}）：${g2}` }]);
    box.innerHTML = formatRichText(res);
  } catch (e) { box.textContent = '合盘失败：' + e.message; }
}

// ==================== 6. 断法宝典（双栏级联）+ 六十四卦 + 百宝箱与观星任意门 ====================
const METHODS_DICT = {
  '基础知识': [
    { name:'天干五合', content:'甲己合化土、乙庚合化金、丙辛合化水、丁壬合化木、戊癸合化火。\n\n【实战要点】合中有绊，有合化与合而不化之分；六爻与八字中均须视月建旺衰及临近引化之气而定。' },
    { name:'地支六冲', content:'子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲。\n\n【六爻要诀】旺相静爻逢日冲为【暗动】，休囚静爻逢日冲为【日破】；月建冲爻为【月破】，出月不破或逢日合为合起。' },
    { name:'地支六合', content:'子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土。\n\n【实战要点】静爻逢合谓之合起，动爻逢合谓之合绊；待冲开之日应事。' },
    { name:'地支三合局', content:'申子辰合水局、亥卯未合木局、寅午戌合火局、巳酉丑合金局。\n\n【成局前提】六爻中一卦三爻俱动、两动一变、或二动配日月皆可论局；中神（子午卯酉）最重，缺一待填补之日成事。' },
    { name:'十二长生', content:'阳顺阴逆（木长生在亥、火长生在寅、金长生在巳、水土长生在申）。\n\n【增删要义】六爻实战重长生、帝旺、墓库、绝地四处，余者作为细节辅参即可。' },
    { name:'月破铁律', content:'1. 爻临月破，当下无力生克他爻。\n2. 若得日辰生扶、临日建、或发动化回头生、化进神，则非真破，出月或逢合填实即有用。\n3. 若休囚无助又被日克、化退化破，则为彻底真破。' },
    { name:'旬空真假', content:'1. 旺相之空、动而之空、有日辰动爻生扶之空为【假空】，出空或冲空之日应事。\n2. 休囚无气、伏藏受克、化破化绝之空为【真空】，到底无成。\n3. 动不为空，冲空则实。' }
  ],
  '六十甲子': Array.from({length: 60}, (_, i) => {
    const gz = STEMS[i % 10] + BRANCHES[i % 12];
    const nayin30 = ['海中金','炉中火','大林木','路旁土','剑锋金','山头火','涧下水','城头土','白蜡金','杨柳木','泉中水','屋上土','霹雳火','松柏木','长流水','沙中金','山下火','平地木','壁上土','金箔金','覆灯火','天河水','大驿土','钗钏金','桑柘木','大溪水','沙中土','天上火','石榴木','大海水'];
    const ny = nayin30[Math.floor(i / 2)];
    const k1 = (i % 12 - i % 10 + 22) % 12;
    return {
      name: gz + '日',
      content: `【${gz}日柱精览】\n1. 纳音五行：${ny}\n2. 天干五行：${STEMS[i%10]}（${STEM_WX[i%10]}） · 坐支：${BRANCHES[i%12]}（${BRANCH_WX[i%12]}，藏干：${HIDDEN_STEMS[BRANCHES[i%12]]}）\n3. 本旬空亡：${BRANCHES[k1]}${BRANCHES[(k1+1)%12]}\n4. 日支冲合：冲${LIU_CHONG[BRANCHES[i%12]]} · 合${LIU_HE[BRANCHES[i%12]]}\n\n点下方「让参悟深讲此日柱」，可结合你的八字与六爻书库展开详论。`
    };
  }),
  '六爻实战': [
    { name:'复合动爻简化', content:'多爻同动切忌眼花缭乱：\n1. 先剔除化回头克、化绝、化破且无救应的【无用动爻】。\n2. 余下有用动爻看其是否连环相生或组成三合局，最终合力指向世爻或用神。\n3. 区分【吉凶层面】与【细节层面】，勿将细节象意混入成败定性。' },
    { name:'化进神与退神', content:'进神：亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌、戌化丑（趋旺递增之象）。\n退神：子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未、丑化戌（衰减退缩之象）。' },
    { name:'飞神与伏神', content:'用神不上卦而伏藏于本宫首卦之下。\n【出伏条件】伏神得日月生扶、飞神生伏神、飞神受冲克或空破、或冲开飞神之日，伏神方能引拔而出。' },
    { name:'六神类象', content:'青龙：喜庆、正财、文雅、新开始。\n朱雀：口舌、文书、信息、沟通。\n勾陈：田土、滞留、熟人、固执。\n螣蛇：惊疑、怪异、缠绕、虚惊。\n白虎：刚猛、血光、急迫、权柄。\n玄武：隐秘、暗昧、谋划、水象。' }
  ],
  '八字奇门': [
    { name:'十神心性', content:'正官：秩序、责任、名声。\n七杀：魄力、压力、决断。\n正印：学识、护佑、宽厚。\n偏印：直觉、玄学、独辟蹊径。\n食神：温和、享受、才华。\n伤官：锐气、创新、突破常规。\n比劫：独立、竞争、人脉。\n正偏财：务实、资源掌控与变现力。' },
    { name:'奇门八门象意', content:'开门：事业、公开、启动（吉）。\n休门：休养、贵人、和合（吉）。\n生门：财运、利润、房产（吉）。\n伤门：竞争、车辆、损伤。\n杜门：隐藏、技术、阻隔。\n景门：文书、计划、血光火电。\n死门：停滞、地产、固守。\n惊门：口舌、担忧、官司。' }
  ]
};

const DEFAULT_STAR_PORTALS = [
  { name:'中国古代星官虚拟星图', url:'https://stellarium-web.org/', desc:'实时夜空与星官观测（支持切换中国传统星官文化）' },
  { name:'Stellarium Web 在线天文馆', url:'https://stellarium-web.org/', desc:'免登录高清实时星图，查日月五星与二十八宿落点' },
  { name:'In-The-Sky 实时天象历', url:'https://in-the-sky.org/', desc:'查行星逆行、合冲、月相盈亏与每日天象事件' },
  { name:'香港太空馆 · 星夜行资料', url:'https://hk.space.museum/tc/web/spm/resources/star-map.html', desc:'权威三垣二十八宿中文星图参考' }
];

function switchMethodsSub(sub) {
  state.methodsSub = sub;
  const idx = ['dict','hex','tools'].indexOf(sub);
  document.getElementById('methodsSlider').style.transform = `translateX(${idx * 100}%)`;
  document.querySelectorAll('#view-methods .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.msub === sub));
  renderMethodsView();
}

function renderMethodsView() {
  const wrap = document.getElementById('methodsScrollArea');
  if (state.methodsSub === 'dict') {
    const groups = Object.keys(METHODS_DICT);
    const items = METHODS_DICT[state.dictGroup] || [];
    const cur = items[state.dictItemIdx] || items[0];
    wrap.innerHTML = `
      <div class="cat-strip" style="padding:0 0 10px;">
        ${groups.map(g => `<button class="cat-pill ${g===state.dictGroup?'active':''}" onclick="state.dictGroup='${g}';state.dictItemIdx=0;renderMethodsView()">${g}</button>`).join('')}
      </div>
      <div class="dict-layout">
        <div class="dict-left">
          ${items.map((it, idx) => `<div class="dict-nav-item ${idx===state.dictItemIdx?'active':''}" onclick="state.dictItemIdx=${idx};renderMethodsView()">${escapeHtml(it.name)}</div>`).join('')}
        </div>
        <div class="dict-right">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:16px;">${escapeHtml(cur.name)}</strong>
            <button class="chip" onclick="saveDictToNote()">存笔记</button>
          </div>
          <div style="font-size:14px;line-height:1.78;white-space:pre-wrap;color:var(--text);">${formatRichText(cur.content)}</div>
          <button class="btn-secondary" style="width:100%;margin-top:16px;" onclick="askCanwuDictItem()">让参悟结合书库深讲「${escapeHtml(cur.name)}」</button>
        </div>
      </div>
    `;
  } else if (state.methodsSub === 'hex') {
    let items = [...HEX_DATA.list];
    if (state.hexSearch.trim()) {
      const q = state.hexSearch.trim();
      items = items.filter(h => h.name.includes(q) || h.palaceName.includes(q) || h.guaci.includes(q));
    }
    if (state.hexSort === 'seq') items.sort((a,b) => a.seq - b.seq);
    else if (state.hexPalaceFilter !== 'all') items = items.filter(h => h.palaceName === state.hexPalaceFilter);

    wrap.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input type="text" class="form-input" placeholder="搜卦名、八宫或卦辞..." value="${escapeHtml(state.hexSearch)}" oninput="state.hexSearch=this.value;renderMethodsView()" />
        <button class="chip ${state.hexSort==='palace'?'accent':''}" onclick="state.hexSort=state.hexSort==='palace'?'seq':'palace';renderMethodsView()">${state.hexSort==='palace'?'八宫序':'周易序'}</button>
      </div>
      ${state.hexSort==='palace' ? `<div class="cat-strip" style="padding:0 0 10px;">
        <button class="cat-pill ${state.hexPalaceFilter==='all'?'active':''}" onclick="state.hexPalaceFilter='all';renderMethodsView()">全部</button>
        ${PALACE_ORDER.map(p => { const pn = TRIGRAMS[p].name + '宫'; return `<button class="cat-pill ${state.hexPalaceFilter===pn?'active':''}" onclick="state.hexPalaceFilter='${pn}';renderMethodsView()">${pn}</button>`; }).join('')}
      </div>` : ''}
      <div class="hex-mini-grid">
        ${items.map(h => `
          <div class="hex-card-item" onclick="openHexDetail('${h.key}')">
            <div class="hex-mini-lines">${[5,4,3,2,1,0].map(i=>`<div class="yao-bar ${h.bits[i]?'yang':'yin'}"></div>`).join('')}</div>
            <div style="min-width:0;">
              <div style="font-size:13.5px;font-weight:700;">${h.name}</div>
              <div style="font-size:10.5px;color:var(--text-3);">${h.palaceName}·${h.genName}·第${h.seq}卦</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    const portals = [...DEFAULT_STAR_PORTALS, ...(state.settings.customPortals || [])];
    wrap.innerHTML = `
      <div class="card">
        <div class="card-head">
          <span class="card-title">观星与外部术数任意门</span>
          <button class="chip accent" onclick="openSheet('sheet-add-portal')">+ 自定义链接</button>
        </div>
        ${portals.map((p, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:600;">${escapeHtml(p.name)}</div>
              <div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">${escapeHtml(p.desc || p.url)}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="chip accent" style="text-decoration:none;">直达 ↗</a>
              ${idx >= DEFAULT_STAR_PORTALS.length ? `<button class="chip" onclick="deleteCustomPortal(${idx - DEFAULT_STAR_PORTALS.length})">删</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">康熙笔画 & 汉字数理速算（梅花测字）</div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="strokeWordInput" class="form-input" placeholder="输入汉字测数理与对应卦象" />
          <button class="btn-primary" style="flex-shrink:0;" onclick="calcWordGua()">测算</button>
        </div>
        <div id="strokeWordResult" style="margin-top:8px;font-size:13px;color:var(--text-2);"></div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">快捷工具跳转</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          <button class="btn-secondary" onclick="switchMainTab('divine');switchCategory('风水');switchSubTab('cast')">风水罗盘 & 九宫飞星</button>
          <button class="btn-secondary" onclick="openBaziCompare()">双人八字合盘</button>
          <button class="btn-secondary" onclick="openAskJi()">每日摇签 & 解梦</button>
          <button class="btn-secondary" onclick="openMindMap()">藏往思想星图</button>
        </div>
      </div>
    `;
  }
}

function saveDictToNote() {
  const cur = (METHODS_DICT[state.dictGroup] || [])[state.dictItemIdx];
  if (cur) createAndOpenNote({ title: cur.name, body: cur.content });
}
function askCanwuDictItem() {
  const cur = (METHODS_DICT[state.dictGroup] || [])[state.dictItemIdx];
  if (!cur) return;
  switchMainTab('canwu');
  document.getElementById('chatInput').value = `结合我上传的书库，帮我把「${cur.name}」在实战里的核心用法、成立前提与反例彻底讲透。`;
  sendCanwuMessage();
}
async function saveCustomPortal() {
  const name = document.getElementById('portalNameInput').value.trim();
  const url = document.getElementById('portalUrlInput').value.trim();
  const desc = document.getElementById('portalDescInput').value.trim();
  if (!name || !url) return showToast('请填写名称和网址');
  state.settings.customPortals.push({ name, url, desc });
  await saveSettingsMeta();
  closeSheet('sheet-add-portal');
  renderMethodsView();
  showToast('已添加外部传送门');
}
async function deleteCustomPortal(i) {
  state.settings.customPortals.splice(i, 1);
  await saveSettingsMeta(); renderMethodsView();
}
function calcWordGua() {
  const w = (document.getElementById('strokeWordInput').value || '').trim();
  if (!w) return;
  const codes = Array.from(w).map(ch => ch.charCodeAt(0));
  const sum = codes.reduce((a,b) => a + b, 0);
  const up = NUM_TO_TRI[codes[0] % 8], low = NUM_TO_TRI[codes[codes.length - 1] % 8];
  const h = HEX_DATA.byKey[up + '_' + low];
  document.getElementById('strokeWordResult').innerHTML = `字数：${w.length} · 感应主卦：<strong>${h.name}</strong>（${h.palaceName} · 动在第${(sum%6)||6}爻） <button class="chip accent" onclick="openHexDetail('${h.key}')">查详情</button>`;
}

// 六十四卦全典详情
async function openHexDetail(key) {
  state.currentHexKey = key;
  state.hexMovingSet = new Set();
  await renderHexDetail();
  openOverlay('hexDetailOverlay');
}
async function renderHexDetail() {
  const hex = HEX_DATA.byKey[state.currentHexKey];
  if (!hex) return;
  const info = getAstroDayInfo(new Date());
  const exam = runLiuyaoPhysicalExam(hex, state.hexMovingSet, info.month.b, info.day.b, info.xunkong);
  const cached = await dbGet('hexCache', hex.key);
  document.getElementById('hexDetailTitle').textContent = hex.name;
  document.getElementById('hexDetailBody').innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">${hex.name}（第 ${hex.seq} 卦 · ${hex.palaceName}${hex.genName}）</div>
          <div style="font-size:12px;color:var(--text-2);">世在${hex.shi}爻 · 应在${hex.ying}爻 · 今日旬空：${info.xunkong}</div>
        </div>
      </div>
      ${[5,4,3,2,1,0].map(i => {
        const r = exam.examRows[i];
        return `<div class="ly-row" onclick="toggleHexDetailMov(${r.pos})">
          <span>${r.liuqin}</span>
          <span class="wx-${r.wx}" style="font-weight:700;">${r.branch}${r.wx}${info.xunkong.includes(r.branch)?'(空)':''}</span>
          <div><span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span>${r.isShi?'世':(r.isYing?'应':'')}</div>
          <span style="color:var(--accent);font-weight:700;">${r.isMov?(r.bit?'○':'×'):'静'}</span>
          <span style="font-size:11px;color:var(--text-3);">${r.bian ? '→'+r.bian.branch+r.bian.wx : (r.fushen?'伏'+r.fushen.label:'')}</span>
        </div>`;
      }).join('')}
      ${exam.bianHex ? `<div style="margin-top:8px;font-size:12.5px;color:var(--accent);font-weight:600;">动变出：${exam.bianHex.name}</div>` : ''}
    </div>
    <div class="card"><div class="card-title" style="margin-bottom:6px;">原典卦辞</div><div style="font-size:14px;line-height:1.7;">${escapeHtml(hex.guaci)}</div></div>
    <div class="card">
      <div class="card-head">
        <span class="card-title">参悟深度白话详解</span>
        <button class="chip accent" onclick="generateHexDeepAI('${hex.key}')">${cached ? '重生成' : 'AI生成并缓存'}</button>
      </div>
      <div style="font-size:14px;line-height:1.75;">${cached ? formatRichText(cached.text) : '<span style="color:var(--text-3);font-size:13px;">点右上角生成一次即永久本地缓存秒开。</span>'}</div>
    </div>
  `;
}
function toggleHexDetailMov(pos) {
  if (state.hexMovingSet.has(pos)) state.hexMovingSet.delete(pos);
  else state.hexMovingSet.add(pos);
  renderHexDetail();
}
function askCanwuAboutHex() {
  const hex = HEX_DATA.byKey[state.currentHexKey];
  closeOverlay('hexDetailOverlay');
  switchMainTab('canwu'); switchCanwuRoom('六爻');
  document.getElementById('chatInput').value = `结合我的书库精讲「${hex.name}」的实战断法、世应关系与关键取象。`;
  sendCanwuMessage();
}

// ==================== 7. 全局秒搜 ====================
function openGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('globalSearchResults').innerHTML = '<div class="empty-box"><p>输入任意关键词（如：月破、进神、开单、既济）<br/>瞬间打通书架原书、苹果风笔记、实战档案与断法字典。</p></div>';
  openOverlay('globalSearchOverlay');
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 200);
}

function runGlobalSearch(q) {
  const k = (q || '').trim();
  const wrap = document.getElementById('globalSearchResults');
  if (k.length < 1) return;
  const bookHits = state.chapters.filter(c => (c.content || '').includes(k)).slice(0, 8);
  const noteHits = state.notes.filter(n => (n.title + n.body).includes(k)).slice(0, 6);
  const archHits = state.archives.filter(a => (a.title + (a.note||'') + (a.outcome||'')).includes(k)).slice(0, 6);
  const dictHits = [];
  Object.entries(METHODS_DICT).forEach(([g, arr]) => arr.forEach((it, idx) => {
    if ((it.name + it.content).includes(k)) dictHits.push({ g, idx, it });
  }));

  let html = '';
  if (bookHits.length) {
    html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">原书命中（${bookHits.length}）</div>${bookHits.map(c => {
      const b = state.books.find(x => x.id === c.bookId);
      const pos = c.content.indexOf(k);
      const snippet = c.content.slice(Math.max(0, pos - 24), pos + 65);
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openReader('${c.bookId}',${c.pageNum})">
        <div style="font-size:13px;font-weight:600;color:var(--accent);">《${escapeHtml(b?.title||'')}》第${c.pageNum}页</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px;">...${escapeHtml(snippet)}...</div>
      </div>`;
    }).join('')}</div>`;
  }
  if (archHits.length) {
    html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">实战档案命中（${archHits.length}）</div>${archHits.map(a => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openSavedArchive('${a.id}')">
        <div style="font-size:13.5px;font-weight:600;">[${a.category}] ${escapeHtml(a.title)}</div>
      </div>
    `).join('')}</div>`;
  }
  if (noteHits.length) {
    html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">笔记命中（${noteHits.length}）</div>${noteHits.map(n => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openNoteEditor('${n.id}')">
        <div style="font-size:13.5px;font-weight:600;">[${n.category}] ${escapeHtml(n.title || '无标题')}</div>
      </div>
    `).join('')}</div>`;
  }
  if (dictHits.length) {
    html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">断法字典命中（${dictHits.length}）</div>${dictHits.slice(0,6).map(d => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');switchMainTab('methods');switchMethodsSub('dict');state.dictGroup='${d.g}';state.dictItemIdx=${d.idx};renderMethodsView()">
        <div style="font-size:13.5px;font-weight:600;">${escapeHtml(d.it.name)}</div>
      </div>
    `).join('')}</div>`;
  }
  wrap.innerHTML = html || '<div class="empty-box"><p>未检索到匹配结果</p></div>';
}
