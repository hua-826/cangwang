// ==================== 藏往 V9 · 核心引擎与七门排盘 (engine.js) ====================
const DB_NAME = 'CangwangV6DB';
const DB_VER = 1;
let dbInst = null, preparedBackupBlob = null, preparedBackupName = '', audioCtx = null;
const STORES = ['books','pdfBlobs','chapters','notes','archives','chats','memories','hexCache','dailyDraws','footprints','meta'];

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

const state = {
  mainTab: 'divine', category: '六爻', extraCatsOpen: false, subTab: 'cast',
  libFilter: '全部', quickTransInput: '', quickTransBook: '', quickTransOut: '',
  studySub: 'kb', studyGroup: '六爻基础',
  practiceMode: 'flash', flashIdx: 0, flashFlipped: false,
  blindCase: null, blindSubmitted: false, blindUserYs: '妻财', blindUserVerdict: '成', blindUserReason: '', blindAiReview: '',
  flawIdx: 0, flawCustom: null, flawUserAns: '', flawAiReview: '',
  activeArticle: null, activeArticleSource: '通用精讲',
  archCategory: '六爻', archGroup: '全部', canwuRoom: '六爻',
  activeThreadId: null, privacyOn: false, userScrolledUp: false, isStreaming: false,
  noteSearch: '', editingNoteId: null, activeTagTipKey: '',
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(), calSelectedDate: '', calYiFilter: '',
  currentResult: null, resultLayer: 'insight', showGuaci: false,
  showSelfJudge: false, selfVerdict: '成', selfReason: '',
  selectedBookIds: [], activeReportTab: 0,
  books: [], chapters: [], notes: [], archives: [], chats: [], memories: [], footprints: {}, customDict: [], customFlash: [],
  reader: { bookId: null, pdfMode: false, readMode: 'orig', pageNum: 1, totalPages: 1, barsHidden: false, activeParaText: '', pdfDoc: null },
  settings: {
    theme: 'shuimo', coinSound: true, apiKey: '', baseUrl: 'https://api.deepseek.com',
    flashModel: 'deepseek-chat', proModel: 'deepseek-reasoner', useTier: 'flash',
    redactNames: true, myDayPillar: '', syncUrl: '', vaultPass: '', e2eEncrypt: true,
    fontSize: 17.5, fontFam: 'serif', paper: 'warm',
    groups: ['亲人','伴侣','朋友','客户','自己'],
    weakSpots: [], articleSourceCache: {},
    tokensIn: 0, tokensOut: 0, dirtySinceBackup: false, lastSyncAt: ''
  }
};

function uid(p = 'id') { return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
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
  document.getElementById('drawerPrivState').textContent = state.privacyOn ? '开' : '关';
  document.getElementById('sideDrawerBackdrop').classList.add('open');
  document.getElementById('sideDrawer').classList.add('open');
}
function closeSideDrawer() { document.getElementById('sideDrawerBackdrop').classList.remove('open'); document.getElementById('sideDrawer').classList.remove('open'); }
function openSheet(id) { if (id === 'sheet-import') document.getElementById('importCatSelect').value = state.category; document.getElementById(id).classList.add('open'); }
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

function buildDisciplineStripHtml(activeCat, onSelectFnName) {
  const isExtraActive = EXTRA_CATS.includes(activeCat);
  const showExtra = state.extraCatsOpen || isExtraActive;
  return `
    ${CORE_CATS.map(c => `<button class="cat-pill ${c===activeCat?'active':''}" onclick="${onSelectFnName}('${c}')">${c}</button>`).join('')}
    <div class="cat-extra-wrap ${showExtra?'expanded':''}">
      <span class="cat-divider"></span>
      ${EXTRA_CATS.map(c => `<button class="cat-pill ${c===activeCat?'active':''}" onclick="${onSelectFnName}('${c}')">${c}</button>`).join('')}
    </div>
    <button class="cat-pill more-toggle" onclick="toggleExtraCats()">${showExtra ? '‹ 收起' : '更多 ▸'}</button>
  `;
}
function toggleExtraCats() { state.extraCatsOpen = !state.extraCatsOpen; renderCatStrip(); renderCanwuRoomStrip(); }
function bindCatSwipe(el) {
  if (!el || el._swipeBound) return;
  el._swipeBound = true;
  let sx = 0;
  el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (dx < -40 && !state.extraCatsOpen) { state.extraCatsOpen = true; renderCatStrip(); renderCanwuRoomStrip(); }
    else if (dx > 50 && state.extraCatsOpen && !EXTRA_CATS.includes(state.category)) { state.extraCatsOpen = false; renderCatStrip(); renderCanwuRoomStrip(); }
  }, { passive: true });
}

// ==================== 历法核心、六十四卦与六爻硬核体检 ====================
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_WX = ['木','木','火','火','土','土','金','金','水','水'];
const BRANCH_WX = ['水','土','木','木','土','火','火','土','金','金','土','水'];
const HIDDEN_STEMS = { '子':'癸','丑':'己癸辛','寅':'甲丙戊','卯':'乙','辰':'戊乙癸','巳':'丙庚戊','午':'丁己','未':'己丁乙','申':'庚壬戊','酉':'辛','戌':'戊辛丁','亥':'壬甲' };
const LIU_HE = {'子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午'};
const LIU_CHONG = {'子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳'};
const JIN_SHEN = {'亥':'子','寅':'卯','巳':'午','申':'酉','丑':'辰','辰':'未','未':'戌','戌':'丑'};
const TUI_SHEN = {'子':'亥','卯':'寅','午':'巳','酉':'申','辰':'丑','未':'辰','戌':'未','丑':'戌'};
const SAN_HE = [{ set:['申','子','辰'], wx:'水', name:'申子辰水局' },{ set:['亥','卯','未'], wx:'木', name:'亥卯未木局' },{ set:['寅','午','戌'], wx:'火', name:'寅午戌火局' },{ set:['巳','酉','丑'], wx:'金', name:'巳酉丑金局' }];
const LIU_SHEN = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
const LIU_SHEN_START = { '甲':0,'乙':0,'丙':1,'丁':1,'戊':2,'己':3,'庚':4,'辛':4,'壬':5,'癸':5 };
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

