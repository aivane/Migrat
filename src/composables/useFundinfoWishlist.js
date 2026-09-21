import { computed, reactive } from 'vue'
import { isValidFundId } from '../services/fundinfoApi'
import { useFundinfoStore } from '../stores/fundinfoStore'

// Same localStorage key as the original fundinfo v3.2.1 prototype ("pins").
const STORAGE_KEY = 'fi321-pins'
// Storage Hardening — cap entry count so tampered/bloated storage can't grow unbounded
const MAX_PINS = 200

// localStorage is attacker-writable (devtools, other tabs, extensions) — parse
// defensively and keep only values matching the API's id pattern.
function readInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!Array.isArray(saved)) return []
    return saved.filter(isValidFundId).slice(0, MAX_PINS)
  } catch (e) {
    /* ignore malformed / missing storage */
  }
  return []
}

// Module-scoped singleton — shared by every useFundinfoWishlist() caller so
// the header star button and table star icons stay in sync without a store.
const pinnedIds = reactive(new Set(readInitial()))

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinnedIds]))
  } catch (e) {
    /* ignore write failures */
  }
}

export function useFundinfoWishlist() {
  // Pins can span any of the 4 fund types, so resolve each id individually via
  // fundinfoStore.loadFundById (cached per id, so re-calling for loaded ids is a no-op).
  const fundinfoStore = useFundinfoStore()
  pinnedIds.forEach((id) => fundinfoStore.loadFundById(id))

  const count = computed(() => pinnedIds.size)

  const wishedFunds = computed(() =>
    [...pinnedIds].map((id) => fundinfoStore.getFundById(id)).filter(Boolean),
  )

  function isWished(id) {
    return pinnedIds.has(id)
  }

  function toggleWish(id) {
    // Reject anything that doesn't look like a real fund id before it reaches the Set/localStorage.
    if (!isValidFundId(id)) return

    if (pinnedIds.has(id)) {
      pinnedIds.delete(id)
    } else if (pinnedIds.size < MAX_PINS) {
      pinnedIds.add(id)
      fundinfoStore.loadFundById(id)
    }
    persist()
  }

  function removeWish(id) {
    if (pinnedIds.has(id)) {
      pinnedIds.delete(id)
      persist()
    }
  }

  function clearWish() {
    pinnedIds.clear()
    persist()
  }

  return { count, wishedFunds, isWished, toggleWish, removeWish, clearWish }
}
