# Changelog

บันทึกงานที่ทำในแต่ละวัน เรียงจากล่าสุดไปเก่าสุด

## 2026-08-27 — Fundinfo: sync กับ API ตัวใหม่ + แก้บั๊ก UI หลายจุด

### API integration (fundinfoApi.js, useFundAnalytics.js, useFundinfoInsight.js, useFundinfoRanking.js)
- ตรวจสอบ backend API จริง (`isabella-hagiologic-rolland.ngrok-free.dev/api/fund`) พบว่ามี field ใหม่เพิ่มเข้ามาหลายตัวที่ก่อนหน้านี้ยังไม่มี: `nav`, `nav_change_pct_1d`, `alpha_1y`, `beta_1y`, `benchmark_name`, `benchmark_return_1y`, `dividend_yield`, `max_front_end_fee`/`max_back_end_fee`, `pe_ratio`/`pb_ratio` (schema มีแล้วแต่ค่ายังเป็น `null` ทุกกอง) และ endpoint ใหม่ `GET /api/v1/funds/{code}/nav-history` (ราคาปิดรายวันจริง)
- `/api/v1/stocks/top` เพิ่ม `return_1m`, `return_1y`, `industry`, `sector`
- map field เหล่านี้เข้า `normalizeFund()` / `mapTopStock()` และ wire เข้าใช้จริงใน:
  - หน้า Detail: NAV จริง, Alpha/Beta จริง (Documents tab), ค่าธรรมเนียมตามหนังสือชี้ชวนจริง (Fees tab)
  - กราฟ "กราฟภาพรวม": ใช้ NAV รายวันจริงจาก `fetchFundNavHistory()` แทนเส้น interpolate จาก checkpoint (fallback กลับไปใช้ checkpoint ถ้ายังโหลดไม่เสร็จ)
  - ตาราง "กองทุนที่กำลังเปรียบเทียบ": P/E, P/B, เทียบจุดอ้างอิง (gap), ดัชนีประจำกอง (benchmark) ของทั้ง Master Fund และกองทุนที่ถือหุ้นโดยตรง, ผลตอบแทนของหุ้นต่างประเทศ/ไทยใน insight table
- **บั๊กที่เจอและแก้ระหว่างทาง**:
  - `optionalNumber()` มีบั๊ก `Number(null) === 0` ทำให้ field ที่ API ส่ง `null` มา (P/E, P/B, max drawdown, ค่าธรรมเนียม ฯลฯ) กลายเป็น "0" แทนที่จะเป็น "ไม่มีข้อมูล" — แก้ที่ต้นทางใน `fundinfoApi.js`
  - `nav_change_pct_1d` จาก backend คำนวณผิด (เจอ +126.72% "1 วัน" ของกองหุ้นสหรัฐฯ, +19.99% ของกองบอนด์ผันผวนต่ำ — ดูเหมือนเทียบกับ NAV ตอนจดทะเบียนกองทุนแทนที่จะเป็นเมื่อวาน) เลี่ยงใช้ field นี้ คำนวณ daily change จากราคาปิดรายวันจริงแทน

### Master Fund AUM ([useFundinfoInsight.js](src/composables/useFundinfoInsight.js), [InsightCompareSection.vue](src/components/fundinfo/InsightCompareSection.vue))
- AUM ของแถว Master Fund (feeder) เดิม hardcode เป็น `null` ทั้งที่ข้อมูลมีอยู่แล้วในกองทุนสมาชิกแต่ละตัว — แก้ให้ sum จาก `fund.aum` ของสมาชิกทั้งหมด
- ปรับ `parseAumValue()` ให้ parse ตัวเลขที่มี comma และหน่วย "ล้าน" ได้ถูกต้อง (กระทบการ sort คอลัมน์ AUM)
- ปรับคำอธิบายใต้ชื่อกองทุน (subtitle) จากข้อความ hardcode "ข้อมูลรวมกองทุน Feeder จาก API" (เหมือนกันทุกแถว ไม่สื่อความหมาย) เป็นข้อมูลจริง เช่น "US Equity · รวมจากกองทุนไทย 7 กอง"

### Theme Trend badges ([useFundinfoThemeTrend.js](src/composables/useFundinfoThemeTrend.js), [ThemeTrendSection.vue](src/components/fundinfo/ThemeTrendSection.vue))
- ป้าย "ธีมที่เลือก X/5" มีเลข `5` hardcode ผิด (ค่าจริงคือ 7 ธีมทั้งหมด) แก้ให้ดึงค่า `maxSelected` จริงจาก composable
- Badge สรุป "บวก 1Y / เร่งขึ้น / เหนือ Global" เดิมนับจากทุกธีมเสมอ (X/7) ปรับให้นับเฉพาะธีมที่เลือกอยู่ในกราฟ (สอดคล้องกับสิ่งที่กราฟแสดงจริง)

