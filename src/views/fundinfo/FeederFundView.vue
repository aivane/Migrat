<script setup>
import { FUND_TYPES } from '../../data/fundinfoData'
import ThemeTrendSection from '../../components/fundinfo/ThemeTrendSection.vue'
import RankingCardsSection from '../../components/fundinfo/RankingCardsSection.vue'
import InsightCompareSection from '../../components/fundinfo/InsightCompareSection.vue'
import SearchfilterSection from '../../components/fundinfo/SearchfilterSection.vue'
import FundTableWithCompare from '../../components/fundinfo/FundTableWithCompare.vue'

const meta = FUND_TYPES.feeder
</script>

<template>
  <div class="space-y-6">
    <p class="text-xs font-semibold flex items-center gap-1.5" :style="{ color: meta.accent }">
      <span>{{ meta.emoji }}</span>
      <span>{{ meta.sub }}</span>
    </p>

    <!-- ① Analytics Sections -->
    <ThemeTrendSection type="feeder" />

    <!-- ② Ranking Cards Section -->
    <RankingCardsSection type="feeder" />

    <!-- ③ Insight Comparison Section -->
    <InsightCompareSection type="feeder" />

    <!-- ④ Search & Filter Section -->
    <SearchfilterSection type="feeder" />

    <!-- ⑤ ตารางหลักพร้อมคอลัมน์เลือกเปรียบเทียบ, ตารางเปรียบเทียบ Matrix, และการ์ดรายละเอียดกองทุน -->
    <FundTableWithCompare type="feeder" />
  </div>
</template>