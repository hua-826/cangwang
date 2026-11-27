// ==================== 藏往 V9 · 参悟教练、笔记、档案与备份 (app.js) ====================
// ==================== 1. 参悟 AI 核心引擎（大白话 + 强证据 + 薄弱点主动提醒） ====================
function ensureApiKey() {
  if (!state.settings.apiKey) {
    showToast('请先点左上角菜单 -> 主题·密钥·备份，填入你的 DeepSeek API Key');
    openSettings();
    return false;
  }
  return true;
}

function redactPrivateText(text) {
  if (state.settings.redactNames === false) return text;
  let out = String(text || '').replace(/1[3-9]\d{9}/g, '[已隐藏]');
  state.archives.forEach(a => { if (a.personName && a.personName.length >= 2) out = out.split(a.personName).join('命主'); });
  return out;
}

async function callLLM(messages, { stream = false, tier = null, onChunk = null } = {}) {
  const s = state.settings;
  const model = (tier || s.useTier) === 'pro' ? (s.proModel || 'deepseek-reasoner') : (s.flashModel || 'deepseek-chat');
  const base = (s.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.apiKey}` },
    body: JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: redactPrivateText(m.content) })), stream, temperature: 0.38 })
  });
  if (!resp.ok) throw new Error(`接口失败(${resp.status})`);
  if (!stream) {
    const d = await resp.json();
    if (d.usage) { s.tokensIn += d.usage.prompt_tokens || 0; s.tokensOut += d.usage.completion_tokens || 0; saveSettingsMeta(); }
    return d.choices?.[0]?.message?.content || '';
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
  s.tokensIn += Math.round(JSON.stringify(messages).length * 0.6);
  s.tokensOut += Math.round(full.length * 0.8);
  saveSettingsMeta();
  return full;
}

function formatRichText(text) {
  let html = escapeHtml(text || '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/【([^】]+)】/g, '<strong>【$1】</strong>').replace(/\*/g, '');
  html = html.replace(/《([^》]+)》第(\d+)页/g, `<span class="ref-jump" onclick="jumpToBookPage('$1',$2)">《$1》第$2页</span>`);
  html = html.replace(/\[应期[:：](\d{4}-\d{2}-\d{2})\]/g, `<span class="ref-jump" onclick="flagYingqiDate('$1')">标记应期 $1</span>`);
  return html.replace(/\n/g, '<br/>');
}

function jumpToBookPage(t, p) {
  const b = state.books.find(x => x.title.includes(t) || t.includes(x.title));
  if (b) openReader(b.id, Number(p));
  else showToast(`书房中未找到《${t}》`);
}

async function flagYingqiDate(dStr) {
  if (state.currentResult) {
    state.currentResult.yingqiDates = Array.from(new Set([...(state.currentResult.yingqiDates || []), dStr]));
    await saveCurrentResultToArchive();
  }
  state.calSelectedDate = dStr;
  const [y, m] = dStr.split('-').map(Number);
  state.calYear = y; state.calMonth = m - 1;
  showToast(`已将 ${dStr} 标记到干支历`);
}

function retrieveFromSelectedBooks(bookIds, qText) {
  const tbs = state.books.filter(b => bookIds.includes(b.id)); if (!tbs.length) return '';
  const tokens = (qText.match(/[\u4e00-\u9fa5]{2,4}/g) || []).slice(0, 16);
  return tbs.map(b => {
    const pages = state.chapters.filter(c => c.bookId === b.id).map(c => ({ c, s: tokens.reduce((acc, tk) => acc + ((c.content || '').includes(tk) ? 2 : 0), 0) })).sort((a, b2) => b2.s - a.s).slice(0, 2);
    return `【书房原书：《${b.title}》】\n` + pages.map(({ c }) => `《${b.title}》第${c.pageNum}页：${(c.content || '').slice(0, 500)}`).join('\n');
  }).join('\n========\n');
}

function buildChartDigestForAI(rec) {
  if (rec.category === '六爻') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey], exam = runLiuyaoPhysicalExam(mh, new Set(d.moving || []), d.monthGz[1], d.dayGz[1], d.xunkong), lsStart = LIU_SHEN_START[d.dayGz[0]] || 0;
    const rows = [5,4,3,2,1,0].map(i => {
      const r = exam.examRows[i];
      return `${r.pos}爻(${LIU_SHEN[(lsStart+i)%6]})：${r.bit?'阳':'阴'} ${r.liuqin}${r.branch}${r.wx}${r.isShi?'(世)':(r.isYing?'(应)':'')} ${r.isMov?'动化'+(r.bian?r.bian.liuqin+r.bian.branch+r.bian.wx:''):'静'} ${d.lockedYongshenPos===r.pos?'【用户指定用神】':''} | 系统已算死状态：[${r.tags.join('、')}]`;
    }).join('\n');
    return `门类：六爻 | 事项：${rec.title} | 性别：${rec.gender}\n现实处境：${rec.contextText || '未填'}\n干支：${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（日空${d.xunkong}）\n主卦：${mh.name}（${mh.palaceName}） ${exam.bianHex ? '变 ' + exam.bianHex.name : '静卦'}\n三合局：${exam.sanheHits.join('、') || '无'}\n完整六爻明细：\n${rows}`;
  }
  return `门类：${rec.category} | 事项：${rec.title}\n排盘硬数据：${JSON.stringify(rec.data)}`;
}

function getWeakSpotsPrompt() {
  const ws = (state.settings.weakSpots || []).slice(-6);
  if (!ws.length) return '';
  return `\n【用户历史练习薄弱点】：${ws.map(w => w.tag).join('、')}。如果本次盘面或问题恰好踩中其中某一点，请在开头先友好提醒他留意这个老盲区。`;
}

async function runSelectedBooksAnalysis() {
  if (!ensureApiKey()) return;
  const rec = state.currentResult; if (!rec) return;
  const btn = document.getElementById('runChartAiBtn'); if (btn) { btn.disabled = true; btn.textContent = '参悟推演中...'; }
  const chosen = state.books.filter(b => state.selectedBookIds.includes(b.id));
  const label = chosen.length === 0 ? '经典断' : (chosen.length === 1 ? `《${chosen[0].title}》` : `多书对照(${chosen.length}本)`);
  const digest = buildChartDigestForAI(rec);
  const bookCtx = retrieveFromSelectedBooks(state.selectedBookIds, digest + ' ' + rec.title);
  const mems = state.memories.filter(m => m.category === rec.category).slice(0, 10).map((m, i) => `${i + 1}. ${m.text}`).join('\n');
  const selfBlock = (state.showSelfJudge && state.selfReason.trim()) ? `\n【用户盲断自判】：用户判「${state.selfVerdict}」，理由：「${state.selfReason.trim()}」。请务必在回复最前面单列【思路对照】，直爽客观地夸他看准的地方，并毫不客气地指出他看漏或断反的关键理法！` : '';

  const sys = `你是用户的私人术数实战教练「参悟」，今日公历 ${formatDateKey(new Date())}。
铁律：
1. 严禁说「总体有波折保持心态就会好」这种两头堵的算命废话，严禁无脑吹捧，全程说人话、讲硬证据。
2. 所有旺衰、月破、暗动、旬空、化进退神已由底层代码算死，严禁自行瞎算篡改。
3. 先给核心定论，再分三层清晰展开：【第一层·吉凶定性】（引用参考书须标《书名》第X页）、【第二层·细节象意】（结合现实处境与六神世应）、【第三层·具体应期】（换算公历并用 [应期:YYYY-MM-DD] 标注）。
4. 严禁在回复中使用任何星号符号。${mems ? '\n【用户个人备忘要求】\n' + mems : ''}${getWeakSpotsPrompt()}${selfBlock}`;

  try {
    const content = (await callLLM([{ role: 'system', content: sys }, { role: 'user', content: `请精准剖析以下盘面：\n${digest}\n\n${bookCtx ? '书房参考原文：\n' + bookCtx : ''}` }])).replace(/\*/g, '').trim();
    const yqs = Array.from(content.matchAll(/\[应期[:：](\d{4}-\d{2}-\d{2})\]/g)).map(m => m[1]);
    if (yqs.length) rec.yingqiDates = Array.from(new Set([...(rec.yingqiDates || []), ...yqs]));
    rec.reports.push({ id: uid('rep'), label, content, createdAt: Date.now() });
    state.activeReportTab = rec.reports.length - 1;
    await saveCurrentResultToArchive();
    renderResultOverlay();
  } catch (e) { showToast('分析失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '+ 再做一份对比分析'; } }
}

function followUpFromResult() { const r = state.currentResult; if (!r) return; closeOverlay('resultOverlay'); switchMainTab('canwu'); switchCanwuRoom(r.category); document.getElementById('chatInput').value = `承接刚排的「${r.title}」，我想继续追问：`; }
async function feedbackResultToBrain() { const r = state.currentResult; if (!r) return; const fix = prompt('写下这次发现的规律或纠偏，存入 AI 备忘：'); if (!fix?.trim()) return; await saveMemoryItem(r.category, 'fix', fix.trim()); showToast('已记入 AI 备忘'); }

// ==================== 2. 参悟问答页（全大白话界面） ====================
function renderCanwuRoomStrip() {
  const el = document.getElementById('canwuRoomStrip'); if (!el) return;
  el.innerHTML = buildDisciplineStripHtml(state.canwuRoom, 'switchCanwuRoom');
  bindCatSwipe(el);
  document.getElementById('canwuHeaderSub').textContent = state.canwuRoom + '问答';
}
function switchCanwuRoom(r) {
  state.canwuRoom = r;
  applyVisualTheme();
  const list = state.chats.filter(t => t.room === r).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  state.activeThreadId = list.length ? list[0].id : null;
  renderCanwuView();
}
function getActiveThread() { return state.activeThreadId ? (state.chats.find(t => t.id === state.activeThreadId && t.room === state.canwuRoom) || null) : null; }
async function startNewChatThread() {
  const th = { id: uid('th'), room: state.canwuRoom, title: '新对话', starred: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  await dbPut('chats', th); state.chats.push(th); state.activeThreadId = th.id;
  renderCanwuView(); showToast('已开启新对话');
}
function renderCanwuView() {
  renderCanwuRoomStrip();
  const box = document.getElementById('chatMessages'), th = getActiveThread(), msgs = th?.messages || [];
  if (!msgs.length) {
    const bookCount = state.books.filter(b => b.category === state.canwuRoom).length;
    box.innerHTML = `
      <div class="card" style="margin-top:6px;">
        <div class="card-head">
          <span class="card-title">${state.canwuRoom} · 私人术数教练</span>
          <span class="pill-mini accent">书房已备 ${bookCount} 本</span>
        </div>
        <div style="font-size:14.5px;color:var(--text-2);line-height:1.72;">说人话、讲原书证据、敢直接指出你的错漏。不搞套话，只帮你真正学会断准。</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">
          <button class="chip" onclick="quickAskCanwu('帮我梳理我书房里${state.canwuRoom}书籍最核心的实战规律')">梳理书房核心</button>
          <button class="chip" onclick="quickAskCanwu('对比不同古籍在${state.canwuRoom}断法上的主要分歧')">不同流派对比</button>
          <button class="chip seal" onclick="quickAskCanwu('出一道${state.canwuRoom}实战难题考考我，先不要公布答案，等我回答完再点评')">出题考考我</button>
        </div>
      </div>
    `;
    return;
  }
  box.innerHTML = msgs.map((m, i) => `
    <div class="msg-row ${m.role}">
      <div class="msg-bubble">${m.role === 'ai' ? formatRichText(m.content) : escapeHtml(m.content).replace(/\n/g, '<br/>')}</div>
      ${m.role === 'ai' && !m.streaming ? `<div class="msg-actions"><button class="msg-act-btn" onclick="starCurrentThread()">${th.starred ? '★ 已收藏' : '☆ 收藏对话'}</button><button class="msg-act-btn" onclick="chatFeedback()">记进 AI 备忘</button><button class="msg-act-btn" onclick="chatSaveNote(${i})">存为笔记</button></div>` : ''}
    </div>
  `).join('');
}
function quickAskCanwu(t) { document.getElementById('chatInput').value = t; sendCanwuMessage(); }
function autoResizeInput(el) { el.style.height = '42px'; el.style.height = Math.min(112, el.scrollHeight) + 'px'; }
function scrollChatToBottom(force = false) { const box = document.getElementById('chatMessages'); if (force) { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); } if (!state.userScrolledUp || force) box.scrollTop = box.scrollHeight; }

async function sendCanwuMessage() {
  if (state.isStreaming || !ensureApiKey()) return;
  const inp = document.getElementById('chatInput'), q = inp.value.trim(); if (!q) return;
  inp.value = ''; inp.style.height = '42px';
  let th = getActiveThread();
  if (!th) { th = { id: uid('th'), room: state.canwuRoom, title: q.slice(0, 16), starred: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; state.chats.push(th); state.activeThreadId = th.id; }
  else if (th.title === '新对话') th.title = q.slice(0, 16);
  th.messages.push({ role: 'user', content: q });
  const aiMsg = { role: 'ai', content: '正在思索翻书...', streaming: true }; th.messages.push(aiMsg); th.updatedAt = Date.now();
  state.isStreaming = true; state.userScrolledUp = false; renderCanwuView(); scrollChatToBottom(true);

  const bookCtx = retrieveFromSelectedBooks(state.books.filter(b => b.category === state.canwuRoom).map(b => b.id).slice(0, 4), q);
  const mems = state.memories.filter(m => m.category === state.canwuRoom).slice(0, 12).map((m, i) => `${i + 1}. ${m.text}`).join('\n');
  const sys = `你是用户的私人术数教练「参悟」，当前门类：【${state.canwuRoom}】。
1. 直接给结论，再用 1. 2. 3. 编号讲人话，重点词用【】标注，严禁使用星号符号。
2. 严禁吹捧迎合和模棱两可的套话；如果用户理法理解错了，温和但直接指出错在哪里。
3. 只要展示六爻卦象，必须完整写出六爻阴阳、动静爻与旬空。
4. 优先引用下方书房原书并标明《书名》第X页，绝不拿地摊玄学瞎编。${mems ? '\n【用户个人备忘】\n' + mems : ''}${getWeakSpotsPrompt()}${bookCtx ? '\n【书房原书摘录】\n' + bookCtx : ''}`;

  try {
    await callLLM([{ role: 'system', content: sys }, ...th.messages.slice(-7, -1).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))], {
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

async function starCurrentThread() { const th = getActiveThread(); if (!th) return; th.starred = !th.starred; await dbPut('chats', th); renderCanwuView(); }
async function chatFeedback() { const fix = prompt('写一条想让 AI 长期记住的习惯或纠偏：'); if (!fix?.trim()) return; await saveMemoryItem(state.canwuRoom, 'fix', fix.trim()); showToast('已记入 AI 备忘'); }
function chatSaveNote(idx) { const th = getActiveThread(), m = th?.messages[idx]; if (m) createAndOpenNote({ title: th.title || '参悟摘录', body: m.content }); }
function openThreadDrawer() {
  document.getElementById('threadRoomName').textContent = state.canwuRoom;
  const list = state.chats.filter(t => t.room === state.canwuRoom).sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  document.getElementById('threadListBody').innerHTML = !list.length ? '<div class="empty-box" style="padding:20px;"><p>暂无历史记录</p></div>' : list.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);gap:8px;"><div style="flex:1;min-width:0;cursor:pointer;" onclick="state.activeThreadId='${t.id}';closeSheet('sheet-threads');renderCanwuView()"><div style="font-size:15px;font-weight:600;color:${t.id===state.activeThreadId?'var(--accent)':'var(--text)'};">${t.starred?'★ ':''}${escapeHtml(t.title)}</div><div style="font-size:12px;color:var(--text-3);">${formatDateKey(new Date(t.updatedAt||t.createdAt))} · ${t.messages.length}条</div></div><button class="pill-mini" onclick="deleteThread('${t.id}')">删</button></div>`).join('');
  openSheet('sheet-threads');
}
async function deleteThread(id) { await dbDel('chats', id); state.chats = state.chats.filter(t => t.id !== id); if (state.activeThreadId === id) state.activeThreadId = null; openThreadDrawer(); renderCanwuView(); }
function askCanwuFromReader() {
  const b = state.books.find(x => x.id === state.reader.bookId), ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  closeReader(); switchMainTab('canwu'); switchCanwuRoom(b?.category || state.category);
  document.getElementById('chatInput').value = `用大白话精讲《${b?.title || ''}》第${state.reader.pageNum}页的核心断法：\n${(ch?.content || '').slice(0, 600)}`;
}

