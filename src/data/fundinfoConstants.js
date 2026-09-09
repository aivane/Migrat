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

export const STOCK_META = {
  'Eli Lilly': { ticker: 'LLY', sector: 'สุขภาพ', country: 'สหรัฐฯ', ret: 33.5, dd: -18.4, div: 0.7, pe: 37.8, pb: 20.4, cap: 'US$ 775B' },
  UnitedHealth: { ticker: 'UNH', sector: 'สุขภาพ', country: 'สหรัฐฯ', ret: -8.2, dd: -31.6, div: 1.6, pe: 17.2, pb: 5.1, cap: 'US$ 455B' },
  'Novo Nordisk': { ticker: 'NVO', sector: 'สุขภาพ', country: 'เดนมาร์ก', ret: -18.5, dd: -34.1, div: 1.8, pe: 22.6, pb: 14.2, cap: 'US$ 310B' },
  'Johnson & Johnson': { ticker: 'JNJ', sector: 'สุขภาพ', country: 'สหรัฐฯ', ret: 6.1, dd: -12.8, div: 3.1, pe: 15.4, pb: 5.3, cap: 'US$ 370B' },
  AbbVie: { ticker: 'ABBV', sector: 'สุขภาพ', country: 'สหรัฐฯ', ret: 14.7, dd: -14.2, div: 3.4, pe: 16.8, pb: 32.1, cap: 'US$ 305B' },
  'Kweichow Moutai': { ticker: '600519', sector: 'สินค้าอุปโภคบริโภค', country: 'จีน', ret: -6.2, dd: -24.8, div: 3.2, pe: 21.4, pb: 7.6, cap: 'US$ 255B' },
  CATL: { ticker: '300750', sector: 'อุตสาหกรรม', country: 'จีน', ret: 18.4, dd: -28.3, div: 0.9, pe: 19.8, pb: 4.9, cap: 'US$ 155B' },
  'Ping An': { ticker: '601318', sector: 'การเงิน', country: 'จีน', ret: 9.1, dd: -22.6, div: 5.1, pe: 8.2, pb: 0.9, cap: 'US$ 110B' },
  'Midea Group': { ticker: '000333', sector: 'สินค้าอุปโภคบริโภค', country: 'จีน', ret: 14.7, dd: -17.9, div: 4.2, pe: 13.6, pb: 3.1, cap: 'US$ 78B' },
  BYD: { ticker: '002594', sector: 'สินค้าอุปโภคบริโภค', country: 'จีน', ret: 22.5, dd: -26.7, div: 0.6, pe: 25.7, pb: 5.8, cap: 'US$ 125B' },
  Microsoft: { ticker: 'MSFT', sector: 'เทคโนโลยี', country: 'สหรัฐฯ', ret: 18.9, dd: -16.4, div: 0.7, pe: 31.5, pb: 10.8, cap: 'US$ 3.2T' },
  Meta: { ticker: 'META', sector: 'สื่อและแพลตฟอร์มดิจิทัล', country: 'สหรัฐฯ', ret: 35.6, dd: -19.7, div: 0.4, pe: 24.1, pb: 8.9, cap: 'US$ 1.5T' },
  TSMC: { ticker: 'TSM', sector: 'เทคโนโลยี', country: 'ไต้หวัน', ret: 31.5, dd: -22.1, div: 1.4, pe: 23.8, pb: 7.2, cap: 'US$ 980B' },
  LVMH: { ticker: 'MC', sector: 'สินค้าอุปโภคบริโภค', country: 'ฝรั่งเศส', ret: -4.8, dd: -27.5, div: 2.1, pe: 20.4, pb: 4.3, cap: '€ 305B' },
  DELTA: { ticker: 'DELTA', sector: 'อิเล็กทรอนิกส์', country: 'ไทย', ret: -12.0, dd: -31.4, div: 0.4, pe: 52.3, pb: 14.8, cap: '฿ 1.4T' },
  GULF: { ticker: 'GULF', sector: 'พลังงานและสาธารณูปโภค', country: 'ไทย', ret: 9.5, dd: -18.9, div: 1.8, pe: 29.6, pb: 5.4, cap: '฿ 540B' },
  PTT: { ticker: 'PTT', sector: 'พลังงานและสาธารณูปโภค', country: 'ไทย', ret: -3.1, dd: -16.2, div: 6.2, pe: 9.4, pb: 0.8, cap: '฿ 940B' },
  ADVANC: { ticker: 'ADVANC', sector: 'เทคโนโลยีและสื่อสาร', country: 'ไทย', ret: 14.2, dd: -11.8, div: 3.8, pe: 23.1, pb: 8.2, cap: '฿ 685B' },
  KBANK: { ticker: 'KBANK', sector: 'การเงิน', country: 'ไทย', ret: 11.6, dd: -15.4, div: 4.5, pe: 7.8, pb: 0.7, cap: '฿ 305B' },
  AOT: { ticker: 'AOT', sector: 'ขนส่งและท่องเที่ยว', country: 'ไทย', ret: -6.4, dd: -23.7, div: 1.2, pe: 36.8, pb: 6.1, cap: '฿ 880B' },
  CPALL: { ticker: 'CPALL', sector: 'พาณิชย์', country: 'ไทย', ret: 7.9, dd: -14.3, div: 2.4, pe: 24.6, pb: 4.8, cap: '฿ 575B' },
  KTB: { ticker: 'KTB', sector: 'การเงิน', country: 'ไทย', ret: 18.9, dd: -10.6, div: 5.3, pe: 7.2, pb: 0.8, cap: '฿ 255B' },
  INTUCH: { ticker: 'INTUCH', sector: 'เทคโนโลยีและสื่อสาร', country: 'ไทย', ret: 12.1, dd: -9.8, div: 4.7, pe: 20.1, pb: 6.7, cap: '฿ 245B' },
  TISCO: { ticker: 'TISCO', sector: 'การเงิน', country: 'ไทย', ret: 6.5, dd: -8.4, div: 7.2, pe: 10.6, pb: 1.9, cap: '฿ 78B' },
  BJC: { ticker: 'BJC', sector: 'พาณิชย์', country: 'ไทย', ret: 3.1, dd: -19.8, div: 3.0, pe: 22.4, pb: 1.1, cap: '฿ 92B' },
  COM7: { ticker: 'COM7', sector: 'พาณิชย์', country: 'ไทย', ret: -9.4, dd: -28.2, div: 3.6, pe: 18.2, pb: 6.4, cap: '฿ 58B' },
  BCH: { ticker: 'BCH', sector: 'การแพทย์', country: 'ไทย', ret: 5.6, dd: -17.4, div: 2.8, pe: 25.1, pb: 3.9, cap: '฿ 41B' },
  AMATA: { ticker: 'AMATA', sector: 'นิคมอุตสาหกรรม', country: 'ไทย', ret: 12.7, dd: -15.6, div: 2.5, pe: 13.8, pb: 1.4, cap: '฿ 27B' },
  SPA: { ticker: 'SPA', sector: 'ขนส่งและท่องเที่ยว', country: 'ไทย', ret: -4.1, dd: -25.3, div: 1.0, pe: 29.4, pb: 5.7, cap: '฿ 8B' },
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

export const INSIGHT = {
  'Invesco NASDAQ-100 ETF': {
    theme: 'US Technology (NASDAQ-100)',
    narr: 'หุ้นเทคโนโลยีสหรัฐฯ ขนาดใหญ่ 100 บริษัทในตลาด NASDAQ ผู้นำเทรนด์ AI, คลาวด์ และเซมิคอนดักเตอร์ที่ขับเคลื่อนเศรษฐกิจดิจิทัลของโลก',
    pe: 31.2, pb: 7.8, flow: 3820, bench: 'NASDAQ-100 Index',
    master: { name: 'Invesco NASDAQ-100 ETF (QQQM)', amc: 'Invesco', aum: 'US$ 42.6B', incep: 'ต.ค. 2020', te: 0.18, pm: 'ยังคงน้ำหนักกลุ่ม AI/เซมิคอนดักเตอร์ที่ได้อานิสงส์การลงทุน data center ทั่วโลก แม้ valuation ตึงตัว แต่การเติบโตของกำไรยังหนุนราคาในระยะกลาง' },
    top: [['NVIDIA', 'NVDA', 9.1, 62.4], ['Apple', 'AAPL', 8.8, 12.1], ['Microsoft', 'MSFT', 8.0, 18.9], ['Broadcom', 'AVGO', 4.8, 41.2], ['Amazon', 'AMZN', 4.6, 22.7], ['Meta', 'META', 4.1, 35.6], ['Alphabet', 'GOOGL', 3.4, 15.3], ['Tesla', 'TSLA', 2.6, -8.4], ['Costco', 'COST', 2.3, 19.0], ['Netflix', 'NFLX', 2.0, 28.5]],
  },
  'Baillie Gifford Positive Change': {
    theme: 'Global Sustainable Growth',
    narr: 'กองหุ้นเติบโตทั่วโลกที่คัดเฉพาะบริษัทซึ่งสร้างผลกระทบเชิงบวกต่อสังคมและสิ่งแวดล้อม เน้นนวัตกรรมและการเติบโตระยะยาว',
    pe: 28.5, pb: 4.9, flow: -540, bench: 'MSCI ACWI',
    master: { name: 'Baillie Gifford Positive Change', amc: 'Baillie Gifford', aum: '£ 2.1B', incep: 'ม.ค. 2017', te: 6.2, pm: 'พอร์ตกระจุกตัวในหุ้นเติบโตสูง จึงผันผวนกว่าตลาดในช่วงดอกเบี้ยสูง แต่เรายังเชื่อมั่นในธีมการเปลี่ยนผ่านพลังงานและเฮลท์แคร์ระยะยาว' },
    top: [['NVIDIA', 'NVDA', 5.4, 62.4], ['ASML', 'ASML', 4.9, 9.8], ['MercadoLibre', 'MELI', 4.2, 24.1], ['TSMC', 'TSM', 3.8, 31.5], ['Moderna', 'MRNA', 3.1, -22.0], ['Tesla', 'TSLA', 2.9, -8.4], ['Ørsted', 'ORST', 2.4, -14.2], ['Shopify', 'SHOP', 2.2, 17.6], ['Dexcom', 'DXCM', 2.0, -5.1], ['Novonesis', 'NVZ', 1.8, 6.3]],
  },
  'iShares MSCI South Korea ETF': {
    theme: 'Korea Equity',
    narr: 'หุ้นเกาหลีใต้ ศูนย์กลางเซมิคอนดักเตอร์และเทคโนโลยีของเอเชีย โดดเด่นด้วย Samsung และ SK Hynix ผู้ผลิตชิปหน่วยความจำระดับโลก',
    pe: 11.4, pb: 1.1, flow: 1240, bench: 'MSCI Korea Index',
    master: { name: 'iShares MSCI South Korea ETF (EWY)', amc: 'BlackRock', aum: 'US$ 3.9B', incep: 'พ.ค. 2000', te: 0.34, pm: 'วัฏจักรหน่วยความจำ (memory) ฟื้นตัวหนุนกำไร Samsung/SK Hynix จากดีมานด์ HBM สำหรับงาน AI' },
    top: [['Samsung Elec.', '005930', 24.9, 18.2], ['SK Hynix', '000660', 11.2, 44.6], ['Hyundai Motor', '005380', 4.1, 7.9], ['KB Financial', '105560', 3.4, 21.3], ['SK Square', '402340', 2.8, 33.1], ['Samsung SDI', '006400', 2.4, -12.5], ['NAVER', '035420', 2.2, -6.8], ['Celltrion', '068270', 2.0, 4.1], ['Kia', '000270', 1.9, 9.5], ['POSCO', '005490', 1.7, -3.2]],
  },
  'abrdn European Sustainable Equity': {
    theme: 'European Sustainability',
    narr: 'หุ้นยุโรปคุณภาพสูงที่ผ่านเกณฑ์ความยั่งยืน เน้นบริษัทที่มีความได้เปรียบเชิงแข่งขันและงบดุลแข็งแรง โดยมี valuation อยู่ในระดับต่ำกว่าหุ้นสหรัฐฯ',
    pe: 16.8, pb: 2.3, flow: 180, bench: 'MSCI Europe Index',
    master: { name: 'abrdn European Sustainable Equity', amc: 'abrdn', aum: '€ 1.4B', incep: 'มี.ค. 2019', te: 3.1, pm: 'ยุโรปมี valuation อยู่ในระดับต่ำกว่าสหรัฐฯ และมีแรงหนุนจากการฟื้นตัวของภาคการเงิน พอร์ตเน้นหุ้นคุณภาพที่จ่ายกระแสเงินสดสม่ำเสมอ' },
    top: [['ASML', 'ASML', 6.8, 9.8], ['Finecobank', 'FBK', 5.2, 14.1], ['Prudential', 'PRU', 3.9, -2.3], ['Hiscox', 'HSX', 3.8, 11.7], ['LSE Group', 'LSEG', 3.6, 8.2], ['Novo Nordisk', 'NOVO', 3.4, -18.5], ['SAP', 'SAP', 3.1, 27.4], ['Schneider', 'SU', 2.8, 15.0], ['Nestlé', 'NESN', 2.5, -4.6], ['ASM Intl', 'ASM', 2.3, 19.2]],
  },
  'SPDR Gold Shares': {
    theme: 'Gold (สินทรัพย์ปลอดภัย)',
    narr: 'ทองคำแท่ง สินทรัพย์ปลอดภัยที่ป้องกันความเสี่ยงเงินเฟ้อและความไม่แน่นอนทางภูมิรัฐศาสตร์ ได้แรงหนุนจากการซื้อของธนาคารกลางทั่วโลก',
    pe: null, pb: null, flow: 5210, bench: 'LBMA Gold Price',
    master: { name: 'SPDR Gold Shares (GLD)', amc: 'State Street', aum: 'US$ 78.4B', incep: 'พ.ย. 2004', te: 0.09, pm: 'ทองคำทำจุดสูงสุดใหม่จากการอ่อนค่าของดอลลาร์และความต้องการสินทรัพย์ปลอดภัย ธนาคารกลางยังเป็นผู้ซื้อสุทธิต่อเนื่อง' },
    top: [['Physical Gold Bullion', 'GOLD', 100.0, 21.0]],
  },
  สุขภาพ: {
    theme: 'Global Healthcare',
    narr: 'เมกะเทรนด์การดูแลสุขภาพระยะยาวจากสังคมสูงวัยและนวัตกรรมยา เช่น ยาลดน้ำหนัก (GLP-1) และเทคโนโลยีชีวภาพ',
    pe: 22.4, pb: 4.1, flow: 430, bench: 'MSCI World Health Care',
    master: { name: 'MSCI World Health Care Index', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 1.2, pm: 'ธีมเฮลท์แคร์ได้แรงหนุนจากยา GLP-1 และดีมานด์ยาในตลาดเกิดใหม่ แม้เผชิญแรงกดดันด้านราคายาในสหรัฐฯ' },
    top: [['Eli Lilly', 'LLY', 6.2, 33.5], ['UnitedHealth', 'UNH', 5.1, -8.2], ['Novo Nordisk', 'NOVO', 4.7, -18.5], ['J&J', 'JNJ', 4.0, 6.1], ['AbbVie', 'ABBV', 3.6, 14.7], ['Merck', 'MRK', 3.2, -5.4], ['Roche', 'ROG', 2.9, 11.2], ['AstraZeneca', 'AZN', 2.7, 9.8], ['Thermo Fisher', 'TMO', 2.4, -3.1], ['Abbott', 'ABT', 2.2, 8.5]],
  },
  จีน: {
    theme: 'China A-Shares',
    narr: 'หุ้นจีนแผ่นดินใหญ่ (A-Shares) เข้าถึงการบริโภคในประเทศและผู้นำ EV/แบตเตอรี่ ราคาถูกเชิง valuation หลังปรับฐานยาว',
    pe: 12.1, pb: 1.4, flow: 760, bench: 'CSI 300 Index',
    master: { name: 'CSI 300 Index (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 1.6, pm: 'มาตรการกระตุ้นเศรษฐกิจของจีนเริ่มเห็นผล ภาคบริโภคและ EV ฟื้นตัว แต่ความเสี่ยงภูมิรัฐศาสตร์ยังกดดัน sentiment' },
    top: [['Kweichow Moutai', '600519', 5.8, -6.2], ['CATL', '300750', 4.9, 18.4], ['Ping An', '601318', 3.6, 9.1], ['Midea', '000333', 3.1, 14.7], ['BYD', '002594', 2.9, 22.5], ['CM Bank', '600036', 2.6, 11.2], ['Wuliangye', '000858', 2.2, -8.5], ['LONGi', '601012', 1.9, -15.3], ['Zijin Mining', '601899', 1.8, 26.1], ['East Money', '300059', 1.6, 7.4]],
  },
  หุ้นโลก: {
    theme: 'Global Equity',
    narr: 'กระจายลงทุนหุ้นทั่วโลก ตัวเลือกครบจบสำหรับพอร์ตหลัก ลดความเสี่ยงเฉพาะประเทศและกระจายไปยังหลายอุตสาหกรรม',
    pe: 19.5, pb: 3.0, flow: 520, bench: 'MSCI ACWI',
    master: { name: 'MSCI ACWI (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 2.4, pm: 'ตลาดหุ้นโลกยังได้แรงหนุนจากหุ้นเทคสหรัฐฯ เราคงน้ำหนักหุ้นคุณภาพและกระจายไปยังตลาดพัฒนาแล้วนอกสหรัฐฯ เพื่อลดการกระจุกตัว' },
    top: [['Microsoft', 'MSFT', 3.4, 18.9], ['Apple', 'AAPL', 3.0, 12.1], ['NVIDIA', 'NVDA', 2.9, 62.4], ['Amazon', 'AMZN', 2.2, 22.7], ['Meta', 'META', 1.7, 35.6], ['Alphabet', 'GOOGL', 1.5, 15.3], ['Novo Nordisk', 'NOVO', 1.2, -18.5], ['TSMC', 'TSM', 1.1, 31.5], ['Broadcom', 'AVGO', 1.0, 41.2], ['JPMorgan', 'JPM', 0.9, 13.8]],
  },
  ตราสารหนี้: {
    theme: 'Global Bond',
    narr: 'ตราสารหนี้ทั่วโลกคุณภาพสูง สร้างรายได้สม่ำเสมอและลดความผันผวนพอร์ต ได้ประโยชน์เมื่อดอกเบี้ยอยู่ในช่วงขาลง',
    pe: null, pb: null, flow: 260, bench: 'Bloomberg Global Aggregate',
    master: { name: 'Bloomberg Global Aggregate (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 0.9, pm: 'วัฏจักรดอกเบี้ยขาลงหนุนราคาตราสารหนี้ เราเพิ่ม duration ในพันธบัตรคุณภาพสูงเพื่อรับ capital gain' },
    top: [['US Treasury 10Y', 'UST10', 6.0, 3.2], ['German Bund', 'BUND', 4.2, 2.1], ['US Treasury 5Y', 'UST5', 3.8, 2.8], ['UK Gilt 10Y', 'GILT', 2.6, 1.4], ['JGB 10Y', 'JGB', 2.1, -0.6], ['US TIPS', 'TIPS', 1.9, 3.0], ['France OAT', 'OAT', 1.6, 1.1], ['Canada 10Y', 'CAN', 1.4, 2.2], ['Australia 10Y', 'ACGB', 1.2, 1.8], ['Corp IG', 'IG', 1.0, 4.1]],
  },
  'คัดเลือกเชิงรุก (Active)': {
    theme: 'Thai Active Equity',
    narr: 'กองหุ้นไทยบริหารเชิงรุก ผู้จัดการคัดหุ้นพื้นฐานดีเพื่อมุ่งเอาชนะดัชนี SET เหมาะกับผู้เชื่อในการคัดเลือกหุ้นรายตัว',
    pe: 15.8, pb: 1.5, flow: -180, bench: 'SET Index',
    master: { name: 'SET Total Return Index (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 4.5, pm: 'ตลาดหุ้นไทยฟื้นตัวช้าตามเศรษฐกิจในประเทศ เราเน้นหุ้นที่มีกำไรเติบโตชัดเจนและได้ประโยชน์จากการท่องเที่ยว' },
    top: [['DELTA', 'DELTA', 8.4, -12.0], ['GULF', 'GULF', 6.1, 9.5], ['PTT', 'PTT', 5.2, -3.1], ['ADVANC', 'ADVANC', 4.8, 14.2], ['KBANK', 'KBANK', 4.2, 11.6], ['CPALL', 'CPALL', 3.8, 7.9], ['AOT', 'AOT', 3.4, -6.4], ['SCB', 'SCB', 3.0, 10.1], ['BDMS', 'BDMS', 2.7, 4.3], ['GPSC', 'GPSC', 2.2, -8.7]],
  },
  'ดัชนี (Index)': {
    theme: 'SET50 Index',
    narr: 'ลงทุนล้อดัชนี SET50 หุ้นใหญ่ 50 ตัวของไทย ค่าธรรมเนียมต่ำ โปร่งใส เหมาะเป็นพอร์ตแกน (core) ของหุ้นไทย',
    pe: 16.2, pb: 1.6, flow: 340, bench: 'SET50 Index',
    master: { name: 'SET50 Total Return Index (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 0.4, pm: 'กองดัชนีเน้นล้อตามตลาด เหมาะเป็นพอร์ตแกนต้นทุนต่ำ ความเบี่ยงเบนจากดัชนี (tracking error) อยู่ในระดับต่ำมาก' },
    top: [['DELTA', 'DELTA', 10.1, -12.0], ['AOT', 'AOT', 6.4, -6.4], ['PTT', 'PTT', 5.9, -3.1], ['ADVANC', 'ADVANC', 5.2, 14.2], ['CPALL', 'CPALL', 4.7, 7.9], ['GULF', 'GULF', 4.3, 9.5], ['KBANK', 'KBANK', 4.0, 11.6], ['BDMS', 'BDMS', 3.6, 4.3], ['PTTEP', 'PTTEP', 3.2, -5.5], ['SCB', 'SCB', 3.0, 10.1]],
  },
  ปันผลสูง: {
    theme: 'High Dividend (SETHD)',
    narr: 'หุ้นไทยที่จ่ายปันผลสูงสม่ำเสมอ สร้างกระแสเงินสดระหว่างถือครอง เหมาะกับผู้ต้องการรายได้ประจำและความผันผวนต่ำ',
    pe: 12.9, pb: 1.2, flow: 240, bench: 'SETHD Index',
    master: { name: 'SET High Dividend 30 (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 2.0, pm: 'หุ้นปันผลสูงมักเป็นกลุ่มพลังงานและธนาคารที่กระแสเงินสดแข็งแรง ให้ผลตอบแทนรวมสม่ำเสมอในภาวะตลาดผันผวน' },
    top: [['PTT', 'PTT', 6.8, -3.1], ['ADVANC', 'ADVANC', 6.0, 14.2], ['KTB', 'KTB', 5.1, 18.9], ['INTUCH', 'INTUCH', 4.4, 12.1], ['TISCO', 'TISCO', 3.9, 6.5], ['SCB', 'SCB', 3.6, 10.1], ['TTB', 'TTB', 3.2, 8.0], ['BBL', 'BBL', 3.0, 5.4], ['RATCH', 'RATCH', 2.6, -4.2], ['LH', 'LH', 2.3, -7.1]],
  },
  'หุ้นเล็ก-กลาง': {
    theme: 'Thai Mid/Small Cap',
    narr: 'หุ้นขนาดกลาง-เล็กของไทยที่กำลังเติบโต ให้โอกาสสร้างผลตอบแทนสูง แลกกับความผันผวนที่มากขึ้นกว่าหุ้นขนาดใหญ่',
    pe: 18.4, pb: 1.8, flow: 120, bench: 'sSET Index',
    master: { name: 'sSET Index (อ้างอิง)', amc: 'ดัชนีอ้างอิง', aum: '—', incep: '—', te: 5.2, pm: 'หุ้นเล็ก-กลางให้ผลตอบแทนกระจายตัวสูง การคัดเลือกรายตัวสำคัญมาก เราเน้นบริษัทที่กำไรเติบโตและมีสภาพคล่องเพียงพอ' },
    top: [['BJC', 'BJC', 4.2, 3.1], ['COM7', 'COM7', 3.8, -9.4], ['BCH', 'BCH', 3.3, 5.6], ['AMATA', 'AMATA', 3.0, 12.7], ['SPA', 'SPA', 2.7, -4.1], ['SAPPE', 'SAPPE', 2.5, 18.2], ['TIDLOR', 'TIDLOR', 2.3, 7.9], ['ORI', 'ORI', 2.0, -14.5], ['Sabuy', 'SABUY', 1.8, 2.2], ['MEGA', 'MEGA', 1.6, 9.0]],
  },
}
