// ==================== 藏往 V7：实时精准时钟、精致铜钱蓄力摇卦、六爻指定弹窗、详尽七门排盘与万年历 ====================
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_WX = ['木','木','火','火','土','土','金','金','水','水'];
const BRANCH_WX = ['水','土','木','木','土','火','火','土','金','金','土','水'];
const HIDDEN_STEMS = {
  '子':'癸','丑':'己癸辛','寅':'甲丙戊','卯':'乙','辰':'戊乙癸','巳':'丙庚戊',
  '午':'丁己','未':'己丁乙','申':'庚壬戊','酉':'辛','戌':'戊辛丁','亥':'壬甲'
};
const LIU_HE = {'子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午'};
const LIU_CHONG = {'子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳'};
const JIN_SHEN = {'亥':'子','寅':'卯','巳':'午','申':'酉','丑':'辰','辰':'未','未':'戌','戌':'丑'};
const TUI_SHEN = {'子':'亥','卯':'寅','午':'巳','酉':'申','辰':'丑','未':'辰','戌':'未','丑':'戌'};
const SAN_HE = [
  { set:['申','子','辰'], wx:'水', name:'申子辰水局' },
  { set:['亥','卯','未'], wx:'木', name:'亥卯未木局' },
  { set:['寅','午','戌'], wx:'火', name:'寅午戌火局' },
  { set:['巳','酉','丑'], wx:'金', name:'巳酉丑金局' }
];
const LIU_SHEN = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
const LIU_SHEN_START = { '甲':0,'乙':0,'丙':1,'丁':1,'戊':2,'己':3,'庚':4,'辛':4,'壬':5,'癸':5 };

const CITIES_LON = {
  '北京时间 (120°E)': 120.0,
  '重庆': 106.55, '北京': 116.40, '上海': 121.47, '成都': 104.06, '广州': 113.26,
  '深圳': 114.05, '杭州': 120.15, '南京': 118.79, '武汉': 114.30, '西安': 108.94,
  '天津': 117.20, '苏州': 120.58, '长沙': 112.93, '郑州': 113.62, '沈阳': 123.43,
  '青岛': 120.38, '昆明': 102.71, '哈尔滨': 126.53, '贵阳': 106.63, '南宁': 108.36,
  '厦门': 118.08, '香港': 114.17, '台北': 121.56, '新加坡': 103.82
};

const TRIGRAMS = {
  7: { id:7, name:'乾', sym:'☰', wx:'金', nature:'天', num:1, inner:['甲子','甲寅','甲辰'], outer:['壬午','壬申','壬戌'] },
  3: { id:3, name:'兑', sym:'☱', wx:'金', nature:'泽', num:2, inner:['丁巳','丁卯','丁丑'], outer:['丁亥','丁酉','丁未'] },
  5: { id:5, name:'离', sym:'☲', wx:'火', nature:'火', num:3, inner:['己卯','己丑','己亥'], outer:['己酉','己未','己巳'] },
  1: { id:1, name:'震', sym:'☳', wx:'木', nature:'雷', num:4, inner:['庚子','庚寅','庚辰'], outer:['庚午','庚申','庚戌'] },
  6: { id:6, name:'巽', sym:'☴', wx:'木', nature:'风', num:5, inner:['辛丑','辛亥','辛酉'], outer:['辛未','辛巳','辛卯'] },
  2: { id:2, name:'坎', sym:'☵', wx:'水', nature:'水', num:6, inner:['戊寅','戊辰','戊午'], outer:['戊申','戊戌','戊子'] },
  4: { id:4, name:'艮', sym:'☶', wx:'土', nature:'山', num:7, inner:['丙辰','丙午','丙申'], outer:['丙戌','丙子','丙寅'] },
  0: { id:0, name:'坤', sym:'☷', wx:'土', nature:'地', num:8, inner:['乙未','乙巳','乙卯'], outer:['乙丑','乙亥','乙酉'] }
};
const NUM_TO_TRI = { 1:7, 2:3, 3:5, 4:1, 5:6, 6:2, 7:4, 0:0, 8:0 };
const PALACE_ORDER = [7, 2, 4, 1, 6, 5, 0, 3];
const PALACE_GEN_NAMES = ['本宫','一世','二世','三世','四世','五世','游魂','归魂'];

const HEX_DICT = {
  '7_7':[1,'乾为天','元亨利贞。刚健中正，自强不息，利大局开创。'],
  '0_0':[2,'坤为地','元亨，利牝马之贞。厚德载物，顺势承接，先迷后得。'],
  '2_1':[3,'水雷屯','元亨利贞，勿用有攸往。万事开头难，宜积蓄建侯。'],
  '4_2':[4,'山水蒙','亨，匪我求童蒙，童蒙求我。启蒙明理，宜师承求教。'],
  '2_7':[5,'水天需','有孚，光亨，贞吉。时机未熟，耐心待时，不可冒进。'],
  '7_2':[6,'天水讼','有孚窒惕，中吉终凶。意见相左，宜和解止讼。'],
  '0_2':[7,'地水师','贞，丈人吉，无咎。统率有序，以正领众，纪律为先。'],
  '2_0':[8,'水地比','吉，原筮元永贞。亲比协作，择善而从，不宜迟疑。'],
  '6_7':[9,'风天小畜','亨，密云不雨。力量尚微，宜小蓄积淀，等待透雨。'],
  '7_3':[10,'天泽履','履虎尾，不咥人，亨。谨守礼法，步步为营可化险。'],
  '0_7':[11,'地天泰','小往大来，吉亨。天地交泰，上下通畅，诸事顺遂。'],
  '7_0':[12,'天地否','否之匪人，不利君子贞。上下闭塞，宜守正敛锋待转机。'],
  '7_5':[13,'天火同人','同人于野，亨。志同道合，公心协作，利远行谋事。'],
  '5_7':[14,'火天大有','元亨。光明普照，丰盛大有，宜戒满守谦。'],
  '0_4':[15,'地山谦','亨，君子有终。谦逊低调，有实力而不张扬，终获吉果。'],
  '1_0':[16,'雷地豫','利建侯行师。顺动欢豫，宜提前筹谋，防逸乐失警。'],
  '3_1':[17,'泽雷随','元亨利贞，无咎。审时度势，随顺正道而行。'],
  '4_6':[18,'山风蛊','元亨，利涉大川。积弊已久，当果断革新整顿。'],
  '0_3':[19,'地泽临','元亨利贞。势头渐盛，亲临督导，居安思危。'],
  '6_0':[20,'风地观','盥而不荐，有孚颙若。冷静观察全局，示范引导。'],
  '5_1':[21,'火雷噬嗑','亨，利用狱。中间有梗阻，须明断去障方通。'],
  '4_5':[22,'山火贲','亨，小利有攸往。文饰修容，宜重实质莫流于浮华。'],
  '4_0':[23,'山地剥','不利有攸往。阳微阴盛，顺时止损，静待复生。'],
  '0_1':[24,'地雷复','亨，出入无疾。一阳来复，转机初现，宜休养生息。'],
  '7_1':[25,'天雷无妄','元亨利贞。顺应天理不妄为，真诚守正则吉。'],
  '4_7':[26,'山天大畜','利贞，不家食吉。厚积薄发，养德蓄才以待大用。'],
  '4_1':[27,'山雷颐','贞吉，观颐。谨言慎食，修养身心与谋生之道。'],
  '3_6':[28,'泽风大过','栋桡，利有攸往。压力过载，须非常之策方能度过。'],
  '2_2':[29,'坎为水','习坎，有孚，维心亨。重重险阻，守信定心行有尚。'],
  '5_5':[30,'离为火','利贞，亨。光明依附正道，柔顺中正而大明。'],
  '3_4':[31,'泽山咸','亨，利贞，取女吉。虚心感应，心意相通，感情顺合。'],
  '1_6':[32,'雷风恒','亨，无咎，利贞。恒久坚持正道，稳扎稳打。'],
  '7_4':[33,'天山遁','亨，小利贞。退避锋芒，知止抽身反得主动。'],
  '1_7':[34,'雷天大壮','利贞。阳刚强盛，切忌莽撞冲动，以礼节之。'],
  '5_0':[35,'火地晋','康侯用锡马蕃庶。日出地上，步步高升，顺明进取。'],
  '0_5':[36,'地火明夷','利艰贞。光明受损，宜韬光养晦、隐忍自保。'],
  '6_5':[37,'风火家人','利女贞。内治有序，家道和睦则外事可成。'],
  '5_3':[38,'火泽睽','小事吉。志趣乖违，求同存异，小事可为大事慎。'],
  '2_4':[39,'水山蹇','利西南，不利东北。前有险阻，宜借贵人绕道而行。'],
  '1_2':[40,'雷水解','利西南，无所往其来复吉。险难消解，宜速清余患回归常态。'],
  '4_3':[41,'山泽损','有孚，元吉，无咎。损下益上，先舍后得，诚敬为本。'],
  '6_1':[42,'风雷益','利有攸往，利涉大川。损上益下，助人利己，宜果断推进。'],
  '3_7':[43,'泽天夬','扬于王庭，孚号有厉。决断除弊，刚中带柔防反扑。'],
  '7_6':[44,'天风姤','女壮，勿用取女。不期而遇，防微杜渐，慎防暗耗。'],
  '3_0':[45,'泽地萃','亨，王假有庙。人才资源聚集，宜防内耗与突发变故。'],
  '0_6':[46,'地风升','元亨，用见大人。积小成大，顺势而升，得贵人扶助。'],
  '3_2':[47,'泽水困','亨，贞大人吉。陷入困境，言多无益，守正静待破局。'],
  '2_6':[48,'水风井','改邑不改井。资源恒常，重在修浚维护、润泽长久。'],
  '3_5':[49,'泽火革','巳日乃孚，元亨利贞。革故鼎新，时机成熟乃可大变。'],
  '5_6':[50,'火风鼎','元吉，亨。稳重鼎新，凝聚合力，成就新格局。'],
  '1_1':[51,'震为雷','亨，震来虩虩，笑言哑哑。突发震动，戒惧应对反得安宁。'],
  '4_4':[52,'艮为山','艮其背，不获其身。该止则止，定心守位不妄动。'],
  '6_4':[53,'风山渐','女归吉，利贞。循序渐进，戒急戒躁，步步稳成。'],
  '1_3':[54,'雷泽归妹','征凶，无攸利。名分未正或急于求成，宜守分度。'],
  '1_5':[55,'雷火丰','亨，王假之，勿忧。盛大丰盈，防盛极而衰。'],
  '5_4':[56,'火山旅','小亨，旅贞吉。客居飘泊之象，柔顺谨慎，小事可成。'],
  '6_6':[57,'巽为风','小亨，利有攸往。谦逊渗入，反复沟通，借势而行。'],
  '3_3':[58,'兑为泽','亨，利贞。和悦沟通，以诚相交，防口舌是非。'],
  '6_2':[59,'风水涣','亨，王假有庙。涣散离析，宜凝聚人心、化冰解结。'],
  '2_3':[60,'水泽节','亨，苦节不可贞。适度节制有度，过犹不及。'],
  '6_3':[61,'风泽中孚','豚鱼吉，利涉大川。诚信感通，由衷相待则无往不利。'],
  '1_4':[62,'雷山小过','亨，利贞，可小事不可大事。宜谦恭小步，不宜强求大局。'],
  '2_5':[63,'水火既济','亨小，利贞，初吉终乱。功成圆满，须防松懈生变。'],
  '5_2':[64,'火水未济','亨，小狐汔济，濡其尾。尚未收官，最后关头尤需谨慎。']
};

