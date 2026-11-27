// ==================== 藏往 V10 · 书房双通道找书、起点级阅读器、七门阶梯知识库与实战练习 (study.js) ====================
const COVER_PALETTES = [
  'linear-gradient(155deg,#2B3330,#181C1A)',
  'linear-gradient(155deg,#334743,#1B2825)',
  'linear-gradient(155deg,#47392E,#281F18)',
  'linear-gradient(155deg,#2B3B4E,#16202C)',
  'linear-gradient(155deg,#4A333B,#281A1F)',
  'linear-gradient(155deg,#3C4236,#21261E)'
];

function cleanBookText(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u3000+/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([^\n。！？；：”’）】])\n(?=[\u4e00-\u9fa5])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ==================== 1. 清爽书房书架 + 随手译抽屉 ====================
function renderLibraryView() {
  const wrap = document.getElementById('libraryScrollArea');
  const filterCats = ['全部', '六爻', '八字', '奇门', '梅花', '六壬', '紫微', '风水', '其他'];
  const filteredBooks = state.books.filter(b => {
    if (state.libFilter === '全部') return true;
    return (b.category || '其他') === state.libFilter;
  }).sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0) || (b.createdAt || 0) - (a.createdAt || 0));

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0 6px;">
      <span style="font-family:'Songti SC',serif;font-size:16.5px;font-weight:700;">我的藏书（${state.books.length}）</span>
      <span style="font-size:12px;color:var(--text-3);">支持 EPUB / TXT / PDF · 全本翻白话</span>
    </div>
    <div class="cat-strip" style="padding:0 0 12px;">
      ${filterCats.map(c => `<button class="cat-pill ${state.libFilter===c?'active':''}" onclick="state.libFilter='${c}';renderLibraryView()">${c}</button>`).join('')}
    </div>
    ${!filteredBooks.length ? `
      <div class="card empty-box">
        <p>书架目前空空如也<br/>点「在线找书」可直接搜公版古籍纯文字一键入架（免下载），<br/>或去你的外部书站下载 EPUB / TXT 导入，彻底告别扫描版 PDF。</p>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
          <button class="btn-primary" style="padding:11px 18px;" onclick="openOnlineBookSheet()">在线找书</button>
          <button class="btn-secondary" style="padding:11px 18px;" onclick="openSheet('sheet-import')">导入本地书</button>
        </div>
      </div>
    ` : `<div class="books-grid">${filteredBooks.map((b, i) => {
      const bg = COVER_PALETTES[(b.coverIdx ?? i) % COVER_PALETTES.length];
      const bookChs = state.chapters.filter(c => c.bookId === b.id);
      const total = Math.max(1, b.totalPages || bookChs.length);
      const cur = b.lastPageNum || 1;
      const transCount = bookChs.filter(c => c.modernText && c.modernText.trim()).length;
      return `<div class="book-item" onclick="openReader('${b.id}')">
        <div class="book-cover" style="background:${bg};">
          <div class="book-cover-title">${escapeHtml(b.title)}</div>
          <div class="book-cover-foot"><span>${escapeHtml(b.category || '其他')}</span><span>${total}章</span></div>
        </div>
        <div class="book-meta">
          <div style="min-width:0;flex:1;">
            <div class="book-name">${escapeHtml(b.title)}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px;">读 ${Math.min(100, Math.round(cur / total * 100))}%${transCount ? ` · 译${transCount}` : ''}</div>
          </div>
          <button style="padding:2px 6px;color:var(--text-3);font-size:16px;" onclick="event.stopPropagation();openBookEditSheet('${b.id}')">⋮</button>
        </div>
      </div>`;
    }).join('')}</div>`}
  `;
}

function renderQuickTransSheet() {
  const sel = document.getElementById('quickTransBookSel');
  if (sel) {
    sel.innerHTML = `<option value="">通用术数理法</option>` +
      `<option value="《增删卜易》六爻流派" ${state.quickTransBook==='《增删卜易》六爻流派'?'selected':''}>按《增删卜易》</option>` +
      `<option value="《古筮真诠》六爻流派" ${state.quickTransBook==='《古筮真诠》六爻流派'?'selected':''}>按《古筮真诠》</option>` +
      `<option value="《滴天髓》八字流派" ${state.quickTransBook==='《滴天髓》八字流派'?'selected':''}>按《滴天髓》</option>` +
      state.books.map(b => `<option value="《${escapeHtml(b.title)}》(${b.category})" ${state.quickTransBook===`《${b.title}》(${b.category})`?'selected':''}>书架《${escapeHtml(b.title)}》</option>`).join('');
  }
  const ta = document.getElementById('quickTransArea'); if (ta) ta.value = state.quickTransInput || '';
  const outBox = document.getElementById('quickTransOutBox');
  if (outBox) {
    outBox.innerHTML = state.quickTransOut ? `
      <div style="padding:13px 14px;border-radius:15px;background:var(--bg);font-size:14.5px;line-height:1.82;">
        ${formatRichText(state.quickTransOut)}
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="chip" onclick="closeSheet('sheet-quick-trans');saveQuickTransToNote()">存为笔记</button>
          <button class="chip accent" onclick="closeSheet('sheet-quick-trans');askCanwuQuickTrans()">继续追问参悟</button>
        </div>
      </div>` : '';
  }
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
    renderQuickTransSheet();
  } catch (e) { showToast('翻译失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '立即精译成大白话'; } }
}
function saveQuickTransToNote() { createAndOpenNote({ title: '古文精译 · ' + state.quickTransInput.slice(0, 12), body: `【原文】\n${state.quickTransInput}\n\n${state.quickTransOut}` }); }
function askCanwuQuickTrans() { switchMainTab('canwu'); document.getElementById('chatInput').value = `刚译了这段古文，帮我再举个实战例子讲透：\n${state.quickTransInput.slice(0, 300)}`; sendCanwuMessage(); }

// ==================== 2. 双通道找书（维基文库公版纯文字直搜 + 自定义外部书站） ====================
function openOnlineBookSheet() { openSheet('sheet-online-books'); }

function guessCategoryFromTitle(title) {
  if (/卜易|卜筮|易林|火珠林|黄金策|六爻|野鹤|古筮/.test(title)) return '六爻';
  if (/子平|滴天髓|穷通|三命|渊海|八字|命理|神峰/.test(title)) return '八字';
  if (/奇门|遁甲|烟波钓叟/.test(title)) return '奇门';
  if (/梅花|皇极/.test(title)) return '梅花';
  if (/六壬|毕法/.test(title)) return '六壬';
  if (/紫微|斗数/.test(title)) return '紫微';
  if (/葬书|青囊|阳宅|玄空|地理|风水|撼龙/.test(title)) return '风水';
  return '其他';
}

async function searchWikisourceBooks() {
  const q = (document.getElementById('onlineBookQuery')?.value || '').trim();
  if (!q) return showToast('请输入想找的古籍书名');
  const btn = document.getElementById('wikiSearchBtn'), box = document.getElementById('wikiSearchResults');
  btn.disabled = true; btn.textContent = '搜索中';
  box.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:10px 0;text-align:center;">正在检索中文维基文库公版纯文字古籍...</div>';
  try {
    const url = `https://zh.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=12&format=json&origin=*`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('网络不通');
    const data = await resp.json();
    const list = data?.query?.search || [];
    if (!list.length) {
      box.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:10px 0;text-align:center;">公版库未搜到该书，请改用下方「通道二：直达外部书站」搜索现代新书。</div>';
      return;
    }
    box.innerHTML = list.map(it => {
      const snip = (it.snippet || '').replace(/<[^>]+>/g, '').slice(0, 68);
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 2px;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--text);">${escapeHtml(it.title)}</div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">${escapeHtml(snip)}...</div>
        </div>
        <button class="pill-mini xs accent" onclick="importWikisourceBook('${escapeHtml(it.title).replace(/'/g,"\\'")}', this)">一键入架</button>
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<div style="font-size:13px;color:var(--seal);padding:10px 0;">在线检索失败（请检查网络或代理）：${escapeHtml(e.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = '搜索'; }
}

async function fetchWikiPlainText(pageTitle) {
  const u = `https://zh.wikisource.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
  const r = await fetch(u); const d = await r.json();
  const pages = d?.query?.pages || {};
  const first = Object.values(pages)[0];
  return cleanBookText(first?.extract || '');
}

async function importWikisourceBook(pageTitle, btnEl) {
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '拉取中...'; }
  try {
    // 检查该书是否有子卷（维基文库古籍常以 书名/卷一 形式组织）
    const subUrl = `https://zh.wikisource.org/w/api.php?action=query&list=prefixsearch&pssearch=${encodeURIComponent(pageTitle + '/')}&pslimit=40&format=json&origin=*`;
    const subResp = await fetch(subUrl);
    const subData = await subResp.json();
    const subPages = (subData?.query?.prefixsearch || []).map(x => x.title);

    const chaptersData = [];
    const mainTxt = await fetchWikiPlainText(pageTitle);
    if (mainTxt.length > 120) chaptersData.push({ title: pageTitle, content: mainTxt });

    if (subPages.length > 0) {
      showToast(`发现 ${subPages.length} 个子卷，正在拉取纯文字...`);
      for (let i = 0; i < Math.min(subPages.length, 35); i++) {
        const st = subPages[i];
        const txt = await fetchWikiPlainText(st);
        if (txt.length > 40) chaptersData.push({ title: st.replace(pageTitle + '/', '') || st, content: txt });
      }
    }

    if (!chaptersData.length) throw new Error('该条目暂无正文内容，可尝试搜索其子卷名');

    // 把特别长的单页按 2000 字拆分，方便翻页和批译
    const finalParts = [];
    chaptersData.forEach(cd => {
      if (cd.content.length <= 2400) finalParts.push(cd);
      else {
        let seg = 1;
        for (let i = 0; i < cd.content.length; i += 2000) {
          finalParts.push({ title: `${cd.title}（${seg++}）`, content: cd.content.slice(i, i + 2000).trim() });
        }
      }
    });

    const bookId = uid('bk'), cat = guessCategoryFromTitle(pageTitle);
    const book = {
      id: bookId, title: pageTitle, category: cat, hasPdf: false,
      totalPages: finalParts.length, lastPageNum: 1,
      toc: finalParts.map((p, i) => ({ title: p.title, pageNum: i + 1 })),
      bookmarks: [], coverIdx: state.books.length % COVER_PALETTES.length,
      createdAt: Date.now(), lastReadAt: 0
    };
    await dbPut('books', book); state.books.push(book);
    for (let i = 0; i < finalParts.length; i++) {
      const ch = { id: uid('ch'), bookId, idx: i, pageNum: i + 1, title: finalParts[i].title, content: finalParts[i].content, modernText: '', insightText: '' };
      await dbPut('chapters', ch); state.chapters.push(ch);
    }
    await markDirty();
    closeSheet('sheet-online-books');
    renderLibraryView();
    showToast(`《${pageTitle}》纯文字已入架（共 ${finalParts.length} 节），点开即可翻白话`);
  } catch (e) {
    showToast('导入失败：' + e.message);
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '重试入架'; }
  }
}

function launchExternalBookSite() {
  const q = (document.getElementById('extBookQuery')?.value || '').trim();
  const tpl = (state.settings.extBookUrl || 'https://z-lib.gs/s/{q}').trim();
  const url = tpl.includes('{q}') ? tpl.replace('{q}', encodeURIComponent(q)) : (tpl + encodeURIComponent(q));
  window.open(url, '_blank');
  showToast('已跳转外部书站，建议优先下 EPUB 或 TXT 格式');
}