function getLiuQin(pWx, lWx) {
  const r = { '木':{'木':'兄弟','火':'子孙','土':'妻财','金':'官鬼','水':'父母'}, '火':{'火':'兄弟','土':'子孙','金':'妻财','水':'官鬼','木':'父母'}, '土':{'土':'兄弟','金':'子孙','水':'妻财','木':'官鬼','火':'父母'}, '金':{'金':'兄弟','水':'子孙','木':'妻财','火':'官鬼','土':'父母'}, '水':{'水':'兄弟','木':'子孙','火':'妻财','土':'官鬼','金':'父母'} };
  return r[pWx]?.[lWx] || '';
}
function getTenGod(ds, os) {
  const d = STEMS.indexOf(ds), o = STEMS.indexOf(os); if (d < 0 || o < 0) return '';
  return [['比肩','劫财'],['食神','伤官'],['偏财','正财'],['七杀','正官'],['偏印','正印']][(Math.floor(o/2) - Math.floor(d/2) + 5) % 5][(d%2)===(o%2)?0:1];
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
function getAstroDayInfo(dateObj) {
  const y = dateObj.getFullYear(), m = dateObj.getMonth() + 1, d = dateObj.getDate(), h = dateObj.getHours(), min = dateObj.getMinutes();
  const makeP = gz => ({ gz, s: gz[0], b: gz[1], swx: STEM_WX[STEMS.indexOf(gz[0])] || '土', bwx: BRANCH_WX[BRANCHES.indexOf(gz[1])] || '土' });
  if (typeof window.Solar !== 'undefined') {
    const solar = window.Solar.fromYmdHms(y, m, d, h, min, 0), lunar = solar.getLunar(), ec = lunar.getEightChar();
    const dp = makeP(ec.getDay()), jieqi = lunar.getJieQi() || '';
    return { year: makeP(ec.getYear()), month: makeP(ec.getMonth()), day: dp, hour: makeP(ec.getTime()), xunkong: lunar.getDayXunKong(), lunarStr: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`, jieqi, yi: lunar.getDayYi() || [], ji: lunar.getDayJi() || [], chong: lunar.getDayChongDesc ? lunar.getDayChongDesc() : ('冲' + LIU_CHONG[dp.b]) };
  }
  const dIdx = ((40 + Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 10, 26)) / 86400000)) % 60 + 60) % 60;
  const dS = dIdx % 10, dB = dIdx % 12, yIdx = ((((m === 1 || (m === 2 && d < 4)) ? y - 1 : y) - 4) % 60 + 60) % 60;
  const yS = yIdx % 10, yB = yIdx % 12;
  let mOff = 10; [[1,6,11],[2,4,0],[3,6,1],[4,5,2],[5,6,3],[6,6,4],[7,7,5],[8,8,6],[9,8,7],[10,8,8],[11,7,9],[12,7,10]].forEach(([jm,jd,off]) => { if (m > jm || (m === jm && d >= jd)) mOff = off; });
  const mB = (2 + mOff) % 12, mS = ([2,4,6,8,0][yS % 5] + mOff) % 10, hB = Math.floor(((h + 1) % 24) / 2), hS = ([0,2,4,6,8][dS % 5] + hB) % 10;
  const k1 = (dB - dS + 22) % 12, dp = makeP(STEMS[dS] + BRANCHES[dB]);
  return { year: makeP(STEMS[yS]+BRANCHES[yB]), month: makeP(STEMS[mS]+BRANCHES[mB]), day: dp, hour: makeP(STEMS[hS]+BRANCHES[hB]), xunkong: BRANCHES[k1]+BRANCHES[(k1+1)%12], lunarStr: '', jieqi: '', yi: ['祈福','出行','交易'], ji: ['动土'], chong: '冲'+LIU_CHONG[dp.b] };
}

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
    const tags = [], mRel = getWxRelation(mWx, ln.wx), dRel = getWxRelation(dWx, ln.wx);
    if (ln.branch === monthBranch) tags.push('临月建'); else if (LIU_CHONG[monthBranch] === ln.branch) tags.push('月破'); else if (LIU_HE[monthBranch] === ln.branch) tags.push('月合'); else if (mRel === '生' || mRel === '比和') tags.push('月旺'); else if (mRel === '克') tags.push('月克'); else tags.push('月休囚');
    if (ln.branch === dayBranch) tags.push('临日辰'); else if (LIU_CHONG[dayBranch] === ln.branch) tags.push((mRel === '生' || mRel === '比和' || ln.branch === monthBranch) ? '暗动' : '日破'); else if (LIU_HE[dayBranch] === ln.branch) tags.push('日合'); else if (dRel === '生') tags.push('日生'); else if (dRel === '克') tags.push('日克');
    if (xunkong.includes(ln.branch)) tags.push('旬空');
    if (isMov && bLn) {
      if (JIN_SHEN[ln.branch] === bLn.branch) tags.push('化进神'); else if (TUI_SHEN[ln.branch] === bLn.branch) tags.push('化退神');
      else { const bRel = getWxRelation(bLn.wx, ln.wx); if (bRel === '生') tags.push('回头生'); else if (bRel === '克') tags.push('回头克'); if (LIU_CHONG[ln.branch] === bLn.branch) tags.push('反吟冲'); if (LIU_HE[ln.branch] === bLn.branch) tags.push('化合'); }
      if (xunkong.includes(bLn.branch)) tags.push('化空');
    }
    if (ln.fushen) tags.push(`伏${ln.fushen.label}`);
    return { ...ln, isMov, bian: bLn, tags };
  });
  const sanheHits = [];
  SAN_HE.forEach(g => { const m = g.set.filter(br => activeBranches.has(br)); if (m.length === 3) sanheHits.push(`成${g.name}`); else if (m.length === 2) sanheHits.push(`半合${g.name}(待${g.set.find(x => !m.includes(x))})`); });
  return { bianHex, examRows, sanheHits };
}

// ==================== 万年干支历（格子含极简干支 + 底部四柱五行色） ====================
function openCalendarOverlay() { renderCalendarView(); openOverlay('calendarOverlay'); }
function getYingqiFlagsMap() { const m = {}; state.archives.forEach(a => (a.yingqiDates || []).forEach(dt => { if (!m[dt]) m[dt] = []; m[dt].push(a.title); })); return m; }
function renderCalendarView() {
  const wrap = document.getElementById('calendarScrollArea'), y = state.calYear, m = state.calMonth;
  const startDow = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate(), prevDays = new Date(y, m, 0).getDate();
  const todayKey = formatDateKey(new Date()), flagsMap = getYingqiFlagsMap();
  let cells = '';
  for (let i = startDow - 1; i >= 0; i--) cells += `<div class="cal-cell other"><span class="cal-day-num">${prevDays - i}</span></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m, d, 12, 0), key = formatDateKey(dt), info = getAstroDayInfo(dt);
    const isSel = key === state.calSelectedDate, isToday = key === todayKey, goodMatch = state.calYiFilter && info.yi.some(x => x.includes(state.calYiFilter));
    cells += `<div class="cal-cell ${isSel?'selected':''} ${isToday?'today':''} ${goodMatch?'good-match':''}" onclick="selectCalDate('${key}')">
      <span class="cal-day-num">${d}</span>
      <span class="cal-gz-mini">${info.day.gz}</span>
      ${info.jieqi ? `<span class="cal-jq-mini">${escapeHtml(info.jieqi)}</span>` : ''}
      <div class="cal-dots">${state.footprints[key]?'<span class="dot-study"></span>':''}${flagsMap[key]?'<span class="dot-flag"></span>':''}</div>
    </div>`;
  }
  const [sy, sm, sd] = state.calSelectedDate.split('-').map(Number), info = getAstroDayInfo(new Date(sy, sm - 1, sd, new Date().getHours(), new Date().getMinutes()));
  const my = (state.settings.myDayPillar || '').trim();
  const resTip = my.length >= 2 ? `今日为你本命【${getTenGod(my[0], info.day.s)}】${LIU_CHONG[my[1]]===info.day.b?'，日支相冲宜守静':(LIU_HE[my[1]]===info.day.b?'，日支六合利协作':'，气场平稳有序')}` : '';
  wrap.innerHTML = `
    ${resTip ? `<div class="card" style="padding:13px 16px;background:var(--accent-soft);border-color:transparent;"><div style="font-size:13.5px;color:var(--accent);"><strong>天时共振：</strong>${escapeHtml(resTip)}</div></div>` : ''}
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
        <button class="pill-mini accent" onclick="instantCastFromCal()">即时起盘</button>
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

// ==================== 七门排盘交互（六爻「指定」首位 + 灵石 + 奇门专业选局） ====================
function getNowDatetimeLocal() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

const castState = {
  lyMode: 'spec', // 默认「指定」排第一，直触 6 条墨线
  lySpecYaos: [7, 7, 7, 7, 7, 7], // 初爻..上爻：7少阳 8少阴 9老阳 6老阴
  lyYaoRolls: [], lyGender: '男', lyDir: '一事一问', lyQuestion: '', lyContext: '', lyDate: getNowDatetimeLocal(), lyDateManual: false,
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
    if (!castState.lyDateManual && castState.lyDate !== nowStr) { castState.lyDate = nowStr; const el = document.getElementById('liveLyDateInput'); if (el) el.value = nowStr; }
    if (!castState.qmDateManual && castState.qmDate !== nowStr) { castState.qmDate = nowStr; const el = document.getElementById('liveQmDateInput'); if (el) el.value = nowStr; }
    if (!castState.lrDateManual && castState.lrDate !== nowStr) { castState.lrDate = nowStr; const el = document.getElementById('liveLrDateInput'); if (el) el.value = nowStr; }
    if (!castState.mhDateManual && castState.mhDate !== nowStr) { castState.mhDate = nowStr; const el = document.getElementById('liveMhDateInput'); if (el) el.value = nowStr; }
  }, 1000);
}

let isHoldingCast = false, holdClinkTimer = null, phoneShakeTimer = null, phoneIsShaking = false;
function startHoldCast(e) {
  if (e) e.preventDefault();
  if (castState.lyYaoRolls.length >= 6) { submitLiuyaoByMode(); return; }
  if (isHoldingCast) return;
  isHoldingCast = true;
  const ring = document.getElementById('zenCastRing'); if (ring) ring.classList.add('holding');
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
      if (!phoneIsShaking) {
        phoneIsShaking = true;
        document.getElementById('zenCastRing')?.classList.add('holding');
      }
      playStoneSound(false); clearTimeout(phoneShakeTimer);
      phoneShakeTimer = setTimeout(() => { phoneIsShaking = false; settleOneLiuyao(); }, 460);
    }
  });
}

function toggleTouchYaoSign(idx) {
  const v = castState.lySpecYaos[idx];
  castState.lySpecYaos[idx] = { 7:8, 8:7, 9:6, 6:9 }[v] || 7;
  playStoneSound(false); renderDivineView();
}
function toggleTouchYaoMov(idx) {
  const v = castState.lySpecYaos[idx];
  castState.lySpecYaos[idx] = { 7:9, 9:7, 8:6, 6:8 }[v] || 7;
  playStoneSound(true); renderDivineView();
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
    const bits = castState.lySpecYaos.map(v => (v === 7 || v === 9) ? 1 : 0);
    const previewHex = HEX_DATA.byKey[(bits[3]+(bits[4]<<1)+(bits[5]<<2)) + '_' + (bits[0]+(bits[1]<<1)+(bits[2]<<2))];
    modeHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12.5px;color:var(--text-3);">
        <span>轻点墨线切阴阳 · 点右侧切动爻</span>
        <strong style="color:var(--text);font-family:'Songti SC',serif;font-size:14.5px;">${previewHex ? previewHex.name : ''}</strong>
      </div>
      <div class="touch-hex-board">
        ${[5,4,3,2,1,0].map(i => {
          const v = castState.lySpecYaos[i], isYang = (v === 7 || v === 9), isMov = (v === 6 || v === 9);
          return `<div class="touch-yao-row">
            <span class="touch-yao-pos">${names[i]}</span>
            <button class="touch-yao-bar-btn" onclick="toggleTouchYaoSign(${i})" title="切换阴阳">
              <span class="ink-stroke ${isYang?'yang':'yin'} ${isMov?'mov':''}"></span>
            </button>
            <button class="touch-mov-btn ${isMov?'active':''}" onclick="toggleTouchYaoMov(${i})" title="切换动静">${isMov ? (isYang ? '○' : '×') : '静'}</button>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-secondary" onclick="castState.lySpecYaos=[7,7,7,7,7,7];renderDivineView()">重置</button>
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
      <div class="form-row"><span class="form-row-lbl">求测事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="一句话写下所问之事" value="${escapeHtml(castState.lyQuestion)}" oninput="castState.lyQuestion=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">起卦时间</span><div class="form-row-val"><input id="liveLyDateInput" type="datetime-local" class="inline-input" value="${castState.lyDate}" onchange="castState.lyDate=this.value;castState.lyDateManual=true;renderDivineView()" />${castState.lyDateManual ? `<button class="pill-mini accent" onclick="castState.lyDateManual=false;castState.lyDate=getNowDatetimeLocal();renderDivineView()">实时</button>` : ''}</div></div>
      <div class="form-row"><span class="form-row-lbl">性别 · 方向</span><div class="form-row-val"><select class="form-select" style="width:auto;padding:4px 6px;border:none;background:transparent;font-size:14px;" onchange="castState.lyDir=this.value">${['一事一问','求财开单','事业求职','感情姻缘','学业考试','健康出行','失物寻人'].map(d => `<option ${castState.lyDir===d?'selected':''}>${d}</option>`).join('')}</select><div class="gender-pill"><button class="${castState.lyGender==='男'?'active':''}" onclick="castState.lyGender='男';renderDivineView()">男</button><button class="${castState.lyGender==='女'?'active':''}" onclick="castState.lyGender='女';renderDivineView()">女</button></div></div></div>
    </div>
    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:4px;">${modes.map(([k,lbl]) => `<button class="btn-secondary" style="padding:8px 2px;font-size:13.5px;${castState.lyMode===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="castState.lyMode='${k}';renderDivineView()">${lbl}</button>`).join('')}</div>
      ${modeHtml}
    </div>
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:7px;">补充背景与具体处境（选填，让 AI 结合现实断）</div>
      <textarea class="form-textarea priv-blur" style="min-height:62px;" placeholder="把前因后果、目前卡点或对方态度直接写在这里..." oninput="castState.lyContext=this.value">${escapeHtml(castState.lyContext)}</textarea>
    </div>
  `;
}

function tossLiuyaoAll() { playStoneSound(true); castState.lyYaoRolls = []; for (let i = 0; i < 6; i++) { const c = [Math.random()<0.5?1:0, Math.random()<0.5?1:0, Math.random()<0.5?1:0]; castState.lyYaoRolls.push({ stones: c, val: [9,8,7,6][c[0]+c[1]+c[2]] }); } submitLiuyaoByMode(); }
function submitLiuyaoByMode() {
  const dt = castState.lyDateManual && castState.lyDate ? new Date(castState.lyDate) : new Date(), info = getAstroDayInfo(dt);
  let mainHex = HEX_DATA.byKey['7_7']; const movSet = new Set();
  if (castState.lyMode === 'spec') {
    const bits = castState.lySpecYaos.map(v => (v === 7 || v === 9) ? 1 : 0);
    castState.lySpecYaos.forEach((v, i) => { if (v === 6 || v === 9) movSet.add(i + 1); });
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
  openLiuyaoResult({ id: uid('arc'), category: '六爻', title: castState.lyQuestion.trim() || `${mainHex.name}（${castState.lyDir}）`, personName: '', gender: castState.lyGender, group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr, contextText: castState.lyContext.trim(), data: { mainKey: mainHex.key, moving: Array.from(movSet), yearGz: info.year.gz, monthGz: info.month.gz, dayGz: info.day.gz, hourGz: info.hour.gz, xunkong: info.xunkong, simMonthBranch: info.month.b, simDayBranch: info.day.b, lockedYongshenPos: null }, reports: [], note: '', outcome: '', verdict: 'pending' });
}

function renderBaziCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">命主姓名</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="非必填" value="${escapeHtml(castState.bzName)}" oninput="castState.bzName=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.bzGender==='男'?'active':''}" onclick="castState.bzGender='男';renderDivineView()">男</button><button class="${castState.bzGender==='女'?'active':''}" onclick="castState.bzGender='女';renderDivineView()">女</button></div></div></div><div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><input type="datetime-local" class="inline-input" value="${castState.bzDate}" onchange="castState.bzDate=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">出生城市</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.bzCity=this.value;renderDivineView()">${Object.keys(CITIES_LON).map(c => `<option ${castState.bzCity===c?'selected':''}>${c}</option>`).join('')}</select></div></div><div class="form-row"><span class="form-row-lbl">真太阳时</span><div class="form-row-val"><label style="font-size:14px;display:flex;align-items:center;gap:6px;"><input type="checkbox" ${castState.bzTrueSolar?'checked':''} onchange="castState.bzTrueSolar=this.checked;renderDivineView()" />东经 ${CITIES_LON[castState.bzCity]}° 校正</label></div></div></div><button class="btn-primary" style="width:100%;" onclick="submitBaziCast()">开始八字排盘</button><div style="text-align:center;margin-top:14px;"><button class="chip" onclick="openBaziCompare()">双人八字合盘对比 ›</button></div>`;
}
function submitBaziCast() {
  const rawDt = castState.bzDate ? new Date(castState.bzDate) : new Date(), effDt = calcTrueSolarDate(rawDt, castState.bzTrueSolar ? (CITIES_LON[castState.bzCity] || 120) : 120), info = getAstroDayInfo(effDt), dm = info.day.s;
  const pillars = [info.year, info.month, info.day, info.hour].map((p, idx) => ({ ...p, shishen: idx === 2 ? (castState.bzGender === '男' ? '元男' : '元女') : getTenGod(dm, p.s), hidden: HIDDEN_STEMS[p.b].split('').map(hs => hs + '(' + getTenGod(dm, hs) + ')').join(' ') }));
  const forward = ((STEMS.indexOf(info.year.s) % 2) === 0 && castState.bzGender === '男') || ((STEMS.indexOf(info.year.s) % 2) === 1 && castState.bzGender === '女');
  const mSIdx = STEMS.indexOf(info.month.s), mBIdx = BRANCHES.indexOf(info.month.b);
  const dayun = Array.from({length:8}, (_, i) => { const step = forward ? i + 1 : -(i + 1), s = STEMS[((mSIdx + step) % 10 + 10) % 10], b = BRANCHES[((mBIdx + step) % 12 + 12) % 12]; return { age: i * 10 + 4, gz: s + b, ss: getTenGod(dm, s) }; });
  openGenericResult({ id: uid('arc'), category: '八字', title: (castState.bzName.trim() || '八字命盘') + `（${info.day.gz}日主）`, personName: castState.bzName.trim(), gender: castState.bzGender, group: '默认', createdAt: Date.now(), castTimeStr: effDt.toLocaleString(), lunarStr: info.lunarStr, data: { pillars, xunkong: info.xunkong, dayun }, reports: [], note: '', outcome: '', verdict: 'pending' });
}

function renderQimenCastForm(wrap) {
  const juOpts = ['auto', ...Array.from({length:9},(_,i)=>`阳${i+1}`), ...Array.from({length:9},(_,i)=>`阴${i+1}`)];
  const juLbl = k => k === 'auto' ? '自动选局' : (k[0] + '遁' + '一二三四五六七八九'[Number(k[1])-1] + '局');
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">姓　名</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="非必填" value="${escapeHtml(castState.qmName)}" oninput="castState.qmName=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.qmGender==='男'?'active':''}" onclick="castState.qmGender='男';renderDivineView()">男</button><button class="${castState.qmGender==='女'?'active':''}" onclick="castState.qmGender='女';renderDivineView()">女</button></div></div></div>
      <div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><input type="datetime-local" class="inline-input" value="${castState.qmBirthDate}" onchange="castState.qmBirthDate=this.value" /></div></div>
    </div>
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">求测类型</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.qmQueryType=this.value">${['事业求财','合作谈判','感情婚姻','寻人失物','官司诉讼','疾病健康','出行择吉','综合占测'].map(t=>`<option ${castState.qmQueryType===t?'selected':''}>${t}</option>`).join('')}</select></div></div>
      <div class="form-row"><span class="form-row-lbl">求测问题</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="一句话描述你的问题" value="${escapeHtml(castState.qmQuestion)}" oninput="castState.qmQuestion=this.value" /></div></div>
    </div>
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">起局时间</span><div class="form-row-val"><input id="liveQmDateInput" type="datetime-local" class="inline-input" value="${castState.qmDate}" onchange="castState.qmDate=this.value;castState.qmDateManual=true" /></div></div>
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
  const diPan = {}; for (let i = 0; i < 9; i++) diPan[isYang ? ((ju - 1 + i) % 9) + 1 : ((ju - 1 - i + 18) % 9) + 1] = qiyi[i];
  const leadGan = xunShou[2], fuOrigGong = Number(Object.keys(diPan).find(k => diPan[k] === leadGan) || 1);
  const zhiFuStar = baseStars[fuOrigGong] || '天蓬', zhiShiDoor = baseDoors[fuOrigGong === 5 ? 2 : fuOrigGong] || '休门';
  const hourTargetGan = info.hour.s === '甲' ? leadGan : info.hour.s, fuCurrGong = Number(Object.keys(diPan).find(k => diPan[k] === hourTargetGan) || 1);
  const ringShift = (ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) - ringGongs.indexOf(fuOrigGong === 5 ? 2 : fuOrigGong) + 8) % 8, doorShift = hIdx % 8;
  const gongNames = { 4:'巽四',9:'离九',2:'坤二',3:'震三',5:'中五',7:'兑七',8:'艮八',1:'坎一',6:'乾六' };
  let nianMingGan = '', nianMingGz = '';
  if (castState.qmBirthDate) { const bi = getAstroDayInfo(new Date(castState.qmBirthDate)); nianMingGz = bi.year.gz; nianMingGan = bi.year.s === '甲' ? '戊' : bi.year.s; }
  const palaces = [4,9,2,3,5,7,8,1,6].map(g => {
    if (g === 5) return { gong:5, gName:'中五宫', god:'寄坤', star:'天禽', door:'中宫', tian:diPan[5], di:diPan[5], anGan:'', isMa:false, isKong:false, isNianMing:false };
    const rIdx = ringGongs.indexOf(g), srcStarGong = ringGongs[(rIdx - ringShift + 8) % 8], srcDoorGong = ringGongs[(rIdx - doorShift + 8) % 8];
    const godIdx = isYang ? (rIdx - ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) + 8) % 8 : (ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) - rIdx + 8) % 8;
    const tian = diPan[srcStarGong];
    return { gong:g, gName:gongNames[g], god:gods[godIdx], star:baseStars[srcStarGong], door:baseDoors[srcDoorGong], tian, di:diPan[g], anGan:qiyi[(rIdx + hIdx) % 9], isMa:g===maGong, isKong:kongGongs.includes(g), isNianMing: Boolean(nianMingGan && tian === nianMingGan) };
  });
  openGenericResult({ id: uid('arc'), category: '奇门', title: castState.qmQuestion.trim() || `${castState.qmQueryType} · ${isYang?'阳':'阴'}遁${ju}局`, personName: castState.qmName.trim(), gender: castState.qmGender, group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr, data: { dun: `${isYang?'阳':'阴'}遁${ju}局（${castState.qmJuPick==='auto'?yuan+'·'+castState.qmMethod:'手动选局'}）`, type: castState.qmType, queryType: castState.qmQueryType, nianMingGz, zhiFuStar, zhiShiDoor, xunShou, yimaBr, gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong, palaces }, reports: [], note: '', outcome: '', verdict: 'pending' });
}

function renderMeihuaCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">占问事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="写下所问之事" value="${escapeHtml(castState.mhQuestion)}" oninput="castState.mhQuestion=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">起卦时间</span><div class="form-row-val"><input id="liveMhDateInput" type="datetime-local" class="inline-input" value="${castState.mhDate}" onchange="castState.mhDate=this.value;castState.mhDateManual=true" /></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0;">${[['time','时间起卦'],['num','报数起卦'],['word','汉字起卦']].map(([k,l])=>`<button class="btn-secondary" style="${castState.mhMode===k?'background:var(--primary);color:var(--primary-fg);':''}" onclick="castState.mhMode='${k}';renderDivineView()">${l}</button>`).join('')}</div>${castState.mhMode==='num'?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><input type="number" class="form-input" placeholder="上卦数" value="${castState.mhNum1}" oninput="castState.mhNum1=this.value" /><input type="number" class="form-input" placeholder="下卦数" value="${castState.mhNum2}" oninput="castState.mhNum2=this.value" /></div>`:''}${castState.mhMode==='word'?`<input type="text" class="form-input" style="margin-bottom:12px;" placeholder="输入任意汉字" value="${escapeHtml(castState.mhWord)}" oninput="castState.mhWord=this.value" />`:''}<button class="btn-primary" style="width:100%;" onclick="submitMeihuaCast()">起梅花易数详盘</button></div>`;
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
  openGenericResult({ id: uid('arc'), category: '梅花', title: castState.mhQuestion.trim() || `${mainHex.name} 变 ${bianHex.name}`, group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr, data: { mainKey: mainHex.key, huKey: huHex.key, bianKey: bianHex.key, movPos, tiName: `${tiTri.name}(${tiTri.wx})`, yongName: `${yongTri.name}(${yongTri.wx})`, tiYongRel: `用${getWxRelation(yongTri.wx, tiTri.wx)}体 · 月令(${info.month.b}${mWx})${getWxRelation(mWx, tiTri.wx)}体卦`, gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong }, reports: [], note: '', outcome: '', verdict: 'pending' });
}

function renderLiurenCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">占问事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="描述所测之事" value="${escapeHtml(castState.lrQuestion)}" oninput="castState.lrQuestion=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">起课时间</span><div class="form-row-val"><input id="liveLrDateInput" type="datetime-local" class="inline-input" value="${castState.lrDate}" onchange="castState.lrDate=this.value;castState.lrDateManual=true" /></div></div><div class="form-row"><span class="form-row-lbl">月将选择</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.lrYueJiang=this.value"><option value="auto">按中气自动推算</option>${BRANCHES.map(b => `<option value="${b}" ${castState.lrYueJiang===b?'selected':''}>${b}将</option>`).join('')}</select></div></div><div class="form-row"><span class="form-row-lbl">昼夜贵人</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.lrGuiMode=this.value"><option value="auto">按时辰自动</option><option value="day">强制昼贵</option><option value="night">强制夜贵</option></select></div></div></div><button class="btn-primary" style="width:100%;" onclick="submitLiurenCast()">起大六壬四课三传</button>`;
}
function submitLiurenCast() {
  const dt = castState.lrDateManual && castState.lrDate ? new Date(castState.lrDate) : new Date(), info = getAstroDayInfo(dt), hIdx = BRANCHES.indexOf(info.hour.b);
  const yueJiangIdx = castState.lrYueJiang === 'auto' ? (12 - (dt.getMonth() + 1) + 1) % 12 : BRANCHES.indexOf(castState.lrYueJiang), offset = (yueJiangIdx - hIdx + 12) % 12;
  const getSky = br => BRANCHES[(BRANCHES.indexOf(br) + offset) % 12], isDayGui = castState.lrGuiMode === 'day' || (castState.lrGuiMode === 'auto' && hIdx >= 3 && hIdx <= 8);
  const jiangNames = ['贵人','螣蛇','朱雀','六合','勾陈','青龙','天空','白虎','太常','玄武','太阴','天后'], getJiang = br => jiangNames[(BRANCHES.indexOf(br) + hIdx) % 12];
  const ganJi = { '甲':'寅','乙':'辰','丙':'巳','丁':'未','戊':'巳','己':'未','庚':'申','辛':'戌','壬':'亥','癸':'丑' }[info.day.s];
  const k1 = getSky(ganJi), k2 = getSky(k1), k3 = getSky(info.day.b), k4 = getSky(k3), dmWx = STEM_WX[STEMS.indexOf(info.day.s)], mkLq = br => getLiuQin(dmWx, BRANCH_WX[BRANCHES.indexOf(br)]);
  openGenericResult({ id: uid('arc'), category: '六壬', title: castState.lrQuestion.trim() || `大六壬 · ${info.day.gz}日 ${info.hour.b}时`, group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr, data: { gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong, yueJiang: BRANCHES[yueJiangIdx] + '将', guiType: isDayGui ? '昼贵' : '夜贵', sike: [{ lbl:'一课',top:k1,bot:info.day.s,jiang:getJiang(k1) },{ lbl:'二课',top:k2,bot:k1,jiang:getJiang(k2) },{ lbl:'三课',top:k3,bot:info.day.b,jiang:getJiang(k3) },{ lbl:'四课',top:k4,bot:k3,jiang:getJiang(k4) }], sanchuan: [{ lbl:'初传',br:k1,jiang:getJiang(k1),lq:mkLq(k1) },{ lbl:'中传',br:k2,jiang:getJiang(k2),lq:mkLq(k2) },{ lbl:'末传',br:k4,jiang:getJiang(k4),lq:mkLq(k4) }] }, reports: [], note: '', outcome: '', verdict: 'pending' });
}

