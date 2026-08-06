<script setup>
import { FUND_TYPES } from '../../data/fundinfoData'
import MarketLensSection from '../../components/fundinfo/MarketLensSection.vue'
import RankingCardsSection from '../../components/fundinfo/RankingCardsSection.vue'
import InsightCompareSection from '../../components/fundinfo/InsightCompareSection.vue'
import SearchfilterSection from '../../components/fundinfo/SearchfilterSection.vue'
import FundTableWithCompare from '../../components/fundinfo/FundTableWithCompare.vue'

const meta = FUND_TYPES.mixed
</script>

<template>
  <div class="space-y-6 pb-24">
    <div>
      <h1 class="text-xl font-bold txt">Mixed Fund</h1>
      <p class="text-xs sub">สำรวจโครงสร้างกองทุนที่ผสมหลายสินทรัพย์ไว้ในพอร์ตเดียว</p>
    </div>

    <!-- ① Market Lens Section -->
    <MarketLensSection type="mixed" />

    <!-- ② Ranking Cards Section -->
    <RankingCardsSection type="mixed" />

    <!-- ③ Insight Compare Section -->
    <InsightCompareSection type="mixed" />

    <!-- ④ Search & Filter Section -->
    <SearchfilterSection type="mixed" />

    <!-- ⑤ ตารางหลักพร้อมคอลัมน์เลือกเปรียบเทียบ, ตารางเปรียบเทียบ Matrix, และการ์ดรายละเอียดกองทุน -->
    <FundTableWithCompare type="mixed" />
  </div>
</template>