# Changelog

บันทึกงานที่ทำในแต่ละวัน เรียงจากล่าสุดไปเก่าสุด

## 2026-09-08 — Fundinfo: merge เข้า master/main + audit backend รอบ 2 + แก้บั๊ก filter/search 3 จุด

### Merge `aivane/Migrat:master` เข้า `fundinfo` — สอง architecture ชนกันคนละแบบทั้งไฟล์
- `fundApi.js`/`insightsApi.js`/`dashboardStore.js` เขียนใหม่คนละชุดพร้อมกันทั้งสองฝั่ง (ฝั่งเราแก้ field mapping ให้ตรง backend จริง, ฝั่ง master มีฟีเจอร์ Sector Hierarchy ที่เราไม่มี) — ตัดสินใจ (ยืนยันกับ user แล้ว): ใช้เวอร์ชัน master ทั้ง 3 ไฟล์ เพราะเป็นขอบเขตของทีมอื่น ไม่ใช่ fundinfo โดยตรง
- `FundCompareTable.vue` ฝั่ง master เป็นกราฟแท่ง (Chart.js), ฝั่งเรา redesign เป็นตารางล้วน — ใช้เวอร์ชันตาราง (มี dividend-display bug fix ของวันนี้ติดไปด้วย)
- **บั๊กที่เจอระหว่าง merge**: เอาไฟล์ master มาทั้งชุดแล้วดึง `apiClient.js`'s base URL มาด้วย (`/api/fund/api/v1` แทน `/api/fund`) — ถ้าปล่อยไว้จะชนกับ `fundinfoApi.js` ที่ hardcode `/api/v1/...` ในทุก call อยู่แล้ว กลายเป็น `/api/v1/api/v1/...` พังทั้ง feeder/offshore/thai/mixed ทันที — แก้โดยคง base URL เดิมไว้ (`/api/fund`) แล้วเติม `/api/v1/` prefix ให้ทุก `reconGet`/`reconPost` call ใน 2 ไฟล์ที่รับมาจาก master แทน (ปลายทางจริงเหมือนเดิมทุกตัว แค่ย้ายตำแหน่ง prefix)
- Verify: `npm run build` ผ่าน, เปิด `/dashboard` จริงข้อมูลขึ้นครบ, `/fundinfo/*` ไม่กระทบ
- Push: `aivane/Migrat:fundinfo` (`fc81c60→fafa241`) → **revert แล้ว push ใหม่อีกรอบ** (push รอบแรกไม่ได้รับ confirm ก่อน) → สุดท้าย merge fundinfoDev (ideatrade) ล่าสุดเข้า fundinfo (aivane) ก่อน ค่อย merge master ทับอีกที

### Audit field/endpoint ทั้งหมดอีกรอบ — ส่วนใหญ่ backend แก้เองแล้วระหว่าง session
- พบและรายงานเป็นบั๊กจริงตอนเช็ครอบแรก: `dividend_yield` เป็น `0` ทุกกองทุน 100% (แม้กองที่ `has_dividend=1`), `has_dividend` ขัดแย้งกับ `dividend_policy` เอง (94% ของกองทั้งหมด), `beta_1y` คงที่ `1` ทุกกอง, `estimated_flow_1m_m_thb` nonzero แค่ 2/2,241 กอง — **เช็คซ้ำภายหลัง backend แก้เองครบทุกจุด** (dividend_yield มีค่าจริงกระจาย, has_dividend mismatch เหลือ 0%, beta มี 74–154 distinct values/type, flow nonzero 99%+)
- `minimum_initial_thb` เคยเป็น `1` ทุกกองทุน 100% — backend แก้แล้วเช่นกัน (กระจายค่าจริง 500/1,000/10,000/100,000/500,000)
- `stocks/top?market_type=FOREIGN` เคยโดน cap เดิมที่ 500 แถว (backend ยกเลิก cap แล้วแต่ FOREIGN โตเกิน 500 เป็น 555+ ตัว) — เพิ่ม client-side limit เป็น 2000 ที่ [fundinfoApi.js:625](src/services/fundinfoApi.js:625) กัน truncate

