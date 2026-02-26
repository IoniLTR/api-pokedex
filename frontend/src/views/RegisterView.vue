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
  <main class="auth-screen">
    <section class="auth-left">
      <h1 class="left-title">CREER VOTRE<br />POKEDEX</h1>

      <svg class="left-mark" viewBox="0 0 205 205" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M64.1523 108.333C66.8482 127.179 83.0531 141.667 102.645 141.667C122.236 141.667 138.441 127.179 141.137 108.333H204.702C201.679 162.228 157.018 205 102.366 205C47.7147 205 3.05479 162.228 0.03125 108.333H64.1523ZM102.366 0C157.205 0 201.986 43.0655 204.733 97.2217H141.137C138.441 78.3761 122.236 63.8887 102.645 63.8887C83.0534 63.8887 66.8486 78.3761 64.1523 97.2217H0C2.74719 43.0656 47.5275 0.00023688 102.366 0Z" fill="white" fill-opacity="0.3"/>
        <circle cx="102.644" cy="102.778" r="19.4445" fill="white" fill-opacity="0.3"/>
      </svg>

      <RouterLink class="switch-btn" to="/connexion">CONNEXION</RouterLink>
    </section>

    <section class="auth-right">
      <div class="auth-panel">
        <h2 class="right-title">INSCRIPTION</h2>

        <form class="auth-form" @submit.prevent="submitRegister" novalidate>
          <div class="row-two">
            <label class="field">
              <span>NOM</span>
              <input
                v-model="name"
                type="text"
                autocomplete="nickname"
                autocapitalize="words"
                spellcheck="false"
              />
            </label>

            <label class="field">
              <span>ROLE</span>
              <select v-model="role">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
          </div>

          <label class="field">
            <span>EMAIL</span>
            <input
              v-model="email"
              type="text"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
            />
          </label>

          <label class="field">
            <span>MOT DE PASSE</span>
            <input
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
            />
          </label>

          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

          <button class="submit-btn" type="submit" :disabled="!canSubmit">
            {{ loading ? 'CREATION...' : 'CREER' }}
          </button>
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-screen {
  min-height: 100dvh;
  width: min(100%, 1440px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(320px, 40%) minmax(420px, 60%);
  background: #b4e7e3;
}

.auth-left {
  background: #86c7e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: clamp(20px, 3.4vh, 44px) clamp(14px, 2.2vw, 32px);
}

.left-title {
  margin: 0;
  text-align: center;
  text-transform: uppercase;
  line-height: 0.95;
  letter-spacing: 0.04em;
  color: #070e14;
  font-family: 'Astra', 'Poppins', sans-serif;
  font-size: clamp(1.35rem, 2.4vw, 2.35rem);
}

.left-mark {
  width: min(70%, 280px);
  height: auto;
}

.switch-btn {
  width: min(100%, 350px);
  min-height: clamp(50px, 6vh, 70px);
  border-radius: 16px;
  background: #ca1f3d;
  color: #f4f6f9;
  text-decoration: none;
  display: grid;
  place-items: center;
  font-family: 'Astra', 'Poppins', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(1.05rem, 1.45vw, 1.55rem);
}

.auth-right {
  border-top-left-radius: 24px;
  border-bottom-left-radius: 24px;
  background: #b4e7e3;
  padding: clamp(22px, 3.6vh, 42px) clamp(16px, 2.8vw, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-panel {
  width: min(100%, 680px);
  display: grid;
  gap: clamp(14px, 2vh, 24px);
}

.right-title {
  margin: 0;
  text-align: center;
  color: #070e14;
  font-family: 'Astra', 'Poppins', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(1.45rem, 2.2vw, 2.45rem);
}

.auth-form {
  display: grid;
  gap: clamp(12px, 1.4vh, 18px);
}

.row-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(10px, 1.4vw, 18px);
}

.field {
  display: grid;
  gap: 10px;
}

.field span {
  color: #070e14;
  font-family: 'Astra', 'Poppins', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(0.95rem, 1.25vw, 1.3rem);
}

.field input,
.field select {
  width: 100%;
  min-height: clamp(50px, 5.6vh, 68px);
  border: 0;
  border-radius: 14px;
  background: #86c7e0;
  padding: 0 14px;
  color: #0c2130;
  font-size: 0.92rem;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  outline: none;
}

.field select {
  cursor: pointer;
}

.field input:focus,
.field select:focus {
  box-shadow: 0 0 0 3px rgba(34, 103, 129, 0.3);
}

.error-text {
  margin: 0;
  color: #a0132c;
  font-size: 0.95rem;
  font-weight: 600;
}

.submit-btn {
  margin: clamp(8px, 1.3vh, 12px) auto 0;
  width: min(100%, 360px);
  min-height: clamp(52px, 5.9vh, 72px);
  border: 0;
  border-radius: 16px;
  background: #ca1f3d;
  color: #f6f7f8;
  font-family: 'Astra', 'Poppins', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(1.08rem, 1.5vw, 1.62rem);
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .auth-screen {
    grid-template-columns: 1fr;
  }

  .auth-right {
    border-radius: 0;
  }

  .auth-left {
    order: 2;
    gap: 22px;
  }

  .left-mark {
    width: min(56%, 300px);
  }
}

@media (max-width: 760px) {
  .auth-right {
    padding: 26px 16px;
  }

  .auth-left {
    padding: 26px 16px;
  }

  .row-two {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .field input,
  .field select {
    min-height: 64px;
    border-radius: 18px;
  }

  .submit-btn,
  .switch-btn {
    min-height: 62px;
    border-radius: 18px;
    font-size: 1.2rem;
  }
}
</style>
