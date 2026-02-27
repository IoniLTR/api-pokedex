<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getStoredAuthToken, registerUser, storeAuthSession } from '../services/authService'

const router = useRouter()

const name = ref('')
const role = ref('USER')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const canSubmit = computed(
  () =>
    Boolean(email.value.trim()) &&
    Boolean(password.value) &&
    !loading.value
)

const submitRegister = async () => {
  if (!canSubmit.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const auth = await registerUser({
      username: email.value.trim() || name.value.trim(),
      password: password.value,
      role: role.value
    })

    storeAuthSession(auth)
    await router.push('/')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Inscription impossible'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (getStoredAuthToken()) {
    router.replace('/')
  }
})
</script>

<template>
  <main class="auth-page">
    <div class="auth-bg-balls" aria-hidden="true">
      <svg class="auth-bg-ball ball-1" viewBox="0 0 160 160" fill="none">
        <circle cx="80" cy="80" r="76" stroke="rgba(255,255,255,0.07)" stroke-width="2"/>
        <circle cx="80" cy="80" r="22" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="2"/>
        <path d="M4 80h152M80 4v152" stroke="rgba(255,255,255,0.05)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <svg class="auth-bg-ball ball-2" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="56" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
        <circle cx="60" cy="60" r="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
        <path d="M4 60h112M60 4v112" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>

    <div class="auth-card">
      <div class="auth-card-top">
        <div class="auth-card-leds" aria-hidden="true">
          <span class="auth-led auth-led-blue"></span>
          <span class="auth-led auth-led-red"></span>
          <span class="auth-led auth-led-yellow"></span>
          <span class="auth-led auth-led-green"></span>
        </div>
        <div class="auth-pokeball-icon" aria-hidden="true">
          <svg viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" fill="#ca072d" stroke="#333" stroke-width="1.5"/>
            <path d="M2 30h56" stroke="#333" stroke-width="2"/>
            <circle cx="30" cy="30" r="9" fill="white" stroke="#333" stroke-width="1.5"/>
            <circle cx="30" cy="30" r="4" fill="#333"/>
          </svg>
        </div>
      </div>

      <div class="auth-screen">
        <h1 class="auth-title">INSCRIPTION</h1>
        <p class="auth-subtitle">Créez votre Pokédex</p>

        <form class="auth-form" @submit.prevent="submitRegister" novalidate>
          <div class="auth-row-two">
            <div class="auth-field">
              <label class="auth-field-label" for="reg-name">NOM</label>
              <input
                id="reg-name"
                v-model="name"
                type="text"
                class="auth-input"
                autocomplete="nickname"
                autocapitalize="words"
                spellcheck="false"
                placeholder="Dresseur"
              />
            </div>
            <div class="auth-field">
              <label class="auth-field-label" for="reg-role">RÔLE</label>
              <select id="reg-role" v-model="role" class="auth-input auth-select">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>

          <div class="auth-field">
            <label class="auth-field-label" for="reg-email">EMAIL / NOM D'UTILISATEUR</label>
            <input
              id="reg-email"
              v-model="email"
              type="text"
              class="auth-input"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
              placeholder="Votre identifiant"
            />
          </div>

          <div class="auth-field">
            <label class="auth-field-label" for="reg-password">MOT DE PASSE</label>
            <input
              id="reg-password"
              v-model="password"
              type="password"
              class="auth-input"
              autocomplete="new-password"
              required
              placeholder="••••••••"
            />
          </div>

          <Transition name="err-fade">
            <p v-if="errorMessage" class="auth-error">
              <svg viewBox="0 0 20 20" fill="currentColor" class="auth-error-icon" aria-hidden="true">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              {{ errorMessage }}
            </p>
          </Transition>

          <button class="auth-submit-btn" type="submit" :disabled="!canSubmit">
            <span v-if="loading" class="auth-btn-spinner" aria-hidden="true"></span>
            {{ loading ? 'CRÉATION…' : 'CRÉER MON COMPTE' }}
          </button>
        </form>

        <div class="auth-switch">
          <span>Déjà un compte ?</span>
          <RouterLink class="auth-switch-link" to="/connexion">CONNEXION</RouterLink>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(20px, 4vw, 60px) clamp(16px, 3vw, 40px);
  position: relative;
  overflow: hidden;
}

