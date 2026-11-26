// ==================== 藏往 V6：参悟八大分舱智能体、动态多书PK、每日摇签解梦、思想星图与主控入口 ====================

// ==================== 1. 大模型统一调用 + 自动姓名隐私脱敏 ====================
function ensureApiKey() {
  if (!state.settings.apiKey) {
    showToast('请先在右上角设置中填写 DeepSeek API Key');
    openSettings();
    return false;
  }
  return true;
}

function redactPrivateText(text) {
  if (state.settings.redactNames === false) return text;
  let out = String(text || '');
  // 替换手机号与档案里记录过的真实姓名
  out = out.replace(/1[3-9]\d{9}/g, '[已脱敏号码]');
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
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`接口失败(${resp.status})：${err.slice(0, 90)}`);
  }
  if (!stream) {
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (data.usage) {
      s.tokensIn += data.usage.prompt_tokens || 0;
      s.tokensOut += data.usage.completion_tokens || 0;
      saveSettingsMeta();
    }
    return content;
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let full = '', buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const ln of lines) {
      const t = ln.trim();
      if (!t.startsWith('data:')) continue;
      const p = t.slice(5).trim();
      if (p === '[DONE]') continue;
      try {
        const delta = JSON.parse(p).choices?.[0]?.delta?.content || '';
        if (delta) { full += delta; if (onChunk) onChunk(full); }
      } catch (e) {}
    }
  }
  s.tokensIn += Math.round(JSON.stringify(safeMessages).length * 0.6);
  s.tokensOut += Math.round(full.length * 0.8);
  saveSettingsMeta();
  return full;
}

// 统一富文本渲染（彻底剔除星号，支持《书名》第X页跳转与[应期:YYYY-MM-DD]插旗日历）
function formatRichText(text) {
  let html = escapeHtml(text || '');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/【([^】]+)】/g, '<strong>【$1】</strong>');
  html = html.replace(/\*/g, '');
  html = html.replace(/《([^》]+)》第(\d+)页/g, `<span class="ref-jump" onclick="jumpToBookPage('$1',$2)">《$1》第$2页</span>`);
  html = html.replace(/\[应期[:：](\d{4}-\d{2}-\d{2})\]/g, `<span class="ref-jump" onclick="flagYingqiDate('$1')">🚩 插旗 $1</span>`);
  html = html.replace(/\n/g, '<br/>');
  return html;
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
  showToast(`已将 ${dateStr} 应期插旗钉入干支日历！`);
}

// ==================== 2. 静默建立本书流派身份证与断法索引 ====================
async function buildBookAiProfile(bookId) {
  if (!ensureApiKey()) return;
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;
  const sampleChs = state.chapters.filter(c => c.bookId === bookId).sort((a,b) => a.pageNum - b.pageNum).slice(0, 6);
  const tocStr = (book.toc || []).slice(0, 30).map(t => `${t.title}(P.${t.pageNum})`).join('、');
  const sampleTxt = sampleChs.map(c => c.content.slice(0, 400)).join('\n');
  showToast(`正在为《${book.title}》建立流派身份证...`);
  try {
    const res = await callLLM([{
      role: 'user',
      content: `请根据《${book.title}》（${book.category}典籍）的目录与前几页正文，用不超过 70 字概括这本书的【流派侧重与核心断法特色】（直接输出纯文本，严禁使用星号）：\n目录：${tocStr}\n前文摘录：${sampleTxt.slice(0, 2000)}`
    }], { tier: 'flash' });
    book.aiProfile = res.replace(/\*/g, '').trim();
    await dbPut('books', book);
    await markDirty();
    openBookEditSheet(bookId);
    renderDivineView();
    showToast('已建立本书流派身份证！');
  } catch (e) {
    showToast('建索引失败：' + e.message);
  }
}

async function translateCurrentPage() {
  if (!ensureApiKey()) return;
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch || !ch.content.trim()) return showToast('本页暂无可翻译文本');
  showToast('正在翻译本页现代白话...');
  try {
    const res = await callLLM([{
      role: 'user',
      content: `将以下古籍内容逐段翻译成通俗准确的现代大白话（保持原段落结构，严禁星号）：\n${ch.content.slice(0, 3500)}`
    }], { tier: 'flash' });
    ch.modernText = res.replace(/\*/g, '').trim();
    await dbPut('chapters', ch);
    state.reader.engine = 'text';
    state.reader.textMode = 'both';
    await renderReaderPage();
    showToast('本页白话已生成并永久缓存');
  } catch (e) {
    showToast('翻译失败：' + e.message);
  }
}

async function extractCaseBlindTest() {
  if (!ensureApiKey()) return;
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  if (!ch || !ch.content.trim()) return showToast('本页暂无可抽取文本');
  closeReader();
  switchMainTab('canwu');
  switchCanwuRoom(state.category);
  state.canwuMode = 'practice';
  renderCanwuView();
  document.getElementById('chatInput').value = `请从下面这页原书中抽取出其中的卦例/命例出题考我（先隐藏原书作者的最终断语和应验结果，让我自己先定用神判吉凶，等我回答后你再揭晓原书解析并点评）：\n${ch.content.slice(0, 2200)}`;
  sendCanwuMessage();
}

