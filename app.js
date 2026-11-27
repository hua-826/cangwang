// ==================== 藏往 V10 · 多AI引擎、照片识图、事后反推、档案拖拽与全局串联 (app.js) ====================

// ==================== 1. 多 AI 模型引擎与照片识图 / OCR 兜底 ====================
const AI_PRESETS = {
  deepseek: { name: 'DeepSeek 主力', baseUrl: 'https://api.deepseek.com', flashModel: 'deepseek-chat', proModel: 'deepseek-reasoner' },
  qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', flashModel: 'qwen-plus', proModel: 'qwen-max' },
  zhipu: { name: '智谱清言', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', flashModel: 'glm-4-flash', proModel: 'glm-4-plus' },
  kimi: { name: 'Kimi (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', flashModel: 'moonshot-v1-8k', proModel: 'moonshot-v1-32k' },
  gemini_oai: { name: '中转/Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', flashModel: 'gemini-2.5-flash', proModel: 'gemini-2.5-pro' }
};
const VISION_PRESETS = {
  zhipu_v: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-flash' },
  qwen_v: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-plus' }
};

function getActiveAiProfile() {
  const s = state.settings;
  if (!Array.isArray(s.aiProfiles) || !s.aiProfiles.length) {
    s.aiProfiles = [{ id: 'p_ds', name: 'DeepSeek 主力', apiKey: s.apiKey || '', baseUrl: s.baseUrl || 'https://api.deepseek.com', flashModel: s.flashModel || 'deepseek-chat', proModel: s.proModel || 'deepseek-reasoner' }];
    s.activeProfileId = 'p_ds';
  }
  const prof = s.aiProfiles.find(p => p.id === s.activeProfileId) || s.aiProfiles[0];
  s.apiKey = prof.apiKey || s.apiKey || '';
  s.baseUrl = prof.baseUrl || 'https://api.deepseek.com';
  s.flashModel = prof.flashModel || 'deepseek-chat';
  s.proModel = prof.proModel || 'deepseek-reasoner';
  return prof;
}

function updateCanwuModelBadge() {
  const el = document.getElementById('canwuModelBadge'); if (!el) return;
  const prof = getActiveAiProfile();
  const tierLabel = state.settings.useTier === 'pro' ? '深度' : '极速';
  el.textContent = `${(prof.name || 'AI').slice(0, 8)}·${tierLabel}`;
}

function ensureApiKey() {
  const prof = getActiveAiProfile();
  if (!prof.apiKey) {
    showToast('请先在设置里填入你的 API Key（支持 DeepSeek / 千问 / 智谱等）');
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
  const s = state.settings, prof = getActiveAiProfile();
  const model = (tier || s.useTier) === 'pro' ? (prof.proModel || 'deepseek-reasoner') : (prof.flashModel || 'deepseek-chat');
  const base = (prof.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prof.apiKey}` },
    body: JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? redactPrivateText(m.content) : m.content })), stream, temperature: 0.38 })
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

function hasVisionConfig() {
  const s = state.settings, prof = getActiveAiProfile();
  if (s.visionModel && (s.visionApiKey || prof.apiKey)) return true;
  const activeM = (prof.flashModel || '').toLowerCase();
  if (/vl|4v|vision|gpt-4o|gemini|claude/.test(activeM) && prof.apiKey) return true;
  return false;
}

async function callVisionLLM(dataUrl, userPrompt, sysPrompt = '') {
  const s = state.settings, prof = getActiveAiProfile();
  const useCustom = Boolean(s.visionModel && (s.visionApiKey || prof.apiKey));
  const vKey = useCustom ? (s.visionApiKey || prof.apiKey) : prof.apiKey;
  const vBase = (useCustom ? (s.visionBaseUrl || prof.baseUrl) : prof.baseUrl || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
  const vModel = useCustom ? s.visionModel : prof.flashModel;
  const endpoint = vBase.endsWith('/chat/completions') ? vBase : `${vBase}/chat/completions`;
  const msgs = [];
  if (sysPrompt) msgs.push({ role: 'system', content: sysPrompt });
  msgs.push({
    role: 'user',
    content: [
      { type: 'text', text: redactPrivateText(userPrompt || '请详细看懂这张图片并给出专业术数分析。') },
      { type: 'image_url', image_url: { url: dataUrl } }
    ]
  });
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vKey}` },
    body: JSON.stringify({ model: vModel, messages: msgs, temperature: 0.35 })
  });
  if (!resp.ok) throw new Error(`识图接口失败(${resp.status})`);
  const d = await resp.json();
  if (d.usage) { s.tokensIn += d.usage.prompt_tokens || 0; s.tokensOut += d.usage.completion_tokens || 0; saveSettingsMeta(); }
  return d.choices?.[0]?.message?.content || '';
}

function loadTesseractJs() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = res; s.onerror = () => rej(new Error('本地识字组件加载失败，建议在设置里填一个免费识图模型（如智谱 glm-4v-flash）'));
    document.head.appendChild(s);
  });
}

async function extractTextFromImage(dataUrl, customPrompt = '') {
  if (hasVisionConfig()) {
    return (await callVisionLLM(dataUrl, customPrompt || '请准确提取图片中的全部文字与排盘信息，保持原有结构，不要添加多余废话。')).replace(/\*/g, '').trim();
  }
  showToast('未配识图模型，正启用本地中文 OCR 识字兜底（首次稍慢）...');
  await loadTesseractJs();
  const res = await window.Tesseract.recognize(dataUrl, 'chi_sim+chi_tra');
  return (res?.data?.text || '').replace(/\s+/g, ' ').trim();
}

// 聊天图片压缩与预览
function handleChatImageSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 960, scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      state.pendingChatImg = c.toDataURL('image/jpeg', 0.8);
      document.getElementById('chatImgPreviewEl').src = state.pendingChatImg;
      document.getElementById('chatImgPreviewBar').classList.add('show');
      document.getElementById('chatImgModeHint').textContent = hasVisionConfig()
        ? '已附照片 · 将直接调用视觉模型看图分析'
        : '已附照片 · 未配视觉模型，将自动本地识字后交主力 AI 分析';
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
function clearPendingChatImage() {
  state.pendingChatImg = null;
  document.getElementById('chatImgPreviewBar')?.classList.remove('show');
  const el = document.getElementById('chatImgPreviewEl'); if (el) el.src = '';
}

