<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearAuthSession, getStoredAuthToken, getStoredAuthUser } from '../services/authService'

const router = useRouter()
const authToken = ref('')
const authUser = ref(null)

const isAuthenticated = computed(() => Boolean(authToken.value))
const username = computed(() => String(authUser.value?.username || '').trim())
const role = computed(() => String(authUser.value?.role || 'USER').trim().toUpperCase())

const syncAuthState = () => {
  authToken.value = getStoredAuthToken()
  authUser.value = getStoredAuthUser()
}

const goHome = async () => {
  await router.push('/')
}

const logout = async () => {
  clearAuthSession()
  syncAuthState()
  await router.push('/connexion')
}

onMounted(async () => {
  syncAuthState()
  if (!isAuthenticated.value) {
    await router.replace('/connexion')
  }
})
</script>

<template>
  <main class="profile-page">
    <section class="profile-card">
      <h1>PROFIL</h1>

      <div class="profile-info">
        <p><strong>Utilisateur:</strong> {{ username || 'Inconnu' }}</p>
        <p><strong>Role:</strong> {{ role }}</p>
      </div>

      <div class="profile-actions">
        <button type="button" class="action-btn home-btn" @click="goHome">ACCUEIL</button>
        <button type="button" class="action-btn logout-btn" @click="logout">DECONNEXION</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  min-height: 100dvh;
  background: #b4e7e3;
  display: grid;
  place-items: center;
  padding: 20px;
}

.profile-card {
  width: min(100%, 520px);
  border-radius: 24px;
  background: #f2fbff;
  border: 1px solid rgba(49, 106, 123, 0.22);
  box-shadow: 0 16px 30px rgba(28, 71, 83, 0.2);
  padding: 26px;
  display: grid;
  gap: 18px;
}

.profile-card h1 {
  margin: 0;
  font-family: 'Astra', 'Poppins', sans-serif;
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  letter-spacing: 0.05em;
  color: #0f2530;
  text-align: center;
}

.profile-info {
  color: #153847;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 1rem;
  line-height: 1.5;
}

.profile-info p {
  margin: 0;
}

.profile-actions {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.action-btn {
  border: 0;
  border-radius: 14px;
  min-height: 48px;
  font-family: 'Astra', 'Poppins', sans-serif;
  letter-spacing: 0.04em;
  font-size: 0.95rem;
  cursor: pointer;
}

.home-btn {
  background: #79bdd9;
  color: #0e2732;
}

.logout-btn {
  background: #ca1f3d;
  color: #f5f8fb;
}

@media (max-width: 620px) {
  .profile-actions {
    grid-template-columns: 1fr;
  }
}
</style>