function renderZiweiCastForm(wrap) {
  wrap.innerHTML = `<div class="card"><div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><input type="datetime-local" class="inline-input" value="${castState.zwDate}" onchange="castState.zwDate=this.value" /></div></div><div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.zwGender==='男'?'active':''}" onclick="castState.zwGender='男';renderDivineView()">男</button><button class="${castState.zwGender==='女'?'active':''}" onclick="castState.zwGender='女';renderDivineView()">女</button></div></div></div></div><button class="btn-primary" style="width:100%;" onclick="submitZiweiCast()">排紫微斗数十二宫详盘</button>`;
}
function submitZiweiCast() {
  const dt = castState.zwDate ? new Date(castState.zwDate) : new Date(), info = getAstroDayInfo(dt);
  const gongNames = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'], stars = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
  const sihuaMap = { '甲':'廉禄·破权·武科·阳忌','乙':'机禄·梁权·紫科·阴忌','丙':'同禄·机权·昌科·廉忌','丁':'阴禄·同权·机科·巨忌','戊':'贪禄·阴权·弼科·机忌','己':'武禄·贪权·梁科·曲忌','庚':'阳禄·武权·阴科·同忌','辛':'巨禄·阳权·曲科·昌忌','壬':'梁禄·紫权·辅科·武忌','癸':'破禄·巨权·阴科·贪忌' };
  const hIdx = BRANCHES.indexOf(info.hour.b), mingPos = (dt.getMonth() + 2 - hIdx + 12) % 12, shenPos = (dt.getMonth() + 2 + hIdx) % 12;
  const gongs = gongNames.map((gn, i) => { const brIdx = (mingPos - i + 12) % 12; return { name: gn + (brIdx === shenPos ? '·身' : ''), branch: BRANCHES[brIdx], star: stars[(i + dt.getDate()) % stars.length] + (i % 3 === 0 ? ' · ' + stars[(i + 7) % stars.length] : '') }; });
  openGenericResult({ id: uid('arc'), category: '紫微', title: `紫微命盘（${info.year.gz}年 · ${castState.zwGender}）`, group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr, data: { gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, wuxingJu: ['水二局','木三局','金四局','土五局','火六局'][(STEMS.indexOf(info.year.s) + mingPos) % 5], sihua: sihuaMap[info.year.s] || '', gongs }, reports: [], note: '', outcome: '', verdict: 'pending' });
}