// ==================== 3. AI 备忘与自动薄弱点 ====================
async function saveMemoryItem(cat, tier, text) { const it = { id: uid('mem'), category: cat, tier, text, createdAt: Date.now() }; await dbPut('memories', it); state.memories.push(it); await markDirty(); }
function openMemoSheet() { document.getElementById('memoCatTag').textContent = state.canwuRoom; renderMemoList(state.canwuRoom); openSheet('sheet-memo'); }
function renderMemoList(cat) {
  const c = cat || state.canwuRoom, list = state.memories.filter(m => m.category === c).sort((a, b) => b.createdAt - a.createdAt);
  document.getElementById('memoListBody').innerHTML = !list.length ? `<div style="font-size:13.5px;color:var(--text-3);padding:8px 0;">暂无自定义提醒，可以在上面写一条教 AI 顺着你的习惯讲。</div>` : list.map(m => `<div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;"><div>${escapeHtml(m.text)}</div><button style="color:var(--text-3);flex-shrink:0;" onclick="deleteMemory('${m.id}')">删</button></div>`).join('');
  const ws = state.settings.weakSpots || [];
  document.getElementById('weakSpotListBody').innerHTML = !ws.length ? `<div style="font-size:13px;color:var(--text-3);">去「研习 -> 实战练习」刷题时，没记住的知识点会自动汇集到这里。</div>` : `<div style="display:flex;flex-wrap:wrap;gap:6px;">${ws.map((w, i) => `<button class="chip seal" onclick="deleteWeakSpot(${i})" title="点一下消除">${escapeHtml(w.tag)} ×${w.count || 1}</button>`).join('')}</div>`;
}
async function addManualMemory() { const inp = document.getElementById('newMemoInput'), txt = inp.value.trim(); if (!txt) return; const c = document.getElementById('memoCatTag').textContent; await saveMemoryItem(c, 'core', txt); inp.value = ''; renderMemoList(c); showToast('已记入 AI 备忘'); }
async function deleteMemory(id) { await dbDel('memories', id); state.memories = state.memories.filter(m => m.id !== id); await markDirty(); renderMemoList(); }
async function deleteWeakSpot(idx) { state.settings.weakSpots.splice(idx, 1); await saveSettingsMeta(); renderMemoList(); showToast('已标记掌握并移除'); }

