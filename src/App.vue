<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'

const route = useRoute()
const showSiteHeader = computed(() => !route.path.startsWith('/fundinfo'))
</script>

<template>
  <AppHeader v-if="showSiteHeader" />
  <RouterView />
</template>
