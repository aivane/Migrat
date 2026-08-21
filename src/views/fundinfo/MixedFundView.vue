<script setup>
import { FUND_TYPES } from '../../data/fundinfoData'
import MarketLensSection from '../../components/fundinfo/MarketLensSection.vue'
import RankingCardsSection from '../../components/fundinfo/RankingCardsSection.vue'
import InsightCompareSection from '../../components/fundinfo/InsightCompareSection.vue'
import SearchFilterSection from '../../components/fundinfo/SearchFilterSection.vue'
import FundTableWithCompare from '../../components/fundinfo/FundTableWithCompare.vue'

const meta = FUND_TYPES.mixed
</script>

<template>
  <div class="fund-workspace space-y-9 pb-24">
    <div class="fund-page-title">
      <h1>{{ meta.label }}</h1>
      <p>{{ meta.sub }}</p>
    </div>

    <!-- ① Market Lens Section -->
    <MarketLensSection type="mixed" />

    <!-- ② Ranking Cards Section -->
    <RankingCardsSection type="mixed" />

    <!-- ③ Insight Compare Section -->
    <InsightCompareSection type="mixed" />

    <!-- ④ Search & Filter Section -->
    <SearchFilterSection type="mixed" />

    <!-- ⑤ ตารางหลักพร้อมคอลัมน์เลือกเปรียบเทียบ, ตารางเปรียบเทียบ Matrix, และการ์ดรายละเอียดกองทุน -->
    <FundTableWithCompare type="mixed" />
  </div>
</template>