// ==================== 4. 笔记、档案库、八字合盘与全库秒搜 ====================
let noteSaveTimer = null;
function renderNotesPanel(wrap) {
  const q = state.noteSearch.trim().toLowerCase(), list = state.notes.filter(n => n.category === state.category && (!q || (n.title + n.body).toLowerCase().includes(q))).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  wrap.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:14px;"><input type="text" class="form-input" placeholder="搜索「${state.category}笔记」..." value="${escapeHtml(state.noteSearch)}" oninput="state.noteSearch=this.value;renderDivineView()" /><button class="btn-primary" style="padding:9px 16px;flex-shrink:0;" onclick="createAndOpenNote()">+ 新建</button></div>${!list.length ? `<div class="empty-box"><p>记录读经心得与断卦灵感</p><button class="btn-secondary" onclick="createAndOpenNote()">写第一篇${state.category}笔记</button></div>` : list.map(n => `<div class="card" style="cursor:pointer;padding:15px 17px;" onclick="openNoteEditor('${n.id}')"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><strong style="font-size:16px;">${n.pinned ? '置顶 · ' : ''}${escapeHtml(n.title || '无标题笔记')}</strong><span style="font-size:12px;color:var(--text-3);">${formatDateKey(new Date(n.updatedAt || n.createdAt))}</span></div><div class="priv-blur" style="font-size:14px;color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55;">${escapeHtml((n.body || '').replace(/\n/g, ' ')) || '轻点开始编辑...'}</div></div>`).join('')}`;
}
async function createAndOpenNote(preset = {}) { const n = { id: uid('nt'), category: state.category, pinned: false, title: preset.title || '', body: preset.body || '', createdAt: Date.now(), updatedAt: Date.now() }; await dbPut('notes', n); state.notes.push(n); await markDirty(); openNoteEditor(n.id); }
function openNoteEditor(id) { const n = state.notes.find(x => x.id === id); if (!n) return; state.editingNoteId = id; document.getElementById('noteEditorMeta').textContent = n.category + '笔记 · 自动保存'; document.getElementById('notePinBtn').className = 'pill-mini ' + (n.pinned ? 'accent' : ''); document.getElementById('noteTitleField').value = n.title || ''; document.getElementById('noteBodyArea').value = n.body || ''; document.getElementById('noteFolderSelect').innerHTML = CATEGORIES.map(c => `<option ${c === n.category ? 'selected' : ''}>${c}</option>`).join(''); openOverlay('noteEditorOverlay'); }
function scheduleNoteAutoSave() { clearTimeout(noteSaveTimer); noteSaveTimer = setTimeout(saveCurrentNoteNow, 350); }
async function saveCurrentNoteNow() { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.title = document.getElementById('noteTitleField').value.trim(); n.body = document.getElementById('noteBodyArea').value; n.updatedAt = Date.now(); await dbPut('notes', n); await markDirty(); }
async function closeNoteEditor() { await saveCurrentNoteNow(); closeOverlay('noteEditorOverlay'); if (state.mainTab === 'divine') renderDivineView(); }
async function toggleCurrentNotePin() { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.pinned = !n.pinned; await dbPut('notes', n); document.getElementById('notePinBtn').className = 'pill-mini ' + (n.pinned ? 'accent' : ''); }
async function changeCurrentNoteFolder(cat) { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.category = cat; await dbPut('notes', n); showToast('已移至「' + cat + '」'); }
async function deleteCurrentNote() { if (!confirm('删除这篇笔记？')) return; await dbDel('notes', state.editingNoteId); state.notes = state.notes.filter(x => x.id !== state.editingNoteId); await markDirty(); closeOverlay('noteEditorOverlay'); renderDivineView(); }
function noteInsertChecklist() { const ta = document.getElementById('noteBodyArea'); ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + '☐ '; scheduleNoteAutoSave(); }
function noteInsertGanZhi() { const i = getAstroDayInfo(new Date()), ta = document.getElementById('noteBodyArea'); ta.value += `\n【${formatDateKey(new Date())} ${i.year.gz}年 ${i.month.gz}月 ${i.day.gz}日 ${i.hour.gz}时 空${i.xunkong}】\n`; scheduleNoteAutoSave(); }

