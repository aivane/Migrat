<script setup>
import { FUND_TYPES } from '../../data/fundinfoData'
import ExposureTrendSection from '../../components/fundinfo/ExposureTrendSection.vue'
import RankingCardsSection from '../../components/fundinfo/RankingCardsSection.vue'
import InsightCompareSection from '../../components/fundinfo/InsightCompareSection.vue'
import SearchFilterSection from '../../components/fundinfo/SearchFilterSection.vue'
import FundTableWithCompare from '../../components/fundinfo/FundTableWithCompare.vue'

const meta = FUND_TYPES.thai
</script>

<template>
  <div class="fund-workspace space-y-9">
    <div class="fund-page-title">
      <h1>{{ meta.label }}</h1>
      <p>{{ meta.sub }}</p>
    </div>

    <ExposureTrendSection type="thai" />
    <RankingCardsSection type="thai" />
    <InsightCompareSection type="thai" />

    <div class="fund-screener-anchor">
      <SearchFilterSection type="thai" />
      <FundTableWithCompare type="thai" />
    </div>
  </div>
</template>
