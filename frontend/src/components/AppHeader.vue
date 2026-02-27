<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getStoredAuthToken, getStoredAuthUser } from '../services/authService'

const router = useRouter()
const route = useRoute()

const isSearchOpen = ref(false)
const searchText = ref('')
const searchInputEl = ref(null)
const authToken = ref('')
const authUser = ref(null)
const headerLogoSrc = '/pokedexlogo.png'
const SEARCH_DEBOUNCE_MS = 180
let searchDebounceTimer = null

const isAuthenticated = computed(() => Boolean(authToken.value))
const isHomeRoute = computed(() => route.path === '/')
const accountTargetPath = computed(() => (isAuthenticated.value ? '/profil' : '/connexion'))
const accountLabel = computed(() => {
  if (!isAuthenticated.value) return 'Connexion'
  const username = String(authUser.value?.username || '').trim()
  return username ? `Profil ${username}` : 'Profil'
})
const userInitial = computed(() => {
  const username = String(authUser.value?.username || '').trim()
  return username ? username[0].toUpperCase() : null
})

const normalizeQuery = (value) => String(value || '').trim()

const syncAuthState = () => {
  authToken.value = getStoredAuthToken()
  authUser.value = getStoredAuthUser()
}

const syncSearchFromRoute = () => {
  searchText.value = normalizeQuery(route.query.q)
}

const focusSearchInput = async () => {
  await nextTick()
  searchInputEl.value?.focus()
}

const buildSearchQuery = () => {
  const trimmed = normalizeQuery(searchText.value)
  return trimmed ? { q: trimmed } : {}
}

const applySearch = async ({ replace = false } = {}) => {
  const query = buildSearchQuery()
  const nextQuery = normalizeQuery(query.q)
  const currentQuery = normalizeQuery(route.query.q)
  if (isHomeRoute.value && nextQuery === currentQuery) return

  const method = replace ? router.replace : router.push
  await method({ path: '/', query })
}

const clearSearchDebounce = () => {
  if (!searchDebounceTimer) return
  window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = null
}

const handleHomeClick = async () => {
  clearSearchDebounce()
  isSearchOpen.value = false
  await router.push('/')
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const handleSearchButtonClick = async () => {
  if (!isSearchOpen.value) {
    isSearchOpen.value = true
    await focusSearchInput()
    return
  }
  clearSearchDebounce()
  isSearchOpen.value = false
  searchText.value = ''
  applySearch({ replace: true })
}

const handleSearchSubmit = async () => {
  await applySearch()
}

const handleSearchInput = () => {
  if (!isHomeRoute.value) return
  clearSearchDebounce()
  searchDebounceTimer = window.setTimeout(() => {
    void applySearch({ replace: true })
    searchDebounceTimer = null
  }, SEARCH_DEBOUNCE_MS)
}

const handleAccountClick = async () => {
  clearSearchDebounce()
  isSearchOpen.value = false
  await router.push(accountTargetPath.value)
}

onMounted(() => {
  syncAuthState()
  syncSearchFromRoute()
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('focus', syncAuthState)
  }
})

onBeforeUnmount(() => {
  clearSearchDebounce()
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', syncAuthState)
    window.removeEventListener('focus', syncAuthState)
  }
})

