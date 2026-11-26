// ==================== 藏往 V6：IndexedDB、端到端加密、Cloudflare D1 同步与安全清缓存 ====================
const DB_NAME = 'CangwangV6DB';
const DB_VER = 1;
let dbInst = null;
let preparedBackupBlob = null;
let preparedBackupName = '';

const STORES = ['books', 'pdfBlobs', 'chapters', 'notes', 'archives', 'chats', 'memories', 'hexCache', 'dailyDraws', 'footprints', 'meta'];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(s => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      });
    };
    req.onsuccess = e => { dbInst = e.target.result; resolve(dbInst); };
    req.onerror = e => reject(e.target.error);
  });
}

function dbGet(store, id) {
  return new Promise((res, rej) => {
    const tx = dbInst.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = dbInst.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

function dbPut(store, obj) {
  return new Promise((res, rej) => {
    const tx = dbInst.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(obj);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbDel(store, id) {
  return new Promise((res, rej) => {
    const tx = dbInst.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// ==================== 全局状态树 ====================
const CATEGORIES = ['六爻', '八字', '梅花', '奇门', '六壬', '紫微', '风水'];
const CANWU_ROOMS = ['六爻', '八字', '梅花', '奇门', '六壬', '紫微', '风水', '问机解梦'];

const state = {
  mainTab: 'divine',
  category: '六爻',
  subTab: 'cast',
  methodsSub: 'dict',
  archCategory: '六爻',
  archGroup: '全部',
  canwuRoom: '六爻',
  canwuMode: 'answer',
  activeThreadId: null,
  privacyOn: false,
  userScrolledUp: false,
  isStreaming: false,
  shelfView: 'grid',
  shelfSort: 'recent',
  noteSearch: '',
  noteFolderFilter: 'all',
  editingNoteId: null,
  dictGroup: '基础知识',
  dictItemIdx: 0,
  hexSort: 'palace',
  hexPalaceFilter: 'all',
  hexSearch: '',
  currentHexKey: '7_7',
  hexMovingSet: new Set(),
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelectedDate: '',
  calYiFilter: '',
  askJiTab: 'draw',
  drawStyle: 'zhouyi',
  currentResult: null,
  selectedBookIds: [],
  primaryBookId: null,
  activeReportTab: 0,
  books: [],
  chapters: [],
  notes: [],
  archives: [],
  chats: [],
  memories: [],
  dailyDraws: [],
  footprints: {},
  reader: {
    bookId: null,
    engine: 'pdf',
    pageNum: 1,
    totalPages: 1,
    chapIdx: 0,
    textMode: 'orig',
    barsHidden: true,
    selText: '',
    selHexKey: null,
    pdfDoc: null
  },
  tts: { playing: false, mode: 'modern', rate: 1.0, timerId: null, queue: [], qIdx: 0 },
  settings: {
    theme: 'cinnabar',
    accent: 'red',
    ambient: 'luopan',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    flashModel: 'deepseek-chat',
    proModel: 'deepseek-reasoner',
    useTier: 'flash',
    chatRetentionDays: 30,
    redactNames: true,
    myDayPillar: '',
    syncUrl: '',
    vaultPass: '',
    e2eEncrypt: true,
    fontSize: 16.5,
    lineHeight: 1.88,
    fontFamily: 'songhei',
    paper: 'warm',
    groups: ['亲人', '恋人/伴侣', '朋友', '客户', '领导/老师', '自己'],
    customPortals: [],
    tokensIn: 0,
    tokensOut: 0,
    dirtySinceBackup: false,
    lastSyncAt: ''
  }
};

function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
state.calSelectedDate = formatDateKey(new Date());

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

async function saveSettingsMeta() {
  await dbPut('meta', { id: 'settings', data: state.settings });
}
async function markDirty() {
  state.settings.dirtySinceBackup = true;
  const dot = document.getElementById('backupDot');
  if (dot) dot.classList.add('show');
  await saveSettingsMeta();
}
async function markStudyFootprint() {
  const key = formatDateKey(new Date());
  state.footprints[key] = (state.footprints[key] || 0) + 1;
  await dbPut('footprints', { id: key, count: state.footprints[key] });
}

function openSheet(id) {
  if (id === 'sheet-import') document.getElementById('importCatName').textContent = state.category;
  document.getElementById(id).classList.add('open');
}
function closeSheet(id) { document.getElementById(id).classList.remove('open'); }
function backdropClose(e, id) { if (e.target.id === id) closeSheet(id); }
function openOverlay(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'readerOverlay' || id === 'noteEditorOverlay') {
    document.getElementById('ambientLayer').classList.add('hidden');
  }
}
function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'readerOverlay' || id === 'noteEditorOverlay') {
    updateAmbientLayer();
  }
}

// ==================== AES-256-GCM 本地端到端加密 ====================
async function deriveAesKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function encryptPayload(jsonStr, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonStr));
  return JSON.stringify({
    e2e: 'AES-256-GCM',
    s: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    d: bytesToBase64(new Uint8Array(cipher))
  });
}

async function decryptPayload(wrappedStr, passphrase) {
  const obj = JSON.parse(wrappedStr);
  if (!obj.e2e) return obj;
  const salt = base64ToBytes(obj.s);
  const iv = base64ToBytes(obj.iv);
  const data = base64ToBytes(obj.d);
  const key = await deriveAesKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plain));
}

// ==================== 双层分离打包（不含大体积 pdfBlobs，永不卡死） ====================
async function buildTextVaultPayload() {
  return {
    version: 'CangwangV6',
    exportedAt: new Date().toISOString(),
    books: await dbGetAll('books'),
    chapters: await dbGetAll('chapters'),
    notes: await dbGetAll('notes'),
    archives: await dbGetAll('archives'),
    chats: await dbGetAll('chats'),
    memories: await dbGetAll('memories'),
    hexCache: await dbGetAll('hexCache'),
    dailyDraws: await dbGetAll('dailyDraws'),
    footprints: await dbGetAll('footprints'),
    settingsLite: {
      theme: state.settings.theme,
      accent: state.settings.accent,
      ambient: state.settings.ambient,
      groups: state.settings.groups,
      customPortals: state.settings.customPortals,
      myDayPillar: state.settings.myDayPillar,
      chatRetentionDays: state.settings.chatRetentionDays
    }
  };
}

async function applyTextVaultPayload(data) {
  if (!data || !Array.isArray(data.archives)) throw new Error('数据格式不匹配');
  for (const st of ['books', 'chapters', 'notes', 'archives', 'chats', 'memories', 'hexCache', 'dailyDraws', 'footprints']) {
    if (Array.isArray(data[st])) {
      for (const it of data[st]) await dbPut(st, it);
    }
  }
  if (data.settingsLite) {
    Object.assign(state.settings, data.settingsLite);
    await saveSettingsMeta();
  }
  await loadAllFromDB();
  applyVisualTheme();
  renderAllCurrentViews();
}

// ==================== Cloudflare D1 同步 ====================
async function pushToCloudD1() {
  saveGeneralSettings(true);
  const { syncUrl, vaultPass, e2eEncrypt } = state.settings;
  if (!syncUrl || !vaultPass) return showToast('请先填入 Worker 地址和私人保险箱口令');
  showToast('正在加密上传到 Cloudflare D1...');
  try {
    const payload = await buildTextVaultPayload();
    let bodyStr = JSON.stringify(payload);
    if (e2eEncrypt) bodyStr = await encryptPayload(bodyStr, vaultPass);
    const resp = await fetch(syncUrl.replace(/\/$/, '') + '/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vault-Token': vaultPass },
      body: JSON.stringify({ payload: bodyStr })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    state.settings.dirtySinceBackup = false;
    state.settings.lastSyncAt = new Date().toLocaleString();
    document.getElementById('backupDot').classList.remove('show');
    await saveSettingsMeta();
    document.getElementById('cloudSyncStatus').textContent = '上次加密同步：' + state.settings.lastSyncAt;
    showToast('已加密同步至 Cloudflare D1 云端！');
  } catch (e) {
    showToast('云同步失败：' + e.message);
  }
}

async function pullFromCloudD1() {
  saveGeneralSettings(true);
  const { syncUrl, vaultPass } = state.settings;
  if (!syncUrl || !vaultPass) return showToast('请先填入 Worker 地址和私人保险箱口令');
  showToast('正在从云端拉回并解密...');
  try {
    const resp = await fetch(syncUrl.replace(/\/$/, '') + '/sync', {
      method: 'GET',
      headers: { 'X-Vault-Token': vaultPass }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const res = await resp.json();
    if (!res.payload) return showToast('云端暂无备份数据');
    const data = await decryptPayload(res.payload, vaultPass);
    await applyTextVaultPayload(data);
    state.settings.dirtySinceBackup = false;
    document.getElementById('backupDot').classList.remove('show');
    await saveSettingsMeta();
    closeSheet('sheet-settings');
    showToast('已从 Cloudflare D1 无损恢复全部文字资产！');
  } catch (e) {
    showToast('拉回或解密失败（请检查口令）：' + e.message);
  }
}

// ==================== 修复版：两步式本地备份到 iCloud ====================
async function prepareLocalBackup() {
  showToast('正在打包文字资产...');
  const payload = await buildTextVaultPayload();
  const str = JSON.stringify(payload);
  preparedBackupBlob = new Blob([str], { type: 'application/json' });
  preparedBackupName = `藏往V6备份_${formatDateKey(new Date())}.json`;
  const btn = document.getElementById('saveBackupBtn');
  btn.disabled = false;
  btn.style.opacity = '1';
  document.getElementById('packBackupBtn').textContent = '已打包 (' + (str.length / 1024).toFixed(1) + ' KB)';
  showToast('打包完成！请直接点右侧「第2步：存到 iCloud」');
}

function triggerLocalBackupSave() {
  if (!preparedBackupBlob) return showToast('请先点第1步生成备份包');
  const file = new File([preparedBackupBlob], preparedBackupName, { type: 'application/json' });
  state.settings.dirtySinceBackup = false;
  document.getElementById('backupDot').classList.remove('show');
  saveSettingsMeta();
  // 同步直接触发用户手势，iOS Safari 不再拦截
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: '藏往 V6 备份', text: '请选择“存储到文件”存入 iCloud 云盘' }).catch(() => {
      fallbackAnchorDownload(preparedBackupBlob, preparedBackupName);
    });
  } else {
    fallbackAnchorDownload(preparedBackupBlob, preparedBackupName);
  }
}

function fallbackAnchorDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  showToast('已触发文件下载，可存入 iCloud 云盘');
}