function buildAll64Hexagrams() {
  const list = [], byKey = {};
  PALACE_ORDER.forEach(p => {
    const pTri = TRIGRAMS[p];
    let bits = [p & 1, (p >> 1) & 1, (p >> 2) & 1, p & 1, (p >> 1) & 1, (p >> 2) & 1];
    for (let g = 0; g < 8; g++) {
      if (g >= 1 && g <= 5) bits[g - 1] ^= 1;
      else if (g === 6) bits[3] ^= 1;
      else if (g === 7) { bits[0] = p & 1; bits[1] = (p >> 1) & 1; bits[2] = (p >> 2) & 1; }
      const lower = bits[0] + (bits[1] << 1) + (bits[2] << 2);
      const upper = bits[3] + (bits[4] << 1) + (bits[5] << 2);
      const key = upper + '_' + lower;
      const meta = HEX_DICT[key] || [0, '未知卦', ''];
      const shi = [6, 1, 2, 3, 4, 5, 4, 3][g], ying = ((shi + 2) % 6) + 1;
      const item = {
        key, upper, lower, seq: meta[0], name: meta[1], guaci: meta[2],
        bits: [...bits], palaceId: p, palaceName: pTri.name + '宫', palaceWx: pTri.wx,
        genIndex: g, genName: PALACE_GEN_NAMES[g], shi, ying,
        isLiuChong: (g === 0 || key === '7_1' || key === '1_7'),
        isLiuHe: ['0_7','7_0','0_1','1_0','2_3','3_2','5_4','4_5'].includes(key)
      };
      list.push(item); byKey[key] = item;
    }
  });
  return { list, byKey };
}
const HEX_DATA = buildAll64Hexagrams();

function getLiuQin(palaceWx, lineWx) {
  const rel = {
    '木': { '木':'兄弟', '火':'子孙', '土':'妻财', '金':'官鬼', '水':'父母' },
    '火': { '火':'兄弟', '土':'子孙', '金':'妻财', '水':'官鬼', '木':'父母' },
    '土': { '土':'兄弟', '金':'子孙', '水':'妻财', '木':'官鬼', '火':'父母' },
    '金': { '金':'兄弟', '水':'子孙', '木':'妻财', '火':'官鬼', '土':'父母' },
    '水': { '水':'兄弟', '木':'子孙', '火':'妻财', '土':'官鬼', '金':'父母' }
  };
  return rel[palaceWx]?.[lineWx] || '';
}
function getTenGod(dayStem, otherStem) {
  const dIdx = STEMS.indexOf(dayStem), oIdx = STEMS.indexOf(otherStem);
  if (dIdx < 0 || oIdx < 0) return '';
  const diff = (Math.floor(oIdx / 2) - Math.floor(dIdx / 2) + 5) % 5;
  return [['比肩','劫财'], ['食神','伤官'], ['偏财','正财'], ['七杀','正官'], ['偏印','正印']][diff][(dIdx % 2) === (oIdx % 2) ? 0 : 1];
}
function getWxRelation(wxA, wxB) {
  const order = ['木','火','土','金','水'], a = order.indexOf(wxA), b = order.indexOf(wxB);
  if (a < 0 || b < 0) return '';
  return ['比和','生','克','被克','被生'][(b - a + 5) % 5];
}

function getHexLinesDetail(hex) {
  const najia = [...TRIGRAMS[hex.lower].inner, ...TRIGRAMS[hex.upper].outer];
  const palaceHead = HEX_DATA.byKey[hex.palaceId + '_' + hex.palaceId];
  const headNajia = [...TRIGRAMS[palaceHead.lower].inner, ...TRIGRAMS[palaceHead.upper].outer];
  const presentLQ = new Set();
  const lines = hex.bits.map((b, i) => {
    const gz = najia[i], br = gz[1], wx = BRANCH_WX[BRANCHES.indexOf(br)], lq = getLiuQin(hex.palaceWx, wx);
    presentLQ.add(lq);
    return { pos: i + 1, bit: b, gz, branch: br, wx, liuqin: lq, isShi: hex.shi === i + 1, isYing: hex.ying === i + 1, fushen: null };
  });
  ['父母','兄弟','子孙','妻财','官鬼'].forEach(need => {
    if (!presentLQ.has(need)) {
      headNajia.forEach((hgz, i) => {
        const hbr = hgz[1], hwx = BRANCH_WX[BRANCHES.indexOf(hbr)];
        if (getLiuQin(hex.palaceWx, hwx) === need) lines[i].fushen = { liuqin: need, branch: hbr, wx: hwx, label: need + hbr + hwx };
      });
    }
  });
  return lines;
}

function getShenSha(dayStem, dayBranch) {
  const tianyi = { '甲':'丑未','戊':'丑未','庚':'丑未','乙':'子申','己':'子申','丙':'亥酉','丁':'亥酉','壬':'卯巳','癸':'卯巳','辛':'午寅' }[dayStem] || '';
  const wenchang = { '甲':'巳','乙':'午','丙':'申','丁':'酉','戊':'申','己':'酉','庚':'亥','辛':'子','壬':'寅','癸':'卯' }[dayStem] || '';
  const lu = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' }[dayStem] || '';
  const yima = { '申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳' }[dayBranch] || '';
  const taohua = { '申':'酉','子':'酉','辰':'酉','寅':'卯','午':'卯','戌':'卯','巳':'午','酉':'午','丑':'午','亥':'子','卯':'子','未':'子' }[dayBranch] || '';
  return [{ k:'天乙', v:tianyi }, { k:'禄神', v:lu }, { k:'文昌', v:wenchang }, { k:'驿马', v:yima }, { k:'桃花', v:taohua }];
}

function calcTrueSolarDate(dateObj, lon) {
  if (!lon || Math.abs(lon - 120) < 0.01) return dateObj;
  const dayOfYear = Math.floor((dateObj - new Date(dateObj.getFullYear(), 0, 1)) / 86400000) + 1;
  const B = 2 * Math.PI * (dayOfYear - 81) / 365;
  const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  return new Date(dateObj.getTime() + ((lon - 120) * 4 + eotMin) * 60000);
}

function getAstroDayInfo(dateObj) {
  const y = dateObj.getFullYear(), m = dateObj.getMonth() + 1, d = dateObj.getDate(), h = dateObj.getHours(), min = dateObj.getMinutes();
  const makeP = gz => ({ gz, s: gz[0], b: gz[1], swx: STEM_WX[STEMS.indexOf(gz[0])] || '土', bwx: BRANCH_WX[BRANCHES.indexOf(gz[1])] || '土' });
  if (typeof window.Solar !== 'undefined') {
    const solar = window.Solar.fromYmdHms(y, m, d, h, min, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    const yp = makeP(ec.getYear()), mp = makeP(ec.getMonth()), dp = makeP(ec.getDay()), hp = makeP(ec.getTime());
    const jieqi = lunar.getJieQi() || '';
    const fests = [...lunar.getFestivals(), ...solar.getFestivals()].filter(Boolean);
    let nineStarCenter = 5;
    try { nineStarCenter = lunar.getDayNineStar().getIndex() + 1; } catch (e) {}
    const times = [];
    try { lunar.getTimes().slice(0, 12).forEach(t => times.push({ gz: t.getGanZhi(), br: t.getZhi(), luck: t.getTianShenLuck() })); } catch (e) {}
    return {
      year: yp, month: mp, day: dp, hour: hp, xunkong: lunar.getDayXunKong(),
      lunarStr: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      lunarDayShort: jieqi || fests[0] || (lunar.getDay() === 1 ? lunar.getMonthInChinese() + '月' : lunar.getDayInChinese()),
      isJieQi: Boolean(jieqi || fests[0]), jieqi, huangdiYear: y + 2698,
      yi: lunar.getDayYi() || [], ji: lunar.getDayJi() || [],
      chong: lunar.getDayChongDesc ? lunar.getDayChongDesc() : ('冲' + LIU_CHONG[dp.b]),
      sha: lunar.getDaySha ? lunar.getDaySha() : '',
      taiShen: lunar.getDayPositionTai ? lunar.getDayPositionTai() : '',
      nineStarCenter, times,
      nayin: { y: ec.getYearNaYin(), m: ec.getMonthNaYin(), d: ec.getDayNaYin(), h: ec.getTimeNaYin() },
      taiYuan: ec.getTaiYuan(), mingGong: ec.getMingGong(), shenGong: ec.getShenGong()
    };
  }
  const dIdx = ((40 + Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 10, 26)) / 86400000)) % 60 + 60) % 60;
  const dS = dIdx % 10, dB = dIdx % 12;
  const yIdx = ((((m === 1 || (m === 2 && d < 4)) ? y - 1 : y) - 4) % 60 + 60) % 60;
  const yS = yIdx % 10, yB = yIdx % 12;
  let mOff = 10;
  [[1,6,11],[2,4,0],[3,6,1],[4,5,2],[5,6,3],[6,6,4],[7,7,5],[8,8,6],[9,8,7],[10,8,8],[11,7,9],[12,7,10]].forEach(([jm,jd,off]) => { if (m > jm || (m === jm && d >= jd)) mOff = off; });
  const mB = (2 + mOff) % 12, mS = ([2,4,6,8,0][yS % 5] + mOff) % 10;
  const hB = Math.floor(((h + 1) % 24) / 2), hS = ([0,2,4,6,8][dS % 5] + hB) % 10;
  const k1 = (dB - dS + 22) % 12;
  const dp = makeP(STEMS[dS] + BRANCHES[dB]);
  return {
    year: makeP(STEMS[yS]+BRANCHES[yB]), month: makeP(STEMS[mS]+BRANCHES[mB]), day: dp, hour: makeP(STEMS[hS]+BRANCHES[hB]),
    xunkong: BRANCHES[k1]+BRANCHES[(k1+1)%12], lunarStr: '', lunarDayShort: dp.gz, isJieQi: false, jieqi: '',
    huangdiYear: y + 2698, yi: ['祈福','出行','交易'], ji: ['动土'], chong: '冲'+LIU_CHONG[dp.b], sha: '', taiShen: '',
    nineStarCenter: (dIdx % 9) + 1, times: BRANCHES.map((br, i) => ({ gz: STEMS[([0,2,4,6,8][dS%5]+i)%10]+br, br, luck: i%2===0?'吉':'凶' })),
    nayin: { y:'', m:'', d:'', h:'' }, taiYuan:'', mingGong:'', shenGong:''
  };
}

function runLiuyaoPhysicalExam(mainHex, movingSet, monthBranch, dayBranch, xunkong) {
  const lines = getHexLinesDetail(mainHex);
  const mWx = BRANCH_WX[BRANCHES.indexOf(monthBranch)], dWx = BRANCH_WX[BRANCHES.indexOf(dayBranch)];
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
    if (ln.branch === monthBranch) tags.push('临月建');
    else if (LIU_CHONG[monthBranch] === ln.branch) tags.push('月破');
    else if (LIU_HE[monthBranch] === ln.branch) tags.push('月合');
    else if (mRel === '生' || mRel === '比和') tags.push('月旺');
    else if (mRel === '克') tags.push('月克');
    else tags.push('月休囚');

    if (ln.branch === dayBranch) tags.push('临日辰');
    else if (LIU_CHONG[dayBranch] === ln.branch) tags.push((mRel === '生' || mRel === '比和' || ln.branch === monthBranch) ? '暗动' : '日破');
    else if (LIU_HE[dayBranch] === ln.branch) tags.push('日合');
    else if (dRel === '生') tags.push('日生');
    else if (dRel === '克') tags.push('日克');

    if (xunkong.includes(ln.branch)) tags.push('旬空');
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
    if (ln.fushen) tags.push(`伏${ln.fushen.label}(飞${getWxRelation(ln.wx, ln.fushen.wx)}伏)`);
    return { ...ln, isMov, bian: bLn, tags };
  });
  const sanheHits = [];
  SAN_HE.forEach(g => {
    const matched = g.set.filter(br => activeBranches.has(br));
    if (matched.length === 3) sanheHits.push(`成${g.name}`);
    else if (matched.length === 2) sanheHits.push(`半合${g.name}(待${g.set.find(x => !matched.includes(x))})`);
  });
  return { bianHex, examRows, sanheHits };
}

function findHistoricalSameHex(mainKey, bianKey) {
  return state.archives.filter(a => a.category === '六爻' && a.data?.mainKey === mainKey && (!bianKey || a.data?.bianKey === bianKey));
}