function openArchivesOverlay() { state.archCategory = state.category; renderArchivesView(); openOverlay('archivesOverlay'); }
function renderArchivesView() {
  document.getElementById('archHeaderSub').textContent = state.archCategory + '档案库';
  document.getElementById('baziCompareBtn').style.display = state.archCategory === '八字' ? 'inline-flex' : 'none';
  document.getElementById('archCatStrip').innerHTML = CATEGORIES.map(c => `<button class="cat-pill ${c === state.archCategory ? 'active' : ''}" onclick="state.archCategory='${c}';state.archGroup='全部';renderArchivesView()">${c}</button>`).join('');
  document.getElementById('archGroupStrip').innerHTML = ['全部', ...(state.settings.groups || [])].map(g => `<button class="chip ${g === state.archGroup ? 'accent' : ''}" onclick="state.archGroup='${escapeHtml(g)}';renderArchivesView()">${escapeHtml(g)}</button>`).join('');
  const catList = state.archives.filter(a => a.category === state.archCategory).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  const filtered = state.archGroup === '全部' ? catList : catList.filter(a => a.group === state.archGroup);
  document.getElementById('archivesScrollArea').innerHTML = !filtered.length ? `<div class="empty-box"><p>「${state.archCategory} · ${state.archGroup}」暂无档案</p></div>` : filtered.map(a => `<div class="card" style="cursor:pointer;" onclick="openSavedArchive('${a.id}')"><div class="card-head" style="margin-bottom:6px;"><div class="card-title priv-blur">${escapeHtml(a.title)}</div><span class="pill-mini ${a.verdict==='hit'?'accent':''}">${a.verdict==='hit'?'已应验':(a.verdict==='miss'?'有偏差':'待验证')}</span></div><div style="font-size:13px;color:var(--text-3);display:flex;justify-content:space-between;"><span>${escapeHtml(a.castTimeStr || '')} · ${escapeHtml(a.group || '默认')}</span><span>${a.reports?.length ? a.reports.length + '份剖析' : ''}</span></div>${a.outcome ? `<div class="priv-blur" style="font-size:13.5px;color:var(--accent);margin-top:6px;">应验：${escapeHtml(a.outcome)}</div>` : ''}<div style="display:flex;justify-content:flex-end;margin-top:8px;"><button style="font-size:12.5px;color:var(--text-3);" onclick="event.stopPropagation();deleteArchive('${a.id}')">删除</button></div></div>`).join('');
}
function openSavedArchive(id) { const a = state.archives.find(x => x.id === id); if (!a) return; if (a.category === '六爻') openLiuyaoResult(a); else openGenericResult(a); }
async function deleteArchive(id) { if (!confirm('删除这份档案？')) return; await dbDel('archives', id); state.archives = state.archives.filter(a => a.id !== id); await markDirty(); renderArchivesView(); }
function openGroupEditor() { document.getElementById('groupEditList').innerHTML = (state.settings.groups || []).map((g, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:15px;">${escapeHtml(g)}</span><button class="pill-mini" onclick="removeArchiveGroup(${i})">删</button></div>`).join(''); openSheet('sheet-groups'); }
async function addArchiveGroup() { const inp = document.getElementById('newGroupInput'), v = inp.value.trim(); if (!v) return; if (!state.settings.groups.includes(v)) state.settings.groups.push(v); inp.value = ''; await saveSettingsMeta(); openGroupEditor(); renderArchivesView(); }
async function removeArchiveGroup(i) { state.settings.groups.splice(i, 1); await saveSettingsMeta(); openGroupEditor(); renderArchivesView(); }

let baziComparePair = ['', ''];
function openBaziCompare() { const list = state.archives.filter(a => a.category === '八字'); if (list.length < 2) return showToast('请先保存至少 2 份八字档案'); baziComparePair = [list[0].id, list[1].id]; renderBaziCompareBody(); openOverlay('baziCompareOverlay'); }
function renderBaziCompareBody() {
  const list = state.archives.filter(a => a.category === '八字'), a1 = list.find(x => x.id === baziComparePair[0]) || list[0], a2 = list.find(x => x.id === baziComparePair[1]) || list[1];
  const rCol = a => a.data.pillars.map(p => `<span class="wx-${p.swx}" style="font-weight:700;">${p.s}</span><span class="wx-${p.bwx}" style="font-weight:700;">${p.b}</span>`).join(' · ');
  document.getElementById('baziCompareBody').innerHTML = `<div class="card"><div class="form-field"><label class="form-label">命盘甲</label><select class="form-select" onchange="baziComparePair[0]=this.value;renderBaziCompareBody()">${list.map(x => `<option value="${x.id}" ${x.id===a1.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><div style="margin-top:8px;font-size:16px;">${rCol(a1)}</div></div><div class="form-field"><label class="form-label">命盘乙</label><select class="form-select" onchange="baziComparePair[1]=this.value;renderBaziCompareBody()">${list.map(x => `<option value="${x.id}" ${x.id===a2.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><div style="margin-top:8px;font-size:16px;">${rCol(a2)}</div></div></div><div id="baziCompareAiBox" class="card" style="font-size:15px;line-height:1.75;color:var(--text-2);">点右上角「AI 合盘」获取深度对比剖析。</div>`;
}
async function analyzeBaziCompareWithAI() { if (!ensureApiKey()) return; const list = state.archives.filter(a => a.category === '八字'), a1 = list.find(x => x.id === baziComparePair[0]), a2 = list.find(x => x.id === baziComparePair[1]), box = document.getElementById('baziCompareAiBox'); box.textContent = '参悟合盘中...'; try { box.innerHTML = formatRichText(await callLLM([{ role: 'user', content: `用 1. 2. 3. 编号清单（重点用【】标注，严禁星号）分析以下两个八字的合盘互补、日支关系与相处建议：\n甲(${a1.gender})：${a1.data.pillars.map(p => p.gz).join(' ')}\n乙(${a2.gender})：${a2.data.pillars.map(p => p.gz).join(' ')}` }])); } catch (e) { box.textContent = '失败：' + e.message; } }

function openGlobalSearch() { document.getElementById('globalSearchInput').value = ''; document.getElementById('globalSearchResults').innerHTML = '<div class="empty-box"><p>搜全库：书房原书、实战档案、个人笔记与基础进阶知识</p></div>'; openOverlay('globalSearchOverlay'); setTimeout(() => document.getElementById('globalSearchInput').focus(), 200); }
function runGlobalSearch(q) {
  const k = (q || '').trim(), wrap = document.getElementById('globalSearchResults'); if (!k) return;
  const bookHits = state.chapters.filter(c => (c.content || '').includes(k)).slice(0, 8);
  const archHits = state.archives.filter(a => (a.title + (a.note || '') + (a.outcome || '')).includes(k)).slice(0, 6);
  const noteHits = state.notes.filter(n => (n.title + n.body).includes(k)).slice(0, 6);
  const kbHits = []; Object.entries(getMergedStudyKB()).forEach(([g, arr]) => arr.forEach((art, idx) => { if ((art.title + art.content).includes(k)) kbHits.push({ g, idx, art }); }));
  let html = '';
  if (bookHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">书房原书命中</div>${bookHits.map(c => { const b = state.books.find(x => x.id === c.bookId), pos = c.content.indexOf(k); return `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openReader('${c.bookId}',${c.pageNum})"><div style="font-size:14px;font-weight:600;color:var(--accent);">《${escapeHtml(b?.title || '')}》第${c.pageNum}页</div><div style="font-size:13px;color:var(--text-2);">...${escapeHtml(c.content.slice(Math.max(0, pos - 22), pos + 60))}...</div></div>`; }).join('')}</div>`;
  if (kbHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">研习知识库命中</div>${kbHits.slice(0, 6).map(d => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openArticleOverlay('${d.g}',${d.idx})">[${d.g}] ${escapeHtml(d.art.title)}</div>`).join('')}</div>`;
  if (archHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">实战档案命中</div>${archHits.map(a => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openSavedArchive('${a.id}')">[${a.category}] ${escapeHtml(a.title)}</div>`).join('')}</div>`;
  if (noteHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">笔记命中</div>${noteHits.map(n => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openNoteEditor('${n.id}')">[${n.category}] ${escapeHtml(n.title || '无标题')}</div>`).join('')}</div>`;
  wrap.innerHTML = html || '<div class="empty-box"><p>未检索到匹配结果</p></div>';
}

// ==================== 5. iCloud 两步备份、AES-256 云同步与设置 ====================
async function deriveAesKey(pass, salt) {
  const bk = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, bk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function bytesToB64(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function b64ToBytes(b64) { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
async function encryptPayload(jsonStr, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(pass, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonStr));
  return JSON.stringify({ e2e: 'AES-256-GCM', s: bytesToB64(salt), iv: bytesToB64(iv), d: bytesToB64(new Uint8Array(cipher)) });
}
async function decryptPayload(wrappedStr, pass) {
  const obj = JSON.parse(wrappedStr); if (!obj.e2e) return obj;
  const key = await deriveAesKey(pass, b64ToBytes(obj.s));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(obj.iv) }, key, b64ToBytes(obj.d));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function buildTextVaultPayload() {
  return {
    version: 'CangwangV9', exportedAt: new Date().toISOString(),
    books: await dbGetAll('books'), chapters: await dbGetAll('chapters'), notes: await dbGetAll('notes'),
    archives: await dbGetAll('archives'), chats: await dbGetAll('chats'), memories: await dbGetAll('memories'),
    footprints: await dbGetAll('footprints'),
    settingsLite: { theme: state.settings.theme, groups: state.settings.groups, myDayPillar: state.settings.myDayPillar, weakSpots: state.settings.weakSpots, articleSourceCache: state.settings.articleSourceCache, customDict: state.customDict }
  };
}
async function applyTextVaultPayload(data) {
  if (!data || !Array.isArray(data.archives)) throw new Error('备份文件格式不匹配');
  for (const st of ['books','chapters','notes','archives','chats','memories','footprints']) {
    if (Array.isArray(data[st])) for (const it of data[st]) await dbPut(st, it);
  }
  if (data.settingsLite) {
    if (Array.isArray(data.settingsLite.customDict)) { state.customDict = data.settingsLite.customDict; await dbPut('meta', { id: 'customDict', data: state.customDict }); }
    Object.assign(state.settings, data.settingsLite); await saveSettingsMeta();
  }
  await loadAllFromDB(); applyVisualTheme(); renderAllCurrentViews();
}

async function pushToCloudD1() {
  saveGeneralSettings(true);
  const { syncUrl, vaultPass, e2eEncrypt } = state.settings;
  if (!syncUrl || !vaultPass) return showToast('请先填写 Worker 地址和口令');
  showToast('正在加密上传云端...');
  try {
    let bodyStr = JSON.stringify(await buildTextVaultPayload());
    if (e2eEncrypt) bodyStr = await encryptPayload(bodyStr, vaultPass);
    const resp = await fetch(syncUrl.replace(/\/$/, '') + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': vaultPass }, body: JSON.stringify({ payload: bodyStr }) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    state.settings.dirtySinceBackup = false; state.settings.lastSyncAt = new Date().toLocaleString();
    document.getElementById('backupDot')?.classList.remove('show');
    await saveSettingsMeta();
    document.getElementById('cloudSyncStatus').textContent = '上次同步：' + state.settings.lastSyncAt;
    showToast('已同步至云端');
  } catch (e) { showToast('上传失败：' + e.message); }
}
async function pullFromCloudD1() {
  saveGeneralSettings(true);
  const { syncUrl, vaultPass } = state.settings;
  if (!syncUrl || !vaultPass) return showToast('请先填写 Worker 地址和口令');
  showToast('正在拉回并解密...');
  try {
    const resp = await fetch(syncUrl.replace(/\/$/, '') + '/sync', { method: 'GET', headers: { 'X-Vault-Token': vaultPass } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const res = await resp.json(); if (!res.payload) return showToast('云端暂无备份');
    await applyTextVaultPayload(await decryptPayload(res.payload, vaultPass));
    closeSheet('sheet-settings'); showToast('已从云端完整恢复');
  } catch (e) { showToast('拉回失败（核对口令）：' + e.message); }
}

async function prepareLocalBackup() {
  const str = JSON.stringify(await buildTextVaultPayload());
  preparedBackupBlob = new Blob([str], { type: 'application/json' });
  preparedBackupName = `藏往V9备份_${formatDateKey(new Date())}.json`;
  const btn = document.getElementById('saveBackupBtn'); btn.disabled = false; btn.style.opacity = '1';
  document.getElementById('packBackupBtn').textContent = '已打包 (' + (str.length / 1024).toFixed(1) + ' KB)';
  showToast('已打包，请点「2. 存到 iCloud」');
}
function triggerLocalBackupSave() {
  if (!preparedBackupBlob) return;
  const file = new File([preparedBackupBlob], preparedBackupName, { type: 'application/json' });
  state.settings.dirtySinceBackup = false; document.getElementById('backupDot')?.classList.remove('show'); saveSettingsMeta();
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: '藏往备份', text: '请选择存储到文件存入 iCloud 云盘' }).catch(() => fallbackAnchorDownload(preparedBackupBlob, preparedBackupName));
  else fallbackAnchorDownload(preparedBackupBlob, preparedBackupName);
}
function fallbackAnchorDownload(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000); }
async function importLocalBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  try { await applyTextVaultPayload(JSON.parse(await f.text())); closeSheet('sheet-settings'); showToast('备份恢复成功'); } catch (err) { showToast('恢复失败：' + err.message); }
  e.target.value = '';
}
async function refreshStorageStats() {
  const box = document.getElementById('storageStatsBox'); if (!box) return;
  const pdfs = await dbGetAll('pdfBlobs');
  const pdfMB = (pdfs.reduce((a, b) => a + (b.data ? b.data.byteLength : 0), 0) / 1048576).toFixed(2);
  box.textContent = `本地珍藏库：${state.books.length} 本典籍（PDF ${pdfMB} MB）、${state.archives.length} 份卷宗、${state.notes.length} 篇笔记`;
}

function openSettings() {
  const s = state.settings;
  document.getElementById('cfgCoinSound').checked = s.coinSound !== false;
  document.getElementById('cfgApiKey').value = s.apiKey || '';
  document.getElementById('cfgBaseUrl').value = s.baseUrl || 'https://api.deepseek.com';
  document.getElementById('cfgFlashModel').value = s.flashModel || 'deepseek-chat';
  document.getElementById('cfgProModel').value = s.proModel || 'deepseek-reasoner';
  document.getElementById('cfgUseTier').value = s.useTier || 'flash';
  document.getElementById('cfgRedactNames').checked = s.redactNames !== false;
  document.getElementById('cfgMyDayPillar').value = s.myDayPillar || '';
  document.getElementById('cfgSyncUrl').value = s.syncUrl || '';
  document.getElementById('cfgVaultPass').value = s.vaultPass || '';
  document.getElementById('cfgE2eEncrypt').checked = s.e2eEncrypt !== false;
  const est = ((s.tokensIn / 1e6) * 1.5 + (s.tokensOut / 1e6) * 5).toFixed(3);
  document.getElementById('costStatsBox').textContent = `累计估算：输入 ${s.tokensIn} / 输出 ${s.tokensOut} tokens（约 ¥${est}）`;
  document.getElementById('cloudSyncStatus').textContent = s.lastSyncAt ? '上次同步：' + s.lastSyncAt : '未配置云同步（推荐使用上方 iCloud 备份）';
  refreshStorageStats();
  openSheet('sheet-settings');
}
async function saveGeneralSettings(silent = false) {
  const s = state.settings;
  s.coinSound = document.getElementById('cfgCoinSound').checked;
  s.apiKey = document.getElementById('cfgApiKey').value.trim();
  s.baseUrl = document.getElementById('cfgBaseUrl').value.trim() || 'https://api.deepseek.com';
  s.flashModel = document.getElementById('cfgFlashModel').value.trim() || 'deepseek-chat';
  s.proModel = document.getElementById('cfgProModel').value.trim() || 'deepseek-reasoner';
  s.useTier = document.getElementById('cfgUseTier').value;
  s.redactNames = document.getElementById('cfgRedactNames').checked;
  s.myDayPillar = document.getElementById('cfgMyDayPillar').value.trim();
  s.syncUrl = document.getElementById('cfgSyncUrl').value.trim();
  s.vaultPass = document.getElementById('cfgVaultPass').value.trim();
  s.e2eEncrypt = document.getElementById('cfgE2eEncrypt').checked;
  await saveSettingsMeta();
  if (!silent) showToast('设置已保存');
}

function startVoiceInput(id) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return showToast('请直接点手机键盘麦克风听写');
  const rec = new SR(); rec.lang = 'zh-CN'; showToast('请说话...');
  rec.onresult = e => { const el = document.getElementById(id); if (el) { el.value += (el.value ? ' ' : '') + e.results[0][0].transcript; el.dispatchEvent(new Event('input')); } };
  rec.start();
}

// ==================== 6. 主导航切换与启动初始化 ====================
function switchMainTab(tab) {
  state.mainTab = tab;
  document.querySelectorAll('.view-page').forEach(p => p.classList.toggle('active', p.id === 'view-' + tab));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  applyVisualTheme();
  renderAllCurrentViews();
}
function renderCatStrip() {
  const el = document.getElementById('catStrip'); if (!el) return;
  el.innerHTML = buildDisciplineStripHtml(state.category, 'switchCategory');
  bindCatSwipe(el);
  document.getElementById('notesTabLabel').textContent = state.category + '笔记';
}
function switchCategory(c) { state.category = c; applyVisualTheme(); renderCatStrip(); renderDivineView(); }
function switchSubTab(sub) {
  state.subTab = sub;
  document.getElementById('subTabSlider').style.transform = `translateX(${sub === 'cast' ? 0 : 100}%)`;
  document.querySelectorAll('#view-divine .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  renderDivineView();
}
function renderDivineView() {
  const wrap = document.getElementById('divineScrollArea');
  if (state.subTab === 'cast') renderCastPanel(wrap);
  else renderNotesPanel(wrap);
}
function renderAllCurrentViews() {
  if (state.mainTab === 'divine') renderDivineView();
  if (state.mainTab === 'library') renderLibraryView();
  if (state.mainTab === 'study') renderStudyView();
  if (state.mainTab === 'canwu') renderCanwuView();
}

async function loadAllFromDB() {
  const meta = await dbGet('meta', 'settings');
  if (meta?.data) {
    Object.assign(state.settings, meta.data);
    if (!state.settings.v9Migrated) { state.settings.theme = 'shuimo'; state.settings.v9Migrated = true; await saveSettingsMeta(); }
  }
  const cd = await dbGet('meta', 'customDict'); if (Array.isArray(cd?.data)) state.customDict = cd.data;
  state.books = await dbGetAll('books'); state.chapters = await dbGetAll('chapters'); state.notes = await dbGetAll('notes');
  state.archives = await dbGetAll('archives'); state.chats = await dbGetAll('chats'); state.memories = await dbGetAll('memories');
  state.footprints = Object.fromEntries((await dbGetAll('footprints')).map(f => [f.id, f.count]));
}

async function initApp() {
  await openDB();
  await loadAllFromDB();
  applyVisualTheme();
  if (state.settings.dirtySinceBackup) document.getElementById('backupDot')?.classList.add('show');
  const chatBox = document.getElementById('chatMessages');
  chatBox.addEventListener('scroll', () => {
    const d = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
    if (d > 64) { state.userScrolledUp = true; document.getElementById('scrollLatestBtn').classList.add('show'); }
    else { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); }
  });
  document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCanwuMessage(); } });
  renderCatStrip(); renderDivineView(); renderCanwuRoomStrip(); startLiveClockSync(); bindPhoneShakeForCast();
}
window.addEventListener('DOMContentLoaded', initApp);
