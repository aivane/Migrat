<script setup>
import { ref } from 'vue'
import { formatPercent } from '../../utils/fundinfoFormat'

defineProps({
  selectedFunds: { type: Array, default: () => [] },
})

defineEmits(['clear-all', 'remove-fund'])

const collapsed = ref(false)

function fundType(fund) {
  return { thai: 'Thai Fund', offshore: 'Offshore Fund', feeder: 'Feeder Fund', mixed: 'Mixed Fund' }[fund.type] || 'Fund'
}
</script>

<template>
  <section v-if="selectedFunds.length" class="fund-matrix">
    <header class="fund-matrix-heading">
      <button type="button" class="fund-matrix-title" @click="collapsed = !collapsed">
        <span :class="{ collapsed }">⌄</span> เปรียบเทียบกองทุนที่เลือก ({{ selectedFunds.length }})
      </button>
      <button type="button" class="fund-matrix-clear" @click="$emit('clear-all')">ล้าง ×</button>
    </header>

    <div v-if="!collapsed" class="overflow-x-auto">
      <!-- Layout Fix: table-fixed บังคับให้ browser ใช้ความกว้างคอลัมน์จาก <th> แถวแรกเท่านั้น
           ไม่คำนวณจากความยาว content ในแต่ละแถว (เดิมไม่มี table-fixed ทำให้ความกว้างคอลัมน์
           สั่นไหว/ไม่ตรงกันทุกครั้งที่ selectedFunds เปลี่ยน เช่น ชื่อกอง/ตัวเลข drawdown ยาวไม่เท่ากัน) -->
      <table class="fund-matrix-table table-fixed w-full">
        <thead>
          <tr>
            <!-- คอลัมน์ label ตรึงความกว้างคงที่ -->
            <th class="w-[130px]">ข้อมูล</th>
            <!-- คอลัมน์กองทุนหารความกว้างที่เหลือเท่า ๆ กันตามจำนวนกองที่เลือก (1-3 กอง)
                 กัน layout shift ตอนเพิ่ม/ลบกองทุนออกจากตารางเปรียบเทียบ -->
            <th
              v-for="fund in selectedFunds"
              :key="fund.id"
              class="relative"
              :style="{ width: `calc((100% - 130px) / ${selectedFunds.length})` }"
            >
              <!-- Anti-XSS: ใช้ text interpolation ({{ }}) เท่านั้น ไม่มี v-html ในไฟล์นี้ Vue auto-escape ให้อยู่แล้ว -->
              <b>{{ fund.id }}</b>
              <small>{{ fund.amc }}</small>
              <button type="button" :aria-label="`นำ ${fund.id} ออก`" @click="$emit('remove-fund', fund.id)">×</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr><th>ประเภท</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fundType(fund) }}</td></tr>
          <tr><th>1Y Return</th><td v-for="fund in selectedFunds" :key="fund.id" :class="fund.perf >= 0 ? 'positive' : 'negative'">{{ formatPercent(fund.perf, 1) }}</td></tr>
          <tr><th>Sharpe Ratio</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.sharpe?.toFixed(2) || '-' }}</td></tr>
          <tr><th>Max Drawdown</th><td v-for="fund in selectedFunds" :key="fund.id" class="negative">{{ fund.drawdown || '-' }}</td></tr>
          <tr><th>เงินปันผล</th><td v-for="fund in selectedFunds" :key="fund.id" class="positive">{{ fund.div?.toFixed(1) || '0.0' }}%</td></tr>
          <tr><th>TER (ค่าธรรมเนียม)</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.fee?.toFixed(2) || '-' }}%</td></tr>
          <tr><th>Master Fund</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.master || '-' }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>