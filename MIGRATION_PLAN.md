# WordPress to Vue 3 Migration Plan

เอกสารนี้สรุปแนวทาง migrate จาก WordPress snippets เดิมไปเป็น Vue 3 ในโปรเจคนี้ โดยอ้างอิงจากไฟล์ในโฟลเดอร์ `wordpress/`

## ภาพรวมระบบเดิม

ระบบ WordPress เดิมใช้ shortcode และ JavaScript ที่ฝังผ่าน PHP snippets เป็นหลัก หน้าเว็บไม่ได้เรียก backend API โดยตรง แต่เรียกผ่าน WordPress AJAX ก่อน

```text
Browser / jQuery
  -> /wp-admin/admin-ajax.php?action=...
  -> WordPress PHP AJAX handler
  -> External backend API
  -> JSON response กลับไปที่หน้าเว็บ
```

ค่าต้นทาง API หลักอยู่ใน `wordpress/Config + PHP AJAX handlers DB.php`

```php
FUND_BACKEND    // auth backend
FUND_API_RECON  // fund, dashboard, insights API
```

ดังนั้น WordPress ตอนนี้ทำหน้าที่เป็น frontend shell และ API proxy มากกว่าจะเป็นแหล่งข้อมูลหลักจาก database ของ WordPress เอง

## เหตุผลที่ migrate ได้ค่อนข้างตรง

- UI เดิมส่วนใหญ่เขียนด้วย JavaScript และ DOM manipulation อยู่แล้ว
- ข้อมูลหลักมาจาก external API ไม่ได้ผูกกับ WordPress post database มากนัก
- PHP handlers ส่วนใหญ่เป็น proxy ไปหา API อีกที
- Vue 3 สามารถแทน shortcode UI, jQuery, และ DOM manipulation ได้โดยตรง
- โค้ดสามารถแยกเป็น component, service, store และ view ได้ชัดกว่า snippet เดิม

## API Groups ที่พบ

### Auth API

เดิมเรียกผ่าน `admin-ajax.php` แล้ว PHP ส่งต่อไป `FUND_BACKEND`

| WordPress action | Backend endpoint | ใช้สำหรับ |
| --- | --- | --- |
| `fund_login` | `/api/auth/login` | login |
| `fund_register` | `/api/auth/register` | register |
| `fund_logout` | local cookie clear | logout |
| `fund_verify` | `/api/auth/verify` | verify token |
| `fund_profile` | `/api/auth/profile` | user profile |
| `fund_account_info` | `/api/auth/account-info` | account info |
| `fund_change_pw` | `/api/auth/change-password` | change password |
| `fund_set_pw` | `/api/auth/set-password` | set password |
| `fund_update_profile` | `/api/auth/update-profile` | update display name |
| `fund_upload_avatar` | `/api/auth/upload-avatar` | upload avatar |
| `fund_google_url` | `/api/auth/google/url` | get Google login URL |
| `fund_google_verify` | `/api/auth/google/verify` | verify Google credential |
| `fund_link_google` | `/api/auth/link-google` | link Google account |
| `fund_unlink_google` | `/api/auth/unlink/google` | unlink Google account |
| `fund_forgot` | `/api/auth/forgot-password` | forgot password |
| `fund_reset_pw` | `/api/auth/reset-password` | reset password |

### Fund, Search, Dashboard API

เดิมเรียกผ่าน `admin-ajax.php` แล้ว PHP ส่งต่อไป `FUND_API_RECON`

| WordPress action | Backend endpoint | ใช้สำหรับ |
| --- | --- | --- |
| `fund_search_nav` | `/search/suggestions` | search suggestion บน navbar |
| `fund_dashboard_stats` | `/dashboard/stats` | dashboard statistics |
| `fund_top_stocks` | `/stocks/top` | top stocks |
| `fund_fund_detail` | `/funds/{code}` | fund detail |
| `fund_search` | `/search/funds?type=TH`, `/search/funds?type=FOREIGN` | search funds จาก symbols |
| `fund_fund_list` | `/funds/list` | fund list พร้อม filter |
| `fund_dashboard_master_etfs` | `/dashboard/master-etfs` | foreign ETF data |
| `fund_dashboard_thai_etfs` | `/dashboard/thai-etfs` | Thai ETF data |
| `fund_dashboard_portfolio_allocation` | `/dashboard/portfolio-allocation` | portfolio allocation |

### Insights API

