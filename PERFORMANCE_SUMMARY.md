# Dashboard Performance Summary

เอกสารนี้สรุปปัญหา performance ของระบบเดิม และแนวทางแก้ไขที่ควรทำร่วมกับการ migrate จาก WordPress ไป Vue 3

## สรุปปัญหา

ปัญหาหลักไม่ได้เกิดจาก WordPress หรือ Vue โดยตรง แต่เกิดจาก flow การดึงข้อมูลของ backend

ระบบ backend จะดึงข้อมูลแบบรายวัน และเริ่มดึงข้อมูลของวันใหม่เมื่อมีผู้ใช้คนแรกของวันเข้ามาใช้งานเว็บ ทำให้ request แรกของวันช้ามาก

```text
เช้าวันใหม่
ผู้ใช้คนแรกเข้าเว็บ
  -> frontend เรียก dashboard API
  -> backend เริ่มดึงข้อมูล/คำนวณข้อมูลของวันนั้น
  -> ผู้ใช้ต้องรอนานมาก

ผู้ใช้คนถัดไปในวันเดียวกัน
  -> backend มีข้อมูล/cache แล้วบางส่วน
  -> เร็วขึ้น แต่ยังมีความช้าอยู่
```

## ผลกระทบต่อการ migrate เป็น Vue 3

การเปลี่ยน frontend จาก WordPress/PHP snippets ไปเป็น Vue 3 จะช่วยเรื่องโครงสร้าง UI, UX, loading state, และการจัดการข้อมูลฝั่ง browser ได้ดีขึ้น

แต่ Vue 3 ไม่สามารถแก้ปัญหา backend cold start ได้โดยตรง

ถ้า backend ยังเริ่มดึงข้อมูลตอนผู้ใช้คนแรกเข้าเว็บเหมือนเดิม หน้า Vue ก็ยังต้องรอ API เหมือนกัน

```text
WordPress เดิมช้า
  เพราะ backend ยังไม่พร้อม

Vue 3 ใหม่ก็ยังช้าได้
  ถ้า backend ยังไม่ preload/cache ข้อมูล
```

## Root Cause

สาเหตุหลักคือ backend ใช้รูปแบบ lazy daily loading

หมายความว่า:

- ข้อมูลของวันใหม่ยังไม่ถูกเตรียมไว้ล่วงหน้า
- request แรกของวันเป็นตัว trigger ให้ backend เริ่มโหลดข้อมูล
- dashboard ต้องรอหลาย endpoint พร้อมกัน
- บาง endpoint มี timeout สูง และน่าจะมีการคำนวณหรือรวมข้อมูลจำนวนมาก
- หลังจากโหลดครั้งแรกแล้ว วันเดียวกันยังช้าเล็กน้อย เพราะยังต้องอ่าน/ประมวลผลหลาย endpoint แยกกัน

## API ที่เกี่ยวข้องกับ Dashboard

จาก snippets เดิม Dashboard เรียก API หลายชุด:

| กลุ่มข้อมูล | Endpoint |
| --- | --- |
| Dashboard stats | `/dashboard/stats` |
| Fund list | `/funds/list` |
| Top stocks | `/stocks/top` |
| Search funds | `/search/funds` |
| Master ETFs | `/dashboard/master-etfs` |
| Thai ETFs | `/dashboard/thai-etfs` |
| Portfolio allocation | `/dashboard/portfolio-allocation` |

ถ้า endpoint เหล่านี้ยังไม่ถูก preload หรือ cache ไว้ ผู้ใช้คนแรกจะเป็นคนรอทั้งหมด

## แนวทางแก้หลัก

### 1. Scheduled Daily Warmup

ควรให้ backend เตรียมข้อมูลของวันใหม่ก่อนผู้ใช้เข้าระบบ เช่น ตั้ง cron job ตอนเช้า

```text
06:00 daily warmup job
  -> preload dashboard stats
  -> preload fund list
  -> preload top stocks
  -> preload ETF data
  -> preload portfolio allocation
  -> preload insights
  -> save to cache/database
```

ผลลัพธ์ที่ต้องการ:

```text
ผู้ใช้คนแรกเข้าเว็บ
  -> API อ่านข้อมูลที่เตรียมไว้แล้ว
  -> ไม่ต้องรอ backend ดึงข้อมูลสด
```

### 2. Daily Snapshot

ข้อมูลรายวันที่ไม่ได้เปลี่ยนทุกวินาทีควรถูกบันทึกเป็น snapshot แยกตามวัน

ตัวอย่าง:

```text
dashboard_snapshot
  date
  type
  period
  payload_json
  generated_at

fund_list_snapshot
  date
  type
  page
  payload_json
  generated_at

insights_snapshot
  date
  endpoint
  params_hash
  payload_json
  generated_at
```

API ควรอ่านจาก snapshot เป็นหลัก แทนการคำนวณสดทุกครั้ง

### 3. Redis หรือ Server-side Cache

ควร cache endpoint ที่เรียกบ่อย โดยใช้ key ที่แยกตามวันและ parameter

ตัวอย่าง cache key:

```text
dashboard:stats:2026-07-14:FOREIGN:1M
dashboard:stats:2026-07-14:TH:1M
funds:list:2026-07-14:FOREIGN:page:1:per_page:100
stocks:top:2026-07-14:FOREIGN:20
portfolio:allocation:2026-07-14:all
insights:global-flow:2026-07-14:1M
```

### 4. Stale-while-revalidate