// ==================== 2. 文本渲染、检索与盘面摘要（含完整六爻/八字细盘） ====================
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
  showToast(`已将 ${dStr} 标记到万年干支历`);
}

function retrieveFromSelectedBooks(bookIds, qText) {
  const tbs = state.books.filter(b => bookIds.includes(b.id)); if (!tbs.length) return '';
  const tokens = (qText.match(/[\u4e00-\u9fa5]{2,4}/g) || []).slice(0, 16);
  return tbs.map(b => {
    const pages = state.chapters.filter(c => c.bookId === b.id && c.content && c.content.length > 20)
      .map(c => ({ c, s: tokens.reduce((acc, tk) => acc + ((c.content || '').includes(tk) ? 2 : 0), 0) }))
      .sort((a, b2) => b2.s - a.s).slice(0, 2);
    return `【书房原书：《${b.title}》】\n` + pages.map(({ c }) => `《${b.title}》第${c.pageNum}页：${(c.content || '').slice(0, 520)}`).join('\n');
  }).join('\n========\n');
}

function buildChartDigestForAI(rec) {
  if (rec.category === '六爻') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey];
    const exam = runLiuyaoPhysicalExam(mh, new Set(d.moving || []), d.monthGz[1], d.dayGz[1], d.xunkong);
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0;
    const rows = [5,4,3,2,1,0].map(i => {
      const r = exam.examRows[i];
      const yinYangSym = r.bit ? '▅▅▅▅▅' : '▅▅  ▅▅';
      const movStr = r.isMov ? (r.bit ? ' ○ 变 ' : ' × 变 ') + (r.bian ? `${r.bian.liuqin}${r.bian.branch}${r.bian.wx}` : '') : ' (静)';
      const tagsAll = [...r.tags, ...(r.relTags || [])].join('、');
      return `${POS_CN[r.pos]} ${LIU_SHEN[(lsStart+i)%6]} ${r.fushen ? '[伏'+r.fushen.label+'] ' : ''}${yinYangSym} ${r.liuqin}${r.branch}${r.wx}${r.isShi?'[世]':(r.isYing?'[应]':'')}${r.isKong?'[空]':''}${d.lockedYongshenPos===r.pos?'[指定用神]':''}${movStr} | 状态：${tagsAll}`;
    }).join('\n');
    return `【六爻排盘】\n求测问题：${rec.question || rec.title}（${rec.dir || '一事一问'} · ${rec.gender}）\n起卦时间：${rec.castTimeStr || ''} | 农历：${rec.lunarFull || rec.lunarStr || ''}\n背景处境：${rec.contextText || '未填'}\n四柱干支：${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（旬空：${d.xunkong}）\n主卦：${mh.name}（${mh.palaceName}）${exam.bianHex ? ' → 变卦：' + exam.bianHex.name + '（' + exam.bianHex.palaceName + '）' : '（静卦无变）'}\n三合局：${exam.sanheHits.join('、') || '无'}\n完整六爻：\n${rows}`;
  }
  if (rec.category === '八字') {
    const d = rec.data, ps = d.pillars;
    const pTxt = ps.map((p, i) => `${['年柱','月柱','日柱','时柱'][i]}：${p.gz}（${p.shishen}｜藏:${(p.hiddenList||[]).map(h=>h.s+h.tg).join(' ')}｜星运:${p.xingyun||''}｜纳音:${p.nayin||''}｜空:${p.kongwang||''}）`).join('\n');
    const dy = (d.dayun || [])[state.bzSelDyIdx || 0], ln = dy?.liunian?.[state.bzSelLnIdx || 0];
    return `【八字命盘】\n命主：${rec.title}（${rec.gender==='男'?'乾造':'坤造'}）\n公历：${rec.castTimeStr} | 农历：${rec.lunarFull || ''}\n人元司令：${d.renYuan || ''} | 节气：${d.jieqiDesc || ''}\n胎元：${d.taiYuan || ''} | 命宫：${d.mingGong || ''} | 身宫：${d.shenGong || ''}\n四柱明细：\n${pTxt}\n原局天干：${(d.origInter?.stems||[]).join('、')||'平和'}\n原局地支：${(d.origInter?.branches||[]).join('、')||'平和'}\n当前选中岁运：${dy ? dy.gz+'大运('+dy.age+'岁起)' : ''} / ${ln ? ln.year+' '+ln.gz+'流年' : ''}\n穷通宝鉴参考：${d.qiongtong || ''}`;
  }
  return `【${rec.category}排盘】\n事项：${rec.title}\n时间：${rec.castTimeStr || ''} ${rec.lunarFull || ''}\n排盘硬数据：${JSON.stringify(rec.data)}`;
}