watch(
  () => route.query.q,
  () => {
    syncSearchFromRoute()
  },
  { immediate: true }
)
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <!-- Logo -->
      <button
        type="button"
        class="app-header__logo-btn"
        aria-label="Accueil"
        @click="handleHomeClick"
      >
        <img
          class="app-header__logo-image"
          :src="headerLogoSrc"
          alt="Pokedex"
          loading="eager"
          decoding="async"
        />
      </button>

      <!-- Center glass screen -->
      <div class="app-header__screen">
        <div class="app-header__screen-inner">
          <form class="app-header__search" @submit.prevent="handleSearchSubmit">
            <Transition name="search-slide">
              <label
                v-show="isSearchOpen"
                class="app-header__search-label"
                for="header-name-search"
              >
                <svg class="app-header__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2"/>
                  <path d="M15 15l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <input
                  id="header-name-search"
                  ref="searchInputEl"
                  v-model="searchText"
                  type="search"
                  placeholder="Rechercher un Pokémon…"
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                  @input="handleSearchInput"
                  @keydown.esc="handleSearchButtonClick"
                />
              </label>
            </Transition>
          </form>

          <!-- Screen dots decoration -->
          <div class="app-header__screen-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <!-- Right actions -->
      <div class="app-header__actions">
        <!-- Home button -->
        <button
          type="button"
          class="app-header__icon-btn"
          :class="{ active: isHomeRoute }"
          aria-label="Accueil"
          title="Accueil"
          @click="handleHomeClick"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M9 21V12h6v9" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Search button -->
        <button
          type="button"
          class="app-header__icon-btn"
          :class="{ active: isSearchOpen }"
          aria-label="Rechercher un Pokémon"
          title="Rechercher un Pokémon"
          @click="handleSearchButtonClick"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2"/>
            <path d="M16 16l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Account button -->
        <button
          type="button"
          class="app-header__icon-btn app-header__account-btn"
          :class="{ logged: isAuthenticated }"
          :aria-label="accountLabel"
          :title="accountLabel"
          @click="handleAccountClick"
        >
          <span v-if="isAuthenticated && userInitial" class="app-header__avatar">
            {{ userInitial }}
          </span>
          <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- LED indicators -->
    <div class="app-header__leds" aria-hidden="true">
      <span class="led led-red"></span>
      <span class="led led-yellow"></span>
      <span class="led led-green"></span>
    </div>
  </header>
</template>

<style scoped>
/* =============================================
   APP HEADER – Kalos Pokédex Style
   ============================================= */

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  padding: 10px clamp(10px, 2vw, 24px) 0;
  pointer-events: none;
  transition: opacity 220ms ease, transform 240ms ease;
}

.app-header__inner {
  width: min(100%, 1680px);
  margin: 0 auto;
  min-height: 88px;
  border-radius: 22px;
  background: linear-gradient(135deg, #b81425 0%, #c92030 40%, #a8101e 100%);
  box-shadow: 0 4px 24px rgba(120, 5, 20, 0.55), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.3);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 0 clamp(12px, 1.6vw, 28px);
  pointer-events: auto;
  position: relative;
  overflow: hidden;
}

/* Pokéball texture overlay */
.app-header__inner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='20' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1.5'/%3E%3Ccircle cx='30' cy='30' r='5' fill='none' stroke='rgba(255,255,255,0.08)' stroke-width='1'/%3E%3Cpath d='M10 30h40' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3C/svg%3E") repeat;
  background-size: 60px 60px;
  border-radius: inherit;
  pointer-events: none;
}

/* Gloss top highlight */
.app-header__inner::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%);
  border-radius: 22px 22px 0 0;
  pointer-events: none;
}

/* Logo */
.app-header__logo-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  position: relative;
  z-index: 1;
}

.app-header__logo-image {
  width: auto;
  height: clamp(44px, 4vw, 62px);
  display: block;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
}

/* === CENTER GLASS SCREEN === */
.app-header__screen {
  position: relative;
  z-index: 1;
  height: clamp(52px, 5.5vw, 68px);
  display: flex;
  align-items: center;
}

.app-header__screen-inner {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(100, 200, 240, 0.22) 0%, rgba(60, 160, 220, 0.15) 50%, rgba(80, 190, 245, 0.20) 100%);
  backdrop-filter: blur(14px) saturate(1.8) brightness(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.8) brightness(1.2);
  border: 1px solid rgba(140, 220, 255, 0.40);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.4),
    inset 0 -1px 0 rgba(0,0,0,0.2),
    0 4px 16px rgba(40,160,240,0.18);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  overflow: hidden;
  position: relative;
}

/* Scanline effect */
.app-header__screen-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(255,255,255,0.03) 3px,
    rgba(255,255,255,0.03) 4px
  );
  pointer-events: none;
  border-radius: inherit;
}

/* Gloss shimmer */
.app-header__screen-inner::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%);
  border-radius: 14px 14px 0 0;
  pointer-events: none;
}

.app-header__search {
  flex: 1;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
}

