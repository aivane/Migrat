// Shared label/lookup constants for the Fundinfo feature (category labels, AMC/sector
// maps, benchmark metadata), used in every API mode. Split out from the former
// fundinfoData.js, which also held fabricated mock fund records (removed with mock mode).
function pairs(list) {
  return list.map(([name, percent]) => ({ name, percent }))
}

export const FUND_TYPES = {
  feeder: {
    key: 'feeder',
    label: 'Feeder Fund',
    emoji: '🌐',
    accent: '#2456d8',
    sub: 'สำรวจและเปรียบเทียบ Master Fund ก่อนค้นหากองทุนไทยที่เข้าถึงได้',
  },
  offshore: {
    key: 'offshore',
    label: 'Offshore Fund',
    emoji: '✈️',
    accent: '#0e7ac0',
    sub: 'กองทุนไทยที่ลงทุนตรงในหุ้นต่างประเทศ — เริ่มจาก Sector หรือประเทศ แล้วเจาะดูหุ้นและกองทุนที่ถือ',
  },
  thai: {
    key: 'thai',
    label: 'Thai Fund',
    emoji: '🇹🇭',
    accent: '#0e9f6e',
    sub: 'กองทุนหุ้นไทยที่ลงทุนในหุ้นรายตัว — เริ่มจากกลุ่มอุตสาหกรรม แล้วเจาะดูหุ้นและกองทุนที่ถือ',
  },
  mixed: {
    key: 'mixed',
    label: 'Mixed Fund',
    emoji: '⚖️',
    accent: '#7a5af5',
    sub: 'สำรวจโครงสร้างกองทุนที่ผสมหลายสินทรัพย์ไว้ในพอร์ตเดียว',
  },
}

// ==========================================================================
// Reference / taxonomy tables
// ==========================================================================

export const GROUP = {
  สหรัฐฯ: 'US Equity',
  ทั่วโลก: 'Global Equity',
  เกาหลีใต้: 'Asia Pacific Ex Japan',
  ยุโรป: 'Europe Equity',
  ทองคำโลก: 'Commodity - Gold',
  จีน: 'China Equity',
  'สหรัฐฯ/ยุโรป': 'Global Healthcare',
}

export const AMC = {
  'ไทยพาณิชย์ จำกัด (บลจ.)': 'SCB',
  'อีสท์สปริง (บลจ.)': 'ES',
  'กสิกรไทย (บลจ.)': 'KA',
  'abrdn (บลจ.)': 'ab',
  'บัวหลวง (บลจ.)': 'BBL',
  'บีแคป (บลจ.)': 'BCAP',
  'กรุงศรี (บลจ.)': 'KSAM',
  'วรรณ (บลจ.)': 'ONE',
  'เกียรตินาคินภัทร (บลจ.)': 'KKP',
}

export const WRAPPER_TYPES = ['ทั่วไป', 'SSF', 'RMF', 'ThaiESG', 'ThaiESGX', 'LTF']

export const CMIX = {
  หุ้นไทย: '#2456d8',
  หุ้นต่างประเทศ: '#0e7ac0',
  ตราสารหนี้: '#12b76a',
  ทองคำ: '#e0a411',
  'น้ำมัน/โภคภัณฑ์': '#64748b',
  เงินสด: '#c3cede',
}
export const ASSETS = ['หุ้นไทย', 'หุ้นต่างประเทศ', 'ตราสารหนี้', 'ทองคำ', 'น้ำมัน/โภคภัณฑ์', 'เงินสด']