function getWeakSpotsPrompt() {
  const ws = (state.settings.weakSpots || []).slice(-6);
  if (!ws.length) return '';
  return `\n【用户历史练习薄弱点】：${ws.map(w => w.tag).join('、')}。如果本次盘面或问题恰好踩中其中某一点，请在开头先提醒他留意这个老盲区。`;
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
  const selfBlock = (state.showSelfJudge && state.selfReason.trim()) ? `\n【用户盲断自判】：用户判「${state.selfVerdict}」，理由：「${state.selfReason.trim()}」。请务必在回复最前面单列【思路对照】，客观肯定他看准的地方，并直接指出他看漏或断反的关键理法！` : '';

  const sys = `你是用户的私人术数实战教练「参悟」，今日公历 ${formatDateKey(new Date())}。
铁律：
1. 严禁说「总体有波折保持心态就会好」这种两头堵的算命废话，严禁无脑吹捧，全程说人话、讲硬证据。
2. 所有旺衰、月破、暗动、旬空、冲合刑穿、化进退神已由底层代码算死，严禁自行篡改。
3. 先给核心定论，再分三层清晰展开：【第一层·吉凶定性】（引用参考书须标《书名》第X页）、【第二层·细节象意】（结合现实处境与六神/十神/神煞）、【第三层·具体应期】（换算公历并用 [应期:YYYY-MM-DD] 标注）。
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

// 事后「AI 反推复盘」（错一卦长一寸）
async function runOutcomeRetrospective() {
  if (!ensureApiKey()) return;
  const rec = state.currentResult; if (!rec) return;
  if (!(rec.outcome || '').trim()) return showToast('请先在上方填写「真实应验结果」，再点反推');
  const btn = document.getElementById('retroAiBtn'); if (btn) { btn.disabled = true; btn.textContent = 'AI 反推复盘中...'; }
  const digest = buildChartDigestForAI(rec);
  try {
    const prompt = `你是一位严厉且实事求是的术数复盘教练。下面这份排盘已经出了真实结果，请你拿着既成事实倒推原盘（严禁马后炮瞎圆、严禁星号）：
${digest}

【当时个人思路】：${rec.note || '未填'}
【当时 AI 剖析】：${(rec.reports?.[0]?.content || '无').slice(0, 500)}
【真实应验结果】：${rec.outcome}（判定：${rec.verdict === 'hit' ? '已应验' : (rec.verdict === 'miss' ? '有偏差' : '待定')}）

请输出三部分：
【一、事后倒推真因】：对照真实结果，盘面里真正起决定作用的那个关键信号是哪一爻/哪一柱？
【二、当时漏看/误判点】：直截了当指出当时思维里的盲区。
【三、提炼成一条实战铁律】：用 25 字以内总结一条下次绝不再犯的经验（前面加上 ###教训### 标记）。`;
    const raw = (await callLLM([{ role: 'user', content: prompt }])).replace(/\*/g, '').trim();
    const [mainText, lessonPart] = raw.split('###教训###');
    const cleanReport = (mainText || raw).trim() + (lessonPart ? `\n\n【已自动记入备忘的铁律】${lessonPart.trim()}` : '');
    rec.reports.push({ id: uid('rep'), label: '事后反推', content: cleanReport, createdAt: Date.now() });
    state.activeReportTab = rec.reports.length - 1;
    if (lessonPart && lessonPart.trim()) {
      await saveMemoryItem(rec.category, 'retro', `【反推教训】${lessonPart.trim().slice(0, 80)}`);
    }
    await saveCurrentResultToArchive();
    renderResultOverlay();
    showToast('事后反推完成，实战教训已自动写入 AI 备忘');
  } catch (e) { showToast('反推失败：' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'AI 事后反推（错一卦长一寸）'; } }
}

function followUpFromResult() { const r = state.currentResult; if (!r) return; closeOverlay('resultOverlay'); switchMainTab('canwu'); switchCanwuRoom(r.category); document.getElementById('chatInput').value = `承接刚排的「${r.title}」，我想继续追问：`; }
async function feedbackResultToBrain() { const r = state.currentResult; if (!r) return; const fix = prompt('写下这次发现的规律或纠偏，存入 AI 备忘：'); if (!fix?.trim()) return; await saveMemoryItem(r.category, 'fix', fix.trim()); showToast('已记入 AI 备忘'); }

// ==================== 3. 参悟问答页（支持发照片看盘 + 多模型 + 大白话） ====================
function renderCanwuRoomStrip() {
  const el = document.getElementById('canwuRoomStrip'); if (!el) return;
  el.innerHTML = buildDisciplineStripHtml(state.canwuRoom, 'switchCanwuRoom');
  bindCatSwipe(el);
  updateCanwuModelBadge();
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
    const bookCount = state.books.filter(b => b.category === state.canwuRoom || b.category === '其他').length;
    box.innerHTML = `
      <div class="card" style="margin-top:6px;">
        <div class="card-head">
          <span class="card-title">${state.canwuRoom} · 私人术数教练</span>
          <span class="pill-mini xs accent">书房已备 ${bookCount} 本</span>
        </div>
        <div style="font-size:14px;color:var(--text-2);line-height:1.72;">说人话、讲原书证据、敢直接指出你的错漏。点左下角相册图标可直接发排盘截图、古书书页或户型图让我分析。</div>
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
      <div class="msg-bubble">
        ${m.imageData ? `<img class="msg-img-thumb" src="${m.imageData}" alt="上传图片" />` : ''}
        ${m.role === 'ai' ? formatRichText(m.content) : escapeHtml(m.content).replace(/\n/g, '<br/>')}
      </div>
      ${m.role === 'ai' && !m.streaming ? `<div class="msg-actions"><button class="msg-act-btn" onclick="starCurrentThread()">${th.starred ? '★ 已收藏' : '☆ 收藏对话'}</button><button class="msg-act-btn" onclick="chatFeedback()">记进 AI 备忘</button><button class="msg-act-btn" onclick="chatSaveNote(${i})">存为笔记</button></div>` : ''}
    </div>
  `).join('');
}
function quickAskCanwu(t) { document.getElementById('chatInput').value = t; sendCanwuMessage(); }
function autoResizeInput(el) { el.style.height = '42px'; el.style.height = Math.min(112, el.scrollHeight) + 'px'; }
function scrollChatToBottom(force = false) { const box = document.getElementById('chatMessages'); if (force) { state.userScrolledUp = false; document.getElementById('scrollLatestBtn').classList.remove('show'); } if (!state.userScrolledUp || force) box.scrollTop = box.scrollHeight; }