// ==================== 3. 排盘页动态选书断卦 + 多书 PK + 本地盘面体检注入 ====================
function retrieveFromSelectedBooks(bookIds, queryText, category) {
  const targetBooks = state.books.filter(b => bookIds.includes(b.id));
  if (!targetBooks.length) return '';
  const tokens = (queryText.match(/[\u4e00-\u9fa5]{2,4}/g) || []).slice(0, 18);
  const score = txt => tokens.reduce((acc, tk) => acc + (txt.includes(tk) ? 2 : 0), 0);

  return targetBooks.map(b => {
    const chs = state.chapters.filter(c => c.bookId === b.id);
    const topPages = chs.map(c => ({ c, s: score(c.content || '') }))
      .sort((a, b2) => b2.s - a.s)
      .slice(0, targetBooks.length > 2 ? 2 : 3);
    const isMain = state.primaryBookId === b.id && targetBooks.length > 1;
    return `【参考典籍${isMain ? '（主断基准书）' : ''}：《${b.title}》】\n流派画像：${b.aiProfile || '用户上传典籍'}\n命中原书页码摘录：\n` +
      topPages.map(({ c }) => `《${b.title}》第${c.pageNum}页：${(c.content || '').slice(0, 480)}`).join('\n');
  }).join('\n========\n');
}

function buildChartDigestForAI(rec) {
  if (rec.category === '六爻') {
    const d = rec.data;
    const mh = HEX_DATA.byKey[d.mainKey];
    const exam = runLiuyaoPhysicalExam(mh, new Set(d.moving || []), d.monthGz[1], d.dayGz[1], d.xunkong);
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0;
    const rowsStr = [5,4,3,2,1,0].map(i => {
      const r = exam.examRows[i];
      const ls = LIU_SHEN[(lsStart + i) % 6];
      const ysTag = d.lockedYongshenPos === r.pos ? '【用户指定用神】' : '';
      return `${r.pos}爻(${ls})：${r.bit?'阳':'阴'} ${r.liuqin}${r.branch}${r.wx}${r.isShi?'(世)':(r.isYing?'(应)':'')} ${r.isMov ? '动化' + (r.bian ? r.bian.liuqin+r.bian.branch+r.bian.wx : '') : '静'} ${ysTag} | 代码精确体检：[${r.tags.join('、')}]`;
    }).join('\n');
    return `门类：六爻\n问事：${rec.title}\n性别：${rec.gender}\n现实底色：${rec.status || '未指定'} | 外应：${(rec.omens||[]).join('、') || '无'}\n干支：${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（日空${d.xunkong}）\n主卦：${mh.name}（${mh.palaceName}） ${exam.bianHex ? '→ 变卦：' + exam.bianHex.name : '（静卦）'}\n三合局检测：${exam.sanheHits.join('、') || '无'}\n六爻体检明细（已由本地算法100%算死，请直接采用切勿重算出错）：\n${rowsStr}`;
  }
  if (rec.category === '八字') {
    const d = rec.data;
    return `门类：八字（${rec.gender}）\n四柱：${d.pillars.map(p => `${p.gz}(${p.shishen}，藏${p.hidden})`).join(' | ')}\n旬空：${d.xunkong}\n大运：${d.dayun.map(x => `${x.age}岁${x.gz}`).join('→')}`;
  }
  return `门类：${rec.category}\n事项：${rec.title}\n盘面数据：${JSON.stringify(rec.data)}`;
}

async function runSelectedBooksAnalysis() {
  if (!ensureApiKey()) return;
  const rec = state.currentResult;
  if (!rec) return;
  const btn = document.getElementById('runChartAiBtn');
  if (btn) { btn.disabled = true; btn.textContent = '参悟推演中...'; }

  const chosenBooks = state.books.filter(b => state.selectedBookIds.includes(b.id));
  const label = chosenBooks.length === 0
    ? '通用经典断'
    : (chosenBooks.length === 1 ? `《${chosenBooks[0].title}》` : `多书PK(${chosenBooks.length}本)`);

  const digest = buildChartDigestForAI(rec);
  const bookCtx = retrieveFromSelectedBooks(state.selectedBookIds, digest + ' ' + rec.title, rec.category);
  const mems = state.memories.filter(m => m.category === rec.category).slice(0, 10).map((m, i) => `${i+1}. ${m.text}`).join('\n');
  const todayStr = formatDateKey(new Date());

  const sysPrompt = `你是用户的私人术数智能体「参悟」。今天公历日期是 ${todayStr}。
必须严格遵守以下规矩：
1. 输出格式：先给一句干脆利落的核心定论，再用 1. 2. 3. 编号分条拆解，关键断语用【】高亮，绝对禁止使用任何星号符号。
2. 严守三层隔离：
   - 第一层【吉凶定性】：只依据最硬的动变生克、旺衰空破与所选参考书原则定成败，标注原书出处为《书名》第X页。
   - 第二层【细节象意】：结合六神、世应、飞伏、现实底色与外应拆解过程曲折与阻力。
   - 第三层【具体应期】：推算关键应期并换算成具体公历日期，严格用 [应期:YYYY-MM-DD] 格式写出（例如 [应期:2026-12-04]），方便用户一键插旗进日历。
3. 多书处理：${chosenBooks.length > 1 ? '用户同时选择了多本参考书，请以标注【主断基准书】的典籍定吉凶，并用其余典籍补充细节，最后单列一条【多书共识与分歧对照】！' : (chosenBooks.length === 1 ? `严格遵循《${chosenBooks[0].title}》的理法体系作答。` : '结合传统经典通用理法严谨作答。')}
${mems ? '\n【用户长期纠偏铁律（必须遵守）】\n' + mems : ''}`;

  const userPrompt = `请精准剖析以下盘面：\n${digest}\n\n${bookCtx ? '参考书库命中内容：\n' + bookCtx : ''}`;

  try {
    const content = await callLLM([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt }
    ]);
    // 自动抓取 AI 输出里的应期日期存入卷宗
    const yqMatches = Array.from(content.matchAll(/\[应期[:：](\d{4}-\d{2}-\d{2})\]/g)).map(m => m[1]);
    if (yqMatches.length) {
      rec.yingqiDates = Array.from(new Set([...(rec.yingqiDates || []), ...yqMatches]));
    }
    rec.reports.push({ id: uid('rep'), label, bookIds: [...state.selectedBookIds], content, createdAt: Date.now() });
    state.activeReportTab = rec.reports.length - 1;
    await saveCurrentResultToArchive();
    renderResultOverlay();
  } catch (e) {
    showToast('分析失败：' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ 按当前所选书追加一份对比分析'; }
  }
}