function renderFengshuiCastForm(wrap) {
  const mountains = ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'];
  const deg = ((castState.fsHeading % 360) + 360) % 360, mIdx = Math.floor(((deg + 7.5) % 360) / 15), sitIdx = (mIdx + 12) % 24;
  const starInfo = { 1:['一白贪狼','桃花人缘',true],2:['二黑巨门','病符宜静',false],3:['三碧禄存','是非口舌',false],4:['四绿文曲','文昌学业',true],5:['五黄廉贞','煞位忌动',false],6:['六白武曲','偏财贵人',true],7:['七赤破军','破财防盗',false],8:['八白左辅','正财旺位',true],9:['九紫右弼','喜庆旺运',true] };
  const center = ((11 - ((castState.fsYear - 2000) % 9)) % 9) || 9;
  const stars = [['东南',-1],['正南',4],['西南',-3],['正东',-2],['中宫',0],['正西',2],['东北',3],['正北',-4],['西北',1]].map(([dir, off]) => { const n = ((center + off - 1 + 18) % 9) + 1; return { dir, star: starInfo[n][0], desc: starInfo[n][1], good: starInfo[n][2] }; });
  wrap.innerHTML = `<div class="card" style="text-align:center;"><div class="card-head"><span class="card-title">水墨电子罗盘 · 二十四山</span><button class="pill-mini accent" onclick="enableLiveCompass()">陀螺仪</button></div><div style="font-family:'Songti SC',serif;font-size:28px;font-weight:700;color:var(--accent);margin:8px 0;">坐${mountains[sitIdx]}向${mountains[mIdx]}（${deg.toFixed(0)}°）</div><input type="range" min="0" max="359" value="${deg}" style="width:100%;accent-color:var(--accent);margin:8px 0;" oninput="castState.fsHeading=Number(this.value);renderDivineView()" /></div><div class="card"><div class="card-head"><span class="card-title">${castState.fsYear} 流年玄空飞星</span><div style="display:flex;gap:6px;"><button class="pill-mini" onclick="castState.fsYear--;renderDivineView()">‹</button><button class="pill-mini" onclick="castState.fsYear++;renderDivineView()">›</button></div></div><div class="nine-grid">${stars.map(c => `<div class="nine-cell"><strong>${c.dir}</strong><br/><span style="color:${c.good?'var(--wx-wood)':'var(--seal)'};font-weight:700;">${c.star}</span><br/><span style="font-size:11px;color:var(--text-3);">${c.desc}</span></div>`).join('')}</div><button class="btn-primary" style="width:100%;margin-top:14px;" onclick="submitFengshuiAI()">让参悟分析坐向与飞星</button></div>`;
}
function enableLiveCompass() {
  const h = e => { const deg = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : (e.alpha != null ? 360 - e.alpha : null); if (deg != null) { castState.fsHeading = Math.round(deg); if (state.mainTab === 'divine' && state.category === '风水' && state.subTab === 'cast') renderDivineView(); } };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') { window.addEventListener('deviceorientation', h); showToast('已开启陀螺仪'); } });
  else { window.addEventListener('deviceorientation', h); showToast('已启用罗盘感应'); }
}
function submitFengshuiAI() { switchMainTab('canwu'); switchCanwuRoom('风水'); document.getElementById('chatInput').value = `当前方位角 ${castState.fsHeading}°，流年 ${castState.fsYear} 年九宫飞星已排好，请结合我的风水书库给出布局与避煞建议。`; sendCanwuMessage(); }