.app-header__search-label {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.app-header__search-icon {
  width: 18px;
  height: 18px;
  color: rgba(200, 240, 255, 0.85);
  flex-shrink: 0;
}

.app-header__search-label input {
  flex: 1;
  border: 0;
  background: transparent;
  color: #e8f8ff;
  font-family: 'Poppins', sans-serif;
  font-size: 0.9rem;
  outline: none;
  caret-color: rgba(140, 220, 255, 0.9);
}

.app-header__search-label input::placeholder {
  color: rgba(180, 230, 255, 0.55);
}

/* Search slide transition */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Screen decorative dots */
.app-header__screen-dots {
  display: flex;
  align-items: center;
  gap: 5px;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.app-header__screen-dots span {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(140, 220, 255, 0.55);
  box-shadow: 0 0 4px rgba(100, 200, 255, 0.6);
  animation: dot-pulse 2.2s ease-in-out infinite;
}

.app-header__screen-dots span:nth-child(2) { animation-delay: 0.4s; }
.app-header__screen-dots span:nth-child(3) { animation-delay: 0.8s; }

@keyframes dot-pulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 8px rgba(100,200,255,0.9); }
}

/* === RIGHT ACTIONS === */
.app-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(6px, 0.8vw, 12px);
  position: relative;
  z-index: 1;
}

.app-header__icon-btn {
  width: clamp(44px, 3.2vw, 54px);
  aspect-ratio: 1 / 1;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255,255,255,0.85);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 160ms ease, background-color 200ms ease, box-shadow 200ms ease;
  border: 1px solid rgba(255,255,255,0.12);
}

.app-header__icon-btn svg {
  width: clamp(20px, 1.5vw, 26px);
  height: clamp(20px, 1.5vw, 26px);
}

.app-header__icon-btn:hover,
.app-header__icon-btn:focus-visible {
  background: rgba(255,255,255,0.18);
  box-shadow: 0 0 12px rgba(255,255,255,0.2);
  color: #fff;
  outline: none;
}

.app-header__icon-btn:active {
  transform: scale(0.92);
}

.app-header__icon-btn.active {
  background: rgba(255,255,255,0.22);
  box-shadow: 0 0 14px rgba(255,255,255,0.25), inset 0 1px 0 rgba(255,255,255,0.3);
  color: #fff;
}

/* Account button logged-in style */
.app-header__account-btn.logged {
  background: rgba(255, 200, 50, 0.25);
  border-color: rgba(255, 220, 80, 0.4);
  color: #ffd060;
}

.app-header__account-btn.logged:hover {
  background: rgba(255, 200, 50, 0.35);
  box-shadow: 0 0 12px rgba(255, 200, 50, 0.3);
}

.app-header__avatar {
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
}

/* === LED indicators === */
.app-header__leds {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 4px 0 0;
  width: min(100%, 1680px);
  margin: 0 auto;
}

.led {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}

.led-red {
  background: #ff4060;
  color: #ff4060;
  animation: led-blink 3s ease-in-out infinite;
}

.led-yellow {
  background: #ffd040;
  color: #ffd040;
  animation: led-blink 3s ease-in-out infinite 1s;
}

.led-green {
  background: #40e080;
  color: #40e080;
  animation: led-blink 3s ease-in-out infinite 2s;
}

@keyframes led-blink {
  0%, 90%, 100% { opacity: 1; }
  95% { opacity: 0.4; }
}

/* =============================================
   RESPONSIVE
   ============================================= */
@media (max-width: 1100px) {
  .app-header__inner {
    min-height: 78px;
    border-radius: 18px;
  }
}

@media (max-width: 760px) {
  .app-header {
    padding: 8px 10px 0;
    z-index: 10;
  }

  .app-header__inner {
    min-height: auto;
    border-radius: 14px;
    padding: 8px 10px;
    gap: 8px;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "logo actions"
      "search search";
  }

  .app-header__logo-btn {
    grid-area: logo;
    justify-self: start;
  }

  .app-header__logo-image {
    height: clamp(34px, 9vw, 40px);
  }

  .app-header__actions {
    grid-area: actions;
    gap: 5px;
  }

  .app-header__icon-btn {
    width: 40px;
  }

  .app-header__screen {
    grid-area: search;
    height: 40px;
    width: 100%;
    margin-bottom: 2px;
  }

  .app-header__screen-dots {
    display: none;
  }

  .app-header__leds {
    gap: 6px;
  }

  .led {
    width: 8px;
    height: 8px;
  }
}
</style>