export const SECTORS = {
  SCBNDQ: pairs([['Technology', 48], ['Consumer Disc.', 18], ['Communication', 16], ['Health Care', 6], ['Industrials', 5], ['อื่นๆ', 7]]),
  TNDQ: pairs([['Technology', 48], ['Consumer Disc.', 18], ['Communication', 16], ['Health Care', 6], ['Industrials', 5], ['อื่นๆ', 7]]),
  'K-CHANGE': pairs([['Technology', 30], ['Health Care', 22], ['Consumer Disc.', 18], ['Financials', 12], ['Industrials', 8], ['อื่นๆ', 10]]),
  SCBKEQTGE: pairs([['Technology', 42], ['Consumer Disc.', 14], ['Financials', 12], ['Industrials', 10], ['Communication', 8], ['อื่นๆ', 14]]),
  ABEG: pairs([['Financials', 26], ['Industrials', 20], ['Health Care', 16], ['Technology', 14], ['Consumer', 10], ['อื่นๆ', 14]]),
  SCBGOLDH: pairs([['ทองคำ (Commodity)', 100]]),
  KGHEALTH: pairs([['ยา (Pharma)', 34], ['เครื่องมือแพทย์', 27], ['ไบโอเทค', 21], ['ประกันสุขภาพ', 10], ['อื่นๆ', 8]]),
  SCBCHA: pairs([['การเงิน', 22], ['อุตสาหกรรม', 18], ['สินค้าอุปโภค', 16], ['เทคโนโลยี', 14], ['อื่นๆ', 30]]),
  KKPGNP: pairs([['Technology', 24], ['Health Care', 14], ['Financials', 13], ['Consumer Disc.', 12], ['อื่นๆ', 37]]),
  TUSFIN: pairs([['พันธบัตรรัฐบาล', 54], ['หุ้นกู้คุณภาพสูง', 30], ['หุ้นกู้ผลตอบแทนสูง', 12], ['ตลาดเกิดใหม่', 4]]),
  BEQUITY: pairs([['การเงิน', 24], ['พลังงาน', 17], ['ICT', 14], ['พาณิชย์', 12], ['อิเล็กทรอนิกส์', 11], ['อื่นๆ', 22]]),
  SCBSET50: pairs([['การเงิน', 22], ['พลังงาน', 20], ['ICT', 13], ['พาณิชย์', 11], ['อิเล็กทรอนิกส์', 9], ['อื่นๆ', 25]]),
  BDIVSET: pairs([['พลังงาน', 22], ['การเงิน', 20], ['ICT', 16], ['อสังหา', 12], ['พาณิชย์', 9], ['อื่นๆ', 21]]),
  ABSM: pairs([['พาณิชย์', 18], ['อุตสาหกรรม', 16], ['อาหาร', 15], ['สุขภาพ', 12], ['อสังหา', 11], ['อื่นๆ', 28]]),
  BMIXED75: pairs([['พลังงาน', 20], ['การเงิน', 18], ['อิเล็กทรอนิกส์', 16], ['ICT', 12], ['พาณิชย์', 10], ['อื่นๆ', 24]]),
  KFAMSALL: pairs([['Technology', 22], ['การเงิน', 16], ['พลังงาน', 12], ['สุขภาพ', 10], ['สินค้าอุปโภค', 10], ['อื่นๆ', 30]]),
  ONEMIX: pairs([['Technology', 26], ['พลังงาน', 16], ['การเงิน', 14], ['พาณิชย์', 10], ['อิเล็กทรอนิกส์', 8], ['อื่นๆ', 26]]),
  SCBCONSER: pairs([['การเงิน', 20], ['พลังงาน', 16], ['ICT', 12], ['พาณิชย์', 10], ['อิเล็กทรอนิกส์', 8], ['อื่นๆ', 34]]),
}

export const SCOPE_LABELS = {
  'Technology': 'เทคโนโลยี',
  'Health Care': 'สุขภาพ',
  'Consumer Disc.': 'สินค้าอุปโภคบริโภค',
  Consumer: 'สินค้าอุปโภคบริโภค',
  Financials: 'การเงิน',
  Industrials: 'อุตสาหกรรม',
  Communication: 'สื่อและแพลตฟอร์มดิจิทัล',
  ICT: 'เทคโนโลยีและสื่อสาร',
}
export function normalizeScopeLabel(label) {
  return SCOPE_LABELS[label] || label
}