function followUpFromResult() {
  const rec = state.currentResult;
  if (!rec) return;
  closeOverlay('resultOverlay');
  switchMainTab('canwu');
  switchCanwuRoom(rec.category);
  const digest = buildChartDigestForAI(rec);
  document.getElementById('chatInput').value = `承接刚才的卷宗「${rec.title}」（${digest.slice(0, 180)}...），我想进一步追问：`;
  document.getElementById('chatInput').focus();
}

async function feedbackResultToBrain() {
  const rec = state.currentResult;
  if (!rec) return;
  const fix = prompt('请简述哪条断语与实际或原书有偏差，参悟将永久记入错题纠偏铁律：');
  if (!fix || !fix.trim()) return;
  await saveMemoryItem(rec.category, 'fix', '实战纠偏：' + fix.trim());
  showToast('已写入「' + rec.category + '」参悟大脑纠偏库！');
}

function reviewArchiveOutcome() {
  const rec = state.currentResult;
  if (!rec || !rec.outcome) return;
  closeOverlay('resultOverlay');
  switchMainTab('canwu');
  switchCanwuRoom(rec.category);
  document.getElementById('chatInput').value = `请帮我复盘已应验卷宗并提炼纠偏铁律：\n【事项】${rec.title}\n【当时盘面】${buildChartDigestForAI(rec).slice(0, 360)}\n【实际结果】${rec.outcome}\n请指出当初哪里看准、哪里看漏，并总结一句可存入长期记忆的铁律。`;
  sendCanwuMessage();
}

// ==================== 4. 参悟八大独立分舱聊天室 + 话题管理 + 三层记忆 ====================
function renderCanwuRoomStrip() {
  document.getElementById('canwuRoomStrip').innerHTML = CANWU_ROOMS.map(r =>
    `<button class="cat-pill ${r===state.canwuRoom?'active':''}" onclick="switchCanwuRoom('${r}')">${r}</button>`
  ).join('');
  document.getElementById('canwuHeaderSub').textContent = state.canwuRoom + '专属舱';
  document.getElementById('modeToggleBtn').textContent = state.canwuMode === 'answer' ? '解答' : '带练';
  document.getElementById('modeToggleBtn').className = 'chip ' + (state.canwuMode === 'practice' ? 'accent' : '');
}

