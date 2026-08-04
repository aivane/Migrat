<script setup>
import { FUND_TYPES } from '../../data/fundinfoData'

const tabs = [
  { to: '/fundinfo/feeder', ...FUND_TYPES.feeder },
  { to: '/fundinfo/offshore', ...FUND_TYPES.offshore },
  { to: '/fundinfo/thai', ...FUND_TYPES.thai },
  { to: '/fundinfo/mixed', ...FUND_TYPES.mixed },
]
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-header">
      <div>
        <p class="eyebrow">Fundinfo</p>
        <h1>สำรวจกองทุนแยกตามประเภทการลงทุน</h1>
        <p class="cache-note">ข้อมูลตัวอย่างสำหรับออกแบบหน้าจอ ไม่ใช่คำแนะนำการลงทุน</p>
      </div>
      <nav class="page-links" aria-label="ประเภทกองทุน">
        <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to">
          {{ tab.emoji }} {{ tab.label }}
        </RouterLink>
      </nav>
    </section>

    <RouterView />
  </main>
</template>
