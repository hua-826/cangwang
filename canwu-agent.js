// ==================== 藏往 V7：参悟八大分舱智能体、动态多书PK、每日摇签解梦、思想星图与主控入口 ====================

function ensureApiKey() {
  if (!state.settings.apiKey) {
    showToast('请先在左侧菜单 -> 设置中填写 DeepSeek API Key');
    openSettings();
    return false;
  }
  return true;
}

function redactPrivateText(text) {
  if (state.settings.redactNames === false) return text;
  let out = String(text || '').replace(/1[3-9]\d{9}/g, '[已脱敏号码]');
  const names = new Set();
  state.archives.forEach(a => { if (a.personName && a.personName.length >= 2) names.add(a.personName); });
  if (state.currentResult?.personName && state.currentResult.personName.length >= 2) names.add(state.currentResult.personName);
  names.forEach(n => { out = out.split(n).join('命主'); });
  return out;
}

async function callLLM(messages, { stream = false, tier = null, onChunk = null } = {}) {
  const s = state.settings;
  const model = (tier || s.useTier) === 'pro' ? (s.proModel || 'deepseek-reasoner') : (s.flashModel || 'deepseek-chat');
  const base = (s.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const safeMessages = messages.map(m => ({ role: m.role, content: redactPrivateText(m.content) }));

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.apiKey}` },
    body: JSON.stringify({ model, messages: safeMessages, stream, temperature: 0.42 })
  });
  if (!resp.ok) throw new Error(`接口失败(${resp.status})：${(await resp.text()).slice(0, 90)}`);
  if (!stream) {
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (data.usage) { s.tokensIn += data.usage.prompt_tokens || 0; s.tokensOut += data.usage.completion_tokens || 0; saveSettingsMeta(); }
    return content;
  }
  const reader = resp.body.getReader(), dec = new TextDecoder();
  let full = '', buf = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const ln of lines) {
      const t = ln.trim(); if (!t.startsWith('data:')) continue;
      const p = t.slice(5).trim(); if (p === '[DONE]') continue;
      try { const delta = JSON.parse(p).choices?.[0]?.delta?.content || ''; if (delta) { full += delta; if (onChunk) onChunk(full); } } catch (e) {}
    }
  }
  s.tokensIn += Math.round(JSON.stringify(safeMessages).length * 0.6);
  s.tokensOut += Math.round(full.length * 0.8);
  saveSettingsMeta();
  return full;
}

function formatRichText(text) {
  let html = escapeHtml(text || '');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/【([^】]+)】/g, '<strong>【$1】</strong>');
  html = html.replace(/\*/g, '');
  html = html.replace(/《([^》]+)》第(\d+)页/g, `<span class="ref-jump" onclick="jumpToBookPage('$1',$2)">《$1》第$2页</span>`);
  html = html.replace(/\[应期[:：](\d{4}-\d{2}-\d{2})\]/g, `<span class="ref-jump" onclick="flagYingqiDate('$1')">🚩 插旗 $1</span>`);
  return html.replace(/\n/g, '<br/>');
}

function jumpToBookPage(bookTitle, pageNum) {
  const b = state.books.find(x => x.title.includes(bookTitle) || bookTitle.includes(x.title));
  if (b) openReader(b.id, Number(pageNum));
  else showToast(`书架未找到《${bookTitle}》`);
}

async function flagYingqiDate(dateStr) {
  if (state.currentResult) {
    if (!state.currentResult.yingqiDates) state.currentResult.yingqiDates = [];
    if (!state.currentResult.yingqiDates.includes(dateStr)) state.currentResult.yingqiDates.push(dateStr);
    await saveCurrentResultToArchive();
  }
  state.calSelectedDate = dateStr;
  const [y, m] = dateStr.split('-').map(Number);
  state.calYear = y; state.calMonth = m - 1;
  showToast(`已将 ${dateStr} 应期插旗钉入干支日历`);
}

// ==================== 流派索引、翻译与盲测 ====================
async function buildBookAiProfile(bookId) {
  if (!ensureApiKey()) return;
  const book = state.books.find(b => b.id === bookId); if (!book) return;
  const sampleChs = state.chapters.filter(c => c.bookId === bookId).sort((a,b) => a.pageNum - b.pageNum).slice(0, 6);
  const tocStr = (book.toc || []).slice(0, 30).map(t => `${t.title}(P.${t.pageNum})`).join('、');
  showToast(`正在为《${book.title}》建立流派身份证...`);
  try {
    const res = await callLLM([{ role:'user', content:`根据《${book.title}》（${book.category}）目录与前文，用不超过 70 字概括流派特色（严禁星号）：\n目录：${tocStr}\n正文：${sampleChs.map(c=>c.content.slice(0,360)).join('\n').slice(0,2000)}` }], { tier:'flash' });
    book.aiProfile = res.replace(/\*/g, '').trim();
    await dbPut('books', book); await markDirty(); openBookEditSheet(bookId); renderDivineView();
    showToast('已建立本书流派身份证');
  } catch (e) { showToast('失败：' + e.message); }
}

async function translateCurrentPage() {
  if (!ensureApiKey()) return;
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch?.content?.trim()) return showToast('本页暂无可翻译文本');
  showToast('正在翻译白话...');
  try {
    const res = await callLLM([{ role:'user', content:`将以下古籍内容逐段翻译为现代白话（严禁星号）：\n${ch.content.slice(0, 3500)}` }], { tier:'flash' });
    ch.modernText = res.replace(/\*/g, '').trim(); await dbPut('chapters', ch);
    state.reader.engine = 'text'; state.reader.textMode = 'both'; await renderReaderPage();
  } catch (e) { showToast('翻译失败：' + e.message); }
}

async function extractCaseBlindTest() {
  if (!ensureApiKey()) return;
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch?.content?.trim()) return showToast('本页暂无文本');
  closeReader(); switchMainTab('canwu'); switchCanwuRoom(state.category); state.canwuMode = 'practice'; renderCanwuView();
  document.getElementById('chatInput').value = `从下面这页书里抽出卦例/命例出题考我（先隐去原书结论，等我回答再批改）：\n${ch.content.slice(0, 2200)}`;
  sendCanwuMessage();
}

// ==================== 动态多书检索与断盘 ====================
function retrieveFromSelectedBooks(bookIds, queryText) {
  const targetBooks = state.books.filter(b => bookIds.includes(b.id));
  if (!targetBooks.length) return '';
  const tokens = (queryText.match(/[\u4e00-\u9fa5]{2,4}/g) || []).slice(0, 18);
  const score = txt => tokens.reduce((acc, tk) => acc + (txt.includes(tk) ? 2 : 0), 0);
  return targetBooks.map(b => {
    const topPages = state.chapters.filter(c => c.bookId === b.id).map(c => ({ c, s: score(c.content || '') })).sort((a,b2) => b2.s - a.s).slice(0, targetBooks.length > 2 ? 2 : 3);
    const isMain = state.primaryBookId === b.id && targetBooks.length > 1;
    return `【参考典籍${isMain ? '（主断基准书）' : ''}：《${b.title}》】\n画像：${b.aiProfile || '用户典籍'}\n摘录：\n` + topPages.map(({ c }) => `《${b.title}》第${c.pageNum}页：${(c.content || '').slice(0, 460)}`).join('\n');
  }).join('\n========\n');
}

function buildChartDigestForAI(rec) {
  if (rec.category === '六爻') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey];
    const exam = runLiuyaoPhysicalExam(mh, new Set(d.moving || []), d.monthGz[1], d.dayGz[1], d.xunkong);
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0;
    const rowsStr = [5,4,3,2,1,0].map(i => {
      const r = exam.examRows[i], ysTag = d.lockedYongshenPos === r.pos ? '【指定用神】' : '';
      return `${r.pos}爻(${LIU_SHEN[(lsStart+i)%6]})：${r.bit?'阳':'阴'} ${r.liuqin}${r.branch}${r.wx}${r.isShi?'(世)':(r.isYing?'(应)':'')} ${r.isMov ? '动化'+(r.bian?r.bian.liuqin+r.bian.branch+r.bian.wx:'') : '静'} ${ysTag} | 体检：[${r.tags.join('、')}]`;
    }).join('\n');
    return `门类：六爻 | 事项：${rec.title} | 性别：${rec.gender}\n底色：${rec.status||''} | 外应：${(rec.omens||[]).join('、')||'无'}\n干支：${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（日空${d.xunkong}）\n主卦：${mh.name}（${mh.palaceName}） ${exam.bianHex ? '→ 变卦：'+exam.bianHex.name : '（静卦）'}\n三合局：${exam.sanheHits.join('、')||'无'}\n体检明细：\n${rowsStr}`;
  }
  return `门类：${rec.category} | 事项：${rec.title}\n数据：${JSON.stringify(rec.data)}`;
}

async function runSelectedBooksAnalysis() {
  if (!ensureApiKey()) return;
  const rec = state.currentResult; if (!rec) return;
  const btn = document.getElementById('runChartAiBtn');
  if (btn) { btn.disabled = true; btn.textContent = '参悟推演中...'; }

  const chosenBooks = state.books.filter(b => state.selectedBookIds.includes(b.id));
  const label = chosenBooks.length === 0 ? '通用经典断' : (chosenBooks.length === 1 ? `《${chosenBooks[0].title}》` : `多书PK(${chosenBooks.length}本)`);
  const digest = buildChartDigestForAI(rec);
  const bookCtx = retrieveFromSelectedBooks(state.selectedBookIds, digest + ' ' + rec.title);
  const mems = state.memories.filter(m => m.category === rec.category).slice(0, 10).map((m,i)=>`${i+1}. ${m.text}`).join('\n');

  const sysPrompt = `你是私人术数智能体「参悟」，今日公历 ${formatDateKey(new Date())}。
1. 先给核心定论，再用 1. 2. 3. 编号分条展开，重点用【】标注，绝对禁止使用星号符号。
2. 严守三层隔离：
   - 第一层【吉凶定性】：只据硬规则与所选参考书定成败，标出处为《书名》第X页。
   - 第二层【细节象意】：结合六神、世应、飞伏与现实底色外应讲过程细节。
   - 第三层【具体应期】：换算公历日期并用 [应期:YYYY-MM-DD] 格式写出。
3. ${chosenBooks.length > 1 ? '以标注主断基准书的典籍定吉凶，其余典籍补细节，最后单列【多书共识与分歧对照】。' : (chosenBooks.length === 1 ? `严格遵循《${chosenBooks[0].title}》理法体系。` : '结合经典通用理法严谨作答。')}
${mems ? '\n【长期纠偏铁律】\n' + mems : ''}`;

  try {
    const content = await callLLM([{ role:'system', content: sysPrompt }, { role:'user', content:`请精准剖析以下盘面：\n${digest}\n\n${bookCtx ? '参考书库摘录：\n' + bookCtx : ''}` }]);
    const yqs = Array.from(content.matchAll(/\[应期[:：](\d{4}-\d{2}-\d{2})\]/g)).map(m => m[1]);
    if (yqs.length) rec.yingqiDates = Array.from(new Set([...(rec.yingqiDates || []), ...yqs]));
    rec.reports.push({ id: uid('rep'), label, bookIds: [...state.selectedBookIds], content, createdAt: Date.now() });
    state.activeReportTab = rec.reports.length - 1;
    await saveCurrentResultToArchive();
    renderResultOverlay();
  } catch (e) { showToast('分析失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '+ 按所选书追加一份对比分析'; } }
}

function followUpFromResult() {
  const rec = state.currentResult; if (!rec) return;
  closeOverlay('resultOverlay'); switchMainTab('canwu'); switchCanwuRoom(rec.category);
  document.getElementById('chatInput').value = `承接卷宗「${rec.title}」，我想继续追问：`;
  document.getElementById('chatInput').focus();
}
async function feedbackResultToBrain() {
  const rec = state.currentResult; if (!rec) return;
  const fix = prompt('简述偏差点，存入本门类长期纠偏铁律：'); if (!fix?.trim()) return;
  await saveMemoryItem(rec.category, 'fix', '实战纠偏：' + fix.trim()); showToast('已写入参悟大脑');
}
function reviewArchiveOutcome() {
  const rec = state.currentResult; if (!rec?.outcome) return;
  closeOverlay('resultOverlay'); switchMainTab('canwu'); switchCanwuRoom(rec.category);
  document.getElementById('chatInput').value = `复盘已应验卷宗：\n【事项】${rec.title}\n【盘面】${buildChartDigestForAI(rec).slice(0,320)}\n【真实结果】${rec.outcome}\n请指出当初看准与看漏之处，并总结一句纠偏铁律。`;
  sendCanwuMessage();
}

// ==================== 参悟八大分舱聊天室 ====================
function renderCanwuRoomStrip() {
  document.getElementById('canwuRoomStrip').innerHTML = CANWU_ROOMS.map(r => `<button class="cat-pill ${r===state.canwuRoom?'active':''}" onclick="switchCanwuRoom('${r}')">${r}</button>`).join('');
  document.getElementById('canwuHeaderSub').textContent = state.canwuRoom + '舱';
  const mb = document.getElementById('modeToggleBtn');
  mb.textContent = state.canwuMode === 'answer' ? '解答' : '带练';
  mb.className = 'pill-mini ' + (state.canwuMode === 'practice' ? 'accent' : '');
}
function switchCanwuRoom(room) {
  state.canwuRoom = room;
  const list = state.chats.filter(t => t.room === room).sort((a,b) => (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  state.activeThreadId = list.length ? list[0].id : null;
  renderCanwuView();
}
function toggleCanwuMode() { state.canwuMode = state.canwuMode === 'answer' ? 'practice' : 'answer'; renderCanwuRoomStrip(); showToast(state.canwuMode === 'practice' ? '带练考我模式' : '解答模式'); }
function getActiveThread() { return state.activeThreadId ? (state.chats.find(t => t.id === state.activeThreadId && t.room === state.canwuRoom) || null) : null; }
async function startNewChatThread() {
  const th = { id: uid('th'), room: state.canwuRoom, title: '新话题', starred: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  await dbPut('chats', th); state.chats.push(th); state.activeThreadId = th.id; renderCanwuView(); showToast('已开启新话题');
}
function renderCanwuView() {
  renderCanwuRoomStrip();
  const box = document.getElementById('chatMessages'), th = getActiveThread(), msgs = th?.messages || [];
  if (!msgs.length) {
    box.innerHTML = `<div class="card" style="margin-top:8px;">
      <div class="card-head"><span class="card-title">「${state.canwuRoom}」独立参悟舱</span><span class="pill-mini">${getCultivationRank()}</span></div>
      <div style="font-size:14.5px;color:var(--text-2);line-height:1.7;">本分舱与其他门类完全隔离，只调用本门类已传古籍与纠偏记忆。</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">
        <button class="chip" onclick="quickAskCanwu('梳理我当前书库最核心的实战规律')">梳理书库核心</button>
        <button class="chip" onclick="quickAskCanwu('对比不同古籍对同一条规矩的异同')">跨书理法对比</button>
        <button class="chip accent" onclick="state.canwuMode='practice';renderCanwuRoomStrip();quickAskCanwu('出一道经典实战题考考我，先隐去答案')">带练考考我</button>
      </div>
    </div>`;
    return;
  }
  box.innerHTML = msgs.map((m, i) => `
    <div class="msg-row ${m.role}">
      <div class="msg-bubble">${m.role === 'ai' ? formatRichText(m.content) : escapeHtml(m.content).replace(/\n/g,'<br/>')}</div>
      ${m.role === 'ai' && !m.streaming ? `<div class="msg-actions">
        <button class="msg-act-btn" onclick="starCurrentThread()">${th.starred ? '★ 已永久珍藏' : '☆ 标星防清理'}</button>
        <button class="msg-act-btn" onclick="chatFeedback(${i},'fix')">有偏差，纠正</button>
        <button class="msg-act-btn" onclick="chatSaveNote(${i})">存笔记</button>
      </div>` : ''}
    </div>
  `).join('');
}
function quickAskCanwu(t) { document.getElementById('chatInput').value = t; sendCanwuMessage(); }
function autoResizeInput(el) { el.style.height = '40px'; el.style.height = Math.min(112, el.scrollHeight) + 'px'; }
function scrollChatToBottom(force = false) {
  const box = document.getElementById('chatMessages');
  if (force) { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); }
  if (!state.userScrolledUp || force) box.scrollTop = box.scrollHeight;
}

async function sendCanwuMessage() {
  if (state.isStreaming || !ensureApiKey()) return;
  const inp = document.getElementById('chatInput'), q = inp.value.trim(); if (!q) return;
  inp.value = ''; inp.style.height = '40px';
  let th = getActiveThread();
  if (!th) { th = { id: uid('th'), room: state.canwuRoom, title: q.slice(0, 16), starred: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; state.chats.push(th); state.activeThreadId = th.id; }
  else if (th.title === '新话题') th.title = q.slice(0, 16);
  th.messages.push({ role: 'user', content: q });
  const aiMsg = { role: 'ai', content: '参悟思索中...', streaming: true };
  th.messages.push(aiMsg); th.updatedAt = Date.now();
  state.isStreaming = true; state.userScrolledUp = false; renderCanwuView(); scrollChatToBottom(true);

  const roomCat = CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category;
  const bookCtx = retrieveFromSelectedBooks(state.books.filter(b => b.category === roomCat).map(b => b.id).slice(0, 4), q);
  const mems = state.memories.filter(m => m.category === roomCat).slice(0, 12).map((m,i)=>`${i+1}. ${m.text}`).join('\n');
  const sysPrompt = `你是私人术数智能体「参悟」，当前分舱：【${state.canwuRoom}】。
1. 先给结论，再用 1. 2. 3. 编号分条展开，重点用【】标注，严禁使用星号符号。
2. 明确区分【原书依据】（标《书名》第X页）和【推演补充】。
3. 展示六爻卦象时，必须完整写出六爻阴阳排列、动静爻与旬空。
4. 模式：${state.canwuMode === 'practice' ? '带练考我（先隐去结局）' : '直击核心解答'}。
${mems ? '\n【长期记忆】\n' + mems : ''}
${bookCtx ? '\n【书库摘录】\n' + bookCtx : ''}`;

  try {
    await callLLM([{ role:'system', content:sysPrompt }, ...th.messages.slice(-7,-1).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.content}))], {
      stream: true,
      onChunk: full => {
        aiMsg.content = full;
        const bs = document.querySelectorAll('#chatMessages .msg-row.ai .msg-bubble');
        if (bs.length) bs[bs.length - 1].innerHTML = formatRichText(full);
        scrollChatToBottom(false);
      }
    });
  } catch (e) { aiMsg.content = '请求中断：' + e.message; }
  finally { aiMsg.streaming = false; state.isStreaming = false; th.updatedAt = Date.now(); await dbPut('chats', th); await markDirty(); renderCanwuView(); scrollChatToBottom(false); }
}

async function starCurrentThread() { const th = getActiveThread(); if (!th) return; th.starred = !th.starred; await dbPut('chats', th); renderCanwuView(); showToast(th.starred ? '已标星珍藏' : '已取消标星'); }
async function chatFeedback(idx, type) { if (type === 'fix') { const fix = prompt('指出偏差或正确规律：'); if (!fix?.trim()) return; await saveMemoryItem(CATEGORIES.includes(state.canwuRoom)?state.canwuRoom:state.category, 'fix', '实战纠偏：' + fix.trim()); showToast('已写入纠偏大脑'); } }
function chatSaveNote(idx) { const th = getActiveThread(), msg = th?.messages[idx]; if (msg) createAndOpenNote({ title: th.title || '参悟摘录', body: msg.content }); }
function openThreadDrawer() {
  document.getElementById('threadRoomName').textContent = state.canwuRoom;
  const list = state.chats.filter(t => t.room === state.canwuRoom).sort((a,b) => (b.starred?1:0)-(a.starred?1:0) || (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  document.getElementById('threadListBody').innerHTML = !list.length ? '<div class="empty-box" style="padding:20px;"><p>暂无历史话题</p></div>' : list.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);gap:8px;"><div style="flex:1;min-width:0;cursor:pointer;" onclick="state.activeThreadId='${t.id}';closeSheet('sheet-threads');renderCanwuView()"><div style="font-size:15px;font-weight:600;color:${t.id===state.activeThreadId?'var(--accent)':'var(--text)'};">${t.starred?'★ ':''}${escapeHtml(t.title)}</div><div style="font-size:12px;color:var(--text-3);">${formatDateKey(new Date(t.updatedAt||t.createdAt))} · ${t.messages.length}条</div></div><button class="pill-mini" onclick="deleteThread('${t.id}')">删</button></div>`).join('');
  openSheet('sheet-threads');
}
async function deleteThread(id) { await dbDel('chats', id); state.chats = state.chats.filter(t => t.id !== id); if (state.activeThreadId === id) state.activeThreadId = null; openThreadDrawer(); renderCanwuView(); }
function askCanwuFromReader() { const b = state.books.find(x => x.id === state.reader.bookId), ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1)); closeReader(); switchMainTab('canwu'); switchCanwuRoom(b?.category || state.category); document.getElementById('chatInput').value = `精讲《${b?.title||''}》第${state.reader.pageNum}页核心断法：\n${(ch?.content||'').slice(0, 600)}`; }