function switchCanwuRoom(room) {
  state.canwuRoom = room;
  const roomThreads = state.chats.filter(t => t.room === room).sort((a,b) => (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  state.activeThreadId = roomThreads.length ? roomThreads[0].id : null;
  renderCanwuView();
}

function toggleCanwuMode() {
  state.canwuMode = state.canwuMode === 'answer' ? 'practice' : 'answer';
  renderCanwuRoomStrip();
  showToast(state.canwuMode === 'practice' ? '已切到带练模式：让我出题考你' : '已切回解答模式');
}

function getActiveThread() {
  if (!state.activeThreadId) return null;
  return state.chats.find(t => t.id === state.activeThreadId && t.room === state.canwuRoom) || null;
}

async function startNewChatThread() {
  const th = {
    id: uid('th'), room: state.canwuRoom, title: '新话题', starred: false,
    messages: [], createdAt: Date.now(), updatedAt: Date.now()
  };
  await dbPut('chats', th);
  state.chats.push(th);
  state.activeThreadId = th.id;
  renderCanwuView();
  showToast(`已在「${state.canwuRoom}」开启全新话题`);
}

function renderCanwuView() {
  renderCanwuRoomStrip();
  const box = document.getElementById('chatMessages');
  const th = getActiveThread();
  const msgs = th?.messages || [];
  if (!msgs.length) {
    box.innerHTML = `<div class="card" style="margin-top:8px;">
      <div class="card-head">
        <span class="card-title">「${state.canwuRoom}」独立参悟舱</span>
        <span class="chip">${getCultivationRank()}</span>
      </div>
      <div style="font-size:13.5px;color:var(--text-2);line-height:1.7;">
        本窗口与其他门类完全物理隔离，只调用你在「${state.canwuRoom}」上传的古籍与专属记忆铁律。普通闲聊按设定自动过期，标星干货永久留存。
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">
        <button class="chip" onclick="quickAskCanwu('梳理我当前门类书库里最核心的实战规律')">梳理书库核心</button>
        <button class="chip" onclick="quickAskCanwu('帮我对比不同古籍对同一规则的异同')">跨书理法对比</button>
        <button class="chip accent" onclick="state.canwuMode='practice';renderCanwuRoomStrip();quickAskCanwu('出一道实战题考考我，先藏起答案')">带练考考我</button>
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
        <button class="msg-act-btn" onclick="chatSaveNote(${i})">存苹果笔记</button>
      </div>` : ''}
    </div>
  `).join('');
}

function quickAskCanwu(txt) {
  document.getElementById('chatInput').value = txt;
  sendCanwuMessage();
}

function autoResizeInput(el) { el.style.height = '38px'; el.style.height = Math.min(108, el.scrollHeight) + 'px'; }

function scrollChatToBottom(force = false) {
  const box = document.getElementById('chatMessages');
  if (force) { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); }
  if (!state.userScrolledUp || force) box.scrollTop = box.scrollHeight;
}

async function sendCanwuMessage() {
  if (state.isStreaming || !ensureApiKey()) return;
  const inp = document.getElementById('chatInput');
  const q = inp.value.trim();
  if (!q) return;
  inp.value = ''; inp.style.height = '38px';

  let th = getActiveThread();
  if (!th) {
    th = { id: uid('th'), room: state.canwuRoom, title: q.slice(0, 16), starred: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    state.chats.push(th);
    state.activeThreadId = th.id;
  } else if (th.title === '新话题') {
    th.title = q.slice(0, 16);
  }

  th.messages.push({ role: 'user', content: q });
  const aiMsg = { role: 'ai', content: '参悟思索中...', streaming: true };
  th.messages.push(aiMsg);
  th.updatedAt = Date.now();
  state.isStreaming = true;
  state.userScrolledUp = false;
  renderCanwuView();
  scrollChatToBottom(true);

  const roomCat = CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category;
  const catBookIds = state.books.filter(b => b.category === roomCat).map(b => b.id);
  const bookCtx = retrieveFromSelectedBooks(catBookIds.slice(0, 4), q, roomCat);
  const mems = state.memories.filter(m => m.category === roomCat).slice(0, 12).map((m,i)=>`${i+1}. ${m.text}`).join('\n');

  const sysPrompt = `你是用户的专属术数智能体「参悟」，当前所在独立分舱：【${state.canwuRoom}】。
严守以下规则：
1. 先给核心结论，再严格用 1. 2. 3. 4. 编号分条展开，重点词用【】标注，严禁出现任何星号符号。
2. 明确区分【原书依据】（引用书库严格写成《书名》第X页）和【理法推演补充】，交代成立前提与例外反转。
3. 展示任何六爻卦象时，必须完整写出六爻阴阳排列、动静爻与旬空。
4. 当前模式：${state.canwuMode === 'practice' ? '【带练考我】先出题隐去结局，待用户作答后再严厉精准批改。' : '【解答模式】直击核心不绕弯。'}
${mems ? '\n【本门类长期记忆与纠偏铁律】\n' + mems : ''}
${bookCtx ? '\n【命中本门类书库内容】\n' + bookCtx : ''}`;

  const recent = th.messages.slice(-7, -1).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
  try {
    await callLLM([{ role: 'system', content: sysPrompt }, ...recent], {
      stream: true,
      onChunk: full => {
        aiMsg.content = full;
        const bubbles = document.querySelectorAll('#chatMessages .msg-row.ai .msg-bubble');
        const last = bubbles[bubbles.length - 1];
        if (last) last.innerHTML = formatRichText(full);
        scrollChatToBottom(false);
      }
    });
  } catch (e) {
    aiMsg.content = '请求中断：' + e.message;
  } finally {
    aiMsg.streaming = false;
    state.isStreaming = false;
    th.updatedAt = Date.now();
    await dbPut('chats', th);
    await markDirty();
    renderCanwuView();
    scrollChatToBottom(false);
  }
}

async function starCurrentThread() {
  const th = getActiveThread();
  if (!th) return;
  th.starred = !th.starred;
  await dbPut('chats', th);
  renderCanwuView();
  showToast(th.starred ? '已标星珍藏，清缓存绝不删除' : '已取消标星');
}

async function chatFeedback(idx, type) {
  if (type === 'fix') {
    const fix = prompt('请指出偏差或正确规律，存入本门类纠偏大脑：');
    if (!fix || !fix.trim()) return;
    await saveMemoryItem(CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category, 'fix', '实战纠偏：' + fix.trim());
    showToast('已写入参悟纠偏记忆');
  }
}

function chatSaveNote(idx) {
  const th = getActiveThread();
  const msg = th?.messages[idx];
  if (!msg) return;
  createAndOpenNote({ title: th.title || '参悟摘录', body: msg.content });
}

function openThreadDrawer() {
  document.getElementById('threadRoomName').textContent = state.canwuRoom;
  const list = state.chats.filter(t => t.room === state.canwuRoom).sort((a,b) => (b.starred?1:0)-(a.starred?1:0) || (b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
  document.getElementById('threadListBody').innerHTML = !list.length
    ? '<div class="empty-box" style="padding:20px;"><p>当前分舱暂无历史话题</p></div>'
    : list.map(t => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);gap:8px;">
        <div style="flex:1;min-width:0;cursor:pointer;" onclick="state.activeThreadId='${t.id}';closeSheet('sheet-threads');renderCanwuView()">
          <div style="font-size:14px;font-weight:600;color:${t.id===state.activeThreadId?'var(--accent)':'var(--text)'};">${t.starred?'★ ':''}${escapeHtml(t.title)}</div>
          <div style="font-size:11px;color:var(--text-3);">${formatDateKey(new Date(t.updatedAt||t.createdAt))} · ${t.messages.length}条消息</div>
        </div>
        <button class="chip" onclick="deleteThread('${t.id}')">删</button>
      </div>
    `).join('');
  openSheet('sheet-threads');
}
async function deleteThread(id) {
  await dbDel('chats', id);
  state.chats = state.chats.filter(t => t.id !== id);
  if (state.activeThreadId === id) state.activeThreadId = null;
  openThreadDrawer(); renderCanwuView();
}

function askCanwuFromReader() {
  const book = state.books.find(b => b.id === state.reader.bookId);
  const ch = state.chapters.find(c => c.bookId === state.reader.bookId && (c.pageNum === state.reader.pageNum || c.idx === state.reader.pageNum - 1));
  closeReader(); switchMainTab('canwu'); switchCanwuRoom(book?.category || state.category);
  document.getElementById('chatInput').value = `结合全书精讲《${book?.title||''}》第${state.reader.pageNum}页的核心断法与易错点：\n${(ch?.content||'').slice(0, 600)}`;
}

// 参悟大脑（三层记忆）
async function saveMemoryItem(category, tier, text) {
  const it = { id: uid('mem'), category, tier, text, createdAt: Date.now() };
  await dbPut('memories', it);
  state.memories.push(it);
  await markDirty();
}
function openBrainModal() {
  const cat = CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category;
  document.getElementById('brainCatTag').textContent = cat;
  renderBrainList(cat);
  openSheet('sheet-brain');
}
function renderBrainList(cat) {
  const c = cat || (CATEGORIES.includes(state.canwuRoom) ? state.canwuRoom : state.category);
  const list = state.memories.filter(m => m.category === c).sort((a,b) => b.createdAt - a.createdAt);
  document.getElementById('brainMemList').innerHTML = !list.length
    ? `<div class="empty-box" style="padding:18px;"><p>「${c}」暂无沉淀记忆，实战纠偏或手动存入后自动生效。</p></div>`
    : list.map(m => `<div style="display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <div><span class="chip ${m.tier==='fix'?'accent':''}" style="padding:1px 6px;font-size:10px;margin-right:4px;">${m.tier==='fix'?'纠偏':'心法'}</span>${escapeHtml(m.text)}</div>
      <button style="color:var(--text-3);font-size:12px;" onclick="deleteMemory('${m.id}')">删</button>
    </div>`).join('');
}
async function addManualMemory() {
  const inp = document.getElementById('newMemInput');
  const txt = inp.value.trim(); if (!txt) return;
  const cat = document.getElementById('brainCatTag').textContent;
  await saveMemoryItem(cat, 'core', txt);
  inp.value = ''; renderBrainList(cat); showToast('已存入参悟大脑');
}
async function deleteMemory(id) {
  await dbDel('memories', id);
  state.memories = state.memories.filter(m => m.id !== id);
  await markDirty(); renderBrainList();
}
async function runCrossBookSynthesis() {
  if (!ensureApiKey()) return;
  const cat = document.getElementById('brainCatTag').textContent;
  const catBooks = state.books.filter(b => b.category === cat);
  if (catBooks.length < 2) return showToast(`请在「${cat}」书架至少上传 2 本典籍`);
  showToast('正在跨书对比自悟...');
  try {
    const digest = catBooks.map(b => `《${b.title}》：${b.aiProfile || '已上传典籍'}`).join('\n');
    const res = await callLLM([{ role:'user', content:`对比以下多本「${cat}」典籍的流派特色，提炼 3 条最精炼的跨书融合断法心法（每条一行，严禁星号）：\n${digest}` }], { tier:'flash' });
    for (const ln of res.split('\n').map(s=>s.replace(/^[\d.\-、\s]+/,'').trim()).filter(s=>s.length>6).slice(0,3)) {
      await saveMemoryItem(cat, 'core', '跨书自悟：' + ln);
    }
    renderBrainList(cat); showToast('跨书自悟完成！');
  } catch (e) { showToast('失败：' + e.message); }
}
async function runMemoryDistill() {
  if (!ensureApiKey()) return;
  const cat = document.getElementById('brainCatTag').textContent;
  const list = state.memories.filter(m => m.category === cat);
  if (list.length < 4) return showToast('记忆条数还不多，暂无需蒸馏');
  showToast('正在蒸馏精简长期记忆...');
  try {
    const res = await callLLM([{ role:'user', content:`将以下「${cat}」记忆去重合并，蒸馏为 5 到 7 条最精纯的铁律（每条一行，严禁星号）：\n${list.map((m,i)=>`${i+1}. ${m.text}`).join('\n')}` }], { tier:'flash' });
    const lines = res.split('\n').map(s=>s.replace(/^[\d.\-、\s]+/,'').trim()).filter(s=>s.length>5);
    if (lines.length) {
      for (const old of list) await dbDel('memories', old.id);
      state.memories = state.memories.filter(m => m.category !== cat);
      for (const ln of lines) await saveMemoryItem(cat, 'core', ln);
      renderBrainList(cat); showToast('记忆已蒸馏精纯');
    }
  } catch (e) { showToast('蒸馏失败：' + e.message); }
}

// ==================== 5. 每日摇签（晃动竹筒）+ 解梦观外应（问机）+ 每日一机 ====================
let shakeListenerBound = false;
let currentDrawObj = null;

function openAskJi() {
  const today = formatDateKey(new Date());
  currentDrawObj = state.dailyDraws.find(d => d.dateKey === today) || null;
  renderAskJiBody();
  openOverlay('askJiOverlay');
  if (!shakeListenerBound && window.DeviceMotionEvent) {
    let lastT = 0;
    window.addEventListener('devicemotion', e => {
      if (!document.getElementById('askJiOverlay').classList.contains('open') || state.askJiTab !== 'draw') return;
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.abs(acc.x||0) + Math.abs(acc.y||0) + Math.abs(acc.z||0);
      if (mag > 28 && Date.now() - lastT > 1800) {
        lastT = Date.now();
        triggerBambooDraw();
      }
    });
    shakeListenerBound = true;
  }
}
function closeAskJi() { closeOverlay('askJiOverlay'); }
function switchAskJiTab(t) {
  state.askJiTab = t;
  document.getElementById('askJiSlider').style.transform = `translateX(${t === 'draw' ? 0 : 100}%)`;
  document.querySelectorAll('#askJiOverlay .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.aj === t));
  renderAskJiBody();
}

function renderAskJiBody() {
  const wrap = document.getElementById('askJiBody');
  if (state.askJiTab === 'draw') {
    const info = getAstroDayInfo(new Date());
    wrap.innerHTML = `
      <div class="card" style="text-align:center;">
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:10px;">
          ${[['zhouyi','周易六十四卦签'],['temple','古风灵签'],['word','一字测机']].map(([k,l])=>`<button class="chip ${state.drawStyle===k?'accent':''}" onclick="state.drawStyle='${k}';renderAskJiBody()">${l}</button>`).join('')}
        </div>
        ${state.drawStyle==='word' ? `<input type="text" id="drawOneWordInput" class="form-input" style="max-width:220px;margin:0 auto 10px;text-align:center;" placeholder="输入此刻心中浮现的一个字" />` : ''}
        <div class="tube-stage">
          <div class="bamboo-tube" id="bambooTubeEl" onclick="triggerBambooDraw()">灵签问机</div>
        </div>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日（空${info.xunkong}） · 摇晃手机或点击签筒求签</div>
        <button class="btn-primary" style="width:100%;" onclick="triggerBambooDraw()">${currentDrawObj ? '随性再摇一签' : '摇动签筒 · 抽今日一签'}</button>
      </div>
      ${currentDrawObj ? `
        <div class="card">
          <div class="card-head">
            <span class="card-title">${escapeHtml(currentDrawObj.title)}</span>
            <span class="chip accent">${escapeHtml(currentDrawObj.tone || '今日指引')}</span>
          </div>
          <div style="font-size:14px;line-height:1.75;color:var(--text);">${formatRichText(currentDrawObj.body)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">
            ${currentDrawObj.hexKey ? `<button class="chip accent" onclick="convertDrawToFullLiuyao()">展开专业六爻全盘 ›</button>` : ''}
            <button class="chip" onclick="checkInDailyDraw('今日应验/避坑了')">晚间打卡：准</button>
            <button class="chip" onclick="checkInDailyDraw('平淡无感')">打卡：一般</button>
          </div>
          ${currentDrawObj.checkIn ? `<div style="margin-top:8px;font-size:12px;color:var(--wx-wood);">✓ 已打卡：${escapeHtml(currentDrawObj.checkIn)}</div>` : ''}
        </div>
      ` : ''}
    `;
  } else {
    const info = getAstroDayInfo(new Date());
    wrap.innerHTML = `
      <div class="card">
        <div class="card-title" style="margin-bottom:6px;">解梦 · 观外应 · 奇遇问机</div>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">
          自动打上此刻时空：${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时（空${info.xunkong}）
        </div>
        <div class="form-field">
          <textarea id="dreamInputArea" class="form-textarea" placeholder="例如：昨晚梦见老家房子漏水；或者刚出门看见一颗流星从西北划过、手里的杯子突然碎了..."></textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary" onclick="startVoiceInput('dreamInputArea')">语音口述</button>
          <button class="btn-primary" style="flex:1;" id="dreamAskBtn" onclick="submitDreamOmen()">双视角拆解此兆</button>
        </div>
      </div>
      <div id="dreamResultBox"></div>
    `;
  }
}

async function triggerBambooDraw() {
  const tube = document.getElementById('bambooTubeEl');
  if (tube) tube.classList.add('shaking');
  if (navigator.vibrate) navigator.vibrate([40, 30, 50]);
  await new Promise(r => setTimeout(r, 680));
  if (tube) tube.classList.remove('shaking');

  const dt = new Date();
  const info = getAstroDayInfo(dt);
  const randHex = HEX_DATA.list[Math.floor(Math.random() * HEX_DATA.list.length)];
  const movPos = Math.floor(Math.random() * 6) + 1;
  const word = (document.getElementById('drawOneWordInput')?.value || '').trim();

  let title = '', tone = '顺势守中', body = '';
  if (state.drawStyle === 'temple') {
    const poems = [
      ['上上签 · 春风得意', '云开见月正清辉，旧事重逢喜自归。莫道前途多险阻，贵人扶助步云梯。', '借势推进'],
      ['中平签 · 藏锋守拙', '深潭静水且安身，莫听浮言乱本心。待到风清烟散后，自然花开满园春。', '沉心缓行'],
      ['中吉签 · 蓄势待发', '孤舟暂泊绿杨津，整顿帆樯待好风。急进不如先固本，时机一至自亨通。', '稳步蓄力'],
      ['警示签 · 戒急防偏', '路逢岔口莫轻狂，言出须防起波浪。退后一步看全局，避却暗礁保安康。', '谨言避坑']
    ];
    const p = poems[Math.floor(Math.random() * poems.length)];
    title = p[0]; tone = p[2];
    body = `【签诗】${p[1]}\n\n【今日气场与避坑】结合今日 ${info.day.gz}日（旬空${info.xunkong}），宜稳扎稳打、核清细节再拍板，忌情绪上头冲动决定。`;
  } else if (state.drawStyle === 'word' && word) {
    const h = HEX_DATA.list[word.charCodeAt(0) % 64];
    title = `一字测机：「${word[0]}」→ ${h.name}`;
    tone = h.palaceWx + '气主导';
    body = `【原典卦象】${h.name}（${h.palaceName} · 第${movPos}爻动）：${h.guaci}\n\n【今日指引】此字应${h.name}之象，遇事按此卦气机顺势而为。`;
  } else {
    title = `周易古签：${randHex.name}（第${movPos}爻动）`;
    tone = randHex.palaceWx + '象启示';
    body = `【今日卦象】${randHex.name}（${randHex.palaceName} · ${randHex.genName}）\n【原典锦囊】${randHex.guaci}\n【当日干支】${info.month.gz}月 ${info.day.gz}日（空${info.xunkong}）`;
  }

  if (state.settings.apiKey) {
    showToast('抽签成功！参悟正在为你撰写今日趋避锦囊...');
    try {
      const aiText = await callLLM([{
        role: 'user',
        content: `用户刚摇出「${title}」，今日干支为 ${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日（旬空${info.xunkong}）。请简明温暖接地气地输出 3 点（重点用【】标注，严禁星号）：\n1. 今日气场定调（四字总结+白话）\n2. 今日宜做与现实避坑提醒\n3. 一句易理锦囊`
      }], { tier: 'flash' });
      body = aiText;
    } catch (e) {}
  }

  currentDrawObj = {
    id: uid('drw'), dateKey: formatDateKey(dt), title, tone, body,
    hexKey: randHex.key, movPos, checkIn: '', createdAt: Date.now()
  };
  await dbPut('dailyDraws', currentDrawObj);
  state.dailyDraws = state.dailyDraws.filter(d => d.dateKey !== currentDrawObj.dateKey);
  state.dailyDraws.push(currentDrawObj);
  await markStudyFootprint();
  renderAskJiBody();
}

async function checkInDailyDraw(status) {
  if (!currentDrawObj) return;
  currentDrawObj.checkIn = status;
  await dbPut('dailyDraws', currentDrawObj);
  renderAskJiBody();
  showToast('已记入日历生活易经手账！');
}

function convertDrawToFullLiuyao() {
  if (!currentDrawObj?.hexKey) return;
  closeAskJi();
  const info = getAstroDayInfo(new Date());
  openLiuyaoResult({
    id: uid('arc'), category: '六爻', title: currentDrawObj.title,
    personName: '', gender: '男', group: '自己', createdAt: Date.now(),
    castTimeStr: new Date().toLocaleString(), lunarStr: info.lunarStr,
    status: '随性摇签转全盘', omens: [],
    data: {
      mainKey: currentDrawObj.hexKey, moving: [currentDrawObj.movPos || 1],
      yearGz: info.year.gz, monthGz: info.month.gz, dayGz: info.day.gz, hourGz: info.hour.gz,
      xunkong: info.xunkong, simMonthBranch: info.month.b, simDayBranch: info.day.b, lockedYongshenPos: null
    },
    reports: [], followUps: [], note: currentDrawObj.body, outcome: '', verdict: 'pending'
  });
}

async function submitDreamOmen() {
  if (!ensureApiKey()) return;
  const txt = (document.getElementById('dreamInputArea')?.value || '').trim();
  if (!txt) return showToast('请先输入梦境或奇遇外应');
  const btn = document.getElementById('dreamAskBtn');
  btn.disabled = true; btn.textContent = '参悟解析中...';
  const info = getAstroDayInfo(new Date());
  const box = document.getElementById('dreamResultBox');
  try {
    const res = await callLLM([{
      role: 'user',
      content: `用户在 ${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时（空${info.xunkong}）记录了以下梦境或奇遇外应：「${txt}」。\n请用 1. 2. 3. 清晰拆解（重点用【】标注，严禁星号，绝不装神弄鬼恐吓）：\n1. 【象数与外应视角】：结合梅花万物类象、方位五行与当下时辰生克解析此兆含义。\n2. 【现实与心理映射】：温和指出近期内心牵挂或现实提醒。\n3. 【今日趋避建议】：给出实在的行动建议。`
    }]);
    box.innerHTML = `<div class="card">
      <div class="card-head"><span class="card-title">参悟双视角解兆</span><button class="chip accent" onclick="castDreamToMeihua()">按此时空起专业卦 ›</button></div>
      <div style="font-size:14px;line-height:1.75;">${formatRichText(res)}</div>
    </div>`;
  } catch (e) {
    showToast('解析失败：' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '双视角拆解此兆';
  }
}

function castDreamToMeihua() {
  const txt = (document.getElementById('dreamInputArea')?.value || '').trim();
  closeAskJi();
  castState.mhMode = 'word';
  castState.mhWord = txt.slice(0, 6) || '外应';
  castState.mhQuestion = '解梦外应：' + txt.slice(0, 20);
  submitMeihuaCast();
}

function openDailyChallenge() {
  closeAskJi();
  switchMainTab('canwu');
  switchCanwuRoom(state.category);
  state.canwuMode = 'practice';
  renderCanwuView();
  quickAskCanwu('给我出一道【每日一机】1分钟经典实战小盲测题（隐去最终结局，让我快速判断用神和吉凶）。');
}

// ==================== 6. 思想星图（Canvas 可视化知识宇宙）与境界系统 ====================
function getCultivationRank() {
  const score = state.books.length * 10 + state.archives.length * 6 + state.memories.length * 8 + state.notes.length * 3 + Object.keys(state.footprints).length * 2;
  if (score >= 180) return '藏往境';
  if (score >= 100) return '明理境';
  if (score >= 50)  return '问机境';
  if (score >= 20)  return '观象境';
  return '初窥境';
}

function openMindMap() {
  document.getElementById('cultivationRankChip').textContent = getCultivationRank();
  openOverlay('mindMapOverlay');
  setTimeout(renderMindMapCanvas, 120);
}

function renderMindMapCanvas() {
  const canvas = document.getElementById('mindMapCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1.5, 2);
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const cx = W / 2, cy = H / 2;

  const nodes = [
    ...state.books.slice(0, 12).map((b, i) => ({ type:'典籍', label: b.title, color:'#E8B86D', cat: b.category, r: 7 })),
    ...state.memories.slice(0, 14).map((m, i) => ({ type:'铁律', label: m.text.slice(0, 16), color:'#E06A57', cat: m.category, r: 5.5 })),
    ...state.archives.slice(0, 14).map((a, i) => ({ type:'卷宗', label: a.title.slice(0, 14), color:'#6AB4E8', cat: a.category, r: 5 }))
  ];
  if (!nodes.length) {
    nodes.push({ type:'起点', label:'导入第一本典籍或存一卦，点亮你的思想星云', color:'#E8B86D', cat:'六爻', r: 8 });
  }
  nodes.forEach((n, i) => {
    const ang = (i / nodes.length) * Math.PI * 2 + (i % 3) * 0.4;
    const rad = Math.min(W, H) * (0.16 + ((i * 37) % 100) / 340);
    n.x = cx + Math.cos(ang) * rad;
    n.y = cy + Math.sin(ang) * rad;
  });

  ctx.fillStyle = '#0A0C12';
  ctx.fillRect(0, 0, W, H);
  // 背景微星
  for (let i = 0; i < 65; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.12 + (i % 5) * 0.08})`;
    ctx.fillRect((i * 97) % W, (i * 131) % H, 1.5, 1.5);
  }
  // 同门类引力连线
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].cat === nodes[j].cat) {
        ctx.strokeStyle = 'rgba(232,184,109,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
      }
    }
  }
  // 绘星点与文字
  nodes.forEach(n => {
    const g = ctx.createRadialGradient(n.x, n.y, 1, n.x, n.y, n.r * 3);
    g.addColorStop(0, n.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = n.color;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(238,241,248,0.85)';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.label.slice(0, 8), n.x + n.r + 4, n.y + 4);
  });

  canvas.onclick = e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = nodes.find(n => Math.hypot(n.x - x, n.y - y) < 22);
    if (hit) {
      document.getElementById('mindMapInfo').innerHTML = `<strong>[${hit.cat} · ${hit.type}]</strong> ${escapeHtml(hit.label)}`;
    }
  };
}

// ==================== 7. 语音闪电速记 ====================
function startVoiceInput(targetId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return showToast('当前浏览器暂不支持网页语音识别，可直接点键盘麦克风听写');
  const rec = new SR();
  rec.lang = 'zh-CN'; rec.interimResults = false;
  showToast('正在聆听，请说话...');
  rec.onresult = e => {
    const txt = e.results[0][0].transcript;
    const el = document.getElementById(targetId);
    if (el) { el.value += (el.value ? ' ' : '') + txt; el.dispatchEvent(new Event('input')); }
    showToast('语音已转为文字');
  };
  rec.onerror = () => showToast('未检测到清晰语音');
  rec.start();
}

// ==================== 8. 六十四卦 AI 深度解析 ====================
async function generateHexDeepAI(key) {
  if (!ensureApiKey()) return;
  const h = HEX_DATA.byKey[key];
  showToast('参悟正在深度解析此卦...');
  try {
    const text = await callLLM([{
      role: 'user',
      content: `请用 1. 2. 3. 4. 编号清单（重点用【】标注，严禁星号）深度精解「${h.name}」（${h.palaceName}·${h.genName}）：\n1. 核心气机与大白话象义\n2. 初爻至上爻关键演进\n3. 事业、求财、感情实战启示\n4. 断卦易错点与例外反转`
    }], { tier: 'flash' });
    await dbPut('hexCache', { id: key, text, updatedAt: Date.now() });
    await markDirty();
    renderHexDetail();
    showToast('已生成并永久缓存');
  } catch (e) { showToast('失败：' + e.message); }
}

// ==================== 9. 顶层导航胶水与启动初始化 ====================
function switchMainTab(tab) {
  state.mainTab = tab;
  document.querySelectorAll('.view-page').forEach(p => p.classList.toggle('active', p.id === 'view-' + tab));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderAllCurrentViews();
}

function renderCatStrip() {
  document.getElementById('catStrip').innerHTML = CATEGORIES.map(c =>
    `<button class="cat-pill ${c===state.category?'active':''}" onclick="switchCategory('${c}')">${c}</button>`
  ).join('');
  document.getElementById('brandSubText').textContent = state.category + '研习';
  document.getElementById('notesTabLabel').textContent = state.category + '笔记';
}

function switchCategory(cat) {
  state.category = cat;
  pulseAmbient();
  renderCatStrip();
  renderDivineView();
}

function switchSubTab(sub) {
  state.subTab = sub;
  const idx = ['cast', 'shelf', 'notes'].indexOf(sub);
  document.getElementById('subTabSlider').style.transform = `translateX(${idx * 100}%)`;
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
  if (state.mainTab === 'archives') renderArchivesView();
  if (state.mainTab === 'methods') renderMethodsView();
  if (state.mainTab === 'canwu') renderCanwuView();
}

async function loadAllFromDB() {
  const meta = await dbGet('meta', 'settings');
  if (meta && meta.data) Object.assign(state.settings, meta.data);
  state.books = await dbGetAll('books');
  state.chapters = await dbGetAll('chapters');
  state.notes = await dbGetAll('notes');
  state.archives = await dbGetAll('archives');
  state.chats = await dbGetAll('chats');
  state.memories = await dbGetAll('memories');
  state.dailyDraws = await dbGetAll('dailyDraws');
  const fps = await dbGetAll('footprints');
  state.footprints = Object.fromEntries(fps.map(f => [f.id, f.count]));
}

async function autoPruneExpiredChatsOnBoot() {
  const days = Number(state.settings.chatRetentionDays ?? 30);
  if (days === 0) return;
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

  // 对话防跳屏滚动锁
  const chatBox = document.getElementById('chatMessages');
  chatBox.addEventListener('scroll', () => {
    const dist = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
    if (dist > 64) { state.userScrolledUp = true; document.getElementById('scrollLatestBtn').classList.add('show'); }
    else { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); }
  });
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCanwuMessage(); }
  });

  renderCatStrip();
  renderDivineView();
  renderCanwuRoomStrip();

  // 若今日有断卦应期插旗，温柔提醒复盘
  const todayFlags = getYingqiFlagsMap()[formatDateKey(new Date())];
  if (todayFlags && todayFlags.length) {
    setTimeout(() => showToast(`🚩 今日是「${todayFlags[0]}」的应期观察日，记得去档案库复盘`), 1200);
  }
}

window.addEventListener('DOMContentLoaded', initApp);
