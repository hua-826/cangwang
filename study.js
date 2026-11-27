// ==================== 藏往 V9 · 书房精译、深度知识库与实战练习 (study.js) ====================
const COVER_PALETTES = [
  'linear-gradient(155deg,#2B3330,#181C1A)',
  'linear-gradient(155deg,#334743,#1B2825)',
  'linear-gradient(155deg,#47392E,#281F18)',
  'linear-gradient(155deg,#2B3B4E,#16202C)',
  'linear-gradient(155deg,#4A333B,#281A1F)'
];

function cleanBookText(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([^\n。！？；：”’）】])\n(?=[\u4e00-\u9fa5])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ==================== 1. 书房：随手译一段 + 我的书架 ====================
function renderLibraryView() {
  const wrap = document.getElementById('libraryScrollArea');
  const filterCats = ['全部', '六爻', '八字', '奇门', '梅花', '其他'];
  const filteredBooks = state.books.filter(b => {
    if (state.libFilter === '全部') return true;
    if (state.libFilter === '其他') return EXTRA_CATS.includes(b.category);
    return b.category === state.libFilter;
  }).sort((a,b) => (b.lastReadAt||0) - (a.lastReadAt||0) || b.createdAt - a.createdAt);

  const bookOpts = `<option value="">通用术数理法</option>` +
    `<option value="《增删卜易》六爻流派" ${state.quickTransBook==='《增删卜易》六爻流派'?'selected':''}>按《增删卜易》风格</option>` +
    `<option value="《古筮真诠》六爻流派" ${state.quickTransBook==='《古筮真诠》六爻流派'?'selected':''}>按《古筮真诠》风格</option>` +
    state.books.map(b => `<option value="《${escapeHtml(b.title)}》(${b.category})" ${state.quickTransBook===`《${b.title}》(${b.category})`?'selected':''}>结合书架《${escapeHtml(b.title)}》</option>`).join('');

  wrap.innerHTML = `
    <div class="card">
      <div class="card-head" style="margin-bottom:8px;">
        <span class="card-title">随手译古文（术数专精白话）</span>
        <select class="form-select" style="width:auto;padding:4px 8px;font-size:12.5px;max-width:155px;" onchange="state.quickTransBook=this.value">${bookOpts}</select>
      </div>
      <textarea class="form-textarea" style="min-height:78px;" placeholder="粘贴任意一段看不懂的古文、卦例或命理口诀，保留原汁原味专业术语，直接译成通透大白话 + 一句实战点破..." oninput="state.quickTransInput=this.value">${escapeHtml(state.quickTransInput)}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-primary" style="flex:1;padding:11px;" id="quickTransBtn" onclick="runQuickTranslate()">立即精译成大白话</button>
        ${state.quickTransInput ? `<button class="btn-secondary" onclick="state.quickTransInput='';state.quickTransOut='';renderLibraryView()">清空</button>` : ''}
      </div>
      ${state.quickTransOut ? `
        <div style="margin-top:14px;padding:14px 15px;border-radius:16px;background:var(--bg);font-size:15px;line-height:1.82;">
          ${formatRichText(state.quickTransOut)}
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="chip" onclick="saveQuickTransToNote()">存为笔记</button>
            <button class="chip accent" onclick="askCanwuQuickTrans()">继续追问参悟</button>
          </div>
        </div>
      ` : ''}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px;">
      <span style="font-family:'Songti SC',serif;font-size:17px;font-weight:700;">我的书架（${state.books.length}）</span>
      <span style="font-size:12px;color:var(--text-3);">点开支持纯白话 / 古今对照</span>
    </div>
    <div class="cat-strip" style="padding:0 0 12px;">
      ${filterCats.map(c => `<button class="cat-pill ${state.libFilter===c?'active':''}" onclick="state.libFilter='${c}';renderLibraryView()">${c}</button>`).join('')}
    </div>
    ${!filteredBooks.length ? `
      <div class="card empty-box">
        <p>书架目前为空<br/>点右上角「+ 上传新书」导入《增删卜易》《古筮真诠》等 PDF 或 TXT<br/>不仅能一键纯白话精读，还能直接喂给知识库和参悟对照分析</p>
        <button class="btn-primary" onclick="openSheet('sheet-import')">上传第一本古籍</button>
      </div>
    ` : `<div class="books-grid">${filteredBooks.map((b, i) => {
      const bg = COVER_PALETTES[(b.coverIdx ?? i) % COVER_PALETTES.length];
      const total = Math.max(1, b.totalPages || state.chapters.filter(c => c.bookId === b.id).length);
      const cur = b.lastPageNum || 1;
      return `<div class="book-item" onclick="openReader('${b.id}')">
        <div class="book-cover" style="background:${bg};">
          <div class="book-cover-title">${escapeHtml(b.title)}</div>
          <div class="book-cover-foot"><span>${escapeHtml(b.category)}</span><span>${total}页</span></div>
        </div>
        <div class="book-meta">
          <div style="min-width:0;flex:1;">
            <div class="book-name">${escapeHtml(b.title)}</div>
            <div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">已读 ${Math.min(100,Math.round(cur/total*100))}%</div>
          </div>
          <button style="padding:2px 6px;color:var(--text-3);font-size:16px;" onclick="event.stopPropagation();openBookEditSheet('${b.id}')">⋮</button>
        </div>
      </div>`;
    }).join('')}</div>`}
  `;
}

async function runQuickTranslate() {
  if (!ensureApiKey()) return;
  const txt = (state.quickTransInput || '').trim();
  if (!txt) return showToast('请先粘贴需要翻译的古文');
  const btn = document.getElementById('quickTransBtn');
  if (btn) { btn.disabled = true; btn.textContent = '正在按术数理法精译...'; }
  const ctxHint = state.quickTransBook ? `请严格结合${state.quickTransBook}的体系与原意来翻译。` : '';
  try {
    const prompt = `你是精通传统术数的古籍白话精译专家。${ctxHint}
请把下面这段古文翻译成流畅易懂的现代白话文，必须遵守三条死规矩：
1. 专业术语绝不乱直译（如世爻、用神、月破、旬空、暗动、回头克、化进神、官鬼、十神、值符等必须原样保留），只把文言句式与深层逻辑翻成自然大白话。
2. 先输出【白话精译】，再在最后空一行输出【实战白话点破】（用 2 到 3 句大白话直接点透作者想教给读者的核心断法，绝不讲废话）。
3. 严禁使用星号符号。

原文：
${txt.slice(0, 3200)}`;
    const out = await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' });
    state.quickTransOut = out.replace(/\*/g, '').trim();
    renderLibraryView();
  } catch (e) { showToast('翻译失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '立即精译成大白话'; } }
}
function saveQuickTransToNote() { createAndOpenNote({ title: '古文精译 · ' + state.quickTransInput.slice(0, 12), body: `【原文】\n${state.quickTransInput}\n\n${state.quickTransOut}` }); }
function askCanwuQuickTrans() { switchMainTab('canwu'); document.getElementById('chatInput').value = `刚译了这段古文，帮我再举个实战例子讲透：\n${state.quickTransInput.slice(0, 300)}`; sendCanwuMessage(); }

function openBookEditSheet(id) {
  const b = state.books.find(x => x.id === id); if (!b) return;
  document.getElementById('bookEditPanel').innerHTML = `<div class="sheet-handle"></div><h3 style="margin:0 0 12px;font-size:17px;">管理典籍</h3><div class="form-field"><label class="form-label">书名</label><input type="text" id="editBookName" class="form-input" value="${escapeHtml(b.title)}" /></div><div class="form-field"><label class="form-label">门类</label><select id="editBookCat" class="form-select">${CATEGORIES.map(c => `<option ${b.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div style="display:flex;gap:8px;"><button class="btn-primary" style="flex:1;" onclick="saveBookEdit('${b.id}')">保存</button><button class="btn-secondary" style="color:var(--seal);" onclick="deleteBookConfirm('${b.id}')">删除</button></div>`;
  openSheet('sheet-book-edit');
}
async function saveBookEdit(id) { const b = state.books.find(x => x.id === id); if (!b) return; b.title = document.getElementById('editBookName').value.trim() || b.title; b.category = document.getElementById('editBookCat').value; await dbPut('books', b); await markDirty(); closeSheet('sheet-book-edit'); renderLibraryView(); showToast('已保存'); }
async function deleteBookConfirm(id) { const b = state.books.find(x => x.id === id); if (!b || !confirm(`删除《${b.title}》？`)) return; await dbDel('books', id); await dbDel('pdfBlobs', id); for (const c of state.chapters.filter(c => c.bookId === id)) await dbDel('chapters', c.id); state.books = state.books.filter(x => x.id !== id); state.chapters = state.chapters.filter(c => c.bookId !== id); await markDirty(); closeSheet('sheet-book-edit'); renderLibraryView(); }

function loadPdfJs() { if (window.pdfjsLib) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(); }; s.onerror = rej; document.head.appendChild(s); }); }
async function handleBookFileSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const title = file.name.replace(/\.(pdf|txt|md)$/i, ''), cat = document.getElementById('importCatSelect')?.value || state.category;
  if (/\.pdf$/i.test(file.name)) {
    showToast('正在导入 PDF 并自动洗版提取文字...');
    try {
      await loadPdfJs(); const buf = await file.arrayBuffer(), pdf = await window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise, bookId = uid('bk');
      await dbPut('pdfBlobs', { id: bookId, data: buf });
      const book = { id: bookId, title, category: cat, hasPdf: true, totalPages: pdf.numPages, lastPageNum: 1, toc: [], coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0 };
      await dbPut('books', book); state.books.push(book);
      for (let p = 1; p <= Math.min(pdf.numPages, 500); p++) {
        const page = await pdf.getPage(p), tc = await page.getTextContent();
        const rawTxt = tc.items.map(it => it.str).join(' ').replace(/\s{2,}/g, '\n');
        const ch = { id: uid('ch'), bookId, idx: p - 1, pageNum: p, title: `第 ${p} 页`, content: cleanBookText(rawTxt), modernText: '', insightText: '' };
        await dbPut('chapters', ch); state.chapters.push(ch);
      }
      await markDirty(); closeSheet('sheet-import'); renderLibraryView(); showToast(`《${title}》已存入书房`);
    } catch (err) { showToast('PDF 导入失败：' + err.message); }
  } else await importPlainTextBook(title, await file.text(), cat);
  e.target.value = '';
}
async function importPlainTextBook(title, rawText, cat) {
  const clean = cleanBookText(rawText);
  const re = /(?:^|\n)\s*((?:第[零一二三四五六七八九十百千0-9]+[章节卷篇回]|卷[零一二三四五六七八九十0-9]+)\s*[^\n]{0,34})(?=\n)/g;
  const hits = []; let m; while ((m = re.exec(clean)) !== null) hits.push({ title: m[1].trim(), index: m.index });
  const parts = [];
  if (hits.length >= 2) {
    if (hits[0].index > 80) parts.push({ title: '卷首 / 序言', content: clean.slice(0, hits[0].index).trim() });
    for (let i = 0; i < hits.length; i++) parts.push({ title: hits[i].title, content: clean.slice(hits[i].index, i + 1 < hits.length ? hits[i+1].index : clean.length).trim() });
  } else { for (let i = 0; i < clean.length; i += 2000) parts.push({ title: `第 ${parts.length + 1} 节`, content: clean.slice(i, i + 2000).trim() }); }
  const bookId = uid('bk');
  const book = { id: bookId, title: title || '自录典籍', category: cat || state.category, hasPdf: false, totalPages: parts.length, lastPageNum: 1, toc: parts.map((p,i)=>({title:p.title,pageNum:i+1})), coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0 };
  await dbPut('books', book); state.books.push(book);
  for (let i = 0; i < parts.length; i++) { const ch = { id: uid('ch'), bookId, idx: i, pageNum: i + 1, title: parts[i].title, content: parts[i].content, modernText: '', insightText: '' }; await dbPut('chapters', ch); state.chapters.push(ch); }
  await markDirty(); closeSheet('sheet-import'); renderLibraryView(); showToast(`已导入《${book.title}》`);
}
async function importPastedBook() { const t = document.getElementById('pasteBookTitle').value.trim(), c = document.getElementById('pasteBookContent').value.trim(), cat = document.getElementById('importCatSelect')?.value || state.category; if (!c) return showToast('请粘贴内容'); await importPlainTextBook(t || '自录典籍', c, cat); document.getElementById('pasteBookTitle').value = ''; document.getElementById('pasteBookContent').value = ''; }

// ==================== 2. 微信读书级三态精读阅读器 ====================
async function openReader(bookId, pageNum) {
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  state.reader.bookId = bookId; state.reader.totalPages = Math.max(1, book.totalPages || state.chapters.filter(c => c.bookId === bookId).length);
  state.reader.pageNum = typeof pageNum === 'number' ? Math.max(1, Math.min(state.reader.totalPages, pageNum)) : (book.lastPageNum || 1);
  state.reader.pdfMode = false; state.reader.readMode = 'orig'; state.reader.activeParaText = '';
  document.getElementById('readerPdfToggleBtn').style.display = book.hasPdf ? 'inline-flex' : 'none';
  applyTypoSettings(); openOverlay('readerOverlay'); markStudyFootprint();
  if (book.hasPdf) {
    try { await loadPdfJs(); const blobRec = await dbGet('pdfBlobs', bookId); if (blobRec?.data) state.reader.pdfDoc = await window.pdfjsLib.getDocument({ data: blobRec.data.slice(0) }).promise; } catch (e) {}
  }
  await renderReaderPage();
}
function closeReader() { closeOverlay('readerOverlay'); document.getElementById('selPopover').classList.remove('show'); if (state.mainTab === 'library') renderLibraryView(); }

async function translateChapterObj(book, ch, force = false) {
  if (!ch || !ch.content?.trim()) return;
  if (!force && ch.modernText?.trim()) return;
  const origParas = ch.content.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const prompt = `你是精通《${book.title}》（${book.category}）的古籍精译专家。
请将下面共 ${origParas.length} 段原文逐段翻译为自然流畅、通俗易懂的现代白话文。
铁律：
1. 必须保留原汁原味的专业术数术语（如世爻、用神、月破、旬空、暗动、化进退神、回头克等），只把文言句式和逻辑翻成大白话。
2. 译文必须严格保持 ${origParas.length} 段，每段一行，用 ||| 分隔各段，不要加编号。
3. 在全部译文最后加上标记 ###点破### ，接着用 2 句大白话点破本页最核心的实战断法。
4. 严禁使用任何星号符号。

原文：
${origParas.map((p, i) => `[${i+1}] ${p}`).join('\n')}`;
  const raw = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
  const [bodyPart, insightPart] = raw.split('###点破###');
  const translated = (bodyPart || raw).split('|||').map(s => s.replace(/^\[\d+\]\s*/, '').trim()).filter(Boolean);
  ch.modernText = translated.join('\n');
  ch.insightText = (insightPart || '').trim();
  await dbPut('chapters', ch);
}

async function setReaderReadMode(mode) {
  state.reader.readMode = mode;
  document.querySelectorAll('#readerModePill button').forEach(b => b.classList.toggle('active', b.dataset.rm === mode));
  if (mode !== 'orig') {
    state.reader.pdfMode = false;
    const book = state.books.find(b => b.id === state.reader.bookId);
    const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
    if (ch && ch.content?.trim() && !ch.modernText?.trim()) {
      if (!ensureApiKey()) { state.reader.readMode = 'orig'; return renderReaderPage(); }
      document.getElementById('readerTextStage').innerHTML = `<div class="empty-box"><p>正在结合《${escapeHtml(book?.title||'')}》原意精译本页...<br/>译完即永久缓存，下次秒开不重复花钱</p></div>`;
      try { await translateChapterObj(book, ch, false); } catch (e) { showToast('翻译失败：' + e.message); state.reader.readMode = 'orig'; }
    }
  }
  await renderReaderPage();
}
async function retranslateCurrentPage() {
  if (!ensureApiKey()) return;
  const book = state.books.find(b => b.id === state.reader.bookId);
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch) return;
  state.reader.pdfMode = false; if (state.reader.readMode === 'orig') state.reader.readMode = 'both';
  document.getElementById('readerTextStage').innerHTML = `<div class="empty-box"><p>正在重新精译本页...</p></div>`;
  try { await translateChapterObj(book, ch, true); await renderReaderPage(); showToast('已重新精译'); } catch (e) { showToast('失败：' + e.message); }
}
function toggleReaderPdfMode() { state.reader.pdfMode = !state.reader.pdfMode; renderReaderPage(); }

async function renderReaderPage() {
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  const pNum = state.reader.pageNum; book.lastPageNum = pNum; book.lastReadAt = Date.now(); await dbPut('books', book);
  document.getElementById('readerBookTitle').textContent = book.title;
  const ch = state.chapters.find(c => c.bookId === book.id && (c.pageNum === pNum || c.idx === pNum - 1));
  document.getElementById('readerFootLeft').textContent = ch ? ch.title : `第 ${pNum} 页`;
  document.getElementById('readerFootRight').textContent = `${pNum} / ${state.reader.totalPages}`;
  const rng = document.getElementById('readerRange'); rng.min = 1; rng.max = state.reader.totalPages; rng.value = pNum;
  document.getElementById('readerRangeText').textContent = `${pNum}/${state.reader.totalPages}`;
  document.querySelectorAll('#readerModePill button').forEach(b => b.classList.toggle('active', b.dataset.rm === state.reader.readMode));

  const pdfStage = document.getElementById('readerPdfStage'), txtStage = document.getElementById('readerTextStage');
  if (state.reader.pdfMode && state.reader.pdfDoc) {
    pdfStage.style.display = 'block'; txtStage.style.display = 'none';
    const page = await state.reader.pdfDoc.getPage(pNum), canvas = document.getElementById('pdfCanvas'), ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1.5, 2.2), targetW = Math.min(window.innerWidth - 48, 512);
    const vp = page.getViewport({ scale: (targetW / page.getViewport({ scale: 1 }).width) * dpr });
    canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = targetW + 'px'; canvas.style.height = (vp.height / dpr) + 'px';
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    document.getElementById('pdfPageHint').textContent = `原版 PDF · 点顶部「纯白话 / 古今对照」切白话精读`;
  } else {
    pdfStage.style.display = 'none'; txtStage.style.display = 'block';
    const orig = (ch?.content || '本页暂无文本（若为纯扫描图片 PDF 请点右上角「原PDF」查看）').split(/\n+/).map(s => s.trim()).filter(Boolean);
    const mod = (ch?.modernText || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    let html = `<h3 style="margin:0 0 18px;text-align:center;font-family:'Songti SC',serif;font-size:1.18em;">${escapeHtml(ch?.title || '第 ' + pNum + ' 页')}</h3>`;
    if (state.reader.readMode === 'modern' && mod.length) {
      html += mod.map((p, i) => `<p class="reader-para" onclick="tapReaderPara(event, ${i}, 'modern')">${escapeHtml(p)}</p>`).join('');
    } else if (state.reader.readMode === 'both' && mod.length) {
      html += orig.map((p, i) => `<p class="reader-para orig-sub" onclick="tapReaderPara(event, ${i}, 'orig')">${escapeHtml(p)}</p>${mod[i] ? `<div class="reader-modern-block" onclick="tapReaderPara(event, ${i}, 'orig')">${escapeHtml(mod[i])}</div>` : ''}`).join('');
    } else {
      html += orig.map((p, i) => `<p class="reader-para" onclick="tapReaderPara(event, ${i}, 'orig')">${escapeHtml(p)}</p>`).join('');
    }
    if (state.reader.readMode !== 'orig' && ch?.insightText) {
      html += `<div class="reader-insight-box"><strong>【本页实战点破】</strong><br/>${escapeHtml(ch.insightText)}</div>`;
    }
    html += `<div style="text-align:center;font-size:12px;color:var(--r-muted);margin-top:8px;">轻点任意段落可「换更通俗讲法」或「就这段问参悟」</div>`;
    txtStage.innerHTML = html;
  }
  document.getElementById('readerContentWrap').scrollTop = 0;
}

function tapReaderPara(e, idx, kind) {
  e.stopPropagation();
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch) return;
  const arr = (kind === 'modern' ? ch.modernText : ch.content).split(/\n+/).map(s => s.trim()).filter(Boolean);
  state.reader.activeParaText = arr[idx] || '';
  document.querySelectorAll('#readerTextStage .active-tap').forEach(el => el.classList.remove('active-tap'));
  e.currentTarget.classList.add('active-tap');
  document.getElementById('selPopover').classList.add('show');
}
async function paraActionSimple() {
  const txt = state.reader.activeParaText; if (!txt || !ensureApiKey()) return;
  document.getElementById('selPopover').classList.remove('show');
  document.getElementById('tagTipTitle').textContent = '大白话拆解这一段';
  document.getElementById('tagTipBody').textContent = '正在用最通俗的例子为你拆解...';
  state.activeTagTipKey = txt.slice(0, 30);
  openSheet('sheet-tag-tip');
  try {
    const out = await callLLM([{ role: 'user', content: `请用最接地气的大白话，举一个生活里的实战小例子，帮我彻底看懂这段术数条文的意思（严禁星号）：\n${txt}` }], { tier: 'flash' });
    document.getElementById('tagTipBody').innerHTML = formatRichText(out);
  } catch (e) { document.getElementById('tagTipBody').textContent = '拆解失败：' + e.message; }
}
function paraActionAsk() {
  const txt = state.reader.activeParaText; document.getElementById('selPopover').classList.remove('show');
  const b = state.books.find(x => x.id === state.reader.bookId);
  closeReader(); switchMainTab('canwu'); switchCanwuRoom(b?.category || state.category);
  document.getElementById('chatInput').value = `精讲《${b?.title||''}》里这一段，告诉我实战怎么用：\n「${txt}」`; sendCanwuMessage();
}
function paraActionNote() {
  const b = state.books.find(x => x.id === state.reader.bookId);
  document.getElementById('selPopover').classList.remove('show');
  createAndOpenNote({ title: state.reader.activeParaText.slice(0, 16), body: `${state.reader.activeParaText}\n\n出处：《${b?.title||''}》第${state.reader.pageNum}页` });
}

function readerStep(d) { const n = state.reader.pageNum + d; if (n < 1 || n > state.reader.totalPages) return showToast(d < 0 ? '已是第一页' : '已是最后一页'); state.reader.pageNum = n; if (state.reader.readMode !== 'orig') setReaderReadMode(state.reader.readMode); else renderReaderPage(); }
function readerJump(p) { state.reader.pageNum = p; if (state.reader.readMode !== 'orig') setReaderReadMode(state.reader.readMode); else renderReaderPage(); }
function handleReaderTap(e) {
  document.getElementById('selPopover').classList.remove('show');
  if (e.target.closest('button')) return;
  state.reader.barsHidden = !state.reader.barsHidden;
  document.getElementById('readerOverlay').classList.toggle('bars-hidden', state.reader.barsHidden);
}
function openReaderToc() { const book = state.books.find(b => b.id === state.reader.bookId), toc = book?.toc?.length ? book.toc : state.chapters.filter(c => c.bookId === book.id).slice(0, 120).map(c => ({ title: c.title, pageNum: c.pageNum })); document.getElementById('readerTocList').innerHTML = toc.map(t => `<div style="padding:11px 4px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;cursor:pointer;font-size:14.5px;" onclick="readerJump(${t.pageNum});closeSheet('sheet-toc')"><span>${escapeHtml(t.title)}</span><span style="color:var(--text-3);">P.${t.pageNum}</span></div>`).join(''); openSheet('sheet-toc'); }
function applyTypoSettings() {
  const s = state.settings;
  document.getElementById('readerOverlay').setAttribute('data-paper', s.paper || 'warm');
  const st = document.getElementById('readerTextStage');
  st.style.fontSize = (s.fontSize || 17.5) + 'px';
  st.style.lineHeight = 1.92;
  st.style.fontFamily = (s.fontFam === 'sans') ? '-apple-system,"PingFang SC",sans-serif' : '"Songti SC","STSong","Noto Serif SC",Georgia,serif';
  document.getElementById('typoSizeVal').textContent = s.fontSize || 17.5;
  document.getElementById('typoSizeRange').value = s.fontSize || 17.5;
}
async function updateTypo(k, v) { state.settings[k] = v; applyTypoSettings(); await saveSettingsMeta(); }

// ==================== 3. 研习：满屏深度知识库 + 多书典籍出处切换 ====================
const BASE_STUDY_KB = {
  '六爻基础': [
    {
      id: 'ly_b1', title: '五行生克与反常边界', level: '基础', source: '通用底蕴 · 增删卜易',
      summary: '不止背木生火，核心在搞懂「木多火塞、火炎土燥」以及六爻与八字的应用边界。',
      content: `【一、底层气机】\n五行不是五种死物质，而是能量的五种运动态：木主生发舒展，火主炎上扩散，土主承载转化，金主肃杀收敛，水主润下潜藏。\n\n【二、实战判据与反常（最易踩坑）】\n1. 相生并非一律为吉：木太旺而火极弱叫「木多火塞」（湿柴压灭小火苗）；土太厚而金极微叫「土重埋金」；水太泛而木无根叫「水多木漂」。\n2. 燥土不生金：未土、戌土在夏月带火气，见金反主脆克；湿土（辰、丑）则晦火生金。\n3. 当令定真假：在六爻中，生克力量由【月建、日辰、动爻】三级决定；休囚无气的静爻，连生克他爻的资格都没有。\n\n【三、六爻 vs 八字的应用边界】\n六爻重「当令与动变」，只要动爻旺相生用神即主得助；八字重「寒暖调候与全局流通」，同一组木火，生在冬月是救命暖局，生在夏月却是焦枯大忌。`
    },
    {
      id: 'ly_b2', title: '月建与日辰的权限铁律', level: '基础', source: '增删卜易 · 四时旺相章',
      summary: '月建管当月兴衰与提纲，日辰管六爻冲合与长久生克，两者权限绝不能混为一谈。',
      content: `【一、底层气机】\n月建是「当季大环境」（提纲），决定卦中六爻的基本盘是旺相还是休囚；日辰是「当下主宰者」，拥有全天候生克冲合的最高执行权。\n\n【二、实战判据】\n1. 月建冲爻为【月破】：在当月内如朽木，暂失生克权；但若得日辰生扶、临日辰、日辰合起，或自身发动化回头生/化进神，属「破而有救」，出月填实即应。\n2. 日辰冲爻分两种：冲旺相静爻叫【暗动】（如明动一般立刻产生生克作用）；冲休囚静爻叫【日破】（彻底散气无用）。\n3. 动爻逢日合为【合绊】（短期被拉住动弹不得），静爻逢日合为【合起】（被唤醒增强）。\n\n【三、常见误区与反例】\n误区：以为月克日生就一定扯平。反例：《增删卜易》明言，若用神被月克却得日辰生扶，属于「克处逢生」，只要没有忌神发动雪上加霜，反而主先难后成。`
    },
    {
      id: 'ly_b3', title: '旬空真假与避空秘诀', level: '基础', source: '增删卜易 · 旬空章',
      summary: '旺相之空与动而之空不是真没戏，只是「时间未到」；忌神落空反而是保命符。',
      content: `【一、底层气机】\n十天干配十二地支，每旬必有两位地支轮空。旬空代表「当下还没落地、暂时不在场、心里没底」，绝不能见空就断失败。\n\n【二、实战判据】\n1. 【假空（必应事）】：旺相之空、发动之空、得日辰或动爻生扶之空。这类空亡只管应期，出空、填实、冲空之日就会兑现。\n2. 【真空（到底空）】：月破之空、休囚无气又受克之空、伏藏受克之空。这种才是真落空。\n3. 【动不为空，冲空则实】：发动的爻本来就不按真空论；若静爻旬空被日辰或动爻一冲，当下就被冲实起效。\n\n【三、常见误区与反例】\n【避空救命】：很多新手看到空亡就紧张。实际上如果是「忌神」发动来克用神，但用神刚好旬空（或忌神自己动化空），反而是用神躲进防空洞避开了伤害，短期平安无事。`
    },
    {
      id: 'ly_b4', title: '取用神与世爻兼看总诀', level: '基础', source: '增删卜易 · 用神章',
      summary: '用神定事情本身好不好，世爻定「你能不能拿到手」，只看一边必断反。',
      content: `【一、底层气机】\n世爻永远代表求测者自己，用神代表你想求的事物。断卦的本质就是看「事情本身成不成」以及「事情和你有没有缘分」。\n\n【二、实战判据】\n1. 核心取用：求财利润看【妻财】；合同中标、考试证书、房产车辆看【父母】；求职升迁、官司上司看【官鬼】；治病解忧、客户财源看【子孙】；竞争同行、合伙分利看【兄弟】。\n2. 世用关系铁律：用神旺相但克世，或者世爻休囚受克、化回头克，主「机会虽好，但我没实力接住，或拿到手反成拖累」。\n3. 忌神持世测求财（如兄弟持世）：并不一定破财，若子孙发动化财生世，反主靠自己操心跑动把钱挣回来。\n\n【三、常见误区与反例】\n测考试考公，很多人只盯着官鬼看；其实拿证、过笔试、签录用通知的第一用神是【父母】，官鬼只是职位本身，二者缺一不可。`
    }
  ],
  '六爻进阶': [
    {
      id: 'ly_a1', title: '多爻齐动与复合动爻简化', level: '进阶', source: '古筮真诠 · 动变核心',
      summary: '一卦三四个动爻眼花缭乱？用「剔除废爻 → 找连环相生 → 定主线」三步一秒拆解。',
      content: `【一、底层气机】\n野鹤老人说「神兆机于动」，多爻齐动看似杂乱，其实里面夹杂了大量「自顾不暇的无效动爻」和「串联能量的桥梁爻」。\n\n【二、实战三步简化法】\n1. 第一步【剔除无用动爻】：凡是动而化回头克、化绝、化破且无日月救应的动爻，自己都被打废了，根本没力气去生克别的爻，先从吉凶主线里剔出去（只留作细节象意）。\n2. 第二步【抓连环相生（通关）】：比如兄弟动本该克财，但若子孙也同时发动，就构成「兄动生子 → 子动生财」，坏事瞬间变好事，忌神反成原神的助推器。\n3. 第三步【看三合局】：两动一变、三爻齐动构成三合局时，优先按合局后的大五行力量论生克，力量远大于单个散爻。\n\n【三、常见误区与反例】\n严分「吉凶层」与「细节层」：回头克的废爻虽然不影响最终成败，但它在细节上依然暴露了「中途有某一方先放弃或内部出损」的真实过程。`
    },
    {
      id: 'ly_a2', title: '化进神、化退神与反吟伏吟', level: '进阶', source: '增删卜易 · 进退神章',
      summary: '动爻变出的方向决定了事情是越走越宽还是虎头蛇尾，忌神化退反而是大喜。',
      content: `【一、底层气机】\n变爻是动爻的未来趋势。化进神代表顺时生长、越做越大；化退神代表盛极而衰、主动退缩。\n\n【二、实战判据】\n1. 【化进神】：亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌、戌化丑。用神化进，纵使当下稍弱，未来也会步步走强。\n2. 【化退神】：子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未、丑化戌。测求财感情遇用神化退，多主对方热情降温、预算缩水或半路撤回；但测官司疾病遇官鬼化退，则是灾退病愈的大吉。\n3. 【反吟与伏吟】：卦变反吟（六爻全冲）主反复折腾、去而复返；卦变伏吟（地支不变）主内心纠结、项目卡死停滞，必待冲动之日破局。\n\n【三、常见误区与反例】\n「进神不进」的条件：如果化进神刚好碰到月破或日破，或者变爻旬空受克，当下推不动，必须等到补齐缺口的应期才会启动。`
    },
    {
      id: 'ly_a3', title: '飞伏神出伏六法与应期铁律', level: '进阶', source: '增删卜易 · 飞伏与应期',
      summary: '用神不上卦藏在伏神里怎么看？以及断准哪天出结果的 5 条实操应期铁律。',
      content: `【一、伏神出伏六大条件】\n用神藏在本宫首卦下叫伏神，盖在上面的是飞神。伏神想出来应事，须占以下至少一条：1.伏神得日月生扶；2.伏神旺相；3.飞神生伏神；4.动爻生伏神；5.日月动爻冲克压住它的飞神；6.飞神自己空破休囚墓绝。\n\n【二、应期定日五条铁律】\n1. 用神安静：逢冲动之日、或逢值之日应。\n2. 用神发动：逢合住之日（动而逢合）、或逢值之日应。\n3. 用神旬空：出空、填实、冲空之日应。\n4. 用神入墓：冲开墓库之日应。\n5. 忌神拦路：克制忌神之日，或通关爻出现之日应。\n\n【三、实战心法】\n先定远近（看所测之事本身周期是几天、几个月还是几年），再把对应的地支套进最近的时间窗口，绝不拿着测明天下雨的卦去断明年。`
    }
  ],
  '八字基础': [
    {
      id: 'bz_b1', title: '月令格局与寒暖调候', level: '基础', source: '滴天髓 · 穷通宝鉴',
      summary: '看八字千万别一上来就数五个金三个木算强弱，先看月令气候与格局成败才是正道。',
      content: `【一、底层气机】\n月令是八字的「天气与土壤」。同样一颗甲木，生在腊月冰天雪地最怕水冷金寒、急需丙火暖局；生在盛夏酷暑最怕火炎土燥、急需癸水润根。\n\n【二、实战判据】\n1. 先辨调候：冬生（亥子丑月）重火暖，夏生（巳午未月）重水润，这叫「调候为急」。\n2. 再定月令格局：看月支藏干透出什么十神（正官、七杀、正印、食神、财星等），判断全局是「顺用护格」（财官印食宜生护）还是「逆用制化」（杀伤劫刃宜制化）。\n3. 干支同看：天干主外在表现与名声，地支主真实根基与落袋为安；天干虚浮无根的财官，多主雷声大雨点小。\n\n【三、常见误区与反例】\n最常见错误是「缺啥补啥」（以为八字缺水就一定喜水）。如果命局本来就是冬月寒湿之局，再补水反而雪上加霜。`
    },
    {
      id: 'bz_b2', title: '十神心性与真实象意', level: '基础', source: '子平真诠 · 实战心法',
      summary: '跳出「正官就是好、七杀就是坏」的刻板印象，读懂十神在现代职场和感情里的真实投射。',
      content: `【一、底层气机】\n十神本质是日主与其他五行的五种互动关系，分阴阳顺逆，没有绝对的好坏，全看搭配有没有制化。\n\n【二、现代实战象意】\n1. 正官 vs 七杀：正官是规则、体面、稳步晋升；七杀是高压、野心、危机感与破局魄力（有食神制杀或印星化杀，反成大权贵）。\n2. 食神 vs 伤官：食神是温和才华、审美与稳定输出；伤官是锋芒、反骨、颠覆创新与极强表达欲（最忌无制直接撞正官）。\n3. 正财 vs 偏财：正财是务实积累、工资与可控资产；偏财是风口、资源整合、大方豪爽与大起大落。\n4. 正印 vs 偏印：正印是贵人护佑、学历与安全感；偏印是冷门直觉、深度钻研、边界感强（最忌偏印旺去夺食神）。`
    }
  ],
  '八字进阶': [
    {
      id: 'bz_a1', title: '地支刑冲合害实战优先级', level: '进阶', source: '滴天髓 · 盲派理法',
      summary: '八字里同时出现三合、六合、六冲、相穿，到底谁先起作用？理清这套作用顺序。',
      content: `【一、底层气机】\n地支之间的作用就像人际与利益博弈：合主牵绊合作，冲主碰撞变动，穿（害）主暗中破坏与内耗。\n\n【二、实战优先级】\n1. 紧贴力量最大，隔位减半，遥隔极弱。\n2. 【冲能解合，合能解冲】：原局本来有合，大运流年逢冲则冲散合作；原局有冲，逢合则暂时缓和。\n3. 【相穿（六害）破坏力极隐蔽】：尤其子未穿、丑午穿、寅巳穿、卯辰穿、酉戌穿，在婚姻宫或财官位出现时，往往主看似正常却突然生隙或暗中受损。\n4. 【墓库论开合】：辰戌丑未四库，库里藏着财官时，不冲不开，逢冲或逢刑反而是打开金库爆发的契机。`
    },
    {
      id: 'bz_a2', title: '大运流年引动铁律', level: '进阶', source: '命理实战总诀',
      summary: '原局是车，大运是路，流年是红绿灯：教你看懂「哪一年真正出事、应在哪件事」。',
      content: `【一、底层气机】\n原局决定你能跑多快，大运决定这十年走高速还是走泥路，流年则是具体触发事件的开关。\n\n【二、实战判据】\n1. 【原局没有的，大运流年难凭空造大局】：发大财或动大婚，往往是流年把原局里本来就有的财星、夫妻宫给「引动、合出或冲开」。\n2. 【伏吟与反吟】：流年干支与原局某柱相同叫伏吟（反复、停滞或双份变动），天克地冲叫反吟（剧烈变动、换城市/换赛道/情感转折）。\n3. 【岁运并临】：大运与流年干支完全相同，不一定是凶，核心看这个干支是喜神还是忌神——喜神并临反主一步登天。`
    }
  ],
  '奇门梅花': [
    {
      id: 'qm_1', title: '奇门三奇六仪与八门格局', level: '进阶', source: '奇门遁甲统宗',
      summary: '抓准用神落宫后，按「八门看事态、九星看大势、八神看暗力、天干看细节」四层读盘。',
      content: `【一、读盘四层骨架】\n1. 【八门（人事核心）】：开（启动事业）、休（贵人休整）、生（利润增长）为三吉门；伤（竞争损耗）、杜（隐藏技术）、景（方案文书）、死（停滞地产）、惊（口舌惊疑）。\n2. 【九星（天时大势）】：天心（谋略医药）、天辅（教育文书）、天任（稳健）偏吉；天芮主问题与病灶，天蓬主冒险破财。\n3. 【四害警示】：门迫（门克宫，力不从心）、击刑（天干六仪落刑宫，别扭受损）、入墓（能量被锁）、空亡（当下落空或玄机暗藏）。\n\n【二、实战顺序】\n先看日干（求测人）与时干（所测之事）落宫的五行生克，再结合求测人年命落宫定最终落点。`
    },
    {
      id: 'mh_1', title: '梅花易数体用生克与外应', level: '基础', source: '梅花易数原典',
      summary: '一念起卦，体卦是我、用卦是事，互卦看经过、变卦看结局，辅以月令旺衰定成败。',
      content: `【一、核心骨架】\n1. 动爻所在半卦为【用卦】，静的那半卦为【体卦】。\n2. 【五种关系】：用生体（进益得助大吉）、体用比和（顺遂协作吉）、体克用（费力但可成）、体生用（耗泄破财）、用克体（受阻受损凶）。\n3. 【切忌只看本卦】：本卦看开端，互卦看中间波折，变卦才是最终归宿；若本卦体克用但变卦反克体，必主虎头蛇尾。\n\n【二、结合月令】\n梅花极重季节旺衰，哪怕用克体，若体卦当令极旺（如春木体遇秋金克，但在春月木旺金囚），克不动反而不凶。`
    }
  ]
};

function getMergedStudyKB() {
  const merged = JSON.parse(JSON.stringify(BASE_STUDY_KB));
  (state.customDict || []).forEach(it => {
    const g = it.group || '自扩专题';
    if (!merged[g]) merged[g] = [];
    merged[g].unshift({ id: it.id, title: it.name, level: '自扩', source: 'AI 专题编撰', summary: (it.content || '').replace(/\n+/g, ' ').slice(0, 56) + '...', content: it.content });
  });
  return merged;
}

function switchStudySub(sub) {
  state.studySub = sub;
  document.getElementById('studySlider').style.transform = `translateX(${sub === 'kb' ? 0 : 100}%)`;
  document.querySelectorAll('#view-study .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.ssub === sub));
  renderStudyView();
}

function renderStudyView() {
  const wrap = document.getElementById('studyScrollArea');
  if (state.studySub === 'kb') {
    const kb = getMergedStudyKB(), groups = Object.keys(kb);
    if (!kb[state.studyGroup]) state.studyGroup = groups[0];
    const list = kb[state.studyGroup] || [];
    wrap.innerHTML = `
      <div class="cat-strip" style="padding:0 0 12px;">
        ${groups.map(g => `<button class="cat-pill ${g===state.studyGroup?'active':''}" onclick="state.studyGroup='${g}';renderStudyView()">${g}</button>`).join('')}
      </div>
      ${list.map((art, idx) => `
        <div class="study-card" onclick="openArticleOverlay('${state.studyGroup}', ${idx})">
          <div class="study-card-top">
            <span class="study-card-title">${escapeHtml(art.title)}</span>
            <span class="pill-mini ${art.level==='进阶'?'seal':'accent'}" style="padding:3px 9px;font-size:11.5px;">${escapeHtml(art.level||'精讲')}</span>
          </div>
          <div class="study-card-sub">${escapeHtml(art.summary)}</div>
          <div class="study-card-foot">
            <span>出处：${escapeHtml(art.source || '经典理法')}</span>
            <span style="color:var(--accent);font-weight:600;">全屏精读 ›</span>
          </div>
        </div>
      `).join('')}
    `;
  } else {
    renderPracticeHub(wrap);
  }
}

function openArticleOverlay(group, idx) {
  const art = (getMergedStudyKB()[group] || [])[idx]; if (!art) return;
  state.activeArticle = { ...art, group };
  state.activeArticleSource = '通用精讲';
  renderArticleOverlay();
  openOverlay('articleOverlay');
  markStudyFootprint();
}

function renderArticleOverlay() {
  const art = state.activeArticle; if (!art) return;
  document.getElementById('articleOverlayTitle').textContent = art.title;
  const userBooks = state.books.map(b => `《${b.title}》`);
  const sources = Array.from(new Set(['通用精讲', '《增删卜易》', '《古筮真诠》', ...userBooks]));
  const cacheKey = `${art.id}_${state.activeArticleSource}`;
  const cachedView = state.settings.articleSourceCache?.[cacheKey];
  const bodyContent = state.activeArticleSource === '通用精讲' ? art.content : (cachedView || '');

  document.getElementById('articleOverlayBody').innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="font-family:'Songti SC',serif;font-size:23px;font-weight:700;line-height:1.35;">${escapeHtml(art.title)}</div>
      <div style="font-size:12.5px;color:var(--text-3);margin-top:6px;">点下方典籍切换不同流派与你书房原书的论点对比：</div>
      <div class="cat-strip" style="padding:8px 0 4px;">
        ${sources.map(s => `<button class="chip ${state.activeArticleSource===s?'accent':''}" onclick="switchArticleSource('${escapeHtml(s)}')">${escapeHtml(s)}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:20px 18px;font-size:15.5px;line-height:1.9;">
      ${bodyContent ? formatRichText(bodyContent) : `<div class="empty-box" style="padding:28px 10px;"><p>点击下方按钮，立刻从 ${escapeHtml(state.activeArticleSource)} 中提取关于「${escapeHtml(art.title)}」的原书观点与差异对比（生成一次永久缓存）</p><button class="btn-primary" id="fetchSrcBtn" onclick="fetchArticleSourceView()">提取 ${escapeHtml(state.activeArticleSource)} 观点</button></div>`}
    </div>
    <div style="display:flex;gap:10px;margin-top:4px;">
      <button class="btn-secondary" style="flex:1;" onclick="askCanwuAboutArticle()">就这篇问参悟</button>
      <button class="btn-secondary" style="flex:1;" onclick="closeOverlay('articleOverlay');switchMainTab('study');switchStudySub('practice')">去刷实战题</button>
    </div>
  `;
}
function switchArticleSource(src) {
  state.activeArticleSource = src;
  renderArticleOverlay();
  const cacheKey = `${state.activeArticle.id}_${src}`;
  if (src !== '通用精讲' && !state.settings.articleSourceCache?.[cacheKey]) fetchArticleSourceView();
}
async function fetchArticleSourceView() {
  if (!ensureApiKey()) return;
  const art = state.activeArticle, src = state.activeArticleSource; if (!art || src === '通用精讲') return;
  const btn = document.getElementById('fetchSrcBtn'); if (btn) { btn.disabled = true; btn.textContent = '正在检索原书观点...'; }
  const cleanName = src.replace(/[《》]/g, '');
  const matchedBook = state.books.find(b => b.title === cleanName || b.title.includes(cleanName));
  const bookExcerpt = matchedBook ? retrieveFromSelectedBooks([matchedBook.id], art.title + ' ' + art.summary) : '';
  try {
    const prompt = `请你立足 ${src} 的流派观点，专门拆解「${art.title}」。
要求：
1. 输出【${src}核心主张】、【与通用/其他流派的分歧点】、【一句实操口诀】。
2. 全程说透大白话，严禁星号符号。
${bookExcerpt ? '\n用户书房上传的原书摘录（请优先引用并标注页码）：\n' + bookExcerpt : ''}`;
    const out = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
    if (!state.settings.articleSourceCache) state.settings.articleSourceCache = {};
    state.settings.articleSourceCache[`${art.id}_${src}`] = out;
    await saveSettingsMeta();
    renderArticleOverlay();
  } catch (e) { showToast('提取失败：' + e.message); if (btn) { btn.disabled = false; btn.textContent = '重试提取'; } }
}
function saveActiveArticleToNote() {
  const art = state.activeArticle; if (!art) return;
  const cacheKey = `${art.id}_${state.activeArticleSource}`;
  const content = state.activeArticleSource === '通用精讲' ? art.content : (state.settings.articleSourceCache?.[cacheKey] || art.content);
  createAndOpenNote({ title: `${art.title}（${state.activeArticleSource}）`, body: content });
}
function askCanwuAboutArticle() {
  const art = state.activeArticle; if (!art) return;
  closeOverlay('articleOverlay'); switchMainTab('canwu');
  document.getElementById('chatInput').value = `结合我的书库，把「${art.title}」里最容易断反的坑举个例子讲透。`; sendCanwuMessage();
}

async function generateAndSaveDictTopic() {
  if (!ensureApiKey()) return;
  const grp = document.getElementById('aiDictGroupSelect').value, topic = document.getElementById('aiDictTopicInput').value.trim();
  if (!topic) return showToast('请输入想深挖的专题');
  const btn = document.getElementById('aiDictGenBtn'); btn.disabled = true; btn.textContent = '正在编撰三层深度干货...';
  try {
    const content = (await callLLM([{ role:'user', content:`请为私人术数研习库编写一篇有深度、不浮于表面的硬核专题：「${topic}」。必须按【一、底层气机】【二、实战判据】【三、常见误区与反例】三段写透，全程用精准通俗的白话，严禁使用星号符号。` }])).replace(/\*/g, '').trim();
    state.customDict.push({ id: uid('dct'), group: grp, name: topic, content, createdAt: Date.now() });
    await dbPut('meta', { id: 'customDict', data: state.customDict });
    await markDirty();
    document.getElementById('aiDictTopicInput').value = '';
    closeSheet('sheet-ai-dict'); state.studyGroup = grp; switchStudySub('kb'); showToast(`已将「${topic}」永久写入知识库`);
  } catch (e) { showToast('生成失败：' + e.message); }
  finally { btn.disabled = false; btn.textContent = '生成三层干货并永久存入'; }
}

// ==================== 4. 实战练习：碎片闪卡 / 古例盲断 / 断语挑刺 ====================
const BASE_FLASHCARDS = [
  { tag:'月破', q:'寅月戌日测求财，卦中妻财申金静爻被寅月冲破，但得戌日相生。这叫真破还是破而有救？', a:'【破而有救】申金虽在寅月月破，但得日辰戌土生扶，属于「日生救破」。当下寅月暂未成事，出月或逢申日填实、巳日合起即可成。' },
  { tag:'暗动', q:'卯月午日，卦中父母子水在卯月休囚，被午日相冲。这叫「暗动」还是「日破」？', a:'【日破】子水在卯月既不当令又不得月生（休囚无气），被日辰午火冲克叫日破，散气无用；只有旺相的静爻被日冲才叫暗动。' },
  { tag:'旬空', q:'辰月甲子日（戌亥空），测合作，妻财亥水发动来生世爻。亥水旬空是不是代表没钱赚？', a:'【不是，为假空】动不为空，发动之爻只是当下还没落袋，等到出空、填实（亥日）或冲空（巳日）之时便会兑现。' },
  { tag:'化退神', q:'测讨债或谈客户预算，妻财卯木发动化寅木，这代表什么现实信号？', a:'【化退神】卯化寅主力量衰退、金额缩水、对方态度变冷或准备砍价撤回，需提前做好防备。' },
  { tag:'避空', q:'测官司或防小人，忌神官鬼发动来克世爻，但世爻刚好旬空，短期凶不凶？', a:'【短期不凶，叫避空】世爻旬空相当于暂时躲开锋芒，忌神打空了；但要注意出空之日若忌神仍在，仍需防范。' },
  { tag:'回头克', q:'测项目合作，妻财寅木在寅月极其旺相，但发动变出申金。还能成吗？', a:'【极难成，主虎头蛇尾】寅木动化申金既是回头克又是反吟冲，属于自身变坏。哪怕当下寅月看着红火，后期极易突然崩盘或内讧散伙。' },
  { tag:'伏神', q:'用神不上卦藏在伏神里，但飞神刚好旬空且被日辰冲克。伏神能出来吗？', a:'【能顺利出伏】压在头顶的飞神自己空破受克，再也压不住伏神了，用神得以冲破而出。' },
  { tag:'八字调候', q:'冬月（子月）生人，八字里五行缺水，是不是必须去补水？', a:'【千万别瞎补】子月天寒地冻水气极旺，哪怕天干不见壬癸水也绝非真缺水；此时调候急需丙丁火暖局，乱补水反而越补越寒。' },
  { tag:'奇门四害', q:'奇门排盘时，用神落宫出现「门迫」（如伤门落坤二宫），实战怎么翻译成大白话？', a:'【力不从心、内耗受阻】门克宫叫门迫，好比有冲劲却踩进泥潭里施展不开，事情推进极其别扭费劲。' },
  { tag:'连环相生', q:'测求财，兄弟爻发动（本该克财），但同时子孙爻也发动了，最终是破财还是得财？', a:'【反主得财】这叫「贪生忘克 / 连环通关」：兄弟动去生子孙，子孙动去生妻财，竞争与开销反而转化成了源源不断的客源与利润。' }
];

const BLIND_CASES = [
  {
    id:'bc1', source:'《增删卜易》经典例改编', question:'某人占「合伙做生意能否获利？」',
    monthGz:'卯月', dayGz:'戊辰日', xunkong:'戌亥', mainKey:'0_7', moving:[3],
    answerYs:'妻财', answerVerdict:'成',
    masterText:'地天泰变地泽临。世爻辰土临日辰旺相，三爻兄弟辰土虽动，却化出丑土退神，且卦中子孙申金得日辰生扶、暗藏财源。原书断：虽中途有合伙人退缩或口舌分歧，但根基稳固，终可得财。'
  },
  {
    id:'bc2', source:'《增删卜易》经典例改编', question:'某人占「托人求职能否录用？」',
    monthGz:'申月', dayGz:'甲午日', xunkong:'辰巳', mainKey:'7_0', moving:[5],
    answerYs:'官鬼', answerVerdict:'败',
    masterText:'天地否变火地晋。五爻兄弟申金临月建旺动，却变出未土回头生（实则官鬼午火虽临日辰，但父母未土动变回头克或世爻受泄、忌神得势）。最关键是看用神与世爻是否相呼应，若动变相悖则雷声大雨点小，录用难成。'
  },
  {
    id:'bc3', source:'实战模拟案例', question:'女占「这段感情后续能稳定发展吗？」',
    monthGz:'巳月', dayGz:'壬子日', xunkong:'寅卯', mainKey:'3_4', moving:[2],
    answerYs:'官鬼', answerVerdict:'反复',
    masterText:'泽山咸变泽风大过。二爻官鬼午火在巳月旺相，但被子日冲克，又动化亥水回头克。前期火热推进快，但动化回头克主男方后期态度明显退却或外部阻力介入，感情极易陷入反复拉扯。'
  }
];

const FLAW_CASES = [
  {
    tag:'旬空误区',
    statement:'「卯月甲子日（戌亥空）测求财，卦中妻财亥水发动，且得日辰子水比扶。断曰：妻财落入旬空，财星已空，此单生意必无所获，劝君早日放弃。」',
    trap:'错误在于「见空就断无」。亥水发动且得日辰比扶，属于典型的【假空（动不为空、旺不为空）】，非但不是没戏，反而是出空、填实（亥日）或冲空（巳日）就会落袋得财。'
  },
  {
    tag:'暗动与日破混淆',
    statement:'「午月子日测求职，官鬼午火静爻临月建旺相，被日辰子水相冲。断曰：官鬼被日辰冲破，名位受损，此次面试必遭淘汰。」',
    trap:'把【暗动】错当成了【日破】。官鬼午火临午月极旺，旺相静爻逢日冲叫暗动，不仅没被冲破，反而代表暗中已有动静、很快收到面试或录用消息。'
  },
  {
    tag:'化退神误判',
    statement:'「测一场烦人的官司纠纷何时平息，官鬼申金发动化出未土，又另一动爻官鬼卯木化寅木。断曰：官鬼化退神，主不吉，官司必输。」',
    trap:'搞反了用神喜忌！测官司、疾病、灾祸时，官鬼是【忌神】（代表麻烦与压力）。忌神化退神代表麻烦自动消退、对手撤诉和解，是大吉之象。'
  }
];

async function recordWeakSpot(tag) {
  if (!tag) return;
  if (!Array.isArray(state.settings.weakSpots)) state.settings.weakSpots = [];
  const exist = state.settings.weakSpots.find(w => w.tag === tag);
  if (exist) { exist.count = (exist.count || 1) + 1; exist.updatedAt = Date.now(); }
  else state.settings.weakSpots.push({ tag, count: 1, updatedAt: Date.now() });
  await saveSettingsMeta();
}

function renderPracticeHub(wrap) {
  const modeBar = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;">
      ${[['flash','碎片闪卡'],['blind','古例盲断'],['flaw','断语挑刺']].map(([k,l]) => `<button class="btn-secondary" style="padding:9px 4px;font-size:13.5px;${state.practiceMode===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="state.practiceMode='${k}';renderStudyView()">${l}</button>`).join('')}
    </div>
  `;
  if (state.practiceMode === 'flash') {
    const allCards = [...BASE_FLASHCARDS, ...(state.customFlash || [])];
    const card = allCards[state.flashIdx % allCards.length];
    wrap.innerHTML = modeBar + `
      <div class="flashcard-stage" onclick="state.flashFlipped=!state.flashFlipped;renderStudyView()">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="pill-mini accent">${escapeHtml(card.tag)}</span>
          <span style="font-size:12px;color:var(--text-3);">第 ${(state.flashIdx % allCards.length) + 1} / ${allCards.length} 题 · 点卡片翻面</span>
        </div>
        <div style="margin:22px 0;font-size:16.5px;line-height:1.8;font-weight:${state.flashFlipped?'500':'600'};">
          ${state.flashFlipped ? `<div style="font-size:13px;color:var(--text-3);margin-bottom:8px;">解析答案</div>${formatRichText(card.a)}` : escapeHtml(card.q)}
        </div>
        <div style="text-align:center;font-size:12.5px;color:var(--text-3);">${state.flashFlipped ? '觉得没吃透请点下方「没记住」，AI 以后会重点提醒你' : '先在脑子里默想答案，再点一下翻面'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <button class="btn-secondary" style="color:var(--seal);" onclick="markFlashWeak('${escapeHtml(card.tag)}')">没记住（记盲区）</button>
        <button class="btn-primary" onclick="nextFlashcard()">秒懂，下一张 ›</button>
      </div>
      <button class="btn-secondary" style="width:100%;" id="genFlashBtn" onclick="generateNewFlashcard()">+ 让 AI 结合我的薄弱点出一张新卡</button>
    `;
  } else if (state.practiceMode === 'blind') {
    if (!state.blindCase) state.blindCase = BLIND_CASES[0];
    const bc = state.blindCase, mh = HEX_DATA.byKey[bc.mainKey];
    const exam = runLiuyaoPhysicalExam(mh, new Set(bc.moving || []), bc.monthGz[0], bc.dayGz[1], bc.xunkong);
    wrap.innerHTML = modeBar + `
      <div class="card">
        <div class="card-head">
          <span class="card-title">遮住答案，先自己盲断</span>
          <div style="display:flex;gap:6px;">
            <button class="pill-mini" onclick="nextBlindCase()">换一例</button>
            <button class="pill-mini accent" id="bookBlindBtn" onclick="extractBlindCaseFromBooks()">从我书里抽</button>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-3);margin-bottom:6px;">出处：${escapeHtml(bc.source)}</div>
        <div style="font-size:15.5px;font-weight:700;margin-bottom:8px;">${escapeHtml(bc.question)}</div>
        <div class="gz-banner" style="margin:6px 0 10px;">${bc.monthGz} · ${bc.dayGz}（空${bc.xunkong}）· ${mh.name}${exam.bianHex?' 变 '+exam.bianHex.name:''}</div>
        ${[5,4,3,2,1,0].map(i => {
          const r = exam.examRows[i], b = r.bian;
          return `<div class="ly-row" style="cursor:default;"><span style="color:var(--text-3);">${r.pos}爻</span><span style="font-size:11px;color:var(--text-3);">${r.fushen?r.fushen.label:''}</span><div><span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span><span class="wx-${r.wx}" style="font-weight:600;">${r.liuqin}${r.branch}${r.wx}</span>${r.isShi?'<strong style="color:var(--seal);"> 世</strong>':(r.isYing?' 应':'')}</div><span style="color:var(--seal);font-weight:700;">${r.isMov?(r.bit?'○':'×'):''}</span><div>${b?`<span class="wx-${b.wx}">${b.liuqin}${b.branch}${b.wx}</span>`:''}</div></div>`;
        }).join('')}
      </div>
      <div class="card">
        <div class="form-label">第一步：你选哪个用神？</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">${['妻财','官鬼','父母','子孙','兄弟','世爻'].map(y => `<button class="chip ${state.blindUserYs===y?'accent':''}" onclick="state.blindUserYs='${y}';renderStudyView()">${y}</button>`).join('')}</div>
        <div class="form-label">第二步：你的成败判断？</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">${['成','败','反复'].map(v => `<button class="chip ${state.blindUserVerdict===v?'seal':''}" onclick="state.blindUserVerdict='${v}';renderStudyView()">${v}</button>`).join('')}</div>
        <div class="form-label">第三步：一句话写出你的理由</div>
        <textarea class="form-textarea" style="min-height:60px;" placeholder="例：用神旺相但动化回头克，故难成..." oninput="state.blindUserReason=this.value">${escapeHtml(state.blindUserReason)}</textarea>
        <button class="btn-primary" style="width:100%;margin-top:12px;" id="submitBlindBtn" onclick="submitBlindAnswer()">交卷揭晓原书答案</button>
      </div>
      ${state.blindSubmitted ? `
        <div class="card" style="border-color:var(--accent);">
          <div class="card-title" style="margin-bottom:8px;color:var(--accent);">原书解析（参考用神：${bc.answerYs} · 结论：${bc.answerVerdict}）</div>
          <div style="font-size:14.5px;line-height:1.8;margin-bottom:10px;">${escapeHtml(bc.masterText)}</div>
          ${state.blindAiReview ? `<div style="padding:12px;border-radius:14px;background:var(--bg);font-size:14.5px;line-height:1.78;">${formatRichText(state.blindAiReview)}</div>` : `<button class="btn-secondary" style="width:100%;" id="gradeBlindAiBtn" onclick="gradeBlindCaseWithAI()">让 AI 点评我的思路（找盲区）</button>`}
        </div>
      ` : ''}
    `;
  } else {
    const fc = state.flawCustom || FLAW_CASES[state.flawIdx % FLAW_CASES.length];
    wrap.innerHTML = modeBar + `
      <div class="card">
        <div class="card-head">
          <span class="card-title">来当老师：揪出下面这段断语的硬伤</span>
          <div style="display:flex;gap:6px;">
            <button class="pill-mini" onclick="nextFlawCase()">换一题</button>
            <button class="pill-mini accent" id="genFlawBtn" onclick="generateNewFlawCase()">AI 出题</button>
          </div>
        </div>
        <div style="padding:14px 15px;border-radius:15px;background:var(--bg);font-size:15.5px;line-height:1.82;margin-bottom:14px;">${escapeHtml(fc.statement)}</div>
        <textarea class="form-textarea" style="min-height:66px;" placeholder="写出这段话错在哪里？哪个概念被用反了？" oninput="state.flawUserAns=this.value">${escapeHtml(state.flawUserAns)}</textarea>
        <button class="btn-primary" style="width:100%;margin-top:12px;" onclick="revealFlawTrap()">揭晓逻辑陷阱</button>
      </div>
      ${state.flawAiReview ? `<div class="card" style="border-color:var(--seal);"><div class="card-title" style="margin-bottom:8px;color:var(--seal);">硬伤拆解（考点：${escapeHtml(fc.tag)}）</div><div style="font-size:15px;line-height:1.8;">${formatRichText(state.flawAiReview)}</div></div>` : ''}
    `;
  }
}

function nextFlashcard() { state.flashIdx++; state.flashFlipped = false; renderStudyView(); }
async function markFlashWeak(tag) { await recordWeakSpot(tag); showToast(`已把「${tag}」记入薄弱点，AI 断盘时会提醒你`); nextFlashcard(); }
async function generateNewFlashcard() {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('genFlashBtn'); if (btn) { btn.disabled = true; btn.textContent = 'AI 正在出题...'; }
  const weak = (state.settings.weakSpots || []).slice(0, 3).map(w => w.tag).join('、') || '旬空、暗动、化进退神';
  try {
    const out = (await callLLM([{ role:'user', content:`请出一道六爻或八字实战情景闪卡题（优先针对：${weak}）。严格按以下格式输出三行，严禁星号：\n标签：两到四个字\n问题：一句话具体场景提问\n答案：两到三句直击核心的解析` }], { tier:'flash' })).replace(/\*/g, '');
    const tag = (out.match(/标签[:：](.+)/)?.[1] || '实战进阶').trim();
    const q = (out.match(/问题[:：]([\s\S]+?)(?=答案[:：])/)?.[1] || out).trim();
    const a = (out.match(/答案[:：]([\s\S]+)/)?.[1] || '').trim();
    if (q && a) { state.customFlash.push({ tag, q, a }); state.flashIdx = BASE_FLASHCARDS.length + state.customFlash.length - 1; state.flashFlipped = false; renderStudyView(); }
  } catch (e) { showToast('出题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '+ 让 AI 结合我的薄弱点出一张新卡'; } }
}

function nextBlindCase() {
  const curIdx = BLIND_CASES.findIndex(x => x.id === state.blindCase?.id);
  state.blindCase = BLIND_CASES[(curIdx + 1) % BLIND_CASES.length];
  state.blindSubmitted = false; state.blindUserReason = ''; state.blindAiReview = ''; renderStudyView();
}
async function submitBlindAnswer() {
  state.blindSubmitted = true;
  const bc = state.blindCase;
  if (bc && (state.blindUserYs !== bc.answerYs || state.blindUserVerdict !== bc.answerVerdict)) {
    await recordWeakSpot(`盲断偏差(${bc.answerYs}·${bc.answerVerdict})`);
  }
  renderStudyView();
}
async function gradeBlindCaseWithAI() {
  if (!ensureApiKey()) return;
  const bc = state.blindCase, btn = document.getElementById('gradeBlindAiBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'AI 教练批改中...'; }
  try {
    const out = await callLLM([{ role:'user', content:`我是术数学习者，刚做了一道盲断题。请像直爽负责的私人教练一样点评（严禁吹捧、严禁星号）：\n题目：${bc.question}（${bc.monthGz} ${bc.dayGz}）\n原书结论：用神${bc.answerYs}，结果${bc.answerVerdict}。原解：${bc.masterText}\n我的作答：用神选了${state.blindUserYs}，结果判了${state.blindUserVerdict}，理由是「${state.blindUserReason||'未写'}」。\n请分两点回复：1. 哪里看准了；2. 哪个关键环节看漏或看反了。` }], { tier:'flash' });
    state.blindAiReview = out.replace(/\*/g, '').trim(); renderStudyView();
  } catch (e) { showToast('批改失败：' + e.message); if (btn) { btn.disabled = false; btn.textContent = '重试点评'; } }
}
async function extractBlindCaseFromBooks() {
  if (!ensureApiKey()) return;
  const lyBooks = state.books.filter(b => b.category === '六爻');
  if (!lyBooks.length) return showToast('书房还没有上传六爻书，先用内置古例练吧');
  const chs = state.chapters.filter(c => lyBooks.some(b => b.id === c.bookId) && (c.content || '').length > 180);
  if (!chs.length) return showToast('书库中未找到可用文本页');
  const pick = chs[Math.floor(Math.random() * chs.length)], book = lyBooks.find(b => b.id === pick.bookId);
  const btn = document.getElementById('bookBlindBtn'); if (btn) { btn.disabled = true; btn.textContent = '抽题中...'; }
  try {
    const out = (await callLLM([{ role:'user', content:`从下面《${book.title}》第${pick.pageNum}页文字中，提炼一个适合盲断的六爻练习题。若本页没有完整卦例，请据本页理法编一道标准例题。严格按下面 5 行输出，严禁星号：\n事项：一句话占问之事\n月日：如卯月戊辰日\n用神：从 妻财/官鬼/父母/子孙/兄弟/世爻 选一个\n结论：从 成/败/反复 选一个\n原解：100字以内白话解析\n\n原书文本：${pick.content.slice(0, 1200)}` }], { tier:'flash' })).replace(/\*/g, '');
    const question = (out.match(/事项[:：](.+)/)?.[1] || '书库随机卦例').trim();
    const md = (out.match(/月日[:：](.+)/)?.[1] || '卯月戊辰日').trim();
    const answerYs = (out.match(/用神[:：](.+)/)?.[1] || '妻财').trim().slice(0, 2);
    const answerVerdict = (out.match(/结论[:：](.+)/)?.[1] || '成').trim().slice(0, 2);
    const masterText = (out.match(/原解[:：]([\s\S]+)/)?.[1] || out).trim();
    const randHex = HEX_DATA.list[Math.floor(Math.random() * HEX_DATA.list.length)];
    state.blindCase = { id: uid('bc'), source: `《${book.title}》第${pick.pageNum}页`, question, monthGz: md.slice(0,2) || '卯月', dayGz: md.slice(2,5) || '戊辰日', xunkong: '戌亥', mainKey: randHex.key, moving: [Math.floor(Math.random()*6)+1], answerYs, answerVerdict, masterText };
    state.blindSubmitted = false; state.blindUserReason = ''; state.blindAiReview = ''; renderStudyView();
  } catch (e) { showToast('抽题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '从我书里抽'; } }
}

function nextFlawCase() { state.flawCustom = null; state.flawIdx++; state.flawUserAns = ''; state.flawAiReview = ''; renderStudyView(); }
async function revealFlawTrap() {
  const fc = state.flawCustom || FLAW_CASES[state.flawIdx % FLAW_CASES.length];
  if (!state.flawUserAns.trim() || !state.settings.apiKey) {
    state.flawAiReview = fc.trap; renderStudyView(); return;
  }
  state.flawAiReview = '正在核对你的挑刺思路...'; renderStudyView();
  try {
    const out = await callLLM([{ role:'user', content:`错题原文：${fc.statement}\n真实硬伤：${fc.trap}\n用户的挑刺回答：「${state.flawUserAns}」\n请用两句直爽大白话判断用户有没有抓到真硬伤，并补充关键点（严禁星号）。` }], { tier:'flash' });
    state.flawAiReview = out.replace(/\*/g, '').trim() + '\n\n【标准硬伤】' + fc.trap;
    renderStudyView();
  } catch (e) { state.flawAiReview = fc.trap; renderStudyView(); }
}
async function generateNewFlawCase() {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('genFlawBtn'); if (btn) { btn.disabled = true; btn.textContent = '出题中...'; }
  try {
    const out = (await callLLM([{ role:'user', content:`请编一道「六爻或八字断语挑刺题」：写一段听起来很专业、但故意埋了 1 个经典逻辑硬伤（如假空当真空、暗动当日破、忌神化退当凶、调候反用）的假断语。严格按三行输出，严禁星号：\n考点：四个字\n假断语：60字以内\n硬伤：80字以内一针见血拆穿` }], { tier:'flash' })).replace(/\*/g, '');
    state.flawCustom = { tag: (out.match(/考点[:：](.+)/)?.[1] || '理法陷阱').trim(), statement: (out.match(/假断语[:：]([\s\S]+?)(?=硬伤[:：])/)?.[1] || out).trim(), trap: (out.match(/硬伤[:：]([\s\S]+)/)?.[1] || '').trim() };
    state.flawUserAns = ''; state.flawAiReview = ''; renderStudyView();
  } catch (e) { showToast('出题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'AI 出题'; } }
}