.auth-bg-balls { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.auth-bg-ball { position: absolute; opacity: 1; }
.ball-1 { width: clamp(200px, 40vw, 500px); bottom: -80px; right: -80px; animation: ball-float 8s ease-in-out infinite; }
.ball-2 { width: clamp(140px, 25vw, 340px); top: -60px; left: -60px; animation: ball-float 10s ease-in-out infinite reverse; }

@keyframes ball-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

.auth-card {
  width: min(100%, 500px);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
  animation: card-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes card-enter {
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.auth-card-top {
  background: linear-gradient(135deg, #b81425 0%, #c92030 50%, #a8101e 100%);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.auth-card-top::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='14' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='1'/%3E%3C/svg%3E") repeat;
  background-size: 40px 40px;
  pointer-events: none;
}

.auth-card-top::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%);
  pointer-events: none;
}

.auth-card-leds { display: flex; align-items: center; gap: 7px; position: relative; z-index: 1; }
.auth-led { display: block; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
.auth-led-blue   { background: #60c8f0; color: #60c8f0; width: 20px; height: 20px; }
.auth-led-red    { background: #ff4060; color: #ff4060; }
.auth-led-yellow { background: #ffd040; color: #ffd040; }
.auth-led-green  { background: #40e080; color: #40e080; }

.auth-pokeball-icon {
  width: 44px;
  height: 44px;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
  animation: pokeball-spin 8s linear infinite;
}

@keyframes pokeball-spin {
  to { transform: rotate(360deg); }
}

.auth-screen {
  background: linear-gradient(160deg, #0d0e13 0%, #111318 100%);
  padding: clamp(24px, 4vh, 40px) clamp(20px, 4vw, 36px);
  border-top: 1px solid rgba(255,255,255,0.06);
  display: grid;
  gap: clamp(16px, 2.5vh, 22px);
}

.auth-title {
  margin: 0;
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-size: clamp(1.6rem, 3.5vw, 2.2rem);
  font-weight: 700;
  color: #e8f4ff;
  letter-spacing: 0.06em;
  line-height: 1;
}

.auth-subtitle {
  margin: -8px 0 0;
  color: rgba(180, 210, 240, 0.55);
  font-size: 0.85rem;
}

.auth-form { display: grid; gap: clamp(10px, 1.8vh, 16px); }

.auth-row-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: clamp(8px, 1.5vw, 14px);
}

.auth-field { display: grid; gap: 7px; }

.auth-field-label {
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(140, 200, 240, 0.8);
  text-transform: uppercase;
}

.auth-input {
  width: 100%;
  min-height: clamp(44px, 5.5vh, 54px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  padding: 0 14px;
  color: #e8f4ff;
  font-size: 0.9rem;
  font-family: 'Poppins', sans-serif;
  outline: none;
  transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
}

.auth-input::placeholder { color: rgba(160,200,240,0.3); }
.auth-input:focus {
  border-color: rgba(100, 180, 240, 0.55);
  background: rgba(255,255,255,0.09);
  box-shadow: 0 0 0 3px rgba(60, 160, 240, 0.18);
}

.auth-select { cursor: pointer; }
.auth-select option { background: #1a1d26; color: #e8f4ff; }

.auth-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(200, 30, 50, 0.18);
  border: 1px solid rgba(200,30,50,0.35);
  color: #ff8090;
  font-size: 0.88rem;
}

.auth-error-icon { width: 18px; height: 18px; flex-shrink: 0; }

.err-fade-enter-active, .err-fade-leave-active { transition: opacity 220ms ease, transform 220ms ease; }
.err-fade-enter-from, .err-fade-leave-to { opacity: 0; transform: translateY(-4px); }

.auth-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: clamp(48px, 6vh, 60px);
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #c92030 0%, #e03550 100%);
  color: #fff;
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(200, 30, 48, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  transition: transform 160ms ease, box-shadow 200ms ease, background 200ms ease;
  position: relative;
  overflow: hidden;
  margin-top: clamp(4px, 1vh, 8px);
}

.auth-submit-btn::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%);
  border-radius: 14px 14px 0 0;
  pointer-events: none;
}

.auth-submit-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(200, 30, 48, 0.55), inset 0 1px 0 rgba(255,255,255,0.2);
}

.auth-submit-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
.auth-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.auth-btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.auth-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(160,200,240,0.5);
  font-size: 0.82rem;
}

.auth-switch-link {
  color: #73a8f4;
  text-decoration: none;
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  transition: color 180ms ease;
}

.auth-switch-link:hover { color: #9fc4ff; }

@media (max-width: 480px) {
  .auth-card { border-radius: 18px; }
  .auth-row-two { grid-template-columns: 1fr; }
}
</style>
