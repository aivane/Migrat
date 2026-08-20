<!-- src/components/fundinfo/detail/FundFeesPanel.vue -->
<script setup>
// Ported from "Panel 4: ค่าธรรมเนียม" (tab-fees) in the v3.2.1 HTML
// prototype. Purely presentational and static (no charts, no local toggle
// state) — every value is already-derived by useFundAnalytics(fundRef) and
// injected as the `feeSchedule` prop, same "presentation only" contract as
// FundDetailHeader.vue.
defineProps({
  fund: { type: Object, required: true },
  accent: { type: String, required: true },
  // { frontEndProspectus, frontEndActual, backEndProspectus, backEndActual,
  //   switchInProspectus, switchInActual, switchOutProspectus, switchOutActual,
  //   managementProspectus, managementActual, terProspectus, terActual }
  // — from useFundAnalytics(fundRef).feeSchedule
  feeSchedule: { type: Object, required: true },
})

// Input validation: fund.minInvest comes from trusted app data, but guard
// with Number(...) so a stray string/undefined never breaks toLocaleString.
function formatBaht(n) {
  return `${Number(n || 0).toLocaleString('en-US')} บาท`
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <!-- Layout Fix: max-w-2xl (672px) was the actual cause of the cut-off column —
         too narrow for a 3-column fee table with long Thai labels. Widened to
         max-w-4xl (896px), still centered via mx-auto. -->
    <div class="max-w-4xl mx-auto w-full">
      <div class="mb-8">
        <h3 class="text-base font-bold txt border-b border-[var(--line)] pb-3 mb-4 text-center">รายละเอียดการซื้อ</h3>
        <div class="divide-y divide-[var(--line)] text-sm font-semibold">
          <div class="flex justify-between py-3.5">
            <span class="sub">มูลค่าขั้นต่ำของการซื้อครั้งแรก</span>
            <span class="num txt font-medium text-base">{{ formatBaht(fund.minInvest) }}</span>
          </div>
          <div class="flex justify-between py-3.5">
            <span class="sub">มูลค่าขั้นต่ำของการซื้อครั้งต่อไป</span>
            <span class="num txt font-medium text-base">1 บาท</span>
          </div>
        </div>
      </div>

      <div class="border-t border-[var(--line)] pt-6">
        <h3 class="text-base font-bold txt mb-4 text-center">ค่าธรรมเนียม</h3>
        <!-- Layout Fix: overflow-x-auto → table-fixed + explicit <th> widths, same
             pattern as FundPerformancePanel.vue's comparison tables. Label column
             text now wraps within its own w-3/5 track instead of forcing the row
             wider than the max-w-2xl container, so no horizontal scrollbar and the
             right-hand "เก็บจริง" column is never cut off. -->
        <div class="brd rounded-xl overflow-hidden">
          <table class="w-full text-sm text-left table-fixed">
            <thead>
              <tr class="sub font-bold border-b border-[var(--line)]">
                <th class="py-3 w-1/2">รายการ</th>
                <th class="py-3 text-right w-1/4">ตามหนังสือชี้ชวน</th>
                <th class="py-3 text-right w-1/4">เก็บจริง</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--line)] num">
              <tr class="txt">
                <td class="py-3.5 font-medium">ค่าธรรมเนียมเมื่อซื้อหน่วยลงทุน (Front-end Fee)</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.frontEndProspectus }}</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.frontEndActual }}</td>
              </tr>
              <tr class="txt">
                <td class="py-3.5 font-medium">ค่าธรรมเนียมการรับซื้อคืนหน่วยลงทุน (Back-end Fee)</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.backEndProspectus }}</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.backEndActual }}</td>
              </tr>
              <tr class="txt">
                <td class="py-3.5 font-medium">ค่าธรรมเนียมการสับเปลี่ยนหน่วยลงทุนเข้า (Switching-in Fee)</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.switchInProspectus }}</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.switchInActual }}</td>
              </tr>
              <tr class="txt">
                <td class="py-3.5 font-medium">ค่าธรรมเนียมการสับเปลี่ยนหน่วยลงทุนออก (Switching-out Fee)</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.switchOutProspectus }}</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.switchOutActual }}</td>
              </tr>
              <tr class="txt">
                <td class="py-3.5 font-medium">ค่าธรรมเนียมการจัดการ (Management Fee)</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.managementProspectus }}</td>
                <td class="py-3.5 text-right font-medium">{{ feeSchedule.managementActual }}</td>
              </tr>
              <!-- TER row highlighted with the fund-type accent, consistent
                   with how the rest of the app (e.g. AUM in FundDetailHeader)
                   uses `accent` rather than a hardcoded brand blue. -->
              <tr class="font-bold text-base" :style="{ color: accent }">
                <td class="py-3.5">Total Expense Ratio (ค่ารวมประมาณการ TER)</td>
                <td class="py-3.5 text-right">{{ feeSchedule.terProspectus }}</td>
                <td class="py-3.5 text-right font-extrabold">{{ feeSchedule.terActual }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>