// ==================== 精致高清矢量铜钱 SVG（外圆内方，铭文不重叠） ====================
function renderCoinSvg(isBack) {
  const uidS = Math.random().toString(36).slice(2, 6);
  const chars = isBack ? ['乾','隆','通','寶'] : ['满','文','背','花'];
  return `<svg class="coin-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="cg_${uidS}" cx="32%" cy="28%" r="72%">
        <stop offset="0%" stop-color="#F7E3A8"/>
        <stop offset="55%" stop-color="#C99C4A"/>
        <stop offset="100%" stop-color="#876224"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="46" fill="url(#cg_${uidS})" stroke="#73511B" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,244,210,0.55)" stroke-width="1.2"/>
    <rect x="37" y="37" width="26" height="26" rx="2" fill="var(--surface)" stroke="#73511B" stroke-width="2.2"/>
    <rect x="34.5" y="34.5" width="31" height="31" rx="3" fill="none" stroke="rgba(255,244,210,0.45)" stroke-width="1"/>
    ${isBack ? `
      <text x="50" y="25" text-anchor="middle" font-size="13.5" font-weight="700" fill="#4B310B" font-family="Songti SC, serif">乾</text>
      <text x="50" y="85" text-anchor="middle" font-size="13.5" font-weight="700" fill="#4B310B" font-family="Songti SC, serif">隆</text>
      <text x="79" y="55" text-anchor="middle" font-size="13.5" font-weight="700" fill="#4B310B" font-family="Songti SC, serif">通</text>
      <text x="21" y="55" text-anchor="middle" font-size="13.5" font-weight="700" fill="#4B310B" font-family="Songti SC, serif">寶</text>
    ` : `
      <path d="M21 43 Q17 50 21 57 M25 45 L25 55" stroke="#4B310B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M79 43 Q83 50 79 57 M75 45 L75 55" stroke="#4B310B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="21" r="2.2" fill="#5D3E11"/>
      <circle cx="50" cy="79" r="2.2" fill="#5D3E11"/>
    `}
  </svg>`;
}

// ==================== 实时时钟与排盘表单状态 ====================
function getNowDatetimeLocal() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const castState = {
  lyMode: 'shake',
  lyYaoRolls: [],
  lySpecYaos: [null, null, null, null, null, null], // 索引0=初爻 ... 5=上爻 (值: 6老阴 7少阳 8少阴 9老阳)
  pickingYaoIdx: 5,
  lyName: '', lyGender: '男', lyDir: '一事一问', lyQuestion: '',
  lyDate: getNowDatetimeLocal(), lyDateManual: false,
  lyNum1: '', lyNum2: '', lyNum3: '', lyWord: '',
  bzName: '', bzGender: '男', bzDate: '1996-06-15T12:00', bzCity: '重庆', bzTrueSolar: true,
  mhMode: 'time', mhDate: getNowDatetimeLocal(), mhDateManual: false, mhNum1: '', mhNum2: '', mhWord: '', mhQuestion: '',
  qmType: '时家转盘', qmMethod: '拆补法', qmDate: getNowDatetimeLocal(), qmDateManual: false, qmQuestion: '',
  lrDate: getNowDatetimeLocal(), lrDateManual: false, lrGuiMode: 'auto', lrYueJiang: 'auto', lrQuestion: '',
  zwGender: '男', zwDate: '1996-06-15T12:00',
  fsHeading: 180, fsYear: new Date().getFullYear(),
  selectedStatus: '进行中', selectedOmens: []
};

// 每秒自动同步实时起卦时间（彻底解决晚几分钟的问题）
function startLiveClockSync() {
  setInterval(() => {
    const nowStr = getNowDatetimeLocal();
    if (!castState.lyDateManual && castState.lyDate !== nowStr) {
      castState.lyDate = nowStr;
      const el = document.getElementById('liveLyDateInput');
      if (el) el.value = nowStr;
    }
    if (!castState.qmDateManual && castState.qmDate !== nowStr) {
      castState.qmDate = nowStr;
      const el = document.getElementById('liveQmDateInput');
      if (el) el.value = nowStr;
    }
    if (!castState.lrDateManual && castState.lrDate !== nowStr) {
      castState.lrDate = nowStr;
      const el = document.getElementById('liveLrDateInput');
      if (el) el.value = nowStr;
    }
    if (!castState.mhDateManual && castState.mhDate !== nowStr) {
      castState.mhDate = nowStr;
      const el = document.getElementById('liveMhDateInput');
      if (el) el.value = nowStr;
    }
  }, 1000);
}

// ==================== 蓄力摇卦 & 手机晃动停止出爻逻辑 ====================
let isHoldingCast = false;
let holdClinkTimer = null;
let phoneShakeTimer = null;
let phoneIsShaking = false;

function startHoldCast(e) {
  if (e) e.preventDefault();
  if (castState.lyYaoRolls.length >= 6) { submitLiuyaoByMode(); return; }
  if (isHoldingCast) return;
  isHoldingCast = true;
  const pad = document.getElementById('holdCastPad');
  if (pad) { pad.classList.add('holding'); pad.textContent = '正在摇动铜钱... 松手落盘出爻'; }
  document.querySelectorAll('#coinsStage .coin-wrap').forEach(el => { el.classList.remove('settled'); el.classList.add('shaking'); });
  playCoinClink(false);
  if (navigator.vibrate) navigator.vibrate(25);
  clearInterval(holdClinkTimer);
  holdClinkTimer = setInterval(() => {
    playCoinClink(false);
    if (navigator.vibrate) navigator.vibrate(15);
  }, 210);
}

function endHoldCast(e) {
  if (e) e.preventDefault();
  if (!isHoldingCast) return;
  isHoldingCast = false;
  clearInterval(holdClinkTimer);
  settleOneLiuyao();
}

function settleOneLiuyao() {
  if (castState.lyYaoRolls.length >= 6) return;
  const c = [Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0];
  const val = [9, 8, 7, 6][c[0] + c[1] + c[2]];
  castState.lyYaoRolls.push({ coins: c, val });
  playCoinClink(true);
  if (navigator.vibrate) navigator.vibrate([30, 20, 40]);
  renderDivineView();
  document.querySelectorAll('#coinsStage .coin-wrap').forEach(el => el.classList.add('settled'));
  if (castState.lyYaoRolls.length === 6) {
    setTimeout(() => submitLiuyaoByMode(), 560);
  }
}

function bindPhoneShakeForCast() {
  if (!window.DeviceMotionEvent) return;
  window.addEventListener('devicemotion', e => {
    if (state.mainTab !== 'divine' || state.category !== '六爻' || state.subTab !== 'cast' || castState.lyMode !== 'shake') return;
    if (castState.lyYaoRolls.length >= 6 || document.querySelector('.overlay-page.open')) return;
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0);
    if (mag > 26) {
      if (!phoneIsShaking) {
        phoneIsShaking = true;
        document.querySelectorAll('#coinsStage .coin-wrap').forEach(el => { el.classList.remove('settled'); el.classList.add('shaking'); });
        const pad = document.getElementById('holdCastPad');
        if (pad) { pad.classList.add('holding'); pad.textContent = '感应到摇晃... 停下后自动出爻'; }
      }
      playCoinClink(false);
      clearTimeout(phoneShakeTimer);
      phoneShakeTimer = setTimeout(() => {
        phoneIsShaking = false;
        settleOneLiuyao();
      }, 480);
    }
  });
}

// ==================== 七大门类排盘表单 ====================
function renderCastPanel(wrap) {
  const cat = state.category;
  if (cat === '六爻') renderLiuyaoCastForm(wrap);
  else if (cat === '八字') renderBaziCastForm(wrap);
  else if (cat === '梅花') renderMeihuaCastForm(wrap);
  else if (cat === '奇门') renderQimenCastForm(wrap);
  else if (cat === '六壬') renderLiurenCastForm(wrap);
  else if (cat === '紫微') renderZiweiCastForm(wrap);
  else renderFengshuiCastForm(wrap);
}

function renderSpecYaoPreview(val) {
  if (!val) return '<span style="color:var(--text-3);">请选择</span>';
  const map = {
    7: ['少阳', 'yang', ''],
    8: ['少阴', 'yin', ''],
    9: ['老阳', 'yang', '○'],
    6: ['老阴', 'yin', '×']
  };
  const [lbl, cls, mk] = map[val];
  return `<div style="display:flex;align-items:center;gap:12px;width:100%;">
    <span style="font-weight:600;width:36px;">${lbl}</span>
    <span class="yao-pick-bar ${cls}" style="height:8px;max-width:130px;"></span>
    <span style="color:var(--accent);font-weight:700;font-size:17px;">${mk}</span>
  </div>`;
}

function openYaoPicker(idx) {
  castState.pickingYaoIdx = idx;
  const names = ['初爻','二爻','三爻','四爻','五爻','上爻'];
  document.getElementById('yaoPickerTitle').textContent = `选择 ${names[idx]}`;
  document.getElementById('yaoPickerModal').classList.add('open');
}
function closeYaoPicker() { document.getElementById('yaoPickerModal').classList.remove('open'); }
function selectSpecYaoVal(val) {
  castState.lySpecYaos[castState.pickingYaoIdx] = val;
  closeYaoPicker();
  renderDivineView();
}

