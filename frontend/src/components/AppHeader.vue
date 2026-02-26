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

const isAuthenticated = computed(() => Boolean(authToken.value))
const isHomeRoute = computed(() => route.path === '/')
const accountTargetPath = computed(() => (isAuthenticated.value ? '/profil' : '/connexion'))
const accountLabel = computed(() => {
  if (!isAuthenticated.value) return 'Connexion'
  const username = String(authUser.value?.username || '').trim()
  return username ? `Profil ${username}` : 'Profil'
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
  const method = replace ? router.replace : router.push
  await method({ path: '/', query })
}

const handleHomeClick = async () => {
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
  isSearchOpen.value = false
}

const handleSearchSubmit = async () => {
  await applySearch()
}

const handleSearchInput = () => {
  if (!isHomeRoute.value) return
  void applySearch({ replace: true })
}

const handleAccountClick = async () => {
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

      <div class="app-header__actions">
        <button
          type="button"
          class="app-header__icon-btn app-header__icon-home"
          :class="{ active: isHomeRoute }"
          aria-label="Accueil"
          title="Accueil"
          @click="handleHomeClick"
        >
          <svg
            class="app-header__icon-raster"
            width="53"
            height="53"
            viewBox="0 0 53 53"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            aria-hidden="true"
          >
            <rect width="53" height="53" fill="url(#pattern0_home_6_438)"/>
            <defs>
              <pattern id="pattern0_home_6_438" patternContentUnits="objectBoundingBox" width="1" height="1">
                <use xlink:href="#image0_home_6_438" transform="scale(0.0208333)"/>
              </pattern>
              <image id="image0_home_6_438" width="48" height="48" preserveAspectRatio="none" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACfklEQVR4Ae3BP2hcdQAA4C+/9wihhBLE4cDQoZZOVRq4obg0gzRprYOicEMopVTx3yI4BJwKjtXFoWIKxcGAVBE0khwhKDQOhSxF0QyhhJIWi9KhvOGsIXHw4PG8XN5d8o7LwX2fvr6+vq4a0DknMOk/C/hVBwwo3hA+xWVZn+F91BQoUqxjqOKcRmWcxxIeKUikOK9hHkc0V8Il/I5VBYjsX4yP8QkGZa3iLzwtNYgKRrCELfsQ2Z9RLOJVjb7Cy5jBszgh6xTOoIrH9iiyd5Oo4pisTbyLaTzBE3yNh5hEkBrFBfyCNXsQaV+MK/gch2StYwLfabSCeZzBiNQhTGEAy9jShkh7SvgGFzX6ARO4q7kH+ALP4biscbyARSRaFGndOBbxvKxNfIh3UJOvhln8jXEEqaOYwm3c04JIa6ZxA4dl/YGXMKt9y/gR5zAsNYwL+AfLckR2N4Jv8RaCrCVM4Dd7dw9fYgxHpQJeRBnzqGki0lwZSyhrdAVv4rH9SzCLbYzLOo4KfsYDO4js7D3cxFMancV1bCnOFn7CbUzJGsEl/IkV/xPLGsYMKppb0DkLdhbjGk7jDSTqgtQQbqHi4KrgFobUBakyTspKdF8i6yTK6oLUBjal7mBM943hjtQmNtTFUut4BZexgquo6b41nMIHKOM61tXFsuYw5+Cp4SM7iBXnPGZQsrsNvI05BQiKM4OSfKO4piBBcUpaN6ogQY+Ldc6ArG0dEPS4oMcFPS7ocUGPC3pc0ONi+RIMS20rxrZ8iRxBvqruqcoR5JtGoj33NXqoPQmm5Yjke4SbeAZHMGh393ERd2Wt4jQO212C7/E61vT19fUdaP8CVeaFffUu+QAAAAAASUVORK5CYII="/>
            </defs>
          </svg>
        </button>

        <form class="app-header__search" @submit.prevent="handleSearchSubmit">
          <label class="app-header__search-wrap" :class="{ open: isSearchOpen }" for="header-name-search">
            <input
              id="header-name-search"
              ref="searchInputEl"
              v-model="searchText"
              type="search"
              placeholder="Rechercher un pokemon"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              @input="handleSearchInput"
              @keydown.esc="isSearchOpen = false"
            />
          </label>

          <button
            type="button"
            class="app-header__icon-btn"
            :class="{ active: isSearchOpen }"
            aria-label="Rechercher un pokemon"
            title="Rechercher un pokemon"
            @click="handleSearchButtonClick"
          >
            <svg
              class="app-header__icon-raster"
              width="45"
              height="45"
              viewBox="0 0 45 45"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              aria-hidden="true"
            >
              <rect width="45" height="45" fill="url(#pattern0_search_6_440)"/>
              <defs>
                <pattern id="pattern0_search_6_440" patternContentUnits="objectBoundingBox" width="1" height="1">
                  <use xlink:href="#image0_search_6_440" transform="scale(0.0208333)"/>
                </pattern>
                <image id="image0_search_6_440" width="48" height="48" preserveAspectRatio="none" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAADzElEQVR4AdXBX2jUdQAA8M/9btQ9HLXqRw26aNCEEVI++FLuoZVJ4M/+EgQZEfQw6KUHwQJFH+opQYIRhg8VaCZ0oLRyUKFBhdAfshAWrNjDWRdcMuKCIZcULFjffX93u7m5W59PwcqkyLAFFQwgRQV1NNDADL7BJKatooLl68cYtmPE8k3hJA5hxgoVdK+EMexDv5WbwzhexawrVNCdDAcxZPXN4lUccAWKlrYHh3Gj7lzAr/gTZSQ6K2EbhnAKLctQ0F4Jh7FTew18iAl8jrpYPzYjQ4Y7tHcWj6GuSwX5SvgYI/LVsBdH0LI8W3EAd8tXwz2o6UJRvreQibWwG8/ga1y2fD/jEH7C/SgJXYf7cRSXLKEotgcvijWwA++iZeW+RxXbkAoN4E4ct4SiUIbDYlN4AN9aXRfxDrZgUGgYBZzRQWJBCQfFGtiBaVdHExnOi+3GkA4SC8YwJNTCk5h2dTWRoS5Uwh4dJOb1Y5/YyzhjbczgObFnsUkbiXlj6BeqYdzamsSnYi9pIzEvE9uLOWtvl9h2lORIkGKLUANH9MZ3+FSojBE5EmRiH6Kld06IZXIkGBGb0FuTYlvlSDAo9rnemsYFoZvkSJCK1fVeTWhAjgQ3CV2wPjTEKhZJUBGatT40xMoWSfCbUNn60C82Z5EEDaFbrQ+pWM0iCRpCfejXexWh39GySIIZsc16K8XtQg05EnwtlumtTOysHAkmxbbrrYfEJuRIMI0fhYawVW9U8IjQHCblSMw7Ifaa3ngFJaEv0JQjMe8Q5oQ2Yae1tRFPix3QRmLeDN4UO4gha6OMY+gT+gyT2kgs2I9ZoRQfoOzq6sN72Ci2SwdFC+bwF7YJpbgXVVyy+vrwNp4QO4pxHRSFvsQG3CU0iIdxCrNWTxnv4wmxc3gcl3RQFPsID6IidDOewnlMW7mNOIUR+WZxDE0dFMVamMBTuE6ojJ0YwQ+oW74KXscbGNBeigxVNLVR0F4FE7hbe5/gJCYxrb0UGbYjQ0n3pjCKuhwFnZVxBI9YWg01NNBAP1JUMGhp53AthsWmMIq6RQq6sx+7UXJ1HMUYyjiNYbEpjKLuP4q6cwbHcT02WT2f4UmM4xKaqCJDKpQiQxVN/yrq3kWcwEncgEFcY/laOI0XsAe/CDVRRYZUKEWGKpr+UXDlShjBo7gPKW4Rm8VvOIsJTKJpaQM4jWGxKYyiXrD6KihjDjW0XLkBnMaw2BRGi1bfH2hgFpetTBNVZEiFUmwoWv+aqCJDKlQp+n9ooooMqQVfFf1/NFHFBtyGr/D83+bh4NrE+uwMAAAAAElFTkSuQmCC"/>
              </defs>
            </svg>
          </button>
        </form>

        <button
          type="button"
          class="app-header__icon-btn"
          :aria-label="accountLabel"
          :title="accountLabel"
          @click="handleAccountClick"
        >
          <svg width="49" height="49" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M24.4989 0.000106812C10.9686 0.000106812 0 10.9687 0 24.499C0 38.0294 10.9686 48.998 24.4989 48.998C38.0293 48.998 48.9979 38.0294 48.9979 24.499C48.9979 10.9687 38.0293 0.000106812 24.4989 0.000106812ZM4.37501 24.499C4.37501 13.3849 13.3848 4.37511 24.4989 4.37511C35.6129 4.37511 44.6229 13.3849 44.6229 24.499C44.6229 30.4622 42.0291 35.8195 37.9085 39.5046C34.6983 35.6798 29.8821 33.2484 24.4981 33.2484C19.1145 33.2484 14.2986 35.6795 11.0884 39.5036C6.96826 35.8188 4.37501 30.4617 4.37501 24.499ZM24.4983 12.6859C20.8739 12.6859 17.9358 15.624 17.9358 19.2484C17.9358 22.8728 20.8739 25.8109 24.4983 25.8109C28.1226 25.8109 31.0608 22.8728 31.0608 19.2484C31.0608 15.624 28.1226 12.6859 24.4983 12.6859ZM13.5608 19.2484C13.5608 13.2078 18.4577 8.3109 24.4983 8.3109C30.5389 8.3109 35.4358 13.2078 35.4358 19.2484C35.4358 25.289 30.5389 30.1859 24.4983 30.1859C18.4577 30.1859 13.5608 25.289 13.5608 19.2484Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 90;
  padding: 12px clamp(10px, 2.2vw, 28px) 0;
  pointer-events: none;
}

.app-header__inner {
  width: min(100%, 1680px);
  margin: 0 auto;
  min-height: 92px;
  border-radius: 24px;
  background: #ca072d;
  box-shadow: 0 12px 20px rgba(110, 4, 30, 0.28);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 clamp(12px, 1.8vw, 30px);
  pointer-events: auto;
}

.app-header__logo-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.app-header__logo-image {
  width: auto;
  height: clamp(48px, 4.4vw, 66px);
  display: block;
}

.app-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(8px, 1vw, 14px);
}

