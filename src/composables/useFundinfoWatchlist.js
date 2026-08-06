import { computed, reactive } from 'vue'
import { FUNDS } from '../data/fundinfoData'

// Same localStorage key as the original fundinfo v3.2.1 prototype ("pins").
const STORAGE_KEY = 'fi321-pins'

function readInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (Array.isArray(saved)) return saved
  } catch (e) {
    /* ignore malformed / missing storage */
  }
  return []
}

// Module-scoped (singleton) reactive state — shared by every component that
// calls useFundinfoWatchlist(), so the header ⭐ button and star icons inside
// each fund table stay in sync without a global store library.
const pinnedIds = reactive(new Set(readInitial()))

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinnedIds]))
  } catch (e) {
    /* ignore write failures */
  }
}

export function useFundinfoWatchlist() {
  const count = computed(() => pinnedIds.size)

  const watchedFunds = computed(() => FUNDS.filter((fund) => pinnedIds.has(fund.id)))

  function isWatched(id) {
    return pinnedIds.has(id)
  }

  function toggleWatch(id) {
    if (pinnedIds.has(id)) {
      pinnedIds.delete(id)
    } else {
      pinnedIds.add(id)
    }
    persist()
  }

  function removeWatch(id) {
    if (pinnedIds.has(id)) {
      pinnedIds.delete(id)
      persist()
    }
  }

  function clearWatch() {
    pinnedIds.clear()
    persist()
  }

  return { count, watchedFunds, isWatched, toggleWatch, removeWatch, clearWatch }
}