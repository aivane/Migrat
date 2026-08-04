<script setup>
defineProps({
  fund: { type: Object, required: true },
  colspan: { type: Number, default: 6 },
})
</script>

<template>
  <tr class="detail-row">
    <td :colspan="colspan">
      <div class="detail-grid">
        <div>
          <h3>Top Holdings</h3>
          <ul class="detail-list">
            <li v-for="item in fund.top5" :key="item.name">
              <span>{{ item.name }}</span>
              <strong>{{ item.percent.toFixed(1) }}%</strong>
            </li>
          </ul>
        </div>
        <div>
          <h3>โครงสร้างพอร์ต</h3>
          <ul class="detail-list">
            <li v-for="item in (fund.mix || fund.asset)" :key="item.name">
              <span>{{ item.name }}</span>
              <strong>{{ item.percent.toFixed(1) }}%</strong>
            </li>
          </ul>
        </div>
        <div v-if="fund.themes?.length">
          <h3>ธีมการลงทุน</h3>
          <div class="detail-tags">
            <span v-for="theme in fund.themes" :key="theme" class="tag">{{ theme }}</span>
          </div>
        </div>
      </div>
    </td>
  </tr>
</template>

<style scoped>
.detail-row td {
  background: var(--surface-soft);
  white-space: normal;
  text-align: left;
  cursor: default;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  padding: 6px 4px;
}

.detail-grid h3 {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.detail-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.detail-list li strong {
  color: var(--text);
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--surface);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}
</style>
