<!-- src/components/common/InfoTooltip.vue -->
<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  label: { type: String, default: 'คำอธิบายเพิ่มเติม' },
  align: { type: String, default: 'left' }, // 'left' | 'right' | 'center'
})

const open = ref(false)
const rootEl = ref(null)
const iconEl = ref(null)
const panelEl = ref(null)
const panelStyle = ref({})
const arrowStyle = ref({})

const GAP = 8
const EDGE_PADDING = 12

async function updatePosition() {
  await nextTick()
  if (!iconEl.value || !panelEl.value) return

  const iconRect = iconEl.value.getBoundingClientRect()
  const panelRect = panelEl.value.getBoundingClientRect()

  let left
  if (props.align === 'right') {
    left = iconRect.right - panelRect.width
  } else if (props.align === 'center') {
    left = iconRect.left + iconRect.width / 2 - panelRect.width / 2
  } else {
    left = iconRect.left
  }

  const maxLeft = window.innerWidth - panelRect.width - EDGE_PADDING
  left = Math.min(Math.max(left, EDGE_PADDING), Math.max(maxLeft, EDGE_PADDING))

  const top = iconRect.bottom + GAP

  panelStyle.value = { top: `${top}px`, left: `${left}px` }
  arrowStyle.value = { left: `${iconRect.left + iconRect.width / 2 - left}px` }
}

function toggle(event) {
  event.stopPropagation()
  open.value = !open.value
}

function close() {
  open.value = false
}

function onClickOutside(event) {
  if (rootEl.value && rootEl.value.contains(event.target)) return
  if (panelEl.value && panelEl.value.contains(event.target)) return
  close()
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(open, async (value) => {
  if (value) {
    await updatePosition()
    document.addEventListener('click', onClickOutside)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  } else {
    document.removeEventListener('click', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <span ref="rootEl" class="info-tooltip" :class="[`align-${align}`, { open }]">
    <button
      ref="iconEl"
      type="button"
      class="info-tooltip-icon"
      :aria-label="label"
      :aria-expanded="open"
      @click="toggle"
    >i</button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelEl"
        class="info-tooltip-panel"
        role="tooltip"
        :style="panelStyle"
        @click.stop
      >
        <i class="info-tooltip-arrow" :style="arrowStyle"></i>
        <slot>{{ text }}</slot>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.info-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 6px;
}
.info-tooltip-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.3px solid #94a3b8;
  background: #fff;
  color: #64748b;
  font-size: 10px;
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}
.info-tooltip-icon:hover,
.info-tooltip-icon:focus-visible {
  border-color: #2563eb;
  color: #2563eb;
  outline: none;
}
.info-tooltip.open .info-tooltip-icon {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}
.info-tooltip-panel {
  position: fixed;
  z-index: 9999;
  width: max-content;
  max-width: 280px;
  background: #1e293b;
  color: #f1f5f9;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  padding: 8px 10px;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, .18);
}
.info-tooltip-arrow {
  position: absolute;
  top: -4px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  background: #1e293b;
  transform: rotate(45deg);
}
</style>