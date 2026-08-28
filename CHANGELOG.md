# Changelog

บันทึกงานที่ทำในแต่ละวัน เรียงจากล่าสุดไปเก่าสุด

## 2026-08-28 — Fundinfo: ลบ Mock Mode ทั้งหมด + ไล่แก้ fabricated data ที่เหลือ

### ตัวกรองเพิ่มเติม (FX Hedging/Geography/Megatrend/Style/Investment Style/Size/เงินลงทุนขั้นต่ำ) โชว์ 0 กองทุนเสมอ — regression จากการแก้ mock ตอนบ่าย ([useFundinfoScreener.js](src/composables/useFundinfoScreener.js))
- ตอนลบ mock ออก เปลี่ยนให้ dimension ที่ไม่มี field จริงจาก API เลย (7 ตัวข้างบน) คืนค่า `null`/`[]` แทนการเดา — แต่ effect ข้างเคียงคือ `[].some(...)` และ `null < x` ทำให้ตัวกรองพวกนี้ **exclude ทุกกองทันทีที่เลือก** (กด chip ไหนก็ได้ผลลัพธ์ 0 เสมอ) — verify สดด้วยข้อมูลจริง 3,166 กองบน `/fundinfo/offshore`: เลือก "Global Equity" คนเดียวก็เหลือ 0
- แก้เป็น no-op แทน: dropdown/chip ยังกดได้ตามเดิม (ไม่แตะ UI) แต่ไม่ narrow ผลลัพธ์ เพราะไม่มีข้อมูลจริงมา filter ได้ — filter ที่มี field จริง (นโยบายปันผล, สิทธิภาษี, SD/Sharpe/MaxDrawdown) ไม่กระทบ ยัง filter ถูกต้องตามเดิม (verify แล้ว: เลือก 4 chip ที่ไม่มีข้อมูลพร้อมกัน ยังคง 3,166 กอง, สลับไปกดนโยบายปันผล=จ่าย ลดเหลือ 33 ถูกต้อง)
- เช็ค schema เต็มของ `/api/v1/funds/list`/`/api/v1/funds/{code}` ยืนยันว่า **7 dimension นี้ไม่มี field รองรับเลยสักตัว** (ไม่ใช่แค่ backend ยังไม่ใส่ค่าแบบ pe_ratio/pb_ratio): FX Hedging, Geography, Megatrends/Thematic, Fund Style, Investment Style, Size & Characteristic, เงินลงทุนขั้นต่ำ — บันทึกลง [context.md §3](context.md) ให้ทีมเอาไป report backend ได้ พร้อม field ที่ต้องขอ (`fx_hedge_ratio`, `region`/`geography`, `theme_tags`, `investment_style`, `market_cap_class`, `min_investment_amount`) — สลับกลับเป็น filter จริงได้ทันทีที่มี field ไหนมา

### นโยบายปันผล — filter/ตารางเปรียบเทียบโชว์ผิด ([useFundinfoScreener.js](src/composables/useFundinfoScreener.js), [FundCompareTable.vue](src/components/fundinfo/FundCompareTable.vue)) — **committed (`85c4221`)**
- ตัวกรอง "นโยบายปันผล" เดิมไม่ได้อ่าน `fund.dividendPolicy` (field จริงจาก API) เลย ใช้ `fund.div > 0 || seed % 3 === 0` (เดาแบบสุ่ม 1/3) แทน — verify สดกับ API จริงทั้ง `/fundinfo/thai` และ `/fundinfo/offshore` (mismatch = 0 จาก ~90 กองที่เช็ค) หลังแก้
- ตัวกรอง SD/Sharpe เจอบั๊กแบบเดียวกัน: เช็คแต่ `fund.csvStats` (mock-only) ข้าม `fund.stats` (API จริง) ไปเลย

### API endpoint audit — ไล่เช็คทุก endpoint ที่ `fundinfoApi.js` ใช้ ว่า field ไหนขาด/ไม่ได้ใช้
- `/insights/themes`, `/insights/theme-funds`: mapper (`mapTheme`, `mapThemeFund`) เขียนไว้สำหรับ schema คนละแบบกับที่ API ใช้จริง (`theme_id`/`icon`/`master_fund`/`sample_symbols` ไม่มีอยู่จริงเลย) ทำให้ `fetchThemeFunds()` คืน `[]` เสมอ 100% — แก้ให้อ่าน field จริง (`theme_name`, `funds_count`, `total_aum_m_thb`, `avg_return_1m/1y`) แทน (ตอนนี้ยังไม่มีใครเรียกใช้ทั้งสอง endpoint นี้จริง เลยยังไม่กระทบผู้ใช้)
- พบ field จริงที่มีอยู่แต่ยังไม่ได้ใช้อีกหลายตัว: `return_6m`, `category_avg_return_3m/6m/1y`, `category_avg_sharpe_1y`, `category_avg_max_drawdown_1y`, `sharpe_ratio_3y`, `std_3y`, `max_drawdown_3y`