async function saveMemoryItem(category, tier, text) { const it = { id: uid('mem'), category, tier, text, createdAt: Date.now() }; await dbPut('memories', it); state.memories.push(it); await markDirty(); }
function openBrainModal() { const c = CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category; document.getElementById('brainCatTag').textContent = c; renderBrainList(c); openSheet('sheet-brain'); }
function renderBrainList(cat) {
  const c = cat || (CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category);
  const list = state.memories.filter(m => m.category === c).sort((a,b) => b.createdAt - a.createdAt);
  document.getElementById('brainMemList').innerHTML = !list.length ? `<div class="empty-box" style="padding:18px;"><p>「${c}」暂无沉淀铁律</p></div>` : list.map(m => `<div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;"><div><span class="pill-mini ${m.tier==='fix'?'accent':''}" style="padding:2px 7px;font-size:11px;margin-right:5px;">${m.tier==='fix'?'纠偏':'心法'}</span>${escapeHtml(m.text)}</div><button style="color:var(--text-3);" onclick="deleteMemory('${m.id}')">删</button></div>`).join('');
}
async function addManualMemory() { const inp = document.getElementById('newMemInput'), txt = inp.value.trim(); if (!txt) return; const c = document.getElementById('brainCatTag').textContent; await saveMemoryItem(c, 'core', txt); inp.value = ''; renderBrainList(c); showToast('已存入大脑'); }
async function deleteMemory(id) { await dbDel('memories', id); state.memories = state.memories.filter(m => m.id !== id); await markDirty(); renderBrainList(); }
async function runCrossBookSynthesis() {
  if (!ensureApiKey()) return;
  const c = document.getElementById('brainCatTag').textContent, bs = state.books.filter(b => b.category === c);
  if (bs.length < 2) return showToast(`请在「${c}」至少上传 2 本典籍`);
  showToast('正在跨书自悟...');
  try {
    const res = await callLLM([{ role:'user', content:`对比以下「${c}」典籍，提炼 3 条跨书融合心法（每条一行，严禁星号）：\n${bs.map(b=>`《${b.title}》：${b.aiProfile||''}`).join('\n')}` }], { tier:'flash' });
    for (const ln of res.split('\n').map(s=>s.replace(/^[\d.\-、\s]+/,'').trim()).filter(s=>s.length>6).slice(0,3)) await saveMemoryItem(c, 'core', '跨书自悟：' + ln);
    renderBrainList(c); showToast('跨书自悟完成');
  } catch (e) { showToast('失败：' + e.message); }
}
async function runMemoryDistill() {
  if (!ensureApiKey()) return;
  const c = document.getElementById('brainCatTag').textContent, list = state.memories.filter(m => m.category === c);
  if (list.length < 4) return showToast('记忆条数不多，暂无需蒸馏');
  showToast('正在蒸馏记忆...');
  try {
    const res = await callLLM([{ role:'user', content:`去重合并以下「${c}」记忆为 5 条精纯铁律（每条一行，严禁星号）：\n${list.map((m,i)=>`${i+1}. ${m.text}`).join('\n')}` }], { tier:'flash' });
    const lines = res.split('\n').map(s=>s.replace(/^[\d.\-、\s]+/,'').trim()).filter(s=>s.length>5);
    if (lines.length) { for (const old of list) await dbDel('memories', old.id); state.memories = state.memories.filter(m => m.category !== c); for (const ln of lines) await saveMemoryItem(c, 'core', ln); renderBrainList(c); showToast('蒸馏完成'); }
  } catch (e) { showToast('失败：' + e.message); }
}