async function sendCanwuMessage() {
  if (state.isStreaming || !ensureApiKey()) return;
  const inp = document.getElementById('chatInput'), qRaw = inp.value.trim(), imgData = state.pendingChatImg;
  if (!qRaw && !imgData) return;
  const q = qRaw || '请帮我看看这张图片里的盘面/内容，用大白话拆解关键点。';
  inp.value = ''; inp.style.height = '42px';
  clearPendingChatImage();

  let th = getActiveThread();
  if (!th) { th = { id: uid('th'), room: state.canwuRoom, title: q.slice(0, 16), starred: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; state.chats.push(th); state.activeThreadId = th.id; }
  else if (th.title === '新对话') th.title = q.slice(0, 16);

  th.messages.push({ role: 'user', content: q, imageData: imgData || '' });
  const aiMsg = { role: 'ai', content: imgData ? '正在识图并翻书推演...' : '正在思索翻书...', streaming: true };
  th.messages.push(aiMsg); th.updatedAt = Date.now();
  state.isStreaming = true; state.userScrolledUp = false; renderCanwuView(); scrollChatToBottom(true);

  const bookCtx = retrieveFromSelectedBooks(state.books.filter(b => b.category === state.canwuRoom || b.category === '其他').map(b => b.id).slice(0, 4), q);
  const mems = state.memories.filter(m => m.category === state.canwuRoom).slice(0, 12).map((m, i) => `${i + 1}. ${m.text}`).join('\n');
  const sys = `你是用户的私人术数教练「参悟」，当前门类：【${state.canwuRoom}】。
1. 直接给结论，再用 1. 2. 3. 编号讲人话，重点词用【】标注，严禁使用星号符号。
2. 严禁吹捧迎合和模棱两可的套话；如果用户理法理解错了，温和但直接指出错在哪里。
3. 只要展示六爻卦象，必须完整写出六爻阴阳、动静爻与旬空。
4. 优先引用下方书房原书并标明《书名》第X页，绝不拿地摊玄学瞎编。${mems ? '\n【用户个人备忘】\n' + mems : ''}${getWeakSpotsPrompt()}${bookCtx ? '\n【书房原书摘录】\n' + bookCtx : ''}`;

  try {
    if (imgData) {
      if (hasVisionConfig()) {
        const visOut = await callVisionLLM(imgData, q, sys);
        aiMsg.content = visOut.replace(/\*/g, '').trim();
      } else {
        const ocrTxt = await extractTextFromImage(imgData);
        const combinedQ = `${q}\n\n【从用户上传照片中识别出的文字】：\n${ocrTxt || '(图片较模糊，未能抠出清晰文字，请提示用户在设置里配置一个免费的视觉识图模型如智谱 glm-4v-flash)'}`;
        const out = await callLLM([{ role: 'system', content: sys }, { role: 'user', content: combinedQ }]);
        aiMsg.content = out.replace(/\*/g, '').trim();
      }
    } else {
      await callLLM([{ role: 'system', content: sys }, ...th.messages.slice(-7, -1).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))], {
        stream: true,
        onChunk: full => {
          aiMsg.content = full;
          const bs = document.querySelectorAll('#chatMessages .msg-row.ai .msg-bubble');
          if (bs.length) bs[bs.length - 1].innerHTML = formatRichText(full);
          scrollChatToBottom(false);
        }
      });
    }
  } catch (e) { aiMsg.content = '请求中断：' + e.message; }
  finally { aiMsg.streaming = false; state.isStreaming = false; th.updatedAt = Date.now(); await dbPut('chats', th); await markDirty(); renderCanwuView(); scrollChatToBottom(false); }
}

async function starCurrentThread() { const th = getActiveThread(); if (!th) return; th.starred = !th.starred; await dbPut('chats', th); renderCanwuView(); }
async function chatFeedback() { const fix = prompt('写一条想让 AI 长期记住的习惯或纠偏：'); if (!fix?.trim()) return; await saveMemoryItem(state.canwuRoom, 'fix', fix.trim()); showToast('已记入 AI 备忘'); }
function chatSaveNote(idx) { const th = getActiveThread(), m = th?.messages[idx]; if (m) createAndOpenNote({ title: th.title || '参悟摘录', body: m.content }); }
function openThreadDrawer() {
  document.getElementById('threadRoomName').textContent = state.canwuRoom;
  const list = state.chats.filter(t => t.room === state.canwuRoom).sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  document.getElementById('threadListBody').innerHTML = !list.length ? '<div class="empty-box" style="padding:20px;"><p>暂无历史记录</p></div>' : list.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);gap:8px;"><div style="flex:1;min-width:0;cursor:pointer;" onclick="state.activeThreadId='${t.id}';closeSheet('sheet-threads');renderCanwuView()"><div style="font-size:15px;font-weight:600;color:${t.id===state.activeThreadId?'var(--accent)':'var(--text)'};">${t.starred?'★ ':''}${escapeHtml(t.title)}</div><div style="font-size:12px;color:var(--text-3);">${formatDateKey(new Date(t.updatedAt||t.createdAt))} · ${t.messages.length}条</div></div><button class="pill-mini xs" onclick="deleteThread('${t.id}')">删</button></div>`).join('');
  openSheet('sheet-threads');
}
async function deleteThread(id) { await dbDel('chats', id); state.chats = state.chats.filter(t => t.id !== id); if (state.activeThreadId === id) state.activeThreadId = null; openThreadDrawer(); renderCanwuView(); }
function askCanwuFromReader() {
  const b = state.books.find(x => x.id === state.reader.bookId), ch = getReaderChapter(state.reader.bookId, state.reader.pageNum);
  closeReader(); switchMainTab('canwu'); switchCanwuRoom(b?.category || state.category);
  document.getElementById('chatInput').value = `用大白话精讲《${b?.title || ''}》第${state.reader.pageNum}页的核心断法：\n${(ch?.content || '').slice(0, 600)}`;
}

// ==================== 4. AI 备忘与自动薄弱点 ====================
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

