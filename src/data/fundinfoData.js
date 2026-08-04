// Mock data for the Fundinfo category pages (Feeder / Offshore / Thai / Mixed).
// Adapted from the "Fundinfo v3.2.1 — Master Fund Comparison Workspace" HTML prototype.
// This is sample data only, not investment advice — it exists so the 4 routes render
// something real while the actual API integration/design is finalized.

function pairs(list) {
  return list.map(([name, percent]) => ({ name, percent }))
}

export const FUND_TYPES = {
  feeder: {
    key: 'feeder',
    label: 'Feeder Fund',
    emoji: '🌐',
    accent: '#2456d8',
    sub: 'กองทุนไทยที่ลงทุนผ่าน Master Fund ต่างประเทศ — เปรียบเทียบก่อนเลือกกองทุนที่เข้าถึงได้',
  },
  offshore: {
    key: 'offshore',
    label: 'Offshore Fund',
    emoji: '✈️',
    accent: '#0e7ac0',
    sub: 'กองทุนไทยที่ลงทุนตรงในหุ้น/ตราสารต่างประเทศ',
  },
  thai: {
    key: 'thai',
    label: 'Thai Fund',
    emoji: '🇹🇭',
    accent: '#0e9f6e',
    sub: 'กองทุนหุ้นไทยที่ลงทุนในหุ้นรายตัวในตลาดหลักทรัพย์แห่งประเทศไทย',
  },
  mixed: {
    key: 'mixed',
    label: 'Mixed Fund',
    emoji: '⚖️',
    accent: '#7a5af5',
    sub: 'กองทุนผสมหลายสินทรัพย์ไว้ในพอร์ตเดียว (หุ้น/ตราสารหนี้/ทองคำ/เงินสด)',
  },
}