// ==================== 每日摇签与解梦观外应 ====================
let currentDrawObj = null;
function openAskJi() { currentDrawObj = state.dailyDraws.find(d => d.dateKey === formatDateKey(new Date())) || null; renderAskJiBody(); openOverlay('askJiOverlay'); }
function closeAskJi() { closeOverlay('askJiOverlay'); }
function switchAskJiTab(t) { state.askJiTab = t; document.getElementById('askJiSlider').style.transform = `translateX(${t === 'draw' ? 0 : 100}%)`; document.querySelectorAll('#askJiOverlay .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.aj === t)); renderAskJiBody(); }
function renderAskJiBody() {
  const wrap = document.getElementById('askJiBody'), info = getAstroDayInfo(new Date());
  if (state.askJiTab === 'draw') {
    wrap.innerHTML = `
      <div class="card" style="text-align:center;">
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:12px;">
          ${[['zhouyi','周易古签'],['temple','古风灵签'],['word','一字测机']].map(([k,l])=>`<button class="chip ${state.drawStyle===k?'accent':''}" onclick="state.drawStyle='${k}';renderAskJiBody()">${l}</button>`).join('')}
        </div>
        ${state.drawStyle==='word' ? `<input type="text" id="drawOneWordInput" class="form-input" style="max-width:220px;margin:0 auto 12px;text-align:center;" placeholder="输入此刻心中浮现的一个字" />` : ''}
        <div class="tube-stage"><div class="bamboo-tube" id="bambooTubeEl" onclick="triggerBambooDraw()">灵签问机</div></div>
        <div style="font-size:13px;color:var(--text-3);margin-bottom:12px;">${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日（空${info.xunkong}）</div>
        <button class="btn-primary" style="width:100%;" onclick="triggerBambooDraw()">${currentDrawObj ? '随性再摇一签' : '摇动签筒 · 抽今日一签'}</button>
      </div>
      ${currentDrawObj ? `<div class="card">
        <div class="card-head"><span class="card-title">${escapeHtml(currentDrawObj.title)}</span><span class="pill-mini accent">${escapeHtml(currentDrawObj.tone||'今日指引')}</span></div>
        <div style="font-size:15px;line-height:1.78;">${formatRichText(currentDrawObj.body)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
          ${currentDrawObj.hexKey ? `<button class="chip accent" onclick="convertDrawToFullLiuyao()">展开专业六爻全盘 ›</button>` : ''}
          <button class="chip" onclick="checkInDailyDraw('今日应验/避坑了')">晚间打卡：准</button>
          <button class="chip" onclick="checkInDailyDraw('平淡无感')">一般</button>
        </div>
        ${currentDrawObj.checkIn ? `<div style="margin-top:8px;font-size:13px;color:var(--wx-wood);">✓ 已打卡：${escapeHtml(currentDrawObj.checkIn)}</div>` : ''}
      </div>` : ''}
    `;
  } else {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-title" style="margin-bottom:6px;">解梦 · 观外应 · 奇遇问机</div>
        <div style="font-size:13px;color:var(--text-3);margin-bottom:10px;">此刻时空：${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时（空${info.xunkong}）</div>
        <div class="form-field"><textarea id="dreamInputArea" class="form-textarea" placeholder="记录怪梦、看见流星或突发外应..."></textarea></div>
        <div style="display:flex;gap:8px;"><button class="btn-secondary" onclick="startVoiceInput('dreamInputArea')">语音</button><button class="btn-primary" style="flex:1;" id="dreamAskBtn" onclick="submitDreamOmen()">双视角拆解此兆</button></div>
      </div>
      <div id="dreamResultBox"></div>
    `;
  }
}
async function triggerBambooDraw() {
  const tube = document.getElementById('bambooTubeEl'); if (tube) tube.classList.add('shaking');
  playCoinClink(false); if (navigator.vibrate) navigator.vibrate([35, 30, 45]);
  await new Promise(r => setTimeout(r, 650));
  if (tube) tube.classList.remove('shaking');
  playCoinClink(true);
  const dt = new Date(), info = getAstroDayInfo(dt), randHex = HEX_DATA.list[Math.floor(Math.random() * 64)], movPos = Math.floor(Math.random() * 6) + 1;
  const word = (document.getElementById('drawOneWordInput')?.value || '').trim();
  let title = `周易古签：${randHex.name}（第${movPos}爻动）`, tone = randHex.palaceWx + '象启示', body = `【原典锦囊】${randHex.guaci}\n【当日干支】${info.month.gz}月 ${info.day.gz}日（空${info.xunkong}）`;
  if (state.drawStyle === 'temple') {
    const ps = [['上上签 · 春风得意','云开见月正清辉，旧事重逢喜自归。','借势推进'],['中平签 · 藏锋守拙','深潭静水且安身，莫听浮言乱本心。','沉心缓行'],['警示签 · 戒急防偏','路逢岔口莫轻狂，言出须防起波浪。','谨言避坑']];
    const p = ps[Math.floor(Math.random() * ps.length)]; title = p[0]; tone = p[2]; body = `【签诗】${p[1]}\n结合今日 ${info.day.gz}日，宜核清细节再拍板。`;
  } else if (state.drawStyle === 'word' && word) {
    const h = HEX_DATA.list[word.charCodeAt(0) % 64]; title = `一字测机：「${word[0]}」→ ${h.name}`; body = `【原典】${h.guaci}`;
  }
  if (state.settings.apiKey) {
    try { body = await callLLM([{ role:'user', content:`用户摇出「${title}」，今日 ${info.month.gz}月 ${info.day.gz}日（空${info.xunkong}）。简明温暖输出 3 点（重点用【】标注，严禁星号）：1. 今日气场定调 2. 今日宜做与避坑提醒 3. 一句易理锦囊` }], { tier:'flash' }); } catch (e) {}
  }
  currentDrawObj = { id: uid('drw'), dateKey: formatDateKey(dt), title, tone, body, hexKey: randHex.key, movPos, checkIn: '', createdAt: Date.now() };
  await dbPut('dailyDraws', currentDrawObj);
  state.dailyDraws = state.dailyDraws.filter(d => d.dateKey !== currentDrawObj.dateKey); state.dailyDraws.push(currentDrawObj);
  renderAskJiBody();
}
async function checkInDailyDraw(s) { if (!currentDrawObj) return; currentDrawObj.checkIn = s; await dbPut('dailyDraws', currentDrawObj); renderAskJiBody(); showToast('已打卡'); }
function convertDrawToFullLiuyao() {
  if (!currentDrawObj?.hexKey) return; closeAskJi(); const info = getAstroDayInfo(new Date());
  openLiuyaoResult({ id: uid('arc'), category: '六爻', title: currentDrawObj.title, personName: '', gender: '男', group: '自己', createdAt: Date.now(), castTimeStr: new Date().toLocaleString(), lunarStr: info.lunarStr, status: '摇签转全盘', omens: [], data: { mainKey: currentDrawObj.hexKey, moving: [currentDrawObj.movPos||1], yearGz: info.year.gz, monthGz: info.month.gz, dayGz: info.day.gz, hourGz: info.hour.gz, xunkong: info.xunkong, simMonthBranch: info.month.b, simDayBranch: info.day.b, lockedYongshenPos: null }, reports: [], followUps: [], note: currentDrawObj.body, outcome: '', verdict: 'pending' });
}
async function submitDreamOmen() {
  if (!ensureApiKey()) return;
  const txt = (document.getElementById('dreamInputArea')?.value || '').trim(); if (!txt) return showToast('请输入梦境或外应');
  const btn = document.getElementById('dreamAskBtn'); btn.disabled = true; btn.textContent = '解析中...';
  const info = getAstroDayInfo(new Date());
  try {
    const res = await callLLM([{ role:'user', content:`用户在 ${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时（空${info.xunkong}）记录梦境或外应：「${txt}」。用 1. 2. 3. 拆解（重点用【】标注，严禁星号）：1. 象数外应视角 2. 现实心理映射 3. 今日趋避建议` }]);
    document.getElementById('dreamResultBox').innerHTML = `<div class="card"><div class="card-head"><span class="card-title">双视角解兆</span><button class="pill-mini accent" onclick="castDreamToMeihua()">起专业卦 ›</button></div><div style="font-size:15px;line-height:1.78;">${formatRichText(res)}</div></div>`;
  } catch (e) { showToast('解析失败：' + e.message); } finally { btn.disabled = false; btn.textContent = '双视角拆解此兆'; }
}
function castDreamToMeihua() { const txt = (document.getElementById('dreamInputArea')?.value || '').trim(); closeAskJi(); castState.mhMode = 'word'; castState.mhWord = txt.slice(0,6)||'外应'; castState.mhQuestion = '外应：' + txt.slice(0,20); submitMeihuaCast(); }
function openDailyChallenge() { closeAskJi(); switchMainTab('canwu'); switchCanwuRoom(state.category); state.canwuMode = 'practice'; renderCanwuView(); quickAskCanwu('给我出一道【每日一机】1分钟实战盲测题，先隐去结论。'); }

// ==================== 思想星图与境界 ====================
function getCultivationRank() {
  const s = state.books.length * 10 + state.archives.length * 6 + state.memories.length * 8 + state.notes.length * 3;
  return s >= 180 ? '藏往境' : (s >= 100 ? '明理境' : (s >= 50 ? '问机境' : (s >= 20 ? '观象境' : '初窥境')));
}
function openMindMap() { document.getElementById('cultivationRankChip').textContent = getCultivationRank(); openOverlay('mindMapOverlay'); setTimeout(renderMindMapCanvas, 120); }
function renderMindMapCanvas() {
  const canvas = document.getElementById('mindMapCanvas'); if (!canvas) return;
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1.5, 2);
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height, cx = W / 2, cy = H / 2;
  const nodes = [
    ...state.books.slice(0, 12).map(b => ({ type:'典籍', label: b.title, color:'#E8B86D', cat: b.category, r: 7 })),
    ...state.memories.slice(0, 14).map(m => ({ type:'铁律', label: m.text.slice(0, 16), color:'#FF695A', cat: m.category, r: 5.5 })),
    ...state.archives.slice(0, 14).map(a => ({ type:'卷宗', label: a.title.slice(0, 14), color:'#5EA7EE', cat: a.category, r: 5 }))
  ];
  if (!nodes.length) nodes.push({ type:'起点', label:'导入典籍或存一卦点亮星云', color:'#E8B86D', cat:'六爻', r: 8 });
  nodes.forEach((n, i) => { const ang = (i / nodes.length) * Math.PI * 2 + (i % 3) * 0.4, rad = Math.min(W, H) * (0.16 + ((i * 37) % 100) / 340); n.x = cx + Math.cos(ang) * rad; n.y = cy + Math.sin(ang) * rad; });
  ctx.fillStyle = '#0A0C12'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (nodes[i].cat === nodes[j].cat) { ctx.strokeStyle = 'rgba(232,184,109,0.18)'; ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke(); }
  nodes.forEach(n => { ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(238,241,248,0.88)'; ctx.font = '12px sans-serif'; ctx.fillText(n.label.slice(0, 8), n.x + n.r + 5, n.y + 4); });
  canvas.onclick = e => { const r = canvas.getBoundingClientRect(), hit = nodes.find(n => Math.hypot(n.x - (e.clientX - r.left), n.y - (e.clientY - r.top)) < 24); if (hit) document.getElementById('mindMapInfo').innerHTML = `<strong>[${hit.cat} · ${hit.type}]</strong> ${escapeHtml(hit.label)}`; };
}

function startVoiceInput(targetId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return showToast('请直接点手机键盘麦克风听写');
  const rec = new SR(); rec.lang = 'zh-CN'; showToast('请说话...');
  rec.onresult = e => { const el = document.getElementById(targetId); if (el) { el.value += (el.value ? ' ' : '') + e.results[0][0].transcript; el.dispatchEvent(new Event('input')); } };
  rec.start();
}

async function generateHexDeepAI(key) {
  if (!ensureApiKey()) return;
  const h = HEX_DATA.byKey[key]; showToast('深度解析中...');
  try {
    const text = await callLLM([{ role:'user', content:`用 1. 2. 3. 4. 编号（重点用【】标注，严禁星号）精解「${h.name}」（${h.palaceName}）：1. 核心气机 2. 六爻演进 3. 事业求财感情启示 4. 易错点` }], { tier:'flash' });
    await dbPut('hexCache', { id: key, text, updatedAt: Date.now() }); renderHexDetail(); showToast('已缓存');
  } catch (e) { showToast('失败：' + e.message); }
}

// ==================== 主导航与初始化 ====================
function switchMainTab(tab) {
  state.mainTab = tab;
  document.querySelectorAll('.view-page').forEach(p => p.classList.toggle('active', p.id === 'view-' + tab));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderAllCurrentViews();
}
function renderCatStrip() {
  document.getElementById('catStrip').innerHTML = CATEGORIES.map(c => `<button class="cat-pill ${c===state.category?'active':''}" onclick="switchCategory('${c}')">${c}</button>`).join('');
  document.getElementById('notesTabLabel').textContent = state.category + '笔记';
}
function switchCategory(cat) { state.category = cat; renderCatStrip(); renderDivineView(); }
function switchSubTab(sub) {
  state.subTab = sub;
  document.getElementById('subTabSlider').style.transform = `translateX(${['cast','shelf','notes'].indexOf(sub) * 100}%)`;
  document.querySelectorAll('#view-divine .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  renderDivineView();
}
function renderDivineView() {
  const wrap = document.getElementById('divineScrollArea');
  if (state.subTab === 'cast') renderCastPanel(wrap);
  else if (state.subTab === 'shelf') renderShelfPanel(wrap);
  else renderNotesPanel(wrap);
}
function renderAllCurrentViews() {
  if (state.mainTab === 'divine') renderDivineView();
  if (state.mainTab === 'calendar') renderCalendarView();
  if (state.mainTab === 'methods') renderMethodsView();
  if (state.mainTab === 'canwu') renderCanwuView();
}

async function loadAllFromDB() {
  const meta = await dbGet('meta', 'settings');
  if (meta?.data) {
    Object.assign(state.settings, meta.data);
    // 升级 V7 时自动将旧版偏老气的朱砂底切到苹果极简白
    if (state.settings.theme === 'cinnabar' || !state.settings.v7Migrated) {
      state.settings.theme = 'apple';
      state.settings.v7Migrated = true;
      await saveSettingsMeta();
    }
  }
  state.books = await dbGetAll('books');
  state.chapters = await dbGetAll('chapters');
  state.notes = await dbGetAll('notes');
  state.archives = await dbGetAll('archives');
  state.chats = await dbGetAll('chats');
  state.memories = await dbGetAll('memories');
  state.dailyDraws = await dbGetAll('dailyDraws');
  state.footprints = Object.fromEntries((await dbGetAll('footprints')).map(f => [f.id, f.count]));
}

async function autoPruneExpiredChatsOnBoot() {
  const days = Number(state.settings.chatRetentionDays ?? 30); if (days === 0) return;
  const cutoff = days < 0 ? Date.now() : (Date.now() - days * 86400000);
  const expired = state.chats.filter(t => !t.starred && (t.updatedAt || t.createdAt) < cutoff);
  for (const t of expired) await dbDel('chats', t.id);
  if (expired.length) state.chats = state.chats.filter(t => t.starred || (t.updatedAt || t.createdAt) >= cutoff);
}

async function initApp() {
  await openDB();
  await loadAllFromDB();
  await autoPruneExpiredChatsOnBoot();
  applyVisualTheme();
  if (state.settings.dirtySinceBackup) document.getElementById('backupDot').classList.add('show');

  const chatBox = document.getElementById('chatMessages');
  chatBox.addEventListener('scroll', () => {
    const dist = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
    if (dist > 64) { state.userScrolledUp = true; document.getElementById('scrollLatestBtn').classList.add('show'); }
    else { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); }
  });
  document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCanwuMessage(); } });

  renderCatStrip();
  renderDivineView();
  renderCanwuRoomStrip();
  startLiveClockSync();
  bindPhoneShakeForCast();

  const todayFlags = getYingqiFlagsMap()[formatDateKey(new Date())];
  if (todayFlags?.length) setTimeout(() => showToast(`🚩 今日是「${todayFlags[0]}」的应期观察日`), 1200);
}

window.addEventListener('DOMContentLoaded', initApp);