### Screener enum เปลี่ยนชื่อเงียบๆ อีกรอบ — 3 chip ใช้ไม่ได้เลย ([fundinfoApi.js](src/services/fundinfoApi.js), [useFundinfoScreener.js](src/composables/useFundinfoScreener.js))
- `COMMODITIES_GOLD`→`COMMODITIES`, `HEALTHCARE`→`HEALTHCARE_BIOTECH`, `ASIA_EX_JAPAN`→`ASIA_PACIFIC` — 3 chip (ทองคำ/สินค้าโภคภัณฑ์, สุขภาพ, เอเชีย) ให้ผล 0 กองทุนเสมอทั้งที่มีข้อมูลจริงรองรับ (67/56/8 กองตามลำดับหลังแก้)
- เพิ่ม 2 หมวดใหม่ที่ backend มีข้อมูลจริงแล้วแต่ไม่เคยมี chip: `CONSUMER_LIFESTYLE`, `FINTECH_FINANCE`

### ช่องค้นหา "หุ้นที่ถือ" ไม่เคยทำงานเลยตั้งแต่แรก ([useFundinfoCategory.js](src/composables/useFundinfoCategory.js))
- Placeholder เขียนไว้ว่าค้นหาหุ้นที่ถือได้ ("NVIDIA, Microsoft, PTT, ADVANC") แต่ haystack ค้นหาจริงมีแค่ `[id, name, master, country, amc]` ไม่เคยเช็คหุ้นที่ถือเลย — ต่อให้เช็คก็ยังจะได้ 0 เพราะ `fund.top5` ว่างเปล่าเสมอสำหรับกองที่มาจาก `/funds/list` (holdings มีแค่ตอนเรียก `/funds/{id}` รายตัว)
- แก้โดยใช้ `topHoldingFundCodes` จาก `/stocks/top` (โหลดอยู่แล้วในหน้าเดียวกันสำหรับ Ranking Card ไม่ต้องยิง API เพิ่ม) — จับคู่ชื่อ/symbol หุ้นที่ค้นหา แล้วรวม fund code ที่ถือเข้ากับผลค้นหาเดิม — verify: "NVIDIA" จาก 0 → 2 กอง (ทั้งคู่ถือ iShares MSCI ACWI ETF จริง)

### กลุ่มเปรียบเทียบ Offshore/Thai จำกัดแค่ 5 ทั้งที่มีข้อมูลจริงมากกว่านั้น ([useFundinfoExposureTrend.js:22](src/composables/useFundinfoExposureTrend.js))
- `MAX_SELECTED = 5` ไม่ตรงกับ cap 7 ของ Feeder (theme) และ Ranking Card ที่อื่น — Offshore มีกลุ่มจริงถึง 8 กลุ่มแต่เลือกได้แค่ 5 มาตลอด แก้เป็น 7 ให้ตรงกัน — verify: Offshore เลือกได้ 7/7 จริงหลังแก้ (เดิมค้างที่ 5/5)

### ไม่ใช่บั๊ก — เพิ่ม comment กันเข้าใจผิดซ้ำ ([SearchFilterSection.vue:65](src/components/fundinfo/SearchFilterSection.vue))
- Mixed Fund ไม่มีปุ่ม "ตัวกรองเพิ่มเติม" (Investment Style/Size) ทั้งที่ `useFundinfoScreener.js` เขียนรองรับไว้และมี field จริงครบ — เข้าใจผิดว่าเป็นบั๊กตอนแรก **user ยืนยันว่าเป็น design decision ตั้งใจ** ไม่ใช่ของค้าง — เพิ่ม comment อธิบายไว้กันงงซ้ำในอนาคต ไม่ได้แก้โค้ด

