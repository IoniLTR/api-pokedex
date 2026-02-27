<script setup>
import { computed, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { updateSeoFromRoute } from './services/seoService'

const route = useRoute()
const router = useRouter()

const isHomeRoute = computed(() => route.path === '/')

const goHome = async () => {
  await router.push('/')
}

watch(
  () => route.fullPath,
  () => {
    updateSeoFromRoute(route)
  },
  { immediate: true }
)
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
  border: 1px solid rgba(200, 25, 45, 0.5);
  border-radius: 14px;
  background: linear-gradient(135deg, #c92030 0%, #a81020 100%);
  box-shadow: 0 6px 20px rgba(180, 10, 30, 0.4), inset 0 1px 0 rgba(255,255,255,0.18);
  color: #ffffff;
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 120;
  transition: transform 150ms ease, box-shadow 200ms ease;
}

.back-home-btn::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 100%);
  border-radius: 14px 14px 0 0;
  pointer-events: none;
}

.back-home-btn:hover,
.back-home-btn:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(180, 10, 30, 0.55), inset 0 1px 0 rgba(255,255,255,0.2);
  outline: none;
}

.back-home-btn:active {
  transform: scale(0.94);
}

.back-home-btn svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  position: relative;
  z-index: 1;
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

  body.detail-panel-open .app-header,
  body.detail-panel-open .back-home-btn {
    opacity: 0;
    pointer-events: none !important;
    transform: translateY(-20px);
  }

  body.detail-panel-open .app-header *,
  body.detail-panel-open .back-home-btn * {
    pointer-events: none !important;
  }
}
</style>
