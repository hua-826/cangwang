// ==================== 藏往 V10 · 核心引擎、专业细盘与天时工具 (engine.js) ====================
const DB_NAME = 'CangwangV6DB';
const DB_VER = 2;
let dbInst = null, preparedBackupBlob = null, preparedBackupName = '', audioCtx = null;
const STORES = ['books','pdfBlobs','chapters','notes','archives','history','chats','memories','hexCache','dailyDraws','footprints','meta'];

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
function dbGet(s, id) { return new Promise((res, rej) => { const r = dbInst.transaction(s,'readonly').objectStore(s).get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbGetAll(s) { return new Promise((res, rej) => { const r = dbInst.transaction(s,'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
function dbPut(s, o) { return new Promise((res, rej) => { const r = dbInst.transaction(s,'readwrite').objectStore(s).put(o); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbDel(s, id) { return new Promise((res, rej) => { const r = dbInst.transaction(s,'readwrite').objectStore(s).delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

function playStoneSound(isSettle = false) {
  if (state.settings.coinSound === false) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  const freqs = isSettle ? [980, 1480, 2240] : [820 + Math.random() * 240, 1260 + Math.random() * 300];
  freqs.forEach((f, idx) => {
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + (isSettle ? 0.24 : 0.08));
    g.gain.setValueAtTime(isSettle ? 0.12 : 0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isSettle ? 0.26 : 0.09));
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(now + idx * 0.015); osc.stop(now + (isSettle ? 0.28 : 0.10));
  });
}

const CORE_CATS = ['六爻','八字','奇门','梅花'];
const EXTRA_CATS = ['六壬','紫微','风水'];
const CATEGORIES = [...CORE_CATS, ...EXTRA_CATS];
const BOOK_CATEGORIES = [...CATEGORIES, '其他'];

const state = {
  mainTab: 'divine', category: '六爻', extraCatsOpen: false, subTab: 'cast',
  libFilter: '全部', quickTransInput: '', quickTransBook: '', quickTransOut: '',
  studySub: 'kb', studyCat: '六爻',
  practiceMode: 'flash', flashIdx: 0, flashFlipped: false,
  blindCase: null, blindSubmitted: false, blindUserYs: '妻财', blindUserVerdict: '成', blindUserReason: '', blindAiReview: '',
  flawIdx: 0, flawCustom: null, flawUserAns: '', flawAiReview: '',
  activeArticle: null, activeArticleSource: '通用精讲',
  archCategory: '六爻', archGroup: '全部', archSearch: '',
  histFilter: '全部', histMultiMode: false, histSelected: new Set(),
  canwuRoom: '六爻', activeThreadId: null, pendingChatImg: null,
  privacyOn: false, userScrolledUp: false, isStreaming: false,
  noteSearch: '', editingNoteId: null, activeTagTipKey: '',
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(), calSelectedDate: '', calYiFilter: '',
  currentResult: null, resultLayer: 'clean', showGuaci: false, bzResTab: 'basic', bzSelDyIdx: 0, bzSelLnIdx: 0,
  showSelfJudge: false, selfVerdict: '成', selfReason: '', sameTopicHint: null,
  saveArchPickGroup: '默认',
  selectedBookIds: [], activeReportTab: 0,
  books: [], chapters: [], notes: [], archives: [], history: [], chats: [], memories: [], footprints: {}, customDict: [], customFlash: [],
  reader: { bookId: null, pdfMode: false, readMode: 'orig', pageNum: 1, loadedEndPage: 1, totalPages: 1, barsHidden: false, activeParaText: '', pdfDoc: null, batchRunning: false, ttsPlaying: false, ttsTimerId: null },
  compass: { heading: 180, locked: false, live: false, stability: '手动微调模式', year: new Date().getFullYear(), lastReadings: [] },
  settings: {
    theme: 'shuimo', coinSound: true,
    apiKey: '', baseUrl: 'https://api.deepseek.com', flashModel: 'deepseek-chat', proModel: 'deepseek-reasoner', useTier: 'flash',
    aiProfiles: [{ id: 'p_ds', name: 'DeepSeek 主力', apiKey: '', baseUrl: 'https://api.deepseek.com', flashModel: 'deepseek-chat', proModel: 'deepseek-reasoner' }],
    activeProfileId: 'p_ds',
    visionApiKey: '', visionBaseUrl: '', visionModel: '',
    extBookUrl: 'https://z-lib.gs/s/{q}',
    redactNames: true, myDayPillar: '', syncUrl: '', vaultPass: '', e2eEncrypt: true,
    fontSize: 17.5, lineHeight: 1.92, padX: 22, brightness: 100, pageMode: 'scroll', fontFam: 'serif', paper: 'warm',
    groups: ['亲人','伴侣','朋友','客户','自己'],
    weakSpots: [], articleSourceCache: {}, kbGenCache: {},
    tokensIn: 0, tokensOut: 0, dirtySinceBackup: false, lastSyncAt: ''
  }
};

function uid(p = 'id') { return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDateTimeCn(d) { const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}年${p(d.getMonth()+1)}月${p(d.getDate())}日 ${p(d.getHours())}:${p(d.getMinutes())}`; }
function yearToCnDigits(y) { return String(y).split('').map(c => '〇一二三四五六七八九'[Number(c)] || c).join(''); }
state.calSelectedDate = formatDateKey(new Date());

function showToast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600);
}
async function saveSettingsMeta() { await dbPut('meta', { id: 'settings', data: state.settings }); }
async function markDirty() { state.settings.dirtySinceBackup = true; document.getElementById('backupDot')?.classList.add('show'); await saveSettingsMeta(); }
async function markStudyFootprint() { const k = formatDateKey(new Date()); state.footprints[k] = (state.footprints[k] || 0) + 1; await dbPut('footprints', { id: k, count: state.footprints[k] }); }

function openSideDrawer() {
  document.getElementById('drawerArchCount').textContent = state.archives.length;
  document.getElementById('drawerHistCount').textContent = state.history.length;
  document.getElementById('drawerPrivState').textContent = state.privacyOn ? '开' : '关';
  document.getElementById('sideDrawerBackdrop').classList.add('open');
  document.getElementById('sideDrawer').classList.add('open');
}
function closeSideDrawer() { document.getElementById('sideDrawerBackdrop').classList.remove('open'); document.getElementById('sideDrawer').classList.remove('open'); }
function openSheet(id) {
  if (id === 'sheet-import') document.getElementById('importCatSelect').value = state.category;
  if (id === 'sheet-quick-trans') renderQuickTransSheet();
  document.getElementById(id).classList.add('open');
}
function closeSheet(id) { document.getElementById(id).classList.remove('open'); }
function backdropClose(e, id) { if (e.target.id === id) closeSheet(id); }
function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

function applyVisualTheme() {
  const t = state.settings.theme || 'shuimo';
  if (t === 'shuimo') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const bgMap = { shuimo: '#F4F2EC', jade: '#F3F5F5', night: '#111312' };
  const mc = document.getElementById('metaThemeColor');
  if (mc) mc.setAttribute('content', bgMap[t] || '#F4F2EC');
  document.getElementById('appShell')?.setAttribute('data-realm', state.mainTab === 'canwu' ? state.canwuRoom : state.category);
}
function setAppTheme(t) { state.settings.theme = t; applyVisualTheme(); saveSettingsMeta(); showToast('已切换水墨主题'); }
function togglePrivacyBlur() {
  state.privacyOn = !state.privacyOn;
  document.getElementById('appShell').classList.toggle('privacy-on', state.privacyOn);
  const b = document.getElementById('drawerPrivState'); if (b) b.textContent = state.privacyOn ? '开' : '关';
  showToast(state.privacyOn ? '已开启隐私模糊' : '已关闭隐私模糊');
}

// 顶部：核心四门不变，点「更多」露出六壬，顺着往右滑出现紫微、风水
function buildDisciplineStripHtml(activeCat, onSelectFnName) {
  const isExtraActive = EXTRA_CATS.includes(activeCat);
  const showExtra = state.extraCatsOpen || isExtraActive;
  return `
    ${CORE_CATS.map(c => `<button class="cat-pill ${c===activeCat?'active':''}" onclick="${onSelectFnName}('${c}')">${c}</button>`).join('')}
    ${showExtra ? `<span class="cat-extra-wrap"><span class="cat-divider"></span>${EXTRA_CATS.map(c => `<button class="cat-pill ${c===activeCat?'active':''}" onclick="${onSelectFnName}('${c}')">${c}</button>`).join('')}</span>` : ''}
    <button class="cat-pill more-toggle" onclick="toggleExtraCats()">${showExtra ? '‹ 收起' : '更多 ▸'}</button>
  `;
}
function toggleExtraCats() {
  state.extraCatsOpen = !state.extraCatsOpen;
  renderCatStrip(); renderCanwuRoomStrip();
  if (state.extraCatsOpen) {
    setTimeout(() => { const el = document.getElementById('catStrip'); if (el) el.scrollLeft = 72; }, 40);
  }
}
function bindCatSwipe(el) {
  if (!el || el._swipeBound) return;
  el._swipeBound = true;
  let sx = 0;
  el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (dx < -40 && !state.extraCatsOpen) { state.extraCatsOpen = true; renderCatStrip(); renderCanwuRoomStrip(); }
  }, { passive: true });
}

// ==================== 历法与命理基础常量表 ====================
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_WX = ['木','木','火','火','土','土','金','金','水','水'];
const BRANCH_WX = ['水','土','木','木','土','火','火','土','金','金','土','水'];
const HIDDEN_STEMS = { '子':'癸','丑':'己癸辛','寅':'甲丙戊','卯':'乙','辰':'戊乙癸','巳':'丙庚戊','午':'丁己','未':'己丁乙','申':'庚壬戊','酉':'辛','戌':'戊辛丁','亥':'壬甲' };
const LIU_HE = {'子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午'};
const LIU_HE_WX = {'子丑':'土','丑子':'土','寅亥':'木','亥寅':'木','卯戌':'火','戌卯':'火','辰酉':'金','酉辰':'金','巳申':'水','申巳':'水','午未':'火','未午':'火'};
const LIU_CHONG = {'子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳'};
const LIU_CHUAN = {'子':'未','未':'子','丑':'午','午':'丑','寅':'巳','巳':'寅','卯':'辰','辰':'卯','申':'亥','亥':'申','酉':'戌','戌':'酉'};
const AN_HE = ['寅丑','丑寅','午亥','亥午','卯申','申卯','巳酉','酉巳'];
const JIN_SHEN = {'亥':'子','寅':'卯','巳':'午','申':'酉','丑':'辰','辰':'未','未':'戌','戌':'丑'};
const TUI_SHEN = {'子':'亥','卯':'寅','午':'巳','酉':'申','辰':'丑','未':'辰','戌':'未','丑':'戌'};
const SAN_HE = [{ set:['申','子','辰'], wx:'水', name:'申子辰水局' },{ set:['亥','卯','未'], wx:'木', name:'亥卯未木局' },{ set:['寅','午','戌'], wx:'火', name:'寅午戌火局' },{ set:['巳','酉','丑'], wx:'金', name:'巳酉丑金局' }];
const SAN_HUI = [{ set:['寅','卯','辰'], name:'寅卯辰三会木局' },{ set:['巳','午','未'], name:'巳午未三会火局' },{ set:['申','酉','戌'], name:'申酉戌三会金局' },{ set:['亥','子','丑'], name:'亥子丑三会水局' }];
const LIU_SHEN = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
const LIU_SHEN_START = { '甲':0,'乙':0,'丙':1,'丁':1,'戊':2,'己':3,'庚':4,'辛':4,'壬':5,'癸':5 };
const CHANG_SHENG = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const CS_START = { '甲':11,'乙':6,'丙':2,'丁':9,'戊':2,'己':9,'庚':5,'辛':0,'壬':8,'癸':3 };
const NAYIN_60 = [
  '海中金','海中金','炉中火','炉中火','大林木','大林木','路旁土','路旁土','剑锋金','剑锋金',
  '山头火','山头火','涧下水','涧下水','城头土','城头土','白蜡金','白蜡金','杨柳木','杨柳木',
  '泉中水','泉中水','屋上土','屋上土','霹雳火','霹雳火','松柏木','松柏木','长流水','长流水',
  '沙中金','沙中金','山下火','山下火','平地木','平地木','壁上土','壁上土','金箔金','金箔金',
  '覆灯火','覆灯火','天河水','天河水','大驿土','大驿土','钗钏金','钗钏金','桑柘木','桑柘木',
  '大溪水','大溪水','沙中土','沙中土','天上火','天上火','石榴木','石榴木','大海水','大海水'
];
const CITIES_LON = { '北京时间 (120°E)':120.0,'重庆':106.55,'北京':116.40,'上海':121.47,'成都':104.06,'广州':113.26,'深圳':114.05,'杭州':120.15,'南京':118.79,'武汉':114.30,'西安':108.94,'天津':117.20,'苏州':120.58,'长沙':112.93,'郑州':113.62,'沈阳':123.43,'青岛':120.38,'昆明':102.71,'哈尔滨':126.53,'贵阳':106.63,'南宁':108.36,'厦门':118.08,'香港':114.17,'台北':121.56,'新加坡':103.82 };

const TRIGRAMS = {
  7:{ id:7,name:'乾',wx:'金',inner:['甲子','甲寅','甲辰'],outer:['壬午','壬申','壬戌'] },
  3:{ id:3,name:'兑',wx:'金',inner:['丁巳','丁卯','丁丑'],outer:['丁亥','丁酉','丁未'] },
  5:{ id:5,name:'离',wx:'火',inner:['己卯','己丑','己亥'],outer:['己酉','己未','己巳'] },
  1:{ id:1,name:'震',wx:'木',inner:['庚子','庚寅','庚辰'],outer:['庚午','庚申','庚戌'] },
  6:{ id:6,name:'巽',wx:'木',inner:['辛丑','辛亥','辛酉'],outer:['辛未','辛巳','辛卯'] },
  2:{ id:2,name:'坎',wx:'水',inner:['戊寅','戊辰','戊午'],outer:['戊申','戊戌','戊子'] },
  4:{ id:4,name:'艮',wx:'土',inner:['丙辰','丙午','丙申'],outer:['丙戌','丙子','丙寅'] },
  0:{ id:0,name:'坤',wx:'土',inner:['乙未','乙巳','乙卯'],outer:['乙丑','乙亥','乙酉'] }
};
const NUM_TO_TRI = { 1:7, 2:3, 3:5, 4:1, 5:6, 6:2, 7:4, 0:0, 8:0 };
const PALACE_ORDER = [7, 2, 4, 1, 6, 5, 0, 3];
const PALACE_GEN_NAMES = ['本宫','一世','二世','三世','四世','五世','游魂','归魂'];

const HEX_DICT = {
  '7_7':[1,'乾为天','元亨利贞。刚健中正，自强不息，利大局开创。'],'0_0':[2,'坤为地','元亨，利牝马之贞。厚德载物，顺势承接，先迷后得。'],
  '2_1':[3,'水雷屯','元亨利贞，勿用有攸往。万事开头难，宜积蓄建侯。'],'4_2':[4,'山水蒙','亨，匪我求童蒙，童蒙求我。启蒙明理，宜师承求教。'],
  '2_7':[5,'水天需','有孚，光亨，贞吉。时机未熟，耐心待时，不可冒进。'],'7_2':[6,'天水讼','有孚窒惕，中吉终凶。意见相左，宜和解止讼。'],
  '0_2':[7,'地水师','贞，丈人吉，无咎。统率有序，以正领众，纪律为先。'],'2_0':[8,'水地比','吉，原筮元永贞。亲比协作，择善而从，不宜迟疑。'],
  '6_7':[9,'风天小畜','亨，密云不雨。力量尚微，宜小蓄积淀，等待透雨。'],'7_3':[10,'天泽履','履虎尾，不咥人，亨。谨守礼法，步步为营可化险。'],
  '0_7':[11,'地天泰','小往大来，吉亨。天地交泰，上下通畅，诸事顺遂。'],'7_0':[12,'天地否','否之匪人，不利君子贞。上下闭塞，宜守正敛锋待转机。'],
  '7_5':[13,'天火同人','同人于野，亨。志同道合，公心协作，利远行谋事。'],'5_7':[14,'火天大有','元亨。光明普照，丰盛大有，宜戒满守谦。'],
  '0_4':[15,'地山谦','亨，君子有终。谦逊低调，有实力而不张扬，终获吉果。'],'1_0':[16,'雷地豫','利建侯行师。顺动欢豫，宜提前筹谋，防逸乐失警。'],
  '3_1':[17,'泽雷随','元亨利贞，无咎。审时度势，随顺正道而行。'],'4_6':[18,'山风蛊','元亨，利涉大川。积弊已久，当果断革新整顿。'],
  '0_3':[19,'地泽临','元亨利贞。势头渐盛，亲临督导，居安思危。'],'6_0':[20,'风地观','盥而不荐，有孚颙若。冷静观察全局，示范引导。'],
  '5_1':[21,'火雷噬嗑','亨，利用狱。中间有梗阻，须明断去障方通。'],'4_5':[22,'山火贲','亨，小利有攸往。文饰修容，宜重实质莫流于浮华。'],
  '4_0':[23,'山地剥','不利有攸往。阳微阴盛，顺时止损，静待复生。'],'0_1':[24,'地雷复','亨，出入无疾。一阳来复，转机初现，宜休养生息。'],
  '7_1':[25,'天雷无妄','元亨利贞。顺应天理不妄为，真诚守正则吉。'],'4_7':[26,'山天大畜','利贞，不家食吉。厚积薄发，养德蓄才以待大用。'],
  '4_1':[27,'山雷颐','贞吉，观颐。谨言慎食，修养身心与谋生之道。'],'3_6':[28,'泽风大过','栋桡，利有攸往。压力过载，须非常之策方能度过。'],
  '2_2':[29,'坎为水','习坎，有孚，维心亨。重重险阻，守信定心行有尚。'],'5_5':[30,'离为火','利贞，亨。光明依附正道，柔顺中正而大明。'],
  '3_4':[31,'泽山咸','亨，利贞，取女吉。虚心感应，心意相通，感情顺合。'],'1_6':[32,'雷风恒','亨，无咎，利贞。恒久坚持正道，稳扎稳打。'],
  '7_4':[33,'天山遁','亨，小利贞。退避锋芒，知止抽身反得主动。'],'1_7':[34,'雷天大壮','利贞。阳刚强盛，切忌莽撞冲动，以礼节之。'],
  '5_0':[35,'火地晋','康侯用锡马蕃庶。日出地上，步步高升，顺明进取。'],'0_5':[36,'地火明夷','利艰贞。光明受损，宜韬光养晦、隐忍自保。'],
  '6_5':[37,'风火家人','利女贞。内治有序，家道和睦则外事可成。'],'5_3':[38,'火泽睽','小事吉。志趣乖违，求同存异，小事可为大事慎。'],
  '2_4':[39,'水山蹇','利西南，不利东北。前有险阻，宜借贵人绕道而行。'],'1_2':[40,'雷水解','利西南，无所往其来复吉。险难消解，宜速清余患回归常态。'],
  '4_3':[41,'山泽损','有孚，元吉，无咎。损下益上，先舍后得，诚敬为本。'],'6_1':[42,'风雷益','利有攸往，利涉大川。损上益下，助人利己，宜果断推进。'],
  '3_7':[43,'泽天夬','扬于王庭，孚号有厉。决断除弊，刚中带柔防反扑。'],'7_6':[44,'天风姤','女壮，勿用取女。不期而遇，防微杜渐，慎防暗耗。'],
  '3_0':[45,'泽地萃','亨，王假有庙。人才资源聚集，宜防内耗与突发变故。'],'0_6':[46,'地风升','元亨，用见大人。积小成大，顺势而升，得贵人扶助。'],
  '3_2':[47,'泽水困','亨，贞大人吉。陷入困境，言多无益，守正静待破局。'],'2_6':[48,'水风井','改邑不改井。资源恒常，重在修浚维护、润泽长久。'],
  '3_5':[49,'泽火革','巳日乃孚，元亨利贞。革故鼎新，时机成熟乃可大变。'],'5_6':[50,'火风鼎','元吉，亨。稳重鼎新，凝聚合力，成就新格局。'],
  '1_1':[51,'震为雷','亨，震来虩虩，笑言哑哑。突发震动，戒惧应对反得安宁。'],'4_4':[52,'艮为山','艮其背，不获其身。该止则止，定心守位不妄动。'],
  '6_4':[53,'风山渐','女归吉，利贞。循序渐进，戒急戒躁，步步稳成。'],'1_3':[54,'雷泽归妹','征凶，无攸利。名分未正或急于求成，宜守分度。'],
  '1_5':[55,'雷火丰','亨，王假之，勿忧。盛大丰盈，防盛极而衰。'],'5_4':[56,'火山旅','小亨，旅贞吉。客居飘泊之象，柔顺谨慎，小事可成。'],
  '6_6':[57,'巽为风','小亨，利有攸往。谦逊渗入，反复沟通，借势而行。'],'3_3':[58,'兑为泽','亨，利贞。和悦沟通，以诚相交，防口舌是非。'],
  '6_2':[59,'风水涣','亨，王假有庙。涣散离析，宜凝聚人心、化冰解结。'],'2_3':[60,'水泽节','亨，苦节不可贞。适度节制有度，过犹不及。'],
  '6_3':[61,'风泽中孚','豚鱼吉，利涉大川。诚信感通，由衷相待则无往不利。'],'1_4':[62,'雷山小过','亨，利贞，可小事不可大事。宜谦恭小步，不宜强求大局。'],
  '2_5':[63,'水火既济','亨小，利贞，初吉终乱。功成圆满，须防松懈生变。'],'5_2':[64,'火水未济','亨，小狐汔济，濡其尾。尚未收官，最后关头尤需谨慎。']
};

const HEX_DATA = (() => {
  const list = [], byKey = {};
  PALACE_ORDER.forEach(p => {
    const pTri = TRIGRAMS[p];
    let bits = [p & 1, (p >> 1) & 1, (p >> 2) & 1, p & 1, (p >> 1) & 1, (p >> 2) & 1];
    for (let g = 0; g < 8; g++) {
      if (g >= 1 && g <= 5) bits[g - 1] ^= 1;
      else if (g === 6) bits[3] ^= 1;
      else if (g === 7) { bits[0] = p & 1; bits[1] = (p >> 1) & 1; bits[2] = (p >> 2) & 1; }
      const lower = bits[0] + (bits[1] << 1) + (bits[2] << 2), upper = bits[3] + (bits[4] << 1) + (bits[5] << 2);
      const key = upper + '_' + lower, meta = HEX_DICT[key] || [0, '未知卦', ''];
      const shi = [6,1,2,3,4,5,4,3][g], ying = ((shi + 2) % 6) + 1;
      const item = { key, upper, lower, seq: meta[0], name: meta[1], guaci: meta[2], bits: [...bits], palaceId: p, palaceName: pTri.name + '宫', palaceWx: pTri.wx, genIndex: g, genName: PALACE_GEN_NAMES[g], shi, ying };
      list.push(item); byKey[key] = item;
    }
  });
  return { list, byKey };
})();

function getGzIndex60(gz) {
  const s = STEMS.indexOf(gz[0]), b = BRANCHES.indexOf(gz[1]);
  if (s < 0 || b < 0) return 0;
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  return 0;
}
function getNaYin(gz) { return NAYIN_60[getGzIndex60(gz)] || ''; }
function getXunKongOfGz(gz) {
  const s = STEMS.indexOf(gz[0]), b = BRANCHES.indexOf(gz[1]);
  if (s < 0 || b < 0) return '';
  const k1 = (b - s + 22) % 12;
  return BRANCHES[k1] + BRANCHES[(k1 + 1) % 12];
}
function getXunShouOfGz(gz) {
  const s = STEMS.indexOf(gz[0]), b = BRANCHES.indexOf(gz[1]);
  if (s < 0 || b < 0) return '';
  return '甲' + BRANCHES[(b - s + 12) % 12];
}
function getChangSheng(stem, branch) {
  const st = CS_START[stem], b = BRANCHES.indexOf(branch);
  if (st == null || b < 0) return '';
  const isYang = STEMS.indexOf(stem) % 2 === 0;
  const idx = isYang ? (b - st + 12) % 12 : (st - b + 12) % 12;
  return CHANG_SHENG[idx];
}
function getLiuQin(pWx, lWx) {
  const r = { '木':{'木':'兄弟','火':'子孙','土':'妻财','金':'官鬼','水':'父母'}, '火':{'火':'兄弟','土':'子孙','金':'妻财','水':'官鬼','木':'父母'}, '土':{'土':'兄弟','金':'子孙','水':'妻财','木':'官鬼','火':'父母'}, '金':{'金':'兄弟','水':'子孙','木':'妻财','火':'官鬼','土':'父母'}, '水':{'水':'兄弟','木':'子孙','火':'妻财','土':'官鬼','金':'父母'} };
  return r[pWx]?.[lWx] || '';
}
function getTenGod(ds, os) {
  const d = STEMS.indexOf(ds), o = STEMS.indexOf(os); if (d < 0 || o < 0) return '';
  return [['比肩','劫财'],['食神','伤官'],['偏财','正财'],['七杀','正官'],['偏印','正印']][(Math.floor(o/2) - Math.floor(d/2) + 5) % 5][(d%2)===(o%2)?0:1];
}
function getShortTenGod(tg) {
  return { '比肩':'比','劫财':'劫','食神':'食','伤官':'伤','偏财':'才','正财':'财','七杀':'杀','正官':'官','偏印':'枭','正印':'印','元男':'元','元女':'元' }[tg] || tg;
}
function getWxRelation(a, b) {
  const o = ['木','火','土','金','水'], i1 = o.indexOf(a), i2 = o.indexOf(b);
  return (i1 < 0 || i2 < 0) ? '' : ['比和','生','克','被克','被生'][(i2 - i1 + 5) % 5];
}
function getHexLinesDetail(hex) {
  const najia = [...TRIGRAMS[hex.lower].inner, ...TRIGRAMS[hex.upper].outer];
  const pHead = HEX_DATA.byKey[hex.palaceId + '_' + hex.palaceId];
  const headNajia = [...TRIGRAMS[pHead.lower].inner, ...TRIGRAMS[pHead.upper].outer];
  const present = new Set();
  const lines = hex.bits.map((b, i) => {
    const gz = najia[i], br = gz[1], wx = BRANCH_WX[BRANCHES.indexOf(br)], lq = getLiuQin(hex.palaceWx, wx);
    present.add(lq);
    return { pos: i + 1, bit: b, gz, branch: br, wx, liuqin: lq, isShi: hex.shi === i + 1, isYing: hex.ying === i + 1, fushen: null };
  });
  ['父母','兄弟','子孙','妻财','官鬼'].forEach(need => {
    if (!present.has(need)) headNajia.forEach((hgz, i) => { const hbr = hgz[1], hwx = BRANCH_WX[BRANCHES.indexOf(hbr)]; if (getLiuQin(hex.palaceWx, hwx) === need) lines[i].fushen = { liuqin: need, branch: hbr, wx: hwx, label: need + hbr + hwx }; });
  });
  return lines;
}
function getShenSha(ds, db) {
  return [
    { k:'天乙', v:{'甲':'丑未','戊':'丑未','庚':'丑未','乙':'子申','己':'子申','丙':'亥酉','丁':'亥酉','壬':'卯巳','癸':'卯巳','辛':'午寅'}[ds]||'' },
    { k:'禄神', v:{'甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子'}[ds]||'' },
    { k:'文昌', v:{'甲':'巳','乙':'午','丙':'申','丁':'酉','戊':'申','己':'酉','庚':'亥','辛':'子','壬':'寅','癸':'卯'}[ds]||'' },
    { k:'驿马', v:{'申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳'}[db]||'' }
  ];
}
function calcTrueSolarDate(dateObj, lon) {
  if (!lon || Math.abs(lon - 120) < 0.01) return dateObj;
  const doy = Math.floor((dateObj - new Date(dateObj.getFullYear(), 0, 1)) / 86400000) + 1;
  const B = 2 * Math.PI * (doy - 81) / 365;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  return new Date(dateObj.getTime() + ((lon - 120) * 4 + eot) * 60000);
}
function getZodiacSign(m, d) {
  const arr = ['摩羯座','水瓶座','双鱼座','白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座'];
  const cut = [20,19,21,20,21,22,23,23,23,24,23,22];
  return arr[d < cut[m - 1] ? m - 1 : m];
}
function getAstroDayInfo(dateObj) {
  const y = dateObj.getFullYear(), m = dateObj.getMonth() + 1, d = dateObj.getDate(), h = dateObj.getHours(), min = dateObj.getMinutes();
  const makeP = gz => ({ gz, s: gz[0], b: gz[1], swx: STEM_WX[STEMS.indexOf(gz[0])] || '土', bwx: BRANCH_WX[BRANCHES.indexOf(gz[1])] || '土' });
  if (typeof window.Solar !== 'undefined') {
    const solar = window.Solar.fromYmdHms(y, m, d, h, min, 0), lunar = solar.getLunar(), ec = lunar.getEightChar();
    const dp = makeP(ec.getDay()), hp = makeP(ec.getTime()), jieqi = lunar.getJieQi() || '';
    const lunarFull = `${yearToCnDigits(lunar.getYear())}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${hp.b}时`;
    const lunarDayShort = lunar.getDayInChinese() === '初一' ? (lunar.getMonthInChinese() + '月') : lunar.getDayInChinese();
    return {
      year: makeP(ec.getYear()), month: makeP(ec.getMonth()), day: dp, hour: hp,
      xunkong: lunar.getDayXunKong(),
      lunarStr: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      lunarFull, lunarDayShort, jieqi,
      shengxiao: lunar.getYearShengXiao ? lunar.getYearShengXiao() : '',
      xiu: lunar.getXiu ? `${lunar.getXiu()}宿(${lunar.getGong ? lunar.getGong() : ''}${lunar.getShou ? lunar.getShou() : ''})` : '',
      yi: lunar.getDayYi() || [], ji: lunar.getDayJi() || [],
      chong: lunar.getDayChongDesc ? lunar.getDayChongDesc() : ('冲' + LIU_CHONG[dp.b]),
      _lunar: lunar, _solar: solar, _ec: ec
    };
  }
  const dIdx = ((40 + Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 10, 26)) / 86400000)) % 60 + 60) % 60;
  const dS = dIdx % 10, dB = dIdx % 12, yIdx = ((((m === 1 || (m === 2 && d < 4)) ? y - 1 : y) - 4) % 60 + 60) % 60;
  const yS = yIdx % 10, yB = yIdx % 12;
  let mOff = 10; [[1,6,11],[2,4,0],[3,6,1],[4,5,2],[5,6,3],[6,6,4],[7,7,5],[8,8,6],[9,8,7],[10,8,8],[11,7,9],[12,7,10]].forEach(([jm,jd,off]) => { if (m > jm || (m === jm && d >= jd)) mOff = off; });
  const mB = (2 + mOff) % 12, mS = ([2,4,6,8,0][yS % 5] + mOff) % 10, hB = Math.floor(((h + 1) % 24) / 2), hS = ([0,2,4,6,8][dS % 5] + hB) % 10;
  const k1 = (dB - dS + 22) % 12, dp = makeP(STEMS[dS] + BRANCHES[dB]), hp = makeP(STEMS[hS] + BRANCHES[hB]);
  return {
    year: makeP(STEMS[yS]+BRANCHES[yB]), month: makeP(STEMS[mS]+BRANCHES[mB]), day: dp, hour: hp,
    xunkong: BRANCHES[k1]+BRANCHES[(k1+1)%12], lunarStr: '', lunarFull: `${yearToCnDigits(y)}年 ${hp.b}时`, lunarDayShort: '', jieqi: '',
    shengxiao: '鼠牛虎兔龙蛇马羊猴鸡狗猪'[yB], xiu: '', yi: ['祈福','出行','交易'], ji: ['动土'], chong: '冲'+LIU_CHONG[dp.b]
  };
}

// ==================== 六爻硬核体检（升级：补齐爻间冲合生克与动变进退） ====================
const POS_CN = ['','初爻','二爻','三爻','四爻','五爻','上爻'];
function runLiuyaoPhysicalExam(mainHex, movingSet, monthBranch, dayBranch, xunkong) {
  const lines = getHexLinesDetail(mainHex), mWx = BRANCH_WX[BRANCHES.indexOf(monthBranch)], dWx = BRANCH_WX[BRANCHES.indexOf(dayBranch)];
  let bianHex = null, bianLines = null;
  if (movingSet.size > 0) {
    const bBits = mainHex.bits.map((b, i) => movingSet.has(i + 1) ? (b ^ 1) : b);
    bianHex = HEX_DATA.byKey[(bBits[3]+(bBits[4]<<1)+(bBits[5]<<2)) + '_' + (bBits[0]+(bBits[1]<<1)+(bBits[2]<<2))];
    bianLines = getHexLinesDetail(bianHex);
  }
  const activeBranches = new Set([monthBranch, dayBranch]);
  const examRows = lines.map((ln, i) => {
    const isMov = movingSet.has(ln.pos), bLn = bianLines ? bianLines[i] : null;
    if (isMov) { activeBranches.add(ln.branch); if (bLn) activeBranches.add(bLn.branch); }
    const tags = [], relTags = [];
    const mRel = getWxRelation(mWx, ln.wx), dRel = getWxRelation(dWx, ln.wx);
    const isStrongInMonth = (ln.branch === monthBranch || mRel === '生' || mRel === '比和');
    let isDarkMov = false;

    if (ln.branch === monthBranch) tags.push('临月建');
    else if (LIU_CHONG[monthBranch] === ln.branch) tags.push('月破');
    else if (LIU_HE[monthBranch] === ln.branch) tags.push('月合');
    else if (mRel === '生' || mRel === '比和') tags.push('月旺');
    else if (mRel === '克') tags.push('月克');
    else tags.push('月休囚');

    if (ln.branch === dayBranch) tags.push('临日辰');
    else if (LIU_CHONG[dayBranch] === ln.branch) {
      if (isStrongInMonth) { tags.push('暗动'); isDarkMov = true; activeBranches.add(ln.branch); }
      else tags.push('日破');
    } else if (LIU_HE[dayBranch] === ln.branch) tags.push('日合');
    else if (dRel === '生') tags.push('日生');
    else if (dRel === '克') tags.push('日克');

    const isKong = xunkong.includes(ln.branch);
    if (isKong) tags.push('旬空');

    if (isMov && bLn) {
      if (JIN_SHEN[ln.branch] === bLn.branch) tags.push('化进神');
      else if (TUI_SHEN[ln.branch] === bLn.branch) tags.push('化退神');
      else {
        const bRel = getWxRelation(bLn.wx, ln.wx);
        if (bRel === '生') tags.push('回头生');
        else if (bRel === '克') tags.push('回头克');
        if (LIU_CHONG[ln.branch] === bLn.branch) tags.push('反吟冲');
        if (LIU_HE[ln.branch] === bLn.branch) tags.push('化合');
      }
      if (xunkong.includes(bLn.branch)) tags.push('化空');
    }
    if (ln.fushen) tags.push(`伏${ln.fushen.label}`);
    return { ...ln, isMov, isDarkMov, isKong, bian: bLn, tags, relTags };
  });

  // 计算爻与爻之间的直接生克冲合（优先标明动爻/暗动爻去作用他爻，以及静爻间显着冲合）
  examRows.forEach(src => {
    const canAct = src.isMov || src.isDarkMov;
    examRows.forEach(dst => {
      if (src.pos === dst.pos) return;
      if (LIU_CHONG[src.branch] === dst.branch) {
        if (canAct) { src.relTags.push(`冲${POS_CN[dst.pos]}`); dst.relTags.push(`受${POS_CN[src.pos]}冲`); }
        else if (src.pos < dst.pos) { src.relTags.push(`与${POS_CN[dst.pos]}相冲`); dst.relTags.push(`与${POS_CN[src.pos]}相冲`); }
      } else if (LIU_HE[src.branch] === dst.branch) {
        if (canAct) { src.relTags.push(`合${POS_CN[dst.pos]}`); dst.relTags.push(`与${POS_CN[src.pos]}相合`); }
        else if (src.pos < dst.pos) { src.relTags.push(`与${POS_CN[dst.pos]}相合`); dst.relTags.push(`与${POS_CN[src.pos]}相合`); }
      }
      if (canAct) {
        const rel = getWxRelation(src.wx, dst.wx);
        if (rel === '生') { src.relTags.push(`生${POS_CN[dst.pos]}`); dst.relTags.push(`得${POS_CN[src.pos]}生`); }
        else if (rel === '克') { src.relTags.push(`克${POS_CN[dst.pos]}`); dst.relTags.push(`受${POS_CN[src.pos]}克`); }
      }
    });
  });

  const sanheHits = [];
  SAN_HE.forEach(g => {
    const m = g.set.filter(br => activeBranches.has(br));
    if (m.length === 3) sanheHits.push(`成${g.name}`);
    else if (m.length === 2) sanheHits.push(`半合${g.name}(待${g.set.find(x => !m.includes(x))})`);
  });
  return { bianHex, examRows, sanheHits };
}

function buildRulerInsightText(examRows, simM, simD, origXunkong) {
  const notes = [];
  examRows.forEach(r => {
    const nm = `${POS_CN[r.pos]}${r.liuqin}${r.branch}`;
    if (origXunkong.includes(r.branch) && r.branch === simD) notes.push(`${simD}日填实${nm}(出空应事)`);
    else if (origXunkong.includes(r.branch) && LIU_CHONG[simD] === r.branch) notes.push(`${simD}日冲实旬空${nm}`);
    if (r.isMov && LIU_HE[simD] === r.branch) notes.push(`${simD}日合住动爻${nm}(动而逢合)`);
    if (!r.isMov && LIU_CHONG[simD] === r.branch) notes.push(`${simD}日冲起静爻${nm}`);
    if (LIU_CHONG[simM] === r.branch) notes.push(`${simM}月令冲破${nm}`);
  });
  return notes.length ? `模拟【${simM}月 · ${simD}日】动态触发：${notes.slice(0, 4).join('；')}。` : `模拟【${simM}月 · ${simD}日】：盘面气场平稳流转，无剧烈填实或冲合触发。`;
}

// ==================== 全门类公历 / 农历双切换时间选择器 ====================
const dtPicker = { targetKey: 'lyDate', mode: 'solar', y: 2026, m: 11, d: 27, h: 12, min: 0 };
const LUNAR_M_NAMES = ['','正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
const LUNAR_D_NAMES = ['','初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

function openDtPicker(targetKey) {
  dtPicker.targetKey = targetKey;
  const rawVal = castState[targetKey] || getNowDatetimeLocal();
  const dt = rawVal ? new Date(rawVal) : new Date();
  dtPicker.mode = 'solar';
  dtPicker.y = dt.getFullYear(); dtPicker.m = dt.getMonth() + 1; dtPicker.d = dt.getDate(); dtPicker.h = dt.getHours(); dtPicker.min = dt.getMinutes();
  renderDtPickerSelectors();
  openSheet('sheet-dt-picker');
}
function setDtPickerMode(mode) {
  if (dtPicker.mode === mode) return;
  const curSolar = resolveDtPickerToDate();
  dtPicker.mode = mode;
  if (mode === 'lunar' && typeof window.Solar !== 'undefined') {
    const l = window.Solar.fromYmdHms(curSolar.getFullYear(), curSolar.getMonth()+1, curSolar.getDate(), curSolar.getHours(), curSolar.getMinutes(), 0).getLunar();
    dtPicker.y = l.getYear(); dtPicker.m = l.getMonth(); dtPicker.d = l.getDay();
  } else {
    dtPicker.y = curSolar.getFullYear(); dtPicker.m = curSolar.getMonth() + 1; dtPicker.d = curSolar.getDate();
  }
  renderDtPickerSelectors();
}
function dtPickerSetNow() {
  const n = new Date();
  dtPicker.mode = 'solar';
  dtPicker.y = n.getFullYear(); dtPicker.m = n.getMonth() + 1; dtPicker.d = n.getDate(); dtPicker.h = n.getHours(); dtPicker.min = n.getMinutes();
  renderDtPickerSelectors();
}
function renderDtPickerSelectors() {
  document.getElementById('dtModeSolarBtn').classList.toggle('active', dtPicker.mode === 'solar');
  document.getElementById('dtModeLunarBtn').classList.toggle('active', dtPicker.mode === 'lunar');
  const ySel = document.getElementById('dtSelYear'), hSel = document.getElementById('dtSelHour'), minSel = document.getElementById('dtSelMin');
  let yHtml = ''; for (let y = 1930; y <= 2050; y++) yHtml += `<option value="${y}" ${y===dtPicker.y?'selected':''}>${y}年</option>`;
  ySel.innerHTML = yHtml;
  let hHtml = ''; for (let h = 0; h < 24; h++) hHtml += `<option value="${h}" ${h===dtPicker.h?'selected':''}>${String(h).padStart(2,'0')}时</option>`;
  hSel.innerHTML = hHtml;
  let mnHtml = ''; for (let mn = 0; mn < 60; mn++) mnHtml += `<option value="${mn}" ${mn===dtPicker.min?'selected':''}>${String(mn).padStart(2,'0')}分</option>`;
  minSel.innerHTML = mnHtml;
  refreshDtPickerMonthsAndDays();
}
function refreshDtPickerMonthsAndDays() {
  const y = Number(document.getElementById('dtSelYear').value) || dtPicker.y;
  dtPicker.y = y;
  const mSel = document.getElementById('dtSelMonth');
  if (dtPicker.mode === 'lunar' && typeof window.LunarYear !== 'undefined') {
    const ly = window.LunarYear.fromYear(y), ms = ly.getMonths().filter(x => x.getYear() === y);
    mSel.innerHTML = ms.map(x => {
      const mv = x.getMonth(), lbl = mv < 0 ? ('闰' + LUNAR_M_NAMES[Math.abs(mv)]) : LUNAR_M_NAMES[mv];
      return `<option value="${mv}" ${mv===dtPicker.m?'selected':''}>${lbl}</option>`;
    }).join('');
  } else {
    let mHtml = ''; for (let m = 1; m <= 12; m++) mHtml += `<option value="${m}" ${m===Math.abs(dtPicker.m)?'selected':''}>${m}月</option>`;
    mSel.innerHTML = mHtml;
  }
  refreshDtPickerDays(true);
}
function refreshDtPickerDays(skipMonthRebuild = false) {
  const y = Number(document.getElementById('dtSelYear').value) || dtPicker.y;
  if (!skipMonthRebuild && y !== dtPicker.y) { refreshDtPickerMonthsAndDays(); return; }
  const m = Number(document.getElementById('dtSelMonth').value) || 1;
  dtPicker.m = m;
  const dSel = document.getElementById('dtSelDay');
  let maxD = 30;
  if (dtPicker.mode === 'lunar' && typeof window.LunarMonth !== 'undefined') {
    const lm = window.LunarMonth.fromYm(y, m);
    maxD = lm ? lm.getDayCount() : 30;
  } else {
    maxD = new Date(y, m, 0).getDate();
  }
  const curD = Math.min(dtPicker.d || 1, maxD);
  let dHtml = '';
  for (let d = 1; d <= maxD; d++) dHtml += `<option value="${d}" ${d===curD?'selected':''}>${dtPicker.mode==='lunar'?(LUNAR_D_NAMES[d]||d+'日'):(d+'日')}</option>`;
  dSel.innerHTML = dHtml;
  updateDtPickerPreview();
}
function resolveDtPickerToDate() {
  const y = Number(document.getElementById('dtSelYear')?.value) || dtPicker.y;
  const m = Number(document.getElementById('dtSelMonth')?.value) || dtPicker.m;
  const d = Number(document.getElementById('dtSelDay')?.value) || dtPicker.d;
  const h = Number(document.getElementById('dtSelHour')?.value) || 0;
  const mn = Number(document.getElementById('dtSelMin')?.value) || 0;
  if (dtPicker.mode === 'lunar' && typeof window.Lunar !== 'undefined') {
    try {
      const s = window.Lunar.fromYmdHms(y, m, d, h, mn, 0).getSolar();
      return new Date(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), 0);
    } catch (e) {}
  }
  return new Date(y, Math.max(0, Math.abs(m) - 1), d, h, mn, 0);
}
function updateDtPickerPreview() {
  const dt = resolveDtPickerToDate(), info = getAstroDayInfo(dt);
  const el = document.getElementById('dtPickerPreview');
  if (el) el.textContent = `公历 ${formatDateTimeCn(dt)} · 农历${info.lunarStr || ''} (${info.day.gz}日)`;
}
function confirmDtPicker() {
  const dt = resolveDtPickerToDate(), p = n => String(n).padStart(2,'0');
  const val = `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
  const k = dtPicker.targetKey;
  castState[k] = val;
  if (k === 'lyDate') castState.lyDateManual = true;
  if (k === 'qmDate') castState.qmDateManual = true;
  if (k === 'mhDate') castState.mhDateManual = true;
  if (k === 'lrDate') castState.lrDateManual = true;
  closeSheet('sheet-dt-picker');
  renderDivineView();
}
function renderTimeRowDisplay(dateStr, manualFlagKey) {
  if (!dateStr) return `<span style="color:var(--text-3);">选填（公历 / 农历）</span>`;
  const dt = new Date(dateStr), info = getAstroDayInfo(dt);
  return `<span class="cal-type-tag">公/农</span><span>${formatDateTimeCn(dt)}</span>`;
}

// ==================== 独立排盘历史记录（永久留存、多选全选、独立于档案库） ====================
async function recordToHistory(rec) {
  const copy = JSON.parse(JSON.stringify(rec));
  copy.id = uid('hist');
  copy.histCreatedAt = Date.now();
  await dbPut('history', copy);
  state.history.unshift(copy);
  await markDirty();
}
function openHistoryOverlay() {
  state.histMultiMode = false; state.histSelected = new Set();
  renderHistoryView(); openOverlay('historyOverlay');
}
function toggleHistoryMultiMode() {
  state.histMultiMode = !state.histMultiMode; state.histSelected = new Set();
  renderHistoryView();
}
function renderHistoryView() {
  const multiBtn = document.getElementById('histMultiBtn'), delBtn = document.getElementById('histBatchDelBtn');
  if (multiBtn) multiBtn.textContent = state.histMultiMode ? '取消多选' : '多选';
  if (delBtn) { delBtn.style.display = state.histMultiMode ? 'inline-flex' : 'none'; delBtn.textContent = `删所选(${state.histSelected.size})`; }
  document.getElementById('histFilterStrip').innerHTML = ['全部', ...CATEGORIES].map(c => `<button class="cat-pill ${state.histFilter===c?'active':''}" onclick="state.histFilter='${c}';renderHistoryView()">${c}</button>`).join('');
  const list = state.history.filter(h => state.histFilter === '全部' || h.category === state.histFilter).sort((a,b) => (b.histCreatedAt || b.createdAt) - (a.histCreatedAt || a.createdAt));
  const wrap = document.getElementById('historyScrollArea');
  if (!list.length) {
    wrap.innerHTML = `<div class="empty-box"><p>暂无排盘历史记录<br/>每次起卦排盘都会自动保存在这里，不设条数上限，除非你手动清理；删除历史记录绝不影响已存入「实战档案库」的卷宗。</p></div>`;
    return;
  }
  const topBar = state.histMultiMode ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><button class="chip accent" onclick="selectAllVisibleHistory()">全选当前 (${list.length})</button><button class="chip" onclick="state.histSelected.clear();renderHistoryView()">取消全选</button></div>` : `<div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">共 ${list.length} 条排盘记录 · 与档案库完全独立，删历史不影响档案</div>`;
  wrap.innerHTML = topBar + list.map(h => {
    const chk = state.histSelected.has(h.id);
    return `<div class="card" style="padding:13px 15px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="${state.histMultiMode ? `toggleHistItemSelect('${h.id}')` : `openHistoryRecord('${h.id}')`}">
      ${state.histMultiMode ? `<input type="checkbox" ${chk?'checked':''} style="width:18px;height:18px;accent-color:var(--seal);flex-shrink:0;" onclick="event.stopPropagation();toggleHistItemSelect('${h.id}')" />` : ''}
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span class="pill-mini xs accent">${escapeHtml(h.category)}</span>
          <strong class="priv-blur" style="font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(h.title)}</strong>
        </div>
        <div style="font-size:12px;color:var(--text-3);">${escapeHtml(h.castTimeStr || '')} ${h.lunarFull ? '· ' + h.lunarFull : ''}</div>
      </div>
      ${!state.histMultiMode ? `<button class="pill-mini xs" style="color:var(--text-3);" onclick="event.stopPropagation();deleteSingleHistory('${h.id}')">删</button>` : ''}
    </div>`;
  }).join('');
}
function toggleHistItemSelect(id) { if (state.histSelected.has(id)) state.histSelected.delete(id); else state.histSelected.add(id); renderHistoryView(); }
function selectAllVisibleHistory() {
  state.history.filter(h => state.histFilter === '全部' || h.category === state.histFilter).forEach(h => state.histSelected.add(h.id));
  renderHistoryView();
}
async function deleteSingleHistory(id) {
  await dbDel('history', id);
  state.history = state.history.filter(h => h.id !== id);
  await markDirty(); renderHistoryView(); showToast('已从历史记录移除（档案库不受影响）');
}
async function deleteSelectedHistory() {
  if (!state.histSelected.size) return showToast('请先勾选要清理的记录');
  if (!confirm(`确定删除勾选的 ${state.histSelected.size} 条历史记录？（已存入档案库的内容完好无损）`)) return;
  for (const id of state.histSelected) await dbDel('history', id);
  state.history = state.history.filter(h => !state.histSelected.has(h.id));
  state.histSelected.clear(); state.histMultiMode = false;
  await markDirty(); renderHistoryView(); showToast('已批量清理所选历史记录');
}
function openHistoryRecord(id) {
  const h = state.history.find(x => x.id === id); if (!h) return;
  closeOverlay('historyOverlay');
  const rec = JSON.parse(JSON.stringify(h)); rec.id = uid('arc');
  if (rec.category === '六爻') openLiuyaoResult(rec, true); else openGenericResult(rec, true);
}

// 检测近 3 天同题重占（「初筮告，再三渎」温和轻提醒）
function findRecentSimilarCast(category, questionText) {
  const q = (questionText || '').trim(); if (q.length < 3) return null;
  const threeDaysAgo = Date.now() - 3 * 86400000;
  const tokens = q.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  if (tokens.length < 3) return null;
  return state.history.find(h => {
    if (h.category !== category || (h.histCreatedAt || h.createdAt) < threeDaysAgo) return false;
    const ht = (h.title || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    if (!ht || ht.length < 3) return false;
    let match = 0; for (const ch of new Set(tokens)) if (ht.includes(ch)) match++;
    return match >= Math.max(3, Math.ceil(tokens.length * 0.55));
  }) || null;
}

// ==================== 万年干支历（三行紧凑格子 + 修复「搬家」匹配移徙入宅） ====================
const YI_ALIASES = {
  '搬家': ['搬家','移徙','入宅'],
  '入宅': ['入宅','移徙','安床'],
  '开市': ['开市','开业','交易','纳财'],
  '嫁娶': ['嫁娶','纳采','订盟'],
  '签约': ['立券','交易','订盟','纳采','签约'],
  '出行': ['出行','旅游']
};
function openCalendarOverlay() { renderCalendarView(); openOverlay('calendarOverlay'); }
function getYingqiFlagsMap() { const m = {}; state.archives.forEach(a => (a.yingqiDates || []).forEach(dt => { if (!m[dt]) m[dt] = []; m[dt].push(a.title); })); return m; }
function renderCalendarView() {
  const wrap = document.getElementById('calendarScrollArea'), y = state.calYear, m = state.calMonth;
  const startDow = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate(), prevDays = new Date(y, m, 0).getDate();
  const todayKey = formatDateKey(new Date()), flagsMap = getYingqiFlagsMap();
  const matchKeys = state.calYiFilter ? (YI_ALIASES[state.calYiFilter] || [state.calYiFilter]) : [];
  let cells = '';
  for (let i = startDow - 1; i >= 0; i--) cells += `<div class="cal-cell other"><span class="cal-day-num">${prevDays - i}</span></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m, d, 12, 0), key = formatDateKey(dt), info = getAstroDayInfo(dt);
    const isSel = key === state.calSelectedDate, isToday = key === todayKey;
    const goodMatch = matchKeys.length > 0 && info.yi.some(x => matchKeys.some(mk => x.includes(mk)));
    const thirdLine = info.jieqi ? info.jieqi : (info.lunarDayShort || '');
    cells += `<div class="cal-cell ${isSel?'selected':''} ${isToday?'today':''} ${goodMatch?'good-match':''}" onclick="selectCalDate('${key}')">
      <span class="cal-day-num">${d}</span>
      <span class="cal-gz-mini">${info.day.gz}</span>
      <span class="cal-lunar-mini ${info.jieqi?'jq':''}">${escapeHtml(thirdLine)}</span>
      <div class="cal-dots">${state.footprints[key]?'<span class="dot-study"></span>':''}${flagsMap[key]?'<span class="dot-flag"></span>':''}</div>
    </div>`;
  }
  const [sy, sm, sd] = state.calSelectedDate.split('-').map(Number), info = getAstroDayInfo(new Date(sy, sm - 1, sd, new Date().getHours(), new Date().getMinutes()));
  const my = (state.settings.myDayPillar || '').trim();
  const resTip = my.length >= 2 ? `今日为你本命【${getTenGod(my[0], info.day.s)}】${LIU_CHONG[my[1]]===info.day.b?'，日支相冲宜守静':(LIU_HE[my[1]]===info.day.b?'，日支六合利协作':'，气场平稳有序')}` : '';
  wrap.innerHTML = `
    ${resTip ? `<div class="card" style="padding:12px 15px;background:var(--accent-soft);border-color:transparent;"><div style="font-size:13.5px;color:var(--accent);"><strong>天时共振：</strong>${escapeHtml(resTip)}</div></div>` : ''}
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <button class="btn-secondary" style="padding:6px 12px;" onclick="shiftCalMonth(-1)">‹</button>
        <button style="font-size:17px;font-weight:700;" onclick="openCalJumpSheet()">${y} 年 ${m + 1} 月 ▾</button>
        <button class="btn-secondary" style="padding:6px 12px;" onclick="shiftCalMonth(1)">›</button>
      </div>
      <div class="cat-strip" style="padding:0 0 10px;"><span style="font-size:12.5px;color:var(--text-3);flex-shrink:0;">择吉：</span>${['','搬家','入宅','开市','嫁娶','签约','出行'].map(f => `<button class="chip ${state.calYiFilter===f?'accent':''}" onclick="state.calYiFilter='${f}';renderCalendarView()">${f || '全部'}</button>`).join('')}</div>
      <div class="cal-grid">${['日','一','二','三','四','五','六'].map(w => `<div class="cal-wk">${w}</div>`).join('')}${cells}</div>
    </div>
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">${state.calSelectedDate} · 农历${info.lunarStr||''} ${info.jieqi?'【'+info.jieqi+'】':''}</div>
          <div style="font-size:12.5px;color:var(--text-2);margin-top:2px;">日空 <strong style="color:var(--seal);">${info.xunkong}</strong> · ${info.chong}</div>
        </div>
        <button class="pill-mini xs accent" onclick="instantCastFromCal()">即时起盘</button>
      </div>
      <div class="pillars-grid">${[['年柱',info.year],['月柱',info.month],['日柱',info.day],['时柱',info.hour]].map(([l,p]) => `<div class="pillar-col"><div class="pillar-lbl">${l}</div><div class="pillar-gz wx-${p.swx}">${p.s}</div><div class="pillar-gz wx-${p.bwx}">${p.b}</div><div style="font-size:11px;color:var(--text-3);margin-top:3px;">藏 ${HIDDEN_STEMS[p.b]}</div></div>`).join('')}</div>
      <div style="margin-top:12px;padding:11px 13px;border-radius:14px;background:var(--bg);font-size:13.5px;line-height:1.7;">
        <div><strong style="color:var(--wx-wood);">宜：</strong>${info.yi.slice(0, 12).join(' · ') || '平稳'}</div>
        <div><strong style="color:var(--seal);">忌：</strong>${info.ji.slice(0, 10).join(' · ') || '无大忌'}</div>
      </div>
    </div>
  `;
}
function shiftCalMonth(d) { const dt = new Date(state.calYear, state.calMonth + d, 1); state.calYear = dt.getFullYear(); state.calMonth = dt.getMonth(); renderCalendarView(); }
function selectCalDate(k) { state.calSelectedDate = k; renderCalendarView(); }
function calGoToday() { const n = new Date(); state.calYear = n.getFullYear(); state.calMonth = n.getMonth(); state.calSelectedDate = formatDateKey(n); renderCalendarView(); }
function openCalJumpSheet() { document.getElementById('calJumpYear').value = state.calYear; document.getElementById('calJumpMonth').value = state.calMonth; openSheet('sheet-cal-jump'); }
function applyCalJump() { state.calYear = Math.max(1900, Math.min(2100, parseInt(document.getElementById('calJumpYear').value) || state.calYear)); state.calMonth = parseInt(document.getElementById('calJumpMonth').value) || 0; state.calSelectedDate = formatDateKey(new Date(state.calYear, state.calMonth, 1)); closeSheet('sheet-cal-jump'); renderCalendarView(); }
function instantCastFromCal() { castState.lyDate = state.calSelectedDate + 'T12:00'; castState.lyDateManual = true; closeOverlay('calendarOverlay'); switchMainTab('divine'); switchCategory('六爻'); switchSubTab('cast'); showToast('已填入起卦时间'); }

// ==================== 独立水墨电子罗盘 + 节日节气倒计时 ====================
function openCompassOverlay() { renderCompassOverlay(); openOverlay('compassOverlay'); }
function renderCompassOverlay() {
  const mountains = ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'];
  const deg = ((state.compass.heading % 360) + 360) % 360, mIdx = Math.floor(((deg + 7.5) % 360) / 15), sitIdx = (mIdx + 12) % 24;
  const starInfo = { 1:['一白贪狼','桃花人缘',true],2:['二黑巨门','病符宜静',false],3:['三碧禄存','是非口舌',false],4:['四绿文曲','文昌学业',true],5:['五黄廉贞','煞位忌动',false],6:['六白武曲','偏财贵人',true],7:['七赤破军','破财防盗',false],8:['八白左辅','正财旺位',true],9:['九紫右弼','喜庆旺运',true] };
  const center = ((11 - ((state.compass.year - 2000) % 9)) % 9) || 9;
  const stars = [['东南',-1],['正南',4],['西南',-3],['正东',-2],['中宫',0],['正西',2],['东北',3],['正北',-4],['西北',1]].map(([dir, off]) => { const n = ((center + off - 1 + 18) % 9) + 1; return { dir, star: starInfo[n][0], desc: starInfo[n][1], good: starInfo[n][2] }; });
  document.getElementById('compassScrollArea').innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="pill-mini xs accent">${escapeHtml(state.compass.stability)}</span>
        <button class="pill-mini xs ${state.compass.locked?'seal':''}" onclick="state.compass.locked=!state.compass.locked;renderCompassOverlay()">${state.compass.locked?'已锁定':'锁定度数'}</button>
      </div>
      <div class="compass-dial-wrap">
        <div class="compass-needle-fixed"></div>
        <div class="compass-wheel" style="transform:rotate(${-deg}deg);">
          <span class="compass-dir-mark" style="top:8px;left:50%;transform:translateX(-50%);color:var(--seal);">北·子</span>
          <span class="compass-dir-mark" style="bottom:8px;left:50%;transform:translateX(-50%);">南·午</span>
          <span class="compass-dir-mark" style="right:10px;top:50%;transform:translateY(-50%);">东·卯</span>
          <span class="compass-dir-mark" style="left:10px;top:50%;transform:translateY(-50%);">西·酉</span>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(${deg}deg);">
            <div style="font-family:'Songti SC',serif;font-size:26px;font-weight:700;">坐${mountains[sitIdx]}向${mountains[mIdx]}</div>
            <div style="font-size:13px;color:var(--text-3);margin-top:2px;">${deg.toFixed(0)}°</div>
          </div>
        </div>
      </div>
      <input type="range" min="0" max="359" value="${deg}" style="width:100%;accent-color:var(--accent);" oninput="state.compass.heading=Number(this.value);state.compass.stability='手动校准模式';renderCompassOverlay()" />
      <div style="font-size:12px;color:var(--text-3);margin-top:8px;line-height:1.55;">准度提示：户外空旷处手机磁力计误差极小；室内钢筋或磁吸壳易干扰磁场，请远离金属并按「8字形」晃动手机 3 秒校准。</div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">${state.compass.year} 年玄空飞星吉凶</span><div style="display:flex;gap:6px;"><button class="pill-mini xs" onclick="state.compass.year--;renderCompassOverlay()">‹</button><button class="pill-mini xs" onclick="state.compass.year++;renderCompassOverlay()">›</button></div></div>
      <div class="nine-grid">${stars.map(c => `<div class="nine-cell"><strong>${c.dir}</strong><br/><span style="color:${c.good?'var(--wx-wood)':'var(--seal)'};font-weight:700;">${c.star}</span><br/><span style="font-size:11px;color:var(--text-3);">${c.desc}</span></div>`).join('')}</div>
      <button class="btn-primary" style="width:100%;margin-top:14px;" onclick="closeOverlay('compassOverlay');castState.fsHeading=state.compass.heading;castState.fsYear=state.compass.year;submitFengshuiAI()">让参悟结合此坐向与飞星解析</button>
    </div>
  `;
}

function openFestivalsOverlay() { renderFestivalsOverlay(); openOverlay('festivalsOverlay'); }
function renderFestivalsOverlay() {
  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById('festTodayTag').textContent = formatDateKey(today);
  const items = [];
  const solarFixed = { '1-1':'元旦','5-1':'劳动节','10-1':'国庆节' };
  const lunarFixed = { '1-1':'春节','1-15':'元宵节','2-2':'龙抬头','5-5':'端午节','7-7':'七夕节','7-15':'中元节','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节','12-23':'小年' };
  for (let i = 0; i <= 366; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const info = getAstroDayInfo(d), key = formatDateKey(d), sKey = `${d.getMonth()+1}-${d.getDate()}`;
    if (info.jieqi) items.push({ name: info.jieqi, type: '节气', dateKey: key, lunarStr: info.lunarStr, days: i });
    if (solarFixed[sKey]) items.push({ name: solarFixed[sKey], type: '公历节日', dateKey: key, lunarStr: info.lunarStr, days: i });
    if (info._lunar) {
      const lm = info._lunar.getMonth(), ld = info._lunar.getDay();
      if (lm > 0 && lunarFixed[`${lm}-${ld}`]) items.push({ name: lunarFixed[`${lm}-${ld}`], type: '传统节日', dateKey: key, lunarStr: info.lunarStr, days: i });
      const nextD = new Date(d.getTime() + 86400000);
      if (typeof window.Solar !== 'undefined') {
        const nl = window.Solar.fromYmd(nextD.getFullYear(), nextD.getMonth()+1, nextD.getDate()).getLunar();
        if (nl.getMonth() === 1 && nl.getDay() === 1) items.push({ name: '除夕', type: '传统节日', dateKey: key, lunarStr: info.lunarStr, days: i });
      }
    }
  }
  const seen = new Set(), uniq = items.filter(it => { const k = it.name + it.dateKey; if (seen.has(k)) return false; seen.add(k); return true; });
  document.getElementById('festivalsScrollArea').innerHTML = uniq.slice(0, 36).map(it => `
    <div class="fest-row" onclick="closeOverlay('festivalsOverlay');jumpCalendarToDateKey('${it.dateKey}')">
      <div>
        <div style="display:flex;align-items:center;gap:7px;">
          <strong style="font-size:16px;font-family:'Songti SC',serif;">${escapeHtml(it.name)}</strong>
          <span class="pill-mini xs ${it.type==='节气'?'seal':'accent'}">${it.type}</span>
        </div>
        <div style="font-size:12.5px;color:var(--text-3);margin-top:4px;">${it.dateKey} · 农历${escapeHtml(it.lunarStr || '')}</div>
      </div>
      <div class="fest-days">${it.days === 0 ? '<span style="color:var(--seal);">就是今天</span>' : `还有 ${it.days} 天`}</div>
    </div>
  `).join('') || '<div class="empty-box"><p>正在加载历法数据，请稍候...</p></div>';
}
function jumpCalendarToDateKey(key) {
  const [y, m] = key.split('-').map(Number);
  state.calYear = y; state.calMonth = m - 1; state.calSelectedDate = key;
  openCalendarOverlay();
}

// ==================== 七门排盘交互（全门类公历/农历 + 六爻双指定） ====================
function getNowDatetimeLocal() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

const castState = {
  lyMode: 'spec', lySpecStyle: 'line', // line 直点墨线 | slot 空白格四选一
  lySpecYaos: [7, 7, 7, 7, 7, 7],
  lySlotYaos: [0, 0, 0, 0, 0, 0], // 0 表示未选
  lyPickingSlotIdx: 0,
  lyYaoRolls: [], lyName: '', lyGender: '男', lyDir: '一事一问', lyQuestion: '', lyContext: '', lyDate: getNowDatetimeLocal(), lyDateManual: false,
  lyNum1: '', lyNum2: '', lyNum3: '', lyWord: '',
  bzName: '', bzGender: '男', bzDate: '1996-06-15T12:00', bzCity: '重庆', bzTrueSolar: true,
  qmName: '', qmGender: '男', qmBirthDate: '', qmQueryType: '事业求财', qmQuestion: '',
  qmType: '时家转盘', qmMethod: '拆补法', qmJuPick: 'auto', qmDate: getNowDatetimeLocal(), qmDateManual: false,
  mhMode: 'time', mhDate: getNowDatetimeLocal(), mhDateManual: false, mhNum1: '', mhNum2: '', mhWord: '', mhQuestion: '',
  lrDate: getNowDatetimeLocal(), lrDateManual: false, lrGuiMode: 'auto', lrYueJiang: 'auto', lrQuestion: '',
  zwGender: '男', zwDate: '1996-06-15T12:00', fsHeading: 180, fsYear: new Date().getFullYear()
};

function startLiveClockSync() {
  setInterval(() => {
    const nowStr = getNowDatetimeLocal();
    if (!castState.lyDateManual && castState.lyDate !== nowStr) { castState.lyDate = nowStr; if (state.mainTab==='divine' && state.category==='六爻' && state.subTab==='cast') { const el = document.getElementById('liveLyTimeDisp'); if (el) el.innerHTML = renderTimeRowDisplay(nowStr); } }
    if (!castState.qmDateManual && castState.qmDate !== nowStr) castState.qmDate = nowStr;
    if (!castState.lrDateManual && castState.lrDate !== nowStr) castState.lrDate = nowStr;
    if (!castState.mhDateManual && castState.mhDate !== nowStr) castState.mhDate = nowStr;
  }, 5000);
}

let isHoldingCast = false, holdClinkTimer = null, phoneShakeTimer = null, phoneIsShaking = false;
function startHoldCast(e) {
  if (e) e.preventDefault();
  if (castState.lyYaoRolls.length >= 6) { submitLiuyaoByMode(); return; }
  if (isHoldingCast) return;
  isHoldingCast = true;
  document.getElementById('zenCastRing')?.classList.add('holding');
  const hint = document.getElementById('zenRingHint'); if (hint) hint.textContent = '感应流转中 · 松手落定';
  playStoneSound(false); if (navigator.vibrate) navigator.vibrate(20);
  clearInterval(holdClinkTimer);
  holdClinkTimer = setInterval(() => { playStoneSound(false); if (navigator.vibrate) navigator.vibrate(12); }, 230);
}
function endHoldCast(e) { if (e) e.preventDefault(); if (!isHoldingCast) return; isHoldingCast = false; clearInterval(holdClinkTimer); settleOneLiuyao(); }
function settleOneLiuyao() {
  if (castState.lyYaoRolls.length >= 6) return;
  const c = [Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0];
  castState.lyYaoRolls.push({ stones: c, val: [9, 8, 7, 6][c[0] + c[1] + c[2]] });
  playStoneSound(true); if (navigator.vibrate) navigator.vibrate([25, 18, 35]);
  renderDivineView();
  if (castState.lyYaoRolls.length === 6) setTimeout(() => submitLiuyaoByMode(), 520);
}
function bindPhoneShakeForCast() {
  if (!window.DeviceMotionEvent) return;
  window.addEventListener('devicemotion', e => {
    if (state.mainTab !== 'divine' || state.category !== '六爻' || state.subTab !== 'cast' || castState.lyMode !== 'shake') return;
    if (castState.lyYaoRolls.length >= 6 || document.querySelector('.overlay-page.open')) return;
    const acc = e.accelerationIncludingGravity; if (!acc) return;
    if (Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0) > 26) {
      if (!phoneIsShaking) { phoneIsShaking = true; document.getElementById('zenCastRing')?.classList.add('holding'); }
      playStoneSound(false); clearTimeout(phoneShakeTimer);
      phoneShakeTimer = setTimeout(() => { phoneIsShaking = false; settleOneLiuyao(); }, 460);
    }
  });
}

function toggleTouchYaoSign(idx) { castState.lySpecYaos[idx] = { 7:8, 8:7, 9:6, 6:9 }[castState.lySpecYaos[idx]] || 7; playStoneSound(false); renderDivineView(); }
function toggleTouchYaoMov(idx) { castState.lySpecYaos[idx] = { 7:9, 9:7, 8:6, 6:8 }[castState.lySpecYaos[idx]] || 7; playStoneSound(true); renderDivineView(); }
function openSlotYaoPicker(idx) {
  const names = ['初爻','二爻','三爻','四爻','五爻','上爻'];
  castState.lyPickingSlotIdx = idx;
  document.getElementById('yaoPickTitle').textContent = `选择「${names[idx]}」阴阳动静`;
  openSheet('sheet-yao-pick');
}
function pickSlotYaoVal(v) {
  castState.lySlotYaos[castState.lyPickingSlotIdx] = v;
  playStoneSound(v === 6 || v === 9);
  closeSheet('sheet-yao-pick');
  renderDivineView();
}

function renderCastPanel(wrap) {
  const cat = state.category;
  if (cat === '六爻') renderLiuyaoCastForm(wrap);
  else if (cat === '八字') renderBaziCastForm(wrap);
  else if (cat === '奇门') renderQimenCastForm(wrap);
  else if (cat === '梅花') renderMeihuaCastForm(wrap);
  else if (cat === '六壬') renderLiurenCastForm(wrap);
  else if (cat === '紫微') renderZiweiCastForm(wrap);
  else renderFengshuiCastForm(wrap);
}

function renderLiuyaoCastForm(wrap) {
  const rolls = castState.lyYaoRolls, names = ['初爻','二爻','三爻','四爻','五爻','上爻'], valMap = { 6:'老阴 ×', 7:'少阳 —', 8:'少阴 --', 9:'老阳 ○' };
  const modes = [['spec','指定'],['shake','灵石'],['num','报数'],['time','时间'],['word','汉字']];
  let modeHtml = '';
  if (castState.lyMode === 'spec') {
    const isLine = castState.lySpecStyle === 'line';
    const arr = isLine ? castState.lySpecYaos : castState.lySlotYaos;
    const allChosen = arr.every(v => v > 0);
    let previewName = '待选六爻';
    if (allChosen) {
      const bits = arr.map(v => (v === 7 || v === 9) ? 1 : 0);
      previewName = HEX_DATA.byKey[(bits[3]+(bits[4]<<1)+(bits[5]<<2)) + '_' + (bits[0]+(bits[1]<<1)+(bits[2]<<2))]?.name || '';
    }
    modeHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:6px;">
        <div class="mini-switch">
          <button class="${isLine?'active':''}" onclick="castState.lySpecStyle='line';renderDivineView()">点线</button>
          <button class="${!isLine?'active':''}" onclick="castState.lySpecStyle='slot';renderDivineView()">点选</button>
        </div>
        <span style="font-size:12px;color:var(--text-3);">${isLine ? '点墨线切阴阳' : '点空格选四象'}</span>
        <strong style="color:var(--text);font-family:'Songti SC',serif;font-size:14px;">${previewName}</strong>
      </div>
      <div class="touch-hex-board">
        ${[5,4,3,2,1,0].map(i => {
          const v = arr[i];
          if (isLine) {
            const isYang = (v === 7 || v === 9), isMov = (v === 6 || v === 9);
            return `<div class="touch-yao-row">
              <span class="touch-yao-pos">${names[i]}</span>
              <button class="touch-yao-bar-btn" onclick="toggleTouchYaoSign(${i})"><span class="ink-stroke ${isYang?'yang':'yin'} ${isMov?'mov':''}"></span></button>
              <button class="touch-mov-btn ${isMov?'active':''}" onclick="toggleTouchYaoMov(${i})">${isMov ? (isYang ? '○' : '×') : '静'}</button>
            </div>`;
          } else {
            if (!v) {
              return `<div class="touch-yao-row"><span class="touch-yao-pos">${names[i]}</span><button class="touch-yao-bar-btn empty-slot" onclick="openSlotYaoPicker(${i})"><span>请选择</span><span>▾</span></button></div>`;
            }
            const isYang = (v === 7 || v === 9), isMov = (v === 6 || v === 9);
            return `<div class="touch-yao-row"><span class="touch-yao-pos">${names[i]}</span><button class="touch-yao-bar-btn" onclick="openSlotYaoPicker(${i})"><span style="font-size:12.5px;color:var(--text-2);flex-shrink:0;">${valMap[v].slice(0,2)}</span><span class="ink-stroke ${isYang?'yang':'yin'} ${isMov?'mov':''}"></span><span style="width:16px;text-align:center;color:var(--seal);font-weight:700;">${isMov?(isYang?'○':'×'):''}</span></button></div>`;
          }
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-secondary" onclick="${isLine?'castState.lySpecYaos=[7,7,7,7,7,7]':'castState.lySlotYaos=[0,0,0,0,0,0]'};renderDivineView()">重置</button>
        <button class="btn-primary" style="flex:1;" onclick="submitLiuyaoByMode()">排专业六爻盘</button>
      </div>
    `;
  } else if (castState.lyMode === 'shake') {
    const lastStones = rolls.length ? rolls[rolls.length - 1].stones : [1, 0, 1];
    modeHtml = `
      <div class="zen-cast-wrap">
        <div class="zen-ring" id="zenCastRing" onpointerdown="startHoldCast(event)" onpointerup="endHoldCast(event)" onpointercancel="endHoldCast(event)">
          <span class="zen-ripple"></span>
          <div class="zen-stones">${lastStones.map(s => `<span class="zen-stone ${s?'yin':'yang'}">${s?'阴':'阳'}</span>`).join('')}</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);" id="zenRingHint">${rolls.length >= 6 ? '六爻已定 · 轻点看盘' : `按住起第 ${rolls.length + 1} 爻`}</div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:4px;">已成 ${rolls.length} / 6 爻 · 亦可晃动手机</div>
        </div>
        ${rolls.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px;">${rolls.map((r,i) => `<span class="chip ${r.val===6||r.val===9?'seal':''}">${names[i]} ${valMap[r.val]}</span>`).join('')}</div>` : ''}
        <div style="display:flex;justify-content:center;gap:10px;margin-top:14px;">
          <button class="chip" onclick="tossLiuyaoAll()">一键连起六爻</button>
          ${rolls.length ? `<button class="chip" onclick="castState.lyYaoRolls=[];renderDivineView()">重新起卦</button>` : ''}
        </div>
      </div>
    `;
  } else if (castState.lyMode === 'num') {
    modeHtml = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0;"><input type="number" class="form-input" placeholder="上卦数" value="${castState.lyNum1}" oninput="castState.lyNum1=this.value" /><input type="number" class="form-input" placeholder="下卦数" value="${castState.lyNum2}" oninput="castState.lyNum2=this.value" /><input type="number" class="form-input" placeholder="动爻(选)" value="${castState.lyNum3}" oninput="castState.lyNum3=this.value" /></div><button class="btn-primary" style="width:100%;" onclick="submitLiuyaoByMode()">报数排盘</button>`;
  } else if (castState.lyMode === 'word') {
    modeHtml = `<div class="form-field" style="margin-top:14px;"><input type="text" class="form-input" placeholder="输入心中浮现的汉字（2字以上）" value="${escapeHtml(castState.lyWord)}" oninput="castState.lyWord=this.value" /></div><button class="btn-primary" style="width:100%;" onclick="submitLiuyaoByMode()">汉字排盘</button>`;
  } else {
    modeHtml = `<button class="btn-primary" style="width:100%;margin-top:14px;" onclick="submitLiuyaoByMode()">按当前时间排盘</button>`;
  }

  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">求测问题</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="一句话写下所问之事" value="${escapeHtml(castState.lyQuestion)}" oninput="castState.lyQuestion=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">起卦时间</span><div class="form-row-val"><button class="time-trigger-btn" id="liveLyTimeDisp" onclick="openDtPicker('lyDate')">${renderTimeRowDisplay(castState.lyDate)}</button>${castState.lyDateManual ? `<button class="pill-mini xs accent" onclick="castState.lyDateManual=false;castState.lyDate=getNowDatetimeLocal();renderDivineView()">实时</button>` : ''}</div></div>
      <div class="form-row"><span class="form-row-lbl">方向 · 性别</span><div class="form-row-val"><select class="form-select" style="width:auto;padding:4px 6px;border:none;background:transparent;font-size:14px;" onchange="castState.lyDir=this.value">${['一事一问','求财开单','事业求职','感情姻缘','学业考试','健康出行','失物寻人'].map(d => `<option ${castState.lyDir===d?'selected':''}>${d}</option>`).join('')}</select><div class="gender-pill"><button class="${castState.lyGender==='男'?'active':''}" onclick="castState.lyGender='男';renderDivineView()">男</button><button class="${castState.lyGender==='女'?'active':''}" onclick="castState.lyGender='女';renderDivineView()">女</button></div></div></div>
    </div>
    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:4px;">${modes.map(([k,lbl]) => `<button class="btn-secondary" style="padding:8px 2px;font-size:13.5px;${castState.lyMode===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="castState.lyMode='${k}';renderDivineView()">${lbl}</button>`).join('')}</div>
      ${modeHtml}
    </div>
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:7px;">补充背景与现实处境（选填，让参悟结合现实断）</div>
      <textarea class="form-textarea priv-blur" style="min-height:60px;" placeholder="把前因后果、目前卡点或对方态度直接写在这里..." oninput="castState.lyContext=this.value">${escapeHtml(castState.lyContext)}</textarea>
    </div>
  `;
}

function tossLiuyaoAll() { playStoneSound(true); castState.lyYaoRolls = []; for (let i = 0; i < 6; i++) { const c = [Math.random()<0.5?1:0, Math.random()<0.5?1:0, Math.random()<0.5?1:0]; castState.lyYaoRolls.push({ stones: c, val: [9,8,7,6][c[0]+c[1]+c[2]] }); } submitLiuyaoByMode(); }
function submitLiuyaoByMode() {
  const dt = castState.lyDateManual && castState.lyDate ? new Date(castState.lyDate) : new Date(), info = getAstroDayInfo(dt);
  let mainHex = HEX_DATA.byKey['7_7']; const movSet = new Set();
  if (castState.lyMode === 'spec') {
    const arr = castState.lySpecStyle === 'line' ? castState.lySpecYaos : castState.lySlotYaos;
    if (arr.some(v => !v)) return showToast('请先选满六个爻的阴阳动静');
    const bits = arr.map(v => (v === 7 || v === 9) ? 1 : 0);
    arr.forEach((v, i) => { if (v === 6 || v === 9) movSet.add(i + 1); });
    mainHex = HEX_DATA.byKey[(bits[3]+(bits[4]<<1)+(bits[5]<<2)) + '_' + (bits[0]+(bits[1]<<1)+(bits[2]<<2))];
  } else if (castState.lyMode === 'shake' && castState.lyYaoRolls.length === 6) {
    const bits = castState.lyYaoRolls.map(r => (r.val === 7 || r.val === 9) ? 1 : 0);
    castState.lyYaoRolls.forEach((r, i) => { if (r.val === 6 || r.val === 9) movSet.add(i + 1); });
    mainHex = HEX_DATA.byKey[(bits[3]+(bits[4]<<1)+(bits[5]<<2)) + '_' + (bits[0]+(bits[1]<<1)+(bits[2]<<2))];
  } else if (castState.lyMode === 'num') {
    const n1 = Math.max(1, parseInt(castState.lyNum1) || (dt.getHours() + 1)), n2 = Math.max(1, parseInt(castState.lyNum2) || (dt.getMinutes() + 1)), n3 = parseInt(castState.lyNum3) || (n1 + n2);
    mainHex = HEX_DATA.byKey[NUM_TO_TRI[n1 % 8] + '_' + NUM_TO_TRI[n2 % 8]]; movSet.add((n3 % 6) || 6);
  } else if (castState.lyMode === 'word') {
    const w = castState.lyWord.trim() || '藏往', c1 = w.charCodeAt(0), c2 = w.charCodeAt(w.length - 1);
    mainHex = HEX_DATA.byKey[NUM_TO_TRI[c1 % 8] + '_' + NUM_TO_TRI[c2 % 8]]; movSet.add(((c1 + c2) % 6) || 6);
  } else {
    const up = NUM_TO_TRI[(dt.getFullYear() + dt.getMonth() + 1 + dt.getDate()) % 8], low = NUM_TO_TRI[(dt.getFullYear() + dt.getMonth() + 1 + dt.getDate() + dt.getHours()) % 8];
    mainHex = HEX_DATA.byKey[up + '_' + low]; movSet.add(((dt.getHours() + dt.getMinutes()) % 6) || 6);
  }
  const qStr = castState.lyQuestion.trim();
  const rec = {
    id: uid('arc'), category: '六爻',
    title: qStr || `${mainHex.name}（${castState.lyDir}）`,
    question: qStr, dir: castState.lyDir, personName: castState.lyName.trim(), gender: castState.lyGender,
    group: '默认', createdAt: Date.now(),
    castTimeStr: formatDateTimeCn(dt), lunarStr: info.lunarStr, lunarFull: info.lunarFull,
    contextText: castState.lyContext.trim(),
    data: { mainKey: mainHex.key, moving: Array.from(movSet), yearGz: info.year.gz, monthGz: info.month.gz, dayGz: info.day.gz, hourGz: info.hour.gz, xunkong: info.xunkong, simMonthBranch: info.month.b, simDayBranch: info.day.b, lockedYongshenPos: null },
    reports: [], note: '', outcome: '', verdict: 'pending'
  };
  openLiuyaoResult(rec, false);
}

// ==================== 专业三页签八字核心推演引擎 ====================
const QIONGTONG_REF = {
  '甲':{'寅':'初春余寒，先丙暖局再配癸水，无丙则木不荣。','卯':'木旺气盛，喜庚金劈甲引丁，最忌无火泄秀。','辰':'木气渐老，先庚后丁，土厚须甲木疏通。','巳':'火泄木气，急需癸水滋润，配丁庚有制化。','午':'盛夏炎燥，首取癸水润根，庚金发水源为贵。','未':'燥土当令，癸水不可离，见丁庚则成大器。','申':'秋金克木，首重丁火制杀，次配庚劈甲。','酉':'金旺木凋，先丁制金，有丙暖亦佳。','戌':'燥土藏金，先甲疏土、次丁制金、癸润燥。','亥':'寒木向阳，庚丁为先，丙火暖局立见生机。','子':'水泛木浮，丙火暖局为急，戊土制水次之。','丑':'严冬寒木，非丙不暖，得丁庚相辅为贵。'},
  '乙':{'寅':'寒谷回春，首重丙火暖局，癸水润枝次之。','卯':'建禄木旺，丙癸并用，水火既济方显清贵。','辰':'湿土培木，先癸后丙，戊土助培根基。','巳':'木气泄尽，急须癸水滋润，切忌火炎木枯。','午':'夏木焦干，癸水救命第一，丙火反宜适度。','未':'三伏枯草，重用癸水润根，有丙则生发。','申':'秋金肃杀，先丙火暖金，次癸水润木。','酉':'七杀当令，首用癸水化杀，丙火调候次之。','戌':'燥土秋深，癸水润根为急，辛金须有制。','亥':'乙生亥月，印星当令水冷木冻；调候为急，先取丙暖，壬水司令不可无戊。','子':'寒冬冻木，专取丙火解冻，无丙则孤寒。','丑':'腊月寒乙，非丙火照暖不能发荣。'},
  '丙':{'寅':'初春火气渐升，壬水辅映太阳，庚金发水源。','卯':'印旺生身，专取壬水既济，免木多火塞。','辰':'晦火之土，壬水配甲木疏土为上格。','巳':'建禄炎上，急取壬水调候，庚金生水为贵。','午':'帝旺炎烈，非壬水不能济，见庚申发源大贵。','未':'炎燥之极，壬水为急，庚金助水成格。','申':'秋阳渐退，壬水配戊土，亦喜甲木助光。','酉':'日落西山，壬水显辉，须甲木生扶免弱。','戌':'暮秋火入库，甲木疏土生火，壬水辅映。','亥':'绝地寒水，首用甲木印星化杀，戊土制水。','子':'水旺克火，壬水当令须戊土制水、甲木引燃。','丑':'寒湿晦火，首取甲木生身，壬水须有节制。'},
  '丁':{'寅':'春木生丁，甲木为母，庚金劈甲引丁为要。','卯':'木旺易塞，先庚劈甲，火明则贵。','辰':'湿土晦火，甲木疏土引灯为第一要务。','巳':'旺火炎上，喜甲木引薪，壬水调候润局。','午':'夏火当令，壬癸水调候为急，庚金生水。','未':'燥土泄火，甲木配壬癸，水火相济。','申':'秋金当权，甲木引丁、丙火助暖、庚金劈甲。','酉':'金旺财重，须甲木生身、丙火暖局方能任财。','戌':'火库燥土，甲木疏土引丁，戊土忌重。','亥':'寒夜孤灯，首重甲木生身，庚金劈甲次之。','子':'七杀旺克，甲木化杀生丁，戊土制水护灯。','丑':'严冬微火，急须甲木生扶、庚金劈引。'},
  '戊':{'寅':'春土寒湿，首用丙火暖土，甲木疏土、癸水润之。','卯':'官星当令，丙火化官暖局为先，甲癸佐之。','辰':'比肩厚土，先甲疏土、次丙暖、癸润。','巳':'火土炎燥，首取癸水润泽，甲木疏劈。','午':'焦土难生万物，壬癸水润局第一，甲木次之。','未':'燥土极厚，癸水透干润泽，丙火反不宜重。','申':'食神泄气，丙火暖局、癸水润泽、甲木疏土。','酉':'伤官泄秀，丙火配癸水，见甲更佳。','戌':'燥土当令，先甲疏土、次癸润燥、丙火适度。','亥':'寒湿水旺，首取丙火暖局，甲木次之、戊比助身。','子':'财旺寒冻，非丙火暖土不能生发，甲木佐之。','丑':'严冬冰土，专取丙火解冻，甲木疏土为贵。'},
  '己':{'寅':'寒土喜丙火暖局，甲木正官配癸水润泽。','卯':'杀旺克身，首取丙火化杀暖局，癸水润土。','辰':'湿土藏水，丙火照暖为先，癸甲配之。','巳':'夏初火旺，急用癸水润土，丙火适度。','午':'炎燥焦土，专取癸水滋润，无癸则枯。','未':'建禄燥土，癸水润田第一，丙火忌重。','申':'秋金泄土，丙火暖局、癸水润金生财。','酉':'食神当令，丙火照暖、癸水淘洗为贵。','戌':'暮秋燥土，先癸润、次丙暖、甲疏。','亥':'寒湿水泛，急用丙火暖局，戊土助堤。','子':'水旺寒冻，非丙火解冻不能成用，戊土辅之。','丑':'腊月冰土，专重丙火照暖，无丙孤寒。'},
  '庚':{'寅':'初春余寒，先丙暖金，甲木疏土、丁火锻造。','卯':'财星当令，丁火炼金、甲木引丁、庚比助身。','辰':'湿土埋金，先甲疏土、次丁火炼金。','巳':'长生火旺，壬水淘洗降温，戊土制水。','午':'炎火熔金，急取壬水救命，癸水次之。','未':'燥土脆金，先丁后甲，尤重壬水润泽。','申':'建禄刚金，专取丁火锻炼，甲木引丁成大器。','酉':'羊刃极刚，丁火制刃、甲木引丁、丙火暖局。','戌':'燥土藏火，先甲疏土、次壬水洗淘。','亥':'水冷金寒，首用丁火暖锻，丙火照暖。','子':'伤官极寒，非丙丁暖局不能发用，戊土制水。','丑':'严冬冻金，专重丙丁暖局，甲木引火。'},
  '辛':{'寅':'春寒金柔，己土生身、壬水淘洗、庚金助旺。','卯':'财旺身柔，壬水润局、甲木疏土、己土培根。','辰':'土重易埋，壬水淘洗珠玉，甲木疏土。','巳':'火旺熔珠，急用壬水降温淘洗，癸水次之。','午':'盛夏火炎，首取壬水、次己土晦火生金。','未':'燥土脆金，专取壬水润泽，庚金发水源。','申':'秋金得禄，壬水淘洗最显清贵，甲木次之。','酉':'建禄珠玉，专喜壬水淘洗，忌戊土埋珠。','戌':'燥土厚重，壬水淘洗、甲木疏土为要。','亥':'金水伤官，首重丙火暖局，壬水显清。','子':'冬水严寒，非丙火暖局不能荣发。','丑':'腊月冻珠，专取丙火照暖，壬水淘洗。'},
  '壬':{'寅':'初春水弱，庚金发源、丙火暖局、戊土堤防。','卯':'伤官泄水，戊土制水、辛金发源、庚金次之。','辰':'水入库墓，甲木疏土、庚金生水。','巳':'绝地火旺，壬水比劫助身、庚辛金发水源。','午':'财旺身枯，急用癸水润局、庚辛金发源。','未':'燥土克水，辛金发源、甲木疏土、癸水助身。','申':'长生得源，戊土堤防、丁火炼金成大器。','酉':'印旺水清，甲木泄秀、庚金发源。','戌':'燥土七杀，甲木制杀、丙火暖局。','亥':'建禄水旺，戊土堤防、丙火暖局、庚金次之。','子':'羊刃泛滥，专取戊土筑堤、丙火解冻。','丑':'腊月冰水，首用丙火解冻，丁火甲木次之。'},
  '癸':{'寅':'初春余寒，辛金发源、丙火暖局。','卯':'食神泄秀，庚辛金发源为先。','辰':'湿土克水，丙火暖局、辛金生水、甲木疏土。','巳':'火旺水干，辛金发源、壬水助身。','午':'至弱之水，急需庚辛金发水源、壬癸比助。','未':'燥土克绝，专取庚辛金生扶、壬癸助水。','申':'死地逢印，丁火制金、甲木引丁。','酉':'偏印当令，辛金发源、丙火暖局。','戌':'燥土厚克，辛金生水、甲木疏土。','亥':'寒水旺相，庚辛发源、戊土制水、丙火暖局。','子':'建禄冰寒，非丙火解冻不能生发，辛金次之。','丑':'严冬冻水，专取丙火解冻，丁火助暖。'}
};

function calcBaziShenSha(p, allPillars, gender) {
  const [yp, mp, dp, hp] = allPillars, ds = dp.s, ys = yp.s, yb = yp.b, mb = mp.b, db = dp.b, b = p.b;
  const list = [];
  const tianyi = { '甲':'丑未','戊':'丑未','庚':'丑未','乙':'子申','己':'子申','丙':'亥酉','丁':'亥酉','壬':'卯巳','癸':'卯巳','辛':'午寅' };
  if (tianyi[ds]?.includes(b) || tianyi[ys]?.includes(b)) list.push('天乙');
  const taiji = { '甲':'子午','乙':'子午','丙':'卯酉','丁':'卯酉','戊':'辰戌丑未','己':'辰戌丑未','庚':'寅亥','辛':'寅亥','壬':'巳申','癸':'巳申' };
  if (taiji[ds]?.includes(b)) list.push('太极');
  const wenchang = { '甲':'巳','乙':'午','丙':'申','丁':'酉','戊':'申','己':'酉','庚':'亥','辛':'子','壬':'寅','癸':'卯' };
  if (wenchang[ds] === b) list.push('文昌');
  const yima = { '申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳' };
  if (yima[yb] === b || yima[db] === b) list.push('驿马');
  const taohua = { '申':'酉','子':'酉','辰':'酉','寅':'卯','午':'卯','戌':'卯','巳':'午','酉':'午','丑':'午','亥':'子','卯':'子','未':'子' };
  if (taohua[yb] === b || taohua[db] === b) list.push('桃花');
  const lu = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
  if (lu[ds] === b) list.push('禄神');
  const yangren = { '甲':'卯','丙':'午','戊':'午','庚':'酉','壬':'子','乙':'寅','丁':'巳','己':'巳','辛':'申','癸':'亥' };
  if (yangren[ds] === b) list.push('羊刃');
  const huagai = { '申':'辰','子':'辰','辰':'辰','寅':'戌','午':'戌','戌':'戌','巳':'丑','酉':'丑','丑':'丑','亥':'未','卯':'未','未':'未' };
  if (huagai[yb] === b || huagai[db] === b) list.push('华盖');
  const jiangxing = { '申':'子','子':'子','辰':'子','寅':'午','午':'午','戌':'午','巳':'酉','酉':'酉','丑':'酉','亥':'卯','卯':'卯','未':'卯' };
  if (jiangxing[yb] === b || jiangxing[db] === b) list.push('将星');
  const guoyin = { '甲':'戌','乙':'亥','丙':'丑','丁':'寅','戊':'丑','己':'寅','庚':'辰','辛':'巳','壬':'未','癸':'申' };
  if (guoyin[ds] === b) list.push('国印');
  const jiesha = { '申':'巳','子':'巳','辰':'巳','寅':'亥','午':'亥','戌':'亥','巳':'寅','酉':'寅','丑':'寅','亥':'申','卯':'申','未':'申' };
  if (jiesha[yb] === b || jiesha[db] === b) list.push('劫煞');
  const wangshen = { '申':'亥','子':'亥','辰':'亥','寅':'巳','午':'巳','戌':'巳','巳':'申','酉':'申','丑':'申','亥':'寅','卯':'寅','未':'寅' };
  if (wangshen[yb] === b || wangshen[db] === b) list.push('亡神');
  const tiande = { '寅':'丁','卯':'申','辰':'壬','巳':'辛','午':'亥','未':'甲','申':'癸','酉':'寅','戌':'丙','亥':'乙','子':'巳','丑':'庚' };
  if (tiande[mb] === p.s || tiande[mb] === b) list.push('天德');
  const yuede = { '寅':'丙','午':'丙','戌':'丙','申':'壬','子':'壬','辰':'壬','亥':'甲','卯':'甲','未':'甲','巳':'庚','酉':'庚','丑':'庚' };
  if (yuede[mb] === p.s) list.push('月德');
  const hongyan = { '甲':'午','乙':'午','丙':'寅','丁':'未','戊':'辰','己':'辰','庚':'戌','辛':'酉','壬':'子','癸':'申' };
  if (hongyan[ds] === b) list.push('红艳煞');
  return list.length ? list : ['平稳'];
}

function calcGanZhiInteractions(pillars) {
  const stemHits = new Set(), branchHits = new Set();
  const sHe = { '甲己':'甲己合土','己甲':'甲己合土','乙庚':'乙庚合金','庚乙':'乙庚合金','丙辛':'丙辛合水','辛丙':'丙辛合水','丁壬':'丁壬合木','壬丁':'丁壬合木','戊癸':'戊癸合火','癸戊':'戊癸合火' };
  const sChong = { '甲庚':'甲庚相冲','庚甲':'甲庚相冲','乙辛':'乙辛相冲','辛乙':'乙辛相冲','丙壬':'丙壬相冲','壬丙':'丙壬相冲','丁癸':'丁癸相冲','癸丁':'丁癸相冲' };
  const zXing = { '子卯':'子卯相刑','卯子':'子卯相刑','寅巳':'寅巳相刑','巳申':'巳申相刑','丑戌':'丑戌相刑','戌未':'戌未相刑','辰辰':'辰辰自刑','午午':'午午自刑','酉酉':'酉酉自刑','亥亥':'亥亥自刑' };
  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const a = pillars[i], b = pillars[j], sp = a.s + b.s, bp = a.b + b.b;
      if (sHe[sp]) stemHits.add(sHe[sp]);
      if (sChong[sp]) stemHits.add(sChong[sp]);
      else {
        const sw = getWxRelation(STEM_WX[STEMS.indexOf(a.s)], STEM_WX[STEMS.indexOf(b.s)]);
        if (sw === '克') stemHits.add(`${a.s}${b.s}相克`);
        else if (sw === '被克') stemHits.add(`${b.s}${a.s}相克`);
      }
      if (LIU_CHONG[a.b] === b.b) branchHits.add(`${a.b}${b.b}相冲`);
      if (LIU_HE[a.b] === b.b) branchHits.add(`${a.b}${b.b}合${LIU_HE_WX[bp]||''}`);
      if (LIU_CHUAN[a.b] === b.b) branchHits.add(`${a.b}${b.b}相穿`);
      if (zXing[bp]) branchHits.add(zXing[bp]);
      if (AN_HE.includes(bp)) branchHits.add(`${a.b}${b.b}暗合`);
    }
  }
  const bSet = new Set(pillars.map(p => p.b));
  SAN_HE.forEach(g => { const m = g.set.filter(x => bSet.has(x)); if (m.length === 3) branchHits.add(g.name); else if (m.length === 2) branchHits.add(`${m.join('')}半合${g.wx}`); });
  SAN_HUI.forEach(g => { const m = g.set.filter(x => bSet.has(x)); if (m.length === 3) branchHits.add(g.name); });
  return { stems: Array.from(stemHits), branches: Array.from(branchHits) };
}

function getMonthSeasonWxStates(monthBranch) {
  const mWx = BRANCH_WX[BRANCHES.indexOf(monthBranch)] || '水';
  const ord = ['木','火','土','金','水'], idx = ord.indexOf(mWx);
  const colors = { '木':'#3A7D5C','火':'#B84435','土':'#9C723A','金':'#9C8032','水':'#2E648F' };
  const labels = ['旺','相','死','囚','休'];
  return [0,1,2,3,4].map(step => {
    const wx = ord[(idx + step) % 5];
    return { wx, state: labels[step], bg: colors[wx] };
  });
}

function getRenYuanSiLing(monthBranch, daysAfterJie) {
  const tbl = {
    '寅':[[7,'戊土'],[14,'丙火'],[30,'甲木']], '卯':[[10,'甲木'],[30,'乙木']], '辰':[[9,'乙木'],[12,'癸水'],[30,'戊土']],
    '巳':[[5,'戊土'],[14,'庚金'],[30,'丙火']], '午':[[10,'丙火'],[19,'己土'],[30,'丁火']], '未':[[9,'丁火'],[12,'乙木'],[30,'己土']],
    '申':[[7,'戊土'],[14,'壬水'],[30,'庚金']], '酉':[[10,'庚金'],[30,'辛金']], '戌':[[9,'辛金'],[12,'丁火'],[30,'戊土']],
    '亥':[[7,'戊土'],[12,'甲木'],[30,'壬水']], '子':[[10,'壬水'],[30,'癸水']], '丑':[[9,'癸水'],[12,'辛金'],[30,'己土']]
  };
  const d = Math.max(0, daysAfterJie || 0), arr = tbl[monthBranch] || [[30,'正气']];
  for (const [lim, name] of arr) if (d <= lim) return name + '用事';
  return arr[arr.length - 1][1] + '用事';
}

function getMingGua(year, gender) {
  const sum = String(year).split('').reduce((a, b) => a + Number(b), 0);
  let r = sum % 9; if (r === 0) r = 9;
  let guaNum = gender === '男' ? (11 - r) % 9 : (4 + r) % 9;
  if (guaNum === 0) guaNum = 9;
  if (guaNum === 5) guaNum = gender === '男' ? 2 : 8;
  const map = { 1:'坎卦(东四命)',2:'坤卦(西四命)',3:'震卦(东四命)',4:'巽卦(东四命)',6:'乾卦(西四命)',7:'兑卦(西四命)',8:'艮卦(西四命)',9:'离卦(东四命)' };
  return map[guaNum] || '坎卦(东四命)';
}

function renderBaziCastForm(wrap) {
  wrap.innerHTML = `<div class="card">
    <div class="form-row"><span class="form-row-lbl">命主姓名</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="非必填" value="${escapeHtml(castState.bzName)}" oninput="castState.bzName=this.value" /></div></div>
    <div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.bzGender==='男'?'active':''}" onclick="castState.bzGender='男';renderDivineView()">男(乾)</button><button class="${castState.bzGender==='女'?'active':''}" onclick="castState.bzGender='女';renderDivineView()">女(坤)</button></div></div></div>
    <div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><button class="time-trigger-btn" onclick="openDtPicker('bzDate')">${renderTimeRowDisplay(castState.bzDate)}</button></div></div>
    <div class="form-row"><span class="form-row-lbl">出生城市</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.bzCity=this.value;renderDivineView()">${Object.keys(CITIES_LON).map(c => `<option ${castState.bzCity===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
    <div class="form-row"><span class="form-row-lbl">真太阳时</span><div class="form-row-val"><label style="font-size:13.5px;display:flex;align-items:center;gap:6px;"><input type="checkbox" ${castState.bzTrueSolar?'checked':''} onchange="castState.bzTrueSolar=this.checked;renderDivineView()" />东经 ${CITIES_LON[castState.bzCity]}° 校正</label></div></div>
  </div>
  <button class="btn-primary" style="width:100%;" onclick="submitBaziCast()">排专业三页签八字细盘</button>
  <div style="text-align:center;margin-top:14px;"><button class="chip" onclick="openBaziCompare()">双人八字合盘对比 ›</button></div>`;
}

function submitBaziCast() {
  const rawDt = castState.bzDate ? new Date(castState.bzDate) : new Date();
  const effDt = calcTrueSolarDate(rawDt, castState.bzTrueSolar ? (CITIES_LON[castState.bzCity] || 120) : 120);
  const info = getAstroDayInfo(effDt), dm = info.day.s, dmWx = STEM_WX[STEMS.indexOf(dm)];
  const rawPillars = [info.year, info.month, info.day, info.hour];
  const pillars = rawPillars.map((p, idx) => ({
    ...p,
    shishen: idx === 2 ? (castState.bzGender === '男' ? '元男' : '元女') : getTenGod(dm, p.s),
    hiddenList: HIDDEN_STEMS[p.b].split('').map(hs => ({ s: hs, wx: STEM_WX[STEMS.indexOf(hs)], tg: getTenGod(dm, hs) })),
    xingyun: getChangSheng(dm, p.b),
    zizuo: getChangSheng(p.s, p.b),
    kongwang: getXunKongOfGz(p.gz),
    xunshou: getXunShouOfGz(p.gz),
    nayin: getNaYin(p.gz),
    shensha: calcBaziShenSha(p, rawPillars, castState.bzGender)
  }));

  // 胎元、胎息、命宫、身宫
  const mSIdx = STEMS.indexOf(info.month.s), mBIdx = BRANCHES.indexOf(info.month.b);
  const dSIdx = STEMS.indexOf(info.day.s), dBIdx = BRANCHES.indexOf(info.day.b), hBIdx = BRANCHES.indexOf(info.hour.b);
  const taiYuanGz = STEMS[(mSIdx + 1) % 10] + BRANCHES[(mBIdx + 3) % 12];
  const taiXiGz = STEMS[(dSIdx + 5) % 10] + LIU_HE[info.day.b];
  const mPos = (mBIdx - 2 + 12) % 12 + 1, hPos = (hBIdx - 2 + 12) % 12 + 1;
  const mingBrIdx = (14 - mPos - hPos + 24) % 12 + 2;
  const shenBrIdx = (mPos + hPos) % 12;
  const yStartStem = [2,4,6,8,0][STEMS.indexOf(info.year.s) % 5];
  const mingGongGz = STEMS[(yStartStem + ((mingBrIdx % 12) - 2 + 12) % 12) % 10] + BRANCHES[mingBrIdx % 12];
  const shenGongGz = STEMS[(yStartStem + ((shenBrIdx % 12) - 2 + 12) % 12) % 10] + BRANCHES[shenBrIdx % 12];

  // 节气精确天数差与起运交运
  let jieqiDesc = '', prevJieStr = '', nextJieStr = '', daysAfterJie = 10, startYunDesc = '约 4 岁起运', startYunAge = 4, startYunYear = effDt.getFullYear() + 4;
  if (info._lunar && info._ec) {
    try {
      const prevJ = info._lunar.getPrevJie(), nextJ = info._lunar.getNextJie();
      const ps = prevJ.getSolar(), ns = nextJ.getSolar();
      const pd = new Date(ps.getYear(), ps.getMonth()-1, ps.getDay(), ps.getHour(), ps.getMinute());
      const nd = new Date(ns.getYear(), ns.getMonth()-1, ns.getDay(), ns.getHour(), ns.getMinute());
      const diffP = Math.max(0, effDt - pd), diffN = Math.max(0, nd - effDt);
      daysAfterJie = Math.floor(diffP / 86400000);
      const hp1 = Math.floor((diffP % 86400000) / 3600000), dn1 = Math.floor(diffN / 86400000), hn1 = Math.floor((diffN % 86400000) / 3600000);
      jieqiDesc = `出生于${prevJ.getName()}后${daysAfterJie}天${hp1}时，${nextJ.getName()}前${dn1}天${hn1}时`;
      prevJieStr = `${prevJ.getName()}：${ps.toYmdHms()}`;
      nextJieStr = `${nextJ.getName()}：${ns.toYmdHms()}`;
      const yun = info._ec.getYun(castState.bzGender === '男' ? 1 : 0);
      startYunDesc = `出生后${yun.getStartYear()}年${yun.getStartMonth()}个月${yun.getStartDay()}天起运`;
      startYunAge = Math.max(1, yun.getStartYear() + (yun.getStartMonth() >= 6 ? 1 : 0));
      startYunYear = effDt.getFullYear() + yun.getStartYear();
    } catch (e) {}
  }

  // 同党 vs 异党估算
  let sameScore = 0, diffScore = 0;
  const weights = [10, 12, 12, 32, 0, 14, 10, 10];
  [info.year.s, info.year.b, info.month.s, info.month.b, info.day.s, info.day.b, info.hour.s, info.hour.b].forEach((ch, idx) => {
    if (idx === 4) return;
    const wx = idx % 2 === 0 ? STEM_WX[STEMS.indexOf(ch)] : BRANCH_WX[BRANCHES.indexOf(ch)];
    const rel = getWxRelation(wx, dmWx);
    if (rel === '比和' || rel === '生') sameScore += weights[idx];
    else diffScore += weights[idx];
  });
  const samePct = Math.round(sameScore / Math.max(1, sameScore + diffScore) * 100);

  // 8 步大运及每步下属 10 个流年
  const forward = ((STEMS.indexOf(info.year.s) % 2) === 0 && castState.bzGender === '男') || ((STEMS.indexOf(info.year.s) % 2) === 1 && castState.bzGender === '女');
  const dayun = Array.from({length: 9}, (_, i) => {
    const step = forward ? i + 1 : -(i + 1), s = STEMS[((mSIdx + step) % 10 + 10) % 10], b = BRANCHES[((mBIdx + step) % 12 + 12) % 12];
    const gz = s + b, startAge = startYunAge + i * 10, startYr = startYunYear + i * 10;
    const liunian = Array.from({length: 10}, (_, j) => {
      const yr = startYr + j, yIdx = ((yr - 4) % 60 + 60) % 60, ls = STEMS[yIdx % 10], lb = BRANCHES[yIdx % 12];
      return { year: yr, age: startAge + j, gz: ls + lb, s: ls, b: lb, swx: STEM_WX[yIdx%10], bwx: BRANCH_WX[yIdx%12], ss: getTenGod(dm, ls), bss: getTenGod(dm, HIDDEN_STEMS[lb][0]) };
    });
    return { age: startAge, startYear: startYr, gz, s, b, swx: STEM_WX[STEMS.indexOf(s)], bwx: BRANCH_WX[BRANCHES.indexOf(b)], ss: getTenGod(dm, s), bss: getTenGod(dm, HIDDEN_STEMS[b][0]), shensha: calcBaziShenSha({s,b,gz}, rawPillars, castState.bzGender), liunian };
  });

  const curYr = new Date().getFullYear();
  let defDy = dayun.findIndex(d => curYr >= d.startYear && curYr < d.startYear + 10);
  if (defDy < 0) defDy = 0;
  let defLn = dayun[defDy].liunian.findIndex(l => l.year === curYr);
  if (defLn < 0) defLn = 0;

  const rec = {
    id: uid('arc'), category: '八字',
    title: (castState.bzName.trim() || '八字命盘') + `（${info.day.gz}日主）`,
    personName: castState.bzName.trim(), gender: castState.bzGender, group: '默认', createdAt: Date.now(),
    castTimeStr: formatDateTimeCn(rawDt), trueSolarStr: formatDateTimeCn(effDt), city: castState.bzCity,
    lunarStr: info.lunarStr, lunarFull: info.lunarFull,
    data: {
      pillars, xunkong: info.xunkong, dayun, defDy, defLn,
      shengxiao: info.shengxiao, xingzuo: getZodiacSign(effDt.getMonth()+1, effDt.getDate()), xiu: info.xiu,
      renYuan: getRenYuanSiLing(info.month.b, daysAfterJie), jieqiDesc, prevJieStr, nextJieStr, startYunDesc,
      taiYuan: `${taiYuanGz}(${getNaYin(taiYuanGz)})`, taiXi: `${taiXiGz}(${getNaYin(taiXiGz)})`,
      mingGong: `${mingGongGz}(${getNaYin(mingGongGz)})`, shenGong: `${shenGongGz}(${getNaYin(shenGongGz)})`,
      mingGua: getMingGua(effDt.getFullYear(), castState.bzGender),
      dmLabel: `${dm}${dmWx}`, samePct, diffPct: 100 - samePct,
      qiongtong: QIONGTONG_REF[dm]?.[info.month.b] || '',
      origInter: calcGanZhiInteractions(rawPillars),
      seasonStates: getMonthSeasonWxStates(info.month.b)
    },
    reports: [], note: '', outcome: '', verdict: 'pending'
  };
  state.bzResTab = 'basic'; state.bzSelDyIdx = defDy; state.bzSelLnIdx = defLn;
  openGenericResult(rec, false);
}

// ==================== 奇门、梅花、六壬、紫微、风水（全部接入公历/农历选择器） ====================
function renderQimenCastForm(wrap) {
  const juOpts = ['auto', ...Array.from({length:9},(_,i)=>`阳${i+1}`), ...Array.from({length:9},(_,i)=>`阴${i+1}`)];
  const juLbl = k => k === 'auto' ? '自动选局' : (k[0] + '遁' + '一二三四五六七八九'[Number(k[1])-1] + '局');
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">姓　名</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="非必填" value="${escapeHtml(castState.qmName)}" oninput="castState.qmName=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.qmGender==='男'?'active':''}" onclick="castState.qmGender='男';renderDivineView()">男</button><button class="${castState.qmGender==='女'?'active':''}" onclick="castState.qmGender='女';renderDivineView()">女</button></div></div></div>
      <div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><button class="time-trigger-btn" onclick="openDtPicker('qmBirthDate')">${renderTimeRowDisplay(castState.qmBirthDate)}</button>${castState.qmBirthDate ? `<button class="pill-mini xs" onclick="castState.qmBirthDate='';renderDivineView()">清</button>` : ''}</div></div>
    </div>
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">求测类型</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.qmQueryType=this.value">${['事业求财','合作谈判','感情婚姻','寻人失物','官司诉讼','疾病健康','出行择吉','综合占测'].map(t=>`<option ${castState.qmQueryType===t?'selected':''}>${t}</option>`).join('')}</select></div></div>
      <div class="form-row"><span class="form-row-lbl">求测问题</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="一句话描述你的问题" value="${escapeHtml(castState.qmQuestion)}" oninput="castState.qmQuestion=this.value" /></div></div>
    </div>
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">起局时间</span><div class="form-row-val"><button class="time-trigger-btn" onclick="openDtPicker('qmDate')">${renderTimeRowDisplay(castState.qmDate)}</button></div></div>
      <div class="form-row"><span class="form-row-lbl">奇门类型</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.qmType=this.value"><option ${castState.qmType==='时家转盘'?'selected':''}>时家转盘</option><option ${castState.qmType==='飞盘奇门'?'selected':''}>飞盘奇门</option><option ${castState.qmType==='阴盘奇门'?'selected':''}>阴盘奇门</option></select></div></div>
      <div class="form-row"><span class="form-row-lbl">定局法则</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.qmMethod=this.value"><option ${castState.qmMethod==='拆补法'?'selected':''}>拆补法</option><option ${castState.qmMethod==='置闰法'?'selected':''}>置闰法</option><option ${castState.qmMethod==='茅山道人法'?'selected':''}>茅山道人法</option></select></div></div>
      <div class="form-row"><span class="form-row-lbl">局　数</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;font-weight:600;color:var(--accent);" onchange="castState.qmJuPick=this.value">${juOpts.map(k => `<option value="${k}" ${castState.qmJuPick===k?'selected':''}>${juLbl(k)}</option>`).join('')}</select></div></div>
    </div>
    <button class="btn-primary" style="width:100%;" onclick="submitQimenCast()">开始奇门排盘</button>
  `;
}
function submitQimenCast() {
  const dt = castState.qmDateManual && castState.qmDate ? new Date(castState.qmDate) : new Date(), info = getAstroDayInfo(dt), m = dt.getMonth() + 1, d = dt.getDate();
  let isYang = (m < 6 || (m === 6 && d < 21) || (m === 12 && d >= 21));
  let ju = ((m + Math.floor(d / 5) + (isYang ? 0 : 3)) % 9) + 1;
  if (castState.qmJuPick && castState.qmJuPick !== 'auto') { isYang = castState.qmJuPick[0] === '阳'; ju = Number(castState.qmJuPick[1]) || 1; }
  const yuan = (d % 15 <= 5) ? '上元' : (d % 15 <= 10 ? '中元' : '下元');
  const hIdx = STEMS.indexOf(info.hour.s), hBIdx = BRANCHES.indexOf(info.hour.b);
  const xunShou = { 0:'甲子戊', 10:'甲戌己', 8:'甲申庚', 6:'甲午辛', 4:'甲辰壬', 2:'甲寅癸' }[(hBIdx - hIdx + 12) % 12] || '甲子戊';
  const yimaBr = { '申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳' }[info.hour.b] || '寅';
  const brToGong = { '子':1,'丑':8,'寅':8,'卯':3,'辰':4,'巳':4,'午':9,'未':2,'申':2,'酉':7,'戌':6,'亥':6 }, maGong = brToGong[yimaBr] || 8, kongGongs = info.xunkong.split('').map(b => brToGong[b]);
  const qiyi = ['戊','己','庚','辛','壬','癸','丁','丙','乙'], ringGongs = [1,8,3,4,9,2,7,6], baseStars = { 1:'天蓬',8:'天任',3:'天冲',4:'天辅',9:'天英',2:'天芮',7:'天柱',6:'天心',5:'天禽' }, baseDoors = { 1:'休门',8:'生门',3:'伤门',4:'杜门',9:'景门',2:'死门',7:'惊门',6:'开门',5:'中宫' }, gods = ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'];
  const gongWx = { 1:'水',8:'土',3:'木',4:'木',9:'火',2:'土',7:'金',6:'金',5:'土' };
  const doorWx = { '休门':'水','生门':'土','伤门':'木','杜门':'木','景门':'火','死门':'土','惊门':'金','开门':'金' };
  const jiXing = { '戊':3,'己':2,'庚':8,'辛':9,'壬':4,'癸':4 };
  const ruMu = { '乙':6,'丙':6,'戊':6,'丁':8,'己':8,'庚':8,'辛':4,'壬':4,'癸':2 };
  const diPan = {}; for (let i = 0; i < 9; i++) diPan[isYang ? ((ju - 1 + i) % 9) + 1 : ((ju - 1 - i + 18) % 9) + 1] = qiyi[i];
  const leadGan = xunShou[2], fuOrigGong = Number(Object.keys(diPan).find(k => diPan[k] === leadGan) || 1);
  const zhiFuStar = baseStars[fuOrigGong] || '天蓬', zhiShiDoor = baseDoors[fuOrigGong === 5 ? 2 : fuOrigGong] || '休门';
  const hourTargetGan = info.hour.s === '甲' ? leadGan : info.hour.s, fuCurrGong = Number(Object.keys(diPan).find(k => diPan[k] === hourTargetGan) || 1);
  const ringShift = (ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) - ringGongs.indexOf(fuOrigGong === 5 ? 2 : fuOrigGong) + 8) % 8, doorShift = hIdx % 8;
  const gongNames = { 4:'巽四',9:'离九',2:'坤二',3:'震三',5:'中五',7:'兑七',8:'艮八',1:'坎一',6:'乾六' };
  let nianMingGan = '', nianMingGz = '';
  if (castState.qmBirthDate) { const bi = getAstroDayInfo(new Date(castState.qmBirthDate)); nianMingGz = bi.year.gz; nianMingGan = bi.year.s === '甲' ? '戊' : bi.year.s; }
  const palaces = [4,9,2,3,5,7,8,1,6].map(g => {
    if (g === 5) return { gong:5, gName:'中五宫', god:'寄坤', star:'天禽', door:'中宫', tian:diPan[5], di:diPan[5], anGan:'', isMa:false, isKong:false, isNianMing:false, warns:[] };
    const rIdx = ringGongs.indexOf(g), srcStarGong = ringGongs[(rIdx - ringShift + 8) % 8], srcDoorGong = ringGongs[(rIdx - doorShift + 8) % 8];
    const godIdx = isYang ? (rIdx - ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) + 8) % 8 : (ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) - rIdx + 8) % 8;
    const tian = diPan[srcStarGong], door = baseDoors[srcDoorGong], warns = [];
    if (getWxRelation(doorWx[door], gongWx[g]) === '克') warns.push('迫');
    if (jiXing[tian] === g) warns.push('刑');
    if (ruMu[tian] === g) warns.push('墓');
    return { gong:g, gName:gongNames[g], god:gods[godIdx], star:baseStars[srcStarGong], door, tian, di:diPan[g], anGan:qiyi[(rIdx + hIdx) % 9], isMa:g===maGong, isKong:kongGongs.includes(g), isNianMing: Boolean(nianMingGan && tian === nianMingGan), warns };
  });
  openGenericResult({ id: uid('arc'), category: '奇门', title: castState.qmQuestion.trim() || `${castState.qmQueryType} · ${isYang?'阳':'阴'}遁${ju}局`, personName: castState.qmName.trim(), gender: castState.qmGender, group: '默认', createdAt: Date.now(), castTimeStr: formatDateTimeCn(dt), lunarStr: info.lunarStr, lunarFull: info.lunarFull, data: { dun: `${isYang?'阳':'阴'}遁${ju}局（${castState.qmJuPick==='auto'?yuan+'·'+castState.qmMethod:'手动选局'}）`, type: castState.qmType, queryType: castState.qmQueryType, nianMingGz, zhiFuStar, zhiShiDoor, xunShou, yimaBr, gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong, palaces }, reports: [], note: '', outcome: '', verdict: 'pending' }, false);
}

function renderMeihuaCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">占问事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="写下所问之事" value="${escapeHtml(castState.mhQuestion)}" oninput="castState.mhQuestion=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">起卦时间</span><div class="form-row-val"><button class="time-trigger-btn" onclick="openDtPicker('mhDate')">${renderTimeRowDisplay(castState.mhDate)}</button></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0;">${[['time','时间起卦'],['num','报数起卦'],['word','汉字起卦']].map(([k,l])=>`<button class="btn-secondary" style="${castState.mhMode===k?'background:var(--primary);color:var(--primary-fg);':''}" onclick="castState.mhMode='${k}';renderDivineView()">${l}</button>`).join('')}</div>${castState.mhMode==='num'?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><input type="number" class="form-input" placeholder="上卦数" value="${castState.mhNum1}" oninput="castState.mhNum1=this.value" /><input type="number" class="form-input" placeholder="下卦数" value="${castState.mhNum2}" oninput="castState.mhNum2=this.value" /></div>`:''}${castState.mhMode==='word'?`<input type="text" class="form-input" style="margin-bottom:12px;" placeholder="输入任意汉字" value="${escapeHtml(castState.mhWord)}" oninput="castState.mhWord=this.value" />`:''}<button class="btn-primary" style="width:100%;" onclick="submitMeihuaCast()">起梅花易数详盘</button></div>`;
}
function submitMeihuaCast() {
  const dt = castState.mhDateManual && castState.mhDate ? new Date(castState.mhDate) : new Date(), info = getAstroDayInfo(dt);
  let n1 = dt.getFullYear() + dt.getMonth() + 1 + dt.getDate(), n2 = n1 + dt.getHours() + 1;
  if (castState.mhMode === 'num') { n1 = Math.max(1, parseInt(castState.mhNum1) || n1); n2 = Math.max(1, parseInt(castState.mhNum2) || n2); }
  else if (castState.mhMode === 'word') { const w = castState.mhWord.trim() || '梅花'; n1 = w.charCodeAt(0); n2 = w.charCodeAt(w.length - 1); }
  const up = NUM_TO_TRI[n1 % 8], low = NUM_TO_TRI[n2 % 8], movPos = ((n1 + n2) % 6) || 6, mainHex = HEX_DATA.byKey[up + '_' + low];
  const huHex = HEX_DATA.byKey[(mainHex.bits[2]+(mainHex.bits[3]<<1)+(mainHex.bits[4]<<2)) + '_' + (mainHex.bits[1]+(mainHex.bits[2]<<1)+(mainHex.bits[3]<<2))];
  const bBits = mainHex.bits.map((b, i) => (i + 1 === movPos) ? (b ^ 1) : b), bianHex = HEX_DATA.byKey[(bBits[3]+(bBits[4]<<1)+(bBits[5]<<2)) + '_' + (bBits[0]+(bBits[1]<<1)+(bBits[2]<<2))];
  const tiTri = movPos <= 3 ? TRIGRAMS[up] : TRIGRAMS[low], yongTri = movPos <= 3 ? TRIGRAMS[low] : TRIGRAMS[up], mWx = BRANCH_WX[BRANCHES.indexOf(info.month.b)];
  openGenericResult({ id: uid('arc'), category: '梅花', title: castState.mhQuestion.trim() || `${mainHex.name} 变 ${bianHex.name}`, group: '默认', createdAt: Date.now(), castTimeStr: formatDateTimeCn(dt), lunarStr: info.lunarStr, lunarFull: info.lunarFull, data: { mainKey: mainHex.key, huKey: huHex.key, bianKey: bianHex.key, movPos, tiName: `${tiTri.name}(${tiTri.wx})`, yongName: `${yongTri.name}(${yongTri.wx})`, tiYongRel: `用${getWxRelation(yongTri.wx, tiTri.wx)}体 · 月令(${info.month.b}${mWx})${getWxRelation(mWx, tiTri.wx)}体卦`, gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong }, reports: [], note: '', outcome: '', verdict: 'pending' }, false);
}

function renderLiurenCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">占问事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="描述所测之事" value="${escapeHtml(castState.lrQuestion)}" oninput="castState.lrQuestion=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">起课时间</span><div class="form-row-val"><button class="time-trigger-btn" onclick="openDtPicker('lrDate')">${renderTimeRowDisplay(castState.lrDate)}</button></div></div><div class="form-row"><span class="form-row-lbl">月将选择</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.lrYueJiang=this.value"><option value="auto">按中气自动推算</option>${BRANCHES.map(b => `<option value="${b}" ${castState.lrYueJiang===b?'selected':''}>${b}将</option>`).join('')}</select></div></div><div class="form-row"><span class="form-row-lbl">昼夜贵人</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.lrGuiMode=this.value"><option value="auto">按时辰自动</option><option value="day">强制昼贵</option><option value="night">强制夜贵</option></select></div></div></div><button class="btn-primary" style="width:100%;" onclick="submitLiurenCast()">起大六壬四课三传</button>`;
}
function submitLiurenCast() {
  const dt = castState.lrDateManual && castState.lrDate ? new Date(castState.lrDate) : new Date(), info = getAstroDayInfo(dt), hIdx = BRANCHES.indexOf(info.hour.b);
  const yueJiangIdx = castState.lrYueJiang === 'auto' ? (12 - (dt.getMonth() + 1) + 1) % 12 : BRANCHES.indexOf(castState.lrYueJiang), offset = (yueJiangIdx - hIdx + 12) % 12;
  const getSky = br => BRANCHES[(BRANCHES.indexOf(br) + offset) % 12], isDayGui = castState.lrGuiMode === 'day' || (castState.lrGuiMode === 'auto' && hIdx >= 3 && hIdx <= 8);
  const jiangNames = ['贵人','螣蛇','朱雀','六合','勾陈','青龙','天空','白虎','太常','玄武','太阴','天后'], getJiang = br => jiangNames[(BRANCHES.indexOf(br) + hIdx) % 12];
  const ganJi = { '甲':'寅','乙':'辰','丙':'巳','丁':'未','戊':'巳','己':'未','庚':'申','辛':'戌','壬':'亥','癸':'丑' }[info.day.s];
  const k1 = getSky(ganJi), k2 = getSky(k1), k3 = getSky(info.day.b), k4 = getSky(k3), dmWx = STEM_WX[STEMS.indexOf(info.day.s)], mkLq = br => getLiuQin(dmWx, BRANCH_WX[BRANCHES.indexOf(br)]);
  openGenericResult({ id: uid('arc'), category: '六壬', title: castState.lrQuestion.trim() || `大六壬 · ${info.day.gz}日 ${info.hour.b}时`, group: '默认', createdAt: Date.now(), castTimeStr: formatDateTimeCn(dt), lunarStr: info.lunarStr, lunarFull: info.lunarFull, data: { gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong, yueJiang: BRANCHES[yueJiangIdx] + '将', guiType: isDayGui ? '昼贵' : '夜贵', sike: [{ lbl:'一课',top:k1,bot:info.day.s,jiang:getJiang(k1) },{ lbl:'二课',top:k2,bot:k1,jiang:getJiang(k2) },{ lbl:'三课',top:k3,bot:info.day.b,jiang:getJiang(k3) },{ lbl:'四课',top:k4,bot:k3,jiang:getJiang(k4) }], sanchuan: [{ lbl:'初传',br:k1,jiang:getJiang(k1),lq:mkLq(k1) },{ lbl:'中传',br:k2,jiang:getJiang(k2),lq:mkLq(k2) },{ lbl:'末传',br:k4,jiang:getJiang(k4),lq:mkLq(k4) }] }, reports: [], note: '', outcome: '', verdict: 'pending' }, false);
}

function renderZiweiCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><button class="time-trigger-btn" onclick="openDtPicker('zwDate')">${renderTimeRowDisplay(castState.zwDate)}</button></div></div><div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.zwGender==='男'?'active':''}" onclick="castState.zwGender='男';renderDivineView()">男</button><button class="${castState.zwGender==='女'?'active':''}" onclick="castState.zwGender='女';renderDivineView()">女</button></div></div></div></div><button class="btn-primary" style="width:100%;" onclick="submitZiweiCast()">排紫微斗数十二宫详盘</button>`;
}
function submitZiweiCast() {
  const dt = castState.zwDate ? new Date(castState.zwDate) : new Date(), info = getAstroDayInfo(dt);
  const gongNames = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'], stars = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
  const sihuaMap = { '甲':'廉禄·破权·武科·阳忌','乙':'机禄·梁权·紫科·阴忌','丙':'同禄·机权·昌科·廉忌','丁':'阴禄·同权·机科·巨忌','戊':'贪禄·阴权·弼科·机忌','己':'武禄·贪权·梁科·曲忌','庚':'阳禄·武权·阴科·同忌','辛':'巨禄·阳权·曲科·昌忌','壬':'梁禄·紫权·辅科·武忌','癸':'破禄·巨权·阴科·贪忌' };
  const hIdx = BRANCHES.indexOf(info.hour.b), mingPos = (dt.getMonth() + 2 - hIdx + 12) % 12, shenPos = (dt.getMonth() + 2 + hIdx) % 12;
  const gongs = gongNames.map((gn, i) => { const brIdx = (mingPos - i + 12) % 12; return { name: gn + (brIdx === shenPos ? '·身' : ''), branch: BRANCHES[brIdx], star: stars[(i + dt.getDate()) % stars.length] + (i % 3 === 0 ? ' · ' + stars[(i + 7) % stars.length] : '') }; });
  openGenericResult({ id: uid('arc'), category: '紫微', title: `紫微命盘（${info.year.gz}年 · ${castState.zwGender}）`, group: '默认', createdAt: Date.now(), castTimeStr: formatDateTimeCn(dt), lunarStr: info.lunarStr, lunarFull: info.lunarFull, data: { gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, wuxingJu: ['水二局','木三局','金四局','土五局','火六局'][(STEMS.indexOf(info.year.s) + mingPos) % 5], sihua: sihuaMap[info.year.s] || '', gongs }, reports: [], note: '', outcome: '', verdict: 'pending' }, false);
}

function renderFengshuiCastForm(wrap) {
  const mountains = ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'];
  const deg = ((castState.fsHeading % 360) + 360) % 360, mIdx = Math.floor(((deg + 7.5) % 360) / 15), sitIdx = (mIdx + 12) % 24;
  wrap.innerHTML = `<div class="card" style="text-align:center;"><div class="card-head"><span class="card-title">水墨罗盘与玄空飞星</span><button class="pill-mini xs accent" onclick="openCompassOverlay()">全屏罗盘 ›</button></div><div style="font-family:'Songti SC',serif;font-size:26px;font-weight:700;color:var(--accent);margin:8px 0;">坐${mountains[sitIdx]}向${mountains[mIdx]}（${deg.toFixed(0)}°）</div><input type="range" min="0" max="359" value="${deg}" style="width:100%;accent-color:var(--accent);margin:8px 0;" oninput="castState.fsHeading=Number(this.value);state.compass.heading=Number(this.value);renderDivineView()" /><button class="btn-primary" style="width:100%;margin-top:10px;" onclick="submitFengshuiAI()">让参悟分析坐向与流年飞星</button></div>`;
}
function enableLiveCompass() {
  const h = e => {
    if (state.compass.locked) return;
    const deg = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : (e.alpha != null ? 360 - e.alpha : null);
    if (deg != null) {
      const r = Math.round(deg);
      state.compass.lastReadings.push(r); if (state.compass.lastReadings.length > 6) state.compass.lastReadings.shift();
      const spread = Math.max(...state.compass.lastReadings) - Math.min(...state.compass.lastReadings);
      state.compass.stability = spread > 25 && spread < 335 ? '磁场波动 · 请8字晃动校准' : '磁场稳定 · 实测中';
      state.compass.heading = r; castState.fsHeading = r;
      if (document.getElementById('compassOverlay')?.classList.contains('open')) renderCompassOverlay();
    }
  };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') { window.addEventListener('deviceorientation', h); showToast('已开启陀螺仪，可做8字校准'); } });
  else { window.addEventListener('deviceorientation', h); showToast('已启用罗盘感应'); }
}
function submitFengshuiAI() { switchMainTab('canwu'); switchCanwuRoom('风水'); document.getElementById('chatInput').value = `当前方位角 ${castState.fsHeading}°，流年 ${castState.fsYear} 年九宫飞星已排好，请结合我的风水书库给出布局与避煞建议。`; sendCanwuMessage(); }

// ==================== 断事卷宗结果页（默认清净原盘 + 旬空直标 + 专业八字三页签） ====================
function openLiuyaoResult(rec, skipHistory = false) {
  state.sameTopicHint = skipHistory ? null : findRecentSimilarCast('六爻', rec.question || rec.title);
  if (!skipHistory) recordToHistory(rec);
  state.currentResult = rec; state.activeReportTab = 0; state.resultLayer = 'clean'; state.showGuaci = false; state.showSelfJudge = false; state.selfReason = '';
  const bs = state.books.filter(b => b.category === '六爻'); state.selectedBookIds = bs.length ? [bs[0].id] : [];
  renderResultOverlay(); openOverlay('resultOverlay'); markStudyFootprint();
}
function openGenericResult(rec, skipHistory = false) {
  state.sameTopicHint = skipHistory ? null : findRecentSimilarCast(rec.category, rec.title);
  if (!skipHistory) recordToHistory(rec);
  state.currentResult = rec; state.activeReportTab = 0; state.showSelfJudge = false; state.selfReason = '';
  if (rec.category === '八字') { state.bzResTab = 'basic'; state.bzSelDyIdx = rec.data.defDy || 0; state.bzSelLnIdx = rec.data.defLn || 0; }
  const bs = state.books.filter(b => b.category === rec.category); state.selectedBookIds = bs.length ? [bs[0].id] : [];
  renderResultOverlay(); openOverlay('resultOverlay'); markStudyFootprint();
}

const TAG_TIP_MAP = {
  '月破': '【月破】指爻的地支被月建相冲，当下处于被冲散、无力生克他爻的状态。但若临日辰、得日辰生扶或日辰合起，或自身发动化回头生、化进神，属「破而有救」，出月或填实之日仍可应事。',
  '暗动': '【暗动】指旺相的静爻被日辰相冲。虽未画动爻符号，但实际上如明动一般有力，主暗中促成、私下推进或突如其来的转机。',
  '日破': '【日破】指休囚无气的静爻被日辰冲克，散气无用；若用神日破且无动爻救应，多主落空。',
  '旬空': '【旬空】分假空与真空。旺相之空、动而之空、得日辰动爻生扶之空叫「假空」，出空、填实、冲空之日即应；休囚受克之空才是「真空」。',
  '化进神': '【化进神】亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌、戌化丑。代表由弱转强、规模扩大；用神化进大吉，忌神化进大凶。',
  '化退神': '【化退神】子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未、丑化戌。代表力量衰退、中途撤回；忌神化退反为大喜。',
  '回头生': '【回头生】变爻反生本位动爻，代表源源不断的助力与绝处逢生。',
  '回头克': '【回头克】变爻反克本位动爻，极其凶险的自伤信号，易虎头蛇尾、功败垂成。',
  '反吟冲': '【反吟冲】动爻变出地支与本位相冲，主反复折腾、去而复返、半途变卦。',
  '化合': '【化合】动爻与变爻相合为「化绊」，短期容易被牵绊拖延，待逢冲开合之日落地。',
  '伏神': '【伏神】用神藏在本宫首卦下。看伏神旺相、得日月动爻生扶、飞神生伏神，或飞神空破受克即可出伏。'
};
function openTagTip(tagName) {
  const key = Object.keys(TAG_TIP_MAP).find(k => tagName.includes(k)) || (tagName.startsWith('伏') ? '伏神' : '');
  state.activeTagTipKey = tagName;
  document.getElementById('tagTipTitle').textContent = tagName;
  document.getElementById('tagTipBody').innerHTML = key ? formatRichText(TAG_TIP_MAP[key]) : `「${escapeHtml(tagName)}」属于盘面即时生克冲合作用，点右上角可让参悟结合你本盘深入拆解。`;
  openSheet('sheet-tag-tip');
}
function askCanwuFromTagTip() {
  const k = state.activeTagTipKey; if (!k) return;
  closeOverlay('resultOverlay'); switchMainTab('canwu'); switchCanwuRoom(state.currentResult?.category || '六爻');
  document.getElementById('chatInput').value = `结合我刚排的盘，用大白话讲讲「${k}」在实战里到底怎么断？`;
  sendCanwuMessage();
}

function renderBaziResultCard(rec) {
  const d = rec.data, ps = d.pillars;
  const tabBar = `<div class="bz-tab-bar">${[['info','基本信息'],['basic','基础命盘'],['fine','专业细盘']].map(([k,l]) => `<button class="btn-secondary" style="padding:8px 2px;font-size:13px;${state.bzResTab===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="state.bzResTab='${k}';renderResultOverlay()">${l}</button>`).join('')}</div>`;
  const headHtml = `<div style="font-size:13px;color:var(--text-2);line-height:1.65;margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;"><strong class="priv-blur" style="font-size:15.5px;color:var(--text);">${escapeHtml(rec.title)}</strong><span class="pill-mini xs accent">${rec.gender==='男'?'乾造':'坤造'} · ${escapeHtml(d.shengxiao||'')}</span></div>
    <div>公历：${escapeHtml(rec.castTimeStr || '')} ${rec.trueSolarStr && rec.trueSolarStr !== rec.castTimeStr ? `（真太阳 ${escapeHtml(rec.trueSolarStr)}）` : ''}</div>
    <div>农历：${escapeHtml(rec.lunarFull || rec.lunarStr || '')}</div>
  </div>`;

  if (state.bzResTab === 'info') {
    return `<div class="card">${headHtml}${tabBar}<div class="bz-info-table">
      <div class="bz-info-row"><span>出生地点</span><strong>${escapeHtml(rec.city || '北京时间')}</strong></div>
      <div class="bz-info-row"><span>人元司令分野</span><strong style="color:var(--accent);">${escapeHtml(d.renYuan || '')}</strong></div>
      ${d.jieqiDesc ? `<div class="bz-info-row"><span>出生节气</span><strong style="text-align:right;">${escapeHtml(d.jieqiDesc)}</strong></div>` : ''}
      ${d.prevJieStr ? `<div class="bz-info-row" style="font-size:12px;color:var(--text-3);"><span>${escapeHtml(d.prevJieStr)}</span><span>${escapeHtml(d.nextJieStr)}</span></div>` : ''}
      <div class="bz-info-row"><span>星座 · 星宿</span><strong>${escapeHtml(d.xingzuo||'')} · ${escapeHtml(d.xiu||'')}</strong></div>
      <div class="bz-info-row"><span>胎元 · 胎息</span><strong>${escapeHtml(d.taiYuan||'')} · ${escapeHtml(d.taiXi||'')}</strong></div>
      <div class="bz-info-row"><span>命宫 · 身宫</span><strong>${escapeHtml(d.mingGong||'')} · ${escapeHtml(d.shenGong||'')}</strong></div>
      <div class="bz-info-row"><span>命卦 · 空亡</span><strong>${escapeHtml(d.mingGua||'')} · ${escapeHtml(d.xunkong||'')}</strong></div>
      <div class="bz-info-row"><span>起运交运</span><strong>${escapeHtml(d.startYunDesc||'')}</strong></div>
    </div>
    <div style="margin-top:12px;padding:11px 13px;border-radius:14px;background:var(--bg);">
      <div style="display:flex;justify-content:space-between;font-size:13px;"><span>日主 <strong>${escapeHtml(d.dmLabel||'')}</strong></span><span>同党 ${d.samePct||50}% vs 异党 ${d.diffPct||50}%</span></div>
      <div class="party-bar"><div style="width:${d.samePct||50}%;background:var(--accent);"></div><div style="width:${d.diffPct||50}%;background:var(--seal);"></div></div>
    </div></div>`;
  }

  if (state.bzResTab === 'basic') {
    const inter = d.origInter || { stems: [], branches: [] };
    return `<div class="card">${headHtml}${tabBar}
      <table class="bz-matrix">
        <thead><tr><th>四柱</th><th>年柱</th><th>月柱</th><th>日柱</th><th>时柱</th></tr></thead>
        <tbody>
          <tr><td>主星</td>${ps.map(p=>`<td style="font-weight:600;">${p.shishen}</td>`).join('')}</tr>
          <tr><td>天干</td>${ps.map(p=>`<td><span class="bz-gz-char wx-${p.swx}">${p.s}</span></td>`).join('')}</tr>
          <tr><td>地支</td>${ps.map(p=>`<td><span class="bz-gz-char wx-${p.bwx}">${p.b}</span></td>`).join('')}</tr>
          <tr><td>藏干</td>${ps.map(p=>`<td style="font-size:11.5px;line-height:1.45;">${(p.hiddenList||[]).map(h=>`<span class="wx-${h.wx}">${h.s}</span><span style="color:var(--text-3);">${getShortTenGod(h.tg)}</span>`).join('<br/>')}</td>`).join('')}</tr>
          <tr><td>星运</td>${ps.map(p=>`<td>${p.xingyun||''}</td>`).join('')}</tr>
          <tr><td>自坐</td>${ps.map(p=>`<td>${p.zizuo||''}</td>`).join('')}</tr>
          <tr><td>空亡</td>${ps.map(p=>`<td>${p.kongwang||''}</td>`).join('')}</tr>
          <tr><td>旬首</td>${ps.map(p=>`<td>${p.xunshou||''}</td>`).join('')}</tr>
          <tr><td>纳音</td>${ps.map(p=>`<td style="font-size:11.5px;">${p.nayin||''}</td>`).join('')}</tr>
          <tr><td>神煞</td>${ps.map(p=>`<td style="font-size:11px;line-height:1.45;color:var(--text-2);">${(p.shensha||[]).slice(0,5).join('<br/>')}</td>`).join('')}</tr>
        </tbody>
      </table>
      <div style="margin-top:11px;padding:10px 12px;border-radius:13px;background:var(--bg);font-size:12.5px;line-height:1.7;">
        <div><strong>原局天干：</strong>${inter.stems.join(' ｜ ') || '平和无剧烈冲克'}</div>
        <div><strong>原局地支：</strong>${inter.branches.join(' ｜ ') || '平和无剧烈冲穿'}</div>
      </div>
      ${d.qiongtong ? `<div style="margin-top:10px;padding:11px 13px;border-radius:14px;background:var(--accent-soft);font-size:13px;line-height:1.72;"><strong style="color:var(--accent);">【穷通宝鉴 · ${ps[1].b}月${ps[2].s}${STEM_WX[STEMS.indexOf(ps[2].s)]}】</strong><br/>${escapeHtml(d.qiongtong)}</div>` : ''}
    </div>`;
  }

  // 专业细盘：大运 -> 流年 -> 流月联动 + 6柱细盘
  const dy = d.dayun[state.bzSelDyIdx] || d.dayun[0], ln = dy.liunian[state.bzSelLnIdx] || dy.liunian[0];
  const dm = ps[2].s;
  const makeExtraCol = obj => ({
    s: obj.s, b: obj.b, gz: obj.gz, swx: obj.swx, bwx: obj.bwx, shishen: obj.ss,
    hiddenList: HIDDEN_STEMS[obj.b].split('').map(hs => ({ s: hs, wx: STEM_WX[STEMS.indexOf(hs)], tg: getTenGod(dm, hs) })),
    xingyun: getChangSheng(dm, obj.b), nayin: getNaYin(obj.gz), kongwang: getXunKongOfGz(obj.gz)
  });
  const sixCols = [makeExtraCol(ln), makeExtraCol(dy), ...ps];
  const suiyunInter = calcGanZhiInteractions(sixCols);
  const lnYearStartS = [2,4,6,8,0][STEMS.indexOf(ln.s) % 5];
  const jieDates = ['2/4立春','3/5惊蛰','4/5清明','5/5立夏','6/5芒种','7/7小暑','8/7立秋','9/7白露','10/8寒露','11/7立冬','12/7大雪','1/5小寒'];
  const liuyue = Array.from({length:12}, (_, i) => {
    const s = STEMS[(lnYearStartS + i) % 10], b = BRANCHES[(2 + i) % 12];
    return { jie: jieDates[i], s, b, swx: STEM_WX[(lnYearStartS+i)%10], bwx: BRANCH_WX[(2+i)%12], ss: getShortTenGod(getTenGod(dm, s)), bss: getShortTenGod(getTenGod(dm, HIDDEN_STEMS[b][0])) };
  });

  return `<div class="card">${headHtml}${tabBar}
    <table class="bz-matrix" style="font-size:11.5px;">
      <thead><tr><th style="width:34px;">细盘</th><th style="color:var(--seal);">流年</th><th style="color:var(--accent);">大运</th><th>年</th><th>月</th><th>日</th><th>时</th></tr></thead>
      <tbody>
        <tr><td>主星</td>${sixCols.map(p=>`<td>${getShortTenGod(p.shishen)}</td>`).join('')}</tr>
        <tr><td>天干</td>${sixCols.map(p=>`<td><span class="bz-gz-char wx-${p.swx}" style="font-size:19px;">${p.s}</span></td>`).join('')}</tr>
        <tr><td>地支</td>${sixCols.map(p=>`<td><span class="bz-gz-char wx-${p.bwx}" style="font-size:19px;">${p.b}</span></td>`).join('')}</tr>
        <tr><td>藏干</td>${sixCols.map(p=>`<td style="font-size:10.5px;line-height:1.35;">${(p.hiddenList||[]).map(h=>`<span class="wx-${h.wx}">${h.s}</span>${getShortTenGod(h.tg)}`).join('<br/>')}</td>`).join('')}</tr>
        <tr><td>星运</td>${sixCols.map(p=>`<td>${p.xingyun||''}</td>`).join('')}</tr>
        <tr><td>空亡</td>${sixCols.map(p=>`<td>${p.kongwang||''}</td>`).join('')}</tr>
      </tbody>
    </table>
    <div style="font-size:12px;color:var(--text-3);margin-top:10px;display:flex;justify-content:space-between;"><span>大运（轻点切换流年）</span><span>${escapeHtml(d.startYunDesc||'')}</span></div>
    <div class="bz-h-strip">${d.dayun.map((item, idx) => `<button class="bz-step-btn ${idx===state.bzSelDyIdx?'active':''}" onclick="state.bzSelDyIdx=${idx};state.bzSelLnIdx=0;renderResultOverlay()"><div style="font-size:10px;opacity:0.75;">${item.startYear}<br/>${item.age}岁</div><div class="wx-${item.swx}" style="font-weight:700;font-size:14px;">${item.s}<span style="font-size:10px;">${getShortTenGod(item.ss)}</span></div><div class="wx-${item.bwx}" style="font-weight:700;font-size:14px;">${item.b}<span style="font-size:10px;">${getShortTenGod(item.bss)}</span></div></button>`).join('')}</div>
    <div style="font-size:12px;color:var(--text-3);margin-top:6px;">${dy.gz}大运 · 流年（轻点切换该年十二流月）</div>
    <div class="bz-h-strip">${dy.liunian.map((item, idx) => `<button class="bz-step-btn ${idx===state.bzSelLnIdx?'active':''}" onclick="state.bzSelLnIdx=${idx};renderResultOverlay()"><div style="font-size:10px;opacity:0.75;">${item.year}<br/>${item.age}岁</div><div class="wx-${item.swx}" style="font-weight:700;font-size:14px;">${item.s}<span style="font-size:10px;">${getShortTenGod(item.ss)}</span></div><div class="wx-${item.bwx}" style="font-weight:700;font-size:14px;">${item.b}<span style="font-size:10px;">${getShortTenGod(item.bss)}</span></div></button>`).join('')}</div>
    <div style="font-size:12px;color:var(--text-3);margin-top:6px;">${ln.year} ${ln.gz}年 · 十二流月</div>
    <div class="bz-h-strip">${liuyue.map(m => `<div class="bz-step-btn" style="min-width:50px;"><div style="font-size:9.5px;color:var(--text-3);">${m.jie}</div><div class="wx-${m.swx}" style="font-weight:700;">${m.s}${m.ss}</div><div class="wx-${m.bwx}" style="font-weight:700;">${m.b}${m.bss}</div></div>`).join('')}</div>
    <div class="wx-season-bar">${(d.seasonStates||[]).map(x => `<span style="background:${x.bg};">${x.wx}${x.state}</span>`).join('')}</div>
    <div style="padding:10px 12px;border-radius:13px;background:var(--bg);font-size:12.5px;line-height:1.7;">
      <div><strong>岁运天干：</strong>${suiyunInter.stems.join(' ｜ ') || '平和'}</div>
      <div><strong>岁运地支：</strong>${suiyunInter.branches.join(' ｜ ') || '平和'}</div>
      <div><strong>${dy.gz}运神煞：</strong>${(dy.shensha||[]).join(' · ')}</div>
    </div>
  </div>`;
}

function renderResultOverlay() {
  const rec = state.currentResult; if (!rec) return;
  document.getElementById('resOverlayTitle').textContent = rec.category + '断事卷宗';
  const wrap = document.getElementById('resultOverlayBody');
  const redivBanner = state.sameTopicHint ? `<div class="card" style="padding:11px 14px;background:var(--seal-soft);border-color:transparent;display:flex;justify-content:space-between;align-items:center;gap:8px;"><span style="font-size:12.5px;color:var(--seal);line-height:1.5;">初筮告提醒：近 3 天测过「${escapeHtml(state.sameTopicHint.title)}」，初占最准。</span><button class="pill-mini xs seal" onclick="openHistoryRecord('${state.sameTopicHint.id}')">看旧盘</button></div>` : '';
  let chartHtml = '';

  if (rec.category === '六爻') {
    const d = rec.data, mainHex = HEX_DATA.byKey[d.mainKey], simM = d.simMonthBranch || d.monthGz[1], simD = d.simDayBranch || d.dayGz[1];
    const exam = runLiuyaoPhysicalExam(mainHex, new Set(d.moving || []), simM, simD, d.xunkong);
    d.bianKey = exam.bianHex ? exam.bianHex.key : '';
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0, shensha = getShenSha(d.dayGz[0], d.dayGz[1]);
    const showTags = state.resultLayer !== 'clean';
    chartHtml = `
      <div class="card">
        <div class="case-header-grid">
          <div class="case-header-row"><span>姓　名：<strong class="priv-blur">${escapeHtml(rec.personName || rec.castTimeStr.slice(0,10))}</strong></span><span>性　别：<strong>${escapeHtml(rec.gender || '男')}</strong></span></div>
          <div class="case-header-row"><span>起卦时间：<strong>${escapeHtml(rec.castTimeStr || '')}</strong></span><span style="font-size:12.5px;color:var(--accent);">${escapeHtml(rec.lunarFull || ('农历'+rec.lunarStr))}</span></div>
          <div class="case-header-row"><span>求测方向：<strong>${escapeHtml(rec.dir || '一事一问')}</strong></span></div>
          ${rec.question ? `<div class="case-header-row"><span>求测问题：<strong class="priv-blur">${escapeHtml(rec.question)}</strong></span></div>` : ''}
          ${rec.contextText ? `<div class="case-header-row"><span>背景处境：<span class="priv-blur">${escapeHtml(rec.contextText)}</span></span></div>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;">${shensha.map(s => `<span class="chip" style="padding:4px 9px;font-size:12px;">${s.k}-${s.v}</span>`).join('')}</div>
        <div class="gz-banner">${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（空${d.xunkong}）</div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 12px;">
          ${[['clean','清净原盘'],['insight','生克透视'],['ruler','应期滑尺']].map(([k,l]) => `<button class="btn-secondary" style="padding:7.5px 2px;font-size:12.5px;${state.resultLayer===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="state.resultLayer='${k}';renderResultOverlay()">${l}</button>`).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;padding:4px 4px 8px;border-bottom:1px solid var(--border);">
          <span>主卦【${mainHex.palaceName}】${mainHex.name}</span>
          <span>${exam.bianHex ? `变卦【${exam.bianHex.palaceName}】${exam.bianHex.name}` : '静卦无变'}</span>
        </div>
        ${[5,4,3,2,1,0].map((i, ord) => {
          const r = exam.examRows[i], ls = LIU_SHEN[(lsStart + i) % 6], isYs = d.lockedYongshenPos === r.pos, b = r.bian;
          return `<div class="ly-row ${isYs?'yongshen':''}" style="animation-delay:${ord*0.03}s;" onclick="toggleLockYongshen(${r.pos})">
            <span style="color:var(--text-3);font-size:12px;">${ls}</span>
            <span style="font-size:10.5px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.fushen ? r.fushen.label : ''}</span>
            <div class="ly-main-cell">
              <span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span>
              <span class="wx-${r.wx}" style="font-weight:600;">${r.liuqin}${r.branch}${r.wx}</span>
              ${r.isShi?'<span class="yao-badge shi">世</span>':(r.isYing?'<span class="yao-badge ying">应</span>':'')}
              ${r.isKong?'<span class="yao-badge kong">空</span>':''}
              ${isYs?'<span class="yao-badge ys">用</span>':''}
            </div>
            <span style="text-align:center;color:var(--seal);font-weight:700;">${r.isMov ? (r.bit ? '○' : '×') : ''}</span>
            <div class="ly-bian-cell">${b ? `<span class="yao-svg ${b.bit?'yang':'yin'}"></span><span class="wx-${b.wx}">${b.liuqin}${b.branch}${b.wx}</span>` : ''}</div>
          </div>
          ${showTags ? `<div style="padding:2px 4px 7px;display:flex;flex-wrap:wrap;gap:4px;">
            ${r.tags.map(t => `<button class="exam-tag-btn ${/破|空|暗动|进神|退神|回头|反吟|伏/.test(t)?'hot':''}" onclick="event.stopPropagation();openTagTip('${escapeHtml(t)}')">${escapeHtml(t)}</button>`).join('')}
            ${r.relTags.map(rt => `<button class="exam-tag-btn rel" onclick="event.stopPropagation();openTagTip('${escapeHtml(rt)}')">${escapeHtml(rt)}</button>`).join('')}
          </div>` : ''}`;
        }).join('')}
        ${showTags && exam.sanheHits.length ? `<div style="margin-top:6px;font-size:12.5px;color:var(--accent);font-weight:600;">三合局：${exam.sanheHits.join(' · ')}</div>` : ''}
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-3);">
          <span>轻点爻行定用神 · 透视页点红/青标签遇象即查</span>
          <button class="pill-mini xs" onclick="state.showGuaci=!state.showGuaci;renderResultOverlay()">${state.showGuaci?'收起卦辞':'看卦辞'}</button>
        </div>
        ${state.showGuaci ? `<div style="margin-top:10px;padding:11px 13px;border-radius:13px;background:var(--bg);font-size:13.5px;line-height:1.72;"><strong>${mainHex.name}：</strong>${escapeHtml(mainHex.guaci)}${exam.bianHex ? `<br/><strong>变卦 ${exam.bianHex.name}：</strong>${escapeHtml(exam.bianHex.guaci)}` : ''}</div>` : ''}
      </div>
      ${state.resultLayer === 'ruler' ? `
      <div class="card" style="padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:13.5px;font-weight:600;">应期时间滑尺（拖动推演哪月哪日出空冲合）</span><button class="pill-mini xs" onclick="resetSimTime()">复原</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          <div>模拟月建：<strong>${simM}月</strong><input type="range" min="0" max="11" value="${BRANCHES.indexOf(simM)}" style="width:100%;accent-color:var(--accent);" oninput="updateSimBranch('m', Number(this.value))" /></div>
          <div>模拟日辰：<strong>${simD}日</strong><input type="range" min="0" max="11" value="${BRANCHES.indexOf(simD)}" style="width:100%;accent-color:var(--accent);" oninput="updateSimBranch('d', Number(this.value))" /></div>
        </div>
        <div class="ruler-insight-bar">${escapeHtml(buildRulerInsightText(exam.examRows, simM, simD, d.xunkong))}</div>
      </div>` : ''}
    `;
  } else if (rec.category === '八字') {
    chartHtml = renderBaziResultCard(rec);
  } else if (rec.category === '奇门') {
    const d = rec.data;
    chartHtml = `<div class="card"><div class="gz-banner">${d.dun} · ${d.type}</div><div style="font-size:13px;color:var(--text-2);line-height:1.7;margin-bottom:8px;"><div><strong>四柱：</strong>${d.gz}（空${d.xunkong}）</div><div><strong>值符：</strong><span style="color:var(--seal);font-weight:700;">${d.zhiFuStar}</span> · <strong>值使：</strong><span style="color:var(--seal);font-weight:700;">${d.zhiShiDoor}</span> · <strong>旬首：</strong>${d.xunShou} · <strong>马星：</strong>${d.yimaBr}${d.nianMingGz ? ` · <strong style="color:var(--seal);">年命 ${d.nianMingGz}</strong>` : ''}</div></div><div class="nine-grid">${d.palaces.map(p => `<div class="qimen-cell ${p.isNianMing?'nianming':''}"><div class="qimen-row"><span style="color:var(--text-3);">${p.god}</span><span style="color:var(--seal);font-weight:700;">${p.isNianMing?'命':''}${p.isKong?'空':''}${p.isMa?'马':''}${(p.warns||[]).join('')}</span></div><div class="qimen-row"><span style="font-weight:700;">${p.star}</span><strong style="font-size:14px;">${p.tian}</strong></div><div class="qimen-row"><span style="color:var(--accent);font-weight:600;">${p.door}</span><span>${p.di}</span></div><div class="qimen-row" style="font-size:10px;color:var(--text-3);"><span>${p.gName}</span><span>暗${p.anGan||'-'}</span></div></div>`).join('')}</div><div style="font-size:11.5px;color:var(--text-3);margin-top:8px;">红标提示：迫=门迫、刑=击刑、墓=入墓、空=空亡、马=马星</div></div>`;
  } else if (rec.category === '梅花') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey], hh = HEX_DATA.byKey[d.huKey], bh = HEX_DATA.byKey[d.bianKey];
    const drawMini = (hex, mov) => `<div style="display:flex;flex-direction:column;gap:4px;margin:8px auto;width:54px;">${[5,4,3,2,1,0].map(i=>`<div style="height:5px;width:100%;border-radius:2px;display:flex;justify-content:space-between;${hex.bits[i]?'background:'+(mov===i+1?'var(--seal)':'var(--text)')+';':''}">${hex.bits[i]?'':`<span style="width:43%;height:100%;border-radius:2px;background:${mov===i+1?'var(--seal)':'var(--text)'};"></span><span style="width:43%;height:100%;border-radius:2px;background:${mov===i+1?'var(--seal)':'var(--text)'};"></span>`}</div>`).join('')}</div>`;
    chartHtml = `<div class="card"><div class="gz-banner">${d.gz}（空${d.xunkong}）</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;"><div class="pillar-col"><div class="pillar-lbl">本卦(${d.movPos}爻动)</div>${drawMini(mh, d.movPos)}<strong>${mh.name}</strong></div><div class="pillar-col"><div class="pillar-lbl">互卦(过程)</div>${drawMini(hh, 0)}<strong>${hh.name}</strong></div><div class="pillar-col"><div class="pillar-lbl">变卦(结局)</div>${drawMini(bh, 0)}<strong>${bh.name}</strong></div></div><div style="margin-top:12px;font-size:14px;font-weight:600;color:var(--accent);text-align:center;">体卦 ${d.tiName} vs 用卦 ${d.yongName}<br/>${d.tiYongRel}</div><div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--bg);font-size:13px;line-height:1.68;"><strong>本卦卦辞：</strong>${escapeHtml(mh.guaci)}</div></div>`;
  } else if (rec.category === '六壬') {
    const d = rec.data;
    chartHtml = `<div class="card"><div class="gz-banner">${d.gz}</div><div style="font-size:13.5px;color:var(--text-2);margin-bottom:10px;"><strong>月将：</strong>${d.yueJiang} · <strong>贵人：</strong>${d.guiType} · <strong>旬空：</strong>${d.xunkong}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">${d.sanchuan.map(c => `<div class="nine-cell"><div style="color:var(--text-3);font-size:11px;">${c.lbl}</div><div style="font-size:16px;font-weight:700;color:var(--seal);">${c.br}</div><div>${c.lq} · ${c.jiang}</div></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${d.sike.map(k => `<div class="nine-cell"><div style="font-size:10.5px;color:var(--text-3);">${k.jiang}</div><div style="font-weight:700;">${k.top} / ${k.bot}</div><div style="font-size:10px;color:var(--text-3);">${k.lbl}</div></div>`).join('')}</div></div>`;
  } else {
    const d = rec.data;
    chartHtml = `<div class="card"><div class="gz-banner">${d.gz}</div><div style="font-size:13.5px;color:var(--text-2);margin-bottom:8px;"><strong>五行局：</strong>${d.wuxingJu || ''} · <strong>生年四化：</strong><span style="color:var(--seal);font-weight:600;">${d.sihua || ''}</span></div><div class="nine-grid">${(d.gongs || []).map(g => `<div class="nine-cell"><strong>${g.name}（${g.branch}）</strong><br/>${g.star}</div>`).join('')}</div></div>`;
  }

  const catBooks = state.books.filter(b => b.category === rec.category || b.category === '其他');
  const bookSelectorHtml = catBooks.length ? `<div style="margin-bottom:12px;"><div style="font-size:13px;color:var(--text-2);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><span>选择参考典籍（多选即对照比较）</span><button class="pill-mini xs" onclick="selectAllCatBooks('${rec.category}')">全选</button></div><div style="display:flex;flex-wrap:wrap;gap:6px;">${catBooks.map(b => `<button class="chip ${state.selectedBookIds.includes(b.id)?'accent':''}" onclick="toggleSelectBookForAI('${b.id}')">${escapeHtml(b.title)}</button>`).join('')}</div></div>` : `<div style="font-size:13px;color:var(--text-3);margin-bottom:10px;">书房暂无「${rec.category}」典籍，将按经典硬理法推演。</div>`;

  const selfJudgeHtml = `
    <div style="margin-bottom:12px;padding:11px 13px;border-radius:14px;background:var(--bg);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:600;">先自己盲断一下，再让 AI 对照纠偏</span>
        <button class="pill-mini xs ${state.showSelfJudge?'accent':''}" onclick="state.showSelfJudge=!state.showSelfJudge;renderResultOverlay()">${state.showSelfJudge?'收起':'开启自断'}</button>
      </div>
      ${state.showSelfJudge ? `
        <div style="display:flex;gap:8px;margin:10px 0;">${['成','败','反复'].map(v => `<button class="chip ${state.selfVerdict===v?'seal':''}" onclick="state.selfVerdict='${v}';renderResultOverlay()">我判：${v}</button>`).join('')}</div>
        <textarea class="form-textarea" style="min-height:54px;background:var(--surface);" placeholder="一句话写下你的判断依据..." oninput="state.selfReason=this.value">${escapeHtml(state.selfReason)}</textarea>
      ` : ''}
    </div>
  `;

  const reps = rec.reports || [], activeRep = reps[state.activeReportTab] || null;
  const reportsHtml = reps.length ? `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;">${reps.map((rp, idx) => `<button class="chip ${idx===state.activeReportTab?'accent':''}" onclick="state.activeReportTab=${idx};renderResultOverlay()">${escapeHtml(rp.label)}</button>`).join('')}</div><div style="font-size:15px;line-height:1.78;padding:13px 15px;border-radius:16px;background:var(--bg);">${formatRichText(activeRep.content)}</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;"><button class="chip" onclick="followUpFromResult()">继续追问参悟</button><button class="chip seal" onclick="feedbackResultToBrain()">记一条纠偏备忘</button></div>` : `<div style="font-size:13px;color:var(--text-3);padding:4px 0;">AI 会严格根据算死的硬数据与书库，分三层（吉凶定性 / 细节象意 / 具体应期）说人话剖析。</div>`;

  const groupOpts = ['默认', ...(state.settings.groups || [])];
  wrap.innerHTML = `${redivBanner}${chartHtml}
    <div class="card">
      <div class="card-head"><span class="card-title">参悟 AI 选书剖析</span></div>
      ${bookSelectorHtml}${selfJudgeHtml}
      <button class="btn-primary" style="width:100%;margin-bottom:12px;" id="runChartAiBtn" onclick="runSelectedBooksAnalysis()">${reps.length ? '+ 再做一份对比分析' : (state.showSelfJudge && state.selfReason.trim() ? '提交自断并看 AI 对照剖析' : '开始参悟精准分析')}</button>
      ${reportsHtml}
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">事后复盘、应验与反推</span>
        <select class="form-select" style="width:auto;padding:5px 10px;font-size:13px;" onchange="state.currentResult.verdict=this.value"><option value="pending" ${rec.verdict==='pending'?'selected':''}>待验证</option><option value="hit" ${rec.verdict==='hit'?'selected':''}>已应验</option><option value="miss" ${rec.verdict==='miss'?'selected':''}>有偏差</option></select>
      </div>
      <div class="form-field"><textarea class="form-textarea priv-blur" placeholder="记录自己的思路..." oninput="state.currentResult.note=this.value">${escapeHtml(rec.note || '')}</textarea></div>
      <div class="form-field"><label class="form-label">真实应验结果（填完可点下方「AI 事后反推」）</label><textarea class="form-textarea priv-blur" style="min-height:58px;" placeholder="后来实际发生了什么..." oninput="state.currentResult.outcome=this.value">${escapeHtml(rec.outcome || '')}</textarea></div>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button class="btn-secondary" style="flex:1;color:var(--seal);font-weight:600;" id="retroAiBtn" onclick="runOutcomeRetrospective()">AI 事后反推（错一卦长一寸）</button>
        <button class="btn-primary" style="padding:10px 16px;" onclick="openSaveArchiveSheet()">选分组存档</button>
      </div>
      <div style="font-size:12px;color:var(--text-3);">当前归属分组：${escapeHtml(rec.group || '默认')}</div>
    </div>
  `;
}

function toggleLockYongshen(pos) { const d = state.currentResult.data; d.lockedYongshenPos = d.lockedYongshenPos === pos ? null : pos; renderResultOverlay(); }
function updateSimBranch(t, i) { if (t === 'm') state.currentResult.data.simMonthBranch = BRANCHES[i]; else state.currentResult.data.simDayBranch = BRANCHES[i]; renderResultOverlay(); }
function resetSimTime() { const d = state.currentResult.data; d.simMonthBranch = d.monthGz[1]; d.simDayBranch = d.dayGz[1]; renderResultOverlay(); }
function toggleSelectBookForAI(id) { const i = state.selectedBookIds.indexOf(id); if (i >= 0) state.selectedBookIds.splice(i, 1); else state.selectedBookIds.push(id); renderResultOverlay(); }
function selectAllCatBooks(cat) { state.selectedBookIds = state.books.filter(b => b.category === cat || b.category === '其他').map(b => b.id); renderResultOverlay(); }

// 存档案选分组抽屉
function openSaveArchiveSheet() {
  const rec = state.currentResult; if (!rec) return;
  state.saveArchPickGroup = rec.group || '默认';
  document.getElementById('saveArchTitleInput').value = rec.title || '';
  renderSaveArchGroupChips();
  openSheet('sheet-save-archive');
}
function renderSaveArchGroupChips() {
  const groups = ['默认', ...(state.settings.groups || [])];
  document.getElementById('saveArchGroupChips').innerHTML = groups.map(g => `<button class="chip ${state.saveArchPickGroup===g?'accent':''}" onclick="state.saveArchPickGroup='${escapeHtml(g)}';renderSaveArchGroupChips()">${escapeHtml(g)}</button>`).join('');
}
async function confirmSaveArchiveWithGroup() {
  const rec = state.currentResult; if (!rec) return;
  rec.title = document.getElementById('saveArchTitleInput').value.trim() || rec.title;
  rec.group = state.saveArchPickGroup || '默认';
  await saveCurrentResultToArchive();
  closeSheet('sheet-save-archive');
  renderResultOverlay();
}
async function saveCurrentResultToArchive() {
  const rec = state.currentResult; if (!rec) return;
  rec.updatedAt = Date.now();
  await dbPut('archives', rec);
  state.archives = state.archives.filter(a => a.id !== rec.id);
  state.archives.push(rec);
  await markDirty();
  updateFollowupBadge();
  showToast(`已存入档案库 · ${rec.group || '默认'}`);
}

// 一键复制专业盘面文本（外援通道）
function copyCurrentChartText() {
  const rec = state.currentResult; if (!rec) return;
  const txt = buildChartDigestForAI(rec);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => showToast('完整盘面文本已复制，可直接发给其他 AI')).catch(() => fallbackCopy(txt));
  } else fallbackCopy(txt);
}
function fallbackCopy(txt) {
  const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('完整盘面文本已复制'); } catch (e) { showToast('复制失败'); }
  ta.remove();
}

function exportResultPoster() {
  const rec = state.currentResult; if (!rec) return;
  const c = document.createElement('canvas'); c.width = 750; c.height = 1040; const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4F2EC'; ctx.fillRect(0, 0, 750, 1040); ctx.fillStyle = '#1E2022'; ctx.font = 'bold 34px serif'; ctx.fillText('藏往 · ' + rec.category + '卷宗', 52, 88);
  ctx.fillStyle = '#5D615E'; ctx.font = '22px sans-serif'; ctx.fillText('时间：' + (rec.castTimeStr || '') + ' ' + (rec.lunarFull || ''), 52, 130); ctx.fillText('事项：' + (rec.title || '').slice(0, 26), 52, 166);
  let y = 224; ctx.fillStyle = '#1E2022'; ctx.font = '20px sans-serif';
  const txt = (rec.reports?.[state.activeReportTab]?.content || rec.note || buildChartDigestForAI(rec)).replace(/\n+/g, ' ');
  for (let i = 0; i < Math.min(txt.length, 460); i += 29) { ctx.fillText(txt.slice(i, i + 29), 52, y); y += 34; if (y > 980) break; }
  const a = document.createElement('a'); a.download = `藏往_${rec.category}_${formatDateKey(new Date())}.png`; a.href = c.toDataURL('image/png'); a.click(); showToast('水墨卷宗长图已生成');
}