.app-header__icon-btn {
  width: clamp(48px, 3.5vw, 58px);
  aspect-ratio: 1 / 1;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #ffffff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 160ms ease, background-color 160ms ease;
}

.app-header__icon-btn svg {
  width: clamp(25px, 1.9vw, 32px);
  height: clamp(25px, 1.9vw, 32px);
  fill: currentColor;
}

.app-header__icon-raster {
  filter: brightness(0) invert(1);
  opacity: 0.98;
}

.app-header__icon-btn:hover,
.app-header__icon-btn:focus-visible {
  background: rgba(255, 255, 255, 0.12);
}

.app-header__icon-btn:active {
  transform: scale(0.94);
}

.app-header__icon-home.active {
  background: #dd1238;
  box-shadow: 0 10px 16px rgba(104, 3, 28, 0.28);
}

.app-header__icon-home.active:hover,
.app-header__icon-home.active:focus-visible {
  background: #e51a40;
}

.app-header__search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.app-header__search-wrap {
  width: 0;
  min-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transition: width 220ms ease, opacity 220ms ease;
}

.app-header__search-wrap.open {
  width: clamp(170px, 20vw, 290px);
  opacity: 1;
  pointer-events: auto;
}

.app-header__search-wrap input {
  width: 100%;
  min-height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #f6fbff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 0.9rem;
  padding: 0 14px;
  outline: none;
}

.app-header__search-wrap input::placeholder {
  color: rgba(246, 251, 255, 0.86);
}

.app-header__search-wrap input:focus {
  border-color: rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.26);
}

.app-header__icon-btn.active {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 1100px) {
  .app-header__inner {
    min-height: 82px;
    border-radius: 20px;
  }

  .app-header__search-wrap.open {
    width: min(280px, 42vw);
  }
}

@media (max-width: 760px) {
  .app-header {
    padding: 8px 10px 0;
  }

  .app-header__inner {
    min-height: 70px;
    border-radius: 16px;
    padding: 0 10px;
    gap: 8px;
  }

  .app-header__logo-image {
    height: clamp(36px, 9.5vw, 48px);
  }

  .app-header__actions {
    gap: 6px;
  }

  .app-header__icon-btn {
    width: 42px;
  }

  .app-header__icon-btn svg {
    width: 23px;
    height: 23px;
  }

  .app-header__search-wrap.open {
    width: min(62vw, 240px);
  }

  .app-header__search-wrap input {
    min-height: 38px;
    font-size: 0.82rem;
  }
}
</style>
