<script setup>
import { FUND_TYPES } from '../../data/fundinfoData'
import ExposureTrendSection from '../../components/fundinfo/ExposureTrendSection.vue'
import RankingCardsSection from '../../components/fundinfo/RankingCardsSection.vue'
import InsightCompareSection from '../../components/fundinfo/InsightCompareSection.vue'
import SearchFilterSection from '../../components/fundinfo/SearchFilterSection.vue'
import FundTableWithCompare from '../../components/fundinfo/FundTableWithCompare.vue'

const meta = FUND_TYPES.offshore
</script>

<template>
  <div class="fund-workspace space-y-9">
    <!-- Page Title — ตรงกับ Image 3 -->
    <div class="fund-page-title">
      <h1>{{ meta.label }}</h1>
      <p>{{ meta.sub }}</p>
    </div>

    <!-- Section ① — Exposure & Trend (Image 3) -->
    <ExposureTrendSection type="offshore" />

    <!-- Section ② — Ranking Cards + Insight Compare (Image 4) -->
    <RankingCardsSection type="offshore" />
    <InsightCompareSection type="offshore" />

    <!-- Section ③ — Search/Filter + Fund Table Compare (Image 5) -->
    <SearchFilterSection type="offshore" />
    <FundTableWithCompare type="offshore" />
  </div>
</template>
