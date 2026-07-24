<script setup>
import { RouterLink } from 'vue-router'

const featureCards = [
  {
    to: '/dashboard',
    image: 'search',
    title: 'ค้นหากองทุนไทยและต่างประเทศ',
    text: 'ค้นหากองทุนจากชื่อกองทุน บริษัทจัดการ หรือประเภทสินทรัพย์พร้อมข้อมูลผลตอบแทน ความเสี่ยง และรายละเอียดสำคัญได้ทันที',
  },
  {
    to: '/insights',
    image: 'mobile',
    title: 'เครื่องมือวิเคราะห์ตลาด',
    text: 'ค้นหาหุ้นที่มีแนวโน้มแข็งแรงจากการวิเคราะห์ Trend, Popularity และ Valuation เพื่อช่วยค้นหาโอกาสการลงทุนที่น่าสนใจในตลาด',
    button: 'ดูข้อมูลเชิงลึกการลงทุน',
  },
  {
    to: '/insights',
    image: 'compare',
    title: 'บทวิเคราะห์และข่าวสาร',
    text: 'ติดตามข่าวสารและบทวิเคราะห์ตลาดลงทุนแบบเข้าใจง่ายพร้อมข้อมูลเชิงลึกที่ช่วยให้คุณวางแผนลงทุนได้อย่างมั่นใจมากขึ้น',
    button: 'อ่านบทความเลย',
  },
]

</script>

<template>
  <main class="idea-home">
    <section class="idea-hero">
      <div class="idea-hero-copy">
        <h1>ลงทุนกองทุนไทยและทั่วโลก</h1>
        <p>เลือกกองทุนไทยที่จะพาคุณไปลงทุนสู่ตลาดโลกพร้อมข้อมูลที่ครบครัน วิเคราะห์ง่าย</p>
        <RouterLink class="idea-primary" to="/dashboard">เริ่มค้นหากองทุน</RouterLink>
      </div>

      <div class="idea-world-illus" aria-hidden="true">
        <div class="idea-world-map"></div>
        <div class="idea-globe"></div>
        <span class="idea-pin pin-red"></span>
        <span class="idea-pin pin-green"></span>
        <span class="idea-pin pin-yellow"></span>
        <span class="idea-chart chart-left"></span>
        <span class="idea-chart chart-right"></span>
        <span class="idea-chart chart-top"></span>
      </div>
    </section>

    <section class="idea-feature-grid" aria-label="บริการหลัก">
      <article v-for="card in featureCards" :key="card.title" class="idea-feature-card">
        <div class="idea-card-visual" :class="`idea-card-${card.image}`" aria-hidden="true">
          <span></span>
          <i></i>
          <b></b>
        </div>
        <h2>{{ card.title }}</h2>
        <p>{{ card.text }}</p>
        <RouterLink v-if="card.button" class="idea-card-button" :to="card.to">
          {{ card.button }} <span>→</span>
        </RouterLink>
      </article>
    </section>

    <footer class="idea-footer"></footer>
  </main>
</template>