// ==================== 5. 笔记、档案库（搜索+特征反查+待回访+长按拖拽分组） ====================
let noteSaveTimer = null;
function renderNotesPanel(wrap) {
  const q = state.noteSearch.trim().toLowerCase(), list = state.notes.filter(n => n.category === state.category && (!q || (n.title + n.body).toLowerCase().includes(q))).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  wrap.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:14px;"><input type="text" class="form-input" placeholder="搜索「${state.category}笔记」..." value="${escapeHtml(state.noteSearch)}" oninput="state.noteSearch=this.value;renderDivineView()" /><button class="btn-primary" style="padding:9px 16px;flex-shrink:0;" onclick="createAndOpenNote()">+ 新建</button></div>${!list.length ? `<div class="empty-box"><p>记录读经心得与断卦灵感</p><button class="btn-secondary" onclick="createAndOpenNote()">写第一篇${state.category}笔记</button></div>` : list.map(n => `<div class="card" style="cursor:pointer;padding:15px 17px;" onclick="openNoteEditor('${n.id}')"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><strong style="font-size:16px;">${n.pinned ? '置顶 · ' : ''}${escapeHtml(n.title || '无标题笔记')}</strong><span style="font-size:12px;color:var(--text-3);">${formatDateKey(new Date(n.updatedAt || n.createdAt))}</span></div><div class="priv-blur" style="font-size:14px;color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55;">${escapeHtml((n.body || '').replace(/\n/g, ' ')) || '轻点开始编辑...'}</div></div>`).join('')}`;
}
async function createAndOpenNote(preset = {}) { const n = { id: uid('nt'), category: state.category, pinned: false, title: preset.title || '', body: preset.body || '', createdAt: Date.now(), updatedAt: Date.now() }; await dbPut('notes', n); state.notes.push(n); await markDirty(); openNoteEditor(n.id); }
function openNoteEditor(id) { const n = state.notes.find(x => x.id === id); if (!n) return; state.editingNoteId = id; document.getElementById('noteEditorMeta').textContent = n.category + '笔记 · 自动保存'; document.getElementById('notePinBtn').className = 'pill-mini xs ' + (n.pinned ? 'accent' : ''); document.getElementById('noteTitleField').value = n.title || ''; document.getElementById('noteBodyArea').value = n.body || ''; document.getElementById('noteFolderSelect').innerHTML = CATEGORIES.map(c => `<option ${c === n.category ? 'selected' : ''}>${c}</option>`).join(''); openOverlay('noteEditorOverlay'); }
function scheduleNoteAutoSave() { clearTimeout(noteSaveTimer); noteSaveTimer = setTimeout(saveCurrentNoteNow, 350); }
async function saveCurrentNoteNow() { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.title = document.getElementById('noteTitleField').value.trim(); n.body = document.getElementById('noteBodyArea').value; n.updatedAt = Date.now(); await dbPut('notes', n); await markDirty(); }
async function closeNoteEditor() { await saveCurrentNoteNow(); closeOverlay('noteEditorOverlay'); if (state.mainTab === 'divine') renderDivineView(); }
async function toggleCurrentNotePin() { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.pinned = !n.pinned; await dbPut('notes', n); document.getElementById('notePinBtn').className = 'pill-mini xs ' + (n.pinned ? 'accent' : ''); }
async function changeCurrentNoteFolder(cat) { const n = state.notes.find(x => x.id === state.editingNoteId); if (!n) return; n.category = cat; await dbPut('notes', n); showToast('已移至「' + cat + '」'); }
async function deleteCurrentNote() { if (!confirm('删除这篇笔记？')) return; await dbDel('notes', state.editingNoteId); state.notes = state.notes.filter(x => x.id !== state.editingNoteId); await markDirty(); closeOverlay('noteEditorOverlay'); renderDivineView(); }
function noteInsertChecklist() { const ta = document.getElementById('noteBodyArea'); ta.value += (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + '☐ '; scheduleNoteAutoSave(); }
function noteInsertGanZhi() { const i = getAstroDayInfo(new Date()), ta = document.getElementById('noteBodyArea'); ta.value += `\n【${formatDateKey(new Date())} ${i.year.gz}年 ${i.month.gz}月 ${i.day.gz}日 ${i.hour.gz}时 空${i.xunkong}】\n`; scheduleNoteAutoSave(); }

function isArchiveNeedFollowup(a) {
  if (a.verdict !== 'pending') return false;
  const now = Date.now(), todayStr = formatDateKey(new Date());
  if ((a.yingqiDates || []).some(dt => dt <= todayStr)) return true;
  return (now - (a.createdAt || now)) >= 7 * 86400000;
}
function updateFollowupBadge() {
  const cnt = state.archives.filter(isArchiveNeedFollowup).length;
  const el = document.getElementById('archFollowBadge');
  if (el) { el.style.display = cnt ? 'inline' : 'none'; el.textContent = cnt ? `·${cnt}` : ''; }
}
function getArchiveSearchBlob(a) {
  let blob = `${a.title || ''} ${a.question || ''} ${a.personName || ''} ${a.note || ''} ${a.outcome || ''} ${a.group || ''}`;
  if (a.category === '六爻' && a.data?.mainKey) {
    try {
      const mh = HEX_DATA.byKey[a.data.mainKey];
      const ex = runLiuyaoPhysicalExam(mh, new Set(a.data.moving || []), a.data.monthGz[1], a.data.dayGz[1], a.data.xunkong || '');
      blob += ` ${mh?.name || ''} ${ex.bianHex?.name || ''} ${ex.sanheHits.join(' ')} ` + ex.examRows.map(r => r.tags.join(' ') + ' ' + (r.relTags || []).join(' ')).join(' ');
    } catch (e) {}
  } else if (a.category === '八字' && a.data?.origInter) {
    blob += ` ${(a.data.origInter.stems || []).join(' ')} ${(a.data.origInter.branches || []).join(' ')}`;
  }
  return blob.toLowerCase();
}

function openArchivesOverlay() { state.archCategory = state.category; state.archSearch = ''; const inp = document.getElementById('archSearchInput'); if (inp) inp.value = ''; renderArchivesView(); openOverlay('archivesOverlay'); }
function renderArchivesView() {
  const pendingFollow = state.archives.filter(isArchiveNeedFollowup).length;
  document.getElementById('archHeaderSub').textContent = state.archCategory + '档案库' + (pendingFollow ? ` (待回访${pendingFollow})` : '');
  document.getElementById('baziCompareBtn').style.display = state.archCategory === '八字' ? 'inline-flex' : 'none';
  document.getElementById('archCatStrip').innerHTML = CATEGORIES.map(c => `<button class="cat-pill ${c === state.archCategory ? 'active' : ''}" onclick="state.archCategory='${c}';state.archGroup='全部';renderArchivesView()">${c}</button>`).join('');
  document.getElementById('archGroupStrip').innerHTML = ['全部', '待回访', '默认', ...(state.settings.groups || [])].map(g => `<button class="chip ${g === state.archGroup ? 'accent' : ''}" onclick="state.archGroup='${escapeHtml(g)}';renderArchivesView()">${escapeHtml(g)}</button>`).join('');
  const kw = (state.archSearch || '').trim().toLowerCase();
  const catList = state.archives.filter(a => a.category === state.archCategory).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  const filtered = catList.filter(a => {
    if (state.archGroup === '待回访' && !isArchiveNeedFollowup(a)) return false;
    else if (state.archGroup !== '全部' && state.archGroup !== '待回访' && (a.group || '默认') !== state.archGroup) return false;
    if (kw && !getArchiveSearchBlob(a).includes(kw)) return false;
    return true;
  });
  document.getElementById('archivesScrollArea').innerHTML = !filtered.length
    ? `<div class="empty-box"><p>「${state.archCategory} · ${state.archGroup}」未找到匹配档案</p></div>`
    : filtered.map(a => {
      const needFb = isArchiveNeedFollowup(a);
      return `<div class="card" style="cursor:pointer;" onclick="openSavedArchive('${a.id}')">
        <div class="card-head" style="margin-bottom:6px;">
          <div class="card-title priv-blur">${escapeHtml(a.title)}</div>
          <span class="pill-mini xs ${needFb?'seal':(a.verdict==='hit'?'accent':'')}">${needFb?'待回访':(a.verdict==='hit'?'已应验':(a.verdict==='miss'?'有偏差':'待验证'))}</span>
        </div>
        <div style="font-size:12.5px;color:var(--text-3);display:flex;justify-content:space-between;">
          <span>${escapeHtml(a.castTimeStr || '')} · ${escapeHtml(a.group || '默认')}</span>
          <span>${a.reports?.length ? a.reports.length + '份剖析' : ''}</span>
        </div>
        ${a.outcome ? `<div class="priv-blur" style="font-size:13.5px;color:var(--accent);margin-top:6px;">应验：${escapeHtml(a.outcome)}</div>` : ''}
        <div style="display:flex;justify-content:flex-end;margin-top:8px;"><button style="font-size:12.5px;color:var(--text-3);" onclick="event.stopPropagation();deleteArchive('${a.id}')">删除</button></div>
      </div>`;
    }).join('');
}
function openSavedArchive(id) { const a = state.archives.find(x => x.id === id); if (!a) return; if (a.category === '六爻') openLiuyaoResult(a, true); else openGenericResult(a, true); }
async function deleteArchive(id) { if (!confirm('删除这份档案？')) return; await dbDel('archives', id); state.archives = state.archives.filter(a => a.id !== id); await markDirty(); updateFollowupBadge(); renderArchivesView(); }

// 档案分组：支持手机端长按/拖动上下交换顺序
function openGroupEditor() { renderGroupEditorList(); openSheet('sheet-groups'); }
function renderGroupEditorList() {
  const box = document.getElementById('groupEditList'), groups = state.settings.groups || [];
  box.innerHTML = groups.map((g, i) => `
    <div class="drag-group-row" data-gidx="${i}">
      <div style="display:flex;align-items:center;gap:10px;flex:1;">
        <span class="drag-handle" aria-label="拖动排序">≡</span>
        <span style="font-size:15px;font-weight:500;">${escapeHtml(g)}</span>
      </div>
      <div style="display:flex;gap:5px;">
        <button class="pill-mini xs" onclick="moveArchiveGroup(${i},-1)">↑</button>
        <button class="pill-mini xs" onclick="moveArchiveGroup(${i},1)">↓</button>
        <button class="pill-mini xs" style="color:var(--seal);" onclick="removeArchiveGroup(${i})">删</button>
      </div>
    </div>
  `).join('');
  bindGroupDragSort(box);
}
function bindGroupDragSort(container) {
  let dragIdx = -1, dragEl = null;
  container.querySelectorAll('.drag-group-row').forEach(row => {
    row.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      dragIdx = Number(row.dataset.gidx);
      dragEl = row;
      row.classList.add('dragging');
      row.setPointerCapture?.(e.pointerId);
    });
    row.addEventListener('pointermove', e => {
      if (dragIdx < 0 || !dragEl) return;
      const rows = Array.from(container.querySelectorAll('.drag-group-row'));
      for (let i = 0; i < rows.length; i++) {
        if (i === dragIdx) continue;
        const rect = rows[i].getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const arr = state.settings.groups;
          const [moved] = arr.splice(dragIdx, 1);
          arr.splice(i, 0, moved);
          dragIdx = i;
          renderGroupEditorList();
          const newEl = container.querySelector(`.drag-group-row[data-gidx="${dragIdx}"]`);
          if (newEl) { dragEl = newEl; dragEl.classList.add('dragging'); }
          break;
        }
      }
    });
    const finishDrag = async () => {
      if (dragIdx < 0) return;
      dragIdx = -1;
      container.querySelectorAll('.drag-group-row.dragging').forEach(x => x.classList.remove('dragging'));
      dragEl = null;
      await saveSettingsMeta();
      renderArchivesView();
    };
    row.addEventListener('pointerup', finishDrag);
    row.addEventListener('pointercancel', finishDrag);
  });
}
async function moveArchiveGroup(i, delta) {
  const arr = state.settings.groups, j = i + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView();
}
async function addArchiveGroup() { const inp = document.getElementById('newGroupInput'), v = inp.value.trim(); if (!v) return; if (!state.settings.groups.includes(v)) state.settings.groups.push(v); inp.value = ''; await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView(); }
async function removeArchiveGroup(i) { state.settings.groups.splice(i, 1); await saveSettingsMeta(); renderGroupEditorList(); renderArchivesView(); }

