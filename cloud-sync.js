// ==================== 藏往 V7：IndexedDB、端到端加密、Cloudflare D1 同步、音效引擎与侧边抽屉 ====================
const DB_NAME = 'CangwangV6DB'; // 沿用 V6 库名，升级 V7 零丢失你已存的书籍和档案！
const DB_VER = 1;
let dbInst = null;
let preparedBackupBlob = null;
let preparedBackupName = '';
let audioCtx = null;

const STORES = ['books', 'pdfBlobs', 'chapters', 'notes', 'archives', 'chats', 'memories', 'hexCache', 'dailyDraws', 'footprints', 'meta'];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = e => { dbInst = e.target.result; resolve(dbInst); };
    req.onerror = e => reject(e.target.error);
  });
}

function dbGet(store, id) { return new Promise((res, rej) => { const r = dbInst.transaction(store,'readonly').objectStore(store).get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbGetAll(store) { return new Promise((res, rej) => { const r = dbInst.transaction(store,'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
function dbPut(store, obj) { return new Promise((res, rej) => { const r = dbInst.transaction(store,'readwrite').objectStore(store).put(obj); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbDel(store, id) { return new Promise((res, rej) => { const r = dbInst.transaction(store,'readwrite').objectStore(store).delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

// ==================== WebAudio 清脆古铜钱与竹签音效引擎（离线零延迟） ====================
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playCoinClink(isSettle = false) {
  if (state.settings.coinSound === false) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freqs = isSettle ? [2650, 3920, 5240] : [2200 + Math.random() * 600, 3400 + Math.random() * 700];
  freqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.94, now + (isSettle ? 0.28 : 0.09));
    gain.gain.setValueAtTime(isSettle ? 0.14 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isSettle ? 0.30 : 0.10));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.012);
    osc.stop(now + (isSettle ? 0.32 : 0.12));
  });
}

// ==================== 全局状态 ====================
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
  reader: { bookId: null, engine: 'pdf', pageNum: 1, totalPages: 1, textMode: 'orig', barsHidden: true, selText: '', selHexKey: null, pdfDoc: null },
  tts: { playing: false, mode: 'modern', rate: 1.0, timerId: null, queue: [], qIdx: 0 },
  settings: {
    theme: 'apple',
    accent: 'red',
    coinSound: true,
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
    fontSize: 17,
    lineHeight: 1.9,
    fontFamily: 'songhei',
    paper: 'warm',
    groups: ['亲人', '伴侣', '朋友', '客户', '自己'],
    customPortals: [],
    tokensIn: 0,
    tokensOut: 0,
    dirtySinceBackup: false,
    lastSyncAt: ''
  }
};

function uid(prefix = 'id') { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function formatDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
state.calSelectedDate = formatDateKey(new Date());

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

async function saveSettingsMeta() { await dbPut('meta', { id: 'settings', data: state.settings }); }
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

function openSideDrawer() {
  document.getElementById('drawerArchCount').textContent = state.archives.length;
  document.getElementById('drawerPrivState').textContent = state.privacyOn ? '开' : '关';
  if (typeof getCultivationRank === 'function') {
    document.getElementById('drawerRankText').textContent = getCultivationRank() + ' · 私人术数终端';
  }
  document.getElementById('sideDrawerBackdrop').classList.add('open');
  document.getElementById('sideDrawer').classList.add('open');
}
function closeSideDrawer() {
  document.getElementById('sideDrawerBackdrop').classList.remove('open');
  document.getElementById('sideDrawer').classList.remove('open');
}

function openSheet(id) {
  if (id === 'sheet-import') document.getElementById('importCatName').textContent = state.category;
  document.getElementById(id).classList.add('open');
}
function closeSheet(id) { document.getElementById(id).classList.remove('open'); }
function backdropClose(e, id) { if (e.target.id === id) closeSheet(id); }
function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// ==================== AES-256-GCM 端到端加密与云同步 ====================
async function deriveAesKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function bytesToBase64(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function base64ToBytes(b64) { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }

async function encryptPayload(jsonStr, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(pass, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonStr));
  return JSON.stringify({ e2e: 'AES-256-GCM', s: bytesToBase64(salt), iv: bytesToBase64(iv), d: bytesToBase64(new Uint8Array(cipher)) });
}
async function decryptPayload(wrappedStr, pass) {
  const obj = JSON.parse(wrappedStr);
  if (!obj.e2e) return obj;
  const key = await deriveAesKey(pass, base64ToBytes(obj.s));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(obj.iv) }, key, base64ToBytes(obj.d));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function buildTextVaultPayload() {
  return {
    version: 'CangwangV7', exportedAt: new Date().toISOString(),
    books: await dbGetAll('books'), chapters: await dbGetAll('chapters'), notes: await dbGetAll('notes'),
    archives: await dbGetAll('archives'), chats: await dbGetAll('chats'), memories: await dbGetAll('memories'),
    hexCache: await dbGetAll('hexCache'), dailyDraws: await dbGetAll('dailyDraws'), footprints: await dbGetAll('footprints'),
    settingsLite: { theme: state.settings.theme, accent: state.settings.accent, groups: state.settings.groups, customPortals: state.settings.customPortals, myDayPillar: state.settings.myDayPillar }
  };
}
async function applyTextVaultPayload(data) {
  if (!data || !Array.isArray(data.archives)) throw new Error('数据格式不匹配');
  for (const st of ['books', 'chapters', 'notes', 'archives', 'chats', 'memories', 'hexCache', 'dailyDraws', 'footprints']) {
    if (Array.isArray(data[st])) for (const it of data[st]) await dbPut(st, it);
  }
  if (data.settingsLite) { Object.assign(state.settings, data.settingsLite); await saveSettingsMeta(); }
  await loadAllFromDB(); applyVisualTheme(); renderAllCurrentViews();
}

async function pushToCloudD1() {
  saveGeneralSettings(true);
  const { syncUrl, vaultPass, e2eEncrypt } = state.settings;
  if (!syncUrl || !vaultPass) return showToast('请先填写 Worker 地址和私人保险箱口令');
  showToast('正在加密上传到 Cloudflare D1...');
  try {
    let bodyStr = JSON.stringify(await buildTextVaultPayload());
    if (e2eEncrypt) bodyStr = await encryptPayload(bodyStr, vaultPass);
    const resp = await fetch(syncUrl.replace(/\/$/, '') + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': vaultPass }, body: JSON.stringify({ payload: bodyStr }) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    state.settings.dirtySinceBackup = false; state.settings.lastSyncAt = new Date().toLocaleString();
    document.getElementById('backupDot').classList.remove('show');
    await saveSettingsMeta();
    document.getElementById('cloudSyncStatus').textContent = '上次同步：' + state.settings.lastSyncAt;
    showToast('已加密同步至 Cloudflare D1');
  } catch (e) { showToast('云同步失败：' + e.message); }
}

async function pullFromCloudD1() {
  saveGeneralSettings(true);
  const { syncUrl, vaultPass } = state.settings;
  if (!syncUrl || !vaultPass) return showToast('请先填写 Worker 地址和口令');
  showToast('正在从云端拉回解密...');
  try {
    const resp = await fetch(syncUrl.replace(/\/$/, '') + '/sync', { method: 'GET', headers: { 'X-Vault-Token': vaultPass } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const res = await resp.json();
    if (!res.payload) return showToast('云端暂无备份');
    await applyTextVaultPayload(await decryptPayload(res.payload, vaultPass));
    closeSheet('sheet-settings');
    showToast('已从云端完整恢复全部文字资产');
  } catch (e) { showToast('拉回失败（请检查口令）：' + e.message); }
}

async function prepareLocalBackup() {
  const str = JSON.stringify(await buildTextVaultPayload());
  preparedBackupBlob = new Blob([str], { type: 'application/json' });
  preparedBackupName = `藏往V7备份_${formatDateKey(new Date())}.json`;
  const btn = document.getElementById('saveBackupBtn');
  btn.disabled = false; btn.style.opacity = '1';
  document.getElementById('packBackupBtn').textContent = '已打包 (' + (str.length / 1024).toFixed(1) + ' KB)';
  showToast('已打包，请直接点「2. 存到 iCloud」');
}
function triggerLocalBackupSave() {
  if (!preparedBackupBlob) return;
  const file = new File([preparedBackupBlob], preparedBackupName, { type: 'application/json' });
  state.settings.dirtySinceBackup = false; document.getElementById('backupDot').classList.remove('show'); saveSettingsMeta();
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: '藏往备份', text: '请选择存储到文件存入 iCloud' }).catch(() => fallbackAnchorDownload(preparedBackupBlob, preparedBackupName));
  } else fallbackAnchorDownload(preparedBackupBlob, preparedBackupName);
}
function fallbackAnchorDownload(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}
async function importLocalBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  try { await applyTextVaultPayload(JSON.parse(await f.text())); closeSheet('sheet-settings'); showToast('备份恢复成功'); }
  catch (err) { showToast('恢复失败：' + err.message); }
  e.target.value = '';
}

async function refreshStorageStats() {
  const box = document.getElementById('storageStatsBox'); if (!box) return;
  const pdfs = await dbGetAll('pdfBlobs');
  const pdfMB = (pdfs.reduce((a, b) => a + (b.data ? b.data.byteLength : 0), 0) / 1048576).toFixed(2);
  const textKB = (JSON.stringify({ a: state.archives, n: state.notes, c: state.chats, m: state.memories }).length / 1024).toFixed(1);
  box.innerHTML = `珍藏锁定区：${state.books.length} 本书（PDF ${pdfMB} MB）、${state.archives.length} 份卷宗、${state.notes.length} 篇笔记（纯文字 ${textKB} KB）`;
}
async function runSafeClearCache() {
  const days = Number(state.settings.chatRetentionDays);
  let removed = 0;
  if (days !== 0) {
    const cutoff = days < 0 ? Date.now() : (Date.now() - days * 86400000);
    const expired = state.chats.filter(t => !t.starred && (t.updatedAt || t.createdAt) < cutoff);
    for (const t of expired) { await dbDel('chats', t.id); removed++; }
    state.chats = state.chats.filter(t => t.starred || (t.updatedAt || t.createdAt) >= cutoff);
  }
  if (state.reader.pdfDoc) { try { state.reader.pdfDoc.destroy(); } catch (e) {} state.reader.pdfDoc = null; }
  await refreshStorageStats();
  showToast(`已清理临时缓存与 ${removed} 条过期闲聊，珍藏资料零损失`);
}

function applyVisualTheme() {
  const s = state.settings;
  if (s.theme === 'apple') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', s.theme || 'apple');
  document.documentElement.setAttribute('data-accent', s.accent || 'red');
}
function setAppTheme(t) { state.settings.theme = t; applyVisualTheme(); saveSettingsMeta(); }
function setAccentColor(a) { state.settings.accent = a; applyVisualTheme(); saveSettingsMeta(); }

function togglePrivacyBlur() {
  state.privacyOn = !state.privacyOn;
  document.getElementById('appShell').classList.toggle('privacy-on', state.privacyOn);
  const b = document.getElementById('drawerPrivState');
  if (b) b.textContent = state.privacyOn ? '开' : '关';
  showToast(state.privacyOn ? '已开启隐私模糊' : '已关闭隐私模糊');
}

function openSettings() {
  const s = state.settings;
  document.getElementById('cfgCoinSound').checked = s.coinSound !== false;
  document.getElementById('cfgApiKey').value = s.apiKey || '';
  document.getElementById('cfgBaseUrl').value = s.baseUrl || 'https://api.deepseek.com';
  document.getElementById('cfgFlashModel').value = s.flashModel || 'deepseek-chat';
  document.getElementById('cfgProModel').value = s.proModel || 'deepseek-reasoner';
  document.getElementById('cfgUseTier').value = s.useTier || 'flash';
  document.getElementById('cfgChatRetention').value = String(s.chatRetentionDays ?? 30);
  document.getElementById('cfgRedactNames').checked = s.redactNames !== false;
  document.getElementById('cfgMyDayPillar').value = s.myDayPillar || '';
  document.getElementById('cfgSyncUrl').value = s.syncUrl || '';
  document.getElementById('cfgVaultPass').value = s.vaultPass || '';
  document.getElementById('cfgE2eEncrypt').checked = s.e2eEncrypt !== false;
  const est = ((s.tokensIn / 1e6) * 1.5 + (s.tokensOut / 1e6) * 5).toFixed(3);
  document.getElementById('costStatsBox').textContent = `累计消耗估算：输入 ${s.tokensIn} / 输出 ${s.tokensOut} tokens（约 ¥${est}）`;
  document.getElementById('cloudSyncStatus').textContent = s.lastSyncAt ? '上次同步：' + s.lastSyncAt : '未同步云端';
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
  s.chatRetentionDays = Number(document.getElementById('cfgChatRetention').value);
  s.redactNames = document.getElementById('cfgRedactNames').checked;
  s.myDayPillar = document.getElementById('cfgMyDayPillar').value.trim();
  s.syncUrl = document.getElementById('cfgSyncUrl').value.trim();
  s.vaultPass = document.getElementById('cfgVaultPass').value.trim();
  s.e2eEncrypt = document.getElementById('cfgE2eEncrypt').checked;
  await saveSettingsMeta();
  if (!silent) { showToast('设置已保存'); if (state.mainTab === 'calendar') renderCalendarView(); }
}
