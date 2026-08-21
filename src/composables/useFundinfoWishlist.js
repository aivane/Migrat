import { computed, reactive } from 'vue'
import { isValidFundId } from '../services/fundinfoApi'
import { useFundinfoStore } from '../stores/fundinfoStore'

// Same localStorage key as the original fundinfo v3.2.1 prototype ("pins").
const STORAGE_KEY = 'fi321-pins'
// Storage Hardening — cap entry count so tampered/bloated storage can't grow unbounded
const MAX_PINS = 200

// Input Validation — localStorage is attacker-writable (devtools, other tabs,
// a compromised extension). Never trust its shape: parse defensively and keep
// only values matching the same id pattern the API layer accepts.
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

// Module-scoped (singleton) reactive state — shared by every component that
// calls useFundinfoWishlist(), so the header ⭐ button and star icons inside
// each fund table stay in sync without a global store library.
const pinnedIds = reactive(new Set(readInitial()))

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinnedIds]))
  } catch (e) {
    /* ignore write failures */
  }
}

export function useFundinfoWishlist() {
  // Pins can span any of the 4 fund types, so resolve each id individually
  // through fundinfoStore.loadFundById (store-backed -> fundinfoApi.js) rather
  // than importing FUNDS directly — same switch point as everything else once
  // VITE_FUNDINFO_API_MODE flips to a real backend. loadFundById caches per id,
  // so calling it for already-loaded ids here is a cheap no-op.
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
    // Input Validation — reject anything that doesn't look like a real fund id
    // before it ever reaches the Set/localStorage
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
