<!-- src/components/fundinfo/detail/FundDetailHeader.vue -->
<script setup>
// Presentation-only: no analytics/computation here, only display of
// already-derived values passed down from FundInfoDetailView.vue.
defineProps({
  fund: { type: Object, required: true },
  typeMeta: { type: Object, required: true },
  accent: { type: String, required: true },
  dailyChange: { type: Object, default: () => ({ diffBaht: 0, diffPct: 0 }) },
  registrationDate: { type: String, default: '-' },
  turnoverRatio: { type: [String, Number], default: '-' },
  bidPrice: { type: Number, default: 0 },
  offerPrice: { type: Number, default: 0 },
  policyBullets: { type: Array, default: () => [] },
})
</script>

<template>
  <section class="space-y-8">
    <!-- Top summary bar -->
    <div class="pb-6 border-b border-[var(--line)] flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
      <div class="flex items-center gap-4 min-w-0">
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg cs shrink-0"
          :style="{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }"
        >
          <!-- Anti-XSS: amcCode is a short static mock code, rendered via text interpolation only -->
          {{ fund.amcCode }}
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded text-white" :style="{ background: accent }">{{ typeMeta.label }}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded surf2 sub">ความเสี่ยงระดับ {{ fund.risk }}</span>
            <span class="text-[10px] sub font-semibold num">{{ fund.id }}</span>
          </div>
          <!-- Anti-XSS: {{ }} auto-escapes; fund.name is never bound via v-html -->
          <h1 class="text-lg md:text-2xl font-extrabold mt-1 txt truncate" :title="fund.name">{{ fund.name }}</h1>
          <p class="text-xs sub mt-0.5 truncate">
            {{ fund.amc }}<template v-if="fund.master"> · Master Fund: {{ fund.master }}</template>
          </p>
        </div>
      </div>

      <!-- Key statistics -->
      <div class="grid grid-cols-3 gap-4 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-[var(--line)]">
        <div class="px-4">
          <div class="text-[10px] sub font-bold uppercase tracking-wider">NAV</div>
          <div class="num text-xl md:text-2xl font-extrabold txt mt-0.5">{{ fund.nav.toFixed(4) }}</div>
          <div class="mt-0.5 text-xs font-semibold num" :class="dailyChange.diffBaht >= 0 ? 'text-emerald-600' : 'text-rose-500'">
            {{ dailyChange.diffBaht >= 0 ? '+' : '' }}{{ dailyChange.diffBaht.toFixed(4) }}
            ({{ dailyChange.diffBaht >= 0 ? '+' : '' }}{{ dailyChange.diffPct.toFixed(2) }}%)
          </div>
        </div>
        <div class="px-4 border-l border-[var(--line)]">
          <div class="text-[10px] sub font-bold uppercase tracking-wider">1Y Return</div>
          <div class="text-xl md:text-2xl font-extrabold mt-0.5 num" :class="fund.perf >= 0 ? 'text-emerald-600' : 'text-rose-500'">
            {{ fund.perf >= 0 ? '+' : '' }}{{ fund.perf }}%
          </div>
        </div>
        <div class="px-4 border-l border-[var(--line)]">
          <div class="text-[10px] sub font-bold uppercase tracking-wider">ขนาดกองทุน (AUM)</div>
          <div class="num text-xl md:text-2xl font-extrabold mt-0.5" :style="{ color: accent }">
            {{ fund.aum.toLocaleString('th-TH') }} <span class="text-xs font-medium sub">ล้านบ.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick info columns -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8 border-b border-[var(--line)]">
      <div class="lg:col-span-2">
        <h2 class="text-base font-extrabold txt mb-3">ข้อมูลกองทุน</h2>
        <h3 class="text-xs font-bold sub uppercase tracking-wide mb-2">กลยุทธ์การลงทุน</h3>
        <ul class="list-disc pl-5 text-xs md:text-sm txt/90 space-y-2 leading-relaxed">
          <li v-for="(bullet, idx) in policyBullets" :key="idx">{{ bullet }}</li>
        </ul>
        <div class="flex flex-wrap gap-1.5 mt-4">
          <span
            v-for="tag in fund.themes"
            :key="tag"
            class="text-[10px] font-bold px-2 py-0.5 rounded-full"
            :style="{ backgroundColor: `${accent}1a`, color: accent }"
          >#{{ tag }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs lg:border-l border-[var(--line)] lg:pl-8">
        <div>
          <h4 class="sub font-bold uppercase tracking-wider text-[10px]">นโยบายการจ่ายปันผล</h4>
          <p class="font-normal txt mt-1 leading-snug text-xs md:text-sm">
            {{ fund.div > 0 ? `จ่ายเงินปันผล (เฉลี่ย ${fund.div.toFixed(2)}%)` : 'ไม่มีนโยบายการจ่ายเงินปันผล (เป็นแบบสะสมมูลค่า)' }}
          </p>
        </div>
        <div>
          <h4 class="sub font-bold uppercase tracking-wider text-[10px]">FX HEDGING</h4>
          <p class="font-normal txt mt-1 leading-snug text-xs md:text-sm">{{ fund.fx || '-' }}</p>
        </div>
        <div>
          <h4 class="sub font-bold uppercase tracking-wider text-[10px]">วันที่จดทะเบียนจัดตั้งกองทุน</h4>
          <p class="font-normal txt mt-1 leading-snug text-xs md:text-sm">วันที่ {{ registrationDate }}</p>
        </div>
        <div>
          <h4 class="sub font-bold uppercase tracking-wider text-[10px]">TURNOVER RATIO</h4>
          <p class="num font-normal txt mt-1 leading-snug text-xs md:text-sm">{{ turnoverRatio }}</p>
        </div>
        <div>
          <h4 class="sub font-bold uppercase tracking-wider text-[10px]">ราคารับซื้อคืน (BID) บาท/หน่วย</h4>
          <p class="num font-normal txt mt-1 leading-snug text-xs md:text-sm">{{ bidPrice.toFixed(4) }}</p>
        </div>
        <div>
          <h4 class="sub font-bold uppercase tracking-wider text-[10px]">ราคาขาย (OFFER) บาท/หน่วย</h4>
          <p class="num font-normal txt mt-1 leading-snug text-xs md:text-sm">{{ offerPrice.toFixed(4) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