async function importLocalBackup(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    await applyTextVaultPayload(data);
    closeSheet('sheet-settings');
    showToast('备份已成功恢复！');
  } catch (err) {
    showToast('恢复失败：' + err.message);
  }
  e.target.value = '';
}

// ==================== 存储体检与安全清缓存 ====================
async function refreshStorageStats() {
  const box = document.getElementById('storageStatsBox');
  if (!box) return;
  const pdfs = await dbGetAll('pdfBlobs');
  const pdfMB = (pdfs.reduce((a, b) => a + (b.data ? b.data.byteLength : 0), 0) / (1024 * 1024)).toFixed(2);
  const textBytes = JSON.stringify({ a: state.archives, n: state.notes, c: state.chats, m: state.memories }).length;
  const textKB = (textBytes / 1024).toFixed(1);
  const oldChats = countExpiredChats();
  box.innerHTML = `
    <div><strong>永久珍藏区（锁定保护）：</strong>${state.books.length} 本典籍（PDF原件 ${pdfMB} MB）、${state.archives.length} 份实战卷宗、${state.notes.length} 篇笔记、${state.memories.length} 条大脑记忆（纯文字仅 ${textKB} KB）</div>
    <div style="margin-top:4px;"><strong>可清理临时区：</strong>${oldChats} 条超过保留期且未标星的闲聊 + 临时渲染缓存</div>
  `;
}