### ตารางเปรียบเทียบ ([InsightCompareSection.vue](src/components/fundinfo/InsightCompareSection.vue), [fundinfo.css](src/assets/fundinfo.css))
- ขยายตารางกว้างขึ้น (`compare-table-wrap` 1400px → 1760px) และปรับสัดส่วนคอลัมน์ให้คอลัมน์ชื่อกองทุนกว้างขึ้น
- แก้ชื่อกองทุน/คำอธิบายที่ยาวให้ **ขึ้นบรรทัดใหม่แทนการตัดคำด้วย `...`** — เจอบั๊กซ้อนบั๊ก 2 รอบ: รอบแรกลบ class ตัดคำออกแต่ลืมว่า global `th,td{white-space:nowrap}` ยัง inherit ลงมาที่ `<strong>` ทำให้ชื่อยาวล้นออกนอกกรอบแบบมองไม่เห็น ต้องเพิ่ม `white-space:normal` ตรงๆ อีกชั้น

### Lazy-load หุ้นที่ถือ ([FundTableWithCompare.vue](src/components/fundinfo/FundTableWithCompare.vue))
- ตาราง "กองทุนที่ตรงเงื่อนไข" (offshore/thai) คอลัมน์ "หุ้นที่ถือเยอะ"/"น้ำหนักรวม" เดิมต้องคลิกแถวก่อนถึงจะโหลดข้อมูล (เพราะ `/funds/list` ไม่มี holdings มาด้วย ต้องเรียก `/funds/{code}` ทีละกอง) — เพิ่ม `IntersectionObserver` โหลดอัตโนมัติเมื่อแถวเลื่อนเข้า viewport
- เจอปัญหาต่อเนื่อง: เลื่อนเร็วๆ ทำให้มีหลายแถวยิง request พร้อมกัน จน Vite proxy หลุด TLS ("Client network socket disconnected") เพราะ backend/ngrok tunnel รับ concurrent connection ไม่ไหว — แก้ด้วยการเพิ่มคิวจำกัด concurrent fetch สูงสุด 3 รายการพร้อมกัน

### เอกสารประกอบโปรเจกต์
- ปรับปรุง `context.md` / `CLAUDE.md` / `AGENTS.md` (ไฟล์ local ไม่เข้า git) ให้ชัดเจนขึ้น แก้ข้อมูลล้าสมัย (fundinfo ไม่ได้ default เป็น mock แล้ว) เพิ่มสรุป field ที่ API ยังขาดจริง (§3 ใน context.md) กันงานซ้ำในอนาคต

### Git / Deployment
- ตรวจสอบแล้ว merge `fundinfoVer2` เข้า `master` (aivane/Migrat) ได้แบบไม่มี conflict เลย (master ไม่ได้เปลี่ยนอะไรตั้งแต่แยกสาย)
- Push งานทั้งหมดของวันนี้ขึ้น **`main`** ของ [IdeatradeOrg/FundInfo](https://github.com/IdeatradeOrg/FundInfo) (merge `ideatrade/main` เข้า `fundinfo` ก่อน แล้ว push แบบ fast-forward)
- สร้าง branch `fundinfoDev` จาก `main` สำหรับ dev ต่อ และ push ขึ้น ideatrade แล้ว
- ลบ branch `fundinfoVer2` ที่ค้างอยู่บน remote `ideatrade` ออก (เนื้อหารวมอยู่ใน main แล้ว)

### สิ่งที่ยังทำไม่ได้ (รอ backend)
- `P/E Ratio`, `P/B Ratio` ระดับกองทุน — มี field แล้วแต่ backend ยังไม่ใส่ค่า
- Recovery period, Turnover ratio — backend ยังไม่มี field
- `/stocks/top` — ยังไม่มี P/E, P/B, dividend yield, max drawdown ระดับหุ้น
- ไม่มี endpoint สำหรับ "Master Fund" (feeder-target ETF) โดยตรง — ยังต้อง group ฝั่ง client จาก `main_feeder_fund` text match (แม้จะเจอ `/api/v1/master-funds/list` ที่มีข้อมูลกองแม่จริงในสคีมา แต่ยังไม่ได้เอามาใช้แทนของเดิม)