| WordPress action | Backend endpoint | ใช้สำหรับ |
| --- | --- | --- |
| `fund_insights_trend` | `/insights/trend` | uptrend funds |
| `fund_insights_valuation` | `/insights/valuation` | valuation funds |
| `fund_insights_popularity` | `/insights/popularity` | popularity data |
| `fund_insights_themes` | `/insights/themes` | theme list |
| `fund_insights_global_flow` | `/insights/global-flow` | global fund flow |
| `fund_insights_flow_trend` | `/insights/flow-trend` | inflow/outflow trend |
| `fund_insights_theme_funds` | `/insights/theme-funds` | funds by theme |
| `fund_fund_trend` | `/funds/{code}/trend` | fund trend detail |

## Mapping จาก WordPress Snippet ไป Vue 3

| WordPress file | บทบาทเดิม | Vue 3 target |
| --- | --- | --- |
| `Config + PHP AJAX handlers DB.php` | PHP AJAX proxy ไป backend API | `src/services/*.js` หรือ backend proxy ใหม่ |
| `CSS+JS-Navbar,Login,Register,Profile,Password.php` | navbar, auth forms, profile logic | `Navbar.vue`, `LoginView.vue`, `RegisterView.vue`, `ProfileView.vue`, `ForgotPasswordView.vue` |
| `Search bar.php` | search bar บน navigation | `SearchBar.vue` |
| `fund_dashboard css.php` | shortcode container และ dashboard CSS | `DashboardView.vue` และ component CSS |
| `Fund-Dashboard-JS.php` | dashboard logic, filters, table, stats | `DashboardView.vue`, `FundTable.vue`, `DashboardStats.vue`, `FilterPanel.vue` |
| `Insights-shortcode-css.php` | insights container และ CSS | `InsightsView.vue` และ component CSS |
| `Insights-js.php` | insights UI logic | `InsightsView.vue`, `GlobalFlowPanel.vue`, `ThemeFundsPanel.vue`, `TrendPanel.vue` |
| `insights-api-handlers.php` | PHP proxy สำหรับ insights | `src/services/insightsApi.js` หรือ backend proxy ใหม่ |
| `Hover Nav-Shadow ask.php` | navigation hover behavior | CSS/Vue interaction ใน `Navbar.vue` |

## โครงสร้าง Vue ที่แนะนำ

```text
src/
  router/
    index.js
  services/
    apiClient.js
    authApi.js
    fundApi.js
    insightsApi.js
  stores/
    authStore.js
    fundStore.js
  views/
    HomeView.vue
    DashboardView.vue
    InsightsView.vue
    LoginView.vue
    RegisterView.vue
    ProfileView.vue
    ForgotPasswordView.vue
    ResetPasswordView.vue
  components/
    layout/
      AppLayout.vue
      Navbar.vue
    search/
      SearchBar.vue
    dashboard/
      DashboardStats.vue
      FundTable.vue
      FundFilters.vue
      PortfolioAllocation.vue
    insights/
      GlobalFlowPanel.vue
      ThemeFundsPanel.vue
      TrendPanel.vue
```

## แนวทางเรียก API ใน Vue

### ทางเลือก A: Vue เรียก backend API ตรง

เหมาะถ้า backend เปิด CORS ถูกต้อง และไม่มี secret ที่ต้องซ่อนจาก browser

```text
Vue 3
  -> FUND_BACKEND / FUND_API_RECON
```

ข้อดี:
- เร็วกว่า เพราะไม่ผ่าน WordPress
- โค้ดน้อยกว่า
- ลดภาระ WordPress

ข้อควรระวัง:
- ต้องจัดการ CORS
- URL backend จะเห็นใน browser
- ถ้าใช้ ngrok เปลี่ยน URL บ่อย ต้องทำ config ให้ดี

### ทางเลือก B: Vue เรียก proxy backend ใหม่

เหมาะถ้าต้องควบคุม security, headers, token, rate limit หรือแก้ CORS

```text
Vue 3
  -> New API proxy
  -> FUND_BACKEND / FUND_API_RECON
```

ข้อดี:
- คุม security ได้ดี
- ซ่อน backend URL ได้
- ใส่ cache ได้ง่าย
- แทน WordPress `admin-ajax.php` ได้สะอาดกว่า

ข้อควรระวัง:
- ต้องมี backend เพิ่ม
- ต้อง deploy และดูแลเพิ่มอีกส่วน

### ทางเลือก C: ช่วงเปลี่ยนผ่านยังใช้ WordPress AJAX

