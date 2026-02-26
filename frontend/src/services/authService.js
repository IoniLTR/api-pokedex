const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const AUTH_TOKEN_STORAGE_KEY = 'pokedex.auth.token'
const AUTH_USER_STORAGE_KEY = 'pokedex.auth.user'

const parseJsonSafely = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const extractErrorMessage = (payload, fallbackMessage) => {
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim()
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim()
  return fallbackMessage
}

const postJson = async (path, data, fallbackMessage) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  const payload = await parseJsonSafely(response)

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, fallbackMessage))
  }

  return payload || {}
}

export const loginUser = async ({ username, password }) =>
  postJson('/api/user/login', { username, password }, 'Connexion impossible')

export const registerUser = async ({ username, password, role }) =>
  postJson('/api/user/register', { username, password, role }, 'Inscription impossible')

export const storeAuthSession = ({ token, user }) => {
  if (typeof window === 'undefined') return

  const safeToken = String(token || '').trim()
  if (safeToken) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, safeToken)
  }

  if (user && typeof user === 'object') {
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
  }
}

export const getStoredAuthToken = () => {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim()
}

export const getStoredAuthUser = () => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY)
}
