<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import captureSfxUrl from '../assets/sounds/capture.mp3'
import relacheSfxUrl from '../assets/sounds/relache.mp3'

const pokemons = ref([])
const loading = ref(true)
const error = ref(null)
const showSearch = ref(false)
const selectedTypeFilter = ref('ALL')
const selectedRegionFilter = ref('ALL')
const showFavoritesOnly = ref(false)
const sortFilter = ref('DEFAULT')
const favoriteIds = ref(new Set())
const favoriteShakeIds = ref(new Set())
const favoriteRevealIds = ref(new Set())
const favoriteBurstIds = ref(new Set())
const favoriteConcealIds = ref(new Set())
const selectedPokemon = ref(null)
const selectedEvolutions = ref([])
const detailTransition = ref('open')
const cryAudioEl = ref(null)
const isCryPlaying = ref(false)
const isDescriptionPlaying = ref(false)
const descriptionSpeechSupported = ref(false)
const evolutionFrNameCache = new Map()
const DEFAULT_DESCRIPTION_TEXT = 'Aucune description disponible pour ce Pokemon.'
let activeDescriptionUtterance = null
let favoriteCaptureSfx = null
let favoriteReleaseSfx = null

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const FAVORITES_STORAGE_KEY = 'pokedex.favoriteIds'
const FAVORITE_SHAKE_MS = 2200
const FAVORITE_REVEAL_MS = 420
const FAVORITE_BURST_MS = 700
const FAVORITE_CONCEAL_MS = 520
const favoriteCaptureTimers = new Map()

const TYPE_COLORS = {
  NORMAL: '#b8b99a',
  FIRE: '#f08a45',
  WATER: '#73a0f4',
  ELECTRIC: '#f3d660',
  GRASS: '#6fca6b',
  ICE: '#8fd8d8',
  FIGHTING: '#ce5b5b',
  POISON: '#ad75d8',
  GROUND: '#d8be7a',
  FLYING: '#9eb2ee',
  PSYCHIC: '#f487ad',
  BUG: '#92c062',
  ROCK: '#c5ad70',
  GHOST: '#7f77c8',
  DRAGON: '#6f7ed8',
  DARK: '#8d766b',
  STEEL: '#aab7cc',
  FAIRY: '#e3a9cf'
}

const TYPE_ALIASES = {
  FEU: 'FIRE',
  EAU: 'WATER',
  PLANTE: 'GRASS',
  ELECTRIK: 'ELECTRIC',
  COMBAT: 'FIGHTING',
  SOL: 'GROUND',
  VOL: 'FLYING',
  PSI: 'PSYCHIC',
  INSECTE: 'BUG',
  ROCHE: 'ROCK',
  SPECTRE: 'GHOST',
  TENEBRES: 'DARK',
  ACIER: 'STEEL',
  FEE: 'FAIRY'
}

const TYPE_LABELS_FR = {
  NORMAL: 'NORMAL',
  FIRE: 'FEU',
  WATER: 'EAU',
  ELECTRIC: 'ELECTRIK',
  GRASS: 'PLANTE',
  ICE: 'GLACE',
  FIGHTING: 'COMBAT',
  POISON: 'POISON',
  GROUND: 'SOL',
  FLYING: 'VOL',
  PSYCHIC: 'PSY',
  BUG: 'INSECTE',
  ROCK: 'ROCHE',
  GHOST: 'SPECTRE',
  DRAGON: 'DRAGON',
  DARK: 'TENEBRES',
  STEEL: 'ACIER',
  FAIRY: 'FEE'
}

const ENERGY_SUPPORTED_TYPES = new Set([
  'GRASS',
  'FIRE',
  'WATER',
  'FIGHTING',
  'NORMAL',
  'STEEL',
  'ELECTRIC',
  'PSYCHIC',
  'DARK',
  'DRAGON',
  'FAIRY'
])

const ENERGY_TYPE_ALIASES = {
  BUG: 'GRASS',
  ICE: 'WATER',
  POISON: 'PSYCHIC',
  ROCK: 'FIGHTING',
  GHOST: 'DARK',
  FLYING: 'NORMAL',
  GROUND: 'FIGHTING'
}

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

const normalizeType = (type) => normalizeToken(type)

const fetchPokemons = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await fetch(`${apiBaseUrl}/api/pkmn/search`)

    if (!response.ok) {
      throw new Error('Erreur lors de la recuperation des pokemon')
    }

    const payload = await response.json()
    pokemons.value = Array.isArray(payload?.data) ? payload.data : []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur inconnue'
    pokemons.value = []
  } finally {
    loading.value = false
  }
}

const availableTypes = computed(() => {
  const knownTypes = new Set()

  for (const pokemon of pokemons.value) {
    const types = Array.isArray(pokemon?.types) ? pokemon.types : []
    for (const type of types) {
      const normalized = normalizeType(type)
      const canonical = TYPE_ALIASES[normalized] || normalized
      if (canonical) knownTypes.add(canonical)
    }
  }

  return [...knownTypes].sort((a, b) =>
    getTypeLabel(a).localeCompare(getTypeLabel(b), 'fr', { sensitivity: 'base' })
  )
})

const availableRegions = computed(() => {
  const knownRegions = new Map()

  for (const pokemon of pokemons.value) {
    const rawRegion = String(pokemon?.regions?.[0]?.regionName || '').trim()
    if (!rawRegion) continue

    const key = normalizeToken(rawRegion)
    if (!key || knownRegions.has(key)) continue

    knownRegions.set(key, rawRegion.toUpperCase())
  }

  return [...knownRegions.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'fr', { sensitivity: 'base' }))
    .map(([value, label]) => ({ value, label }))
})

const filteredPokemons = computed(() => {
  const typeFilter = selectedTypeFilter.value
  const regionFilter = selectedRegionFilter.value
  const favoritesOnly = showFavoritesOnly.value

  const filtered = pokemons.value.filter((pokemon) => {
    const pokemonTypes = Array.isArray(pokemon?.types) ? pokemon.types : []
    const matchesType =
      typeFilter === 'ALL' ||
      pokemonTypes.some((type) => {
        const normalized = normalizeType(type)
        const canonical = TYPE_ALIASES[normalized] || normalized
        return canonical === typeFilter
      })

    const pokemonRegion = normalizeToken(pokemon?.regions?.[0]?.regionName || '')
    const matchesRegion = regionFilter === 'ALL' || pokemonRegion === regionFilter

    const matchesFavorite = !favoritesOnly || isFavorite(pokemon?._id)

    return matchesType && matchesRegion && matchesFavorite
  })

  if (sortFilter.value === 'NAME_ASC') {
    return [...filtered].sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' })
    )
  }

  if (sortFilter.value === 'NAME_DESC') {
    return [...filtered].sort((a, b) =>
      String(b?.name || '').localeCompare(String(a?.name || ''), 'fr', { sensitivity: 'base' })
    )
  }

  if (sortFilter.value === 'DEX_ASC') {
    return [...filtered].sort((a, b) => {
      const dexA = Number(a?.regions?.[0]?.regionPokedexNumber)
      const dexB = Number(b?.regions?.[0]?.regionPokedexNumber)
      const safeDexA = Number.isFinite(dexA) ? dexA : Number.POSITIVE_INFINITY
      const safeDexB = Number.isFinite(dexB) ? dexB : Number.POSITIVE_INFINITY
      return safeDexA - safeDexB
    })
  }

  if (sortFilter.value === 'DEX_DESC') {
    return [...filtered].sort((a, b) => {
      const dexA = Number(a?.regions?.[0]?.regionPokedexNumber)
      const dexB = Number(b?.regions?.[0]?.regionPokedexNumber)
      const safeDexA = Number.isFinite(dexA) ? dexA : Number.NEGATIVE_INFINITY
      const safeDexB = Number.isFinite(dexB) ? dexB : Number.NEGATIVE_INFINITY
      return safeDexB - safeDexA
    })
  }

  return filtered
})

const hasActiveFilters = computed(
  () =>
    selectedTypeFilter.value !== 'ALL' ||
    selectedRegionFilter.value !== 'ALL' ||
    showFavoritesOnly.value ||
    sortFilter.value !== 'DEFAULT'
)

const getPrimaryType = (pokemon) => {
  const firstType = Array.isArray(pokemon?.types) ? pokemon.types[0] : ''
  const normalized = normalizeType(firstType)
  return TYPE_ALIASES[normalized] || normalized
}

const getCardColor = (pokemon) => {
  const primaryType = getPrimaryType(pokemon)
  return TYPE_COLORS[primaryType] || '#7cb4e2'
}

const getEnergyType = (pokemon) => {
  const primaryType = getPrimaryType(pokemon)
  const normalized = ENERGY_TYPE_ALIASES[primaryType] || primaryType
  return ENERGY_SUPPORTED_TYPES.has(normalized) ? normalized : 'NORMAL'
}

const getTypeLabel = (type) => TYPE_LABELS_FR[type] || type || 'INCONNU'

const getPokedexNumber = (pokemon) => {
  const raw = pokemon?.regions?.[0]?.regionPokedexNumber
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const getRegionName = (pokemon) => String(pokemon?.regions?.[0]?.regionName || 'REGION')

const getOfficialArtworkUrl = (dexNumber) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNumber}.png`

const formatEvolutionName = (name) =>
  String(name || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Inconnu'

const formatPokemonDisplayName = (name, fallback = 'INCONNU') => {
  const value = String(name || fallback).trim().toUpperCase()
  return value === 'ÉVOLI' ? 'EVOLI' : value
}

const extractIdFromPokeApiUrl = (url) => {
  const match = String(url || '').match(/\/(\d+)\/?$/)
  return match ? Number(match[1]) : null
}

const getSpeciesFromNode = (node) => ({
  id: extractIdFromPokeApiUrl(node?.species?.url),
  name: String(node?.species?.name || '')
})

const getFrenchSpeciesName = async (speciesId, fallbackName = '') => {
  const id = Number(speciesId)
  if (!Number.isFinite(id) || id <= 0) return String(fallbackName || '').trim()

  if (evolutionFrNameCache.has(id)) {
    return evolutionFrNameCache.get(id)
  }

  try {
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
    if (!speciesRes.ok) throw new Error('species localized fetch failed')
    const speciesData = await speciesRes.json()

    const french = Array.isArray(speciesData?.names)
      ? speciesData.names.find((entry) => entry?.language?.name === 'fr')
      : null
    const localized = String(french?.name || fallbackName || '').trim()

    if (localized) {
      evolutionFrNameCache.set(id, localized)
      return localized
    }
  } catch {
    // Keep fallback below.
  }

  const fallback = String(fallbackName || '').trim()
  if (fallback) {
    evolutionFrNameCache.set(id, fallback)
  }
  return fallback
}

const findNodeAndLineage = (node, targetId, lineage = []) => {
  if (!node) return null

  const currentSpecies = getSpeciesFromNode(node)
  const currentLineage = [...lineage, currentSpecies]

  if (currentSpecies.id === targetId) {
    return { node, lineage: currentLineage }
  }

  for (const child of node.evolves_to || []) {
    const found = findNodeAndLineage(child, targetId, currentLineage)
    if (found) return found
  }
  return null
}

const buildEvolutionSequence = (rootNode, targetId) => {
  const found = findNodeAndLineage(rootNode, targetId)
  if (!found) return []

  const sequence = [...found.lineage]
  let cursor = found.node

  while (cursor?.evolves_to?.length === 1) {
    cursor = cursor.evolves_to[0]
    sequence.push(getSpeciesFromNode(cursor))
  }

  if (cursor?.evolves_to?.length > 1) {
    for (const branch of cursor.evolves_to) {
      sequence.push(getSpeciesFromNode(branch))
    }
  }

  const deduped = []
  const seen = new Set()
  for (const item of sequence) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    deduped.push(item)
  }

  return deduped
}

const getFallbackEvolutions = (pokemon) => {
  const currentDex = getPokedexNumber(pokemon)

  if (!currentDex) {
    const fallbackSprite = String(pokemon?.imgUrl || '').trim()
    return fallbackSprite
      ? [{ name: String(pokemon?.name || 'Inconnu'), sprite: fallbackSprite }]
      : []
  }

  const first = Math.max(1, currentDex - 2)
  const second = Math.max(1, currentDex - 1)
  return [
    { name: `#${first}`, sprite: getOfficialArtworkUrl(first) },
    { name: `#${second}`, sprite: getOfficialArtworkUrl(second) },
    { name: String(pokemon?.name || `#${currentDex}`), sprite: getOfficialArtworkUrl(currentDex) }
  ]
}