function renderLiuyaoCastForm(wrap) {
  const rolls = castState.lyYaoRolls;
  const rollLabels = ['初爻','二爻','三爻','四爻','五爻','上爻'];
  const valMap = { 6:'老阴 ×', 7:'少阳 —', 8:'少阴 --', 9:'老阳 ○' };
  const modes = [['shake','摇卦'],['num','报数'],['spec','指定'],['time','时间'],['word','汉字']];

  let modeHtml = '';
  if (castState.lyMode === 'shake') {
    const lastCoins = rolls.length ? rolls[rolls.length - 1].coins : [1, 0, 1];
    modeHtml = `
      <div class="coins-stage" id="coinsStage">
        ${lastCoins.map(c => `<div class="coin-wrap">${renderCoinSvg(c)}<span class="coin-lbl">${c ? '字（背）' : '花（正）'}</span></div>`).join('')}
      </div>
      <div style="text-align:center;font-size:13.5px;color:var(--text-2);margin:8px 0 12px;">
        已摇 <strong>${rolls.length} / 6</strong> 爻 ${rolls.length ? '· 刚落定：' + rollLabels[rolls.length-1] + ' ' + valMap[rolls[rolls.length-1].val] : '· 按住下方摇动（或晃动手机），停下松手出爻'}
      </div>
      ${rolls.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px;">
        ${rolls.map((r,i) => `<span class="chip ${r.val===6||r.val===9?'accent':''}">${rollLabels[i]} ${valMap[r.val]}</span>`).join('')}
      </div>` : ''}
      <div class="hold-cast-pad" id="holdCastPad"
        onpointerdown="startHoldCast(event)" onpointerup="endHoldCast(event)" onpointercancel="endHoldCast(event)">
        ${rolls.length >= 6 ? '查看专业断事盘 ›' : `按住摇第 ${rolls.length + 1} 爻（松手落盘）`}
      </div>
      <div style="display:flex;justify-content:center;gap:12px;margin-top:12px;">
        <button class="chip" onclick="tossLiuyaoAll()">一键连摇六爻</button>
        ${rolls.length ? `<button class="chip" onclick="castState.lyYaoRolls=[];renderDivineView()">重新起摇</button>` : ''}
      </div>
    `;
  } else if (castState.lyMode === 'spec') {
    const names = ['初爻','二爻','三爻','四爻','五爻','上爻'];
    modeHtml = `
      <div style="margin-top:12px;">
        ${[5,4,3,2,1,0].map(i => `
          <div class="spec-yao-row">
            <span class="spec-yao-lbl">${names[i]}：</span>
            <button class="spec-yao-btn" onclick="openYaoPicker(${i})">
              ${renderSpecYaoPreview(castState.lySpecYaos[i])}
              <span style="color:var(--text-3);font-size:12px;margin-left:8px;">▾</span>
            </button>
          </div>
        `).join('')}
      </div>
      <button class="btn-accent" style="width:100%;margin-top:14px;" onclick="submitLiuyaoByMode()">开始排盘</button>
    `;
  } else if (castState.lyMode === 'num') {
    modeHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0;">
        <input type="number" class="form-input" placeholder="上卦数" value="${castState.lyNum1}" oninput="castState.lyNum1=this.value" />
        <input type="number" class="form-input" placeholder="下卦数" value="${castState.lyNum2}" oninput="castState.lyNum2=this.value" />
        <input type="number" class="form-input" placeholder="动爻数(选)" value="${castState.lyNum3}" oninput="castState.lyNum3=this.value" />
      </div>
      <button class="btn-primary" style="width:100%;" onclick="submitLiuyaoByMode()">报数起卦</button>
    `;
  } else if (castState.lyMode === 'word') {
    modeHtml = `
      <div class="form-field" style="margin-top:14px;">
        <input type="text" class="form-input" placeholder="输入心中浮现的汉字（2字以上最佳）" value="${escapeHtml(castState.lyWord)}" oninput="castState.lyWord=this.value" />
      </div>
      <button class="btn-primary" style="width:100%;" onclick="submitLiuyaoByMode()">汉字起卦</button>
    `;
  } else {
    modeHtml = `<button class="btn-primary" style="width:100%;margin-top:14px;" onclick="submitLiuyaoByMode()">按当前时间起卦</button>`;
  }

  wrap.innerHTML = `
    <div class="card">
      <div class="form-row">
        <span class="form-row-lbl">求测事项</span>
        <div class="form-row-val"><input class="inline-input priv-blur" placeholder="一句话写下所问之事" value="${escapeHtml(castState.lyQuestion)}" oninput="castState.lyQuestion=this.value" /></div>
      </div>
      <div class="form-row">
        <span class="form-row-lbl">起卦时间</span>
        <div class="form-row-val">
          <input id="liveLyDateInput" type="datetime-local" class="inline-input" value="${castState.lyDate}" onchange="castState.lyDate=this.value;castState.lyDateManual=true;renderDivineView()" />
          ${castState.lyDateManual ? `<button class="pill-mini accent" onclick="castState.lyDateManual=false;castState.lyDate=getNowDatetimeLocal();renderDivineView()">实时</button>` : ''}
        </div>
      </div>
      <div class="form-row">
        <span class="form-row-lbl">性别 · 方向</span>
        <div class="form-row-val">
          <select class="form-select" style="width:auto;padding:4px 6px;border:none;background:transparent;font-size:14.5px;" onchange="castState.lyDir=this.value">
            ${['一事一问','求财开单','事业求职','感情姻缘','学业考试','健康出行','失物寻人'].map(d => `<option ${castState.lyDir===d?'selected':''}>${d}</option>`).join('')}
          </select>
          <div class="gender-pill">
            <button class="${castState.lyGender==='男'?'active':''}" onclick="castState.lyGender='男';renderDivineView()">男</button>
            <button class="${castState.lyGender==='女'?'active':''}" onclick="castState.lyGender='女';renderDivineView()">女</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px;">
        ${modes.map(([k,lbl]) => `<button class="btn-secondary" style="padding:8px 2px;font-size:13.5px;${castState.lyMode===k?'background:var(--primary);color:var(--primary-fg);font-weight:600;':''}" onclick="castState.lyMode='${k}';renderDivineView()">${lbl}</button>`).join('')}
      </div>
      ${modeHtml}
    </div>

    <div class="card" style="padding:13px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13.5px;font-weight:600;color:var(--text-2);">现实底色与外应（选填，助 AI 更准）</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        ${['未开始','进行中','僵持中','我主动','我被动'].map(st => `<button class="chip ${castState.selectedStatus===st?'accent':''}" onclick="castState.selectedStatus='${st}';renderDivineView()">${st}</button>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${['风起/落雨','突发声响','心悸直觉','偶遇故人','物落碎裂'].map(om => {
          const on = castState.selectedOmens.includes(om);
          return `<button class="chip ${on?'accent':''}" onclick="toggleCastOmen('${om}')">${om}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}

function toggleCastOmen(om) {
  const i = castState.selectedOmens.indexOf(om);
  if (i >= 0) castState.selectedOmens.splice(i, 1); else castState.selectedOmens.push(om);
  renderDivineView();
}

function tossLiuyaoAll() {
  playCoinClink(true);
  castState.lyYaoRolls = [];
  for (let i = 0; i < 6; i++) {
    const c = [Math.random()<0.5?1:0, Math.random()<0.5?1:0, Math.random()<0.5?1:0];
    castState.lyYaoRolls.push({ coins: c, val: [9,8,7,6][c[0]+c[1]+c[2]] });
  }
  submitLiuyaoByMode();
}

function submitLiuyaoByMode() {
  const dt = castState.lyDateManual && castState.lyDate ? new Date(castState.lyDate) : new Date();
  const info = getAstroDayInfo(dt);
  let mainHex = HEX_DATA.byKey['7_7'];
  const movSet = new Set();

  if (castState.lyMode === 'shake' && castState.lyYaoRolls.length === 6) {
    const bits = castState.lyYaoRolls.map(r => (r.val === 7 || r.val === 9) ? 1 : 0);
    castState.lyYaoRolls.forEach((r, i) => { if (r.val === 6 || r.val === 9) movSet.add(i + 1); });
    mainHex = HEX_DATA.byKey[(bits[3]+(bits[4]<<1)+(bits[5]<<2)) + '_' + (bits[0]+(bits[1]<<1)+(bits[2]<<2))];
  } else if (castState.lyMode === 'spec') {
    if (castState.lySpecYaos.some(v => !v)) return showToast('请先选完上爻到初爻全部六爻');
    const bits = castState.lySpecYaos.map(v => (v === 7 || v === 9) ? 1 : 0);
    castState.lySpecYaos.forEach((v, i) => { if (v === 6 || v === 9) movSet.add(i + 1); });
    mainHex = HEX_DATA.byKey[(bits[3]+(bits[4]<<1)+(bits[5]<<2)) + '_' + (bits[0]+(bits[1]<<1)+(bits[2]<<2))];
  } else if (castState.lyMode === 'num') {
    const n1 = Math.max(1, parseInt(castState.lyNum1) || (dt.getHours() + 1));
    const n2 = Math.max(1, parseInt(castState.lyNum2) || (dt.getMinutes() + 1));
    const n3 = parseInt(castState.lyNum3) || (n1 + n2);
    mainHex = HEX_DATA.byKey[NUM_TO_TRI[n1 % 8] + '_' + NUM_TO_TRI[n2 % 8]];
    movSet.add((n3 % 6) || 6);
  } else if (castState.lyMode === 'word') {
    const w = castState.lyWord.trim() || '藏往';
    const c1 = w.charCodeAt(0), c2 = w.charCodeAt(w.length - 1);
    mainHex = HEX_DATA.byKey[NUM_TO_TRI[c1 % 8] + '_' + NUM_TO_TRI[c2 % 8]];
    movSet.add(((c1 + c2) % 6) || 6);
  } else {
    const up = NUM_TO_TRI[(dt.getFullYear() + dt.getMonth() + 1 + dt.getDate()) % 8];
    const low = NUM_TO_TRI[(dt.getFullYear() + dt.getMonth() + 1 + dt.getDate() + dt.getHours()) % 8];
    mainHex = HEX_DATA.byKey[up + '_' + low];
    movSet.add(((dt.getHours() + dt.getMinutes()) % 6) || 6);
  }

  openLiuyaoResult({
    id: uid('arc'), category: '六爻',
    title: castState.lyQuestion.trim() || `${mainHex.name}（${castState.lyDir}）`,
    personName: castState.lyName.trim(), gender: castState.lyGender,
    group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr,
    status: castState.selectedStatus, omens: [...castState.selectedOmens],
    data: {
      mainKey: mainHex.key, moving: Array.from(movSet),
      yearGz: info.year.gz, monthGz: info.month.gz, dayGz: info.day.gz, hourGz: info.hour.gz,
      xunkong: info.xunkong, simMonthBranch: info.month.b, simDayBranch: info.day.b, lockedYongshenPos: null
    },
    reports: [], followUps: [], note: '', outcome: '', verdict: 'pending'
  });
}

// ==================== 八字 / 梅花 / 详尽奇门 / 详尽六壬 / 详尽紫微 / 风水 ====================
function renderBaziCastForm(wrap) {
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">命主姓名</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="非必填" value="${escapeHtml(castState.bzName)}" oninput="castState.bzName=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.bzGender==='男'?'active':''}" onclick="castState.bzGender='男';renderDivineView()">男</button><button class="${castState.bzGender==='女'?'active':''}" onclick="castState.bzGender='女';renderDivineView()">女</button></div></div></div>
      <div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><input type="datetime-local" class="inline-input" value="${castState.bzDate}" onchange="castState.bzDate=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">出生城市</span><div class="form-row-val"><select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.bzCity=this.value;renderDivineView()">${Object.keys(CITIES_LON).map(c => `<option ${castState.bzCity===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
      <div class="form-row"><span class="form-row-lbl">真太阳时</span><div class="form-row-val"><label style="font-size:14px;display:flex;align-items:center;gap:6px;"><input type="checkbox" ${castState.bzTrueSolar?'checked':''} onchange="castState.bzTrueSolar=this.checked;renderDivineView()" />东经 ${CITIES_LON[castState.bzCity]}° 校正</label></div></div>
    </div>
    <button class="btn-primary" style="width:100%;" onclick="submitBaziCast()">开始八字排盘</button>
    <div style="text-align:center;margin-top:14px;"><button class="chip" onclick="openBaziCompare()">双人八字合盘对比 ›</button></div>
  `;
}

function submitBaziCast() {
  const rawDt = castState.bzDate ? new Date(castState.bzDate) : new Date();
  const effDt = calcTrueSolarDate(rawDt, castState.bzTrueSolar ? (CITIES_LON[castState.bzCity] || 120) : 120);
  const info = getAstroDayInfo(effDt);
  const dm = info.day.s;
  const pillars = [info.year, info.month, info.day, info.hour].map((p, idx) => ({
    ...p,
    shishen: idx === 2 ? (castState.bzGender === '男' ? '元男' : '元女') : getTenGod(dm, p.s),
    hidden: HIDDEN_STEMS[p.b].split('').map(hs => hs + '(' + getTenGod(dm, hs) + ')').join(' ')
  }));
  const forward = ((STEMS.indexOf(info.year.s) % 2) === 0 && castState.bzGender === '男') || ((STEMS.indexOf(info.year.s) % 2) === 1 && castState.bzGender === '女');
  const mSIdx = STEMS.indexOf(info.month.s), mBIdx = BRANCHES.indexOf(info.month.b);
  const dayun = Array.from({length:8}, (_, i) => {
    const step = forward ? i + 1 : -(i + 1);
    const s = STEMS[((mSIdx + step) % 10 + 10) % 10], b = BRANCHES[((mBIdx + step) % 12 + 12) % 12];
    return { age: i * 10 + 4, gz: s + b, ss: getTenGod(dm, s) };
  });
  openGenericResult({
    id: uid('arc'), category: '八字', title: (castState.bzName.trim() || '八字命盘') + `（${info.day.gz}日主）`,
    personName: castState.bzName.trim(), gender: castState.bzGender, group: '默认',
    createdAt: Date.now(), castTimeStr: effDt.toLocaleString() + (castState.bzTrueSolar ? `（${castState.bzCity}真太阳时）` : ''),
    lunarStr: info.lunarStr,
    data: { pillars, xunkong: info.xunkong, nayin: info.nayin, dayun, taiYuan: info.taiYuan, mingGong: info.mingGong, shenGong: info.shenGong },
    reports: [], followUps: [], note: '', outcome: '', verdict: 'pending'
  });
}

function renderMeihuaCastForm(wrap) {
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">占问事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="写下所问之事" value="${escapeHtml(castState.mhQuestion)}" oninput="castState.mhQuestion=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">起卦时间</span><div class="form-row-val"><input id="liveMhDateInput" type="datetime-local" class="inline-input" value="${castState.mhDate}" onchange="castState.mhDate=this.value;castState.mhDateManual=true" /></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0;">
        ${[['time','时间起卦'],['num','报数起卦'],['word','汉字起卦']].map(([k,l])=>`<button class="btn-secondary" style="${castState.mhMode===k?'background:var(--primary);color:var(--primary-fg);':''}" onclick="castState.mhMode='${k}';renderDivineView()">${l}</button>`).join('')}
      </div>
      ${castState.mhMode==='num' ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <input type="number" class="form-input" placeholder="上卦数" value="${castState.mhNum1}" oninput="castState.mhNum1=this.value" />
        <input type="number" class="form-input" placeholder="下卦数" value="${castState.mhNum2}" oninput="castState.mhNum2=this.value" />
      </div>` : ''}
      ${castState.mhMode==='word' ? `<input type="text" class="form-input" style="margin-bottom:12px;" placeholder="输入任意汉字" value="${escapeHtml(castState.mhWord)}" oninput="castState.mhWord=this.value" />` : ''}
      <button class="btn-primary" style="width:100%;" onclick="submitMeihuaCast()">起梅花易数详盘</button>
    </div>
  `;
}

function submitMeihuaCast() {
  const dt = castState.mhDateManual && castState.mhDate ? new Date(castState.mhDate) : new Date();
  const info = getAstroDayInfo(dt);
  let n1 = dt.getFullYear() + dt.getMonth() + 1 + dt.getDate(), n2 = n1 + dt.getHours() + 1;
  if (castState.mhMode === 'num') { n1 = Math.max(1, parseInt(castState.mhNum1) || n1); n2 = Math.max(1, parseInt(castState.mhNum2) || n2); }
  else if (castState.mhMode === 'word') { const w = castState.mhWord.trim() || '梅花'; n1 = w.charCodeAt(0); n2 = w.charCodeAt(w.length - 1); }
  const up = NUM_TO_TRI[n1 % 8], low = NUM_TO_TRI[n2 % 8], movPos = ((n1 + n2) % 6) || 6;
  const mainHex = HEX_DATA.byKey[up + '_' + low];
  const huHex = HEX_DATA.byKey[(mainHex.bits[2]+(mainHex.bits[3]<<1)+(mainHex.bits[4]<<2)) + '_' + (mainHex.bits[1]+(mainHex.bits[2]<<1)+(mainHex.bits[3]<<2))];
  const bBits = mainHex.bits.map((b, i) => (i + 1 === movPos) ? (b ^ 1) : b);
  const bianHex = HEX_DATA.byKey[(bBits[3]+(bBits[4]<<1)+(bBits[5]<<2)) + '_' + (bBits[0]+(bBits[1]<<1)+(bBits[2]<<2))];
  const tiTri = movPos <= 3 ? TRIGRAMS[up] : TRIGRAMS[low], yongTri = movPos <= 3 ? TRIGRAMS[low] : TRIGRAMS[up];
  const mWx = BRANCH_WX[BRANCHES.indexOf(info.month.b)];
  const tiWang = getWxRelation(mWx, tiTri.wx);
  openGenericResult({
    id: uid('arc'), category: '梅花', title: castState.mhQuestion.trim() || `${mainHex.name} 变 ${bianHex.name}`,
    group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr,
    data: {
      mainKey: mainHex.key, huKey: huHex.key, bianKey: bianHex.key, movPos,
      tiName: `${tiTri.name}(${tiTri.wx})`, yongName: `${yongTri.name}(${yongTri.wx})`,
      tiYongRel: `用${getWxRelation(yongTri.wx, tiTri.wx)}体 · 月令(${info.month.b}${mWx})${tiWang}体卦`,
      gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong
    },
    reports: [], followUps: [], note: '', outcome: '', verdict: 'pending'
  });
}

function renderQimenCastForm(wrap) {
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">求测事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="描述所测之事" value="${escapeHtml(castState.qmQuestion)}" oninput="castState.qmQuestion=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">起局时间</span><div class="form-row-val"><input id="liveQmDateInput" type="datetime-local" class="inline-input" value="${castState.qmDate}" onchange="castState.qmDate=this.value;castState.qmDateManual=true" /></div></div>
      <div class="form-row"><span class="form-row-lbl">排盘方式</span><div class="form-row-val">
        <select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.qmType=this.value">
          <option ${castState.qmType==='时家转盘'?'selected':''}>时家转盘</option>
          <option ${castState.qmType==='飞盘奇门'?'selected':''}>飞盘奇门</option>
          <option ${castState.qmType==='阴盘奇门'?'selected':''}>阴盘奇门</option>
        </select>
      </div></div>
      <div class="form-row"><span class="form-row-lbl">定局法则</span><div class="form-row-val">
        <select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.qmMethod=this.value">
          <option ${castState.qmMethod==='拆补法'?'selected':''}>拆补法</option>
          <option ${castState.qmMethod==='置闰法'?'selected':''}>置闰法</option>
          <option ${castState.qmMethod==='茅山道人法'?'selected':''}>茅山道人法</option>
        </select>
      </div></div>
    </div>
    <button class="btn-primary" style="width:100%;" onclick="submitQimenCast()">排奇门遁甲详局</button>
  `;
}

function submitQimenCast() {
  const dt = castState.qmDateManual && castState.qmDate ? new Date(castState.qmDate) : new Date();
  const info = getAstroDayInfo(dt);
  const m = dt.getMonth() + 1, d = dt.getDate();
  // 冬至到夏至为阳遁，夏至到冬至为阴遁
  const isYang = (m < 6 || (m === 6 && d < 21) || (m === 12 && d >= 21));
  const yuan = (d % 15 <= 5) ? '上元' : (d % 15 <= 10 ? '中元' : '下元');
  const ju = ((m + Math.floor(d / 5) + (isYang ? 0 : 3)) % 9) + 1;
  const hIdx = STEMS.indexOf(info.hour.s), hBIdx = BRANCHES.indexOf(info.hour.b);
  const xunShouIdx = ((hBIdx - hIdx + 12) % 12);
  const xunShouMap = { 0:'甲子戊', 10:'甲戌己', 8:'甲申庚', 6:'甲午辛', 4:'甲辰壬', 2:'甲寅癸' };
  const xunShou = xunShouMap[xunShouIdx] || '甲子戊';
  const yimaBr = { '申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳' }[info.hour.b] || '寅';
  const brToGong = { '子':1,'丑':8,'寅':8,'卯':3,'辰':4,'巳':4,'午':9,'未':2,'申':2,'酉':7,'戌':6,'亥':6 };
  const maGong = brToGong[yimaBr] || 8;
  const kongGongs = info.xunkong.split('').map(b => brToGong[b]);

  const qiyi = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
  const ringGongs = [1, 8, 3, 4, 9, 2, 7, 6];
  const baseStars = { 1:'天蓬', 8:'天任', 3:'天冲', 4:'天辅', 9:'天英', 2:'天芮', 7:'天柱', 6:'天心', 5:'天禽' };
  const baseDoors = { 1:'休门', 8:'生门', 3:'伤门', 4:'杜门', 9:'景门', 2:'死门', 7:'惊门', 6:'开门', 5:'中宫' };
  const gods = ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'];

  // 排地盘三奇六仪
  const diPan = {};
  for (let i = 0; i < 9; i++) {
    const g = isYang ? ((ju - 1 + i) % 9) + 1 : ((ju - 1 - i + 18) % 9) + 1;
    diPan[g] = qiyi[i];
  }
  const leadGan = xunShou[2];
  const fuOrigGong = Number(Object.keys(diPan).find(k => diPan[k] === leadGan) || 1);
  const zhiFuStar = baseStars[fuOrigGong] || '天蓬';
  const zhiShiDoor = baseDoors[fuOrigGong === 5 ? 2 : fuOrigGong] || '休门';
  const hourTargetGan = info.hour.s === '甲' ? leadGan : info.hour.s;
  const fuCurrGong = Number(Object.keys(diPan).find(k => diPan[k] === hourTargetGan) || 1);
  const ringShift = (ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) - ringGongs.indexOf(fuOrigGong === 5 ? 2 : fuOrigGong) + 8) % 8;
  const doorShift = (hIdx % 8);

  const displayOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const gongNames = { 4:'巽四', 9:'离九', 2:'坤二', 3:'震三', 5:'中五', 7:'兑七', 8:'艮八', 1:'坎一', 6:'乾六' };
  const palaces = displayOrder.map(g => {
    if (g === 5) {
      return { gong: 5, gName: '中五宫', god: '寄坤', star: '天禽', door: '中宫', tian: diPan[5], di: diPan[5], anGan: '', isMa: false, isKong: false };
    }
    const rIdx = ringGongs.indexOf(g);
    const srcStarGong = ringGongs[(rIdx - ringShift + 8) % 8];
    const srcDoorGong = ringGongs[(rIdx - doorShift + 8) % 8];
    const godIdx = isYang ? (rIdx - ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) + 8) % 8 : (ringGongs.indexOf(fuCurrGong === 5 ? 2 : fuCurrGong) - rIdx + 8) % 8;
    return {
      gong: g, gName: gongNames[g],
      god: gods[godIdx],
      star: baseStars[srcStarGong],
      door: baseDoors[srcDoorGong],
      tian: diPan[srcStarGong],
      di: diPan[g],
      anGan: qiyi[(rIdx + hIdx) % 9],
      isMa: g === maGong,
      isKong: kongGongs.includes(g)
    };
  });

  openGenericResult({
    id: uid('arc'), category: '奇门',
    title: castState.qmQuestion.trim() || `${isYang?'阳':'阴'}遁${ju}局 · ${zhiFuStar}/${zhiShiDoor}`,
    group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr,
    data: {
      dun: `${isYang?'阳':'阴'}遁${ju}局（${yuan} · ${castState.qmMethod}）`, type: castState.qmType,
      zhiFuStar, zhiShiDoor, xunShou, yimaBr,
      gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong, palaces
    },
    reports: [], followUps: [], note: '', outcome: '', verdict: 'pending'
  });
}