function countExpiredChats() {
  const days = Number(state.settings.chatRetentionDays);
  if (days === 0) return 0;
  const cutoff = days < 0 ? Date.now() : (Date.now() - days * 86400000);
  return state.chats.filter(t => !t.starred && (t.updatedAt || t.createdAt) < cutoff).length;
}

async function runSafeClearCache() {
  let removed = 0;
  const days = Number(state.settings.chatRetentionDays);
  if (days !== 0) {
    const cutoff = days < 0 ? Date.now() : (Date.now() - days * 86400000);
    const expired = state.chats.filter(t => !t.starred && (t.updatedAt || t.createdAt) < cutoff);
    for (const t of expired) {
      await dbDel('chats', t.id);
      removed++;
    }
    state.chats = state.chats.filter(t => t.starred || (t.updatedAt || t.createdAt) >= cutoff);
  }
  if (state.reader.pdfDoc) {
    try { state.reader.pdfDoc.destroy(); } catch (e) {}
    state.reader.pdfDoc = null;
  }
  preparedBackupBlob = null;
  await refreshStorageStats();
  showToast(`安全清理完成！已释放临时缓存并清理 ${removed} 条过期未标星闲聊，珍藏资料零损失`);
}

// ==================== 主题、隐私模糊与背景暗纹 ====================
function applyVisualTheme() {
  const s = state.settings;
  if (s.theme === 'warm') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', s.theme || 'cinnabar');
  document.documentElement.setAttribute('data-accent', s.accent || 'red');
  updateAmbientLayer();
}

function setAppTheme(t) { state.settings.theme = t; applyVisualTheme(); saveSettingsMeta(); }
function setAccentColor(a) { state.settings.accent = a; applyVisualTheme(); saveSettingsMeta(); }
function setAmbientMode(m) { state.settings.ambient = m; updateAmbientLayer(); saveSettingsMeta(); }