let baziComparePair = ['', ''];
function openBaziCompare() { const list = state.archives.filter(a => a.category === '八字'); if (list.length < 2) return showToast('请先保存至少 2 份八字档案'); baziComparePair = [list[0].id, list[1].id]; renderBaziCompareBody(); openOverlay('baziCompareOverlay'); }
function renderBaziCompareBody() {
  const list = state.archives.filter(a => a.category === '八字'), a1 = list.find(x => x.id === baziComparePair[0]) || list[0], a2 = list.find(x => x.id === baziComparePair[1]) || list[1];
  const rCol = a => a.data.pillars.map(p => `<span class="wx-${p.swx}" style="font-weight:700;">${p.s}</span><span class="wx-${p.bwx}" style="font-weight:700;">${p.b}</span>`).join(' · ');
  document.getElementById('baziCompareBody').innerHTML = `<div class="card"><div class="form-field"><label class="form-label">命盘甲</label><select class="form-select" onchange="baziComparePair[0]=this.value;renderBaziCompareBody()">${list.map(x => `<option value="${x.id}" ${x.id===a1.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><div style="margin-top:8px;font-size:16px;">${rCol(a1)}</div></div><div class="form-field"><label class="form-label">命盘乙</label><select class="form-select" onchange="baziComparePair[1]=this.value;renderBaziCompareBody()">${list.map(x => `<option value="${x.id}" ${x.id===a2.id?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select><div style="margin-top:8px;font-size:16px;">${rCol(a2)}</div></div></div><div id="baziCompareAiBox" class="card" style="font-size:15px;line-height:1.75;color:var(--text-2);">点右上角「AI 合盘」获取深度对比剖析。</div>`;
}
async function analyzeBaziCompareWithAI() { if (!ensureApiKey()) return; const list = state.archives.filter(a => a.category === '八字'), a1 = list.find(x => x.id === baziComparePair[0]), a2 = list.find(x => x.id === baziComparePair[1]), box = document.getElementById('baziCompareAiBox'); box.textContent = '参悟合盘中...'; try { box.innerHTML = formatRichText(await callLLM([{ role: 'user', content: `用 1. 2. 3. 编号清单（重点用【】标注，严禁星号）分析以下两个八字的合盘互补、日支关系与相处建议：\n甲(${a1.gender})：${a1.data.pillars.map(p => p.gz).join(' ')}\n乙(${a2.gender})：${a2.data.pillars.map(p => p.gz).join(' ')}` }])); } catch (e) { box.textContent = '失败：' + e.message; } }

function openGlobalSearch() { document.getElementById('globalSearchInput').value = ''; document.getElementById('globalSearchResults').innerHTML = '<div class="empty-box"><p>搜全库：书房原书、实战档案、历史记录、个人笔记与阶梯知识库</p></div>'; openOverlay('globalSearchOverlay'); setTimeout(() => document.getElementById('globalSearchInput').focus(), 200); }
function runGlobalSearch(q) {
  const k = (q || '').trim(), wrap = document.getElementById('globalSearchResults'); if (!k) return;
  const bookHits = state.chapters.filter(c => (c.content || '').includes(k) || (c.modernText || '').includes(k)).slice(0, 8);
  const archHits = state.archives.filter(a => getArchiveSearchBlob(a).includes(k.toLowerCase())).slice(0, 6);
  const noteHits = state.notes.filter(n => (n.title + n.body).includes(k)).slice(0, 6);
  const kbHits = [];
  CATEGORIES.forEach(cat => getAllFlatArticlesForCat(cat).forEach(art => {
    const fullTxt = art.title + art.summary + (art.content || '') + (state.settings.kbGenCache?.[art.id] || '');
    if (fullTxt.includes(k)) kbHits.push(art);
  }));
  let html = '';
  if (bookHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">书房原书命中</div>${bookHits.map(c => { const b = state.books.find(x => x.id === c.bookId), src = (c.content || '').includes(k) ? c.content : (c.modernText || ''), pos = src.indexOf(k); return `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openReader('${c.bookId}',${c.pageNum})"><div style="font-size:14px;font-weight:600;color:var(--accent);">《${escapeHtml(b?.title || '')}》第${c.pageNum}页</div><div style="font-size:13px;color:var(--text-2);">...${escapeHtml(src.slice(Math.max(0, pos - 22), pos + 60))}...</div></div>`; }).join('')}</div>`;
  if (kbHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">阶梯知识库命中</div>${kbHits.slice(0, 6).map(d => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openArticleById('${d.cat}','${d.id}')">[${d.cat}] ${escapeHtml(d.title)}</div>`).join('')}</div>`;
  if (archHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">实战档案命中</div>${archHits.map(a => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openSavedArchive('${a.id}')">[${a.category}] ${escapeHtml(a.title)}</div>`).join('')}</div>`;
  if (noteHits.length) html += `<div class="card"><div class="card-title" style="margin-bottom:8px;">笔记命中</div>${noteHits.map(n => `<div style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="closeOverlay('globalSearchOverlay');openNoteEditor('${n.id}')">[${n.category}] ${escapeHtml(n.title || '无标题')}</div>`).join('')}</div>`;
  wrap.innerHTML = html || '<div class="empty-box"><p>未检索到匹配结果</p></div>';
}

// ==================== 6. iCloud 两步备份、AES-256 云同步与多 AI 设置 ====================
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
    version: 'CangwangV10', exportedAt: new Date().toISOString(),
    books: await dbGetAll('books'), chapters: await dbGetAll('chapters'), notes: await dbGetAll('notes'),
    archives: await dbGetAll('archives'), history: await dbGetAll('history'),
    chats: await dbGetAll('chats'), memories: await dbGetAll('memories'), footprints: await dbGetAll('footprints'),
    settingsLite: {
      theme: state.settings.theme, groups: state.settings.groups, myDayPillar: state.settings.myDayPillar,
      extBookUrl: state.settings.extBookUrl, weakSpots: state.settings.weakSpots,
      articleSourceCache: state.settings.articleSourceCache, kbGenCache: state.settings.kbGenCache,
      customDict: state.customDict
    }
  };
}
async function applyTextVaultPayload(data) {
  if (!data || !Array.isArray(data.archives)) throw new Error('备份文件格式不匹配');
  for (const st of ['books','chapters','notes','archives','history','chats','memories','footprints']) {
    if (Array.isArray(data[st])) for (const it of data[st]) await dbPut(st, it);
  }
  if (data.settingsLite) {
    if (Array.isArray(data.settingsLite.customDict)) { state.customDict = data.settingsLite.customDict; await dbPut('meta', { id: 'customDict', data: state.customDict }); }
    Object.assign(state.settings, data.settingsLite); await saveSettingsMeta();
  }
  await loadAllFromDB(); applyVisualTheme(); renderAllCurrentViews(); updateFollowupBadge();
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
  preparedBackupName = `藏往V10备份_${formatDateKey(new Date())}.json`;
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
  box.textContent = `本地珍藏库：${state.books.length} 本典籍（PDF ${pdfMB} MB）、${state.archives.length} 份档案、${state.history.length} 条排盘历史、${state.notes.length} 篇笔记`;
}

// 多 AI 方案切换与预设填充
function renderAiProfileSelect() {
  const s = state.settings, prof = getActiveAiProfile();
  const sel = document.getElementById('cfgActiveProfile');
  if (sel) sel.innerHTML = s.aiProfiles.map(p => `<option value="${p.id}" ${p.id===prof.id?'selected':''}>${escapeHtml(p.name || '未命名方案')}</option>`).join('');
  document.getElementById('cfgProfName').value = prof.name || '';
  document.getElementById('cfgApiKey').value = prof.apiKey || '';
  document.getElementById('cfgBaseUrl').value = prof.baseUrl || '';
  document.getElementById('cfgFlashModel').value = prof.flashModel || '';
  document.getElementById('cfgProModel').value = prof.proModel || '';
}
function switchAiProfileInUI(id) {
  state.settings.activeProfileId = id;
  renderAiProfileSelect();
  saveSettingsMeta();
  updateCanwuModelBadge();
  showToast('已切换主力 AI 方案');
}
function applyAiPreset(key) {
  const p = AI_PRESETS[key]; if (!p) return;
  document.getElementById('cfgProfName').value = p.name;
  document.getElementById('cfgBaseUrl').value = p.baseUrl;
  document.getElementById('cfgFlashModel').value = p.flashModel;
  document.getElementById('cfgProModel').value = p.proModel;
  showToast(`已填入 ${p.name} 接口模板，填上 API Key 后保存即可`);
}
function applyVisionPreset(key) {
  const p = VISION_PRESETS[key]; if (!p) return;
  document.getElementById('cfgVisBaseUrl').value = p.baseUrl;
  document.getElementById('cfgVisModel').value = p.model;
  showToast(`已填入识图模型 ${p.model}，填好 Key 保存即可`);
}
async function addNewAiProfile() {
  const name = document.getElementById('cfgProfName').value.trim() || '新 AI 方案';
  const np = {
    id: uid('aip'), name,
    apiKey: document.getElementById('cfgApiKey').value.trim(),
    baseUrl: document.getElementById('cfgBaseUrl').value.trim() || 'https://api.deepseek.com',
    flashModel: document.getElementById('cfgFlashModel').value.trim() || 'deepseek-chat',
    proModel: document.getElementById('cfgProModel').value.trim() || 'deepseek-reasoner'
  };
  state.settings.aiProfiles.push(np);
  state.settings.activeProfileId = np.id;
  await saveSettingsMeta();
  renderAiProfileSelect();
  updateCanwuModelBadge();
  showToast(`已新增方案「${name}」，以后可随时下拉切换`);
}

function openSettings() {
  const s = state.settings;
  renderAiProfileSelect();
  document.getElementById('cfgCoinSound').checked = s.coinSound !== false;
  document.getElementById('cfgUseTier').value = s.useTier || 'flash';
  document.getElementById('cfgVisKey').value = s.visionApiKey || '';
  document.getElementById('cfgVisBaseUrl').value = s.visionBaseUrl || '';
  document.getElementById('cfgVisModel').value = s.visionModel || '';
  document.getElementById('cfgRedactNames').checked = s.redactNames !== false;
  document.getElementById('cfgMyDayPillar').value = s.myDayPillar || '';
  document.getElementById('cfgExtBookUrl').value = s.extBookUrl || 'https://z-lib.gs/s/{q}';
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
  const s = state.settings, prof = getActiveAiProfile();
  prof.name = document.getElementById('cfgProfName').value.trim() || prof.name || '主力模型';
  prof.apiKey = document.getElementById('cfgApiKey').value.trim();
  prof.baseUrl = document.getElementById('cfgBaseUrl').value.trim() || 'https://api.deepseek.com';
  prof.flashModel = document.getElementById('cfgFlashModel').value.trim() || 'deepseek-chat';
  prof.proModel = document.getElementById('cfgProModel').value.trim() || 'deepseek-reasoner';
  s.apiKey = prof.apiKey; s.baseUrl = prof.baseUrl; s.flashModel = prof.flashModel; s.proModel = prof.proModel;
  s.coinSound = document.getElementById('cfgCoinSound').checked;
  s.useTier = document.getElementById('cfgUseTier').value;
  s.visionApiKey = document.getElementById('cfgVisKey').value.trim();
  s.visionBaseUrl = document.getElementById('cfgVisBaseUrl').value.trim();
  s.visionModel = document.getElementById('cfgVisModel').value.trim();
  s.redactNames = document.getElementById('cfgRedactNames').checked;
  s.myDayPillar = document.getElementById('cfgMyDayPillar').value.trim();
  s.extBookUrl = document.getElementById('cfgExtBookUrl').value.trim() || 'https://z-lib.gs/s/{q}';
  s.syncUrl = document.getElementById('cfgSyncUrl').value.trim();
  s.vaultPass = document.getElementById('cfgVaultPass').value.trim();
  s.e2eEncrypt = document.getElementById('cfgE2eEncrypt').checked;
  await saveSettingsMeta();
  renderAiProfileSelect();
  updateCanwuModelBadge();
  if (!silent) showToast('全部设置已保存');
}

function startVoiceInput(id) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return showToast('请直接点手机键盘麦克风听写');
  const rec = new SR(); rec.lang = 'zh-CN'; showToast('请说话...');
  rec.onresult = e => { const el = document.getElementById(id); if (el) { el.value += (el.value ? ' ' : '') + e.results[0][0].transcript; el.dispatchEvent(new Event('input')); } };
  rec.start();
}

// ==================== 7. 主导航切换与启动初始化 ====================
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
    // 自动兼容旧版单一 apiKey 到新多方案结构
    if (!Array.isArray(state.settings.aiProfiles) || !state.settings.aiProfiles.length) {
      state.settings.aiProfiles = [{ id: 'p_ds', name: 'DeepSeek 主力', apiKey: state.settings.apiKey || '', baseUrl: state.settings.baseUrl || 'https://api.deepseek.com', flashModel: state.settings.flashModel || 'deepseek-chat', proModel: state.settings.proModel || 'deepseek-reasoner' }];
      state.settings.activeProfileId = 'p_ds';
    } else if (state.settings.apiKey && !state.settings.aiProfiles[0].apiKey) {
      state.settings.aiProfiles[0].apiKey = state.settings.apiKey;
    }
    if (!state.settings.v10Migrated) { state.settings.theme = state.settings.theme || 'shuimo'; state.settings.v10Migrated = true; await saveSettingsMeta(); }
  }
  const cd = await dbGet('meta', 'customDict'); if (Array.isArray(cd?.data)) state.customDict = cd.data;
  state.books = await dbGetAll('books'); state.chapters = await dbGetAll('chapters'); state.notes = await dbGetAll('notes');
  state.archives = await dbGetAll('archives'); state.history = await dbGetAll('history');
  state.chats = await dbGetAll('chats'); state.memories = await dbGetAll('memories');
  state.footprints = Object.fromEntries((await dbGetAll('footprints')).map(f => [f.id, f.count]));
}

async function initApp() {
  await openDB();
  await loadAllFromDB();
  applyVisualTheme();
  updateFollowupBadge();
  updateCanwuModelBadge();
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