function renderLiurenCastForm(wrap) {
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">占问事项</span><div class="form-row-val"><input class="inline-input priv-blur" placeholder="描述所测之事" value="${escapeHtml(castState.lrQuestion)}" oninput="castState.lrQuestion=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">起课时间</span><div class="form-row-val"><input id="liveLrDateInput" type="datetime-local" class="inline-input" value="${castState.lrDate}" onchange="castState.lrDate=this.value;castState.lrDateManual=true" /></div></div>
      <div class="form-row"><span class="form-row-lbl">月将选择</span><div class="form-row-val">
        <select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.lrYueJiang=this.value">
          <option value="auto">按中气自动推算</option>
          ${BRANCHES.map(b => `<option value="${b}" ${castState.lrYueJiang===b?'selected':''}>${b}将</option>`).join('')}
        </select>
      </div></div>
      <div class="form-row"><span class="form-row-lbl">昼夜贵人</span><div class="form-row-val">
        <select class="form-select" style="width:auto;border:none;background:transparent;text-align:right;" onchange="castState.lrGuiMode=this.value">
          <option value="auto">按时辰自动（卯-申昼/酉-寅夜）</option>
          <option value="day">强制昼贵</option>
          <option value="night">强制夜贵</option>
        </select>
      </div></div>
    </div>
    <button class="btn-primary" style="width:100%;" onclick="submitLiurenCast()">起大六壬四课三传</button>
  `;
}

function submitLiurenCast() {
  const dt = castState.lrDateManual && castState.lrDate ? new Date(castState.lrDate) : new Date();
  const info = getAstroDayInfo(dt);
  const hIdx = BRANCHES.indexOf(info.hour.b);
  const yueJiangIdx = castState.lrYueJiang === 'auto' ? (12 - (dt.getMonth() + 1) + 1) % 12 : BRANCHES.indexOf(castState.lrYueJiang);
  const offset = (yueJiangIdx - hIdx + 12) % 12;
  const getSky = br => BRANCHES[(BRANCHES.indexOf(br) + offset) % 12];
  const isDayGui = castState.lrGuiMode === 'day' || (castState.lrGuiMode === 'auto' && hIdx >= 3 && hIdx <= 8);
  const jiangNames = ['贵人','螣蛇','朱雀','六合','勾陈','青龙','天空','白虎','太常','玄武','太阴','天后'];
  const getJiang = br => jiangNames[(BRANCHES.indexOf(br) + hIdx) % 12];

  const ganJi = { '甲':'寅','乙':'辰','丙':'巳','丁':'未','戊':'巳','己':'未','庚':'申','辛':'戌','壬':'亥','癸':'丑' }[info.day.s];
  const k1 = getSky(ganJi), k2 = getSky(k1), k3 = getSky(info.day.b), k4 = getSky(k3);
  const dmWx = STEM_WX[STEMS.indexOf(info.day.s)];
  const mkLq = br => getLiuQin(dmWx, BRANCH_WX[BRANCHES.indexOf(br)]);
  const sanchuan = [
    { lbl:'初传', br: k1, jiang: getJiang(k1), lq: mkLq(k1) },
    { lbl:'中传', br: k2, jiang: getJiang(k2), lq: mkLq(k2) },
    { lbl:'末传', br: k4, jiang: getJiang(k4), lq: mkLq(k4) }
  ];
  const tiandi = BRANCHES.map(di => ({ di, tian: getSky(di), jiang: getJiang(getSky(di)) }));

  openGenericResult({
    id: uid('arc'), category: '六壬', title: castState.lrQuestion.trim() || `大六壬 · ${info.day.gz}日 ${info.hour.b}时`,
    group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr,
    data: {
      gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`, xunkong: info.xunkong,
      yueJiang: BRANCHES[yueJiangIdx] + '将', guiType: isDayGui ? '昼贵' : '夜贵',
      sike: [
        { lbl:'一课(干上)', top:k1, bot:info.day.s, jiang:getJiang(k1) },
        { lbl:'二课(干阴)', top:k2, bot:k1, jiang:getJiang(k2) },
        { lbl:'三课(支上)', top:k3, bot:info.day.b, jiang:getJiang(k3) },
        { lbl:'四课(支阴)', top:k4, bot:k3, jiang:getJiang(k4) }
      ],
      sanchuan, tiandi
    },
    reports: [], followUps: [], note: '', outcome: '', verdict: 'pending'
  });
}