// ==================== 3. 本地导入（新增 EPUB 完整解析 + PDF + TXT + MD） ====================
function openBookEditSheet(id) {
  const b = state.books.find(x => x.id === id); if (!b) return;
  document.getElementById('bookEditPanel').innerHTML = `<div class="sheet-handle"></div><h3 style="margin:0 0 12px;font-size:17px;">管理典籍</h3><div class="form-field"><label class="form-label">书名</label><input type="text" id="editBookName" class="form-input" value="${escapeHtml(b.title)}" /></div><div class="form-field"><label class="form-label">门类</label><select id="editBookCat" class="form-select">${BOOK_CATEGORIES.map(c => `<option ${b.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div style="display:flex;gap:8px;"><button class="btn-primary" style="flex:1;" onclick="saveBookEdit('${b.id}')">保存</button><button class="btn-secondary" style="color:var(--seal);" onclick="deleteBookConfirm('${b.id}')">删除</button></div>`;
  openSheet('sheet-book-edit');
}
async function saveBookEdit(id) { const b = state.books.find(x => x.id === id); if (!b) return; b.title = document.getElementById('editBookName').value.trim() || b.title; b.category = document.getElementById('editBookCat').value; await dbPut('books', b); await markDirty(); closeSheet('sheet-book-edit'); renderLibraryView(); showToast('已保存'); }
async function deleteBookConfirm(id) { const b = state.books.find(x => x.id === id); if (!b || !confirm(`删除《${b.title}》？`)) return; await dbDel('books', id); await dbDel('pdfBlobs', id); for (const c of state.chapters.filter(c => c.bookId === id)) await dbDel('chapters', c.id); state.books = state.books.filter(x => x.id !== id); state.chapters = state.chapters.filter(c => c.bookId !== id); await markDirty(); closeSheet('sheet-book-edit'); renderLibraryView(); }

function loadPdfJs() { if (window.pdfjsLib) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(); }; s.onerror = rej; document.head.appendChild(s); }); }

async function importEpubFile(file, title, cat) {
  if (typeof window.JSZip === 'undefined') throw new Error('EPUB 解析库加载中，请稍等 2 秒重试');
  showToast('正在解析 EPUB 章节与目录...');
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  let opfPath = '';
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const cXml = await containerFile.async('string');
    opfPath = cXml.match(/full-path=["']([^"']+)["']/)?.[1] || '';
  }
  const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  let spineFiles = [];
  if (opfPath && zip.file(opfPath)) {
    const opfStr = await zip.file(opfPath).async('string');
    const doc = new DOMParser().parseFromString(opfStr, 'application/xml');
    const manifest = {};
    doc.querySelectorAll('manifest item').forEach(it => { manifest[it.getAttribute('id')] = it.getAttribute('href'); });
    doc.querySelectorAll('spine itemref').forEach(ref => {
      const href = manifest[ref.getAttribute('idref')];
      if (href) spineFiles.push(decodeURIComponent(baseDir + href).replace(/^\/+/, ''));
    });
  }
  if (!spineFiles.length) {
    spineFiles = Object.keys(zip.files).filter(k => /\.(x?html?|htm)$/i.test(k) && !/toc|nav/i.test(k)).sort();
  }
  const parts = [];
  for (const path of spineFiles) {
    const zf = zip.file(path) || zip.file(decodeURIComponent(path));
    if (!zf) continue;
    const htmlStr = await zf.async('string');
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    doc.querySelectorAll('script,style').forEach(el => el.remove());
    const heading = (doc.querySelector('h1,h2,h3,title')?.textContent || '').trim();
    const rawTxt = (doc.body?.innerText || doc.body?.textContent || '').trim();
    const clean = cleanBookText(rawTxt);
    if (clean.length < 25) continue;
    if (clean.length <= 2400) {
      parts.push({ title: heading || `第 ${parts.length + 1} 章`, content: clean });
    } else {
      let seg = 1;
      for (let i = 0; i < clean.length; i += 2000) {
        parts.push({ title: `${heading || ('第' + (parts.length + 1) + '章')}（${seg++}）`, content: clean.slice(i, i + 2000).trim() });
      }
    }
  }
  if (!parts.length) throw new Error('未能从该 EPUB 中提取到正文');
  const bookId = uid('bk');
  const book = {
    id: bookId, title, category: cat, hasPdf: false, totalPages: parts.length, lastPageNum: 1,
    toc: parts.map((p, i) => ({ title: p.title, pageNum: i + 1 })), bookmarks: [],
    coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0
  };
  await dbPut('books', book); state.books.push(book);
  for (let i = 0; i < parts.length; i++) {
    const ch = { id: uid('ch'), bookId, idx: i, pageNum: i + 1, title: parts[i].title, content: parts[i].content, modernText: '', insightText: '' };
    await dbPut('chapters', ch); state.chapters.push(ch);
  }
  await markDirty(); closeSheet('sheet-import'); renderLibraryView();
  showToast(`EPUB《${title}》已入架（${parts.length} 节），全本可翻白话`);
}

async function handleBookFileSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const title = file.name.replace(/\.(epub|pdf|txt|md)$/i, ''), cat = document.getElementById('importCatSelect')?.value || state.category;
  try {
    if (/\.epub$/i.test(file.name)) {
      await importEpubFile(file, title, cat);
    } else if (/\.pdf$/i.test(file.name)) {
      showToast('正在导入 PDF 并检测可提取文字...');
      await loadPdfJs();
      const buf = await file.arrayBuffer(), pdf = await window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise, bookId = uid('bk');
      await dbPut('pdfBlobs', { id: bookId, data: buf });
      const book = { id: bookId, title, category: cat, hasPdf: true, totalPages: pdf.numPages, lastPageNum: 1, toc: [], bookmarks: [], coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0 };
      await dbPut('books', book); state.books.push(book);
      let textPageCount = 0;
      for (let p = 1; p <= Math.min(pdf.numPages, 500); p++) {
        const page = await pdf.getPage(p), tc = await page.getTextContent();
        const rawTxt = tc.items.map(it => it.str).join(' ').replace(/\s{2,}/g, '\n');
        const cleaned = cleanBookText(rawTxt);
        if (cleaned.length > 15) textPageCount++;
        const ch = { id: uid('ch'), bookId, idx: p - 1, pageNum: p, title: `第 ${p} 页`, content: cleaned, modernText: '', insightText: '' };
        await dbPut('chapters', ch); state.chapters.push(ch);
      }
      await markDirty(); closeSheet('sheet-import'); renderLibraryView();
      if (textPageCount < Math.min(3, pdf.numPages)) showToast(`已导入《${title}》（检测为扫描图片PDF，可点右上角「原PDF」或「识图译」）`);
      else showToast(`《${title}》已存入书房（文字版，支持全本翻白话）`);
    } else {
      await importPlainTextBook(title, await file.text(), cat);
    }
  } catch (err) { showToast('导入失败：' + err.message); }
  e.target.value = '';
}

async function importPlainTextBook(title, rawText, cat) {
  const clean = cleanBookText(rawText);
  const re = /(?:^|\n)\s*((?:第[零一二三四五六七八九十百千0-9]+[章节卷篇回]|卷[零一二三四五六七八九十0-9]+)\s*[^\n]{0,34})(?=\n)/g;
  const hits = []; let m; while ((m = re.exec(clean)) !== null) hits.push({ title: m[1].trim(), index: m.index });
  const parts = [];
  if (hits.length >= 2) {
    if (hits[0].index > 80) parts.push({ title: '卷首 / 序言', content: clean.slice(0, hits[0].index).trim() });
    for (let i = 0; i < hits.length; i++) {
      const segText = clean.slice(hits[i].index, i + 1 < hits.length ? hits[i + 1].index : clean.length).trim();
      if (segText.length <= 2400) parts.push({ title: hits[i].title, content: segText });
      else {
        let sub = 1;
        for (let j = 0; j < segText.length; j += 2000) parts.push({ title: `${hits[i].title}（${sub++}）`, content: segText.slice(j, j + 2000).trim() });
      }
    }
  } else { for (let i = 0; i < clean.length; i += 2000) parts.push({ title: `第 ${parts.length + 1} 节`, content: clean.slice(i, i + 2000).trim() }); }
  const bookId = uid('bk');
  const book = { id: bookId, title: title || '自录典籍', category: cat || state.category, hasPdf: false, totalPages: parts.length, lastPageNum: 1, toc: parts.map((p, i) => ({ title: p.title, pageNum: i + 1 })), bookmarks: [], coverIdx: state.books.length % COVER_PALETTES.length, createdAt: Date.now(), lastReadAt: 0 };
  await dbPut('books', book); state.books.push(book);
  for (let i = 0; i < parts.length; i++) { const ch = { id: uid('ch'), bookId, idx: i, pageNum: i + 1, title: parts[i].title, content: parts[i].content, modernText: '', insightText: '' }; await dbPut('chapters', ch); state.chapters.push(ch); }
  await markDirty(); closeSheet('sheet-import'); renderLibraryView(); showToast(`已导入《${book.title}》`);
}
async function importPastedBook() { const t = document.getElementById('pasteBookTitle').value.trim(), c = document.getElementById('pasteBookContent').value.trim(), cat = document.getElementById('importCatSelect')?.value || state.category; if (!c) return showToast('请粘贴内容'); await importPlainTextBook(t || '自录典籍', c, cat); document.getElementById('pasteBookTitle').value = ''; document.getElementById('pasteBookContent').value = ''; }

// ==================== 4. 起点/微信读书级三态阅读器（上下连滑 + 左右翻页 + 全本批译 + 识图译 + 听书 + 古例排活盘） ====================
let readerTouchStartX = 0, readerTouchStartY = 0, readerGesturesBound = false;

function bindReaderGestures() {
  if (readerGesturesBound) return;
  readerGesturesBound = true;
  const wrap = document.getElementById('readerContentWrap');
  wrap.addEventListener('touchstart', e => {
    readerTouchStartX = e.touches[0].clientX;
    readerTouchStartY = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - readerTouchStartX;
    const dy = e.changedTouches[0].clientY - readerTouchStartY;
    if ((state.settings.pageMode === 'swipe' || state.reader.pdfMode) && Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      readerStep(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  wrap.addEventListener('click', e => {
    document.getElementById('selPopover').classList.remove('show');
    if (e.target.closest('button') || e.target.closest('.reader-para') || e.target.closest('.reader-modern-block')) return;
    if (state.settings.pageMode === 'swipe' || state.reader.pdfMode) {
      const rect = wrap.getBoundingClientRect(), xRatio = (e.clientX - rect.left) / rect.width;
      if (xRatio < 0.28) { readerStep(-1); return; }
      if (xRatio > 0.72) { readerStep(1); return; }
    }
    state.reader.barsHidden = !state.reader.barsHidden;
    document.getElementById('readerOverlay').classList.toggle('bars-hidden', state.reader.barsHidden);
  });
  // 上下无缝连滑：滚动接近底部自动拼接下一章
  let appendingNext = false;
  wrap.addEventListener('scroll', async () => {
    if (state.settings.pageMode !== 'scroll' || state.reader.pdfMode || appendingNext) return;
    if (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 180) {
      if (state.reader.loadedEndPage < state.reader.totalPages) {
        appendingNext = true;
        try { await appendNextScrollChapter(); } finally { appendingNext = false; }
      }
    }
  });
}

async function openReader(bookId, pageNum) {
  bindReaderGestures();
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  state.reader.bookId = bookId;
  state.reader.totalPages = Math.max(1, book.totalPages || state.chapters.filter(c => c.bookId === bookId).length);
  state.reader.pageNum = typeof pageNum === 'number' ? Math.max(1, Math.min(state.reader.totalPages, pageNum)) : (book.lastPageNum || 1);
  state.reader.loadedEndPage = state.reader.pageNum;
  state.reader.pdfMode = false; state.reader.readMode = 'orig'; state.reader.activeParaText = '';
  document.getElementById('readerPdfToggleBtn').style.display = book.hasPdf ? 'inline-flex' : 'none';
  document.getElementById('readerOcrBtn').style.display = book.hasPdf ? 'inline-flex' : 'none';
  applyTypoSettings(); openOverlay('readerOverlay'); markStudyFootprint();
  if (book.hasPdf) {
    try { await loadPdfJs(); const blobRec = await dbGet('pdfBlobs', bookId); if (blobRec?.data) state.reader.pdfDoc = await window.pdfjsLib.getDocument({ data: blobRec.data.slice(0) }).promise; } catch (e) {}
    const ch = getReaderChapter(bookId, state.reader.pageNum);
    if (!ch || !ch.content || ch.content.length < 15) state.reader.pdfMode = true;
  }
  await renderReaderPage();
}
function closeReader() {
  stopReaderTts();
  state.reader.batchRunning = false;
  closeOverlay('readerOverlay');
  document.getElementById('selPopover').classList.remove('show');
  if (state.mainTab === 'library') renderLibraryView();
}

function getReaderChapter(bookId, pNum) {
  return state.chapters.find(c => c.bookId === bookId && (c.pageNum === pNum || c.idx === pNum - 1));
}

async function translateChapterObj(book, ch, force = false) {
  if (!ch || !ch.content?.trim()) return false;
  if (!force && ch.modernText?.trim()) return true;
  const origParas = ch.content.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const prompt = `你是精通《${book.title}》（${book.category}）的古籍精译专家。
请将下面共 ${origParas.length} 段原文逐段翻译为自然流畅、通俗易懂的现代白话文。
铁律：
1. 必须保留原汁原味的专业术数术语（如世爻、用神、月破、旬空、暗动、化进退神、回头克、十神、值符等），只把文言句式和逻辑翻成大白话。
2. 译文必须严格保持 ${origParas.length} 段，每段一行，用 ||| 分隔各段，不要加编号。
3. 在全部译文最后加上标记 ###点破### ，接着用 2 句大白话点破本页最核心的实战断法。
4. 严禁使用任何星号符号。

原文：
${origParas.map((p, i) => `[${i + 1}] ${p}`).join('\n')}`;
  const raw = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
  const [bodyPart, insightPart] = raw.split('###点破###');
  const translated = (bodyPart || raw).split('|||').map(s => s.replace(/^\[\d+\]\s*/, '').trim()).filter(Boolean);
  ch.modernText = translated.join('\n');
  ch.insightText = (insightPart || '').trim();
  await dbPut('chapters', ch);
  return true;
}

// 静默后台预译后续 2 页（翻到下一页时秒出白话，不卡顿）
let pretransLock = false;
async function pretranslateNextPages() {
  if (pretransLock || state.reader.readMode === 'orig' || !state.settings.apiKey) return;
  pretransLock = true;
  try {
    const book = state.books.find(b => b.id === state.reader.bookId);
    if (!book) return;
    for (let offset = 1; offset <= 2; offset++) {
      const targetP = state.reader.loadedEndPage + offset;
      if (targetP > state.reader.totalPages) break;
      const ch = getReaderChapter(book.id, targetP);
      if (ch && ch.content?.trim() && !ch.modernText?.trim()) {
        await translateChapterObj(book, ch, false);
      }
    }
  } catch (e) {} finally { pretransLock = false; }
}

function buildChapterHtmlBlock(ch, pNum) {
  const mode = state.reader.readMode;
  const orig = (ch?.content || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const mod = (ch?.modernText || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!orig.length) {
    return `<div class="reader-chapter-divider">${escapeHtml(ch?.title || '第 ' + pNum + ' 页')}</div>
      <div class="empty-box" style="padding:26px 10px;">
        <p>本页为纯扫描图片页，无法直接提取文字。<br/>点右上角【原PDF】可清晰浏览原书扫描页，或点【识图译】把图片里的字抠出来翻成白话。</p>
      </div>`;
  }
  let html = `<div class="reader-chapter-divider">${escapeHtml(ch?.title || '第 ' + pNum + ' 页')}</div>`;
  if (mode === 'modern' && mod.length) {
    html += mod.map((p, i) => `<p class="reader-para" onclick="tapReaderPara(event, ${pNum}, ${i}, 'modern')">${escapeHtml(p)}</p>`).join('');
  } else if (mode === 'both' && mod.length) {
    html += orig.map((p, i) => `<p class="reader-para orig-sub" onclick="tapReaderPara(event, ${pNum}, ${i}, 'orig')">${escapeHtml(p)}</p>${mod[i] ? `<div class="reader-modern-block" onclick="tapReaderPara(event, ${pNum}, ${i}, 'orig')">${escapeHtml(mod[i])}</div>` : ''}`).join('');
  } else {
    html += orig.map((p, i) => `<p class="reader-para" onclick="tapReaderPara(event, ${pNum}, ${i}, 'orig')">${escapeHtml(p)}</p>`).join('');
  }
  if (mode !== 'orig' && ch?.insightText) {
    html += `<div class="reader-insight-box"><strong>【本节实战点破】</strong><br/>${escapeHtml(ch.insightText)}</div>`;
  }
  return html;
}

async function appendNextScrollChapter() {
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  const nextP = state.reader.loadedEndPage + 1;
  if (nextP > state.reader.totalPages) return;
  const ch = getReaderChapter(book.id, nextP);
  if (state.reader.readMode !== 'orig' && ch && ch.content?.trim() && !ch.modernText?.trim() && state.settings.apiKey) {
    const loader = document.createElement('div');
    loader.id = 'scrollTransLoader';
    loader.style.cssText = 'text-align:center;font-size:12.5px;opacity:0.65;padding:18px 0;';
    loader.textContent = `正在无缝续译第 ${nextP} 节...`;
    document.getElementById('readerTextStage').appendChild(loader);
    try { await translateChapterObj(book, ch, false); } catch (e) {}
    loader.remove();
  }
  state.reader.loadedEndPage = nextP;
  state.reader.pageNum = nextP;
  book.lastPageNum = nextP; book.lastReadAt = Date.now(); dbPut('books', book);
  document.getElementById('readerTextStage').insertAdjacentHTML('beforeend', buildChapterHtmlBlock(ch, nextP));
  updateReaderFooterMeta(book, ch, nextP);
  pretranslateNextPages();
}

async function setReaderReadMode(mode) {
  state.reader.readMode = mode;
  document.querySelectorAll('#readerModePill button').forEach(b => b.classList.toggle('active', b.dataset.rm === mode));
  if (mode !== 'orig') {
    state.reader.pdfMode = false;
    const book = state.books.find(b => b.id === state.reader.bookId);
    const ch = getReaderChapter(state.reader.bookId, state.reader.pageNum);
    if (ch && ch.content?.trim() && !ch.modernText?.trim()) {
      if (!ensureApiKey()) { state.reader.readMode = 'orig'; return renderReaderPage(); }
      document.getElementById('readerTextStage').innerHTML = `<div class="empty-box"><p>正在结合《${escapeHtml(book?.title || '')}》原意精译本节...<br/>译完永久缓存，后台同时自动预译后面两节</p></div>`;
      try { await translateChapterObj(book, ch, false); } catch (e) { showToast('翻译失败：' + e.message); state.reader.readMode = 'orig'; }
    }
  }
  await renderReaderPage();
  if (mode !== 'orig') pretranslateNextPages();
}

async function retranslateCurrentPage() {
  if (!ensureApiKey()) return;
  const book = state.books.find(b => b.id === state.reader.bookId);
  const ch = getReaderChapter(state.reader.bookId, state.reader.pageNum);
  if (!ch || !ch.content?.trim()) return showToast('本页暂无文本，如为扫描 PDF 请点右上角「识图译」');
  state.reader.pdfMode = false; if (state.reader.readMode === 'orig') state.reader.readMode = 'both';
  document.getElementById('readerTextStage').innerHTML = `<div class="empty-box"><p>正在重新精译本节...</p></div>`;
  try { await translateChapterObj(book, ch, true); await renderReaderPage(); showToast('已重新精译'); } catch (e) { showToast('失败：' + e.message); }
}

// 扫描版 PDF 识图抠字并翻白话兜底
async function ocrAndTranslateCurrentPdfPage() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  if (!book || !state.reader.pdfDoc) return showToast('仅 PDF 文件支持识图翻译');
  if (!ensureApiKey()) return;
  showToast('正在渲染当前页并识图提取文字...');
  try {
    const page = await state.reader.pdfDoc.getPage(state.reader.pageNum);
    const vp = page.getViewport({ scale: 1.8 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const dataUrl = c.toDataURL('image/jpeg', 0.82);
    const extracted = await extractTextFromImage(dataUrl, `这是古籍《${book.title}》第${state.reader.pageNum}页的扫描图。请精准识别图中全部古文汉字（若是竖排请按从右到左的正确阅读顺序整理为横排段落），只输出整理后的纯原文，不要加任何说明或星号。`);
    if (!extracted || extracted.length < 10) throw new Error('未能识别出清晰文字');
    let ch = getReaderChapter(book.id, state.reader.pageNum);
    if (!ch) { ch = { id: uid('ch'), bookId: book.id, idx: state.reader.pageNum - 1, pageNum: state.reader.pageNum, title: `第 ${state.reader.pageNum} 页`, content: '', modernText: '', insightText: '' }; state.chapters.push(ch); }
    ch.content = cleanBookText(extracted);
    await dbPut('chapters', ch);
    state.reader.pdfMode = false;
    state.reader.readMode = 'both';
    await translateChapterObj(book, ch, true);
    await renderReaderPage();
    showToast('识图并翻译成白话完成，已永久保存本页');
  } catch (e) { showToast('识图翻译失败：' + e.message); }
}

function toggleReaderPdfMode() { state.reader.pdfMode = !state.reader.pdfMode; renderReaderPage(); }

function updateReaderFooterMeta(book, ch, pNum) {
  document.getElementById('readerBookTitle').textContent = book.title;
  document.getElementById('readerFootLeft').textContent = ch ? ch.title : `第 ${pNum} 页`;
  document.getElementById('readerFootRight').textContent = `${pNum} / ${state.reader.totalPages}`;
  const rng = document.getElementById('readerRange'); rng.min = 1; rng.max = state.reader.totalPages; rng.value = pNum;
  document.getElementById('readerRangeText').textContent = `${pNum}/${state.reader.totalPages}`;
}

async function renderReaderPage() {
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  const pNum = state.reader.pageNum;
  state.reader.loadedEndPage = pNum;
  book.lastPageNum = pNum; book.lastReadAt = Date.now(); await dbPut('books', book);
  const ch = getReaderChapter(book.id, pNum);
  updateReaderFooterMeta(book, ch, pNum);
  document.querySelectorAll('#readerModePill button').forEach(b => b.classList.toggle('active', b.dataset.rm === state.reader.readMode));

  const pdfStage = document.getElementById('readerPdfStage'), txtStage = document.getElementById('readerTextStage'), pagerBtns = document.getElementById('readerPagerBtns');
  if (state.reader.pdfMode && state.reader.pdfDoc) {
    pdfStage.style.display = 'block'; txtStage.style.display = 'none'; pagerBtns.style.display = 'flex';
    const page = await state.reader.pdfDoc.getPage(pNum), canvas = document.getElementById('pdfCanvas'), ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1.5, 2.2), targetW = Math.min(window.innerWidth - 40, 516);
    const vp = page.getViewport({ scale: (targetW / page.getViewport({ scale: 1 }).width) * dpr });
    canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = targetW + 'px'; canvas.style.height = (vp.height / dpr) + 'px';
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    document.getElementById('pdfPageHint').textContent = `原版 PDF · 左右滑动或点屏幕两侧翻页 · 点「识图译」可抠字翻白话`;
  } else {
    pdfStage.style.display = 'none'; txtStage.style.display = 'block';
    pagerBtns.style.display = state.settings.pageMode === 'scroll' ? 'none' : 'flex';
    txtStage.innerHTML = buildChapterHtmlBlock(ch, pNum) +
      (state.settings.pageMode === 'scroll' && pNum < state.reader.totalPages
        ? `<div style="text-align:center;font-size:11.5px;color:var(--r-muted);padding:16px 0 6px;">继续下滑自动加载下一节</div>`
        : `<div style="text-align:center;font-size:11.5px;color:var(--r-muted);margin-top:8px;">轻点段落可查通俗讲法 · 左右滑或点两侧可翻页</div>`);
  }
  document.getElementById('readerContentWrap').scrollTop = 0;
}

// 全本一键批量翻译
function openBatchTransSheet() {
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  const chs = state.chapters.filter(c => c.bookId === book.id);
  const hasTxt = chs.filter(c => c.content && c.content.trim().length > 10).length;
  const done = chs.filter(c => c.modernText && c.modernText.trim()).length;
  document.getElementById('batchTransStatus').textContent = `《${book.title}》共 ${chs.length} 节（可译文本 ${hasTxt} 节），已译成白话 ${done} 节。`;
  openSheet('sheet-batch-trans');
}
async function startBatchTranslate(limitCount) {
  if (!ensureApiKey()) return;
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  if (state.reader.batchRunning) return showToast('已在批量翻译中');
  state.reader.batchRunning = true;
  const stEl = document.getElementById('batchTransStatus');
  let doneNow = 0;
  try {
    for (let p = state.reader.pageNum; p <= state.reader.totalPages && doneNow < limitCount; p++) {
      if (!state.reader.batchRunning) break;
      const ch = getReaderChapter(book.id, p);
      if (!ch || !ch.content?.trim() || ch.modernText?.trim()) continue;
      if (stEl) stEl.textContent = `正在翻译第 ${p} / ${state.reader.totalPages} 节（本轮已完成 ${doneNow} 节，请保持亮屏）...`;
      await translateChapterObj(book, ch, false);
      doneNow++;
    }
    if (stEl) stEl.textContent = state.reader.batchRunning ? `批量翻译完成！本轮新译 ${doneNow} 节，全部已永久存本地。` : `已暂停，本轮已保存 ${doneNow} 节白话。`;
    state.reader.readMode = 'modern';
    await renderReaderPage();
    showToast(`批量翻译已保存 ${doneNow} 节`);
  } catch (e) {
    if (stEl) stEl.textContent = `中途中断（已保存 ${doneNow} 节）：${e.message}`;
  } finally { state.reader.batchRunning = false; }
}
function stopBatchTranslate() { state.reader.batchRunning = false; showToast('将在当前这节完成后暂停'); }

// 听书朗读（优先读白话）
function openTtsSheet() { openSheet('sheet-tts'); }
function toggleReaderTts() {
  if (!('speechSynthesis' in window)) return showToast('当前浏览器不支持朗读');
  if (state.reader.ttsPlaying) { stopReaderTts(); return; }
  const ch = getReaderChapter(state.reader.bookId, state.reader.pageNum);
  const txt = (state.reader.readMode !== 'orig' && ch?.modernText) ? ch.modernText : (ch?.content || '');
  if (!txt.trim()) return showToast('当前页没有可朗读的文字');
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt.slice(0, 3500));
  u.lang = 'zh-CN'; u.rate = Number(document.getElementById('ttsRateSel')?.value || 1);
  u.onend = () => {
    state.reader.ttsPlaying = false;
    const btn = document.getElementById('ttsPlayBtn'); if (btn) btn.textContent = '开始朗读本页';
    if (state.reader.pageNum < state.reader.totalPages) { readerStep(1); setTimeout(() => toggleReaderTts(), 700); }
  };
  state.reader.ttsPlaying = true;
  const btn = document.getElementById('ttsPlayBtn'); if (btn) btn.textContent = '正在朗读（点暂停）';
  window.speechSynthesis.speak(u);
  closeSheet('sheet-tts'); showToast('已开始听书朗读');
}
function stopReaderTts() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  state.reader.ttsPlaying = false;
  clearTimeout(state.reader.ttsTimerId);
  const btn = document.getElementById('ttsPlayBtn'); if (btn) btn.textContent = '开始朗读本页';
}
function setTtsSleepTimer(mins) {
  clearTimeout(state.reader.ttsTimerId);
  if (mins > 0) {
    state.reader.ttsTimerId = setTimeout(() => { stopReaderTts(); showToast('定时听书已自动停止'); }, mins * 60000);
    showToast(`已设置 ${mins} 分钟后停止朗读`);
  }
}

// 书房古籍卦例「一键排成活盘」
async function castCaseFromReaderPage() {
  if (!ensureApiKey()) return;
  const ch = getReaderChapter(state.reader.bookId, state.reader.pageNum);
  const txt = (ch?.content || '').trim();
  if (!txt) return showToast('本页暂无可识别的文字卦例');
  showToast('正在提取本页古例排成互动活盘...');
  try {
    const prompt = `从下面古籍文本中提取第一个六爻卦例，严格按以下 6 行输出（若无具体卦例则回 NONE），严禁星号：
事项：一句话占问之事
月支：单个地支(如卯)
日干支：两个字(如戊辰)
主卦：标准卦名(如地天泰)
动爻：数字用逗号隔开(如3或2,5，静卦写0)
背景：一句话摘录原书条件

原文：
${txt.slice(0, 1500)}`;
    const out = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
    if (out.includes('NONE')) return showToast('本页似乎没有完整的六爻卦例');
    const q = (out.match(/事项[:：](.+)/)?.[1] || '古籍卦例还原').trim();
    const mb = (out.match(/月支[:：]\s*([子丑寅卯辰巳午未申酉戌亥])/)?.[1]) || '卯';
    const dgz = (out.match(/日干支[:：]\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/)?.[1]) || '戊辰';
    const gname = (out.match(/主卦[:：](.+)/)?.[1] || '').trim();
    const movStr = (out.match(/动爻[:：](.+)/)?.[1] || '0').trim();
    const bg = (out.match(/背景[:：](.+)/)?.[1] || '').trim();
    const hex = HEX_DATA.list.find(h => gname.includes(h.name) || h.name.includes(gname)) || HEX_DATA.byKey['0_7'];
    const moving = (movStr.match(/[1-6]/g) || []).map(Number);
    const xk = getXunKongOfGz(dgz);
    const book = state.books.find(b => b.id === state.reader.bookId);
    closeReader();
    openLiuyaoResult({
      id: uid('arc'), category: '六爻', title: `【古例】${q}`, question: q, dir: '古例研习',
      personName: `《${book?.title || '古籍'}》P.${state.reader.pageNum}`, gender: '男', group: '默认',
      createdAt: Date.now(), castTimeStr: `${mb}月 ${dgz}日`, lunarStr: '古籍还原', lunarFull: `${mb}月 ${dgz}日（古例）`,
      contextText: bg,
      data: { mainKey: hex.key, moving, yearGz: '古例', monthGz: '正' + mb, dayGz: dgz, hourGz: '午时', xunkong: xk, simMonthBranch: mb, simDayBranch: dgz[1], lockedYongshenPos: null },
      reports: [], note: '', outcome: '', verdict: 'pending'
    }, false);
    showToast(`已将古例【${hex.name}】还原为互动活盘`);
  } catch (e) { showToast('提取失败：' + e.message); }
}

function tapReaderPara(e, pNum, idx, kind) {
  e.stopPropagation();
  const ch = getReaderChapter(state.reader.bookId, pNum);
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
  document.getElementById('tagTipBody').textContent = '正在用最接地气的例子为你拆解...';
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
  document.getElementById('chatInput').value = `精讲《${b?.title || ''}》里这一段，告诉我实战怎么用：\n「${txt}」`; sendCanwuMessage();
}
function paraActionNote() {
  const b = state.books.find(x => x.id === state.reader.bookId);
  document.getElementById('selPopover').classList.remove('show');
  createAndOpenNote({ title: state.reader.activeParaText.slice(0, 16), body: `${state.reader.activeParaText}\n\n出处：《${b?.title || ''}》第${state.reader.pageNum}页` });
}

function readerStep(d) {
  const n = state.reader.pageNum + d;
  if (n < 1 || n > state.reader.totalPages) return showToast(d < 0 ? '已是第一页' : '已是最后一页');
  state.reader.pageNum = n;
  if (state.reader.readMode !== 'orig' && !state.reader.pdfMode) setReaderReadMode(state.reader.readMode);
  else renderReaderPage();
}
function readerJump(p) {
  state.reader.pageNum = p;
  if (state.reader.readMode !== 'orig' && !state.reader.pdfMode) setReaderReadMode(state.reader.readMode);
  else renderReaderPage();
}
function openReaderToc() { renderReaderToc('ch'); openSheet('sheet-toc'); }
function renderReaderToc(tab) {
  document.getElementById('tocTabCh').classList.toggle('active', tab === 'ch');
  document.getElementById('tocTabBm').classList.toggle('active', tab === 'bm');
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  if (tab === 'bm') {
    const bms = book.bookmarks || [];
    document.getElementById('readerTocList').innerHTML = !bms.length ? '<div class="empty-box" style="padding:20px;"><p>暂无书签，点底部「设置 -> + 存书签」添加</p></div>' : bms.map(bm => `<div style="padding:11px 4px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;cursor:pointer;font-size:14px;" onclick="readerJump(${bm.pageNum});closeSheet('sheet-toc')"><span>${escapeHtml(bm.title)}</span><span style="color:var(--text-3);">P.${bm.pageNum}</span></div>`).join('');
  } else {
    const toc = book.toc?.length ? book.toc : state.chapters.filter(c => c.bookId === book.id).slice(0, 180).map(c => ({ title: c.title, pageNum: c.pageNum }));
    document.getElementById('readerTocList').innerHTML = toc.map(t => `<div style="padding:11px 4px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;cursor:pointer;font-size:14px;color:${t.pageNum===state.reader.pageNum?'var(--accent)':'inherit'};font-weight:${t.pageNum===state.reader.pageNum?'700':'400'};" onclick="readerJump(${t.pageNum});closeSheet('sheet-toc')"><span>${escapeHtml(t.title)}</span><span style="color:var(--text-3);">P.${t.pageNum}</span></div>`).join('');
  }
}
async function toggleCurrentPageBookmark() {
  const book = state.books.find(b => b.id === state.reader.bookId); if (!book) return;
  if (!Array.isArray(book.bookmarks)) book.bookmarks = [];
  const p = state.reader.pageNum, ch = getReaderChapter(book.id, p);
  const exists = book.bookmarks.findIndex(x => x.pageNum === p);
  if (exists >= 0) { book.bookmarks.splice(exists, 1); showToast('已取消本页书签'); }
  else { book.bookmarks.unshift({ pageNum: p, title: ch?.title || `第 ${p} 页`, createdAt: Date.now() }); showToast('已加入书签'); }
  await dbPut('books', book);
}
function openTypoSheet() { applyTypoSettings(); openSheet('sheet-typo'); }
function applyTypoSettings() {
  const s = state.settings;
  document.getElementById('readerOverlay').setAttribute('data-paper', s.paper || 'warm');
  const veil = document.getElementById('readerDimVeil');
  if (veil) veil.style.opacity = String(Math.max(0, (100 - (s.brightness || 100)) / 100 * 0.65));
  const wrap = document.getElementById('readerContentWrap');
  if (wrap) { wrap.style.paddingLeft = (s.padX || 22) + 'px'; wrap.style.paddingRight = (s.padX || 22) + 'px'; }
  const st = document.getElementById('readerTextStage');
  st.style.fontSize = (s.fontSize || 17.5) + 'px';
  st.style.lineHeight = s.lineHeight || 1.92;
  const famMap = { serif: '"Songti SC","STSong","Noto Serif SC",Georgia,serif', kai: '"Kaiti SC","STKaiti","KaiTi",serif', sans: '-apple-system,"PingFang SC",sans-serif' };
  st.style.fontFamily = famMap[s.fontFam || 'serif'] || famMap.serif;
  const elS = document.getElementById('typoSizeVal'); if (elS) elS.textContent = s.fontSize || 17.5;
  const elSR = document.getElementById('typoSizeRange'); if (elSR) elSR.value = s.fontSize || 17.5;
  const elB = document.getElementById('typoBrightVal'); if (elB) elB.textContent = s.brightness || 100;
  const elBR = document.getElementById('typoBrightRange'); if (elBR) elBR.value = s.brightness || 100;
  const elL = document.getElementById('typoLineSel'); if (elL) elL.value = String(s.lineHeight || 1.92);
  const elP = document.getElementById('typoPadSel'); if (elP) elP.value = String(s.padX || 22);
  document.getElementById('pmScrollBtn')?.classList.toggle('accent', (s.pageMode || 'scroll') === 'scroll');
  document.getElementById('pmSwipeBtn')?.classList.toggle('accent', s.pageMode === 'swipe');
  document.querySelectorAll('#sheet-typo .paper-dot').forEach(d => d.classList.toggle('active', d.dataset.p === (s.paper || 'warm')));
}
async function updateTypo(k, v) {
  state.settings[k] = v; applyTypoSettings(); await saveSettingsMeta();
  if (k === 'pageMode') renderReaderPage();
}

// ==================== 5. 研习重构：实战在前 + 断法库在后（七门阶梯 + 六十甲子日 + AI 缺口扫描） ====================
let studyHeaderUpgraded = false;
function ensureStudyHeaderPracticeFirst() {
  if (studyHeaderUpgraded) return;
  studyHeaderUpgraded = true;
  if (!state.studySubInited) {
    state.studySubInited = true;
    state.studySub = 'practice';
  }
  const segWrap = document.querySelector('#view-study .seg-wrap');
  if (segWrap) {
    segWrap.innerHTML = `
      <div class="seg-slider" id="studySlider"></div>
      <button class="seg-btn ${state.studySub==='practice'?'active':''}" data-ssub="practice" onclick="switchStudySub('practice')">实战演习</button>
      <button class="seg-btn ${state.studySub==='kb'?'active':''}" data-ssub="kb" onclick="switchStudySub('kb')">断法库</button>
    `;
    const sl = document.getElementById('studySlider');
    if (sl) sl.style.transform = `translateX(${state.studySub === 'practice' ? 0 : 100}%)`;
  }
}

const SIXTY_JIAZI = [
  '甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
  '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
  '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
  '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
  '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
  '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'
];

const JIAZI_CORE_NOTES = {
  '甲子': '甲木坐子水正印（沐浴），天资聪颖、自尊心强，重面子与体面；子水生木主贵人暗助，但冬季水冷木寒需见丙丁火暖局方成栋梁。',
  '乙丑': '乙木坐丑土偏财（衰地），外柔内韧、务实能忍；丑为湿土暗藏辛金七杀与癸水偏印，内心城府较深，理财稳健，感情易藏心事。',
  '丙寅': '丙火坐寅木偏印长生，阳光爽朗、行动力极强；木火通明主才华外露，但性急易冲动，宜有水土调和防过于刚燥。',
  '丁卯': '丁火坐卯木偏印（病地），细腻敏锐、直觉极准；心思深沉重精神共鸣，适合专研技术、文化与谋略，忌过多印星压制表达。',
  '戊辰': '戊土坐辰土比肩水库，沉稳厚重、抗压极强；辰为湿土藏乙木正官与癸水正财，表面随和实则极有主见，大器晚成居多。',
  '己巳': '己土坐巳火正印帝旺，聪明机敏、善于资源整合；火土相生主有贵人庇护，但易操心过度，需防土燥缺水润泽。',
  '庚午': '庚金坐午火正官（沐浴），刚毅果敢、好胜心强；火炼真金主能扛高压与管理重任，感情上容易外冷内热、掌控欲偏强。',
  '辛未': '辛金坐未土偏印（衰地），精致讲究、骨子里极要强；未为燥土藏丁火七杀，外显温和实则防备心重，喜壬癸水淘洗显贵气。',
  '壬申': '壬水坐申金偏印长生，思维活络、应变极快；金生水旺主奔波见世面，适合流动、销售、跨界行业，忌水泛无土制。',
  '癸酉': '癸水坐酉金偏印（病地），清冷敏锐、审美与洞察力俱佳；偏印贴身主爱钻研冷门学问，情感慢热但极重细节与真诚。',
  '甲戌': '甲木坐戌土偏财火库，自坐财库主有商业直觉与野心；戌为燥土藏辛金正官，做事讲规矩又敢搏机会，喜水润土生木。',
  '乙亥': '乙木坐亥水正印死地，温和善良、适应力强；水木相生主重情义、有长辈或平台托举，但易优柔寡断，喜丙火照暖去湿。'
};

function getJiaziBrief(gz) {
  if (JIAZI_CORE_NOTES[gz]) return JIAZI_CORE_NOTES[gz];
  const stem = gz[0], branch = gz[1];
  const stemDesc = {
    '甲':'栋梁之木，主直爽担当','乙':'花草之木，主柔韧变通','丙':'太阳之火，主热烈爽朗','丁':'灯烛之火，主细腻专注',
    '戊':'城墙之土，主厚重稳健','己':'田园之土，主包容务实','庚':'斧钺之金，主果断刚毅','辛':'珠玉之金，主精致敏锐',
    '壬':'江河之水，主灵动奔放','癸':'雨露之水，主清润深思'
  }[stem] || '';
  const brDesc = {
    '子':'坐子水桃花，心思活络','丑':'坐丑土湿库，耐力极强','寅':'坐寅木驿马，进取心强','卯':'坐卯木桃花，重情审美',
    '辰':'坐辰土水库，胸怀主见','巳':'坐巳火驿马，机敏多变','午':'坐午火桃花，热情好胜','未':'坐未土燥库，外柔内刚',
    '申':'坐申金驿马，果敢善谋','酉':'坐酉金桃花，挑剔重质','戌':'坐戌土火库，原则性强','亥':'坐亥水驿马，包容善悟'
  }[branch] || '';
  return `${gz}日柱：天干${stemDesc}，地支${brDesc}。点下方按钮可让 AI 按《三命通会》与实战口诀展开完整男女命特点、婚恋与财官断法（生成一次永久缓存）。`;
}

const LADDER_KB = {
  '六爻': [
    { stage: '第一阶 · 零基础筑基（1+1 入门）', sub: '认清装卦、五行反常与日月权限', items: [
      { id:'ly_1', title:'1. 阴阳爻、八卦本象与装卦', source:'周易 · 增删卜易', summary:'看懂少阳/少阴/老阳/老阴，明白六爻是怎么从下往上装出地支、六亲与世应的。',
        content:'【一、底层气机】\n六爻起卦永远从下往上排：最底下叫初爻，最顶上叫上爻。实线是阳爻，断线是阴爻；老阳（○）会变成阴爻，老阴（×）会变成阳爻，这就是「动爻」。\n\n【二、核心骨架】\n1. 先定卦宫：六十四卦分属乾、兑、离、震、巽、坎、艮、坤八宫，卦宫的五行决定全卦「我」的基准。\n2. 纳甲装地支与六亲：生我者父母、同我者兄弟、我生者子孙、我克者妻财、克我者官鬼。\n3. 世应定位：世爻永远是你自己（求测人），应爻代表对方、目标、环境或客户。\n\n【三、新手第一条铁律】\n先分清静卦还是动卦：没动爻看日月生克与世应；有动爻，一切变数和突破口都在动爻身上（神兆机于动）。' },
      { id:'ly_2', title:'2. 五行生克与反常边界', source:'通用底蕴 · 增删卜易', summary:'不止背木生火，核心在搞懂「木多火塞、燥土不生金」以及六爻与八字的应用差异。',
        content:'【一、底层气机】\n五行是能量的五种运动态：木主生发，火主扩散，土主承载，金主收敛，水主潜藏。\n\n【二、实战判据与反常】\n1. 相生并非一律为吉：木太旺火极微叫「木多火塞」；土太厚金极微叫「土重埋金」；水太泛木无根叫「水多木漂」。\n2. 燥土不生金：夏月未戌带火气，见金反脆克；湿土辰丑晦火生金。\n3. 当令定真假：六爻里生克权由月建、日辰、动爻三级决定，休囚静爻无力生克他爻。' },
      { id:'ly_3', title:'3. 月建与日辰的权限铁律', source:'增删卜易 · 四时旺相章', summary:'月建管当月兴衰，日辰管六爻冲合与长久生克，权限绝不能混为一谈。',
        content:'【一、底层气机】\n月建是当季大环境（提纲），决定六爻基本盘旺相休囚；日辰是当下主宰，拥有全天候生克冲合最高执行权。\n\n【二、实战判据】\n1. 月冲为【月破】：当月无力，但临日辰、得日生合或发动化回头生/化进神属「破而有救」，出月填实即应。\n2. 日冲分两种：冲旺相静爻为【暗动】（如明动有力）；冲休囚静爻为【日破】（散气无用）。\n3. 动爻逢日合为【合绊】（短期牵绊），静爻逢日合为【合起】（唤醒增强）。' },
      { id:'ly_4', title:'4. 六神象意（青龙至玄武）', source:'古筮真诠 · 细节层', summary:'六神绝不能定吉凶，它的真正威力是用来还原现场细节、人品心性与事态氛围。', content:'' }
    ]},
    { stage: '第二阶 · 核心断法（实战主力）', sub: '掌握这五节即可独立上手断卦', items: [
      { id:'ly_5', title:'5. 取用神与世爻兼看总诀', source:'增删卜易 · 用神章', summary:'用神定事情本身好不好，世爻定「你能不能拿到手」，只看一边必断反。',
        content:'【一、核心取用】\n求财利润看妻财；合同中标、考试证书、房产车辆看父母；求职升迁、官司上司看官鬼；治病解忧、客户财源看子孙；竞争同行、合伙分利看兄弟。\n\n【二、世用关系铁律】\n1. 用神旺相但克世，或世爻休囚化回头克：主「机会虽好，我没实力接住，或接了反成拖累」。\n2. 兄弟持世测求财：未必一定破财，若子孙发动生财或财旺生世，反主靠自己操心跑动挣钱。' },
      { id:'ly_6', title:'6. 旬空真假与避空秘诀', source:'增删卜易 · 旬空章', summary:'旺相之空与动而之空只是「时间未到」，忌神落空反而是保命符。',
        content:'【一、真假空辨析】\n1. 假空（必应事）：旺相之空、发动之空、得日辰动爻生扶之空。只管应期，出空、填实、冲空之日兑现。\n2. 真空（到底空）：月破之空、休囚无气又受克之空、伏藏受克之空。\n3. 动不为空，冲空则实。\n\n【二、避空救命】\n忌神发动来克用神时，若用神刚好旬空（或忌神化空），等于用神躲进防空洞避开伤害，短期平安。' },
      { id:'ly_7', title:'7. 化进神、化退神与回头生克', source:'增删卜易 · 进退神章', summary:'变爻决定未来趋势：化进越走越宽，化退虎头蛇尾，忌神化退反为大喜。',
        content:'【一、动变四象】\n1. 化进神（亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌、戌化丑）：由弱转强、规模扩大。\n2. 化退神（子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未、丑化戌）：热情降温、中途撤回；测官司疾病遇官鬼化退反大吉。\n3. 回头生：源源不断助力；回头克：自伤崩盘，哪怕当下月日旺相也极易功败垂成。' },
      { id:'ly_8', title:'8. 暗动、日破与反吟伏吟', source:'增删卜易 · 暗动与反伏吟', summary:'静爻里的隐形发动机，以及一卦反复折腾（反吟）与卡死不动（伏吟）的破解法。', content:'' },
      { id:'ly_8b', title:'9. 六合卦与六冲卦实战用法', source:'增删卜易 · 六冲六合章', summary:'近病逢冲即愈、久病逢冲则危；测合作宜合不宜冲，测散伙官司反喜冲。', content:'' }
    ]},
    { stage: '第三阶 · 高阶精断与分类断法', sub: '多动爻、伏神应期与分事项实战', items: [
      { id:'ly_9', title:'10. 多爻齐动与三合局简化', source:'古筮真诠 · 动变核心', summary:'一卦三四个动爻怎么理清？「剔废爻 → 抓通关 → 定三合」三步秒解。',
        content:'【一、三步简化法】\n1. 剔除无用动爻：动化回头克、化绝、化破且无日月救应者，自顾不暇，先从吉凶主线剔除（留作细节象意）。\n2. 抓连环相生（通关）：如兄弟动克财，但子孙同时发动，构成兄生子、子生财，坏事变好事。\n3. 优先论三合局：三爻齐动或两动一变成三合局时，整体五行力量远大于单个散爻。' },
      { id:'ly_10', title:'11. 飞伏神出伏六法与应期铁律', source:'增删卜易 · 飞伏与应期', summary:'用神不上卦藏在伏神里怎么看，以及断准哪天出结果的 5 条应期铁律。',
        content:'【一、伏神出伏六法】\n1.伏神得日月生扶；2.伏神旺相；3.飞神生伏神；4.动爻生伏神；5.日月动爻冲克飞神；6.飞神空破休囚墓绝。\n\n【二、应期五铁律】\n1. 用神静：逢冲、逢值日应。\n2. 用神动：逢合、逢值日应。\n3. 用神空：出空、填实、冲空日应。\n4. 用神入墓：冲墓日应。\n5. 忌神阻隔：克忌神或通关日应。' },
      { id:'ly_11', title:'12. 求财与合作项目专项断法', source:'增删卜易 · 求财章', summary:'区分稳定薪资、提成销售与合伙投资，看懂子孙财源与兄弟劫财的真假。', content:'' },
      { id:'ly_12', title:'13. 感情婚姻与职场升迁专项断法', source:'古筮真诠 · 分类实战', summary:'如何从同一卦里读出对方真实心态、隐藏竞争对手、复合几率与谈判底牌。', content:'' }
    ]}
  ],
  '八字': [
    { stage: '第一阶 · 零基础筑基（1+1 入门）', sub: '吃透干支本象、十神与藏干根气', items: [
      { id:'bz_1', title:'1. 十天干与十二地支本象', source:'滴天髓 · 天干地支', summary:'甲木参天、丙火太阳、壬水江河——记住干支性格，命盘才不再是一堆冷冰冰的字。',
        content:'【一、十天干直觉象意】\n甲木栋梁刚直、乙木花草柔韧；丙火太阳普照、丁火灯烛专注；戊土城墙厚重、己土田园包容；庚金斧钺刚猛、辛金珠玉精致；壬水江河奔放、癸水雨露细腻。\n\n【二、十二地支与四季】\n寅卯辰为春木、巳午未为夏火、申酉戌为秋金、亥子丑为冬水。辰戌丑未为四墓库，既主土性，也暗藏余气与仓库。' },
      { id:'bz_2', title:'2. 十神心性与现代实战象意', source:'子平真诠 · 十神篇', summary:'跳出刻板印象，读懂十神在职场、合作和感情里的真实投射。',
        content:'【一、现代实战象意】\n1. 正官重规则体面；七杀主高压野心与破局魄力（食神制杀或印星化杀反成大器）。\n2. 食神主温和才华与稳定输出；伤官主锋芒颠覆与强表达欲（最忌无制撞正官）。\n3. 正财主稳健积累；偏财主风口资源与大起大落。\n4. 正印主贵人学历安全感；偏印主冷门直觉与深度钻研（忌旺夺食神）。' },
      { id:'bz_3', title:'3. 地支藏干、人元司令与根气', source:'子平真诠 · 藏干篇', summary:'为什么天干虚浮无根就不成大气候？搞懂地支里藏着的本气、中气与余气。', content:'' }
    ]},
    { stage: '第二阶 · 核心断法（格局、调候与化解）', sub: '告别盲目数五行，直击命局核心', items: [
      { id:'bz_5', title:'4. 月令格局与寒暖调候为急', source:'穷通宝鉴 · 滴天髓', summary:'看八字先看冬暖夏润（调候）与月令格局成败，绝不盲目「缺啥补啥」。',
        content:'【一、调候为急】\n冬生（亥子丑月）冰天雪地急需丙丁火暖局；夏生（巳午未月）炎燥焦枯急需壬癸水润根。\n\n【二、顺用与逆用】\n财官印食四吉神当令宜顺用生护；杀伤劫刃四凶神当令宜逆用制化（如伤官配印、食神制杀）。' },
      { id:'bz_6', title:'5. 地支刑冲合害与暗合优先级', source:'滴天髓 · 盲派理法', summary:'三合、六合、六冲、相穿、相刑同时出现时，谁先起作用、谁破坏力最隐蔽？',
        content:'【一、作用铁律】\n1. 紧贴力量最大，隔位减半，遥隔极弱。\n2. 冲能解合、合能解冲。\n3. 相穿（子未、丑午、寅巳、卯辰、申亥、酉戌）破坏力极隐蔽，在婚姻宫或财官位易主暗生内耗。\n4. 辰戌丑未四墓库藏财官时，逢冲反主开库爆发。' },
      { id:'bz_7', title:'6. 比劫夺财、伤官见官与枭神夺食化解', source:'八字实战化解', summary:'遇到这三大高频凶格时，实战怎么看通关救应与现实规避策略？', content:'' }
    ]},
    { stage: '第三阶 · 分类实战专题（事业/婚恋/学业/岁运）', sub: '落到具体事项与流年应期', items: [
      { id:'bz_9', title:'7. 大运流年与岁运并临引动铁律', source:'命理实战总诀', summary:'原局是车，大运是路，流年是红绿灯：看懂伏吟、反吟与岁运并临的真实吉凶。',
        content:'【一、引动规则】\n1. 原局本没有的，流年难凭空造大局；大事发生往往是流年把原局里的财官或夫妻宫引动、合出或冲开。\n2. 伏吟主反复停滞或双份变动；反吟（天克地冲）主剧烈换赛道、换城市或情感大转折。\n3. 岁运并临未必凶，核心看这个干支是喜神还是忌神。' },
      { id:'bz_10', title:'8. 事业财运与适合赛道断法', source:'子平实战专题', summary:'看一个人适合打工拿死工资、考编体制内，还是做销售创业整合资源。', content:'' },
      { id:'bz_11', title:'9. 婚姻感情与配偶宫实战', source:'命理实战专题', summary:'看配偶星、夫妻宫刑冲穿合，以及婚期与情感波动的流年信号。', content:'' },
      { id:'bz_12', title:'10. 读书学历与考运断法', source:'命理实战专题', summary:'印星、食伤与官杀如何配合看学习耐力、考场发挥与学历层次。', content:'' }
    ]}
  ],
  '奇门': [
    { stage: '第一阶 · 筑基与四层读盘', sub: '九宫、三奇六仪、八门九星八神', items: [
      { id:'qm_1', title:'1. 洛书九宫与三奇六仪排布', source:'奇门遁甲统宗', summary:'搞懂九宫方位，以及乙丙丁三奇、戊己庚辛壬癸六仪的实战象意。', content:'' },
      { id:'qm_2', title:'2. 八门、九星与八神四层骨架', source:'奇门遁甲统宗', summary:'按「八门看人事、九星看大势、八神看暗力、天干看细节」四层读盘。',
        content:'【一、四层读盘顺序】\n1. 八门（人事核心）：开（启动）、休（贵人）、生（利润）三吉门；伤（竞争）、杜（隐秘技术）、景（方案文书）、死（停滞地产）、惊（口舌）。\n2. 九星（天时大势）：天心谋略、天辅文教、天任稳健；天芮主病灶问题，天蓬主冒险破财。\n3. 八神（暗中气场）：值符大贵人、六合合作中介、太阴暗助、九天高调远行、九地稳守、白虎压力、玄武暧昧欺瞒、螣蛇纠缠虚惊。' }
    ]},
    { stage: '第二阶 · 实战核心断法', sub: '取用神、四害警示与谈判策略', items: [
      { id:'qm_3', title:'3. 日干、时干与年命取用铁律', source:'奇门实战心法', summary:'日干是我、时干是事、年命定最终个人落点，看三宫生克定成败。', content:'' },
      { id:'qm_4', title:'4. 奇门四害：门迫、击刑、入墓、空亡', source:'奇门遁甲实战', summary:'盘面上标红的迫、刑、墓、空到底代表什么现实卡点，遇到怎么化解？', content:'' }
    ]}
  ],
  '梅花': [
    { stage: '第一阶 · 筑基与体用生克', sub: '八卦类象与本互变三卦流程', items: [
      { id:'mh_1', title:'1. 先天八卦数与万物类象', source:'梅花易数原典', summary:'乾一兑二离三震四巽五坎六艮七坤八，记熟八卦对应的身体、人物、物品与颜色。', content:'' },
      { id:'mh_2', title:'2. 体用生克与本互变三卦流程', source:'梅花易数原典', summary:'静为体（我）、动为用（事），本卦看开端、互卦看过程、变卦看最终结局。',
        content:'【一、核心骨架】\n1. 动爻所在半卦为【用卦】，静的那半卦为【体卦】。\n2. 五种生克：用生体大吉、体用比和顺遂、体克用费力可成、体生用耗泄破财、用克体受阻受损。\n3. 必须三卦连看：本卦体克用但变卦反克体，必主虎头蛇尾。\n4. 紧扣月令旺衰：春木体纵遇秋金用克，在春月木旺金囚反克不动。' }
    ]},
    { stage: '第二阶 · 外应与应期', sub: '一念起卦与精准落点', items: [
      { id:'mh_3', title:'3. 梅花外应与应期推算心法', source:'梅花实战', summary:'声音、颜色、方位小插曲怎么当外应直断，以及结合行坐卧态定快慢应期。', content:'' }
    ]}
  ],
  '六壬': [
    { stage: '第一阶 · 筑基与核心断法', sub: '四课三传、十二天将与毕法赋', items: [
      { id:'lr_1', title:'1. 月将、贵人与四课三传结构', source:'大六壬指南', summary:'搞懂干上神（人）、支上神（事/宅），以及初传发端、中传过程、末传归宿。', content:'' },
      { id:'lr_2', title:'2. 十二天将与九宗门课体精要', source:'六壬大全', summary:'青龙白虎朱雀玄武核心象意，以及贼克、比用、涉害、遥克等发传纲领。', content:'' }
    ]}
  ],
  '紫微': [
    { stage: '第一阶 · 筑基与核心断法', sub: '三方四正、十四主星与四化飞星', items: [
      { id:'zw_1', title:'1. 十二宫位、三方四正与十四主星', source:'紫微斗数全书', summary:'看命宫必须同时看迁移、官禄、财帛，分辨紫府武相与杀破狼核心气质。', content:'' },
      { id:'zw_2', title:'2. 禄权科忌四化与大限流年叠宫', source:'飞星紫微', summary:'化禄财源、化权掌控、化科贵人、化忌卡点，以及三盘叠宫定位应事。', content:'' }
    ]}
  ],
  '风水': [
    { stage: '第一阶 · 峦头与理气实战', sub: '形法、二十四山与玄空飞星', items: [
      { id:'fs_1', title:'1. 峦头形法与商品房户型避坑', source:'阳宅三要', summary:'先看户型缺角、穿堂煞、门冲灶等肉眼可见的形峦问题与务实化解。', content:'' },
      { id:'fs_2', title:'2. 二十四山罗盘实测与玄空九宫飞星', source:'沈氏玄空学', summary:'避开磁场干扰测准坐山朝向，掌握八白九紫催旺与五黄二黑宜静铁律。', content:'' }
    ]}
  ]
};

function getMergedStudyKB() {
  const res = {};
  CATEGORIES.forEach(cat => {
    const stages = JSON.parse(JSON.stringify(LADDER_KB[cat] || []));
    const customs = (state.customDict || []).filter(x => x.group === cat || (x.group || '').startsWith(cat));
    if (customs.length) {
      stages.push({
        stage: '自扩专题 · AI 查漏补缺与私藏精讲', sub: '已永久存入你本地断法库的补充章节',
        items: customs.map(c => ({ id: c.id, title: c.name, source: c.source || 'AI 查漏补缺', summary: (c.content || '').replace(/\n+/g, ' ').slice(0, 56) + '...', content: c.content }))
      });
    }
    res[cat] = stages;
  });
  return res;
}

function getAllFlatArticlesForCat(cat) {
  const stages = getMergedStudyKB()[cat] || [];
  const flat = [];
  stages.forEach(st => st.items.forEach(it => flat.push({ ...it, cat, stage: st.stage })));
  return flat;
}

function switchStudySub(sub) {
  ensureStudyHeaderPracticeFirst();
  state.studySub = sub;
  const sl = document.getElementById('studySlider');
  if (sl) sl.style.transform = `translateX(${sub === 'practice' ? 0 : 100}%)`;
  document.querySelectorAll('#view-study .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.ssub === sub));
  renderStudyView();
}

function renderStudyView() {
  ensureStudyHeaderPracticeFirst();
  const wrap = document.getElementById('studyScrollArea');
  if (state.studySub === 'practice') {
    renderPracticeHub(wrap);
  } else {
    renderDuanfaLibrary(wrap);
  }
}

function renderDuanfaLibrary(wrap) {
  const cat = state.studyCat || '六爻';
  const subTab = state.duanfaSubTab || 'ladder';
  const stages = getMergedStudyKB()[cat] || [];
  const hasExtraTab = (cat === '八字' || cat === '六爻');
  const extraLabel = cat === '八字' ? '六十甲子日精解' : '六十四卦速查';

  let bodyHtml = '';
  if (cat === '八字' && subTab === 'jiazi') {
    const selJz = state.selJiazi || '甲子';
    const cachedJz = state.settings.kbGenCache?.['jz_' + selJz] || '';
    bodyHtml = `
      <div class="card" style="padding:14px;">
        <div class="card-head" style="margin-bottom:8px;">
          <span class="card-title">六十甲子日柱速查</span>
          <span style="font-size:12px;color:var(--text-3);">点任意日柱看精解</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;max-height:176px;overflow-y:auto;padding-bottom:4px;">
          ${SIXTY_JIAZI.map(gz => `<button class="chip ${selJz===gz?'accent':''}" style="padding:6px 2px;font-size:12.5px;justify-content:center;" onclick="state.selJiazi='${gz}';renderStudyView()">${gz}</button>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <span class="card-title">${selJz}日柱 · 实战精解</span>
          <span class="pill-mini xs ${cachedJz?'accent':''}">${cachedJz?'已详编':'速查摘要'}</span>
        </div>
        <div style="font-size:14.8px;line-height:1.85;margin-bottom:12px;">
          ${cachedJz ? formatRichText(cachedJz) : escapeHtml(getJiaziBrief(selJz))}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-primary" style="flex:1;padding:10px;" id="genJiaziBtn" onclick="generateJiaziDeepNote('${selJz}')">${cachedJz ? '重新精编此日柱' : 'AI 展开完整男女命与婚财断法'}</button>
          <button class="btn-secondary" style="padding:10px 14px;" onclick="saveJiaziToNote('${selJz}')">存笔记</button>
        </div>
      </div>
    `;
  } else if (cat === '六爻' && subTab === 'hex64') {
    const kw = (state.hex64Search || '').trim();
    const list = (HEX_DATA?.list || []).filter(h => !kw || h.name.includes(kw) || h.palaceName.includes(kw));
    bodyHtml = `
      <div style="margin-bottom:10px;">
        <input type="text" class="form-input" placeholder="搜卦名或卦宫（如：泰、坎、乾宫）..." value="${escapeHtml(kw)}" oninput="state.hex64Search=this.value;renderStudyView()" />
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
        ${list.map(h => `
          <div class="study-card" style="margin-bottom:0;padding:12px;" onclick="openHex64Detail('${h.key}')">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:15px;">${escapeHtml(h.name)}</strong>
              <span style="font-size:11.5px;color:var(--text-3);">${escapeHtml(h.palaceName)}</span>
            </div>
            <div style="font-size:12px;color:var(--text-2);margin-top:4px;">${h.isChong?'六冲卦':(h.isHe?'六合卦':'常卦')} · 点开看断法象意</div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    const gapList = state.kbGapSuggestions?.[cat] || [];
    bodyHtml = `
      <div class="card" style="padding:12px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="font-size:13px;color:var(--text-2);line-height:1.5;">觉得【${cat}】断法库还不够全？让 AI 对照完整大纲自动扫描缺了哪些知识点。</div>
        <button class="pill-mini accent" style="flex-shrink:0;" id="scanKbGapBtn" onclick="scanKbGapsWithAI('${cat}')">AI 查漏补缺</button>
      </div>
      ${gapList.length ? `
        <div class="card" style="border-color:var(--accent);padding:13px 14px;margin-bottom:12px;">
          <div class="card-head" style="margin-bottom:8px;">
            <span class="card-title" style="color:var(--accent);">AI 扫描出的【${cat}】缺失知识点</span>
            <button style="font-size:12px;color:var(--text-3);" onclick="state.kbGapSuggestions['${cat}']=[];renderStudyView()">收起</button>
          </div>
          ${gapList.map((g, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:600;">${escapeHtml(g.title)}</div>
                <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${escapeHtml(g.reason)}</div>
              </div>
              <button class="pill-mini xs accent" onclick="addGapTopicToKB('${cat}', ${idx}, this)">一键补入</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${stages.map(st => `
        <div class="stage-head"><span class="stage-title">${escapeHtml(st.stage)}</span><span class="stage-sub">${escapeHtml(st.sub)}</span></div>
        ${st.items.map(art => {
          const hasText = Boolean((art.content && art.content.trim()) || state.settings.kbGenCache?.[art.id]);
          return `<div class="study-card" onclick="openArticleById('${cat}','${art.id}')">
            <div class="study-card-top">
              <span class="study-card-title">${escapeHtml(art.title)}</span>
              <span class="pill-mini xs ${hasText?'accent':''}">${hasText ? '已备干货' : '点开精编'}</span>
            </div>
            <div class="study-card-sub">${escapeHtml(art.summary)}</div>
            <div class="study-card-foot">
              <span>出处：${escapeHtml(art.source || '经典理法')}</span>
              <span style="color:var(--accent);font-weight:600;">进入精读 ›</span>
            </div>
          </div>`;
        }).join('')}
      `).join('')}
    `;
  }

  wrap.innerHTML = `
    <div class="cat-strip" style="padding:0 0 8px;">
      ${CATEGORIES.map(c => `<button class="cat-pill ${c===cat?'active':''}" onclick="state.studyCat='${c}';state.duanfaSubTab='ladder';renderStudyView()">${c}</button>`).join('')}
    </div>
    ${hasExtraTab ? `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="chip ${subTab==='ladder'?'accent':''}" onclick="state.duanfaSubTab='ladder';renderStudyView()">阶梯断法</button>
        <button class="chip ${subTab!=='ladder'?'accent':''}" onclick="state.duanfaSubTab='${cat==='八字'?'jiazi':'hex64'}';renderStudyView()">${extraLabel}</button>
      </div>
    ` : ''}
    ${bodyHtml}
  `;
}

async function generateJiaziDeepNote(gz) {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('genJiaziBtn'); if (btn) { btn.disabled = true; btn.textContent = '正在精编此日柱...'; }
  try {
    const prompt = `请你作为资深子平八字老师，深度精讲【${gz}日柱】。
要求按以下四部分输出，讲透大白话、结合现代生活、严禁星号：
【一、干支组合与核心性格】
【二、事业财运与适合赛道】
【三、婚恋特点与配偶宫要点】（分男女命简要点出）
【四、实战避坑与调候要点】`;
    const out = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
    if (!state.settings.kbGenCache) state.settings.kbGenCache = {};
    state.settings.kbGenCache['jz_' + gz] = out;
    await saveSettingsMeta();
    renderStudyView();
    showToast(`${gz}日柱精解已永久缓存`);
  } catch (e) { showToast('生成失败：' + e.message); if (btn) { btn.disabled = false; btn.textContent = '重试精编'; } }
}

function saveJiaziToNote(gz) {
  const txt = state.settings.kbGenCache?.['jz_' + gz] || getJiaziBrief(gz);
  createAndOpenNote({ title: `六十甲子 · ${gz}日柱精解`, body: txt });
}

function openHex64Detail(hexKey) {
  const h = HEX_DATA?.byKey?.[hexKey]; if (!h) return;
  state.activeArticle = {
    id: 'hex64_' + hexKey, cat: '六爻', stage: `六十四卦速查 · ${h.palaceName}`,
    title: `${h.name}（${h.isChong?'六冲':(h.isHe?'六合':'常卦')}）`,
    summary: `本卦属${h.palaceName}，点下方可由 AI 生成实战象意、求财/感情/事业断法要点并永久缓存。`,
    content: ''
  };
  state.activeArticleSource = '通用精讲';
  renderArticleOverlay();
  openOverlay('articleOverlay');
}

async function scanKbGapsWithAI(cat) {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('scanKbGapBtn'); if (btn) { btn.disabled = true; btn.textContent = '扫描中...'; }
  const existingTitles = getAllFlatArticlesForCat(cat).map(x => x.title).join('、');
  try {
    const prompt = `你是严谨的【${cat}】课程总编。用户目前的阶梯断法库已有以下篇目：
${existingTitles}

请对照「从零基础入门到高阶实战」的完整知识体系，挑出 5 个目前最缺失、且实战中极其高频的关键知识点。
严格按下面格式输出 5 行（每行用 || 隔开标题和缺失理由，严禁星号）：
知识点标题||一句话说明为什么必学`;
    const out = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
    const parsed = out.split('\n').map(ln => ln.trim()).filter(ln => ln.includes('||')).slice(0, 6).map(ln => {
      const [t, r] = ln.split('||');
      return { title: (t || '').replace(/^[\d.\s]+/, '').trim(), reason: (r || '').trim() };
    }).filter(x => x.title);
    if (!state.kbGapSuggestions) state.kbGapSuggestions = {};
    state.kbGapSuggestions[cat] = parsed;
    renderStudyView();
    showToast(`已扫出 ${parsed.length} 个可补充知识点`);
  } catch (e) { showToast('扫描失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'AI 查漏补缺'; } }
}

async function addGapTopicToKB(cat, idx, btnEl) {
  if (!ensureApiKey()) return;
  const item = state.kbGapSuggestions?.[cat]?.[idx]; if (!item) return;
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '编写中...'; }
  try {
    const content = (await callLLM([{ role: 'user', content: `请为【${cat}】断法库编写一篇扎实的补充讲义：《${item.title}》（补充原因：${item.reason}）。必须按【一、零基础白话定义】【二、核心判据与实战口诀】【三、真实案例与易错反例】三段写透，讲人话，严禁星号。` }], { tier: 'flash' })).replace(/\*/g, '').trim();
    state.customDict.push({ id: uid('dct'), group: cat, name: item.title, source: 'AI 查漏补缺', content, createdAt: Date.now() });
    await dbPut('meta', { id: 'customDict', data: state.customDict });
    await markDirty();
    state.kbGapSuggestions[cat].splice(idx, 1);
    renderStudyView();
    showToast(`已将《${item.title}》补入${cat}断法库`);
  } catch (e) {
    showToast('补入失败：' + e.message);
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '重试补入'; }
  }
}

function openArticleById(cat, artId) {
  const flat = getAllFlatArticlesForCat(cat);
  const idx = flat.findIndex(x => x.id === artId);
  if (idx < 0) return;
  state.activeArticle = { ...flat[idx], idxInCat: idx, totalInCat: flat.length };
  state.activeArticleSource = '通用精讲';
  renderArticleOverlay();
  openOverlay('articleOverlay');
  markStudyFootprint();
}
function openNextLadderArticle() {
  const art = state.activeArticle; if (!art) return;
  const flat = getAllFlatArticlesForCat(art.cat);
  const next = flat[art.idxInCat + 1];
  if (!next) return showToast('已学完本门当前全部阶梯课程！');
  openArticleById(art.cat, next.id);
}

function renderArticleOverlay() {
  const art = state.activeArticle; if (!art) return;
  document.getElementById('articleOverlayTitle').textContent = `${art.cat} · ${art.title}`;
  const defaultBooksByCat = {
    '六爻': ['《增删卜易》','《古筮真诠》'],
    '八字': ['《穷通宝鉴》','《滴天髓》','《子平真诠》'],
    '奇门': ['《奇门遁甲统宗》','《御定奇门宝鉴》'],
    '梅花': ['《梅花易数》'],
    '六壬': ['《大六壬指南》','《毕法赋》'],
    '紫微': ['《紫微斗数全书》'],
    '风水': ['《沈氏玄空学》','《阳宅三要》']
  };
  const userBooks = state.books.filter(b => b.category === art.cat || b.category === '其他').map(b => `《${b.title}》`);
  const sources = Array.from(new Set(['通用精讲', ...(defaultBooksByCat[art.cat] || []), ...userBooks]));

  let bodyContent = '';
  if (state.activeArticleSource === '通用精讲') {
    bodyContent = (art.content && art.content.trim()) ? art.content : (state.settings.kbGenCache?.[art.id] || '');
  } else {
    bodyContent = state.settings.articleSourceCache?.[`${art.id}_${state.activeArticleSource}`] || '';
  }

  document.getElementById('articleOverlayBody').innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:4px;">${escapeHtml(art.stage || art.cat)}</div>
      <div style="font-family:'Songti SC',serif;font-size:22px;font-weight:700;line-height:1.35;">${escapeHtml(art.title)}</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:6px;">点下方流派或你书房原书，切换对照不同典籍的观点：</div>
      <div class="cat-strip" style="padding:8px 0 4px;">
        ${sources.map(s => `<button class="chip ${state.activeArticleSource===s?'accent':''}" onclick="switchArticleSource('${escapeHtml(s)}')">${escapeHtml(s)}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:19px 17px;font-size:15.5px;line-height:1.9;">
      ${bodyContent ? formatRichText(bodyContent) : (
        state.activeArticleSource === '通用精讲'
          ? `<div class="empty-box" style="padding:26px 8px;"><p>这是【${escapeHtml(art.cat)}】断法库的细分精讲。<br/>点下方按钮，AI 按课本级三层结构（白话定义 / 核心判据与口诀 / 实战案例与易错反例）为你编写长文，生成一次即永久保存在本地。</p><button class="btn-primary" id="genKbLessonBtn" onclick="generateKbArticleOnDemand()">一键生成本节精讲（永久缓存）</button></div>`
          : `<div class="empty-box" style="padding:26px 8px;"><p>从 ${escapeHtml(state.activeArticleSource)} 中提取关于「${escapeHtml(art.title)}」的原书观点与差异对比（生成一次永久缓存）</p><button class="btn-primary" id="fetchSrcBtn" onclick="fetchArticleSourceView()">提取 ${escapeHtml(state.activeArticleSource)} 观点</button></div>`
      )}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
      <button class="btn-secondary" onclick="askCanwuAboutArticle()">就这节问参悟</button>
      <button class="btn-primary" style="padding:10px;" onclick="openNextLadderArticle()">学完，下一节 ›</button>
    </div>
  `;
}

async function generateKbArticleOnDemand() {
  if (!ensureApiKey()) return;
  const art = state.activeArticle; if (!art) return;
  const btn = document.getElementById('genKbLessonBtn'); if (btn) { btn.disabled = true; btn.textContent = '正在编写课本级精讲...'; }
  try {
    const prompt = `你是一位严谨扎实的${art.cat}专业老师，正在编写从零基础到进阶的系统教材。
请为这一节编写一篇扎实、易懂、不浮于表面的深度讲义：
章节：《${art.title}》（所属阶段：${art.stage}，核心概要：${art.summary}）
要求：
1. 必须按【一、零基础白话定义】【二、核心判据与实操口诀】【三、真实小案例与新手必避误区】三大部分写透。
2. 讲人话、举具体干支/爻位例子、绝不讲空话套话，严禁使用星号符号。`;
    const out = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
    if (!state.settings.kbGenCache) state.settings.kbGenCache = {};
    state.settings.kbGenCache[art.id] = out;
    await saveSettingsMeta();
    renderArticleOverlay();
    showToast('本节精讲已永久存入本地断法库');
  } catch (e) { showToast('生成失败：' + e.message); if (btn) { btn.disabled = false; btn.textContent = '重试生成'; } }
}

function switchArticleSource(src) {
  state.activeArticleSource = src;
  renderArticleOverlay();
  if (src !== '通用精讲' && !state.settings.articleSourceCache?.[`${state.activeArticle.id}_${src}`]) fetchArticleSourceView();
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
  const content = state.activeArticleSource === '通用精讲'
    ? (art.content || state.settings.kbGenCache?.[art.id] || '')
    : (state.settings.articleSourceCache?.[`${art.id}_${state.activeArticleSource}`] || '');
  createAndOpenNote({ title: `${art.title}（${state.activeArticleSource}）`, body: content });
}
function askCanwuAboutArticle() {
  const art = state.activeArticle; if (!art) return;
  closeOverlay('articleOverlay'); switchMainTab('canwu'); switchCanwuRoom(art.cat || '六爻');
  document.getElementById('chatInput').value = `结合我的书库，把「${art.title}」里最容易断反的坑举个例子讲透。`; sendCanwuMessage();
}

async function generateAndSaveDictTopic() {
  if (!ensureApiKey()) return;
  const grp = document.getElementById('aiDictGroupSelect').value, topic = document.getElementById('aiDictTopicInput').value.trim();
  if (!topic) return showToast('请输入想深挖的专题');
  const btn = document.getElementById('aiDictGenBtn'); btn.disabled = true; btn.textContent = '正在编撰三层深度干货...';
  try {
    const content = (await callLLM([{ role: 'user', content: `请为私人术数研习库（${grp}门类）编写一篇有深度、不浮于表面的硬核专题：「${topic}」。必须按【一、底层气机】【二、实战判据】【三、常见误区与反例】三段写透，全程用精准通俗的白话，严禁使用星号符号。` }])).replace(/\*/g, '').trim();
    state.customDict.push({ id: uid('dct'), group: grp, name: topic, source: 'AI 专题编撰', content, createdAt: Date.now() });
    await dbPut('meta', { id: 'customDict', data: state.customDict });
    await markDirty();
    document.getElementById('aiDictTopicInput').value = '';
    closeSheet('sheet-ai-dict'); state.studyCat = grp; switchStudySub('kb'); showToast(`已将「${topic}」永久写入${grp}断法库`);
  } catch (e) { showToast('生成失败：' + e.message); }
  finally { btn.disabled = false; btn.textContent = '生成三层干货并永久存入'; }
}

// ==================== 6. 实战演习场：三档阶梯 + 10 题闯关无限续题 + 四种题型 + 七门同步 ====================
const BASE_FLASHCARDS = [
  { cat:'六爻', lvl:'入门', tag:'六爻·月破', q:'寅月戌日测求财，卦中妻财申金静爻被寅月冲破，但得戌日相生。这叫真破还是破而有救？', a:'【破而有救】申金虽在寅月月破，但得日辰戌土生扶，属于「日生救破」。当下寅月暂未成事，出月或逢申日填实、巳日合起即可成。' },
  { cat:'六爻', lvl:'入门', tag:'六爻·暗动', q:'卯月午日，卦中父母子水在卯月休囚，被午日相冲。这叫「暗动」还是「日破」？', a:'【日破】子水在卯月既不当令又不得月生（休囚无气），被日辰午火冲克叫日破，散气无用；只有旺相静爻被日冲才叫暗动。' },
  { cat:'六爻', lvl:'进阶', tag:'六爻·旬空', q:'辰月甲子日（戌亥空），测合作，妻财亥水发动来生世爻。亥水旬空是不是代表没钱赚？', a:'【不是，为假空】动不为空，发动之爻只是当下还没落袋，等到出空、填实（亥日）或冲空（巳日）之时便会兑现。' },
  { cat:'六爻', lvl:'进阶', tag:'六爻·化退神', q:'测讨债或谈客户预算，妻财卯木发动化寅木，这代表什么现实信号？', a:'【化退神】卯化寅主力量衰退、金额缩水、对方态度变冷或准备砍价撤回，需提前做好防备。' },
  { cat:'六爻', lvl:'高阶', tag:'六爻·回头克', q:'测项目合作，妻财寅木在寅月极其旺相，但发动变出申金。还能成吗？', a:'【极难成，主虎头蛇尾】寅木动化申金既是回头克又是反吟冲，属于自身变坏。哪怕当下看着红火，后期极易崩盘散伙。' },
  { cat:'八字', lvl:'入门', tag:'八字·调候', q:'冬月（子月）生人，八字里五行缺水，是不是必须去补水？', a:'【千万别瞎补】子月天寒地冻水气极旺，哪怕天干不见壬癸水也绝非真缺水；此时调候急需丙丁火暖局，乱补水反而越补越寒。' },
  { cat:'八字', lvl:'进阶', tag:'八字·相穿', q:'八字夫妻宫（日支）与月支构成「子未穿」或「丑午穿」，实战通常提示什么？', a:'【暗中内耗与情感别扭】相穿比六冲更隐蔽，往往表现为外人看着好好的，私下却容易互相消耗、沟通错频或突发冷战。' },
  { cat:'八字', lvl:'高阶', tag:'八字·岁运并临', q:'流年和大运干支一模一样（岁运并临），是不是一定有大灾？', a:'【绝非一定】岁运并临只是把该干支的力量瞬间放大一倍：如果是命局喜用神，反主大发横财或连升两级；只有是忌神且刑冲用神时才需防波折。' },
  { cat:'奇门', lvl:'入门', tag:'奇门·四害', q:'奇门排盘时，用神落宫出现「门迫」（如伤门落坤二宫），实战怎么翻译成大白话？', a:'【力不从心、内耗受阻】门克宫叫门迫，好比有冲劲却踩进泥潭里施展不开，事情推进极其别扭费劲。' },
  { cat:'梅花', lvl:'入门', tag:'梅花·三卦', q:'梅花起卦，本卦体克用（看着能成），但变卦却变成用克体，最终怎么断？', a:'【先顺后阻、虎头蛇尾】本卦看开端，变卦才是最终归宿；变卦反克体卦说明后期变数极大，不宜盲目乐观。' },
  { cat:'六壬', lvl:'入门', tag:'六壬·三传', q:'大六壬断事时，初传、中传、末传分别对应事情的哪三个阶段？', a:'【初传发端、中传过程、末传归宿】初传看事情起因和当下切入点，中传看推进波折，末传定最终落袋结局。' },
  { cat:'紫微', lvl:'入门', tag:'紫微·空宫', q:'紫微看命宫时，发现命宫没有主星（空宫），是不是代表命很差？', a:'【绝不是】命无正曜要借对宫（迁移宫）主星来看，且三方四正（财帛、官禄、迁移）吉星云集时，反主适应力极强、可塑性大。' },
  { cat:'风水', lvl:'入门', tag:'风水·五黄', q:'流年玄空飞星查到今年家里正西方是「五黄廉贞星」，最稳妥的处理原则是什么？', a:'【宜静不宜动】五黄位切忌动土装修、敲墙钻孔或放红色/发声震动物件，保持整洁安静即可，必要时可用金属圆润物件泄其土气。' }
];

const BLIND_CASES = [
  { id:'bc1', cat:'六爻', lvl:'入门', source:'《增删卜易》经典例改编', question:'某人占「合伙做生意能否获利？」', monthGz:'卯月', dayGz:'戊辰日', xunkong:'戌亥', mainKey:'0_7', moving:[3], answerYs:'妻财', answerVerdict:'成', masterText:'地天泰变地泽临。世爻辰土临日辰旺相，三爻兄弟辰土虽动，却化出丑土退神，且卦中子孙申金得日辰生扶、暗藏财源。原书断：虽中途有合伙人退缩或口舌分歧，但根基稳固，终可得财。' },
  { id:'bc2', cat:'六爻', lvl:'进阶', source:'《增删卜易》经典例改编', question:'某人占「托人求职能否录用？」', monthGz:'申月', dayGz:'甲午日', xunkong:'辰巳', mainKey:'7_0', moving:[5], answerYs:'官鬼', answerVerdict:'败', masterText:'天地否变火地晋。五爻兄弟申金临月建旺动，动变相悖且世爻无得力生扶，虽看似声势不小实则雷声大雨点小，录用难成。' },
  { id:'bc3', cat:'六爻', lvl:'高阶', source:'实战模拟案例', question:'女占「这段感情后续能稳定发展吗？」', monthGz:'巳月', dayGz:'壬子日', xunkong:'寅卯', mainKey:'3_4', moving:[2], answerYs:'官鬼', answerVerdict:'反复', masterText:'泽山咸变泽风大过。二爻官鬼午火在巳月旺相，但被子日冲克，又动化亥水回头克。前期火热推进快，但动化回头克主男方后期态度明显退却或外部阻力介入，感情极易反复拉扯。' }
];

const YINGQI_CASES = [
  { cat:'六爻', lvl:'入门', tag:'旬空应期', scenario:'辰月甲子日（戌亥空）测货款何时到账：妻财亥水发动来生世爻，无忌神克制。', answer:'【亥日（填实）或巳日（冲空）】发动之空为假空，逢填实或冲空之日即可落袋。' },
  { cat:'六爻', lvl:'进阶', tag:'月破应期', scenario:'寅月戌日测合作签约：父母申金静爻虽在寅月月破，但得戌日相生。大约何时能签下？', answer:'【出寅月之后，或逢申日（填实）、巳日（合起）】日生救破，当月暂缓，出月填实或逢合即应。' },
  { cat:'八字', lvl:'进阶', tag:'墓库逢冲', scenario:'男命日主甲木身强，月支戌土为偏财库且未透干，走入辰土流年时，财运通常怎么动？', answer:'【辰戌冲开财库】原局身强能担财，流年辰土冲开戌库，主该年容易出现大笔资金流动、项目回款或突发商机。' },
  { cat:'奇门', lvl:'进阶', tag:'马星空亡', scenario:'奇门测失物何时找回：时干落乾六宫逢空亡，且马星正好在乾宫。', answer:'【填实或冲空之日，且变动极快】空亡逢马星主「空中有动」，往往在冲空或填实的近几天内突然有消息。' }
];

const FLAW_CASES = [
  { cat:'六爻', lvl:'入门', tag:'旬空误区', statement:'「卯月甲子日（戌亥空）测求财，卦中妻财亥水发动，且得日辰子水比扶。断曰：妻财落入旬空，财星已空，此单生意必无所获，劝君早日放弃。」', trap:'错误在于「见空就断无」。亥水发动且得日辰比扶，属于典型的【假空（动不为空、旺不为空）】，非但不是没戏，反而是出空、填实（亥日）或冲空（巳日）就会落袋得财。' },
  { cat:'六爻', lvl:'进阶', tag:'暗动与日破混淆', statement:'「午月子日测求职，官鬼午火静爻临月建旺相，被日辰子水相冲。断曰：官鬼被日辰冲破，名位受损，此次面试必遭淘汰。」', trap:'把【暗动】错当成了【日破】。官鬼午火临午月极旺，旺相静爻逢日冲叫暗动，不仅没被冲破，反而代表暗中已有动静、很快收到面试或录用消息。' },
  { cat:'六爻', lvl:'进阶', tag:'化退神误判', statement:'「测一场烦人的官司纠纷何时平息，官鬼卯木发动化寅木。断曰：官鬼化退神，主不吉，官司必输。」', trap:'搞反了用神喜忌！测官司、疾病、灾祸时，官鬼是【忌神】（代表麻烦与压力）。忌神化退神代表麻烦自动消退、对手撤诉和解，是大吉之象。' },
  { cat:'八字', lvl:'入门', tag:'八字调候反用', statement:'「乙木日主生于亥月（十月），八字地支见亥子水极旺，但天干不见火，亦缺金。断曰：八字缺金，应多戴金属饰品、往西方补金以平衡五行。」', trap:'犯了机械「缺啥补啥」大忌！亥月乙木水冷木冻，调候急需丙丁火暖局；盲目补金只会金生水旺、克伤寒木，雪上加霜。' }
];

async function recordWeakSpot(tag) {
  if (!tag) return;
  if (!Array.isArray(state.settings.weakSpots)) state.settings.weakSpots = [];
  const exist = state.settings.weakSpots.find(w => w.tag === tag);
  if (exist) { exist.count = (exist.count || 1) + 1; exist.updatedAt = Date.now(); }
  else state.settings.weakSpots.push({ tag, count: 1, updatedAt: Date.now() });
  await saveSettingsMeta();
}

function getPracticeRoundState() {
  if (!state.pracLevel) state.pracLevel = '入门';
  if (typeof state.pracDoneCount !== 'number') state.pracDoneCount = 0;
  if (typeof state.pracRoundTarget !== 'number') state.pracRoundTarget = 10;
  return { lvl: state.pracLevel, done: state.pracDoneCount, target: state.pracRoundTarget };
}

function bumpPracticeProgress() {
  getPracticeRoundState();
  state.pracDoneCount++;
}

function continuePracticeRound(nextLevel) {
  if (nextLevel) state.pracLevel = nextLevel;
  state.pracDoneCount = 0;
  state.pracRoundTarget = 10;
  showToast(`已开启新一轮【${state.studyCat} · ${state.pracLevel}】10 题闯关！`);
  if (state.practiceMode === 'blind') {
    if (state.settings.apiKey) generateAiBlindCaseForCat();
    else nextBlindCase();
  } else if (state.practiceMode === 'flaw') {
    if (state.settings.apiKey) generateNewFlawCase();
    else nextFlawCase();
  } else if (state.practiceMode === 'yingqi') {
    if (state.settings.apiKey) generateNewYingqiCase();
    else nextYingqiCase();
  } else {
    if (state.settings.apiKey) generateNewFlashcard();
    else nextFlashcard();
  }
}

function renderPracticeHub(wrap) {
  const cat = state.studyCat || '六爻';
  const rs = getPracticeRoundState();
  const roundDone = rs.done >= rs.target;
  const nextLvl = rs.lvl === '入门' ? '进阶' : (rs.lvl === '进阶' ? '高阶' : '高阶');

  const topControls = `
    <div class="cat-strip" style="padding:0 0 8px;">
      ${CATEGORIES.map(c => `<button class="cat-pill ${c===cat?'active':''}" onclick="state.studyCat='${c}';state.aiBlindCase=null;renderStudyView()">${c}</button>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="display:flex;gap:6px;">
        ${['入门','进阶','高阶'].map(lv => `<button class="chip ${rs.lvl===lv?'accent':''}" style="padding:5px 11px;font-size:12.5px;" onclick="state.pracLevel='${lv}';renderStudyView()">${lv}</button>`).join('')}
      </div>
      <span style="font-size:12px;color:var(--text-3);">本轮已练 ${Math.min(rs.done, rs.target)} / ${rs.target} 题</span>
    </div>
    ${roundDone ? `
      <div class="card" style="border-color:var(--accent);padding:14px 16px;margin-bottom:12px;">
        <div class="card-title" style="color:var(--accent);margin-bottom:6px;">本轮 10 题已完成，手感正好！</div>
        <div style="font-size:13.5px;color:var(--text-2);margin-bottom:12px;">可继续同难度无限续练，或直接升一阶挑战更复杂的实战盘面。</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="btn-secondary" onclick="continuePracticeRound('${rs.lvl}')">再练 10 题（${rs.lvl}）</button>
          <button class="btn-primary" onclick="continuePracticeRound('${nextLvl}')">${rs.lvl==='高阶'?'继续高阶实战':'升阶挑战（'+nextLvl+'）'}</button>
        </div>
      </div>
    ` : ''}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;">
      ${[['blind','选盘盲断'],['flaw','断语挑刺'],['yingqi','应期推演'],['flash','碎片闪卡']].map(([k,l]) => `<button class="btn-secondary" style="padding:8px 2px;font-size:12.8px;${state.practiceMode===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="state.practiceMode='${k}';renderStudyView()">${l}</button>`).join('')}
    </div>
  `;

  if (state.practiceMode === 'flash') {
    const pool = [...BASE_FLASHCARDS.filter(c => c.cat === cat), ...(state.customFlash || []).filter(c => !c.cat || c.cat === cat)];
    const allCards = pool.length ? pool : BASE_FLASHCARDS;
    const card = allCards[state.flashIdx % allCards.length];
    wrap.innerHTML = topControls + `
      <div class="flashcard-stage" onclick="state.flashFlipped=!state.flashFlipped;renderStudyView()">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="pill-mini xs accent">${escapeHtml(card.tag)}</span>
          <span style="font-size:12px;color:var(--text-3);">第 ${(state.flashIdx % allCards.length) + 1} / ${allCards.length} 题 · 点卡片翻面</span>
        </div>
        <div style="margin:22px 0;font-size:16px;line-height:1.8;font-weight:${state.flashFlipped?'500':'600'};">
          ${state.flashFlipped ? `<div style="font-size:12.5px;color:var(--text-3);margin-bottom:8px;">解析答案</div>${formatRichText(card.a)}` : escapeHtml(card.q)}
        </div>
        <div style="text-align:center;font-size:12px;color:var(--text-3);">${state.flashFlipped ? '没吃透点「没记住」，AI 断盘时会重点提醒你' : '先在脑子里默想答案，再点卡片翻面'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <button class="btn-secondary" style="color:var(--seal);" onclick="markFlashWeak('${escapeHtml(card.tag)}')">没记住（记盲区）</button>
        <button class="btn-primary" onclick="bumpPracticeProgress();nextFlashcard()">秒懂，下一张 ›</button>
      </div>
      <button class="btn-secondary" style="width:100%;" id="genFlashBtn" onclick="generateNewFlashcard()">+ AI 按【${cat}·${rs.lvl}】再出一张新卡</button>
    `;
  } else if (state.practiceMode === 'blind') {
    if (cat === '六爻' && !state.aiBlindCase) {
      if (!state.blindCase) state.blindCase = BLIND_CASES[0];
      const bc = state.blindCase, mh = HEX_DATA.byKey[bc.mainKey];
      const exam = runLiuyaoPhysicalExam(mh, new Set(bc.moving || []), bc.monthGz[0], bc.dayGz[1], bc.xunkong);
      wrap.innerHTML = topControls + `
        <div class="card">
          <div class="card-head">
            <span class="card-title">遮住答案，先自己盲断</span>
            <div style="display:flex;gap:6px;">
              <button class="pill-mini xs" onclick="nextBlindCase()">换一例</button>
              <button class="pill-mini xs accent" id="bookBlindBtn" onclick="extractBlindCaseFromBooks()">从我书里抽</button>
              <button class="pill-mini xs accent" id="aiBlindGenBtn" onclick="generateAiBlindCaseForCat()">AI 出新卦</button>
            </div>
          </div>
          <div style="font-size:12.5px;color:var(--text-3);margin-bottom:6px;">出处：${escapeHtml(bc.source)} · 难度：${escapeHtml(bc.lvl || rs.lvl)}</div>
          <div style="font-size:15.5px;font-weight:700;margin-bottom:8px;">${escapeHtml(bc.question)}</div>
          <div class="gz-banner" style="margin:6px 0 10px;">${bc.monthGz} · ${bc.dayGz}（空${bc.xunkong}）· ${mh.name}${exam.bianHex?' 变 '+exam.bianHex.name:''}</div>
          ${[5,4,3,2,1,0].map(i => {
            const r = exam.examRows[i], b = r.bian;
            return `<div class="ly-row" style="cursor:default;"><span style="color:var(--text-3);font-size:12px;">${r.pos}爻</span><span style="font-size:10.5px;color:var(--text-3);">${r.fushen?r.fushen.label:''}</span><div class="ly-main-cell"><span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span><span class="wx-${r.wx}" style="font-weight:600;">${r.liuqin}${r.branch}${r.wx}</span>${r.isShi?'<span class="yao-badge shi">世</span>':(r.isYing?'<span class="yao-badge ying">应</span>':'')}${r.isKong?'<span class="yao-badge kong">空</span>':''}</div><span style="color:var(--seal);font-weight:700;">${r.isMov?(r.bit?'○':'×'):''}</span><div class="ly-bian-cell">${b?`<span class="wx-${b.wx}">${b.liuqin}${b.branch}${b.wx}</span>`:''}</div></div>`;
          }).join('')}
        </div>
        <div class="card">
          <div class="form-label">第一步：你选哪个用神？</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">${['妻财','官鬼','父母','子孙','兄弟','世爻'].map(y => `<button class="chip ${state.blindUserYs===y?'accent':''}" onclick="state.blindUserYs='${y}';renderStudyView()">${y}</button>`).join('')}</div>
          <div class="form-label">第二步：你的成败判断？</div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">${['成','败','反复'].map(v => `<button class="chip ${state.blindUserVerdict===v?'seal':''}" onclick="state.blindUserVerdict='${v}';renderStudyView()">${v}</button>`).join('')}</div>
          <div class="form-label">第三步：写出你的断卦思路与应期</div>
          <textarea class="form-textarea" style="min-height:64px;" placeholder="例：用神旺相但动化回头克，故难成..." oninput="state.blindUserReason=this.value">${escapeHtml(state.blindUserReason)}</textarea>
          <button class="btn-primary" style="width:100%;margin-top:12px;" onclick="submitBlindAnswer()">交卷对比原书答案</button>
        </div>
        ${state.blindSubmitted ? `
          <div class="card" style="border-color:var(--accent);">
            <div class="card-title" style="margin-bottom:8px;color:var(--accent);">原书解析（参考用神：${bc.answerYs} · 结论：${bc.answerVerdict}）</div>
            <div style="font-size:14.5px;line-height:1.8;margin-bottom:10px;">${escapeHtml(bc.masterText)}</div>
            ${state.blindAiReview ? `<div style="padding:12px;border-radius:14px;background:var(--bg);font-size:14.5px;line-height:1.78;">${formatRichText(state.blindAiReview)}</div>` : `<button class="btn-secondary" style="width:100%;" id="gradeBlindAiBtn" onclick="gradeBlindCaseWithAI()">让 AI 逐条点评我的作答与指导建议</button>`}
          </div>
        ` : ''}
      `;
    } else {
      const ac = state.aiBlindCase;
      wrap.innerHTML = topControls + `
        <div class="card">
          <div class="card-head">
            <span class="card-title">${cat} · 实战盲断题（${rs.lvl}）</span>
            <button class="pill-mini xs accent" id="aiBlindGenBtn" onclick="generateAiBlindCaseForCat()">${ac ? '换一道新盘' : 'AI 抽取经典案例'}</button>
          </div>
          ${!ac ? `
            <div class="empty-box" style="padding:22px 8px;">
              <p>点上方按钮，AI 会按【${cat} · ${rs.lvl}】抽取经典古例或真实盘面让你先盲断，做完后再对比标准答案并逐条点评你的思路。</p>
              <button class="btn-primary" onclick="generateAiBlindCaseForCat()">立即抽取一道${cat}实战题</button>
            </div>
          ` : `
            <div style="font-size:12.5px;color:var(--text-3);margin-bottom:6px;">出处：${escapeHtml(ac.source)}</div>
            <div style="padding:13px 14px;border-radius:14px;background:var(--bg);font-size:14.8px;line-height:1.8;margin-bottom:12px;">${formatRichText(ac.chartText)}</div>
            <div class="form-label">写下你的判断结论与分析理由</div>
            <textarea class="form-textarea" style="min-height:70px;" placeholder="写出你的喜忌/用神、吉凶定性与理由..." oninput="state.blindUserReason=this.value">${escapeHtml(state.blindUserReason)}</textarea>
            <button class="btn-primary" style="width:100%;margin-top:12px;" onclick="submitGenericBlindAnswer()">交卷对比答案</button>
          `}
        </div>
        ${ac && state.blindSubmitted ? `
          <div class="card" style="border-color:var(--accent);">
            <div class="card-title" style="margin-bottom:8px;color:var(--accent);">标准/原书解析</div>
            <div style="font-size:14.5px;line-height:1.8;margin-bottom:10px;">${formatRichText(ac.answerText)}</div>
            ${state.blindAiReview ? `<div style="padding:12px;border-radius:14px;background:var(--bg);font-size:14.5px;line-height:1.78;">${formatRichText(state.blindAiReview)}</div>` : `<button class="btn-secondary" style="width:100%;" id="gradeBlindAiBtn" onclick="gradeGenericBlindWithAI()">让 AI 分析我的作答并给改进建议</button>`}
          </div>
        ` : ''}
      `;
    }
  } else if (state.practiceMode === 'yingqi') {
    const pool = YINGQI_CASES.filter(x => x.cat === cat);
    const list = pool.length ? pool : YINGQI_CASES;
    const yc = state.yingqiCustom || list[(state.yingqiIdx || 0) % list.length];
    wrap.innerHTML = topControls + `
      <div class="card">
        <div class="card-head">
          <span class="card-title">应期与动变推演（${rs.lvl}）</span>
          <div style="display:flex;gap:6px;">
            <button class="pill-mini xs" onclick="nextYingqiCase()">换一题</button>
            <button class="pill-mini xs accent" id="genYingqiBtn" onclick="generateNewYingqiCase()">AI 出新题</button>
          </div>
        </div>
        <div style="padding:14px 15px;border-radius:15px;background:var(--bg);font-size:15px;line-height:1.82;margin-bottom:14px;">${escapeHtml(yc.scenario)}</div>
        <textarea class="form-textarea" style="min-height:62px;" placeholder="写出你推算的应期时间点或局势变化，以及依据..." oninput="state.yingqiUserAns=this.value">${escapeHtml(state.yingqiUserAns || '')}</textarea>
        <button class="btn-primary" style="width:100%;margin-top:12px;" onclick="revealYingqiAnswer()">交卷核对应期</button>
      </div>
      ${state.yingqiReview ? `<div class="card" style="border-color:var(--accent);"><div class="card-title" style="margin-bottom:8px;color:var(--accent);">应期解析（考点：${escapeHtml(yc.tag)}）</div><div style="font-size:14.8px;line-height:1.8;">${formatRichText(state.yingqiReview)}</div></div>` : ''}
    `;
  } else {
    const pool = FLAW_CASES.filter(x => x.cat === cat);
    const list = pool.length ? pool : FLAW_CASES;
    const fc = state.flawCustom || list[state.flawIdx % list.length];
    wrap.innerHTML = topControls + `
      <div class="card">
        <div class="card-head">
          <span class="card-title">来当老师：揪出这段断语的硬伤</span>
          <div style="display:flex;gap:6px;">
            <button class="pill-mini xs" onclick="nextFlawCase()">换一题</button>
            <button class="pill-mini xs accent" id="genFlawBtn" onclick="generateNewFlawCase()">AI 出题</button>
          </div>
        </div>
        <div style="padding:14px 15px;border-radius:15px;background:var(--bg);font-size:15px;line-height:1.82;margin-bottom:14px;">${escapeHtml(fc.statement)}</div>
        <textarea class="form-textarea" style="min-height:62px;" placeholder="写出这段话错在哪里？哪个概念被用反了？" oninput="state.flawUserAns=this.value">${escapeHtml(state.flawUserAns)}</textarea>
        <button class="btn-primary" style="width:100%;margin-top:12px;" onclick="revealFlawTrap()">揭晓逻辑陷阱</button>
      </div>
      ${state.flawAiReview ? `<div class="card" style="border-color:var(--seal);"><div class="card-title" style="margin-bottom:8px;color:var(--seal);">硬伤拆解（考点：${escapeHtml(fc.tag)}）</div><div style="font-size:15px;line-height:1.8;">${formatRichText(state.flawAiReview)}</div></div>` : ''}
    `;
  }
}

function nextFlashcard() { state.flashIdx++; state.flashFlipped = false; renderStudyView(); }
async function markFlashWeak(tag) { await recordWeakSpot(tag); bumpPracticeProgress(); showToast(`已把「${tag}」记入薄弱点，AI 断盘时会提醒你`); nextFlashcard(); }
async function generateNewFlashcard() {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('genFlashBtn'); if (btn) { btn.disabled = true; btn.textContent = 'AI 正在出题...'; }
  const weak = (state.settings.weakSpots || []).slice(0, 3).map(w => w.tag).join('、') || '旬空、暗动、八字调候、奇门四害';
  const lvl = state.pracLevel || '入门';
  try {
    const out = (await callLLM([{ role: 'user', content: `请出一道【${state.studyCat} · ${lvl}难度】实战情景闪卡题（优先针对：${weak}）。严格按以下格式输出三行，严禁星号：\n标签：两到五个字\n问题：一句话具体场景提问\n答案：两到三句直击核心的解析` }], { tier: 'flash' })).replace(/\*/g, '');
    const tag = (out.match(/标签[:：](.+)/)?.[1] || state.studyCat + '进阶').trim();
    const q = (out.match(/问题[:：]([\s\S]+?)(?=答案[:：])/)?.[1] || out).trim();
    const a = (out.match(/答案[:：]([\s\S]+)/)?.[1] || '').trim();
    if (q && a) { state.customFlash.push({ cat: state.studyCat, lvl, tag, q, a }); state.flashIdx = 999; state.flashFlipped = false; renderStudyView(); }
  } catch (e) { showToast('出题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = `+ AI 按【${state.studyCat}·${lvl}】再出一张新卡`; } }
}

function nextBlindCase() { state.aiBlindCase = null; const curIdx = BLIND_CASES.findIndex(x => x.id === state.blindCase?.id); state.blindCase = BLIND_CASES[(curIdx + 1) % BLIND_CASES.length]; state.blindSubmitted = false; state.blindUserReason = ''; state.blindAiReview = ''; renderStudyView(); }
async function submitBlindAnswer() { state.blindSubmitted = true; bumpPracticeProgress(); const bc = state.blindCase; if (bc && (state.blindUserYs !== bc.answerYs || state.blindUserVerdict !== bc.answerVerdict)) await recordWeakSpot(`盲断偏差(${bc.answerYs}·${bc.answerVerdict})`); renderStudyView(); }
async function submitGenericBlindAnswer() { state.blindSubmitted = true; bumpPracticeProgress(); renderStudyView(); }

async function generateAiBlindCaseForCat() {
  if (!ensureApiKey()) return;
  const cat = state.studyCat || '六爻', lvl = state.pracLevel || '入门';
  const btn = document.getElementById('aiBlindGenBtn'); if (btn) { btn.disabled = true; btn.textContent = '抽盘中...'; }
  try {
    const prompt = `请你作为${cat}实战教练，出一道【${cat} · ${lvl}难度】的盲断实战案例题（优先取材于经典典籍案例）。严格按以下 3 段输出，严禁星号：
出处：书名或经典流派
盘面与问题：清晰列出完整盘面信息（若是六爻请写出完整六爻阴阳、动静与旬空；若是八字写出四柱干支与大运流年；其他门类写出核心盘面）以及要判断的具体问题
标准解析：150字以内的硬核白话解析与定论`;
    const out = (await callLLM([{ role: 'user', content: prompt }], { tier: 'flash' })).replace(/\*/g, '').trim();
    const source = (out.match(/出处[:：](.+)/)?.[1] || `${cat}经典案例`).trim();
    const chartText = (out.match(/盘面与问题[:：]([\s\S]+?)(?=标准解析[:：])/)?.[1] || out).trim();
    const answerText = (out.match(/标准解析[:：]([\s\S]+)/)?.[1] || '').trim();
    state.aiBlindCase = { cat, lvl, source, chartText, answerText };
    state.blindSubmitted = false; state.blindUserReason = ''; state.blindAiReview = '';
    renderStudyView();
  } catch (e) { showToast('出题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '换一道新盘'; } }
}

async function gradeBlindCaseWithAI() {
  if (!ensureApiKey()) return;
  const bc = state.blindCase, btn = document.getElementById('gradeBlindAiBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'AI 教练批改中...'; }
  try {
    const out = await callLLM([{ role: 'user', content: `我是术数学习者，刚做了一道盲断题。请像直爽负责的私人教练一样点评（严禁吹捧、严禁星号）：\n题目：${bc.question}（${bc.monthGz} ${bc.dayGz}）\n原书结论：用神${bc.answerYs}，结果${bc.answerVerdict}。原解：${bc.masterText}\n我的作答：用神选了${state.blindUserYs}，结果判了${state.blindUserVerdict}，理由是「${state.blindUserReason || '未写'}」。\n请分三点回复：1. 哪里看准了；2. 哪个关键环节看漏或看反了；3. 下次遇到同类卦的具体改进建议。` }], { tier: 'flash' });
    state.blindAiReview = out.replace(/\*/g, '').trim(); renderStudyView();
  } catch (e) { showToast('批改失败：' + e.message); if (btn) { btn.disabled = false; btn.textContent = '重试点评'; } }
}

async function gradeGenericBlindWithAI() {
  if (!ensureApiKey()) return;
  const ac = state.aiBlindCase, btn = document.getElementById('gradeBlindAiBtn');
  if (!ac) return;
  if (btn) { btn.disabled = true; btn.textContent = 'AI 教练点评中...'; }
  try {
    const out = await callLLM([{ role: 'user', content: `我是${ac.cat}学习者，刚做完一道盲断题，请客观直爽地批改我的答案并给改进建议（严禁吹捧、严禁星号）：\n盘面与问题：${ac.chartText}\n标准解析：${ac.answerText}\n我的作答：「${state.blindUserReason || '未填写'}」\n请分三点回复：1. 看准的地方；2. 漏看或偏差点；3. 针对性练习建议。` }], { tier: 'flash' });
    state.blindAiReview = out.replace(/\*/g, '').trim(); renderStudyView();
  } catch (e) { showToast('点评失败：' + e.message); if (btn) { btn.disabled = false; btn.textContent = '重试点评'; } }
}

async function extractBlindCaseFromBooks() {
  if (!ensureApiKey()) return;
  const lyBooks = state.books.filter(b => b.category === '六爻' || b.category === '其他');
  if (!lyBooks.length) return showToast('书房还没有上传六爻书，可先点「在线找书」一键导入《增删卜易》');
  const chs = state.chapters.filter(c => lyBooks.some(b => b.id === c.bookId) && (c.content || '').length > 180);
  if (!chs.length) return showToast('书库中未找到可用文本页');
  const pick = chs[Math.floor(Math.random() * chs.length)], book = lyBooks.find(b => b.id === pick.bookId);
  const btn = document.getElementById('bookBlindBtn'); if (btn) { btn.disabled = true; btn.textContent = '抽题中...'; }
  try {
    const out = (await callLLM([{ role: 'user', content: `从下面《${book.title}》第${pick.pageNum}页文字中，提炼一个适合盲断的六爻练习题。若本页没有完整卦例，请据本页理法编一道标准例题。严格按下面 5 行输出，严禁星号：\n事项：一句话占问之事\n月日：如卯月戊辰日\n用神：从 妻财/官鬼/父母/子孙/兄弟/世爻 选一个\n结论：从 成/败/反复 选一个\n原解：100字以内白话解析\n\n原书文本：${pick.content.slice(0, 1200)}` }], { tier: 'flash' })).replace(/\*/g, '');
    const question = (out.match(/事项[:：](.+)/)?.[1] || '书库随机卦例').trim();
    const md = (out.match(/月日[:：](.+)/)?.[1] || '卯月戊辰日').trim();
    const answerYs = (out.match(/用神[:：](.+)/)?.[1] || '妻财').trim().slice(0, 2);
    const answerVerdict = (out.match(/结论[:：](.+)/)?.[1] || '成').trim().slice(0, 2);
    const masterText = (out.match(/原解[:：]([\s\S]+)/)?.[1] || out).trim();
    const randHex = HEX_DATA.list[Math.floor(Math.random() * HEX_DATA.list.length)];
    state.aiBlindCase = null;
    state.blindCase = { id: uid('bc'), cat:'六爻', lvl: state.pracLevel || '进阶', source: `《${book.title}》第${pick.pageNum}页`, question, monthGz: md.slice(0, 2) || '卯月', dayGz: md.slice(2, 5) || '戊辰日', xunkong: '戌亥', mainKey: randHex.key, moving: [Math.floor(Math.random() * 6) + 1], answerYs, answerVerdict, masterText };
    state.blindSubmitted = false; state.blindUserReason = ''; state.blindAiReview = ''; renderStudyView();
  } catch (e) { showToast('抽题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '从我书里抽'; } }
}

function nextYingqiCase() { state.yingqiCustom = null; state.yingqiIdx = (state.yingqiIdx || 0) + 1; state.yingqiUserAns = ''; state.yingqiReview = ''; renderStudyView(); }
async function revealYingqiAnswer() {
  bumpPracticeProgress();
  const cat = state.studyCat || '六爻', pool = YINGQI_CASES.filter(x => x.cat === cat), list = pool.length ? pool : YINGQI_CASES;
  const yc = state.yingqiCustom || list[(state.yingqiIdx || 0) % list.length];
  if (!(state.yingqiUserAns || '').trim() || !state.settings.apiKey) { state.yingqiReview = yc.answer; renderStudyView(); return; }
  state.yingqiReview = '正在核对你的应期推演...'; renderStudyView();
  try {
    const out = await callLLM([{ role: 'user', content: `题干：${yc.scenario}\n参考应期：${yc.answer}\n用户的推演：「${state.yingqiUserAns}」\n请用两三句直爽大白话判断用户推得准不准、差在哪一步（严禁星号）。` }], { tier: 'flash' });
    state.yingqiReview = out.replace(/\*/g, '').trim() + '\n\n【参考应期】' + yc.answer;
    renderStudyView();
  } catch (e) { state.yingqiReview = yc.answer; renderStudyView(); }
}
async function generateNewYingqiCase() {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('genYingqiBtn'); if (btn) { btn.disabled = true; btn.textContent = '出题中...'; }
  const cat = state.studyCat || '六爻', lvl = state.pracLevel || '入门';
  try {
    const out = (await callLLM([{ role: 'user', content: `请出一道【${cat} · ${lvl}难度】的应期或动变推演题。严格按三行输出，严禁星号：\n考点：四个字\n题干：70字以内给出具体盘面条件与问题\n参考应期：80字以内给出明确应期结论与理由` }], { tier: 'flash' })).replace(/\*/g, '');
    state.yingqiCustom = { cat, lvl, tag: (out.match(/考点[:：](.+)/)?.[1] || '应期推演').trim(), scenario: (out.match(/题干[:：]([\s\S]+?)(?=参考应期[:：])/)?.[1] || out).trim(), answer: (out.match(/参考应期[:：]([\s\S]+)/)?.[1] || '').trim() };
    state.yingqiUserAns = ''; state.yingqiReview = ''; renderStudyView();
  } catch (e) { showToast('出题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'AI 出新题'; } }
}

function nextFlawCase() { state.flawCustom = null; state.flawIdx++; state.flawUserAns = ''; state.flawAiReview = ''; renderStudyView(); }
async function revealFlawTrap() {
  bumpPracticeProgress();
  const cat = state.studyCat || '六爻', pool = FLAW_CASES.filter(x => x.cat === cat), list = pool.length ? pool : FLAW_CASES;
  const fc = state.flawCustom || list[state.flawIdx % list.length];
  if (!state.flawUserAns.trim() || !state.settings.apiKey) { state.flawAiReview = fc.trap; renderStudyView(); return; }
  state.flawAiReview = '正在核对你的挑刺思路...'; renderStudyView();
  try {
    const out = await callLLM([{ role: 'user', content: `错题原文：${fc.statement}\n真实硬伤：${fc.trap}\n用户的挑刺回答：「${state.flawUserAns}」\n请用两句直爽大白话判断用户有没有抓到真硬伤，并补充关键点（严禁星号）。` }], { tier: 'flash' });
    state.flawAiReview = out.replace(/\*/g, '').trim() + '\n\n【标准硬伤】' + fc.trap;
    renderStudyView();
  } catch (e) { state.flawAiReview = fc.trap; renderStudyView(); }
}
async function generateNewFlawCase() {
  if (!ensureApiKey()) return;
  const btn = document.getElementById('genFlawBtn'); if (btn) { btn.disabled = true; btn.textContent = '出题中...'; }
  const lvl = state.pracLevel || '入门';
  try {
    const out = (await callLLM([{ role: 'user', content: `请编一道【${state.studyCat} · ${lvl}难度】断语挑刺题：写一段听起来很专业、但故意埋了 1 个经典逻辑硬伤的假断语。严格按三行输出，严禁星号：\n考点：四个字\n假断语：60字以内\n硬伤：80字以内一针见血拆穿` }], { tier: 'flash' })).replace(/\*/g, '');
    state.flawCustom = { cat: state.studyCat, lvl, tag: (out.match(/考点[:：](.+)/)?.[1] || '理法陷阱').trim(), statement: (out.match(/假断语[:：]([\s\S]+?)(?=硬伤[:：])/)?.[1] || out).trim(), trap: (out.match(/硬伤[:：]([\s\S]+)/)?.[1] || '').trim() };
    state.flawUserAns = ''; state.flawAiReview = ''; renderStudyView();
  } catch (e) { showToast('出题失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'AI 出题'; } }
}