เหมาะถ้าต้อง migrate แบบไม่กระทบระบบเดิมทันที

```text
Vue 3
  -> /wp-admin/admin-ajax.php?action=...
  -> WordPress PHP handler เดิม
```

ข้อดี:
- เสี่ยงต่ำ
- ใช้ backend flow เดิมได้ทันที
- เหมาะกับการย้าย UI ทีละหน้า

ข้อเสีย:
- ยังพึ่ง WordPress
- ยังมี overhead ของ `admin-ajax.php`
- ยังไม่ได้แก้ปัญหา performance เต็มที่

## ลำดับการ migrate ที่แนะนำ

### Phase 1: วางฐาน Vue

- เพิ่ม `vue-router`
- เพิ่ม layout หลัก
- เพิ่ม route สำหรับ Dashboard, Insights, Login, Register, Profile
- สร้าง `apiClient.js` สำหรับ axios config
- สร้าง `.env` สำหรับ URL backend

### Phase 2: ย้าย Search และ Dashboard

เริ่มจากส่วนนี้ก่อน เพราะ data flow ชัด และไม่ผูกกับ auth มากเท่า profile

- ย้าย `Search bar.php` เป็น `SearchBar.vue`
- ย้าย `Fund-Dashboard-JS.php` เป็น `DashboardView.vue`
- แยก table, filters, stats เป็น component
- สร้าง `fundApi.js`
- เทียบ response กับ WordPress เดิม

### Phase 3: ย้าย Insights

- ย้าย `Insights-js.php` เป็น `InsightsView.vue`
- สร้าง `insightsApi.js`
- แยก global flow, valuation, trend, theme funds เป็น component
- เช็ก loading, empty, error state

### Phase 4: ย้าย Auth/Profile

- ย้าย login/register/profile/password flows
- สร้าง `authApi.js`
- ใช้ Pinia เก็บ auth state
- ตัดสินใจเรื่อง token ว่าจะเก็บใน cookie หรือ localStorage
- ย้าย Google login flow

### Phase 5: Performance และ cleanup

- ตัด dependency กับ jQuery
- ลดการยิง API ซ้ำ
- เพิ่ม cache เฉพาะข้อมูลที่ไม่เปลี่ยนบ่อย
- ทำ pagination/filter ให้ใช้ query params
- ลบ shortcode/snippet ที่ไม่ใช้แล้วทีละส่วน

## สิ่งที่ต้องระวัง

### 1. Token storage

ระบบเดิมเก็บ token ใน cookie ชื่อ `auth_api_token` และบางส่วนเก็บ user ใน `localStorage`

ใน Vue ควรกำหนดให้ชัด:
- ถ้าเน้นง่าย ใช้ localStorage + Authorization header
- ถ้าเน้น security มากขึ้น ใช้ httpOnly cookie ผ่าน backend proxy

### 2. CORS

ถ้า Vue เรียก ngrok/backend ตรง อาจติด CORS ได้ ต้องให้ backend อนุญาต origin ของ Vue dev/prod domain

### 3. ngrok URL

URL ตอนนี้เป็น ngrok ซึ่งอาจเปลี่ยนได้ ไม่ควร hardcode ใน component ควรเก็บใน `.env`

ตัวอย่าง:

```text
VITE_FUND_BACKEND=https://example.dev
VITE_FUND_API_RECON=https://example.dev/api/recon/v2
```

### 4. API response shape

WordPress handler เดิมบาง action ส่ง response เป็น `wp_send_json_success()` ซึ่ง Vue จะเห็นข้อมูลในรูปแบบ:

```json
{
  "success": true,
  "data": {}
}
```

แต่บาง action ส่ง `wp_send_json()` ตรง ๆ ทำให้ response shape ไม่เหมือนกัน ต้อง normalize ใน service layer

### 5. Performance

ปัญหาช้าเดิมอาจเกิดจาก:
- ยิงหลาย API พร้อมกัน
- ผ่าน WordPress `admin-ajax.php` ทุกครั้ง
- ไม่มี cache
- timeout สูงมากบาง endpoint
- response ใหญ่เกินจำเป็น

หลัง migrate ควรลด request ที่ซ้ำ และใช้ cache/stale state ใน store

## งานแรกที่ควรเริ่ม

แนะนำให้เริ่มจาก Dashboard เพราะเป็นส่วนที่มี API ชัดที่สุดและเห็นผล migration ได้เร็ว