const loadEvolutionSprites = async (pokemon) => {
  selectedEvolutions.value = []

  const speciesId = getPokedexNumber(pokemon)
  if (!speciesId) {
    selectedEvolutions.value = getFallbackEvolutions(pokemon)
    return
  }

  try {
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`)
    if (!speciesRes.ok) throw new Error('species fetch failed')
    const speciesData = await speciesRes.json()

    const evolutionChainUrl = speciesData?.evolution_chain?.url
    if (!evolutionChainUrl) throw new Error('missing evolution chain url')

    const chainRes = await fetch(evolutionChainUrl)
    if (!chainRes.ok) throw new Error('chain fetch failed')
    const chainData = await chainRes.json()

    const sequence = buildEvolutionSequence(chainData?.chain, speciesId)

    const selectedFrenchName = Array.isArray(speciesData?.names)
      ? speciesData.names.find((entry) => entry?.language?.name === 'fr')
      : null
    const selectedLocalized = String(
      selectedFrenchName?.name || pokemon?.name || ''
    ).trim()
    if (selectedLocalized && Number.isFinite(speciesId)) {
      evolutionFrNameCache.set(speciesId, selectedLocalized)
    }

    const evolutionsResolved = await Promise.all(
      sequence.map(async (item) => {
        const id = Number(item?.id)
        const sprite = Number.isFinite(id) ? getOfficialArtworkUrl(id) : ''
        const name = await getFrenchSpeciesName(id, item?.name || '')
        return { name, sprite }
      })
    )

    const evolutions = evolutionsResolved.filter((item) => item.sprite)

    const limited = (evolutions.length ? evolutions : getFallbackEvolutions(pokemon)).slice(0, 3)
    selectedEvolutions.value = limited
  } catch {
    selectedEvolutions.value = getFallbackEvolutions(pokemon).slice(0, 3)
  }
}

const formatWeight = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? `${num.toFixed(1)} kg` : '-'
}

const formatHeight = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? `${num.toFixed(1)} m` : '-'
}

const getDescriptionText = (pokemon) => {
  const text = String(pokemon?.description || '').trim()
  return text || DEFAULT_DESCRIPTION_TEXT
}

const createFavoriteAudio = (src) => {
  if (typeof Audio === 'undefined') return null
  const audio = new Audio(src)
  audio.preload = 'auto'
  audio.volume = 0.9
  return audio
}

const playFavoriteSfx = (kind) => {
  const audio = kind === 'capture' ? favoriteCaptureSfx : favoriteReleaseSfx
  if (!audio) return

  try {
    audio.pause()
    audio.currentTime = 0
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {})
    }
  } catch {
    // Ignore if playback is blocked.
  }
}

const getCryUrl = (pokemon) => String(pokemon?.cryUrl || '').trim()
const hasCry = (pokemon) => Boolean(getCryUrl(pokemon))

const supportsDescriptionSpeech = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window

const getFrenchSpeechVoice = () => {
  if (!supportsDescriptionSpeech()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!Array.isArray(voices) || voices.length === 0) return null

  return (
    voices.find((voice) => String(voice?.lang || '').toLowerCase().startsWith('fr')) ||
    voices.find((voice) => String(voice?.name || '').toLowerCase().includes('french')) ||
    null
  )
}

const stopDescriptionPlayback = () => {
  if (!supportsDescriptionSpeech()) {
    activeDescriptionUtterance = null
    isDescriptionPlaying.value = false
    return
  }

  activeDescriptionUtterance = null
  window.speechSynthesis.cancel()
  isDescriptionPlaying.value = false
}

const toggleDescriptionPlayback = () => {
  if (!descriptionSpeechSupported.value || !selectedPokemon.value) return

  if (isDescriptionPlaying.value) {
    stopDescriptionPlayback()
    return
  }

  stopCryPlayback()
  window.speechSynthesis.cancel()

  const utterance = new window.SpeechSynthesisUtterance(getDescriptionText(selectedPokemon.value))
  utterance.lang = 'fr-FR'
  utterance.rate = 0.96
  utterance.pitch = 1

  const frenchVoice = getFrenchSpeechVoice()
  if (frenchVoice) {
    utterance.voice = frenchVoice
    utterance.lang = frenchVoice.lang || 'fr-FR'
  }

  utterance.onend = () => {
    if (activeDescriptionUtterance !== utterance) return
    activeDescriptionUtterance = null
    isDescriptionPlaying.value = false
  }

  utterance.onerror = () => {
    if (activeDescriptionUtterance !== utterance) return
    activeDescriptionUtterance = null
    isDescriptionPlaying.value = false
  }

  activeDescriptionUtterance = utterance
  isDescriptionPlaying.value = true
  window.speechSynthesis.speak(utterance)
}

const stopCryPlayback = () => {
  const audio = cryAudioEl.value
  if (!audio) {
    isCryPlaying.value = false
    return
  }

  audio.pause()
  audio.currentTime = 0
  isCryPlaying.value = false
}

const syncCryAudioState = () => {
  const audio = cryAudioEl.value
  isCryPlaying.value = Boolean(audio && !audio.paused && !audio.ended)
}

const toggleCryPlayback = async () => {
  const audio = cryAudioEl.value
  const cryUrl = getCryUrl(selectedPokemon.value)
  if (!audio || !cryUrl) return

  const currentSrc = String(audio.getAttribute('src') || '').trim()
  if (currentSrc !== cryUrl) {
    audio.pause()
    audio.setAttribute('src', cryUrl)
    audio.load()
  }

  if (!audio.paused && !audio.ended) {
    stopCryPlayback()
    return
  }

  try {
    stopDescriptionPlayback()
    await audio.play()
    isCryPlaying.value = true
  } catch {
    isCryPlaying.value = false
  }
}

const openDetails = (pokemon) => {
  if (!pokemon) return
  const currentId = selectedPokemon.value?._id
  const nextId = pokemon?._id
  if (currentId && nextId && currentId === nextId) return
  detailTransition.value = selectedPokemon.value ? 'switch' : 'open'
  selectedPokemon.value = pokemon
}

const closeDetails = () => {
  stopCryPlayback()
  stopDescriptionPlayback()
  detailTransition.value = 'close'
  selectedPokemon.value = null
}

const isSelected = (pokemon) =>
  Boolean(selectedPokemon.value?._id) && selectedPokemon.value._id === pokemon?._id

const getRegionImageUrl = (pokemon) => {
  const apiImageUrl = String(pokemon?.regions?.[0]?.regionImageUrl || '').trim()
  if (apiImageUrl) {
    return apiImageUrl
  }

  const regionLabel = getRegionName(pokemon)
    .toUpperCase()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#8fd3ea"/>
          <stop offset="55%" stop-color="#c9ecef"/>
          <stop offset="100%" stop-color="#7fc2df"/>
        </linearGradient>
      </defs>
      <rect width="960" height="560" fill="url(#sea)"/>
      <path d="M142 392C181 317 235 271 302 243C374 212 438 174 484 115C525 63 603 47 679 76C748 103 813 165 842 241C872 319 839 398 772 446C699 499 623 504 539 491C452 478 360 472 271 451C216 438 173 420 142 392Z" fill="#7db570" fill-opacity="0.88"/>
      <path d="M248 330C282 296 330 274 390 259C450 245 511 214 553 175C588 143 646 132 704 147C754 161 802 198 823 241C844 284 822 338 772 372C719 407 664 412 603 404C540 396 473 391 408 383C346 376 293 361 248 330Z" fill="#5f9f64" fill-opacity="0.78"/>
      <path d="M153 402C216 444 302 463 425 479" stroke="#5f8f52" stroke-width="8" stroke-linecap="round"/>
      <path d="M664 156C699 182 737 212 763 246" stroke="#98d385" stroke-width="8" stroke-linecap="round"/>
      <text x="480" y="320" text-anchor="middle" fill="#111111" font-size="94" font-family="Poppins, Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="2">${regionLabel}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const toggleFavorite = (id) => {
  if (!id) return
  const normalizedId = String(id)
  if (isFavoriteAnimating(normalizedId)) return

  const next = new Set(favoriteIds.value)
  if (next.has(normalizedId)) {
    startFavoriteRelease(normalizedId)
  } else {
    startFavoriteCapture(normalizedId)
  }
}

const isFavorite = (id) => Boolean(id) && favoriteIds.value.has(String(id))
const isFavoriteShaking = (id) => Boolean(id) && favoriteShakeIds.value.has(String(id))
const isFavoriteRevealing = (id) => Boolean(id) && favoriteRevealIds.value.has(String(id))
const isFavoriteBursting = (id) => Boolean(id) && favoriteBurstIds.value.has(String(id))
const isFavoriteConcealing = (id) => Boolean(id) && favoriteConcealIds.value.has(String(id))
const isFavoriteCapturing = (id) =>
  isFavoriteShaking(id) || isFavoriteRevealing(id) || isFavoriteBursting(id)
const isFavoriteAnimating = (id) => isFavoriteCapturing(id) || isFavoriteConcealing(id)
const isFavoriteBallClosed = (id) => isFavorite(id) || isFavoriteAnimating(id)
const shouldUseSilhouette = (id) => !isFavorite(id) && !isFavoriteRevealing(id)

const updateAnimatedSet = (setRef, id, shouldAdd) => {
  const normalizedId = String(id)
  const next = new Set(setRef.value)
  if (shouldAdd) {
    next.add(normalizedId)
  } else {
    next.delete(normalizedId)
  }
  setRef.value = next
}

const registerFavoriteTimer = (id, timerId) => {
  const normalizedId = String(id)
  const timers = favoriteCaptureTimers.get(normalizedId) || []
  timers.push(timerId)
  favoriteCaptureTimers.set(normalizedId, timers)
}

const clearFavoriteCapture = (id) => {
  const normalizedId = String(id)
  const timers = favoriteCaptureTimers.get(normalizedId) || []
  for (const timerId of timers) {
    window.clearTimeout(timerId)
  }
  favoriteCaptureTimers.delete(normalizedId)
  updateAnimatedSet(favoriteShakeIds, normalizedId, false)
  updateAnimatedSet(favoriteRevealIds, normalizedId, false)
  updateAnimatedSet(favoriteBurstIds, normalizedId, false)
  updateAnimatedSet(favoriteConcealIds, normalizedId, false)
}

const startFavoriteCapture = (id) => {
  const normalizedId = String(id)
  clearFavoriteCapture(normalizedId)
  playFavoriteSfx('capture')
  updateAnimatedSet(favoriteShakeIds, normalizedId, true)

  const shakeTimer = window.setTimeout(() => {
    updateAnimatedSet(favoriteShakeIds, normalizedId, false)
    updateAnimatedSet(favoriteRevealIds, normalizedId, true)
    updateAnimatedSet(favoriteBurstIds, normalizedId, true)

    const revealTimer = window.setTimeout(() => {
      const next = new Set(favoriteIds.value)
      next.add(normalizedId)
      favoriteIds.value = next
      persistFavoriteIds()
      updateAnimatedSet(favoriteRevealIds, normalizedId, false)
    }, FAVORITE_REVEAL_MS)
    registerFavoriteTimer(normalizedId, revealTimer)

    const burstTimer = window.setTimeout(() => {
      updateAnimatedSet(favoriteBurstIds, normalizedId, false)
      favoriteCaptureTimers.delete(normalizedId)
    }, FAVORITE_BURST_MS)
    registerFavoriteTimer(normalizedId, burstTimer)
  }, FAVORITE_SHAKE_MS)

  registerFavoriteTimer(normalizedId, shakeTimer)
}

const startFavoriteRelease = (id) => {
  const normalizedId = String(id)
  clearFavoriteCapture(normalizedId)
  playFavoriteSfx('release')
  updateAnimatedSet(favoriteConcealIds, normalizedId, true)

  const concealTimer = window.setTimeout(() => {
    const next = new Set(favoriteIds.value)
    next.delete(normalizedId)
    favoriteIds.value = next
    persistFavoriteIds()
    updateAnimatedSet(favoriteConcealIds, normalizedId, false)
    favoriteCaptureTimers.delete(normalizedId)
  }, FAVORITE_CONCEAL_MS)

  registerFavoriteTimer(normalizedId, concealTimer)
}

const loadFavoriteIds = () => {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return new Set()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.map((id) => String(id)).filter(Boolean))
  } catch {
    return new Set()
  }
}

const persistFavoriteIds = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteIds.value]))
  } catch {
    // Ignore storage errors to keep UI functional.
  }
}

const toggleSearch = () => {
  showSearch.value = !showSearch.value
}

const resetFilters = () => {
  selectedTypeFilter.value = 'ALL'
  selectedRegionFilter.value = 'ALL'
  showFavoritesOnly.value = false
  sortFilter.value = 'DEFAULT'
}

onMounted(() => {
  descriptionSpeechSupported.value = supportsDescriptionSpeech()
  favoriteCaptureSfx = createFavoriteAudio(captureSfxUrl)
  favoriteReleaseSfx = createFavoriteAudio(relacheSfxUrl)
  favoriteIds.value = loadFavoriteIds()
  fetchPokemons()
})

onBeforeUnmount(() => {
  stopCryPlayback()
  stopDescriptionPlayback()
  for (const audio of [favoriteCaptureSfx, favoriteReleaseSfx]) {
    if (!audio) continue
    audio.pause()
    audio.currentTime = 0
  }
  favoriteCaptureSfx = null
  favoriteReleaseSfx = null
  for (const timers of favoriteCaptureTimers.values()) {
    for (const timerId of timers) {
      window.clearTimeout(timerId)
    }
  }
  favoriteCaptureTimers.clear()
})

watch(
  selectedPokemon,
  async (pokemon, previousPokemon) => {
    const previousId = previousPokemon?._id
    const nextId = pokemon?._id
    if (previousId !== nextId) {
      stopCryPlayback()
      stopDescriptionPlayback()
    }

    if (!pokemon) {
      selectedEvolutions.value = []
      return
    }

    await loadEvolutionSprites(pokemon)
  },
  { immediate: true }
)
</script>

<template>
  <main class="home" :class="{ 'detail-open': selectedPokemon }">
    <div class="stage">
      <section v-if="loading" class="state-panel">Chargement du Pokedex...</section>
      <section v-else-if="error" class="state-panel state-error">{{ error }}</section>

      <section v-else class="content-layout" :class="{ 'with-detail': selectedPokemon }">
        <div class="pokedex-grid">
        <article
          v-for="(pokemon, index) in filteredPokemons"
          :key="pokemon._id || `${pokemon.name}-${index}`"
          class="pokemon-card"
          :class="{ selected: isSelected(pokemon) }"
          :style="{ '--card-bg': getCardColor(pokemon) }"
          role="button"
          tabindex="0"
          @click="openDetails(pokemon)"
          @keydown.enter.prevent="openDetails(pokemon)"
          @keydown.space.prevent="openDetails(pokemon)"
        >
          <svg v-if="getEnergyType(pokemon) === 'WATER'" class="energy-mark" viewBox="0 0 192 203" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M191.637 0C191.637 0 134.138 22 131.637 47.5C129.137 73 142.885 82 148.137 91C153.39 100 183.172 121.895 181.637 147.5C180.286 170.044 169.785 184.863 150.137 196C133.413 205.48 101.242 201.513 101.137 201.5C101.137 201.5 52.2844 195.312 30.6374 175.5C14.4817 160.714 5.58381 149.042 1.63745 127.5C-1.806 108.703 0.0989131 96.3368 8.13745 79C15.934 62.1852 25.2312 55.1612 39.6374 43.5C56.4751 29.8707 68.4993 25.4827 88.6374 17.5C126.567 2.46499 191.637 0 191.637 0ZM82.6374 158.5C69.7538 152.874 51.1376 150.5 46.6374 158.5C42.1376 166.5 57.9002 179.281 70.6374 185C83.641 190.838 101.637 192.5 107.137 185C112.637 177.5 95.5534 164.141 82.6374 158.5Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'FIRE'" class="energy-mark" viewBox="0 0 229 239" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M97 0C97 0 113.91 6.2074 122.5 13.5C130.777 20.5272 134.35 25.9415 139.5 35.5C145.241 46.1549 146.903 53.0799 149 65C150.796 75.2087 150.228 81.1381 150.5 91.5C150.736 100.479 150.5 114.5 150.5 114.5C150.5 114.5 162.256 113.88 169.5 112C177.467 109.933 182.402 108.921 189 104C197.079 97.9743 204 83 204 83C204 83 208.534 87.8127 210.5 91.5C214.321 98.6664 215.003 103.941 214 112C212.595 123.299 205.981 128.006 199 137C190.532 147.909 173.5 161.5 173.5 161.5C173.5 161.5 189 163.5 200 157.5C211 151.5 229 138.5 229 138.5C229 138.5 207 240 110 239C13 238 0 155 0 155C0 155 9.57672 164.406 17 168.5C24.0848 172.408 36.5 175.5 36.5 175.5C36.5 175.5 20.0923 157.396 15.5 143C11.8037 131.412 10.8387 124.049 12.5 112C13.9425 101.539 16.0573 95.5498 21.5 86.5C28.0468 75.6145 44.5 63.5 44.5 63.5C44.5 63.5 38.4071 75.9031 37.5 84.5C36.5291 93.7007 36.4919 99.6615 40.5 108C44.867 117.085 59 126 59 126C59 126 52.5 108 53 102C53.5 96 53.5 86 63.5 75.5C73.5 65 104.5 39 104.5 39C104.5 39 109.109 29.4899 109 23C108.83 12.8703 97 0 97 0ZM116.854 127C116.791 127.011 103.91 129.338 96.8535 133.5C91.5993 136.599 87.7257 138.118 84.8535 143.5C83.7775 145.516 83.2377 146.747 82.8535 149C82.4924 151.117 82.4055 152.399 82.8535 154.5C83.4549 157.32 84.8221 158.557 86.3535 161C89.01 165.237 93.0846 166.163 94.3535 171C95.1462 174.022 95.2262 176 94.3535 179C93.5958 181.605 92.8674 183.183 90.8535 185C89.361 186.347 86.3535 187.5 86.3535 187.5C86.3502 187.486 85.6775 184.654 84.8535 183C83.4935 180.27 82.1626 178.993 79.8535 177L79.751 176.911C77.5549 175.016 76.171 173.822 73.3535 173C69.7869 171.96 63.8535 173.5 63.8535 173.5C63.8535 173.5 69.8533 177.213 71.8535 181C72.6327 182.475 73.0952 183.352 73.3535 185C73.8521 188.182 72.91 190.181 71.3535 193C69.9505 195.541 66.3535 198.5 66.3535 198.5C66.3364 198.521 64.0141 201.33 63.3535 203.5C62.559 206.111 63.3507 210.485 63.3535 210.5C63.3535 210.5 72.8537 233 108.854 232.5C144.802 232.001 153.828 215.547 153.854 215.5C153.854 215.5 154.65 210.521 153.854 207.5C152.982 204.197 150.956 203.017 149.354 200C147.345 196.218 144.854 190 144.854 190C144.85 189.976 143.028 179.013 145.854 173C148.255 167.888 155.814 162.528 155.854 162.5C155.814 162.5 150.924 162.462 147.854 163C142.496 163.939 139.32 164.895 134.854 168C130.193 171.24 125.354 179 125.354 179C125.353 178.986 124.709 169.485 122.354 164C120.728 160.215 119.445 158.202 116.854 155C114.159 151.671 110.232 151.555 108.854 147.5C107.911 144.727 108.33 142.882 108.854 140C109.916 134.149 116.821 127.033 116.854 127Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'GRASS'" class="energy-mark" viewBox="0 0 216 242" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M144.053 0.0940412C144.053 0.0940412 145.901 -0.117552 147.053 0.0940412C149.281 0.503275 152.024 3.06746 152.053 3.09404C152.053 3.09404 170.603 28.432 181.053 45.594C185.512 52.9171 188.057 57.0088 192.053 64.594C200.741 81.0854 205.906 90.5426 210.553 108.594C213.122 118.573 214.731 124.295 215.053 134.594C215.328 143.411 215.748 148.695 213.053 157.094C210.352 165.512 207.589 170.134 201.553 176.594C194.6 184.035 188.583 185.886 179.553 190.594C170.55 195.288 165.224 197.502 155.553 200.594C145.265 203.884 139.151 204.507 128.553 206.594C118.442 208.585 102.553 211.094 102.553 211.094V226.094L104.053 234.594C104.053 234.594 104.922 240.011 102.553 241.094C101.31 241.662 99.0528 241.094 99.0528 241.094L77.0528 237.594C77.0246 237.577 74.4253 235.968 73.0528 234.594C71.3684 232.908 69.5528 229.594 69.5528 229.594V219.094C69.5435 219.047 68.5458 213.99 67.0528 211.094C65.3339 207.76 61.0528 203.594 61.0528 203.594C60.9797 203.573 40.3606 197.58 29.5528 189.594C21.4458 183.604 17.0999 179.511 11.5528 171.094C4.48391 160.368 1.98904 152.859 0.55282 140.094C-1.12685 125.165 1.06279 116.079 6.55282 102.094C11.5603 89.3387 16.7279 83.0772 25.5528 72.594C36.519 59.5673 44.8767 54.2391 58.5528 44.094C71.0378 34.8326 78.3063 29.8525 92.0528 22.594C100.241 18.2703 105.082 16.3356 113.553 12.594C125.328 7.39288 144.053 0.0940412 144.053 0.0940412ZM126.553 34.594C126.553 34.594 119.463 42.5299 115.553 48.094C111.875 53.3272 110.168 56.5077 107.053 62.094C105.224 65.3745 104.608 67.4505 102.553 70.594C101.638 71.9929 100.068 74.0734 100.053 74.094C100.036 74.0899 95.9953 73.1226 93.5528 72.094C88.2602 69.8653 86.9696 65.5014 81.5528 63.594C77.8281 62.2825 75.4932 62.3535 71.5528 62.094C68.4354 61.8888 66.3144 60.6334 63.5528 62.094C62.4536 62.6755 61.0678 64.0789 61.0528 64.094L68.0528 67.094C70.7865 68.2656 74.7754 69.5727 78.5528 72.094C83.033 75.0844 85.9022 76.9049 88.5528 81.594C90.5591 85.1434 91.45 87.5183 91.5528 91.594C91.665 96.0452 90.2818 98.4909 88.5528 102.594C87.709 104.597 86.0678 107.567 86.0528 107.594C86.02 107.57 79.0542 102.414 74.0528 100.094C68.6743 97.5992 65.4447 96.2564 59.5528 95.594C53.9123 94.9599 50.6531 95.6701 45.0528 96.594C40.9016 97.2789 34.5761 99.0874 34.5528 99.094C34.5528 99.094 43.5037 100.102 49.0528 101.594C54.0631 102.941 57.0399 103.535 61.5528 106.094C65.1877 108.155 66.9098 109.84 70.0528 112.594C74.3007 116.316 80.0226 123.058 80.0528 123.094L75.0528 150.094C75.0248 150.071 70.0836 146.081 66.5528 144.094C61.9712 141.515 59.1016 140.561 54.0528 139.094C48.9041 137.598 45.9092 136.832 40.5528 136.594C34.8656 136.342 31.3718 136.065 26.0528 138.094C24.0201 138.869 21.0732 140.582 21.0528 140.594C21.0528 140.594 34.0965 140.875 41.5528 144.094C45.734 145.899 47.6068 147.82 51.5528 150.094C55.0366 152.101 57.2987 152.733 60.5528 155.094C64.7993 158.175 66.9238 160.383 70.0528 164.594C72.3417 167.675 75.0341 173.057 75.0528 173.094V191.094L84.0528 212.594L86.5528 179.094C86.5664 179.076 87.7449 177.539 88.5528 176.594C94.7493 169.349 100.069 166.944 108.553 162.594C118.939 157.269 125.544 155.534 137.053 153.594C144.2 152.389 148.314 151.721 155.553 152.094C162.276 152.441 172.524 155.087 172.553 155.094L178.053 157.094L169.053 150.094C165.538 147.36 162.835 147.05 158.553 146.094C152.073 144.648 148.192 146.094 141.553 146.094C134.914 146.094 131.165 145.499 124.553 146.094C116.62 146.808 112.119 147.603 104.553 150.094C99.7407 151.678 92.5828 155.08 92.5528 155.094L90.5528 152.094C90.5444 152.031 88.8873 139.571 92.5528 133.094C94.3261 129.961 95.8184 128.436 98.5528 126.094C101.809 123.305 108.053 120.594 108.053 120.594C108.082 120.58 114.945 117.222 119.553 115.594C126.922 112.991 131.31 112.154 139.053 111.094L139.345 111.054C145.755 110.177 149.516 109.662 156.053 110.094C160.978 110.42 168.53 112.089 168.553 112.094L177.053 114.094C177.025 114.072 172.061 110.12 168.553 108.094C163.779 105.337 160.864 104.07 155.553 102.594C149.859 101.012 146.46 100.758 140.553 100.594C133.095 100.388 128.774 100.718 121.553 102.594C117.548 103.634 115.397 104.563 111.553 106.094C107.988 107.513 102.579 110.082 102.553 110.094C102.547 110.053 101.857 104.827 102.553 101.594C103.38 97.7526 104.576 95.6449 107.053 92.594C110.33 88.5575 113.613 87.8 118.053 85.094C122.231 82.5474 124.546 80.999 129.053 79.094C134.118 76.9534 137.22 76.4337 142.553 75.094C146.045 74.2168 148 73.6775 151.553 73.094C155.234 72.4895 161.053 72.094 161.053 72.094H165.053C165.022 72.0827 155.763 68.7165 149.553 68.094C145.473 67.6851 143.146 67.8562 139.053 68.094C132.547 68.4721 128.734 68.5278 122.553 70.594C119.327 71.6724 114.578 74.0814 114.553 74.094L111.553 76.094C111.565 76.0536 113.24 70.544 114.553 67.094C116.852 61.0524 119.322 58.1611 121.553 52.094C123.515 46.7573 125.553 38.094 125.553 38.094L126.553 34.594Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'FIGHTING'" class="energy-mark" viewBox="0 0 201 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6.5 184C3.1512 180.932 1.5 173.5 1.5 173.5V116.5C1.5 116.5 2.96836 110.655 5.5 108C8.2117 105.156 14.5 103.5 14.5 103.5H92.5C92.5 103.5 97.7571 105.692 100.5 108C103.698 110.69 107 116.5 107 116.5V133C107 133 104.15 138.288 101.5 141C98.9617 143.598 94 146.5 94 146.5H79C79 146.5 73.1169 147.877 70 150C66.9167 152.1 63.5 157 63.5 157V173.5C63.5 173.5 62.0203 179.595 59.5 182.5C56.691 185.738 50 188 50 188H15.5C15.5 188 9.336 186.598 6.5 184Z" fill="white" fill-opacity="0.3"/>
            <path d="M63.5 198H56V218.5C56 219.987 59.5 220 59.5 220L149 218.5V200.5C149 200.5 151.331 194.132 154.5 191.5C156.986 189.435 162 188 162 188H187.5C187.5 188 192.441 186.115 195 184C198.01 181.512 201 176 201 176V120C201 120 199.512 113.373 197 110C194.595 106.772 189 103.5 189 103.5H130C130 103.5 125.395 105.804 123 108C120.005 110.746 117 116.5 117 116.5V141C117 141 115.829 147.034 113.5 150C111.522 152.519 107 155 107 155H88C88 155 81.8106 157.847 79 161C76.615 163.676 74.5 169 74.5 169V184C74.5 184 73.289 188.902 71.5 191.5C69.2171 194.815 63.5 198 63.5 198Z" fill="white" fill-opacity="0.3"/>
            <rect x="156" y="12" width="45" height="82" rx="10" fill="white" fill-opacity="0.3"/>
            <rect y="12" width="45" height="82" rx="10" fill="white" fill-opacity="0.3"/>
            <rect x="51" width="45" height="96" rx="10" fill="white" fill-opacity="0.3"/>
            <rect x="105" width="45" height="96" rx="10" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'STEEL'" class="energy-mark" viewBox="0 0 238 208" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M117.5 155L60 52H177L117.5 155Z" fill="white" fill-opacity="0.3"/>
            <path d="M175 174L160.5 149L135.5 183.5L98 183L77 149L60 174L85 208H153.5L175 174Z" fill="white" fill-opacity="0.3"/>
            <path d="M30 62.5L49 99H18L0 61.5L37 0H75L90 28H50.5L30 62.5Z" fill="white" fill-opacity="0.3"/>
            <path d="M163 0L148 27.5L187.5 28L208.5 62.5L189 99H220L238 62.5L200.5 0H163Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'ELECTRIC'" class="energy-mark" viewBox="0 0 167 236" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M75.5 91.5L104.5 0L0 147.5L96.5 118L65.5 236L166.5 64.5L75.5 91.5Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'PSYCHIC'" class="energy-mark" viewBox="0 0 250 184" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M125.251 0C210.966 -9.60403e-06 248.472 91.9277 248.501 92C248.501 92 250.104 95.8969 250.001 98.5C249.914 100.725 248.501 104 248.501 104C248.467 104.071 209.962 183.5 125.251 183.5C40.5031 183.5 2.00146 104 2.00146 104C1.99243 103.985 -0.0651163 100.464 0.00146484 98C0.0630691 95.7206 1.99252 92.5148 2.00146 92.5C2.00146 92.5 39.5031 9.19109e-05 125.251 0ZM158.5 34.5C158.5 34.5 173.936 49.0248 179.5 61C187.514 78.2511 190.155 91.5018 184 109.5C177.207 129.359 145.5 147 145.5 147C145.394 147.023 118.448 152.978 103 147C84.3174 139.771 75.1195 128.224 67.9995 109.5C60.4961 89.7677 60.2064 73.9314 70.4995 55.5C75.9443 45.7503 89.9385 34.5488 89.9995 34.5C89.9013 34.5511 61.8011 49.1677 47.9995 63.5C38.3005 73.572 26.9995 92.5 26.9995 92.5C26.9978 92.5139 26.5481 96.2053 26.9995 98.5C28.0474 103.827 32.0616 105.299 35.4995 109.5C45.6437 121.897 50.9739 129.677 63.9995 139C74.8639 146.776 81.7649 150.458 94.4995 154.5C111.686 159.955 122.648 161.041 140.5 158.5C160.173 155.7 171.229 150.408 187.5 139C204.826 126.851 224 109.5 223.5 98.5C223 87.5 217.985 84.3165 213 76L212.744 75.5732C204.988 62.6341 200.112 54.5003 187.5 46C177.397 39.1912 158.5 34.5 158.5 34.5ZM138 58.5C131.062 54.7255 118 55.5 118 55.5C118 55.5 130 72 124 84C117.999 95.9999 97.9995 94.5 97.9995 94.5C97.9984 94.5146 97.5093 101.01 106 109.5C114.499 118 135.999 119 148 101.5C160 84 153.144 66.7398 138 58.5Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'DARK'" class="energy-mark" viewBox="0 0 226 196" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M66.8913 48C62.12 29.0084 81.3913 0 81.3913 0C81.3913 0 54.5665 8.12557 40.3913 18.5C23.9488 30.5338 14.7419 39.6974 6.89128 58.5C-0.0142035 75.0389 -1.10455 86.1888 0.891282 104C3.58551 128.044 10.7054 142.48 27.3913 160C37.3318 170.438 44.5552 174.943 57.3913 181.5C78.7798 192.425 93.3983 196.079 117.391 195C137.408 194.1 149.048 190.615 166.891 181.5C187.846 170.795 200.475 162.29 212.391 142C224.029 122.185 227.64 107.315 224.891 84.5C222.008 60.5711 213.884 46.5928 196.891 29.5C180.388 12.8989 143.891 1.5 143.891 1.5C143.891 1.5 163.8 32.6182 157.391 52C150.131 73.9559 130.896 86.8605 107.891 84.5C86.5662 82.3118 72.1146 68.791 66.8913 48Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'DRAGON'" class="energy-mark" viewBox="0 0 217 223" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M33 15.3497C59.9469 -4.96863 88.5001 -2.1505 119 6.8497C156.469 17.9065 162.476 35.7788 162.5 35.8497C162.408 35.7936 110.468 4.15665 74.5 31.8497C64.4102 39.6182 57.366 45.7533 55.5 58.3497C51.5005 85.3496 58.2023 106.185 77.5 126.35C88.0501 137.374 110.451 147.328 110.5 147.35L88.5 61.3497L217 178.35C217 178.35 183.5 231.85 125.5 220.85C43.6027 205.318 0.000455031 122.85 7.27732e-09 83.8497C-0.000300257 54.1565 9.29117 33.2265 33 15.3497ZM133.5 151.5L159.5 157.5L129.5 129L133.5 151.5Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else-if="getEnergyType(pokemon) === 'FAIRY'" class="energy-mark" viewBox="0 0 223 213" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M21.6524 99.5C12.4524 83.5 19.4858 51.1667 24.1524 37C24.1524 37 7.74754 54.0758 3.65234 68C-1.34748 85 -1.08566 112 3.65234 129C10.315 152.906 16.6521 164.655 37.1523 183C53.682 197.792 66.0176 204.104 87.6523 209C102.336 212.323 111.226 212.964 126.152 211C143.652 208.697 162.152 200 178.152 189C198.974 174.685 208.592 160.947 216.652 137C222.659 119.156 222.966 107.74 221.152 89C218.152 58 197.652 37 197.652 37C197.652 37 205.983 63.8152 203.652 81C199.652 110.5 191.034 115.343 173.652 129C159.652 140 149.652 145 136.152 161.5C122.494 178.194 110.652 207 110.652 207C110.652 207 96.1521 165.453 75.6523 150.5C55.1525 135.547 30.8524 115.5 21.6524 99.5Z" fill="white" fill-opacity="0.3"/>
            <path d="M89.6523 75C80.2053 59.8848 56.1523 44 56.1523 44C56.1523 44 76.1523 45 89.6523 31C99.4384 20.8515 108.152 0 108.152 0C108.152 0 113.639 28.6098 127.652 37C137.982 43.1848 158.152 41.5 158.152 41.5C158.152 41.5 136.152 58.5 126.152 75C117.458 89.3454 108.152 114 108.152 114C108.152 114 99.6523 91 89.6523 75Z" fill="white" fill-opacity="0.3"/>
          </svg>
          <svg v-else class="energy-mark" viewBox="0 0 206 232" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M116.5 183C111.253 205.039 105 231.5 105 231.5C105 231.5 100.115 191.335 85.5 171.5C78.5 162 81.5 157 52 159C32.674 160.31 4 171.5 4 171.5C4 171.5 33.0956 150.006 47.5 132C49.5 129.5 58.5 117 47.5 104C27.0735 79.8596 0 59 0 59C0 59 28.5 68 66.5 71.5C78.6489 72.619 86.3306 62.9658 90.5 51.5C100.5 24 105 0 105 0C105 0 103.473 14 116.5 51.5C122.643 69.185 131 74 153.5 71.5C174.659 69.1489 206 59 206 59C206 59 175.5 83.5 160 104C153.257 112.918 151.871 117.5 160 129.5C170.5 145 206 171.5 206 171.5C206 171.5 161.5 159 144 159C128.925 159 121.5 162 116.5 183Z" fill="white" fill-opacity="0.3"/>
          </svg>

          <h2 class="pokemon-name">
            {{ formatPokemonDisplayName(pokemon.name, 'INCONNU') }}
          </h2>

          <button
            class="favorite-btn"
            :class="{
              active: isFavorite(pokemon._id),
              'is-catching': isFavoriteShaking(pokemon._id),
              'is-bursting': isFavoriteBursting(pokemon._id),
              'is-releasing': isFavoriteConcealing(pokemon._id)
            }"
            type="button"
            @click.stop="toggleFavorite(pokemon._id)"
            :aria-label="
              isFavoriteAnimating(pokemon._id)
                ? 'Animation en cours'
                : isFavorite(pokemon._id)
                  ? 'Retirer des favoris'
                  : 'Ajouter aux favoris'
            "
          >
            <span class="pokeball-burst" aria-hidden="true"></span>
            <svg
              v-if="!isFavoriteBallClosed(pokemon._id)"
              class="favorite-icon open-pokeball-icon"
              width="60"
              height="61"
              viewBox="0 0 60 61"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M6.5 22.2C6.5 11.9 16.9 4.5 30 4.5C43.1 4.5 53.5 11.9 53.5 22.2C53.5 24.6 52.5 26.8 50.8 28.6C46.5 33 38.8 35.1 30 35.1C21.2 35.1 13.5 33 9.2 28.6C7.5 26.8 6.5 24.6 6.5 22.2Z" fill="#ff321e" stroke="#16181d" stroke-width="2"/>
              <path d="M7.9 25.6C12.6 23.5 20.6 22.2 30 22.2C39.4 22.2 47.4 23.5 52.1 25.6C51.2 29.6 47.8 32.7 42.8 34.5H17.2C12.2 32.7 8.8 29.6 7.9 25.6Z" fill="#cf1416" stroke="#16181d" stroke-width="1.3"/>
              <circle cx="30" cy="20.6" r="5.7" fill="#16181d"/>
              <circle cx="30" cy="20.6" r="3.8" fill="#f6f6f6" stroke="#16181d" stroke-width="1.1"/>
              <circle cx="30" cy="20.6" r="1.9" fill="#fefefe"/>
              <path d="M12.1 16.9C13.5 12.9 17.8 10.2 23 9" stroke="#fff2ef" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M10.4 20.8C10.8 19.6 11.2 18.7 11.9 17.7" stroke="#fff2ef" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6.8 39.1C10.2 34.8 18.7 32.1 30 32.1C41.3 32.1 49.8 34.8 53.2 39.1C50 42.5 41.5 44.7 30 44.7C18.5 44.7 10 42.5 6.8 39.1Z" fill="#16181d"/>
              <path d="M9 39.6C9 50.6 18 57 30 57C42 57 51 50.6 51 39.6C47.8 42 40 43.8 30 43.8C20 43.8 12.2 42 9 39.6Z" fill="#f8f8f8" stroke="#16181d" stroke-width="1.8"/>
              <path d="M24.4 45.2C24.4 42.1 26.9 39.6 30 39.6C33.1 39.6 35.6 42.1 35.6 45.2V45.4H24.4V45.2Z" fill="#d8d8dd"/>
              <path d="M39.1 53.8C41.4 53.4 43.2 52.7 44.8 51.6" stroke="#d1d1d1" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M36.2 54.2C37 54.2 37.9 54.1 38.7 54" stroke="#d1d1d1" stroke-width="1.2" stroke-linecap="round"/>
            </svg>

            <svg
              v-else
              class="favorite-icon pokeball-icon"
              width="60"
              height="61"
              viewBox="0 0 60 61"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="30" cy="30.5" r="27" fill="#ffffff" stroke="#111111" stroke-width="2"/>
              <path d="M4 30.5C4 16.1406 15.6406 4.5 30 4.5C44.3594 4.5 56 16.1406 56 30.5H4Z" fill="#ef4444"/>
              <path d="M3 30.5H57" stroke="#111111" stroke-width="2.5"/>
              <circle cx="30" cy="30.5" r="7.2" fill="#ffffff" stroke="#111111" stroke-width="2"/>
              <circle cx="30" cy="30.5" r="3.1" fill="#111111"/>
            </svg>
          </button>

          <img
            class="pokemon-image"
            :class="{
              silhouette: shouldUseSilhouette(pokemon._id),
              revealing: isFavoriteRevealing(pokemon._id)
            }"
            :src="pokemon.imgUrl"
            :alt="pokemon.name || 'Pokemon'"
            loading="lazy"
          />
          <img
            v-if="isFavoriteConcealing(pokemon._id)"
            class="pokemon-image-conceal"
            :src="pokemon.imgUrl"
            :alt="''"
            loading="lazy"
            aria-hidden="true"
          />
        </article>
        </div>

        <div class="detail-slot" :class="{ open: selectedPokemon }">
          <Transition :name="`detail-panel-${detailTransition}`" mode="out-in" appear>
            <aside
              v-if="selectedPokemon"
              class="detail-panel"
              :key="selectedPokemon._id || selectedPokemon.name"
            >
          <div class="detail-hero" :style="{ '--hero-bg': getCardColor(selectedPokemon) }">
            <div class="detail-head-row">
              <button class="detail-close" type="button" @click="closeDetails" aria-label="Fermer le panneau">
                ×
              </button>

              <h3 class="detail-title">{{ formatPokemonDisplayName(selectedPokemon.name, 'INCONNU') }}</h3>

              <button
                class="detail-ball-toggle"
                :class="{
                  active: isFavorite(selectedPokemon?._id),
                  'is-catching': isFavoriteShaking(selectedPokemon?._id),
                  'is-bursting': isFavoriteBursting(selectedPokemon?._id),
                  'is-releasing': isFavoriteConcealing(selectedPokemon?._id)
                }"
                type="button"
                @click="toggleFavorite(selectedPokemon?._id)"
                :aria-label="
                  isFavoriteAnimating(selectedPokemon?._id)
                    ? 'Animation en cours'
                    : isFavorite(selectedPokemon?._id)
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                "
              >
                <span class="pokeball-burst" aria-hidden="true"></span>
                <svg
                  v-if="!isFavoriteBallClosed(selectedPokemon?._id)"
                  class="favorite-icon open-pokeball-icon"
                  width="60"
                  height="61"
                  viewBox="0 0 60 61"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M6.5 22.2C6.5 11.9 16.9 4.5 30 4.5C43.1 4.5 53.5 11.9 53.5 22.2C53.5 24.6 52.5 26.8 50.8 28.6C46.5 33 38.8 35.1 30 35.1C21.2 35.1 13.5 33 9.2 28.6C7.5 26.8 6.5 24.6 6.5 22.2Z" fill="#ff321e" stroke="#16181d" stroke-width="2"/>
                  <path d="M7.9 25.6C12.6 23.5 20.6 22.2 30 22.2C39.4 22.2 47.4 23.5 52.1 25.6C51.2 29.6 47.8 32.7 42.8 34.5H17.2C12.2 32.7 8.8 29.6 7.9 25.6Z" fill="#cf1416" stroke="#16181d" stroke-width="1.3"/>
                  <circle cx="30" cy="20.6" r="5.7" fill="#16181d"/>
                  <circle cx="30" cy="20.6" r="3.8" fill="#f6f6f6" stroke="#16181d" stroke-width="1.1"/>
                  <circle cx="30" cy="20.6" r="1.9" fill="#fefefe"/>
                  <path d="M12.1 16.9C13.5 12.9 17.8 10.2 23 9" stroke="#fff2ef" stroke-width="1.5" stroke-linecap="round"/>
                  <path d="M10.4 20.8C10.8 19.6 11.2 18.7 11.9 17.7" stroke="#fff2ef" stroke-width="1.5" stroke-linecap="round"/>
                  <path d="M6.8 39.1C10.2 34.8 18.7 32.1 30 32.1C41.3 32.1 49.8 34.8 53.2 39.1C50 42.5 41.5 44.7 30 44.7C18.5 44.7 10 42.5 6.8 39.1Z" fill="#16181d"/>
                  <path d="M9 39.6C9 50.6 18 57 30 57C42 57 51 50.6 51 39.6C47.8 42 40 43.8 30 43.8C20 43.8 12.2 42 9 39.6Z" fill="#f8f8f8" stroke="#16181d" stroke-width="1.8"/>
                  <path d="M24.4 45.2C24.4 42.1 26.9 39.6 30 39.6C33.1 39.6 35.6 42.1 35.6 45.2V45.4H24.4V45.2Z" fill="#d8d8dd"/>
                  <path d="M39.1 53.8C41.4 53.4 43.2 52.7 44.8 51.6" stroke="#d1d1d1" stroke-width="1.2" stroke-linecap="round"/>
                  <path d="M36.2 54.2C37 54.2 37.9 54.1 38.7 54" stroke="#d1d1d1" stroke-width="1.2" stroke-linecap="round"/>
                </svg>

                <svg
                  v-else
                  class="favorite-icon pokeball-icon"
                  width="60"
                  height="61"
                  viewBox="0 0 60 61"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="30" cy="30.5" r="27" fill="#ffffff" stroke="#111111" stroke-width="2"/>
                  <path d="M4 30.5C4 16.1406 15.6406 4.5 30 4.5C44.3594 4.5 56 16.1406 56 30.5H4Z" fill="#ef4444"/>
                  <path d="M3 30.5H57" stroke="#111111" stroke-width="2.5"/>
                  <circle cx="30" cy="30.5" r="7.2" fill="#ffffff" stroke="#111111" stroke-width="2"/>
                  <circle cx="30" cy="30.5" r="3.1" fill="#111111"/>
                </svg>
              </button>
            </div>

            <button
              class="detail-cry-toggle"
              :class="{ playing: isCryPlaying }"
              type="button"
              :disabled="!hasCry(selectedPokemon)"
              @click="toggleCryPlayback"
              :aria-label="isCryPlaying ? 'Arreter le cri' : 'Ecouter le cri'"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 15h3.5l4.6 3.6V5.4L7.5 9H4z" />
                <path d="M15.2 9.2a4.6 4.6 0 0 1 0 5.6" />
                <path d="M17.8 6.9a8.2 8.2 0 0 1 0 10.2" />
              </svg>
            </button>

            <svg class="detail-hero-mark" viewBox="0 0 162 162" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M50.5977 85.4453C52.7241 100.309 65.5053 111.735 80.957 111.735C96.4091 111.735 109.191 100.309 111.317 85.4453H161.452C159.067 127.953 123.843 161.688 80.7383 161.688C37.6338 161.688 2.41053 127.953 0.0253906 85.4453H50.5977ZM80.7383 0C123.991 0 159.311 33.9671 161.478 76.6816H111.317C109.191 61.8173 96.4093 50.3906 80.957 50.3906C65.5051 50.391 52.7239 61.8176 50.5977 76.6816H0C2.16635 33.9672 37.4855 0.000197082 80.7383 0Z" fill="white" fill-opacity="0.3"/>
              <circle cx="80.9579" cy="81.0632" r="15.3363" fill="white" fill-opacity="0.3"/>
            </svg>

            <img
              class="detail-hero-image"
              :class="{
                silhouette: shouldUseSilhouette(selectedPokemon?._id),
                revealing: isFavoriteRevealing(selectedPokemon?._id)
              }"
              :src="selectedPokemon.imgUrl"
              :alt="selectedPokemon.name || 'Pokemon'"
              loading="lazy"
            />
            <img
              v-if="isFavoriteConcealing(selectedPokemon?._id)"
              class="detail-hero-image-conceal"
              :src="selectedPokemon.imgUrl"
              :alt="''"
              loading="lazy"
              aria-hidden="true"
            />

            <audio
              ref="cryAudioEl"
              class="cry-audio"
              preload="none"
              @ended="syncCryAudioState"
              @pause="syncCryAudioState"
              @play="syncCryAudioState"
            />
          </div>

          <div class="detail-content">
            <span class="detail-type-pill" :style="{ '--type-pill-bg': getCardColor(selectedPokemon) }">
              {{ getTypeLabel(getPrimaryType(selectedPokemon)) }}
            </span>

            <div class="group30-card">
              <template
                v-for="(evolution, spriteIndex) in selectedEvolutions"
                :key="`${selectedPokemon._id}-evo-${evolution.name || spriteIndex}`"
              >
                <div class="group30-evo" :title="formatEvolutionName(evolution.name)">
                  <img
                    class="group30-sprite"
                    :class="{
                      silhouette: shouldUseSilhouette(selectedPokemon?._id),
                      revealing: isFavoriteRevealing(selectedPokemon?._id)
                    }"
                    :src="evolution.sprite"
                    :alt="formatEvolutionName(evolution.name)"
                    loading="lazy"
                  />
                  <span class="group30-name">{{ formatEvolutionName(evolution.name) }}</span>
                </div>
                <span v-if="spriteIndex < selectedEvolutions.length - 1" class="group30-arrow" aria-hidden="true">→</span>
              </template>
            </div>

            <div class="detail-info-row">
              <article class="region-card">
                <img
                  class="region-map-image"
                  :src="getRegionImageUrl(selectedPokemon)"
                  :alt="`Carte ${getRegionName(selectedPokemon)}`"
                  loading="lazy"
                />
                <span class="region-name">{{ getRegionName(selectedPokemon).toUpperCase() }}</span>
              </article>

              <article class="stats-card">
                <div class="stats-label">POIDS</div>
                <div class="stats-value">{{ formatWeight(selectedPokemon.weight) }}</div>
                <hr />
                <div class="stats-label">TAILLE</div>
                <div class="stats-value">{{ formatHeight(selectedPokemon.height) }}</div>
              </article>
            </div>

            <section class="detail-description">
              <div class="detail-description-head">
                <h4>DESCRIPTION</h4>
                <button
                  class="detail-description-audio"
                  :class="{ playing: isDescriptionPlaying }"
                  type="button"
                  :disabled="!descriptionSpeechSupported"
                  @click="toggleDescriptionPlayback"
                  :aria-label="
                    isDescriptionPlaying
                      ? 'Arreter la lecture de la description'
                      : 'Ecouter la description'
                  "
                >
                  {{ isDescriptionPlaying ? 'STOP AUDIO' : 'AUDIO' }}
                </button>
              </div>
              <p>
                {{ getDescriptionText(selectedPokemon) }}
              </p>
            </section>
          </div>
            </aside>
          </Transition>
        </div>
      </section>
    </div>

    <button
      type="button"
      class="filter-fab"
      @click="toggleSearch"
      :aria-expanded="showSearch"
      aria-controls="search-panel"
      aria-label="Filtrer les pokemon"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 5h16l-6.2 7.1v5.3l-3.6 1.8v-7.1L4 5z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <form id="search-panel" class="search-panel" :class="{ open: showSearch }" @submit.prevent>
      <div class="search-panel-head">
        <h4>Filtrer le Pokedex</h4>
        <button
          type="button"
          class="search-panel-reset"
          :disabled="!hasActiveFilters"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>

      <div class="search-fields-grid">
        <div class="search-field">
          <label for="type-filter">Type</label>
          <select id="type-filter" v-model="selectedTypeFilter">
            <option value="ALL">Tous les types</option>
            <option
              v-for="type in availableTypes"
              :key="`filter-type-${type}`"
              :value="type"
            >
              {{ getTypeLabel(type) }}
            </option>
          </select>
        </div>

        <div class="search-field">
          <label for="region-filter">Region</label>
          <select id="region-filter" v-model="selectedRegionFilter">
            <option value="ALL">Toutes les regions</option>
            <option
              v-for="region in availableRegions"
              :key="`filter-region-${region.value}`"
              :value="region.value"
            >
              {{ region.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="search-bottom-row">
        <label class="favorite-filter">
          <input v-model="showFavoritesOnly" type="checkbox" />
          <span>Capturé uniquement</span>
        </label>

        <div class="search-field search-sort-field">
          <label for="sort-filter">Tri</label>
          <select id="sort-filter" v-model="sortFilter">
            <option value="DEFAULT">Par defaut</option>
            <option value="NAME_ASC">Nom A-Z</option>
            <option value="NAME_DESC">Nom Z-A</option>
            <option value="DEX_ASC">Pokedex croissant</option>
            <option value="DEX_DESC">Pokedex decroissant</option>
          </select>
        </div>
      </div>

      <small>{{ filteredPokemons.length }} / {{ pokemons.length }} pokemon</small>
    </form>
  </main>
</template>

<style scoped>
.home {
  --mint-bg: #b4e7e3;
  --shadow: 0 8px 18px rgba(61, 117, 130, 0.2);
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--mint-bg);
  padding: 50px 100px;
  position: relative;
  overflow-x: clip;
}

.home::before,
.home::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
}

.home::before {
  width: min(42vw, 620px);
  aspect-ratio: 1 / 1;
  right: -8vw;
  top: -10vh;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2), transparent 70%);
}

.home::after {
  width: min(30vw, 460px);
  aspect-ratio: 1 / 1;
  left: -10vw;
  bottom: -14vh;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.18), transparent 70%);
}

.stage {
  width: 100%;
  max-width: none;
  margin: 0;
  position: relative;
  z-index: 1;
}

.state-panel {
  background: rgba(255, 255, 255, 0.64);
  border-radius: 20px;
  color: #1f5f69;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  min-height: 240px;
  display: grid;
  place-items: center;
}

.state-error {
  color: #9e2731;
}

.content-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0;
  transition: gap 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.content-layout.with-detail {
  gap: clamp(16px, 1.8vw, 28px);
}

.pokedex-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(16px, 1.9vw, 30px);
  transition: grid-template-columns 320ms ease, gap 320ms ease;
}

.content-layout.with-detail .pokedex-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-slot {
  width: 0;
  min-width: 0;
  align-self: start;
  pointer-events: none;
  transition: width 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-slot.open {
  width: clamp(330px, 28vw, 430px);
  pointer-events: auto;
}

.pokemon-card {
  --card-bg: #7cb4e2;
  background: var(--card-bg);
  border: 1.5px solid rgba(62, 54, 38, 0.28);
  border-radius: 24px;
  min-height: clamp(220px, 17vw, 295px);
  padding: clamp(20px, 1.8vw, 30px) clamp(20px, 1.6vw, 30px);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
  isolation: isolate;
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.pokemon-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 24px rgba(45, 92, 112, 0.25);
}

.pokemon-card.selected {
  border-color: rgba(132, 141, 153, 0.78);
  box-shadow:
    0 0 0 4px rgba(214, 221, 233, 0.95),
    0 0 0 7px rgba(145, 154, 166, 0.48),
    0 16px 24px rgba(45, 92, 112, 0.25);
  transform: translateY(-2px);
}

.pokemon-card.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  padding: 7px;
  border-radius: inherit;
  background:
    radial-gradient(circle at 10% 16%, rgba(255, 255, 255, 0.95) 0 1.6px, transparent 2px),
    radial-gradient(circle at 18% 78%, rgba(255, 255, 255, 0.9) 0 1.4px, transparent 2px),
    radial-gradient(circle at 34% 11%, rgba(248, 250, 255, 0.95) 0 1.5px, transparent 2px),
    radial-gradient(circle at 49% 86%, rgba(255, 255, 255, 0.86) 0 1.3px, transparent 2px),
    radial-gradient(circle at 67% 14%, rgba(255, 255, 255, 0.95) 0 1.6px, transparent 2.1px),
    radial-gradient(circle at 84% 22%, rgba(252, 254, 255, 0.9) 0 1.4px, transparent 2px),
    radial-gradient(circle at 88% 74%, rgba(255, 255, 255, 0.9) 0 1.5px, transparent 2.1px),
    radial-gradient(circle at 58% 52%, rgba(255, 255, 255, 0.72) 0 1.2px, transparent 1.9px),
    linear-gradient(138deg, #d9dfe8 0%, #f8fbff 26%, #bec8d4 52%, #f7f9fc 76%, #b8c1cd 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}

.energy-mark {
  width: clamp(150px, 15vw, 250px);
  position: absolute;
  right: -56px;
  bottom: -42px;
  pointer-events: none;
}

.pokemon-name {
  color: #f7fbff;
  text-transform: uppercase;
  font-family: 'Astra', 'Poppins', sans-serif;
  font-size: 20px;
  letter-spacing: 0.08em;
  font-weight: 900;
  line-height: 1;
  margin: 0;
  max-width: 56%;
}

.favorite-btn {
  position: absolute;
  left: clamp(26px, 2.1vw, 40px);
  top: 52%;
  transform: translateY(-50%);
  width: 56px;
  aspect-ratio: 1 / 1;
  border: 0;
  background: transparent;
  color: #0a0d14;
  cursor: pointer;
  padding: 0;
  transition: transform 140ms ease;
  overflow: visible;
  z-index: 12;
}

.favorite-btn:active {
  transform: translateY(-50%) scale(0.94);
}

.favorite-icon {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
}

.favorite-btn.is-catching .favorite-icon,
.detail-ball-toggle.is-catching .favorite-icon {
  animation: pokeball-catch-shake 2.2s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
}

.pokeball-burst {
  position: absolute;
  inset: -18px;
  z-index: 1;
  pointer-events: none;
}

.pokeball-burst::before,
.pokeball-burst::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0;
}

.pokeball-burst::before {
  background:
    radial-gradient(circle at 50% 6%, rgba(255, 255, 255, 0.95) 0 2px, transparent 3px),
    radial-gradient(circle at 84% 24%, rgba(255, 245, 161, 0.95) 0 2px, transparent 3px),
    radial-gradient(circle at 95% 52%, rgba(255, 252, 224, 0.9) 0 2px, transparent 3px),
    radial-gradient(circle at 82% 78%, rgba(255, 247, 179, 0.95) 0 2px, transparent 3px),
    radial-gradient(circle at 50% 95%, rgba(255, 255, 255, 0.95) 0 2px, transparent 3px),
    radial-gradient(circle at 18% 78%, rgba(255, 245, 161, 0.95) 0 2px, transparent 3px),
    radial-gradient(circle at 5% 52%, rgba(255, 252, 224, 0.9) 0 2px, transparent 3px),
    radial-gradient(circle at 16% 24%, rgba(255, 247, 179, 0.95) 0 2px, transparent 3px);
}

.pokeball-burst::after {
  background:
    radial-gradient(circle at 22% 11%, rgba(255, 255, 255, 0.92) 0 1.7px, transparent 2.8px),
    radial-gradient(circle at 79% 14%, rgba(255, 245, 161, 0.9) 0 1.7px, transparent 2.8px),
    radial-gradient(circle at 92% 66%, rgba(255, 255, 255, 0.9) 0 1.7px, transparent 2.8px),
    radial-gradient(circle at 36% 88%, rgba(255, 247, 179, 0.9) 0 1.7px, transparent 2.8px),
    radial-gradient(circle at 9% 41%, rgba(255, 255, 255, 0.86) 0 1.7px, transparent 2.8px);
}

.favorite-btn.is-bursting .pokeball-burst::before,
.detail-ball-toggle.is-bursting .pokeball-burst::before {
  animation: pokeball-sparkle-a 680ms ease-out 1;
}

.favorite-btn.is-bursting .pokeball-burst::after,
.detail-ball-toggle.is-bursting .pokeball-burst::after {
  animation: pokeball-sparkle-b 680ms ease-out 1;
}

.pokemon-image {
  position: absolute;
  right: -8px;
  bottom: -6px;
  width: clamp(150px, 52%, 330px);
  max-height: 92%;
  object-fit: contain;
  filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  transition: filter 220ms ease, opacity 220ms ease;
}

.pokemon-image.silhouette {
  filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
}

.pokemon-image.revealing {
  animation: silhouette-fade-out-card 420ms ease-out forwards;
}

.pokemon-image-conceal {
  position: absolute;
  right: -8px;
  bottom: -6px;
  width: clamp(150px, 52%, 330px);
  max-height: 92%;
  object-fit: contain;
  pointer-events: none;
  z-index: 6;
  filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  transform-origin: 22% 50%;
  animation: silhouette-cover-from-ball-card 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.detail-panel {
  position: relative;
  top: 0;
  width: 100%;
  max-height: none;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  background: #e9e9e9;
  box-shadow: 0 16px 26px rgba(27, 59, 71, 0.24);
  z-index: 21;
}

.detail-panel-open-enter-active,
.detail-panel-open-leave-active {
  transition: opacity 260ms ease, transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-panel-open-enter-from {
  opacity: 0;
  transform: translateX(56px);
}

.detail-panel-open-enter-to,
.detail-panel-open-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.detail-panel-open-leave-to {
  opacity: 0;
  transform: translateX(80px);
}

.detail-panel-switch-enter-active {
  transition: opacity 300ms ease, transform 460ms cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-panel-switch-enter-from {
  opacity: 0;
  transform: translateY(calc(100% + 72px));
}

.detail-panel-switch-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.detail-panel-switch-leave-active {
  transition: opacity 190ms ease, transform 220ms ease;
}

.detail-panel-switch-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.detail-panel-switch-leave-to {
  opacity: 0;
  transform: translateY(-28px);
}

.detail-panel-close-leave-active {
  transition: opacity 260ms ease, transform 340ms cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-panel-close-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.detail-panel-close-leave-to {
  opacity: 0;
  transform: translateX(calc(100% + 80px));
}

.detail-hero {
  --hero-bg: #7cb4e2;
  flex: 0 0 auto;
  min-height: clamp(270px, 34vh, 360px);
  background: var(--hero-bg);
  position: relative;
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  overflow: hidden;
  padding: 14px 18px 0;
}

.detail-head-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 16;
}

.detail-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #eaf4ff;
  font-size: 1.95rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.detail-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  color: #edf6ff;
  font-family: 'Astra', 'Poppins', sans-serif;
  letter-spacing: 0.08em;
  font-size: 20px;
  line-height: 1;
}

.detail-ball-toggle {
  position: relative;
  width: 52px;
  height: 52px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  cursor: pointer;
  overflow: visible;
  z-index: 14;
}

.detail-ball-toggle .favorite-icon {
  width: 50px;
  height: 50px;
}

.detail-cry-toggle {
  position: absolute;
  left: 12px;
  bottom: 12px;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 999px;
  background: rgba(244, 250, 255, 0.9);
  color: #14222b;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 8px 14px rgba(19, 44, 57, 0.3);
  z-index: 15;
  transition: transform 140ms ease, background-color 160ms ease, color 160ms ease, opacity 140ms ease;
}

.detail-cry-toggle svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.detail-cry-toggle:not(:disabled):hover {
  transform: translateY(-1px);
}

.detail-cry-toggle:not(:disabled):active {
  transform: scale(0.94);
}

.detail-cry-toggle:disabled {
  opacity: 0.46;
  cursor: not-allowed;
}

.detail-cry-toggle.playing {
  background: #152735;
  color: #eef8ff;
  box-shadow: 0 0 0 3px rgba(235, 245, 255, 0.3), 0 8px 16px rgba(17, 39, 53, 0.38);
}

.cry-audio {
  display: none;
}

.detail-hero-mark {
  position: absolute;
  right: -24px;
  bottom: 12px;
  width: 186px;
  height: 186px;
  pointer-events: none;
}

.detail-hero-image {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -6px;
  width: min(72%, 316px);
  max-height: 84%;
  object-fit: contain;
  filter: drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  transition: filter 220ms ease, opacity 220ms ease;
}

.detail-hero-image.silhouette {
  filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
}

.detail-hero-image.revealing {
  animation: silhouette-fade-out-detail 420ms ease-out forwards;
}

.detail-hero-image-conceal {
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: min(72%, 316px);
  max-height: 84%;
  object-fit: contain;
  pointer-events: none;
  z-index: 7;
  filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  transform-origin: 86% 22%;
  animation: silhouette-cover-from-ball-detail 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.detail-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: visible;
  overscroll-behavior: contain;
  padding: 10px 12px 14px;
}

.detail-type-pill {
  --type-pill-bg: #78b2df;
  display: block;
  width: fit-content;
  margin: 0px auto 10px;
  background: var(--type-pill-bg);
  color: #eef8ff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 900;
  font-size: 0.94rem;
  border-radius: 999px;
  padding: 8px 23px;
  letter-spacing: 0.05em;
  box-shadow: 0 6px 10px rgba(41, 87, 111, 0.28);
  text-transform: uppercase;
}

.group30-card {
  background: #abe2e6;
  border-radius: 14px;
  box-shadow: 0 5px 12px rgba(35, 84, 93, 0.24);
  padding: 10px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 94px;
}

.group30-evo {
  position: relative;
  display: grid;
  place-items: center;
}

.group30-sprite {
  width: 62px;
  height: 62px;
  object-fit: contain;
  transition: filter 220ms ease, opacity 220ms ease;
}

.group30-sprite.silhouette {
  filter: brightness(0) saturate(100%);
}

.group30-sprite.revealing {
  animation: silhouette-fade-out-sprite 420ms ease-out forwards;
}

@keyframes pokeball-catch-shake {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  10% {
    transform: translate3d(-2px, 0, 0) rotate(-8deg);
  }

  20% {
    transform: translate3d(2px, 0, 0) rotate(8deg);
  }

  30% {
    transform: translate3d(-2px, 0, 0) rotate(-8deg);
  }

  40% {
    transform: translate3d(2px, 0, 0) rotate(8deg);
  }

  50% {
    transform: translate3d(-1.2px, 0, 0) rotate(-5deg);
  }

  60% {
    transform: translate3d(1.2px, 0, 0) rotate(5deg);
  }

  70% {
    transform: translate3d(-0.8px, 0, 0) rotate(-3deg);
  }

  80% {
    transform: translate3d(0.8px, 0, 0) rotate(3deg);
  }
}

@keyframes silhouette-fade-out-card {
  0% {
    filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  }

  100% {
    filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  }
}

@keyframes silhouette-cover-from-ball-card {
  0% {
    opacity: 0;
    transform: translate(-132px, -8px) scale(0.12);
  }

  25% {
    opacity: 0.92;
  }

  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}

@keyframes silhouette-fade-out-detail {
  0% {
    filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  }

  100% {
    filter: drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  }
}

@keyframes silhouette-cover-from-ball-detail {
  0% {
    opacity: 0;
    transform: translate(72%, -152px) scale(0.12);
  }

  30% {
    opacity: 0.95;
  }

  100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

@keyframes silhouette-fade-out-sprite {
  0% {
    filter: brightness(0) saturate(100%);
  }

  100% {
    filter: none;
  }
}

@keyframes pokeball-sparkle-a {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }

  28% {
    opacity: 1;
    transform: scale(1.12);
  }

  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}

@keyframes pokeball-sparkle-b {
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(0deg);
  }

  35% {
    opacity: 0.95;
    transform: scale(0.92) rotate(16deg);
  }

  100% {
    opacity: 0;
    transform: scale(1.55) rotate(32deg);
  }
}

.group30-name {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%) translateY(4px);
  background: rgba(15, 28, 36, 0.9);
  color: #f2f8fb;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 8px;
  border-radius: 999px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 170ms ease, transform 170ms ease;
  box-shadow: 0 4px 10px rgba(7, 20, 27, 0.28);
  z-index: 2;
}

.group30-evo:hover .group30-name {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.group30-arrow {
  font-size: 1.35rem;
  line-height: 1;
  color: #111111;
  margin: 0 1px;
}

.detail-info-row {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.region-card {
  position: relative;
  overflow: hidden;
  min-height: 106px;
  border-radius: 12px;
  background: #b6e7e5;
  box-shadow: 0 4px 10px rgba(39, 79, 87, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.region-map-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.region-name {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #111111;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 900;
  font-size: 1.35rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}

.stats-card {
  min-height: 106px;
  border-radius: 12px;
  background: #b6e7e5;
  box-shadow: 0 4px 10px rgba(39, 79, 87, 0.2);
  padding: 10px 12px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 3px;
}

.stats-card hr {
  width: 100%;
  border: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.35);
  margin: 2px 0;
}

.stats-label {
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 1.2rem;
  line-height: 1;
  font-weight: 900;
  color: #111111;
}

.stats-value {
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 1rem;
  line-height: 1;
  font-weight: 700;
  color: rgba(17, 17, 17, 0.78);
}

.detail-description {
  margin-top: 10px;
}

.detail-description-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.detail-description-audio {
  border: 0;
  border-radius: 999px;
  background: #79bdd9;
  color: #0b2733;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  padding: 6px 10px;
  line-height: 1;
  cursor: pointer;
  transition: transform 130ms ease, opacity 130ms ease, background-color 160ms ease, color 160ms ease;
}

.detail-description-audio:not(:disabled):active {
  transform: scale(0.96);
}

.detail-description-audio:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.detail-description-audio.playing {
  background: #152735;
  color: #eef8ff;
}

.detail-description h4 {
  margin: 0;
  color: #111111;
  font-size: 1.3rem;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.detail-description p {
  margin: 0;
  color: #111111;
  font-size: 0.95rem;
  line-height: 1.45;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
}

.filter-fab {
  position: fixed;
  left: 28px;
  bottom: 30px;
  width: 68px;
  aspect-ratio: 1 / 1;
  border: 0;
  border-radius: 18px;
  background: #7ec6e7;
  box-shadow: 0 12px 20px rgba(36, 95, 118, 0.26);
  color: #07131b;
  cursor: pointer;
  z-index: 20;
}

.filter-fab svg {
  width: 34px;
  height: 34px;
  stroke: currentColor;
  stroke-width: 1.9;
}

.search-panel {
  position: fixed;
  left: 26px;
  bottom: 114px;
  width: min(360px, calc(100vw - 52px));
  background: rgba(243, 251, 254, 0.95);
  backdrop-filter: blur(10px);
  border: 1.5px solid rgba(117, 178, 196, 0.45);
  border-radius: 18px;
  padding: 12px;
  display: grid;
  gap: 9px;
  box-shadow: 0 14px 24px rgba(34, 83, 99, 0.2);
  transform: translateY(14px);
  opacity: 0;
  pointer-events: none;
  transition: transform 180ms ease, opacity 180ms ease;
  z-index: 18;
}

.search-panel.open {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.search-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.search-panel-head h4 {
  margin: 0;
  color: #153946;
  font-size: 0.96rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  text-transform: uppercase;
}

.search-panel-reset {
  border: 0;
  border-radius: 999px;
  background: #79bdd9;
  color: #0b2733;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 5px 10px;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: transform 130ms ease, opacity 130ms ease;
}

.search-panel-reset:disabled {
  opacity: 0.38;
  cursor: default;
}

.search-panel-reset:not(:disabled):active {
  transform: scale(0.96);
}

.search-field label {
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 800;
  color: #214f5f;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

.search-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.search-field {
  display: grid;
  gap: 5px;
}

.search-panel select {
  border: 2px solid #b8dfe8;
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 0.92rem;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: #103644;
  outline: none;
  background: #fafdff;
}

.search-panel select {
  cursor: pointer;
}

.search-panel select:focus {
  border-color: #4aabc8;
}

.search-bottom-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.search-sort-field {
  min-width: 150px;
}

.favorite-filter {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #173b48;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-size: 0.84rem;
  font-weight: 700;
}

.favorite-filter input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #4aabc8;
}

.search-panel small {
  color: #3d6d7d;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
}

@media (max-width: 560px) {
  .search-fields-grid {
    grid-template-columns: 1fr;
  }

  .search-bottom-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .search-sort-field {
    min-width: 0;
  }
}

@media (min-width: 1101px) {
  .detail-slot.open {
    position: sticky;
    top: 20px;
    align-self: start;
  }
}

@media (max-width: 1460px) {
  .detail-slot.open {
    width: clamp(300px, 29vw, 390px);
  }

  .region-name {
    font-size: 1.2rem;
  }

  .stats-label {
    font-size: 1.1rem;
  }

  .stats-value {
    font-size: 0.94rem;
  }

  .detail-description h4 {
    font-size: 1.18rem;
  }

  .detail-description p {
    font-size: 0.86rem;
  }
}

@media (max-width: 1100px) {
  .content-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .content-layout.with-detail {
    gap: 16px;
  }

  .detail-slot,
  .detail-slot.open {
    width: 100%;
    overflow: visible;
    pointer-events: auto;
    transition: none;
  }

  .detail-panel-open-enter-from,
  .detail-panel-switch-enter-from {
    transform: translateY(18px);
  }

  .detail-panel-close-leave-to {
    transform: translateX(calc(100% + 24px));
  }

  .detail-panel {
    position: relative;
    top: 0;
    max-width: 620px;
    width: 100%;
    height: auto;
    max-height: none;
    margin: 0 auto;
  }

  .pokedex-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-layout.with-detail .pokedex-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .home.detail-open .filter-fab,
  .home.detail-open .search-panel {
    z-index: 0;
    pointer-events: none;
  }

  .detail-slot {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    z-index: 70;
    display: block;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    background: rgba(9, 16, 24, 0.28);
    transition: opacity 220ms ease;
  }

  .detail-slot.open {
    opacity: 1;
    pointer-events: auto;
  }

  .detail-panel {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0;
    border-radius: 0;
    border: 0;
    overflow-y: auto;
  }
}

@media (max-width: 760px) {
  .home {
    padding: 10px;
  }

  .filter-fab {
    left: 16px;
    bottom: 18px;
  }

  .search-panel {
    left: 14px;
    bottom: 96px;
    width: min(344px, calc(100vw - 28px));
  }

  .pokedex-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .content-layout.with-detail .pokedex-grid {
    grid-template-columns: 1fr;
  }

  .pokemon-card {
    min-height: 220px;
  }

  .pokemon-image {
    width: min(56%, 280px);
  }

  .energy-mark {
    width: 190px;
    right: -42px;
    bottom: -38px;
  }

  .favorite-btn {
    width: 50px;
    left: 18px;
  }

  .pokemon-name {
    max-width: 60%;
    font-size: 20px;
  }

  .detail-hero {
    min-height: 250px;
  }

  .detail-title {
    font-size: 15px;
  }

  .detail-hero-mark {
    width: 160px;
    height: 160px;
    right: -30px;
    bottom: 14px;
  }

  .detail-cry-toggle {
    width: 42px;
    height: 42px;
    right: 10px;
    bottom: 10px;
  }

  .detail-cry-toggle svg {
    width: 20px;
    height: 20px;
  }

  .detail-content {
    padding: 12px;
  }

  .group30-card {
    min-height: 86px;
    padding: 10px 6px;
    gap: 4px;
  }

  .group30-sprite {
    width: 54px;
    height: 54px;
  }

  .group30-arrow {
    font-size: 1.2rem;
  }

  .detail-info-row {
    grid-template-columns: 1fr;
  }

  .region-name {
    font-size: 1.2rem;
  }

  .stats-label {
    font-size: 1.1rem;
  }

  .stats-value {
    font-size: 0.95rem;
  }

  .detail-description h4 {
    font-size: 1.1rem;
  }

  .detail-description p {
    font-size: 0.92rem;
  }
}
</style>
