<script setup>
import { computed } from 'vue'
import AppHeader from './components/AppHeader.vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const isHomeRoute = computed(() => route.path === '/')

const goHome = async () => {
  await router.push('/')
}
</script>

<template>
  <AppHeader v-if="isHomeRoute" />

  <button
    v-else
    type="button"
    class="back-home-btn"
    aria-label="Retour a l'accueil"
    title="Retour a l'accueil"
    @click="goHome"
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.8 4.2L7.2 12L14.8 19.8" />
      <path d="M8.1 12H20.2" />
    </svg>
  </button>

  <RouterView />
</template>

<style scoped>
.back-home-btn {
  position: fixed;
  top: 14px;
  left: 14px;
  width: 48px;
  aspect-ratio: 1 / 1;
  border: 0;
  border-radius: 999px;
  background: #ca072d;
  color: #ffffff;
  display: grid;
  place-items: center;
  box-shadow: 0 10px 16px rgba(103, 7, 33, 0.32);
  cursor: pointer;
  z-index: 120;
  transition: transform 150ms ease, background-color 150ms ease;
}

.back-home-btn:hover,
.back-home-btn:focus-visible {
  background: #dd1238;
}

.back-home-btn:active {
  transform: scale(0.94);
}

.back-home-btn svg {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 2.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 760px) {
  .back-home-btn {
    top: 10px;
    left: 10px;
    width: 42px;
  }

  .back-home-btn svg {
    width: 21px;
    height: 21px;
  }
}
</style>