### ตารางผลตอบแทน/ความเสี่ยง — เลขปลอมที่ยังหลงเหลือ ([fundinfoApi.js](src/services/fundinfoApi.js), [useFundAnalytics.js](src/composables/useFundAnalytics.js), [FundPerformancePanel.vue](src/components/fundinfo/detail/FundPerformancePanel.vue))
- แถว "6 เดือน"/"10 ปี" ในตารางเปรียบเทียบผลตอบแทน fabricate ด้วย `y1*0.6`/`y5*1.5` ทั้งที่ `retP.y10` มีอยู่แล้วจริง (ใช้ในกราฟข้างๆ ด้วยซ้ำ) และ `return_6m` มีจริงจาก API แค่ไม่เคย map เข้ามา — แก้ทั้งคู่
- คอลัมน์ "เฉลี่ยกลุ่ม" เดิม return `null` เสมอใน direct mode (โชว์เป็น "%" เปล่าๆ) — ตอนนี้ดึงจาก `category_avg_return_3m/6m/1y` จริง (3Y/5Y/10Y ยังไม่มี field รองรับ โชว์ "-" แทนการเดา)
- ตาราง SD/Sharpe/Max Drawdown เดิมรันสูตรคูณ multiplier ปลอมทั้ง 6 ช่วงเวลา (คอมเมนต์ในโค้ดเองก็บอกว่า "mock illustrative figures only, not live risk data") ทั้งที่รันใน direct mode ด้วย — ตอนนี้เหลือแค่ 1Y/3Y (2 ช่วงเดียวที่ API มีข้อมูลจริง) ช่วงอื่นตัดทิ้งแทนการเดา

### ลบ Mock Mode ทั้งหมด — ก้อนใหญ่ที่สุดของวันนี้
- ลบ `src/data/fundinfoData.js`, `fundCsv.js`, ไฟล์ CSV มือสอง 4 ไฟล์ + ไฟล์ raw data เก่าที่ไม่มีใครใช้อีก — `VITE_FUNDINFO_API_MODE` เหลือแค่ `direct`/`wordpress` (ทั้งคู่คุย backend จริง ไม่มี mock อีกแล้ว)
- แยก label/lookup constants (ชื่อหมวดกองทุน, AMC, sector taxonomy, benchmark) ที่ทุกโหมดใช้จริงออกมาเป็น `src/data/fundinfoConstants.js` (ไฟล์ใหม่) ก่อนลบ ไม่งั้น direct mode พังไปด้วย
- ยุบ mock/real branch เหลือแต่ real ใน 10 ไฟล์: `fundinfoApi.js`, `useFundAnalytics.js`, `useFundinfoInsight.js`, `useFundinfoExposureTrend.js`, `useFundinfoRanking.js`, `useFundinfoScreener.js`, `FundInfoDetailView.vue`, `InsightCompareSection.vue`, `FundOverviewPanel.vue`, `FundPerformancePanel.vue`
- **บั๊กที่เจอระหว่างทาง**: `useFundinfoScreener.js`'s null-coercion (`null <= min` = `0 <= min` = true ใน JS) ทำให้กองทุนไม่มีข้อมูลจริงหลุดผ่านตัวกรอง SD/Sharpe/MaxDrawdown/เงินลงทุนขั้นต่ำแบบผิดๆ — แก้ให้ exclude ชัดเจนแทน
- **บั๊กที่เจอระหว่างทาง**: `useFundinfoExposureTrend.js` เดิม fallback ไปใช้ STOCK_META (ข้อมูลปลอม) ทุกครั้งที่หน้าโหลดจนกว่า API stocks จะมาถึง (ไม่ใช่แค่ mock mode) — แก้ให้รอข้อมูลจริงแทน พร้อมเพิ่ม `stocksLoading`/`stocksError`/`retryStocks` + ผูก `ApiErrorBanner` ในหน้า Exposure Trend
- ลบ `FundCompareChart.vue` (dead code ไม่มีที่ไหนเรียกใช้ fabricate กราฟด้วย `Math.sin`)
- Verify สดผ่านเบราว์เซอร์จริงหลายหน้า (list/filter/detail/exposure trend) — ระหว่างเทสต์เจอ backend 502 ชั่วคราวจริง (ngrok tunnel สะดุด) แอปโชว์ "ไม่พบข้อมูลกองทุน" แทนที่จะพัง แล้วโหลดข้อมูลถูกต้องเมื่อ backend กลับมา — error handling ทำงานตามที่ตั้งใจ

### เอกสารประกอบโปรเจกต์
- อัปเดต `CLAUDE.md`/`AGENTS.md`/`context.md`/`.env.example` จาก "three-mode API layer" เป็น "two-mode" ลบคำแนะนำเก่าที่บอกให้รักษา mock mode ไว้เสมอทิ้ง (ไฟล์เหล่านี้ gitignore ไว้ไม่เข้า git)

### ยังไม่ได้แก้ (พบระหว่างทาง รอตัดสินใจ)
- `trendSeries`/`performanceSeries` ใน `MarketLensSection.vue`/`ExposureTrendSection.vue`/`InsightCompareSection.vue` — เส้นกราฟยัง fabricate รูปทรงเส้นระหว่างจุด (ปลายเส้นเป็นค่าจริง แต่เส้นทางระหว่างจุดสุ่มจาก seed ไม่ใช่ราคาจริงรายวัน)
- 3 จาก 34 themes ใน `/insights/themes` ยังหลุดจาก mapping เพราะ id มีอักขระ `/` ไม่ผ่าน `THEME_ID_PATTERN`

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