### เฉลี่ยกลุ่มไม่ปัดทศนิยม + audit ประวัติการปันผล/top holding % เกิน 100% ([fundinfoApi.js](src/services/fundinfoApi.js))
- **แก้แล้ว (frontend)**: `categoryAvg` (เฉลี่ยกลุ่ม) ส่ง raw float จาก API ตรงๆ ไม่ปัดเลย (เช่น `0.700666` → โชว์ "+0.700666%") ต่างจากฟิลด์ผลตอบแทนอื่นที่ผ่าน `rounded()` ทั้งหมด — เพิ่ม `optionalRounded()` (null-safe, default 2 ตำแหน่ง) ครอบ 5 ค่าใน `categoryAvg` แทน `optionalNumber()` เดิม — verify สด: "+0.700666%" → "+0.7%", "-0.98926%" → "-0.99%"
- **แก้แล้ว (frontend) — จุดเดียวกัน พบเพิ่มทีหลัง**: ตาราง "ตัวชี้วัดความเสี่ยง" (SD/Sharpe Ratio/Max Drawdown, ทั้งกองทุนนี้และเฉลี่ยกลุ่ม) เจอบั๊กแบบเดียวกันทุกช่อง — เปลี่ยน `stats`/`stats3y`/`maxDrawdown` จาก `optionalNumber()` เป็น `optionalRounded()` ด้วย — verify สดครบ 3 แท็บ: SD `7.418%/5.805%`→`7.42%/5.81%`, Sharpe `-1.057/-0.888625`→`-1.06/-0.89`, Max Drawdown `-8.818/-5.555531`→`-8.82/-5.56`
- **บั๊กฝั่ง backend — ไม่ได้แก้ที่นี่**: "ประวัติการปันผล" ว่างเสมอเพราะ `/funds/{code}` ไม่มี field ประวัติวันที่/จำนวนเงินจ่ายจริงเลยสักช่อง (เช็คตรงกับ response แล้ว มีแค่ `status/fund_code/profile/top_holdings/allocations`) — ต้องรอ backend เพิ่ม endpoint ถึงจะมีข้อมูลจริงให้แสดง โค้ดฝั่งเราแสดงข้อความบอกสถานะตรงๆ อยู่แล้ว ไม่ใช่หน้าเสีย
- **ไม่ใช่บั๊ก — แก้ความเข้าใจ**: `/stocks/top` field `max_holding_weight` (top holding %) เกิน 100% จริงหลายตัว (KBANK 108.2%, BBL/KTB/SCB/TTB/BAY ~100.0-100.4%) — ตอนแรกเข้าใจว่าเป็นบั๊ก backend แต่ **ยืนยันแล้วว่าเกิน 100% ได้จริงตามข้อมูล ไม่ใช่ error** — ไม่ต้อง clamp ค่านี้ที่ 100% หรือ report เป็นบั๊กซ้ำอีก (บันทึกไว้ใน [context.md §3](context.md))

### Git / Deployment
- Merge fundinfoDev (ideatrade) ล่าสุดเข้า fundinfo (aivane/Migrat) → merge master ทับ (แก้ conflict ตามหัวข้อบน) → push ขึ้น `aivane/Migrat:fundinfo`
- ย้ายกลับมาทำงานบน `fundinfoDev`: push โค้ดทั้งหมดของ session นี้ (fast-forward ล้วน ไม่มี conflict) ขึ้น `ideatrade/FundInfo:fundinfoDev` (`fc81c60→7629dde`) แล้ว merge ต่อขึ้น `ideatrade/FundInfo:main` (`ca18450→7629dde`)
- **ยังไม่ push**: การแก้ `categoryAvg` rounding ด้านบน (ทำหลัง push รอบล่าสุด)

### ยังไม่ได้แก้ / รอ backend
- (สืบเนื่องจาก 2026-09-03) เส้น "จุดอ้างอิง" ยัง hardcode, N+1 backfill หน้า Mixed ยังต้อง throttle ไม่ได้แก้ที่ต้นตอ, `VITE_PROXY_FUND_BACKEND` (auth) ยังไม่ได้ย้าย host

## 2026-09-03 — Fundinfo: audit บั๊ก backend, ต่อสาย 7 ตัวกรอง screener แบบ exact-match, แก้ N+1 ที่ทำหน้า Mixed ล่ม, สลับ API host

