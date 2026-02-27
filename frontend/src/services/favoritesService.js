import { getStoredAuthToken } from './authService'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const FAVORITES_ENDPOINT = '/api/user/favorites'

const normalizeFavoriteIds = (value) => {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const normalized = []
  for (const rawId of value) {
    const id = String(rawId || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  return normalized
}

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

const requestFavorites = async ({ method = 'GET', favorites = [] } = {}) => {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('UNAUTHORIZED')
  }

  const headers = {
    Authorization: `Bearer ${token}`
  }

  const init = { method, headers }
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify({
      favorites: normalizeFavoriteIds(favorites instanceof Set ? [...favorites] : favorites)
    })
  }

  const response = await fetch(`${apiBaseUrl}${FAVORITES_ENDPOINT}`, init)
  const payload = await parseJsonSafely(response)

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, 'Impossible de synchroniser les favoris'))
  }

  return normalizeFavoriteIds(payload?.favorites)
}

export const canUseFavorites = () => Boolean(getStoredAuthToken())

export const loadFavoriteIdsForCurrentUser = async () => {
  if (typeof window === 'undefined') return new Set()
  if (!canUseFavorites()) return new Set()

  try {
    const ids = await requestFavorites({ method: 'GET' })
    return new Set(ids)
  } catch (error) {
    console.error(error)
    return new Set()
  }
}

export const saveFavoriteIdsForCurrentUser = async (ids) => {
  if (typeof window === 'undefined') return new Set()
  if (!canUseFavorites()) return new Set()

  try {
    const idsArray = ids instanceof Set ? [...ids] : ids
    const persisted = await requestFavorites({ method: 'PUT', favorites: idsArray })
    return new Set(persisted)
  } catch (error) {
    console.error(error)
    return new Set(ids instanceof Set ? [...ids] : normalizeFavoriteIds(ids))
  }
}