export const FUNDS = [
  // ---------- Feeder Fund ----------
  {
    id: 'SCBNDQ', type: 'feeder',
    name: 'ไทยพาณิชย์ หุ้นสหรัฐเทคโนโลยี (NASDAQ100)', amc: 'ไทยพาณิชย์ จำกัด (บลจ.)',
    risk: 6, fee: 1.28, div: 0.0, master: 'Invesco NASDAQ-100 ETF', country: 'สหรัฐฯ',
    asset: pairs([['หน่วยลงทุน (Master Fund)', 99], ['เงินฝาก/อื่นๆ', 1]]),
    top5: pairs([['NVIDIA', 9.1], ['Apple', 8.8], ['Microsoft', 8.0], ['Broadcom', 4.8], ['Amazon', 4.6]]),
    themes: ['สหรัฐฯ', 'เทคโนโลยี', 'AI'], netbuy: 1240, perf: 24.1, pop: 48200,
  },
  {
    id: 'TNDQ', type: 'feeder',
    name: 'ธนชาต หุ้นสหรัฐ NASDAQ100', amc: 'อีสท์สปริง (บลจ.)',
    risk: 6, fee: 0.62, div: 0.0, master: 'Invesco NASDAQ-100 ETF', country: 'สหรัฐฯ',
    asset: pairs([['หน่วยลงทุน (Master Fund)', 99], ['เงินฝาก/อื่นๆ', 1]]),
    top5: pairs([['NVIDIA', 9.1], ['Apple', 8.8], ['Microsoft', 8.0], ['Broadcom', 4.8], ['Amazon', 4.6]]),
    themes: ['สหรัฐฯ', 'เทคโนโลยี', 'AI'], netbuy: 1980, perf: 24.3, pop: 33100,
  },
  {
    id: 'K-CHANGE', type: 'feeder',
    name: 'กสิกร หุ้นโลกเปลี่ยนโลก (Positive Change)', amc: 'กสิกรไทย (บลจ.)',
    risk: 6, fee: 1.92, div: 0.0, master: 'Baillie Gifford Positive Change', country: 'ทั่วโลก',
    asset: pairs([['หน่วยลงทุน (Master Fund)', 97.4], ['เงินฝาก/อื่นๆ', 2.6]]),
    top5: pairs([['NVIDIA', 5.4], ['ASML', 4.9], ['MercadoLibre', 4.2], ['TSMC', 3.8], ['Moderna', 3.1]]),
    themes: ['ทั่วโลก', 'ยั่งยืน (ESG)', 'นวัตกรรม'], netbuy: -220, perf: 5.1, pop: 15400,
  },
  {
    id: 'SCBKEQTGE', type: 'feeder',
    name: 'ไทยพาณิชย์ หุ้นเกาหลี ชนิดช่องทางอิเล็กทรอนิกส์', amc: 'ไทยพาณิชย์ จำกัด (บลจ.)',
    risk: 6, fee: 1.61, div: 0.0, master: 'iShares MSCI South Korea ETF', country: 'เกาหลีใต้',
    asset: pairs([['หน่วยลงทุน (Master Fund)', 94.8], ['เงินฝาก', 3.1], ['ตราสารหนี้', 1.2], ['อื่นๆ', 0.9]]),
    top5: pairs([['Samsung Electronics', 24.9], ['SK Hynix', 11.2], ['Hyundai Motor', 4.1], ['KB Financial', 3.4], ['SK Square', 2.8]]),
    themes: ['เกาหลีใต้', 'เซมิคอนดักเตอร์', 'เทคโนโลยี'], netbuy: 410, perf: 11.0, pop: 12200,
  },
  {
    id: 'ABEG', type: 'feeder',
    name: 'abrdn หุ้นยุโรปยั่งยืน', amc: 'abrdn (บลจ.)',
    risk: 6, fee: 2.05, div: 0.0, master: 'abrdn European Sustainable Equity', country: 'ยุโรป',
    asset: pairs([['หน่วยลงทุน (Master Fund)', 98.8], ['เงินฝาก/อื่นๆ', 1.2]]),
    top5: pairs([['ASML', 6.8], ['Finecobank', 5.2], ['Prudential', 3.9], ['Hiscox', 3.8], ['LSE Group', 3.6]]),
    themes: ['ยุโรป', 'ESG', 'การเงิน'], netbuy: 90, perf: 6.8, pop: 6800,
  },
  {
    id: 'SCBGOLDH', type: 'feeder',
    name: 'ไทยพาณิชย์ ทองคำ (ป้องกันค่าเงิน)', amc: 'ไทยพาณิชย์ จำกัด (บลจ.)',
    risk: 8, fee: 0.97, div: 0.0, master: 'SPDR Gold Shares', country: 'ทองคำโลก',
    asset: pairs([['หน่วยลงทุน (Master Fund)', 99.5], ['เงินฝาก/อื่นๆ', 0.5]]),
    top5: pairs([['Physical Gold', 99.5]]),
    themes: ['ทองคำ', 'สินทรัพย์ปลอดภัย'], netbuy: 1620, perf: 21.0, pop: 39800,
  },

  // ---------- Offshore Fund ----------
  {
    id: 'KGHEALTH', type: 'offshore',
    name: 'กสิกร สุขภาพโลก (Global Healthcare)', amc: 'กสิกรไทย (บลจ.)',
    risk: 6, fee: 1.95, div: 0.5, country: 'สหรัฐฯ/ยุโรป',
    asset: pairs([['หุ้นต่างประเทศ', 94], ['เงินฝาก/อื่นๆ', 6]]),
    top5: pairs([['Eli Lilly', 6.2], ['UnitedHealth', 5.1], ['Novo Nordisk', 4.7], ['Johnson & Johnson', 4.0], ['AbbVie', 3.6]]),
    themes: ['สุขภาพ', 'เมกะเทรนด์', 'สังคมสูงวัย'], netbuy: 430, perf: 9.8, pop: 12800,
  },
  {
    id: 'SCBCHA', type: 'offshore',
    name: 'ไทยพาณิชย์ หุ้นจีน A-Shares', amc: 'ไทยพาณิชย์ จำกัด (บลจ.)',
    risk: 6, fee: 1.84, div: 0.0, country: 'จีน',
    asset: pairs([['หุ้นต่างประเทศ', 96], ['เงินฝาก/อื่นๆ', 4]]),
    top5: pairs([['Kweichow Moutai', 5.8], ['CATL', 4.9], ['Ping An', 3.6], ['Midea Group', 3.1], ['BYD', 2.9]]),
    themes: ['จีน', 'ผู้บริโภคจีน', 'EV'], netbuy: 760, perf: 3.2, pop: 28400,
  },
  {
    id: 'KKPGNP', type: 'offshore',
    name: 'เกียรตินาคินภัทร หุ้นโลก (Global Equity)', amc: 'เกียรตินาคินภัทร (บลจ.)',
    risk: 6, fee: 2.01, div: 0.3, country: 'ทั่วโลก',
    asset: pairs([['หุ้น/หน่วยลงทุนต่างประเทศ', 95], ['เงินฝาก/อื่นๆ', 5]]),
    top5: pairs([['Microsoft', 3.4], ['Novo Nordisk', 2.8], ['Meta', 2.5], ['TSMC', 2.3], ['LVMH', 2.0]]),
    themes: ['หุ้นโลก', 'เติบโต'], netbuy: 520, perf: 13.2, pop: 14200,
  },
  {
    id: 'TUSFIN', type: 'offshore',
    name: 'ธนชาต ตราสารหนี้โลก (Global Bond)', amc: 'อีสท์สปริง (บลจ.)',
    risk: 4, fee: 1.05, div: 1.8, country: 'ทั่วโลก',
    asset: pairs([['ตราสารหนี้ต่างประเทศ', 92], ['เงินฝาก/อื่นๆ', 8]]),
    top5: pairs([['US Treasury 10Y', 6.0], ['German Bund', 4.2], ['US Treasury 5Y', 3.8], ['UK Gilt', 2.6], ['JGB 10Y', 2.1]]),
    themes: ['ตราสารหนี้', 'รายได้สม่ำเสมอ'], netbuy: 260, perf: 4.0, pop: 7400,
  },

  // ---------- Thai Fund ----------
  {
    id: 'BEQUITY', type: 'thai',
    name: 'บัวหลวงหุ้นระยะยาว', amc: 'บัวหลวง (บลจ.)',
    risk: 6, fee: 1.61, div: 1.2, active: 62,
    asset: pairs([['หุ้นสามัญไทย', 96], ['เงินฝาก/อื่นๆ', 4]]),
    top5: pairs([['DELTA', 8.4], ['GULF', 6.1], ['PTT', 5.2], ['ADVANC', 4.8], ['KBANK', 4.2]]),
    themes: ['หุ้นไทย', 'คัดเลือกเชิงรุก (Active)'], netbuy: -180, perf: 2.4, pop: 18600,
  },
  {
    id: 'SCBSET50', type: 'thai',
    name: 'ไทยพาณิชย์ ดัชนี SET50', amc: 'ไทยพาณิชย์ จำกัด (บลจ.)',
    risk: 6, fee: 0.62, div: 2.1, active: 4,
    asset: pairs([['หุ้นสามัญไทย', 99], ['เงินฝาก/อื่นๆ', 1]]),
    top5: pairs([['DELTA', 10.1], ['AOT', 6.4], ['PTT', 5.9], ['ADVANC', 5.2], ['CPALL', 4.7]]),
    themes: ['หุ้นไทย', 'ดัชนี (Index)', 'ค่าธรรมเนียมต่ำ'], netbuy: 340, perf: 0.6, pop: 16100,
  },
  {
    id: 'BDIVSET', type: 'thai',
    name: 'บีแคป หุ้นไทยปันผล', amc: 'บีแคป (บลจ.)',
    risk: 6, fee: 1.15, div: 4.3, active: 48,
    asset: pairs([['หุ้นสามัญไทย', 97], ['เงินฝาก/อื่นๆ', 3]]),
    top5: pairs([['PTT', 6.8], ['ADVANC', 6.0], ['KTB', 5.1], ['INTUCH', 4.4], ['TISCO', 3.9]]),
    themes: ['หุ้นไทย', 'ปันผลสูง', 'รายได้สม่ำเสมอ'], netbuy: 240, perf: 4.9, pop: 11900,
  },
  {
    id: 'ABSM', type: 'thai',
    name: 'abrdn หุ้นไทยเล็ก-กลาง', amc: 'abrdn (บลจ.)',
    risk: 6, fee: 1.88, div: 0.8, active: 78,
    asset: pairs([['หุ้นสามัญไทย', 94], ['เงินฝาก/อื่นๆ', 6]]),
    top5: pairs([['BJC', 4.2], ['COM7', 3.8], ['BCH', 3.3], ['AMATA', 3.0], ['SPA', 2.7]]),
    themes: ['หุ้นไทย', 'หุ้นเล็ก-กลาง', 'เชิงรุก'], netbuy: 120, perf: 6.1, pop: 8900,
  },

  // ---------- Mixed Fund ----------
  {
    id: 'BMIXED75', type: 'mixed',
    name: 'บัวหลวงผสม 75/25', amc: 'บัวหลวง (บลจ.)',
    risk: 5, fee: 1.78, div: 0.9,
    mix: pairs([['หุ้นไทย', 52], ['หุ้นต่างประเทศ', 21], ['ตราสารหนี้', 22], ['เงินสด', 5]]),
    asset: pairs([['หุ้นสามัญ', 73], ['พันธบัตร/หุ้นกู้', 22], ['เงินฝาก/อื่นๆ', 5]]),
    top5: pairs([['DELTA', 10.1], ['พันธบัตร ธปท.', 6.3], ['GULF', 5.4], ['พันธบัตรรัฐบาล', 5.1], ['PTT', 5.0]]),
    themes: ['ผสม', 'เชิงรุก'], netbuy: 300, perf: 18.0, pop: 9800,
  },
  {
    id: 'KFAMSALL', type: 'mixed',
    name: 'กรุงศรี ผสมหลากสินทรัพย์', amc: 'กรุงศรี (บลจ.)',
    risk: 5, fee: 1.45, div: 1.1,
    mix: pairs([['หุ้นไทย', 20], ['หุ้นต่างประเทศ', 30], ['ตราสารหนี้', 30], ['ทองคำ', 12], ['น้ำมัน/โภคภัณฑ์', 8]]),
    asset: pairs([['หุ้น (ไทย+ตปท.)', 50], ['ตราสารหนี้', 30], ['ทองคำ', 12], ['โภคภัณฑ์', 8]]),
    top5: pairs([['iShares MSCI ACWI', 12.0], ['พันธบัตรรัฐบาลไทย', 10.0], ['SPDR Gold', 8.0], ['หุ้นกู้เอกชน', 7.0], ['DELTA', 3.0]]),
    themes: ['ผสม', 'หลากสินทรัพย์', 'ทองคำ'], netbuy: 150, perf: 8.4, pop: 6200,
  },
  {
    id: 'ONEMIX', type: 'mixed',
    name: 'วรรณ ผสมหุ้น+ทองคำ', amc: 'วรรณ (บลจ.)',
    risk: 5, fee: 1.55, div: 0.7,
    mix: pairs([['หุ้นไทย', 35], ['หุ้นต่างประเทศ', 25], ['ทองคำ', 25], ['เงินสด', 15]]),
    asset: pairs([['หุ้น (ไทย+ตปท.)', 60], ['ทองคำ', 25], ['เงินฝาก/อื่นๆ', 15]]),
    top5: pairs([['SPDR Gold', 25.0], ['DELTA', 5.2], ['NVIDIA', 4.0], ['PTT', 3.4], ['ADVANC', 2.9]]),
    themes: ['ผสม', 'ทองคำ'], netbuy: 80, perf: 12.5, pop: 4300,
  },
  {
    id: 'SCBCONSER', type: 'mixed',
    name: 'ไทยพาณิชย์ ผสมระมัดระวัง', amc: 'ไทยพาณิชย์ จำกัด (บลจ.)',
    risk: 4, fee: 1.02, div: 1.6,
    mix: pairs([['ตราสารหนี้', 62], ['หุ้นไทย', 18], ['หุ้นต่างประเทศ', 10], ['เงินสด', 10]]),
    asset: pairs([['พันธบัตร/หุ้นกู้', 62], ['หุ้นสามัญ', 28], ['เงินฝาก/อื่นๆ', 10]]),
    top5: pairs([['พันธบัตรรัฐบาล 5Y', 9.0], ['หุ้นกู้ PTT', 4.0], ['DELTA', 3.2], ['พันธบัตร ธปท.', 3.0], ['ADVANC', 2.6]]),
    themes: ['ผสม', 'ระมัดระวัง'], netbuy: 180, perf: 5.2, pop: 5600,
  },
]

export function fundsByType(type) {
  return FUNDS.filter((fund) => fund.type === type)
}