ถ้าข้อมูลวันนี้ยังไม่พร้อม ไม่ควรให้ผู้ใช้รอหน้าว่างนานเกินไป

ควรส่งข้อมูลล่าสุดที่มีอยู่ก่อน เช่นข้อมูลเมื่อวาน แล้วให้ backend อัปเดตข้อมูลวันนี้ด้านหลัง

```text
ถ้าข้อมูลวันนี้พร้อม
  -> ส่งข้อมูลวันนี้

ถ้าข้อมูลวันนี้ยังไม่พร้อม
  -> ส่งข้อมูลล่าสุดที่มี
  -> แจ้ง frontend ว่าเป็น stale data
  -> backend refresh ข้อมูลวันนี้ต่อ
```

response อาจมี metadata แบบนี้:

```json
{
  "data": {},
  "meta": {
    "data_date": "2026-07-13",
    "is_stale": true,
    "refreshing": true,
    "generated_at": "2026-07-13T18:00:00+07:00"
  }
}
```

### 5. Dashboard Bootstrap Endpoint

ตอนนี้ dashboard ต้องเรียกหลาย endpoint แยกกัน ทำให้ช้าและจัดการ loading ยาก

ควรมี endpoint รวมสำหรับหน้า dashboard

```text
GET /dashboard/bootstrap?period=1M
```

response รวมข้อมูลสำคัญ:

```json
{
  "stats": {
    "FOREIGN": {},
    "TH": {}
  },
  "top_stocks": {
    "FOREIGN": [],
    "TH": []
  },
  "etfs": {
    "master": [],
    "thai": []
  },
  "portfolio_allocation": {},
  "meta": {
    "data_date": "2026-07-14",
    "generated_at": "2026-07-14T06:15:00+07:00",
    "is_stale": false
  }
}
```

ข้อดี:

- frontend ยิง request น้อยลง
- backend คุม cache ได้ง่ายขึ้น
- ผู้ใช้เห็นข้อมูลเร็วขึ้น
- แยก initial dashboard load ออกจาก fund table pagination ได้

## สิ่งที่ Vue 3 ช่วยได้

Vue 3 ไม่ได้แก้ cold start โดยตรง แต่ช่วยให้ UX ดีขึ้นได้:

- แสดง skeleton loading แยกแต่ละ panel
- โหลดข้อมูลแบบ parallel
- cache ข้อมูลใน Pinia ระหว่าง session
- ไม่ยิง API ซ้ำเมื่อกลับมาหน้าเดิม
- แสดงสถานะข้อมูล เช่น “ข้อมูลล่าสุดเมื่อ ...”
- แสดง stale data ก่อน แล้ว refresh ด้านหลัง
- แยก dashboard เป็น component ทำให้ optimize ทีละส่วนง่าย

## สิ่งที่ควรเพิ่มใน Vue หลังจากนี้

### Frontend cache

ใช้ Pinia store เก็บข้อมูล dashboard ที่โหลดมาแล้ว

```text
dashboardStore
  stats
  topStocks
  fundList
  etfs
  portfolioAllocation
  loadedAt
  dataDate
```

ถ้าผู้ใช้กลับมาหน้า dashboard ใน session เดียวกัน ไม่ต้องยิง API ใหม่ทันที

### Loading state แบบแยกส่วน

ไม่ควรให้ทั้งหน้ารอ endpoint เดียว

```text
Stats panel loading
Fund table loading
ETF panel loading
Portfolio panel loading
```

### Data freshness UI

ควรแสดงว่า:

```text
ข้อมูลประจำวันที่ 14 กรกฎาคม 2026
อัปเดตล่าสุด 06:15
```

ถ้าเป็น stale data:

```text
กำลังอัปเดตข้อมูลวันนี้ แสดงข้อมูลล่าสุดจาก 13 กรกฎาคม 2026
```

## Priority ที่แนะนำ

### Priority 1: Backend Warmup

ทำ cron/scheduler ให้ backend preload ข้อมูลก่อนเวลาใช้งานจริง

นี่คือจุดที่แก้ปัญหา “ผู้ใช้คนแรกของวันช้ามาก” ได้ตรงที่สุด

### Priority 2: Server-side Cache / Snapshot

เก็บผลลัพธ์ของ endpoint หลักลง Redis หรือ database snapshot

### Priority 3: Dashboard Bootstrap API

รวมข้อมูลสำคัญของ dashboard เป็น endpoint เดียว เพื่อลดจำนวน request ตอนเปิดหน้า

### Priority 4: Vue Store Cache

เพิ่ม Pinia store เพื่อกันการยิง API ซ้ำใน session เดียวกัน

### Priority 5: Better Loading UX

เพิ่ม skeleton, stale label, last updated, retry state

## สรุป

ปัญหาช้าที่เจอในระบบเดิมคือ backend daily cold start ไม่ใช่ปัญหา frontend เป็นหลัก

การ migrate เป็น Vue 3 ยังมีประโยชน์ เพราะทำให้ frontend จัดการ state, loading, cache, และ UI ได้ดีขึ้น แต่ต้องแก้ backend ควบคู่กันด้วย

แนวทางที่ควรทำคือ:

```text
Daily warmup
  -> Snapshot/cache
  -> Bootstrap endpoint
  -> Vue store cache
  -> Better loading UX
```

ถ้าทำครบ ผู้ใช้คนแรกของวันจะไม่ต้องรอ backend ดึงข้อมูลสด และผู้ใช้คนถัดไปจะได้ response ที่เร็วขึ้นอย่างชัดเจน