### Audit บั๊ก backend จริง (ไม่ใช่สมมติฐาน) — เช็คสดกับ live API แล้วรายงานให้ backend team
- `is_feeder_fund` ผิดสำหรับกอง TH-market ล้วน 839 กอง (K-EQUITY/K-SET50/ES-SET50-A ฯลฯ ติด `is_feeder_fund=1` ทั้งที่ไม่ใช่ feeder จริง) — ทำให้กองหุ้นไทย/ผสมหลักหายจากทั้งแท็บ Thai และ Mixed **backend แก้แล้ว วันเดียวกัน**, ยืนยันซ้ำ
- `stocks/top?market_type=FOREIGN` ปนหุ้นไทยเข้ามาในอันดับ (10/15 เป็นหุ้นไทยอย่าง KKP/GULF/KBANK) **backend แก้แล้ว**, ยืนยันซ้ำ (เหลือ AAPL/NVDA/หุ้นจีน-เกาหลี-เวียดนามจริง)
- `management_style` เพี้ยนเป็น `DIVIDEND_FOCUSED` เกือบทุกกอง (97–99%) ไม่ว่าจริงจะ active/passive **backend แก้แล้ว** (ACTIVE 92%/PASSIVE 3%/DIVIDEND 4% หลังแก้)
- `nav_change_pct_1d` คำนวณผิดฐาน (K-GDBOND-A(A) โชว์ -8.88% จริง -0.29% จาก nav-history) **backend แก้แล้ว**
- `fx_hedging` เปลี่ยนรูปแบบเงียบๆ 3 รอบใน session เดียว: ประโยคไทยเต็ม → หายไป → กลับมาเป็น enum ซ้ำกับ `fx_hedge_policy` เป๊ะ ไม่มีแจ้งเปลี่ยน schema — **ยังไม่นิ่ง แจ้ง backend ให้ยึด `fx_hedge_policy` เป็นตัวหลักแล้ว**

### ต่อสาย 7 ตัวกรอง screener ที่เคยเป็น no-op ให้ใช้ field จริงแบบ exact-match id ([fundinfoApi.js](src/services/fundinfoApi.js), [useFundinfoScreener.js](src/composables/useFundinfoScreener.js), [SearchFilterSection.vue](src/components/fundinfo/SearchFilterSection.vue))
- Backend เพิ่ม field ใหม่ครบ 100% ทุกกอง: `fx_hedge_policy`, `geographic_focus`, `thematic_category`, `management_style`, `market_cap_focus`, `minimum_initial_thb` — ปิด gap เดิมที่เคย hold ไว้เพราะ Geography/Size ต้อง join ข้าม endpoint แล้วแม่นแค่ ~16%
- เพิ่ม `mapEnum()` whitelist validator ใน `fundinfoApi.js` — เก็บ enum string จาก backend เป็น id ตรงๆ (ไม่ hand-translate) กัน backend เปลี่ยน field เงียบๆ แบบ `fx_hedging` อีก
- เปลี่ยน option list (Geography/Megatrend/Fund Style/Investment Style/Size) จาก string label ตกแต่งเฉยๆ เป็น `{id, label}` จริง, เพิ่ม filter clause จริงใน `screenedFunds` (เดิม comment บอกไว้ชัดว่าเป็น no-op ตั้งใจ)
- Verify สดครบ: Offshore Geography=US 3,183→142 (ตรงกับ live distribution เป๊ะ), Thai Investment Style=Active→629→Size=Large-Cap→23, Feeder Style=Passive→55 กอง
- **บั๊กที่เจอระหว่างทาง**: chip "เน้นจ่ายปันผล (Dividend Focused)" ให้ผลลัพธ์ปนกองที่ไม่จ่ายจริง — ไม่ใช่บั๊กข้อมูล `management_style=DIVIDEND_FOCUSED` คือกลยุทธ์ (เน้นซื้อหุ้นปันผลสูง) คนละมิติกับ `dividend_policy` (นโยบายจ่ายคืนผู้ถือหน่วย) เช่น `KFDIVRMF` เป็น RMF ห้ามจ่ายปันผลตามกฎหมายไม่ว่ากลยุทธ์จะเป็นแบบไหน — เปลี่ยน label เป็น "กองทุนปันผลสูง" ตัดความกำกวม

### หน้า Mixed Fund ล่มตั้งแต่เปิดหน้า — N+1 backfill ยิงพร้อมกันเกินกว่า tunnel จะรับได้ ([useFundinfoMarketLens.js](src/composables/useFundinfoMarketLens.js))
- `is_feeder_fund` fix ด้านบนทำให้กอง mixed พุ่งจาก "ไม่กี่สิบกอง" (assumption เดิม) เป็น 473 กอง — โค้ดเดิมยิง `funds/{code}` แบบไม่จำกัดพร้อมกันหมดเพื่อดึง asset allocation มาสร้างกราฟ Market Lens
- เจอ error ตรงจาก dev proxy terminal: `Client network socket disconnected before secure TLS connection was established` — tunnel ตัด connection กลาง TLS handshake เอง เป็น connection-rate ceiling ไม่ใช่แค่ concurrency
- แก้ 4 ชั้น: (1) จำกัด backfill แค่ 80 กองที่ AUM สูงสุด (Market Lens จัดกลุ่มตามน้ำหนัก asset class กองใหญ่ก็ครอบคลุมทุกกลุ่มอยู่แล้ว) (2) หน่วงเริ่ม 1.5s ไม่ให้แย่ง connection กับ request สำคัญตอนเปิดหน้า (3) concurrency 2 + delay 400ms ต่อ request (4) circuit breaker หยุดยิงถ้าพัง 6 ครั้งติด + retry with backoff สำหรับ error ชั่วคราว
- Verify สด: backfill 80/80 สำเร็จไม่มี fail หลังสลับ API host (ดูหัวข้อถัดไป)