1. สร้าง `src/services/apiClient.js`
2. สร้าง `src/services/fundApi.js`
3. สร้าง `src/views/DashboardView.vue`
4. สร้าง route `/dashboard`
5. ย้าย logic จาก `Fund-Dashboard-JS.php` ทีละส่วน:
   - stats
   - fund list
   - filters
   - search
   - table
   - ETF panels
   - portfolio allocation

หลังจาก Dashboard ใช้งานได้ ค่อยย้าย Insights และ Auth ตามลำดับ

## สรุป

โปรเจคนี้เหมาะกับการ migrate ไป Vue 3 เพราะ WordPress เดิมทำหน้าที่เป็นตัวกลาง AJAX มากกว่าทำ business logic หลักในตัวเอง งานหลักคือย้าย UI จาก shortcode/jQuery มาเป็น Vue component และย้ายการเรียก `admin-ajax.php?action=...` ไปเป็น service layer ที่เรียก backend API อย่างเป็นระบบ

แนวทางที่ปลอดภัยที่สุดคือ migrate แบบค่อยเป็นค่อยไป:

```text
Dashboard -> Insights -> Auth/Profile -> Cleanup WordPress snippets
```

## สถานะล่าสุด — Fundinfo (branch `fundinfoVer2`, อัปเดต 2026-08-25)

อ้างอิง API จริงที่ `https://isabella-hagiologic-rolland.ngrok-free.dev/api/fund/docs#/` (proxy ผ่าน `/api/fund` ใน `vite.config.js`, base path จริงคือ `/api/v1/...`)

### ทำแล้ว

- เชื่อม Fund list/detail และ Top Stocks API จริงสำหรับ Feeder, Offshore, Thai ผ่าน `src/services/fundinfoApi.js` (`/api/v1/funds/list`, `/api/v1/funds/{code}`, `/api/v1/stocks/top`)
- Feeder/Offshore/Thai แสดงข้อมูลจริงแทน mock แล้ว
- Rank Card ของ Offshore/Thai กดเลือกเปรียบเทียบได้ (`useFundinfoRanking.js`)
- Analysis ใช้ข้อมูล holdings และ portfolio-allocation จริง (`/api/v1/portfolio-allocation`)
- แก้หน้า Detail ไม่ crash เมื่อ API ไม่มี Alpha/Beta
- เพิ่ม secure adapter (input validation + sanitization) สำหรับ portfolio-allocation, insights/themes, theme-funds ใน `fundinfoApi.js`
- ตรวจ `npm run build` ผ่านทุกครั้งก่อน commit

### บั๊กที่พบและแก้แล้ว (session ตรวจ fundinfo, 2026-08-25)

ทั้งหมดยืนยันด้วยการยิง API จริง + ทดสอบใน browser จริง ไม่ใช่จากอ่านโค้ดเดาเฉยๆ ไม่มีจุดไหนกระทบ UI/layout — แก้แค่ค่าที่แสดง/แหล่งข้อมูลที่ดึงมา

1. **[FundDetailRow.vue](src/views/fundinfo/FundDetailRow.vue)** — กราฟ "Calendar Year Returns" ตอนขยายแถวกองทุนในตาราง มโนตัวเลขปลอม (`{'2564':18.5,...}`) ทุกครั้งที่ API ไม่มี field `cyr` (ซึ่งไม่มีจริงเสมอ) แก้ให้ไม่วาดกราฟเมื่อไม่มีข้อมูลจริง แทนที่จะโชว์เลขมั่ว
2. **[FundFeesPanel.vue](src/components/fundinfo/detail/FundFeesPanel.vue)** — "มูลค่าขั้นต่ำของการซื้อครั้งแรก" โชว์ "0 บาท" เสมอ (API ไม่มี field นี้) ทำให้เข้าใจผิดว่าไม่มีขั้นต่ำ แก้เป็น "-"
3. **[FundTableWithCompare.vue](src/components/fundinfo/FundTableWithCompare.vue)** — คอลัมน์ "หุ้นที่ถือเยอะ"/"น้ำหนักรวม" และ panel สัดส่วนอุตสาหกรรม/Top 5 Holdings ตอนขยายแถว ว่างเปล่าตลอด เพราะ `/funds/list` ไม่ส่ง holdings/allocations มาให้ (มีแค่ `/funds/{code}` เดี่ยวๆ) แก้ให้ตอนขยายแถวไป fetch รายละเอียดจริงของกองทุนนั้น (ใช้ mechanism ที่ `fundinfoStore.js` มีอยู่แล้ว แค่ไม่เคยถูกเรียก) ทดสอบแล้วเห็นข้อมูลจริงทั้งคอลัมน์และ panel
4. **[useFundinfoMarketLens.js](src/composables/useFundinfoMarketLens.js)** — Mixed Fund หน้า "MARKET LENS" (ภาพตลาด 3 กลุ่มนำ 2 กลุ่มตาม) ว่าง/ไม่มีข้อมูลตลอด สาเหตุเดียวกับข้อ 3 (`fund.mix`/`fund.asset` ว่างจาก list endpoint) — Mixed เป็น category เล็ก (~39 กองทุนเท่านั้น) เลย backfill รายละเอียดจริงของทุกกองครั้งเดียวตอนโหลดหน้า ทดสอบแล้วเห็นกลุ่มจริง (หุ้น, เงินฝากธนาคาร P/N และ B/E, หน่วยลงทุน, พันธบัตรรัฐบาล, หุ้นกู้) พร้อมตัวเลขจริง