function updateAmbientLayer() {
  const el = document.getElementById('ambientLayer');
  if (!el) return;
  const mode = state.settings.ambient || 'luopan';
  if (mode === 'none') {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  if (mode === 'luopan') {
    el.innerHTML = `<svg class="ambient-luopan" id="ambientSvg" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="0.9">
      <circle cx="100" cy="100" r="95"/><circle cx="100" cy="100" r="78"/><circle cx="100" cy="100" r="58"/><circle cx="100" cy="100" r="36"/>
      ${Array.from({length:24},(_,i)=>{const a=i*15*Math.PI/180;return `<line x1="${(100+58*Math.cos(a)).toFixed(1)}" y1="${(100+58*Math.sin(a)).toFixed(1)}" x2="${(100+95*Math.cos(a)).toFixed(1)}" y2="${(100+95*Math.sin(a)).toFixed(1)}"/>`;}).join('')}
      ${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180;return `<line x1="${(100+36*Math.cos(a)).toFixed(1)}" y1="${(100+36*Math.sin(a)).toFixed(1)}" x2="${(100+58*Math.cos(a)).toFixed(1)}" y2="${(100+58*Math.sin(a)).toFixed(1)}"/>`;}).join('')}
    </svg>`;
  } else if (mode === 'moon') {
    el.innerHTML = `<svg class="ambient-moon" viewBox="0 0 120 120" fill="currentColor"><path d="M78 16A46 46 0 1 0 104 88 38 38 0 1 1 78 16z"/></svg>`;
  } else {
    el.innerHTML = `<div class="ambient-cloud"></div>`;
  }
}

function pulseAmbient() {
  const svg = document.getElementById('ambientSvg');
  if (!svg) return;
  svg.classList.add('pulse');
  clearTimeout(svg._pt);
  svg._pt = setTimeout(() => svg.classList.remove('pulse'), 1100);
}

function togglePrivacyBlur() {
  state.privacyOn = !state.privacyOn;
  document.getElementById('appShell').classList.toggle('privacy-on', state.privacyOn);
  document.getElementById('privacyToggleBtn').classList.toggle('active', state.privacyOn);
  showToast(state.privacyOn ? '已开启公共场合隐私模糊' : '已关闭隐私模糊');
}

function openSettings() {
  const s = state.settings;
  document.getElementById('cfgApiKey').value = s.apiKey || '';
  document.getElementById('cfgBaseUrl').value = s.baseUrl || 'https://api.deepseek.com';
  document.getElementById('cfgFlashModel').value = s.flashModel || 'deepseek-chat';
  document.getElementById('cfgProModel').value = s.proModel || 'deepseek-reasoner';
  document.getElementById('cfgUseTier').value = s.useTier || 'flash';
  document.getElementById('cfgChatRetention').value = String(s.chatRetentionDays ?? 30);
  document.getElementById('cfgRedactNames').checked = s.redactNames !== false;
  document.getElementById('cfgMyDayPillar').value = s.myDayPillar || '';
  document.getElementById('cfgAmbientBg').value = s.ambient || 'luopan';
  document.getElementById('cfgSyncUrl').value = s.syncUrl || '';
  document.getElementById('cfgVaultPass').value = s.vaultPass || '';
  document.getElementById('cfgE2eEncrypt').checked = s.e2eEncrypt !== false;
  const est = ((s.tokensIn / 1e6) * 1.5 + (s.tokensOut / 1e6) * 5).toFixed(3);
  document.getElementById('costStatsBox').textContent = `累计估算：输入 ${s.tokensIn} / 输出 ${s.tokensOut} tokens（约 ¥${est} 元）`;
  document.getElementById('cloudSyncStatus').textContent = s.lastSyncAt ? '上次加密同步：' + s.lastSyncAt : '未同步过云端（支持免外币卡 Cloudflare D1）';
  refreshStorageStats();
  openSheet('sheet-settings');
}

async function saveGeneralSettings(silent = false) {
  const s = state.settings;
  s.apiKey = document.getElementById('cfgApiKey').value.trim();
  s.baseUrl = document.getElementById('cfgBaseUrl').value.trim() || 'https://api.deepseek.com';
  s.flashModel = document.getElementById('cfgFlashModel').value.trim() || 'deepseek-chat';
  s.proModel = document.getElementById('cfgProModel').value.trim() || 'deepseek-reasoner';
  s.useTier = document.getElementById('cfgUseTier').value;
  s.chatRetentionDays = Number(document.getElementById('cfgChatRetention').value);
  s.redactNames = document.getElementById('cfgRedactNames').checked;
  s.myDayPillar = document.getElementById('cfgMyDayPillar').value.trim();
  s.syncUrl = document.getElementById('cfgSyncUrl').value.trim();
  s.vaultPass = document.getElementById('cfgVaultPass').value.trim();
  s.e2eEncrypt = document.getElementById('cfgE2eEncrypt').checked;
  await saveSettingsMeta();
  if (!silent) {
    showToast('设置已保存');
    if (state.mainTab === 'calendar') renderCalendarView();
  }
}