### สลับ Fund API host จาก ngrok ที่ไม่เสถียรไปเป็นโดเมนจริง ([.env](.env), [.env.example](.env.example), [vite.config.js](vite.config.js))
- `VITE_PROXY_FUND_API`: `isabella-hagiologic-rolland.ngrok-free.dev` → `https://api.ideatradefund.com`
- Verify ก่อนสลับ: burst 20 concurrent request พร้อมกันบน host ใหม่ผ่านหมด 20/20 (host เดิมพังตั้งแต่ ~3 concurrent) — หลังสลับหน้า Mixed backfill 80/80 กองสำเร็จไม่มี error เลย
- **ยังไม่แตะ** `VITE_PROXY_FUND_BACKEND` (auth service, คนละ ngrok tunnel `unexcusable-depreciatingly-lieselotte`) — เช็คแล้วว่า `api.ideatradefund.com` มีแค่ 2 service ตาม Swagger hub ของมันเอง (Fund Analytics API, IdeaTrade Analytics API) ไม่มี auth service เลย ลองทุก path ที่เป็นไปได้แล้ว 404 หมด — ถ้าเปลี่ยนตามที่ขอจะทำ login พังทันที รอ path/โดเมนที่ถูกต้องจากทีม backend ก่อน

### แก้ label ที่เข้าใจผิดง่ายอีกจุด ([useFundinfoThemeTrend.js](src/composables/useFundinfoThemeTrend.js))
- `CMP_LABELS` เดิม hardcode ตายตัว ("ก.ค. 68"–"ก.ค. 69") ล้าสมัยไปแล้ว 2 เดือนตอนที่เจอ (ปัจจุบันคือ ก.ย. 69) — เปลี่ยนเป็นคำนวณ relative จากวันที่ปัจจุบันเสมอ (label สุดท้าย = เดือนนี้, ถอยหลังทีละเดือน, โชว์ปี พ.ศ. ที่ label แรก/สุดท้าย/ทุก ม.ค.)

### ยังไม่ได้แก้ / ยังขาดอยู่
- **เส้น "จุดอ้างอิง" (SET TRI/MSCI ACWI/60-40)** ใน 4 component (`ThemeTrendSection.vue`, `MarketLensSection.vue`, `ExposureTrendSection.vue`, `InsightCompareSection.vue`) ยัง hardcode — **ติด backend**: ไม่มี field ดัชนีตลาดรวม (มีแค่ `benchmark_return_1y`/`category_avg_return_1y` ซึ่งเป็น benchmark ต่อ AIMC category ของกองนั้นๆ ไม่ใช่ดัชนีตลาด)
- **N+1 backfill ของหน้า Mixed** แก้แค่ระดับ throttle/cap ไม่ได้แก้ที่ต้นตอ — ยังต้องยิง request แยกกันทีละกอง เสนอให้ backend เพิ่ม bulk-detail endpoint (`POST /funds/batch?codes=...`) หรือใส่ `asset`/`mix` allocation ลงใน `funds/list` เลย จะตัด N+1 ทิ้งได้ทั้งหมด
- **`VITE_PROXY_FUND_BACKEND`** (auth) ยังอยู่บน ngrok เดิม ไม่รู้ path/โดเมนใหม่ที่ถูกต้อง — เสี่ยงเจอปัญหาความไม่เสถียรแบบเดียวกับที่เจอใน fund API ถ้ายังไม่ได้ย้าย
- **Backend/ngrok tunnel เดิม** (ที่ auth ยังใช้อยู่) มีประวัติ SSL handshake ล้มเหลว/502 เป็นระยะตลอด session นี้ — ยังไม่มีใครแก้ที่ต้นตอ