// ticker/sector lookup for stock names appearing in fund holdings — real
// per-stock financials (return, drawdown, P/E, P/B, dividend yield) now come
// from the live /stocks/top record instead (see fundinfoApi.js's mapTopStock
// and useFundinfoRanking.js's buildApiStockRankEntities); no market-cap field
// exists on the API yet, so there's nothing to source a `cap` lookup from.
export const STOCK_META = {
  'Eli Lilly': { ticker: 'LLY', sector: 'สุขภาพ' },
  UnitedHealth: { ticker: 'UNH', sector: 'สุขภาพ' },
  'Novo Nordisk': { ticker: 'NVO', sector: 'สุขภาพ' },
  'Johnson & Johnson': { ticker: 'JNJ', sector: 'สุขภาพ' },
  AbbVie: { ticker: 'ABBV', sector: 'สุขภาพ' },
  'Kweichow Moutai': { ticker: '600519', sector: 'สินค้าอุปโภคบริโภค' },
  CATL: { ticker: '300750', sector: 'อุตสาหกรรม' },
  'Ping An': { ticker: '601318', sector: 'การเงิน' },
  'Midea Group': { ticker: '000333', sector: 'สินค้าอุปโภคบริโภค' },
  BYD: { ticker: '002594', sector: 'สินค้าอุปโภคบริโภค' },
  Microsoft: { ticker: 'MSFT', sector: 'เทคโนโลยี' },
  Meta: { ticker: 'META', sector: 'สื่อและแพลตฟอร์มดิจิทัล' },
  TSMC: { ticker: 'TSM', sector: 'เทคโนโลยี' },
  LVMH: { ticker: 'MC', sector: 'สินค้าอุปโภคบริโภค' },
  DELTA: { ticker: 'DELTA', sector: 'อิเล็กทรอนิกส์' },
  GULF: { ticker: 'GULF', sector: 'พลังงานและสาธารณูปโภค' },
  PTT: { ticker: 'PTT', sector: 'พลังงานและสาธารณูปโภค' },
  ADVANC: { ticker: 'ADVANC', sector: 'เทคโนโลยีและสื่อสาร' },
  KBANK: { ticker: 'KBANK', sector: 'การเงิน' },
  AOT: { ticker: 'AOT', sector: 'ขนส่งและท่องเที่ยว' },
  CPALL: { ticker: 'CPALL', sector: 'พาณิชย์' },
  KTB: { ticker: 'KTB', sector: 'การเงิน' },
  INTUCH: { ticker: 'INTUCH', sector: 'เทคโนโลยีและสื่อสาร' },
  TISCO: { ticker: 'TISCO', sector: 'การเงิน' },
  BJC: { ticker: 'BJC', sector: 'พาณิชย์' },
  COM7: { ticker: 'COM7', sector: 'พาณิชย์' },
  BCH: { ticker: 'BCH', sector: 'การแพทย์' },
  AMATA: { ticker: 'AMATA', sector: 'นิคมอุตสาหกรรม' },
  SPA: { ticker: 'SPA', sector: 'ขนส่งและท่องเที่ยว' },
}

export const THAI_INDUSTRY_GROUPS = [
  { id: 'AGRO', title: 'เกษตรและอุตสาหกรรมอาหาร', subtitle: 'AGRO', stocks: [] },
  { id: 'CONSUMP', title: 'สินค้าอุปโภคบริโภค', subtitle: 'CONSUMP', stocks: [] },
  { id: 'FINCIAL', title: 'ธุรกิจการเงิน', subtitle: 'FINCIAL', stocks: ['KBANK', 'KTB', 'TISCO'] },
  { id: 'INDUS', title: 'สินค้าอุตสาหกรรม', subtitle: 'INDUS', stocks: [] },
  { id: 'PROP', title: 'อสังหาริมทรัพย์และก่อสร้าง', subtitle: 'PROP', stocks: ['AMATA'] },
  { id: 'RESOURC', title: 'ทรัพยากร', subtitle: 'RESOURC', stocks: ['GULF', 'PTT'] },
  { id: 'SERVICE', title: 'บริการ', subtitle: 'SERVICE', stocks: ['AOT', 'CPALL', 'BJC', 'COM7', 'BCH', 'SPA'] },
  { id: 'TECH', title: 'เทคโนโลยี', subtitle: 'TECH', stocks: ['DELTA', 'ADVANC', 'INTUCH'] },
]

export const OFFSHORE_REGION_GROUPS = [
  { id: 'REG_GLOBAL', title: 'หุ้นโลก', subtitle: 'Global Equity', fundIds: ['KGHEALTH', 'KKPGNP'] },
  { id: 'REG_US', title: 'หุ้นสหรัฐฯ', subtitle: 'US Equity', fundIds: [] },
  { id: 'REG_CHINA', title: 'หุ้นจีน', subtitle: 'Chinese Equity', fundIds: ['SCBCHA'] },
  { id: 'REG_VIETNAM', title: 'หุ้นเวียดนาม', subtitle: 'Vietnam Equity', fundIds: [] },
  { id: 'REG_INDIA', title: 'หุ้นอินเดีย', subtitle: 'Indian Equity', fundIds: [] },
  { id: 'REG_JAPAN', title: 'หุ้นญี่ปุ่น', subtitle: 'Japanese Equity', fundIds: [] },
  { id: 'REG_EUROPE', title: 'หุ้นยุโรป', subtitle: 'European Equity', fundIds: [] },
  { id: 'REG_KOREA', title: 'หุ้นเกาหลี', subtitle: 'Korea Equity', fundIds: [] },
  { id: 'REG_EM', title: 'ตลาดเกิดใหม่', subtitle: 'Emerging Markets', fundIds: [] },
]