**พบแต่ยังไม่แก้ (dead code, ไม่กระทบผู้ใช้ตอนนี้)**: [FundDetailCard.vue:58](src/components/fundinfo/FundDetailCard.vue:58) มีบั๊กแบบเดียวกับข้อ 1 เป๊ะ แต่ไฟล์นี้ไม่มีใครเรียกใช้ในโปรเจกต์เลย

### เหลือ / ต้องตัดสินใจเพิ่ม (ติดที่ API ไม่มีข้อมูลจริง ไม่ใช่บั๊กโค้ด — ยืนยันด้วยการยิง API จริงแล้ว)

- **กราฟภาพรวม (NAV/ผลตอบแทน) + Calendar Year Returns ในหน้า Detail** — ไม่มี endpoint ราคา/NAV ย้อนหลังที่ไหนเลยในระบบ ลองยิง `/api/v1/funds/{code}/trend` ดูจริงแล้วพบว่าเป็น "holdings trend" (สัดส่วนหุ้นที่ถือขึ้น/ลง/ทรงตัว) ไม่ใช่ราคาย้อนหลัง และไม่มี field ผลตอบแทนรายปีปฏิทินเลยสักตัว — ต้องรอ backend เพิ่ม endpoint ประเภทนี้ก่อน
- **เปรียบเทียบ Performance บนกราฟเดียวกัน (`InsightCompareSection.vue`)** — เหตุผลเดียวกัน ต้องใช้ผลตอบแทนย้อนหลังแบบ time-series ของหุ้น/กองทุนแต่ละตัว ซึ่งไม่มีอยู่ในสเปคเลยสักตัว (`hasHistoricalSeries` เลย false ตลอดในโหมด API จริง ตามที่ตั้งใจออกแบบไว้)
- **คอลัมน์ "สิทธิภาษี" ในตารางกองทุน** — มีบั๊กจริง (`useFundinfoScreener.js` คำนวณ tag ไว้ที่ `screenerTags.taxBenefit` แต่ `FundTableWithCompare.vue` อ่านจาก `fund.taxBenefit` คนละที่) **แต่ตั้งใจไม่แก้ให้ตรงกัน** เพราะค่าที่คำนวณไว้เป็นค่าสุ่มแบบ deterministic ต่อ id กองทุน ไม่ใช่ข้อมูลสิทธิภาษีจริง (คอมเมนต์ในโค้ดเขียนตรงๆ ว่า "ยังไม่มีในโครงสร้างข้อมูลจริง") ถ้าเชื่อมให้ตรงกันจะกลายเป็นโชว์ป้าย SSF/RMF/Thai ESG ปลอมให้กองทุนจริง อันตรายกว่าโชว์ "-" — **ต้องตัดสินใจ**: จะเอาคอลัมน์นี้ออกเพราะ API ไม่มีข้อมูลจริง หรือรอ backend เพิ่ม field แล้วค่อยเชื่อม
- **"ขั้นต่ำ" และ "NAV/หน่วย" ในตารางกองทุน** — ยืนยันแล้วว่า API ไม่มี field พวกนี้เลยทั้งใน `/funds/list` และ `/funds/{code}` ต้องรอ backend เพิ่ม
- `fetchInsightThemes()` และ `fetchThemeFunds()` มีใน `fundinfoApi.js` แล้ว (เรียก `/api/v1/insights/themes`, `/api/v1/insights/theme-funds`) แต่ **ยังไม่ถูกเรียกใช้จริง** — ไม่มีทั้งใน `fundinfoStore.js` และไม่มี component ไหน import ไปใช้ ต้อง wire เข้า Analysis Offshore (`InsightCompareSection.vue`) พร้อม cache layer แบบเดียวกับ fund list/detail