// ==================== 断事卷宗结果页（三层透视 + 遇象即查 + 先自断） ====================
function openLiuyaoResult(rec) {
  state.currentResult = rec; state.activeReportTab = 0; state.resultLayer = 'insight'; state.showGuaci = false; state.showSelfJudge = false; state.selfReason = '';
  const bs = state.books.filter(b => b.category === '六爻'); state.selectedBookIds = bs.length ? [bs[0].id] : [];
  renderResultOverlay(); openOverlay('resultOverlay'); markStudyFootprint();
}
function openGenericResult(rec) {
  state.currentResult = rec; state.activeReportTab = 0; state.showSelfJudge = false; state.selfReason = '';
  const bs = state.books.filter(b => b.category === rec.category); state.selectedBookIds = bs.length ? [bs[0].id] : [];
  renderResultOverlay(); openOverlay('resultOverlay'); markStudyFootprint();
}

const TAG_TIP_MAP = {
  '月破': '【月破】指爻的地支被月建相冲，当下处于被冲散、无力生克他爻的状态。但并非一律作废：如果临日辰、得日辰生扶或日辰合之（合起），或者自身发动化回头生、化进神，属于「破而有救」，出月或逢填实之日依然应事。',
  '暗动': '【暗动】指旺相的静爻被日辰相冲。它虽然在卦面上没有画动爻符号，但实际上就像明动之爻一样有力，主暗中促成、私下推进或突如其来的转机，实战极易漏看。',
  '日破': '【日破】指休囚无气的静爻被日辰冲克。这类爻被冲散后很难起作用，若用神日破且无动爻救应，多主事体落空或半途崩盘。',
  '旬空': '【旬空】分假空与真空。旺相之空、动而之空、得日辰动爻生扶之空叫「假空」，只是时机未到，出空、填实或冲空之日就会应验；休囚无气又受克之空才是「真空」，到底无成。',
  '化进神': '【化进神】亥化子、寅化卯、巳化午、申化酉、丑化辰、辰化未、未化戌、戌化丑。代表事态由弱转强、步步推进、规模扩大。用神化进大吉，忌神化进大凶。',
  '化退神': '【化退神】子化亥、卯化寅、午化巳、酉化申、辰化丑、未化辰、戌化未、丑化戌。代表力量衰退、中途撤回、态度变冷。忌神化退反而是好事。',
  '回头生': '【回头生】动爻变出的变爻反过来生助本位动爻。这是极强的吉象，代表源源不断的助力、事情越做越顺，甚至能救活原本休囚的用神。',
  '回头克': '【回头克】动爻变出的变爻反过来克制本位动爻。在《增删卜易》中属于极其凶险的「自伤」信号，即使当下在月日旺相，也极易虎头蛇尾、功败垂成。',
  '反吟冲': '【反吟冲】动爻变出的地支与本位地支相冲。代表事情反复折腾、去而复返、半途大翻盘，容易在敲定后又生变故。',
  '化合': '【化合】动爻与变爻相合，属于「化绊」。短期内容易被牵绊拖延、难以立刻推进，通常要等到逢冲开合之日才会真正落地。',
  '伏神': '【伏神】用神不上卦而藏在本宫首卦之下。能否起作用看「出伏条件」：伏神旺相、得日月生扶、飞神生伏神，或者日月动爻冲克压住它的飞神，均可冲破而出。'
};