function renderZiweiCastForm(wrap) {
  wrap.innerHTML = `
    <div class="card">
      <div class="form-row"><span class="form-row-lbl">出生时间</span><div class="form-row-val"><input type="datetime-local" class="inline-input" value="${castState.zwDate}" onchange="castState.zwDate=this.value" /></div></div>
      <div class="form-row"><span class="form-row-lbl">性　别</span><div class="form-row-val"><div class="gender-pill"><button class="${castState.zwGender==='男'?'active':''}" onclick="castState.zwGender='男';renderDivineView()">男</button><button class="${castState.zwGender==='女'?'active':''}" onclick="castState.zwGender='女';renderDivineView()">女</button></div></div></div>
    </div>
    <button class="btn-primary" style="width:100%;" onclick="submitZiweiCast()">排紫微斗数十二宫详盘</button>
    <div style="text-align:center;margin-top:14px;"><button class="chip" onclick="switchMainTab('methods');switchMethodsSub('tools')">打开中文星官星图 ›</button></div>
  `;
}

function submitZiweiCast() {
  const dt = castState.zwDate ? new Date(castState.zwDate) : new Date();
  const info = getAstroDayInfo(dt);
  const gongNames = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'];
  const stars = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
  const juList = ['水二局','木三局','金四局','土五局','火六局'];
  const sihuaMap = {
    '甲':'廉禄·破权·武科·阳忌', '乙':'机禄·梁权·紫科·阴忌', '丙':'同禄·机权·昌科·廉忌',
    '丁':'阴禄·同权·机科·巨忌', '戊':'贪禄·阴权·弼科·机忌', '己':'武禄·贪权·梁科·曲忌',
    '庚':'阳禄·武权·阴科·同忌', '辛':'巨禄·阳权·曲科·昌忌', '壬':'梁禄·紫权·辅科·武忌', '癸':'破禄·巨权·阴科·贪忌'
  };
  const hIdx = BRANCHES.indexOf(info.hour.b);
  const mingPos = (dt.getMonth() + 2 - hIdx + 12) % 12;
  const shenPos = (dt.getMonth() + 2 + hIdx) % 12;
  const gongs = gongNames.map((gn, i) => {
    const brIdx = (mingPos - i + 12) % 12;
    const isShen = brIdx === shenPos;
    return {
      name: gn + (isShen ? '·身' : ''),
      branch: BRANCHES[brIdx],
      star: stars[(i + dt.getDate()) % stars.length] + (i % 3 === 0 ? ' · ' + stars[(i + 7) % stars.length] : '')
    };
  });
  openGenericResult({
    id: uid('arc'), category: '紫微', title: `紫微命盘（${info.year.gz}年 · ${castState.zwGender}）`,
    group: '默认', createdAt: Date.now(), castTimeStr: dt.toLocaleString(), lunarStr: info.lunarStr,
    data: {
      gz: `${info.year.gz}年 ${info.month.gz}月 ${info.day.gz}日 ${info.hour.gz}时`,
      wuxingJu: juList[(STEMS.indexOf(info.year.s) + mingPos) % 5],
      sihua: sihuaMap[info.year.s] || '',
      gongs
    },
    reports: [], followUps: [], note: '', outcome: '', verdict: 'pending'
  });
}

function renderFengshuiCastForm(wrap) {
  const mountains = ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'];
  const deg = ((castState.fsHeading % 360) + 360) % 360;
  const mIdx = Math.floor(((deg + 7.5) % 360) / 15), sitIdx = (mIdx + 12) % 24;
  const stars = getFlyingStarsGrid(castState.fsYear);
  wrap.innerHTML = `
    <div class="card" style="text-align:center;">
      <div class="card-head"><span class="card-title">电子风水罗盘 · 二十四山</span><button class="pill-mini accent" onclick="enableLiveCompass()">陀螺仪</button></div>
      <div style="font-size:28px;font-weight:700;color:var(--accent);margin:8px 0;">坐${mountains[sitIdx]}向${mountains[mIdx]}（${deg.toFixed(0)}°）</div>
      <input type="range" min="0" max="359" value="${deg}" style="width:100%;accent-color:var(--accent);margin:8px 0;" oninput="castState.fsHeading=Number(this.value);renderDivineView()" />
    </div>
    <div class="card">
      <div class="card-head">
        <span class="card-title">${castState.fsYear} 流年玄空九宫飞星</span>
        <div style="display:flex;gap:6px;"><button class="pill-mini" onclick="castState.fsYear--;renderDivineView()">‹</button><button class="pill-mini" onclick="castState.fsYear++;renderDivineView()">›</button></div>
      </div>
      <div class="nine-grid">
        ${stars.map(c => `<div class="nine-cell"><strong>${c.dir}</strong><br/><span style="color:${c.good?'var(--wx-wood)':'var(--accent)'};font-weight:700;">${c.star}</span><br/><span style="font-size:11px;color:var(--text-3);">${c.desc}</span></div>`).join('')}
      </div>
      <button class="btn-primary" style="width:100%;margin-top:14px;" onclick="submitFengshuiAI()">让参悟分析坐向与流年飞星布局</button>
    </div>
  `;
}

function getFlyingStarsGrid(year) {
  const starInfo = {
    1:['一白贪狼','桃花人缘',true], 2:['二黑巨门','病符宜静',false], 3:['三碧禄存','是非口舌',false],
    4:['四绿文曲','文昌学业',true], 5:['五黄廉贞','煞位忌动',false], 6:['六白武曲','偏财贵人',true],
    7:['七赤破军','破财防盗',false], 8:['八白左辅','正财旺位',true], 9:['九紫右弼','喜庆旺运',true]
  };
  const center = ((11 - ((year - 2000) % 9)) % 9) || 9;
  return [['东南',-1],['正南',4],['西南',-3],['正东',-2],['中宫',0],['正西',2],['东北',3],['正北',-4],['西北',1]].map(([dir, off]) => {
    const num = ((center + off - 1 + 18) % 9) + 1;
    const [star, desc, good] = starInfo[num];
    return { dir, num, star, desc, good };
  });
}
function enableLiveCompass() {
  const handler = e => {
    const h = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : (e.alpha != null ? 360 - e.alpha : null);
    if (h != null) { castState.fsHeading = Math.round(h); if (state.mainTab === 'divine' && state.category === '风水' && state.subTab === 'cast') renderDivineView(); }
  };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(res => { if (res === 'granted') { window.addEventListener('deviceorientation', handler); showToast('罗盘陀螺仪已开启'); } });
  } else { window.addEventListener('deviceorientation', handler); showToast('已启用罗盘感应'); }
}
function submitFengshuiAI() {
  switchMainTab('canwu'); switchCanwuRoom('风水');
  document.getElementById('chatInput').value = `当前方位角 ${castState.fsHeading}°，流年 ${castState.fsYear} 年九宫飞星已排好，请结合我的风水书库给出实操布局与避煞建议。`;
  sendCanwuMessage();
}

// ==================== 专业断事卷宗结果页 ====================
function openLiuyaoResult(record) { state.currentResult = record; state.activeReportTab = 0; initDefaultSelectedBooks('六爻'); renderResultOverlay(); openOverlay('resultOverlay'); markStudyFootprint(); }
function openGenericResult(record) { state.currentResult = record; state.activeReportTab = 0; initDefaultSelectedBooks(record.category); renderResultOverlay(); openOverlay('resultOverlay'); markStudyFootprint(); }
function initDefaultSelectedBooks(cat) {
  const catBooks = state.books.filter(b => b.category === cat);
  state.selectedBookIds = catBooks.length ? [catBooks[0].id] : [];
  state.primaryBookId = catBooks.length ? catBooks[0].id : null;
}