### ตรวจสอบ API — ขาด endpoint ไหนบ้าง?

เทียบ endpoint ที่ `src/services/fundinfoApi.js` เรียกอยู่ (feeder/offshore/thai/mixed list, detail, top stocks, portfolio-allocation, insights/themes, insights/theme-funds) กับ OpenAPI spec ปัจจุบัน (`/api/fund/openapi.json`):

**ไม่ขาด** — endpoint ที่ fundinfo ใช้ทั้งหมดมีอยู่จริงและ path ตรงกับ spec เป๊ะ

**พบปัญหาที่ของเดิม (`/dashboard`, `/insights` route เดิม ไม่ใช่ fundinfo — แต่ยัง active ใน router อยู่)** — `src/services/fundApi.js`, `src/services/insightsApi.js`, `src/components/SearchBar.vue` เรียก path ที่ผิดกับ spec ปัจจุบัน:
  - **ขาด prefix `/api/v1`** (จะได้ 404 จาก backend จริง เพราะ path ที่เรียกไม่ตรง route): `/dashboard/stats`, `/dashboard/master-etfs`, `/dashboard/thai-etfs`, `/search/suggestions`, `/search/funds`, `/insights/flow-trend`, `/funds/{code}/trend`
  - **endpoint ไม่มีอยู่จริงในสเปคเลย** ไม่ว่าจะเติม prefix หรือไม่: `/insights/trend`, `/insights/valuation`, `/insights/popularity`, `/insights/global-flow`, `/dashboard/portfolio-allocation` (ของจริงคือ `/api/v1/portfolio-allocation` ไม่มี `/dashboard` นำหน้า)
  - นี่คือโค้ดเดิมที่มีมาก่อน branch นี้ ยังไม่ได้แก้ในรอบนี้ — ควรตัดสินใจว่าจะแก้ให้ตรง spec ปัจจุบัน หรือเลิกใช้หน้า Dashboard/Insights เดิมไปเลยถ้าจะย้ายผู้ใช้ไปหน้า fundinfo แทน

**Endpoint ที่มีอยู่จริงแต่ยังไม่ได้ใช้เลยในโค้ด** (อาจเป็นประโยชน์กับงานที่เหลือ):
  - `/api/v1/insights/sectors`, `/insights/sectors/thai|foreign|feeder|mixed` — sector/theme ranking แยกตามประเภทกองทุน (มี `sort_by` เช่น holding_value/flow/aum) น่าจะเอามาใช้แทน mock บางส่วนใน Analysis ได้
  - `/api/v1/feeder-funds/holders` — หา Thai feeder fund ที่ถือ master fund ต่างประเทศตัวหนึ่งโดยตรง (ค้นด้วย `symbol`/`target`) แทนการ join เองฝั่ง frontend อย่างที่ `buildFundHolderEntities()` ทำอยู่ตอนนี้
  - `/api/v1/search/foreign-funds`, `/api/v1/search/stocks` (มีทั้ง GET/POST) — full-text search ที่มี field ครบกว่า `/search/suggestions`
  - `/api/v1/funds/{code}/trend` — มีจริง แต่เป็น "fund holdings trend" (สัดส่วนการถือครองย้อนหลัง) ไม่ใช่ราคาหุ้น/NAV ย้อนหลัง จึงช่วยกราฟผลตอบแทนใน `InsightCompareSection.vue` ไม่ได้โดยตรง

**สรุปเรื่องกราฟผลตอบแทนจริงรายหุ้น**: ยืนยันจาก OpenAPI spec แล้วว่าไม่มี endpoint ไหนคืนค่า time-series ราคา/ผลตอบแทนของหุ้นหรือ benchmark เลยแม้แต่ตัวเดียว (schema ของทุก endpoint เป็น `{}` เพราะ backend คืน raw dict ไม่ได้ประกาศ response model — ต้อง verify field จาก response จริงเสมอ ไม่ใช่จาก spec) ต้องรอ backend เพิ่ม endpoint นี้ก่อนถึงจะทำกราฟผลตอบแทนจริงรายหุ้น/index ได้