## 2026-08-30 — Fundinfo: แก้ 2 TODO ที่ค้างจากวันที่ 28 (theme id `/`, เส้นกราฟ fabricate)

### Theme id มี `/` หลุดจาก mapping ([fundinfoApi.js:12](src/services/fundinfoApi.js))
- ยืนยันสาเหตุจริงจาก live `/insights/themes`: 3 จาก 34 theme มี `/` ในชื่อ (เช่น `global_bond_fully_f/x_hedge` จากคำว่า "F/X") — เช็คแล้วว่า `theme_id` ถูกใช้แค่เป็น query param value (`?themes=a,b,c`) ไม่เคยเป็น URL path segment เลย จึงไม่มีความเสี่ยง path-injection จากการอนุญาต `/`
- แก้ `THEME_ID_PATTERN` จาก `/^[a-z0-9_-]{1,64}$/` เป็น `/^[a-z0-9_/-]{1,64}$/`

### เส้นกราฟ trend/performance ยัง fabricate รูปทรงระหว่างจุด ([useFundinfoThemeTrend.js](src/composables/useFundinfoThemeTrend.js), [useFundinfoMarketLens.js](src/composables/useFundinfoMarketLens.js), [useFundinfoExposureTrend.js](src/composables/useFundinfoExposureTrend.js), [useFundinfoInsight.js](src/composables/useFundinfoInsight.js))
- `useFundinfoInsight.js` มี pattern ที่ถูกต้องอยู่แล้ว (`apiCheckpointSeries`/`interpolateAnchors`): ใช้ real checkpoint returns (`retPRaw.{m1,q1,y1,y3,y5,y10}` — ค่าจริงจาก API) เป็น anchor แล้ว linear-interpolate ระหว่างจุดจริงเพื่อ sample ลงบน timeline 13 จุด — anchor ทุกจุดเป็นของจริง มีแค่เส้นระหว่างจุดที่เป็นเส้นตรงประมาณ
- ย้าย pattern นี้ไปเป็น shared export (`checkpointSeries`) ใน `useFundinfoThemeTrend.js` แล้วเพิ่ม `averageRetPRaw()`/`membersTrendSeries()` เพื่อเฉลี่ย `retPRaw` ของกองทุนสมาชิกในแต่ละ scope (theme/asset-class/region) ก่อนสร้าง series — แทนที่ `performanceSeries()` (seeded `Math.sin` fabrication) ในทั้ง 3 composable ที่กลุ่มกองทุนเป็น scope (Theme Pulse, Market Lens, Exposure Trend)
- ลบ `seedFromId()` (dead code) ออกจากทั้ง 3 ไฟล์
- **ไม่ได้แตะ:** เส้น "จุดอ้างอิง" (benchmark line, SET TRI/MSCI ACWI/พอร์ตผสม 60/40) ใน 4 component (`ThemeTrendSection.vue`, `MarketLensSection.vue`, `ExposureTrendSection.vue`, `InsightCompareSection.vue`) ยังใช้ `performanceSeries()` เดิม เพราะ benchmark return เป็นค่า hardcode คงที่ ไม่มี field จริงจาก API รองรับ — เป็นปัญหาแยกที่พบระหว่างทาง ยังไม่ได้แก้
- verify สดผ่านเบราว์เซอร์จริง: Feeder (Theme Pulse), Mixed (Market Lens), Offshore (Exposure Trend) — กราฟขึ้นเส้นจริงจากค่า retPRaw เฉลี่ยของแต่ละ scope ไม่มี error ใน console (เจอแค่ backend 502 ชั่วคราวที่รู้อยู่แล้วจาก ngrok tunnel สะดุด ไม่เกี่ยวกับโค้ดที่แก้)

### ยังไม่ได้แก้ (พบระหว่างทาง)
- `CMP_LABELS` ใน `useFundinfoThemeTrend.js` เป็น array ชื่อเดือนแบบ hardcode ปฏิทินตายตัว ("ก.ค. 68"–"ก.ค. 69") ตอนนี้ล้าสมัยแล้ว ควรคำนวณ label แบบ relative จากวันที่ปัจจุบันแทน
- เส้น "จุดอ้างอิง" (benchmark) ยังใช้ค่า return แบบ hardcode ไม่ใช่ real data — ดูหัวข้อด้านบน

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