function renderResultOverlay() {
  const rec = state.currentResult; if (!rec) return;
  document.getElementById('resOverlayTitle').textContent = rec.category + '断事卷宗';
  const wrap = document.getElementById('resultOverlayBody');
  let chartHtml = '';

  if (rec.category === '六爻') {
    const d = rec.data, mainHex = HEX_DATA.byKey[d.mainKey];
    const simM = d.simMonthBranch || d.monthGz[1], simD = d.simDayBranch || d.dayGz[1];
    const exam = runLiuyaoPhysicalExam(mainHex, new Set(d.moving || []), simM, simD, d.xunkong);
    d.bianKey = exam.bianHex ? exam.bianHex.key : '';
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0;
    const shensha = getShenSha(d.dayGz[0], d.dayGz[1]);
    const sameList = findHistoricalSameHex(d.mainKey, d.bianKey).filter(x => x.id !== rec.id);

    chartHtml = `
      <div class="card">
        <div style="font-size:14px;color:var(--text-2);line-height:1.7;">
          <div><strong>事项：</strong><span class="priv-blur">${escapeHtml(rec.title)}</span>（${rec.gender}）</div>
          <div><strong>时间：</strong>${escapeHtml(rec.castTimeStr)} ${rec.lunarStr ? '· ' + rec.lunarStr : ''}</div>
          ${rec.status || rec.omens?.length ? `<div><strong>底色与外应：</strong>${escapeHtml(rec.status||'')} ${rec.omens?.length ? '· ' + rec.omens.join('、') : ''}</div>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${shensha.map(s => `<span class="chip">${s.k}-${s.v}</span>`).join('')}
          ${sameList.length ? `<button class="chip accent" onclick="showSameHexList()">⚡ 曾遇同卦 ${sameList.length} 次</button>` : ''}
        </div>
        <div class="gz-banner">${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（日空${d.xunkong}）</div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;padding:4px 4px 8px;border-bottom:1px solid var(--border);">
          <span>主卦【${mainHex.palaceName}】${mainHex.name}${mainHex.isLiuChong?'(六冲)':(mainHex.isLiuHe?'(六合)':'')}</span>
          <span>${exam.bianHex ? `变卦【${exam.bianHex.palaceName}】${exam.bianHex.name}` : '静卦无变'}</span>
        </div>
        ${[5,4,3,2,1,0].map(i => {
          const r = exam.examRows[i], ls = LIU_SHEN[(lsStart + i) % 6], isYs = d.lockedYongshenPos === r.pos, b = r.bian;
          return `<div class="ly-row ${isYs?'yongshen':''}" onclick="toggleLockYongshen(${r.pos})">
            <span style="color:var(--text-3);">${ls}</span>
            <span style="font-size:11px;color:var(--text-3);">${r.fushen ? r.fushen.label : ''}</span>
            <div><span class="yao-svg ${r.bit?'yang':'yin'} ${r.isMov?'mov':''}"></span><span class="wx-${r.wx}" style="font-weight:600;">${r.liuqin}${r.branch}${r.wx}</span>${r.isShi?'<strong style="color:var(--accent);"> 世</strong>':(r.isYing?'<span style="color:var(--text-2);"> 应</span>':'')}${isYs?'<span class="chip accent" style="padding:1px 5px;font-size:10px;margin-left:3px;">用</span>':''}</div>
            <span style="text-align:center;color:var(--accent);font-weight:700;">${r.isMov ? (r.bit ? '○' : '×') : ''}</span>
            <div>${b ? `<span class="yao-svg ${b.bit?'yang':'yin'}"></span><span class="wx-${b.wx}">${b.liuqin}${b.branch}${b.wx}</span>` : ''}</div>
          </div>
          <div style="padding:0 6px 6px;font-size:11.5px;color:var(--text-3);display:flex;flex-wrap:wrap;gap:4px;">
            ${r.tags.map(t => `<span style="padding:1px 6px;border-radius:5px;background:var(--bg);${/破|空|暗动|进神|退神|回头/.test(t)?'color:var(--accent);font-weight:600;':''}">${t}</span>`).join('')}
          </div>`;
        }).join('')}
        ${exam.sanheHits.length ? `<div style="margin-top:6px;font-size:13px;color:var(--accent);font-weight:600;">三合局检测：${exam.sanheHits.join(' · ')}</div>` : ''}
        <div style="font-size:12px;color:var(--text-3);margin-top:6px;">提示：轻点任意一爻可手动锁定为「指定用神」。</div>
      </div>
      <div class="card" style="padding:12px 15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13.5px;font-weight:600;">时空推演沙盘（滑动月日看旺衰空破流转）</span>
          <button class="pill-mini" onclick="resetSimTime()">复原</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          <div>月建：<strong>${simM}月</strong><input type="range" min="0" max="11" value="${BRANCHES.indexOf(simM)}" style="width:100%;accent-color:var(--accent);" oninput="updateSimBranch('m', Number(this.value))" /></div>
          <div>日辰：<strong>${simD}日</strong><input type="range" min="0" max="11" value="${BRANCHES.indexOf(simD)}" style="width:100%;accent-color:var(--accent);" oninput="updateSimBranch('d', Number(this.value))" /></div>
        </div>
      </div>
    `;
  } else if (rec.category === '奇门') {
    const d = rec.data;
    chartHtml = `
      <div class="card">
        <div class="gz-banner">${d.dun} · ${d.type}</div>
        <div style="font-size:13.5px;color:var(--text-2);line-height:1.7;margin-bottom:8px;">
          <div><strong>四柱：</strong>${d.gz}（旬空 ${d.xunkong}）</div>
          <div><strong>值符：</strong><span style="color:var(--accent);font-weight:700;">${d.zhiFuStar}</span> · <strong>值使：</strong><span style="color:var(--accent);font-weight:700;">${d.zhiShiDoor}</span> · <strong>旬首：</strong>${d.xunShou} · <strong>马星：</strong>${d.yimaBr}</div>
        </div>
        <div class="nine-grid">
          ${d.palaces.map(p => `<div class="qimen-cell">
            <div class="qimen-row"><span style="color:var(--text-3);">${p.god}</span><span style="color:var(--accent);font-weight:700;">${p.isKong?'空':''}${p.isMa?'马':''}</span></div>
            <div class="qimen-row"><span style="font-weight:700;">${p.star}</span><strong style="font-size:14px;">${p.tian}</strong></div>
            <div class="qimen-row"><span style="color:var(--accent);font-weight:600;">${p.door}</span><span>${p.di}</span></div>
            <div class="qimen-row" style="font-size:10px;color:var(--text-3);"><span>${p.gName}</span><span>暗${p.anGan||'-'}</span></div>
          </div>`).join('')}
        </div>
      </div>
    `;
  } else if (rec.category === '六壬') {
    const d = rec.data;
    chartHtml = `
      <div class="card">
        <div class="gz-banner">${d.gz}</div>
        <div style="font-size:13.5px;color:var(--text-2);margin-bottom:10px;"><strong>月将：</strong>${d.yueJiang} · <strong>贵人：</strong>${d.guiType} · <strong>旬空：</strong>${d.xunkong}</div>
        <div style="font-size:13.5px;font-weight:700;margin-bottom:6px;">三传（初 → 中 → 末）</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
          ${d.sanchuan.map(c => `<div class="nine-cell"><div style="color:var(--text-3);font-size:11px;">${c.lbl}</div><div style="font-size:16px;font-weight:700;color:var(--accent);">${c.br}</div><div>${c.lq} · ${c.jiang}</div></div>`).join('')}
        </div>
        <div style="font-size:13.5px;font-weight:700;margin-bottom:6px;">四课</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
          ${d.sike.map(k => `<div class="nine-cell"><div style="font-size:10.5px;color:var(--text-3);">${k.jiang}</div><div style="font-weight:700;">${k.top} / ${k.bot}</div><div style="font-size:10px;color:var(--text-3);">${k.lbl}</div></div>`).join('')}
        </div>
      </div>
    `;
  } else if (rec.category === '梅花') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey], hh = HEX_DATA.byKey[d.huKey], bh = HEX_DATA.byKey[d.bianKey];
    const drawMini = (hex, mov) => `<div style="display:flex;flex-direction:column;gap:4px;margin:8px auto;width:54px;">${[5,4,3,2,1,0].map(i=>`<div class="yao-bar ${hex.bits[i]?'yang':'yin'}" style="height:5px;${mov===i+1?'background:var(--accent);':''}"></div>`).join('')}</div>`;
    chartHtml = `
      <div class="card">
        <div class="gz-banner">${d.gz}（空${d.xunkong}）</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
          <div class="pillar-col"><div class="pillar-lbl">本卦(${d.movPos}爻动)</div>${drawMini(mh, d.movPos)}<strong>${mh.name}</strong></div>
          <div class="pillar-col"><div class="pillar-lbl">互卦(过程)</div>${drawMini(hh, 0)}<strong>${hh.name}</strong></div>
          <div class="pillar-col"><div class="pillar-lbl">变卦(结局)</div>${drawMini(bh, 0)}<strong>${bh.name}</strong></div>
        </div>
        <div style="margin-top:12px;font-size:14px;font-weight:600;color:var(--accent);text-align:center;">体卦 ${d.tiName} vs 用卦 ${d.yongName}<br/>${d.tiYongRel}</div>
      </div>
    `;
  } else if (rec.category === '八字') {
    const d = rec.data;
    chartHtml = `
      <div class="card">
        <div style="font-size:13.5px;color:var(--text-2);margin-bottom:8px;"><strong class="priv-blur">${escapeHtml(rec.title)}</strong> · ${escapeHtml(rec.castTimeStr)} · 日空 ${d.xunkong}</div>
        <div class="pillars-grid">
          ${['年柱','月柱','日柱','时柱'].map((lbl,i) => {
            const p = d.pillars[i];
            return `<div class="pillar-col"><div class="pillar-lbl">${lbl} · ${p.shishen}</div><div class="pillar-gz wx-${p.swx}">${p.s}</div><div class="pillar-gz wx-${p.bwx}">${p.b}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px;">${p.hidden}</div></div>`;
          }).join('')}
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--text-2);line-height:1.7;">
          <div><strong>大运：</strong>${d.dayun.map(dy => `${dy.age}岁${dy.gz}(${dy.ss})`).join(' → ')}</div>
          ${d.mingGong ? `<div><strong>胎命身：</strong>胎元 ${d.taiYuan} · 命宫 ${d.mingGong} · 身宫 ${d.shenGong}</div>` : ''}
        </div>
      </div>
    `;
  } else {
    const d = rec.data;
    chartHtml = `
      <div class="card">
        <div class="gz-banner">${d.gz}</div>
        <div style="font-size:13.5px;color:var(--text-2);margin-bottom:8px;"><strong>五行局：</strong>${d.wuxingJu || ''} · <strong>生年四化：</strong><span style="color:var(--accent);font-weight:600;">${d.sihua || ''}</span></div>
        <div class="nine-grid">
          ${(d.gongs || []).map(g => `<div class="nine-cell"><strong>${g.name}（${g.branch}）</strong><br/>${g.star}</div>`).join('')}
        </div>
      </div>
    `;
  }

  const catBooks = state.books.filter(b => b.category === rec.category);
  const bookSelectorHtml = catBooks.length ? `
    <div style="margin-bottom:12px;">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span>选择参考典籍（多选即对照 PK）</span>
        <button class="pill-mini" onclick="selectAllCatBooks('${rec.category}')">全选综合</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${catBooks.map(b => {
          const on = state.selectedBookIds.includes(b.id);
          const isPrimary = state.primaryBookId === b.id && state.selectedBookIds.length > 1;
          return `<button class="chip ${on?'accent':''}" onclick="toggleSelectBookForAI('${b.id}')" oncontextmenu="event.preventDefault();setPrimaryBook('${b.id}')">${isPrimary ? '★主 ' : ''}${escapeHtml(b.title)}</button>`;
        }).join('')}
      </div>
    </div>
  ` : `<div style="font-size:13px;color:var(--text-3);margin-bottom:12px;">「${rec.category}」藏书阁暂未导入典籍，将按经典通用理法分析。</div>`;

  const reps = rec.reports || [], activeRep = reps[state.activeReportTab] || null;
  const reportsHtml = reps.length ? `
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;">
      ${reps.map((rp, idx) => `<button class="chip ${idx===state.activeReportTab?'accent':''}" onclick="state.activeReportTab=${idx};renderResultOverlay()">${escapeHtml(rp.label)}</button>`).join('')}
    </div>
    <div style="font-size:15px;line-height:1.75;padding:12px 14px;border-radius:14px;background:var(--bg);">${formatRichText(activeRep.content)}</div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="chip" onclick="followUpFromResult()">继续追问参悟</button>
      <button class="chip accent" onclick="feedbackResultToBrain()">有偏差，写入纠偏</button>
    </div>
  ` : `<div style="font-size:13.5px;color:var(--text-3);padding:6px 0;">点击下方按钮，参悟将结合本地体检数据与所选典籍，分三层（吉凶定性 / 细节象意 / 具体公历应期）精准分析并随卷宗永久保存。</div>`;

  const groupOpts = ['默认', ...(state.settings.groups || [])];
  wrap.innerHTML = `
    ${chartHtml}
    <div class="card">
      <div class="card-head"><span class="card-title">参悟 AI 选书断盘</span><span class="pill-mini">${reps.length ? '已存 '+reps.length+' 份对比' : '多书 PK'}</span></div>
      ${bookSelectorHtml}
      <button class="btn-primary" style="width:100%;margin-bottom:12px;" id="runChartAiBtn" onclick="runSelectedBooksAnalysis()">${reps.length ? '+ 按所选书追加一份对比分析' : '开始参悟精准分析'}</button>
      ${reportsHtml}
    </div>
    <div class="card">
      <div class="card-head">
        <span class="card-title">备注、应验与存档</span>
        <select class="form-select" style="width:auto;padding:5px 10px;font-size:13px;" onchange="state.currentResult.verdict=this.value">
          <option value="pending" ${rec.verdict==='pending'?'selected':''}>待验证</option>
          <option value="hit" ${rec.verdict==='hit'?'selected':''}>已应验</option>
          <option value="miss" ${rec.verdict==='miss'?'selected':''}>有偏差</option>
        </select>
      </div>
      <div class="form-field"><textarea class="form-textarea priv-blur" placeholder="记录自己的断语思路或现场细节..." oninput="state.currentResult.note=this.value">${escapeHtml(rec.note || '')}</textarea></div>
      <div class="form-field"><label class="form-label">真实应验结果</label><textarea class="form-textarea priv-blur" style="min-height:64px;" placeholder="后来实际发生了什么..." oninput="state.currentResult.outcome=this.value">${escapeHtml(rec.outcome || '')}</textarea></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:14px;">分组：</span><select class="form-select" style="width:auto;padding:6px 10px;font-size:14px;" onchange="state.currentResult.group=this.value">${groupOpts.map(g => `<option value="${escapeHtml(g)}" ${rec.group===g?'selected':''}>${escapeHtml(g)}</option>`).join('')}</select></div>
        <div style="display:flex;gap:8px;">
          ${rec.outcome ? `<button class="btn-secondary" onclick="reviewArchiveOutcome()">AI 复盘</button>` : ''}
          <button class="btn-accent" style="padding:10px 18px;" onclick="saveCurrentResultToArchive()">保存到档案</button>
        </div>
      </div>
    </div>
  `;
}

function toggleLockYongshen(pos) { const d = state.currentResult.data; d.lockedYongshenPos = d.lockedYongshenPos === pos ? null : pos; renderResultOverlay(); }
function updateSimBranch(type, idx) { if (type === 'm') state.currentResult.data.simMonthBranch = BRANCHES[idx]; else state.currentResult.data.simDayBranch = BRANCHES[idx]; renderResultOverlay(); }
function resetSimTime() { const d = state.currentResult.data; d.simMonthBranch = d.monthGz[1]; d.simDayBranch = d.dayGz[1]; renderResultOverlay(); }
function toggleSelectBookForAI(id) {
  const i = state.selectedBookIds.indexOf(id);
  if (i >= 0) state.selectedBookIds.splice(i, 1); else state.selectedBookIds.push(id);
  if (!state.selectedBookIds.includes(state.primaryBookId)) state.primaryBookId = state.selectedBookIds[0] || null;
  renderResultOverlay();
}
function selectAllCatBooks(cat) { const ids = state.books.filter(b => b.category === cat).map(b => b.id); state.selectedBookIds = ids; state.primaryBookId = ids[0] || null; renderResultOverlay(); }
function setPrimaryBook(id) { if (!state.selectedBookIds.includes(id)) state.selectedBookIds.push(id); state.primaryBookId = id; renderResultOverlay(); showToast('已设为主断基准书'); }
function showSameHexList() {
  const rec = state.currentResult, list = findHistoricalSameHex(rec.data.mainKey, rec.data.bianKey).filter(x => x.id !== rec.id);
  if (list.length) alert('历史同卦命中：\n\n' + list.map((x, i) => `${i+1}. ${x.title}（${x.castTimeStr}）\n应验：${x.outcome || '未记'}`).join('\n\n'));
}
async function saveCurrentResultToArchive() {
  const rec = state.currentResult; if (!rec) return;
  rec.updatedAt = Date.now();
  await dbPut('archives', rec);
  state.archives = state.archives.filter(a => a.id !== rec.id);
  state.archives.push(rec);
  await markDirty();
  showToast(`已完整保存（含 ${rec.reports.length} 份 AI 报告）到档案库`);
}

function exportResultPoster() {
  const rec = state.currentResult; if (!rec) return;
  const canvas = document.createElement('canvas'); canvas.width = 750; canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 750, 1080);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2; ctx.strokeRect(28, 28, 694, 1024);
  ctx.fillStyle = '#1D1D1F'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('藏往 · ' + rec.category + '卷宗', 56, 94);
  ctx.fillStyle = '#6E6E73'; ctx.font = '22px sans-serif'; ctx.fillText('时间：' + (rec.castTimeStr || ''), 56, 136); ctx.fillText('事项：' + (rec.title || '').slice(0, 26), 56, 172);
  let y = 230;
  if (rec.category === '六爻') {
    const d = rec.data, mh = HEX_DATA.byKey[d.mainKey], exam = runLiuyaoPhysicalExam(mh, new Set(d.moving || []), d.monthGz[1], d.dayGz[1], d.xunkong);
    ctx.fillStyle = '#1D1D1F'; ctx.fillRect(56, y - 30, 638, 48);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 23px sans-serif'; ctx.fillText(`${d.yearGz}年 ${d.monthGz}月 ${d.dayGz}日 ${d.hourGz}时（空${d.xunkong}）`, 76, y + 2);
    y += 54; ctx.fillStyle = '#1D1D1F'; ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`主卦：${mh.name}   ${exam.bianHex ? '变卦：' + exam.bianHex.name : '静卦'}`, 56, y); y += 44;
    const lsStart = LIU_SHEN_START[d.dayGz[0]] || 0;
    [5,4,3,2,1,0].forEach(i => {
      const r = exam.examRows[i];
      ctx.fillStyle = r.isMov ? '#C83B2B' : '#1D1D1F'; ctx.font = '22px sans-serif';
      ctx.fillText(`${LIU_SHEN[(lsStart+i)%6]}  ${r.bit?'━━━━':'━━  ━━'}  ${r.liuqin}${r.branch}${r.wx}${r.isShi?' 世':(r.isYing?' 应':'')}  ${r.isMov?(r.bit?'○→ ':'×→ ')+(r.bian?r.bian.liuqin+r.bian.branch+r.bian.wx:''):''}`, 60, y);
      y += 44;
    });
  }
  y += 22; ctx.fillStyle = '#1D1D1F'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('参悟断语节选', 56, y); y += 36;
  ctx.fillStyle = '#4A4A4F'; ctx.font = '20px sans-serif';
  const repText = (rec.reports?.[state.activeReportTab]?.content || rec.note || '暂无断语').replace(/\n+/g, ' ');
  for (let i = 0; i < Math.min(repText.length, 320); i += 28) { ctx.fillText(repText.slice(i, i + 28), 56, y); y += 32; if (y > 1000) break; }
  const a = document.createElement('a'); a.download = `藏往_${rec.category}_${formatDateKey(new Date())}.png`; a.href = canvas.toDataURL('image/png'); a.click();
  showToast('典藏长图已生成');
}

// ==================== 万年干支历 ====================
function getYingqiFlagsMap() {
  const map = {};
  state.archives.forEach(a => (a.yingqiDates || []).forEach(dt => { if (!map[dt]) map[dt] = []; map[dt].push(a.title); }));
  return map;
}
function getPersonalResonanceText(dayPillarGz) {
  const my = (state.settings.myDayPillar || '').trim(); if (my.length < 2) return '';
  const ss = getTenGod(my[0], dayPillarGz[0]);
  let tip = `今日为你本命【${ss}】`;
  if (LIU_CHONG[my[1]] === dayPillarGz[1]) tip += '，地支日冲：变动气场偏强，宜守静慢决策。';
  else if (LIU_HE[my[1]] === dayPillarGz[1]) tip += '，地支六合：人缘协作顺畅，利沟通谈判。';
  else tip += '，气场平稳有序，按计划推进即可。';
  return tip;
}
function renderCalendarView() {
  const wrap = document.getElementById('calendarScrollArea');
  const y = state.calYear, m = state.calMonth;
  const startDow = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate(), prevDays = new Date(y, m, 0).getDate();
  const todayKey = formatDateKey(new Date()), flagsMap = getYingqiFlagsMap();
  let cells = '';
  for (let i = startDow - 1; i >= 0; i--) cells += `<div class="cal-cell other"><span class="cal-day-num">${prevDays - i}</span></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m, d, 12, 0), key = formatDateKey(dt), info = getAstroDayInfo(dt);
    const isSel = key === state.calSelectedDate, isToday = key === todayKey;
    const goodMatch = state.calYiFilter && info.yi.some(x => x.includes(state.calYiFilter));
    cells += `<div class="cal-cell ${isSel?'selected':''} ${isToday?'today':''} ${goodMatch?'good-match':''}" onclick="selectCalDate('${key}')">
      <span class="cal-day-num">${d}</span>
      <span class="cal-sub ${info.isJieQi?'jieqi':''}">${escapeHtml(info.lunarDayShort.slice(0,4))}</span>
      <div class="cal-dots">${state.footprints[key]?'<span class="dot-study"></span>':''}${flagsMap[key]?'<span class="dot-flag"></span>':''}</div>
    </div>`;
  }
  const [sy, sm, sd] = state.calSelectedDate.split('-').map(Number);
  const info = getAstroDayInfo(new Date(sy, sm - 1, sd, new Date().getHours(), new Date().getMinutes()));
  const resTip = getPersonalResonanceText(info.day.gz), dayFlags = flagsMap[state.calSelectedDate] || [];
  const starNames = ['一白水','二黑土','三碧木','四绿木','五黄土','六白金','七赤金','八白土','九紫火'];
  const cStar = info.nineStarCenter || 5;
  wrap.innerHTML = `
    ${resTip ? `<div class="card" style="padding:12px 16px;background:var(--accent-soft);"><div style="font-size:13.5px;color:var(--accent);"><strong>个人天时共振：</strong><span class="priv-blur">${escapeHtml(resTip)}</span></div></div>` : ''}
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <button class="btn-secondary" style="padding:6px 12px;" onclick="shiftCalMonth(-1)">‹</button>
        <button style="font-size:17px;font-weight:700;" onclick="openCalJumpSheet()">${y} 年 ${m + 1} 月 ▾</button>
        <button class="btn-secondary" style="padding:6px 12px;" onclick="shiftCalMonth(1)">›</button>
      </div>
      <div class="cat-strip" style="padding:0 0 10px;">
        <span style="font-size:12.5px;color:var(--text-3);flex-shrink:0;">吉日：</span>
        ${['','搬家','入宅','开市','嫁娶','签约','出行'].map(f => `<button class="chip ${state.calYiFilter===f?'accent':''}" onclick="state.calYiFilter='${f}';renderCalendarView()">${f || '全部'}</button>`).join('')}
      </div>
      <div class="cal-grid">${['日','一','二','三','四','五','六'].map(w => `<div class="cal-wk">${w}</div>`).join('')}${cells}</div>
    </div>
    ${dayFlags.length ? `<div class="card" style="border-left:3px solid var(--accent);"><div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:4px;">🚩 本日应期复盘提醒</div><div style="font-size:13.5px;color:var(--text-2);">${dayFlags.map(t => '· ' + escapeHtml(t)).join('<br/>')}</div></div>` : ''}
    <div class="card">
      <div class="card-head">
        <div><div class="card-title">${state.calSelectedDate} · 农历${info.lunarStr||''} ${info.jieqi?'【'+info.jieqi+'】':''}</div><div style="font-size:12.5px;color:var(--text-2);margin-top:2px;">黄帝纪元 ${info.huangdiYear} 年 · 日空 <strong style="color:var(--accent);">${info.xunkong}</strong></div></div>
        <button class="pill-mini accent" onclick="instantCastFromCal()">即时起盘</button>
      </div>
      <div class="pillars-grid">
        ${[['年柱',info.year],['月柱',info.month],['日柱',info.day],['时柱',info.hour]].map(([l,p]) => `<div class="pillar-col"><div class="pillar-lbl">${l}</div><div class="pillar-gz wx-${p.swx}">${p.s}</div><div class="pillar-gz wx-${p.bwx}">${p.b}</div><div style="font-size:11px;color:var(--text-3);margin-top:3px;">藏 ${HIDDEN_STEMS[p.b]}</div></div>`).join('')}
      </div>
      <div style="margin-top:12px;padding:11px 13px;border-radius:12px;background:var(--bg);font-size:13.5px;line-height:1.7;">
        <div><strong style="color:var(--wx-wood);">宜：</strong>${info.yi.slice(0, 12).join(' · ') || '平稳'}</div>
        <div><strong style="color:var(--accent);">忌：</strong>${info.ji.slice(0, 10).join(' · ') || '无大忌'}</div>
        <div style="color:var(--text-2);"><strong>冲煞：</strong>${info.chong} ${info.sha ? '煞'+info.sha : ''}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:8px;">日家飞宫九星 & 十二时辰吉凶</div>
      <div class="nine-grid">${[-1,4,-3,-2,0,2,3,-4,1].map((off, idx) => `<div class="nine-cell"><strong>${['东南','正南','西南','正东','中宫','正西','东北','正北','西北'][idx]}</strong><br/>${starNames[((cStar+off-1+18)%9)]}</div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;">
        ${info.times.map(t => `<div class="nine-cell" style="padding:7px 4px;"><div style="font-weight:700;">${t.gz}</div><div style="font-size:11.5px;color:${t.luck==='吉'?'var(--wx-wood)':'var(--text-3)'};">${t.br}时 · ${t.luck}</div></div>`).join('')}
      </div>
    </div>
  `;
}
function shiftCalMonth(delta) { const dt = new Date(state.calYear, state.calMonth + delta, 1); state.calYear = dt.getFullYear(); state.calMonth = dt.getMonth(); renderCalendarView(); }
function selectCalDate(k) { state.calSelectedDate = k; renderCalendarView(); }
function calGoToday() { const n = new Date(); state.calYear = n.getFullYear(); state.calMonth = n.getMonth(); state.calSelectedDate = formatDateKey(n); renderCalendarView(); }
function openCalJumpSheet() { document.getElementById('calJumpYear').value = state.calYear; document.getElementById('calJumpMonth').value = state.calMonth; openSheet('sheet-cal-jump'); }
function applyCalJump() { state.calYear = Math.max(1900, Math.min(2100, parseInt(document.getElementById('calJumpYear').value) || state.calYear)); state.calMonth = parseInt(document.getElementById('calJumpMonth').value) || 0; state.calSelectedDate = formatDateKey(new Date(state.calYear, state.calMonth, 1)); closeSheet('sheet-cal-jump'); renderCalendarView(); }
function instantCastFromCal() { castState.lyDate = state.calSelectedDate + 'T12:00'; castState.lyDateManual = true; switchMainTab('divine'); switchCategory('六爻'); switchSubTab('cast'); showToast('已将 ' + state.calSelectedDate + ' 填入起卦时间'); }