export const OFFSHORE_THEME_GROUPS = [
  { id: 'MEGA_TECH', title: 'เทคโนโลยีภาพรวม', subtitle: 'Technology / Tech', stocks: ['Microsoft', 'Meta', 'TSMC'] },
  { id: 'MEGA_AI', title: 'ปัญญาประดิษฐ์และหุ่นยนต์', subtitle: 'AI & Robotics', stocks: ['Microsoft', 'Meta'] },
  { id: 'MEGA_SEMI', title: 'เซมิคอนดักเตอร์', subtitle: 'Semiconductor', stocks: ['TSMC'] },
  { id: 'MEGA_HEALTH', title: 'นวัตกรรมสุขภาพ', subtitle: 'Healthcare & Biotech', stocks: ['Eli Lilly', 'UnitedHealth', 'Novo Nordisk', 'Johnson & Johnson', 'AbbVie'] },
  { id: 'MEGA_CLEANEV', title: 'พลังงานสะอาดและรถยนต์ไฟฟ้า', subtitle: 'Clean Energy & EV', stocks: ['CATL', 'BYD'] },
  { id: 'MEGA_LUXURY', title: 'สินค้าแบรนด์เนมและสินค้าฟุ่มเฟือย', subtitle: 'Luxury Brands', stocks: ['LVMH', 'Kweichow Moutai'] },
  { id: 'MEGA_CYBER', title: 'ความปลอดภัยทางไซเบอร์', subtitle: 'Cyber Security', stocks: [] },
  { id: 'MEGA_INFRA', title: 'โครงสร้างพื้นฐานทั่วโลก', subtitle: 'Global Infrastructure', stocks: [] },
  { id: 'MEGA_REIT', title: 'อสังหาริมทรัพย์ทั่วโลก', subtitle: 'Global REITs', stocks: [] },
]

// theme: groups a feeder fund's master name into a category for the Theme
// Pulse chart (useFundinfoThemeTrend.js). bench: the benchmark index name
// shown next to a fund's own performance (FundPerformancePanel.vue) — its
// return series is still a placeholder line (see performanceSeries() in
// useFundinfoThemeTrend.js), since no live field publishes benchmark returns.
// Both fields have no API source and are curated by hand.
// narr/pe/pb/flow/master{}/top[] used to live here as fabricated per-theme
// financials (analyst narrative, valuation, fund flow, master-fund detail,
// fake top-10 holdings) — removed 2026-09-10: /api/v1/insights/themes only
// ever returns theme_name/funds_count/total_aum_m_thb/avg_return_1m/
// avg_return_1y, so none of those fields had (or could have) a real source,
// and none of them were rendered anywhere in the app.
export const INSIGHT = {
  'Invesco NASDAQ-100 ETF': { theme: 'US Technology (NASDAQ-100)', bench: 'NASDAQ-100 Index' },
  'Baillie Gifford Positive Change': { theme: 'Global Sustainable Growth', bench: 'MSCI ACWI' },
  'iShares MSCI South Korea ETF': { theme: 'Korea Equity', bench: 'MSCI Korea Index' },
  'abrdn European Sustainable Equity': { theme: 'European Sustainability', bench: 'MSCI Europe Index' },
  'SPDR Gold Shares': { theme: 'Gold (สินทรัพย์ปลอดภัย)', bench: 'LBMA Gold Price' },
  สุขภาพ: { theme: 'Global Healthcare', bench: 'MSCI World Health Care' },
  จีน: { theme: 'China A-Shares', bench: 'CSI 300 Index' },
  หุ้นโลก: { theme: 'Global Equity', bench: 'MSCI ACWI' },
  ตราสารหนี้: { theme: 'Global Bond', bench: 'Bloomberg Global Aggregate' },
  'คัดเลือกเชิงรุก (Active)': { theme: 'Thai Active Equity', bench: 'SET Index' },
  'ดัชนี (Index)': { theme: 'SET50 Index', bench: 'SET50 Index' },
  ปันผลสูง: { theme: 'High Dividend (SETHD)', bench: 'SETHD Index' },
  'หุ้นเล็ก-กลาง': { theme: 'Thai Mid/Small Cap', bench: 'sSET Index' },
}