function openTagTip(tagName) {
  let key = Object.keys(TAG_TIP_MAP).find(k => tagName.includes(k)) || (tagName.startsWith('伏') ? '伏神' : '');
  state.activeTagTipKey = tagName;
  document.getElementById('tagTipTitle').textContent = tagName;
  document.getElementById('tagTipBody').innerHTML = key ? formatRichText(TAG_TIP_MAP[key]) : `「${escapeHtml(tagName)}」属于当前爻位与月建日辰的即时作用状态，可点右上角直接让参悟结合你本卦精讲。`;
  openSheet('sheet-tag-tip');
}
function askCanwuFromTagTip() {
  const k = state.activeTagTipKey; if (!k) return;
  closeOverlay('resultOverlay'); switchMainTab('canwu'); switchCanwuRoom(state.currentResult?.category || '六爻');
  document.getElementById('chatInput').value = `结合我刚排的盘，用大白话讲讲「${k}」在实战里到底怎么断？`;
  sendCanwuMessage();
}

function renderResultOverlay() {
  const rec = state.currentResult; if (!rec) return;
  document.getElementById('resOverlayTitle').textContent = rec.category + '断事卷宗';
  const wrap = document.getElementById('resultOverlayBody');
  let chartHtml = '';

  if (rec.category === '六爻') {
    const d = rec.data, mainHex = HEX_DATA.byKey[d.mainKey], simM = d.simMonthBranch || d.monthGz[1], simD = d.simDayBranch || d.dayGz[1];
    const exam = runLiuyaoPhysicalExam(mainHex, new Set(d.moving || []), simM, simD, d.xunkong);
    d.bianKey = exam.bianHex ? exam.bianHex.key : '';
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0, shensha = getShenSha(d.dayGz[0], d.dayGz[1]);
    const showTags = state.resultLayer !== 'clean';
    chartHtml = `
      <div class="card">
        <div style="font-size:14px;color:var(--text-2);line-height:1.7;">
          <div><strong>事项：</strong><span class="priv-blur">${escapeHtml(rec.title)}</span>（${rec.gender}）</div>
          <div><strong>时间：</strong>${escapeHtml(rec.castTimeStr)} ${rec.lunarStr ? '· ' + rec.lunarStr : ''}</div>
          ${rec.contextText ? `<div><strong>背景处境：</strong><span class="priv-blur">${escapeHtml(rec.contextText)}</span></div>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${shensha.map(s => `<span class="chip">${s.k}-${s.v}</span>`).join('')}</div>
        <div class="gz-banner">${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（空${d.xunkong}）</div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 12px;">
          ${[['clean','清净原盘'],['insight','生克透视'],['ruler','应期滑尺']].map(([k,l]) => `<button class="btn-secondary" style="padding:7px 2px;font-size:12.5px;${state.resultLayer===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="state.resultLayer='${k}';renderResultOverlay()">${l}</button>`).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;padding:4px 4px 8px;border-bottom:1px solid var(--border);">
          <span>主卦【${mainHex.palaceName}】${mainHex.name}</span>
          <span>${exam.bianHex ? `变卦【${exam.bianHex.palaceName}】${exam.bianHex.name}` : '静卦无变'}</span>
        </div>
        ${[5,4,3,2,1,0].map((i, ord) => {
          const r = exam.examRows[i], ls = LIU_SHEN[(lsStart + i) % 6], isYs = d.lockedYongshenPos === r.pos, b = r.bian;
          return `<div class="ly-row ${isYs?'yongshen':''}" style="animation-delay:${ord*0.04}s;" onclick="toggleLockYongshen(${r.pos})">
            <span style="color:var(--text-3);">${ls}</span>
            <span style="font-size:11px;color:var(--text-3);">${r.fushen ? r.fushen.label : ''}</span>
            <div><span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span><span class="wx-${r.wx}" style="font-weight:600;">${r.liuqin}${r.branch}${r.wx}</span>${r.isShi?'<strong style="color:var(--seal);"> 世</strong>':(r.isYing?'<span style="color:var(--text-2);"> 应</span>':'')}${isYs?'<span class="chip accent" style="padding:1px 5px;font-size:10px;margin-left:3px;">用</span>':''}</div>
            <span style="text-align:center;color:var(--seal);font-weight:700;">${r.isMov ? (r.bit ? '○' : '×') : ''}</span>
            <div>${b ? `<span class="yao-svg ${b.bit?'yang':'yin'}"></span><span class="wx-${b.wx}">${b.liuqin}${b.branch}${b.wx}</span>` : ''}</div>
          </div>
          ${showTags ? `<div style="padding:2px 6px 7px;display:flex;flex-wrap:wrap;gap:5px;">${r.tags.map(t => `<button class="exam-tag-btn ${/破|空|暗动|进神|退神|回头|反吟|伏/.test(t)?'hot':''}" onclick="event.stopPropagation();openTagTip('${escapeHtml(t)}')">${escapeHtml(t)}</button>`).join('')}</div>` : ''}`;
        }).join('')}
        ${showTags && exam.sanheHits.length ? `<div style="margin-top:6px;font-size:13px;color:var(--accent);font-weight:600;">三合局：${exam.sanheHits.join(' · ')}</div>` : ''}
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--text-3);">
          <span>轻点任意爻锁定用神 · 点红色状态词遇象即查</span>
          <button class="pill-mini" onclick="state.showGuaci=!state.showGuaci;renderResultOverlay()">${state.showGuaci?'收起卦辞':'看卦辞'}</button>
        </div>
        ${state.showGuaci ? `<div style="margin-top:10px;padding:11px 13px;border-radius:13px;background:var(--bg);font-size:13.5px;line-height:1.72;"><strong>${mainHex.name}：</strong>${escapeHtml(mainHex.guaci)}${exam.bianHex ? `<br/><strong>变卦 ${exam.bianHex.name}：</strong>${escapeHtml(exam.bianHex.guaci)}` : ''}</div>` : ''}
      </div>
      ${state.resultLayer === 'ruler' ? `
      <div class="card" style="padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:13.5px;font-weight:600;">应期时间滑尺（滑动看何月何日出空冲合）</span><button class="pill-mini" onclick="resetSimTime()">复原</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          <div>模拟月建：<strong>${simM}月</strong><input type="range" min="0" max="11" value="${BRANCHES.indexOf(simM)}" style="width:100%;accent-color:var(--accent);" oninput="updateSimBranch('m', Number(this.value))" /></div>
          <div>模拟日辰：<strong>${simD}日</strong><input type="range" min="0" max="11" value="${BRANCHES.indexOf(simD)}" style="width:100%;accent-color:var(--accent);" oninput="updateSimBranch('d', Number(this.value))" /></div>
        </div>
      </div>` : ''}
    `;
  } else if (rec.category === '奇门') {
    const d = rec.data;
    chartHtml = `<div class="card"><div class="gz-banner">${d.dun} · ${d.type}</div><div style="font-size:13.5px;color:var(--text-2);line-height:1.72;margin-bottom:8px;"><div><strong>四柱：</strong>${d.gz}（空${d.xunkong}）</div><div><strong>值符：</strong><span style="color:var(--seal);font-weight:700;">${d.zhiFuStar}</span> · <strong>值使：</strong><span style="color:var(--seal);font-weight:700;">${d.zhiShiDoor}</span> · <strong>旬首：</strong>${d.xunShou} · <strong>马星：</strong>${d.yimaBr}${d.nianMingGz ? ` · <strong style="color:var(--seal);">年命 ${d.nianMingGz}（红框）</strong>` : ''}</div></div><div class="nine-grid">${d.palaces.map(p => `<div class="qimen-cell ${p.isNianMing?'nianming':''}"><div class="qimen-row"><span style="color:var(--text-3);">${p.god}</span><span style="color:var(--seal);font-weight:700;">${p.isNianMing?'命':''}${p.isKong?'空':''}${p.isMa?'马':''}</span></div><div class="qimen-row"><span style="font-weight:700;">${p.star}</span><strong style="font-size:14px;">${p.tian}</strong></div><div class="qimen-row"><span style="color:var(--accent);font-weight:600;">${p.door}</span><span>${p.di}</span></div><div class="qimen-row" style="font-size:10px;color:var(--text-3);"><span>${p.gName}</span><span>暗${p.anGan||'-'}</span></div></div>`).join('')}</div></div>`;
  } else if (rec.category === '八字') {
    const d = rec.data;
    chartHtml = `<div class="card"><div style="font-size:13.5px;color:var(--text-2);margin-bottom:8px;"><strong class="priv-blur">${escapeHtml(rec.title)}</strong> · ${escapeHtml(rec.castTimeStr)} · 日空 ${d.xunkong}</div><div class="pillars-grid">${['年柱','月柱','日柱','时柱'].map((lbl,i) => { const p = d.pillars[i]; return `<div class="pillar-col"><div class="pillar-lbl">${lbl} · ${p.shishen}</div><div class="pillar-gz wx-${p.swx}">${p.s}</div><div class="pillar-gz wx-${p.bwx}">${p.b}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px;">${p.hidden}</div></div>`; }).join('')}</div><div style="margin-top:12px;font-size:13px;color:var(--text-2);line-height:1.7;"><div><strong>大运：</strong>${d.dayun.map(dy => `${dy.age}岁${dy.gz}(${dy.ss})`).join(' → ')}</div></div></div>`;
  } else if (rec.category === '梅花') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey], hh = HEX_DATA.byKey[d.huKey], bh = HEX_DATA.byKey[d.bianKey];
    const drawMini = (hex, mov) => `<div style="display:flex;flex-direction:column;gap:4px;margin:8px auto;width:54px;">${[5,4,3,2,1,0].map(i=>`<div style="height:5px;width:100%;border-radius:2px;display:flex;justify-content:space-between;${hex.bits[i]?'background:'+(mov===i+1?'var(--seal)':'var(--text)')+';':''}">${hex.bits[i]?'':`<span style="width:43%;height:100%;border-radius:2px;background:${mov===i+1?'var(--seal)':'var(--text)'};"></span><span style="width:43%;height:100%;border-radius:2px;background:${mov===i+1?'var(--seal)':'var(--text)'};"></span>`}</div>`).join('')}</div>`;
    chartHtml = `<div class="card"><div class="gz-banner">${d.gz}（空${d.xunkong}）</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;"><div class="pillar-col"><div class="pillar-lbl">本卦(${d.movPos}爻动)</div>${drawMini(mh, d.movPos)}<strong>${mh.name}</strong></div><div class="pillar-col"><div class="pillar-lbl">互卦(过程)</div>${drawMini(hh, 0)}<strong>${hh.name}</strong></div><div class="pillar-col"><div class="pillar-lbl">变卦(结局)</div>${drawMini(bh, 0)}<strong>${bh.name}</strong></div></div><div style="margin-top:12px;font-size:14px;font-weight:600;color:var(--accent);text-align:center;">体卦 ${d.tiName} vs 用卦 ${d.yongName}<br/>${d.tiYongRel}</div></div>`;
  } else if (rec.category === '六壬') {
    const d = rec.data;
    chartHtml = `<div class="card"><div class="gz-banner">${d.gz}</div><div style="font-size:13.5px;color:var(--text-2);margin-bottom:10px;"><strong>月将：</strong>${d.yueJiang} · <strong>贵人：</strong>${d.guiType} · <strong>旬空：</strong>${d.xunkong}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">${d.sanchuan.map(c => `<div class="nine-cell"><div style="color:var(--text-3);font-size:11px;">${c.lbl}</div><div style="font-size:16px;font-weight:700;color:var(--seal);">${c.br}</div><div>${c.lq} · ${c.jiang}</div></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${d.sike.map(k => `<div class="nine-cell"><div style="font-size:10.5px;color:var(--text-3);">${k.jiang}</div><div style="font-weight:700;">${k.top} / ${k.bot}</div><div style="font-size:10px;color:var(--text-3);">${k.lbl}</div></div>`).join('')}</div></div>`;
  } else {
    const d = rec.data;
    chartHtml = `<div class="card"><div class="gz-banner">${d.gz}</div><div style="font-size:13.5px;color:var(--text-2);margin-bottom:8px;"><strong>五行局：</strong>${d.wuxingJu || ''} · <strong>生年四化：</strong><span style="color:var(--seal);font-weight:600;">${d.sihua || ''}</span></div><div class="nine-grid">${(d.gongs || []).map(g => `<div class="nine-cell"><strong>${g.name}（${g.branch}）</strong><br/>${g.star}</div>`).join('')}</div></div>`;
  }

  const catBooks = state.books.filter(b => b.category === rec.category);
  const bookSelectorHtml = catBooks.length ? `<div style="margin-bottom:12px;"><div style="font-size:13px;color:var(--text-2);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><span>选择参考典籍（多选即对照比较）</span><button class="pill-mini" onclick="selectAllCatBooks('${rec.category}')">全选</button></div><div style="display:flex;flex-wrap:wrap;gap:6px;">${catBooks.map(b => `<button class="chip ${state.selectedBookIds.includes(b.id)?'accent':''}" onclick="toggleSelectBookForAI('${b.id}')">${escapeHtml(b.title)}</button>`).join('')}</div></div>` : `<div style="font-size:13px;color:var(--text-3);margin-bottom:10px;">书房中暂无「${rec.category}」典籍，将按经典硬理法推演。</div>`;

  const selfJudgeHtml = `
    <div style="margin-bottom:12px;padding:12px 14px;border-radius:14px;background:var(--bg);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13.5px;font-weight:600;">先自己盲断一下，再让 AI 对照纠偏</span>
        <button class="pill-mini ${state.showSelfJudge?'accent':''}" onclick="state.showSelfJudge=!state.showSelfJudge;renderResultOverlay()">${state.showSelfJudge?'收起':'开启自断'}</button>
      </div>
      ${state.showSelfJudge ? `
        <div style="display:flex;gap:8px;margin:10px 0;">${['成','败','反复'].map(v => `<button class="chip ${state.selfVerdict===v?'seal':''}" onclick="state.selfVerdict='${v}';renderResultOverlay()">我判：${v}</button>`).join('')}</div>
        <textarea class="form-textarea" style="min-height:56px;background:var(--surface);" placeholder="一句话写下你的判断依据（如：妻财持世但动化回头克，故难成）" oninput="state.selfReason=this.value">${escapeHtml(state.selfReason)}</textarea>
      ` : ''}
    </div>
  `;

  const reps = rec.reports || [], activeRep = reps[state.activeReportTab] || null;
  const reportsHtml = reps.length ? `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;">${reps.map((rp, idx) => `<button class="chip ${idx===state.activeReportTab?'accent':''}" onclick="state.activeReportTab=${idx};renderResultOverlay()">${escapeHtml(rp.label)}</button>`).join('')}</div><div style="font-size:15px;line-height:1.78;padding:13px 15px;border-radius:16px;background:var(--bg);">${formatRichText(activeRep.content)}</div><div style="display:flex;gap:8px;margin-top:10px;"><button class="chip" onclick="followUpFromResult()">继续追问参悟</button><button class="chip seal" onclick="feedbackResultToBrain()">记一条纠偏备忘</button></div>` : `<div style="font-size:13.5px;color:var(--text-3);padding:4px 0;">AI 会严格根据上面算死的硬数据与你的书库，分三层（吉凶定性 / 细节象意 / 具体应期）说人话剖析。</div>`;

  const groupOpts = ['默认', ...(state.settings.groups || [])];
  wrap.innerHTML = `${chartHtml}<div class="card"><div class="card-head"><span class="card-title">参悟 AI 选书剖析</span></div>${bookSelectorHtml}${selfJudgeHtml}<button class="btn-primary" style="width:100%;margin-bottom:12px;" id="runChartAiBtn" onclick="runSelectedBooksAnalysis()">${reps.length ? '+ 再做一份对比分析' : (state.showSelfJudge && state.selfReason.trim() ? '提交自断并看 AI 对照剖析' : '开始参悟精准分析')}</button>${reportsHtml}</div><div class="card"><div class="card-head"><span class="card-title">个人复盘、应验与存档</span><select class="form-select" style="width:auto;padding:5px 10px;font-size:13px;" onchange="state.currentResult.verdict=this.value"><option value="pending" ${rec.verdict==='pending'?'selected':''}>待验证</option><option value="hit" ${rec.verdict==='hit'?'selected':''}>已应验</option><option value="miss" ${rec.verdict==='miss'?'selected':''}>有偏差</option></select></div><div class="form-field"><textarea class="form-textarea priv-blur" placeholder="记录自己的思路..." oninput="state.currentResult.note=this.value">${escapeHtml(rec.note || '')}</textarea></div><div class="form-field"><label class="form-label">真实应验结果</label><textarea class="form-textarea priv-blur" style="min-height:58px;" placeholder="后来实际发生了什么..." oninput="state.currentResult.outcome=this.value">${escapeHtml(rec.outcome || '')}</textarea></div><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div style="display:flex;align-items:center;gap:6px;"><span style="font-size:14px;">分组：</span><select class="form-select" style="width:auto;padding:6px 10px;font-size:14px;" onchange="state.currentResult.group=this.value">${groupOpts.map(g => `<option value="${escapeHtml(g)}" ${rec.group===g?'selected':''}>${escapeHtml(g)}</option>`).join('')}</select></div><button class="btn-primary" style="padding:10px 18px;" onclick="saveCurrentResultToArchive()">存入档案</button></div></div>`;
}
function toggleLockYongshen(pos) { const d = state.currentResult.data; d.lockedYongshenPos = d.lockedYongshenPos === pos ? null : pos; renderResultOverlay(); }
function updateSimBranch(t, i) { if (t === 'm') state.currentResult.data.simMonthBranch = BRANCHES[i]; else state.currentResult.data.simDayBranch = BRANCHES[i]; renderResultOverlay(); }
function resetSimTime() { const d = state.currentResult.data; d.simMonthBranch = d.monthGz[1]; d.simDayBranch = d.dayGz[1]; renderResultOverlay(); }
function toggleSelectBookForAI(id) { const i = state.selectedBookIds.indexOf(id); if (i >= 0) state.selectedBookIds.splice(i, 1); else state.selectedBookIds.push(id); renderResultOverlay(); }
function selectAllCatBooks(cat) { state.selectedBookIds = state.books.filter(b => b.category === cat).map(b => b.id); renderResultOverlay(); }
async function saveCurrentResultToArchive() { const rec = state.currentResult; if (!rec) return; rec.updatedAt = Date.now(); await dbPut('archives', rec); state.archives = state.archives.filter(a => a.id !== rec.id); state.archives.push(rec); await markDirty(); showToast('已存入实战档案库'); }
function exportResultPoster() {
  const rec = state.currentResult; if (!rec) return;
  const c = document.createElement('canvas'); c.width = 750; c.height = 1040; const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4F2EC'; ctx.fillRect(0, 0, 750, 1040); ctx.fillStyle = '#1E2022'; ctx.font = 'bold 34px serif'; ctx.fillText('藏往 · ' + rec.category + '卷宗', 52, 88);
  ctx.fillStyle = '#5D615E'; ctx.font = '22px sans-serif'; ctx.fillText('时间：' + (rec.castTimeStr || ''), 52, 130); ctx.fillText('事项：' + (rec.title || '').slice(0, 26), 52, 166);
  let y = 224; ctx.fillStyle = '#1E2022'; ctx.font = '20px sans-serif';
  const txt = (rec.reports?.[state.activeReportTab]?.content || rec.note || '暂无断语').replace(/\n+/g, ' ');
  for (let i = 0; i < Math.min(txt.length, 460); i += 29) { ctx.fillText(txt.slice(i, i + 29), 52, y); y += 34; if (y > 980) break; }
  const a = document.createElement('a'); a.download = `藏往_${rec.category}_${formatDateKey(new Date())}.png`; a.href = c.toDataURL('image/png'); a.click(); showToast('水墨卷宗长图已生成');
}
