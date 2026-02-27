<script setup>
import IconSprites from '../components/IconSprites.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import captureSfxUrl from '../assets/sounds/capture.mp3'
import relacheSfxUrl from '../assets/sounds/relache.mp3'
import { clearAuthSession, getStoredAuthToken, getStoredAuthUser } from '../services/authService'
import { canUseFavorites, loadFavoriteIdsForCurrentUser, saveFavoriteIdsForCurrentUser } from '../services/favoritesService'

const router = useRouter()
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const SEARCH_PAGE_SIZE = 100
const DEFAULT_DESCRIPTION_TEXT = 'Aucune description disponible pour ce Pokemon.'
const BASE_STAT_ORDER = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'ATK' },
  { key: 'defense', label: 'DEF' },
  { key: 'specialAttack', label: 'ATK SPE' },
  { key: 'specialDefense', label: 'DEF SPE' },
  { key: 'speed', label: 'VIT' }
]
const MAX_BASE_STAT_VISUAL = 180
const DETAIL_SECTION_KEYS = ['PROFILE', 'ABILITIES', 'STATS', 'ORIGIN']

const TYPE_COLORS = {
  NORMAL: '#4f5c69',
  FIRE: '#e85d2a',
  WATER: '#4f7fce',
  ELECTRIC: '#dfc44f',
  GRASS: '#46b877',
  ICE: '#67c8ce',
  FIGHTING: '#bf4d4d',
  POISON: '#8f62be',
  GROUND: '#b89963',
  FLYING: '#6e79c7',
  PSYCHIC: '#d672a6',
  BUG: '#5aa261',
  ROCK: '#8f8260',
  GHOST: '#6960ad',
  DRAGON: '#5c6bc2',
  DARK: '#5d4e48',
  STEEL: '#6f7d92',
  FAIRY: '#c47fb3'
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
  'GRASS', 'FIRE', 'WATER', 'FIGHTING', 'NORMAL', 'STEEL',
  'ELECTRIC', 'PSYCHIC', 'DARK', 'DRAGON', 'FAIRY'
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

const ENERGY_ICON_SPRITES = {
  WATER: { id: 'energy-water', viewBox: '0 0 192 203' },
  FIRE: { id: 'energy-fire', viewBox: '0 0 229 239' },
  GRASS: { id: 'energy-grass', viewBox: '0 0 216 242' },
  FIGHTING: { id: 'energy-fighting', viewBox: '0 0 201 220' },
  STEEL: { id: 'energy-steel', viewBox: '0 0 238 208' },
  ELECTRIC: { id: 'energy-electric', viewBox: '0 0 167 236' },
  PSYCHIC: { id: 'energy-psychic', viewBox: '0 0 250 184' },
  DARK: { id: 'energy-dark', viewBox: '0 0 226 196' },
  DRAGON: { id: 'energy-dragon', viewBox: '0 0 217 223' },
  FAIRY: { id: 'energy-fairy', viewBox: '0 0 223 213' },
  NORMAL: { id: 'energy-normal', viewBox: '0 0 206 232' }
}

const authToken = ref('')
const authUser = ref(null)
const pokemons = ref([])
const favoriteIds = ref(new Set())
const favoriteLaunchIds = ref(new Set())
const favoriteShakeIds = ref(new Set())
const favoriteRevealIds = ref(new Set())
const favoriteHiddenIds = ref(new Set())
const favoriteBurstIds = ref(new Set())
const favoriteConcealIds = ref(new Set())
const selectedPokemon = ref(null)
const selectedEvolutions = ref([])
const cryAudioEl = ref(null)
const isCryPlaying = ref(false)
const isDescriptionPlaying = ref(false)
const descriptionSpeechSupported = ref(false)
const activeDetailSection = ref('PROFILE')
const loading = ref(true)
const error = ref(null)
const evolutionFrNameCache = new Map()
const evolutionSequenceCache = new Map()
const regionFallbackImageCache = new Map()
let activeDescriptionUtterance = null
let favoriteCaptureSfx = null
let favoriteReleaseSfx = null

const FAVORITE_LAUNCH_MS = 1000
const FAVORITE_REVEAL_DELAY_MS = 600
const FAVORITE_SHAKE_MS = 1950
const FAVORITE_REVEAL_MS = 400
const FAVORITE_BURST_MS = 700
const FAVORITE_CONCEAL_MS = 520
const favoriteCaptureTimers = new Map()
let favoriteSyncRequestId = 0
let favoritePersistRequestId = 0

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

const getCanonicalType = (type) => {
  const normalized = normalizeToken(type)
  return TYPE_ALIASES[normalized] || normalized
}

const isAuthenticated = computed(() => Boolean(authToken.value))
const username = computed(() => String(authUser.value?.username || '').trim().toUpperCase() || 'NOM')
const role = computed(() => String(authUser.value?.role || 'USER').trim().toUpperCase())

const getDisplayName = (pokemon) => String(pokemon?.displayName || pokemon?.name || '').trim()
const formatPokemonDisplayName = (name, fallback = 'INCONNU') => {
  const value = String(name || fallback).trim().toUpperCase()
  return value === 'ÉVOLI' ? 'EVOLI' : value
}
const getDescriptionText = (pokemon) => {
  const text = String(pokemon?.description || '').trim()
  return text || DEFAULT_DESCRIPTION_TEXT
}
const getPokedexNumber = (pokemon) => {
  const raw = pokemon?.nationalDexNumber ?? pokemon?.regions?.[0]?.regionPokedexNumber
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}
const formatDexNumber = (pokemon) => {
  const dex = getPokedexNumber(pokemon)
  return dex ? `#${String(dex).padStart(4, '0')}` : '-'
}
const getRegionName = (pokemon) => String(pokemon?.regions?.[0]?.regionName || 'REGION')
const formatWeight = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? `${num.toFixed(1)} kg` : '-'
}
const formatHeight = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? `${num.toFixed(1)} m` : '-'
}
const getPrimaryType = (pokemon) => {
  const firstType = Array.isArray(pokemon?.types) ? pokemon.types[0] : ''
  return getCanonicalType(firstType)
}
const getCardColor = (pokemon) => TYPE_COLORS[getPrimaryType(pokemon)] || '#47586b'

const getEnergyType = (pokemon) => {
  const primaryType = getPrimaryType(pokemon)
  const normalized = ENERGY_TYPE_ALIASES[primaryType] || primaryType
  return ENERGY_SUPPORTED_TYPES.has(normalized) ? normalized : 'NORMAL'
}

const getEnergyIconSprite = (pokemon) => {
  const energyType = getEnergyType(pokemon)
  return ENERGY_ICON_SPRITES[energyType] || ENERGY_ICON_SPRITES.NORMAL
}

const getEnergyIconId = (pokemon) => getEnergyIconSprite(pokemon).id
const getEnergyIconViewBox = (pokemon) => getEnergyIconSprite(pokemon).viewBox
const getTypeLabel = (type) => TYPE_LABELS_FR[type] || type || 'INCONNU'
const formatSlugLabel = (value) => {
  const text = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : '-'
}
const getSecondaryTypes = (pokemon) => {
  const types = Array.isArray(pokemon?.types) ? pokemon.types : []
  return types.slice(1).map((type) => getCanonicalType(type))
}
const getAbilityList = (pokemon) => {
  const abilities = Array.isArray(pokemon?.abilities) ? pokemon.abilities : []
  return abilities
    .slice()
    .sort((a, b) => Number(a?.slot || 0) - Number(b?.slot || 0))
    .map((ability) => ({
      name: formatSlugLabel(ability?.name),
      isHidden: Boolean(ability?.isHidden)
    }))
    .filter((ability) => ability.name && ability.name !== '-')
}
const getEggGroupLabel = (pokemon) => {
  const groups = Array.isArray(pokemon?.eggGroups) ? pokemon.eggGroups : []
  if (!groups.length) return '-'
  return groups.map((group) => formatSlugLabel(group)).join(' / ')
}
const getMetaFlags = (pokemon) => {
  const flags = []
  if (pokemon?.isLegendary) flags.push('LEGENDAIRE')
  if (pokemon?.isMythical) flags.push('MYTHIQUE')
  if (pokemon?.isBaby) flags.push('BEBE')
  return flags.length ? flags : ['STANDARD']
}
const getGenderRatio = (pokemon) => {
  const value = Number(pokemon?.genderRate)
  if (!Number.isFinite(value)) return '-'
  if (value < 0) return 'Asexue'
  const femalePercent = Math.round((value / 8) * 100)
  const malePercent = 100 - femalePercent
  return `${malePercent}% M / ${femalePercent}% F`
}
const getCaptureRate = (pokemon) => {
  const value = Number(pokemon?.captureRate)
  return Number.isFinite(value) ? `${value}/255` : '-'
}
const selectedSecondaryTypes = computed(() => getSecondaryTypes(selectedPokemon.value))
const selectedAbilityList = computed(() => getAbilityList(selectedPokemon.value))
const selectedBaseStats = computed(() => getBaseStats(selectedPokemon.value))
const selectedBaseStatEntries = computed(() => getBaseStatEntries(selectedPokemon.value))
const selectedMetaFlags = computed(() => getMetaFlags(selectedPokemon.value))
const selectedRegionName = computed(() => getRegionName(selectedPokemon.value))
const selectedDescriptionText = computed(() => getDescriptionText(selectedPokemon.value))
const selectedPrimaryType = computed(() => getPrimaryType(selectedPokemon.value))
const selectedDetailTypeColor = computed(
  () => TYPE_COLORS[selectedPrimaryType.value] || '#8aa9d8'
)
const selectedEggGroupLabel = computed(() => getEggGroupLabel(selectedPokemon.value))
const selectedCaptureRateLabel = computed(() => getCaptureRate(selectedPokemon.value))
const hasSelectedAbilities = computed(() => selectedAbilityList.value.length > 0)
const getBaseStats = (pokemon) => {
  const base = pokemon?.baseStats && typeof pokemon.baseStats === 'object' ? pokemon.baseStats : {}
  const toSafe = (key) => {
    const value = Number(base?.[key])
    return Number.isFinite(value) ? value : 0
  }
  const hp = toSafe('hp')
  const attack = toSafe('attack')
  const defense = toSafe('defense')
  const specialAttack = toSafe('specialAttack')
  const specialDefense = toSafe('specialDefense')
  const speed = toSafe('speed')
  const totalRaw = Number(base?.total)
  const total =
    Number.isFinite(totalRaw) && totalRaw > 0
      ? totalRaw
      : hp + attack + defense + specialAttack + specialDefense + speed
  return { hp, attack, defense, specialAttack, specialDefense, speed, total }
}
const getBaseStatEntries = (pokemon) => {
  const stats = getBaseStats(pokemon)
  return BASE_STAT_ORDER.map((item) => ({
    key: item.key,
    label: item.label,
    value: Number(stats[item.key]) || 0
  }))
}
const getStatPercent = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return 0
  return Math.max(0, Math.min(100, (num / MAX_BASE_STAT_VISUAL) * 100))
}
const pokemonById = computed(() => {
  const map = new Map()
  for (const pokemon of pokemons.value) {
    const id = String(pokemon?._id || '').trim()
    if (!id || map.has(id)) continue
    map.set(id, pokemon)
  }
  return map
})

const pokemonByDex = computed(() => {
  const map = new Map()
  for (const pokemon of pokemons.value) {
    const dexNumber = getPokedexNumber(pokemon)
    if (!Number.isFinite(dexNumber) || map.has(dexNumber)) continue
    map.set(dexNumber, pokemon)
  }
  return map
})

const pokemonByNormalizedName = computed(() => {
  const map = new Map()
  for (const pokemon of pokemons.value) {
    const displayName = normalizeToken(getDisplayName(pokemon))
    const baseName = normalizeToken(pokemon?.name || '')
    if (displayName && !map.has(displayName)) map.set(displayName, pokemon)
    if (baseName && !map.has(baseName)) map.set(baseName, pokemon)
  }
  return map
})
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

const getOfficialArtworkUrl = (dexNumber) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNumber}.png`
const formatEvolutionName = (name) =>
  String(name || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Inconnu'
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
  if (evolutionFrNameCache.has(id)) return evolutionFrNameCache.get(id)

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
    // fallback below
  }

  const fallback = String(fallbackName || '').trim()
  if (fallback) evolutionFrNameCache.set(id, fallback)
  return fallback
}
const findNodeAndLineage = (node, targetId, lineage = []) => {
  if (!node) return null

  const currentSpecies = getSpeciesFromNode(node)
  const currentLineage = [...lineage, currentSpecies]
  if (currentSpecies.id === targetId) return { node, lineage: currentLineage }

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
      ? [{ name: String(pokemon?.name || 'Inconnu'), sprite: fallbackSprite, dexNumber: null }]
      : []
  }

  const first = Math.max(1, currentDex - 2)
  const second = Math.max(1, currentDex - 1)
  return [
    { name: `#${first}`, sprite: getOfficialArtworkUrl(first), dexNumber: first },
    { name: `#${second}`, sprite: getOfficialArtworkUrl(second), dexNumber: second },
    {
      name: String(pokemon?.name || `#${currentDex}`),
      sprite: getOfficialArtworkUrl(currentDex),
      dexNumber: currentDex
    }
  ]
}
const loadEvolutionSprites = async (pokemon) => {
  selectedEvolutions.value = []

  const speciesId = getPokedexNumber(pokemon)
  if (!speciesId) {
    selectedEvolutions.value = getFallbackEvolutions(pokemon)
    return
  }

  if (evolutionSequenceCache.has(speciesId)) {
    selectedEvolutions.value = evolutionSequenceCache.get(speciesId)
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
    const evolutionsResolved = await Promise.all(
      sequence.map(async (item) => {
        const id = Number(item?.id)
        const sprite = Number.isFinite(id) ? getOfficialArtworkUrl(id) : ''
        const name = await getFrenchSpeciesName(id, item?.name || '')
        return { name, sprite, dexNumber: Number.isFinite(id) ? id : null }
      })
    )

    const evolutions = evolutionsResolved.filter((item) => item.sprite)
    const limited = (evolutions.length ? evolutions : getFallbackEvolutions(pokemon)).slice(0, 3)
    evolutionSequenceCache.set(speciesId, limited)
    selectedEvolutions.value = limited
  } catch {
    const fallback = getFallbackEvolutions(pokemon).slice(0, 3)
    evolutionSequenceCache.set(speciesId, fallback)
    selectedEvolutions.value = fallback
  }
}
const openEvolutionDetails = (evolution) => {
  const dexNumber = Number(evolution?.dexNumber)
  const normalizedEvolutionName = normalizeToken(evolution?.name || '')

  const pokemonByDexMatch = Number.isFinite(dexNumber)
    ? pokemonByDex.value.get(dexNumber)
    : null
  const pokemonByNameMatch =
    !pokemonByDexMatch && normalizedEvolutionName
      ? pokemonByNormalizedName.value.get(normalizedEvolutionName)
      : null

  const targetPokemon = pokemonByDexMatch || pokemonByNameMatch
  if (targetPokemon) openDetails(targetPokemon)
}

const getRegionImageUrl = (pokemon) => {
  const apiImageUrl = String(pokemon?.regions?.[0]?.regionImageUrl || '').trim()
  if (apiImageUrl) return apiImageUrl

  const regionName = getRegionName(pokemon)
  const regionKey = normalizeToken(regionName)
  if (regionFallbackImageCache.has(regionKey)) {
    return regionFallbackImageCache.get(regionKey)
  }

  const regionLabel = regionName
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
      <text x="480" y="320" text-anchor="middle" fill="#111111" font-size="94" font-family="Poppins, Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="2">${regionLabel}</text>
    </svg>
  `
  const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  regionFallbackImageCache.set(regionKey, dataUrl)
  return dataUrl
}

const favoritePokemons = computed(() => {
  if (!favoriteIds.value.size || !pokemons.value.length) return []
  return [...favoriteIds.value]
    .map((id) => pokemonById.value.get(String(id)))
    .filter(Boolean)
})

// ─── Filter state ─────────────────────────────────────────────────
const profileSearchOpen = ref(false)
const profileSearchName = ref('')
const profileFilterType = ref('ALL')
const profileFilterRegion = ref('ALL')
const profileSortBy = ref('DEFAULT')

const getSortablePokemonName = (pokemon) => {
  const display = String(pokemon?.displayName || '').trim()
  if (display) return display
  return String(pokemon?.name || '').trim()
}

const isProfileFilterActive = computed(() =>
  Boolean(profileSearchName.value) ||
  profileFilterType.value !== 'ALL' ||
  profileFilterRegion.value !== 'ALL' ||
  profileSortBy.value !== 'DEFAULT'
)

const favoritesSearchIndex = computed(() =>
  favoritePokemons.value.map((pokemon) => {
    const sortableName = getSortablePokemonName(pokemon)
    const normalizedName = normalizeToken(sortableName || pokemon?.name || '')
    const normalizedRegion = normalizeToken(pokemon?.regions?.[0]?.regionName || '')
    const canonicalTypes = (Array.isArray(pokemon?.types) ? pokemon.types : [])
      .map((type) => getCanonicalType(type))
      .filter(Boolean)
    const dexValue = Number(pokemon?.regions?.[0]?.regionPokedexNumber)
    const dexAsc = Number.isFinite(dexValue) ? dexValue : Number.POSITIVE_INFINITY
    const dexDesc = Number.isFinite(dexValue) ? dexValue : Number.NEGATIVE_INFINITY

    return { pokemon, sortableName, normalizedName, normalizedRegion, canonicalTypes, dexAsc, dexDesc }
  })
)

const profileAvailableTypes = computed(() => {
  const knownTypes = new Set()
  for (const entry of favoritesSearchIndex.value) {
    for (const type of entry.canonicalTypes) {
      if (type) knownTypes.add(type)
    }
  }
  return [...knownTypes].sort((a, b) => getTypeLabel(a).localeCompare(getTypeLabel(b), 'fr', { sensitivity: 'base' }))
})

const profileAvailableRegions = computed(() => {
  const knownRegions = new Map()
  for (const pokemon of favoritePokemons.value) {
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

const filteredFavoritePokemons = computed(() => {
  const nameFilter = normalizeToken(profileSearchName.value)
  const typeFilter = profileFilterType.value
  const regionFilter = profileFilterRegion.value

  const entries = favoritesSearchIndex.value.filter((entry) => {
    const matchesName = !nameFilter || entry.normalizedName.includes(nameFilter)
    const matchesType = typeFilter === 'ALL' || entry.canonicalTypes.includes(typeFilter)
    const matchesRegion = regionFilter === 'ALL' || entry.normalizedRegion === regionFilter
    return matchesName && matchesType && matchesRegion
  })

  if (profileSortBy.value === 'NAME_ASC') {
    return [...entries].sort((a, b) => a.sortableName.localeCompare(b.sortableName, 'fr', { sensitivity: 'base' })).map((e) => e.pokemon)
  }
  if (profileSortBy.value === 'NAME_DESC') {
    return [...entries].sort((a, b) => b.sortableName.localeCompare(a.sortableName, 'fr', { sensitivity: 'base' })).map((e) => e.pokemon)
  }
  if (profileSortBy.value === 'DEX_ASC') {
    return [...entries].sort((a, b) => a.dexAsc - b.dexAsc).map((e) => e.pokemon)
  }
  if (profileSortBy.value === 'DEX_DESC') {
    return [...entries].sort((a, b) => b.dexDesc - a.dexDesc).map((e) => e.pokemon)
  }

  return entries.map((e) => e.pokemon)
})

const resetProfileFilters = () => {
  profileSearchName.value = ''
  profileFilterType.value = 'ALL'
  profileFilterRegion.value = 'ALL'
  profileSortBy.value = 'DEFAULT'
}

const syncAuthState = async () => {
  authToken.value = getStoredAuthToken()
  authUser.value = getStoredAuthUser()

  if (!canUseFavorites()) {
    favoriteIds.value = new Set()
    return
  }

  const requestId = ++favoriteSyncRequestId
  const loaded = await loadFavoriteIdsForCurrentUser()
  if (requestId !== favoriteSyncRequestId) return
  favoriteIds.value = loaded

  if (
    selectedPokemon.value?._id &&
    !favoriteIds.value.has(String(selectedPokemon.value._id))
  ) {
    selectedPokemon.value = null
  }
}

const handleAuthStateSync = () => {
  void syncAuthState()
}

const fetchPokemons = async () => {
  loading.value = true
  error.value = null

  try {
    let page = 1
    let keepGoing = true
    const allPokemons = []

    while (keepGoing) {
      const response = await fetch(
        `${apiBaseUrl}/api/pkmn/search?page=${page}&size=${SEARCH_PAGE_SIZE}`
      )

      if (!response.ok) {
        throw new Error('Erreur lors de la recuperation des pokemon')
      }

      const payload = await response.json()
      const pageData = Array.isArray(payload?.data) ? payload.data : []
      allPokemons.push(...pageData)

      const totalCount = Number(payload?.count)
      const reachedEndByCount = Number.isFinite(totalCount) && allPokemons.length >= totalCount
      const reachedEndByPage = pageData.length < SEARCH_PAGE_SIZE

      if (reachedEndByCount || reachedEndByPage) {
        keepGoing = false
      } else {
        page += 1
      }
    }

    pokemons.value = allPokemons
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur inconnue'
    pokemons.value = []
  } finally {
    loading.value = false
  }
}

const openDetails = (pokemon) => {
  if (!pokemon) return
  if (selectedPokemon.value?._id !== pokemon?._id) {
    activeDetailSection.value = DETAIL_SECTION_KEYS[0]
  }
  selectedPokemon.value = pokemon
}

const closeDetails = () => {
  stopCryPlayback()
  stopDescriptionPlayback()
  selectedEvolutions.value = []
  selectedPokemon.value = null
}

const setFavoriteLaunchVector = (triggerElement) => {
  if (!(triggerElement instanceof HTMLElement)) return

  const card = triggerElement.closest('.favorite-card')
  const detailHero = triggerElement.closest('.detail-hero')
  const targetImage = card?.querySelector('.card-image') || detailHero?.querySelector('.detail-hero-image')
  if (!(targetImage instanceof HTMLElement)) return

  const ballRect = triggerElement.getBoundingClientRect()
  const imageRect = targetImage.getBoundingClientRect()
  const launchX = imageRect.left + imageRect.width / 2 - (ballRect.left + ballRect.width / 2)
  const launchY = imageRect.top + imageRect.height / 2 - (ballRect.top + ballRect.height / 2)

  triggerElement.style.setProperty('--favorite-catch-x', `${launchX.toFixed(1)}px`)
  triggerElement.style.setProperty('--favorite-catch-y', `${launchY.toFixed(1)}px`)
}

const isFavorite = (id) => Boolean(id) && favoriteIds.value.has(String(id))
const isFavoriteLaunching = (id) => Boolean(id) && favoriteLaunchIds.value.has(String(id))
const isFavoriteShaking = (id) => Boolean(id) && favoriteShakeIds.value.has(String(id))
const isFavoriteRevealing = (id) => Boolean(id) && favoriteRevealIds.value.has(String(id))
const isFavoriteHidden = (id) => Boolean(id) && favoriteHiddenIds.value.has(String(id))
const isFavoriteBursting = (id) => Boolean(id) && favoriteBurstIds.value.has(String(id))
const isFavoriteConcealing = (id) => Boolean(id) && favoriteConcealIds.value.has(String(id))
const isFavoriteCapturing = (id) =>
  isFavoriteLaunching(id) || isFavoriteShaking(id) || isFavoriteRevealing(id) || isFavoriteBursting(id)
const isFavoriteAnimating = (id) => isFavoriteCapturing(id) || isFavoriteConcealing(id)
const isFavoriteBallClosed = (id) => isFavorite(id) || isFavoriteAnimating(id)
const shouldUseSilhouette = (id) => !isFavorite(id)

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
  updateAnimatedSet(favoriteLaunchIds, normalizedId, false)
  updateAnimatedSet(favoriteShakeIds, normalizedId, false)
  updateAnimatedSet(favoriteRevealIds, normalizedId, false)
  updateAnimatedSet(favoriteHiddenIds, normalizedId, false)
  updateAnimatedSet(favoriteBurstIds, normalizedId, false)
  updateAnimatedSet(favoriteConcealIds, normalizedId, false)
}

const persistFavoriteIds = async () => {
  const requestId = ++favoritePersistRequestId
  const persisted = await saveFavoriteIdsForCurrentUser(favoriteIds.value)
  if (requestId !== favoritePersistRequestId) return
  favoriteIds.value = persisted
}

const startFavoriteCapture = (id, triggerElement = null) => {
  const normalizedId = String(id)
  clearFavoriteCapture(normalizedId)
  setFavoriteLaunchVector(triggerElement)
  playFavoriteSfx('capture')
  updateAnimatedSet(favoriteLaunchIds, normalizedId, true)

  const revealStartTimer = window.setTimeout(() => {
    updateAnimatedSet(favoriteRevealIds, normalizedId, true)
  }, FAVORITE_REVEAL_DELAY_MS)
  registerFavoriteTimer(normalizedId, revealStartTimer)

  const revealCompleteTimer = window.setTimeout(() => {
    updateAnimatedSet(favoriteHiddenIds, normalizedId, true)
    updateAnimatedSet(favoriteRevealIds, normalizedId, false)
  }, FAVORITE_REVEAL_DELAY_MS + FAVORITE_REVEAL_MS)
  registerFavoriteTimer(normalizedId, revealCompleteTimer)

  const launchTimer = window.setTimeout(() => {
    updateAnimatedSet(favoriteLaunchIds, normalizedId, false)
    updateAnimatedSet(favoriteShakeIds, normalizedId, true)

    const shakeTimer = window.setTimeout(() => {
      updateAnimatedSet(favoriteShakeIds, normalizedId, false)
      const next = new Set(favoriteIds.value)
      next.add(normalizedId)
      favoriteIds.value = next
      void persistFavoriteIds()
      updateAnimatedSet(favoriteHiddenIds, normalizedId, false)
      updateAnimatedSet(favoriteBurstIds, normalizedId, true)

      const burstTimer = window.setTimeout(() => {
        updateAnimatedSet(favoriteBurstIds, normalizedId, false)
        favoriteCaptureTimers.delete(normalizedId)
      }, FAVORITE_BURST_MS)
      registerFavoriteTimer(normalizedId, burstTimer)
    }, FAVORITE_SHAKE_MS)
    registerFavoriteTimer(normalizedId, shakeTimer)
  }, FAVORITE_LAUNCH_MS)
  registerFavoriteTimer(normalizedId, launchTimer)
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
    void persistFavoriteIds()
    updateAnimatedSet(favoriteConcealIds, normalizedId, false)
    favoriteCaptureTimers.delete(normalizedId)

    if (selectedPokemon.value?._id && String(selectedPokemon.value._id) === normalizedId) {
      selectedPokemon.value = null
    }
  }, FAVORITE_CONCEAL_MS)

  registerFavoriteTimer(normalizedId, concealTimer)
}

const toggleFavorite = (id, event) => {
  if (!id) return
  if (!canUseFavorites()) {
    router.push('/connexion')
    return
  }

  const normalizedId = String(id)
  if (isFavoriteAnimating(normalizedId)) return

  if (favoriteIds.value.has(normalizedId)) {
    startFavoriteRelease(normalizedId)
  } else {
    startFavoriteCapture(normalizedId, event?.currentTarget)
  }
}

const logout = async () => {
  clearAuthSession()
  favoriteSyncRequestId += 1
  favoritePersistRequestId += 1
  for (const timers of favoriteCaptureTimers.values()) {
    for (const timerId of timers) {
      window.clearTimeout(timerId)
    }
  }
  favoriteCaptureTimers.clear()
  favoriteLaunchIds.value = new Set()
  favoriteShakeIds.value = new Set()
  favoriteRevealIds.value = new Set()
  favoriteHiddenIds.value = new Set()
  favoriteBurstIds.value = new Set()
  favoriteConcealIds.value = new Set()
  favoriteIds.value = new Set()
  selectedPokemon.value = null
  await router.push('/connexion')
}

onMounted(async () => {
  descriptionSpeechSupported.value = supportsDescriptionSpeech()
  favoriteCaptureSfx = createFavoriteAudio(captureSfxUrl)
  favoriteReleaseSfx = createFavoriteAudio(relacheSfxUrl)
  await syncAuthState()
  if (!isAuthenticated.value) {
    await router.replace('/connexion')
    return
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleAuthStateSync)
    window.addEventListener('focus', handleAuthStateSync)
  }

  await fetchPokemons()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleAuthStateSync)
    window.removeEventListener('focus', handleAuthStateSync)
  }
  document.body.classList.remove('detail-panel-open')
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
      activeDetailSection.value = DETAIL_SECTION_KEYS[0]
    }

    if (!pokemon) {
      document.body.classList.remove('detail-panel-open')
      selectedEvolutions.value = []
      return
    }

    document.body.classList.add('detail-panel-open')
    await loadEvolutionSprites(pokemon)
  },
  { immediate: true }
)
</script>

<template>
  <main class="profile-page">
    <IconSprites />

    <section class="profile-left">
      <div class="profile-user-block">
        <h1>{{ username }}</h1>
        <p>{{ role }}</p>
      </div>

      <svg class="profile-watermark" viewBox="0 0 205 205" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M64.1523 108.333C66.8482 127.179 83.0531 141.667 102.645 141.667C122.236 141.667 138.441 127.179 141.137 108.333H204.702C201.679 162.228 157.018 205 102.366 205C47.7147 205 3.05479 162.228 0.03125 108.333H64.1523ZM102.366 0C157.205 0 201.986 43.0655 204.733 97.2217H141.137C138.441 78.3761 122.236 63.8887 102.645 63.8887C83.0534 63.8887 66.8486 78.3761 64.1523 97.2217H0C2.74719 43.0656 47.5275 0.00023688 102.366 0Z" fill="white" fill-opacity="0.3"/>
        <circle cx="102.644" cy="102.778" r="19.4445" fill="white" fill-opacity="0.3"/>
      </svg>

      <button type="button" class="logout-btn" @click="logout">DECONNEXION</button>
    </section>

    <section class="profile-right">
      <div class="profile-content-layout" :class="{ 'with-detail': selectedPokemon }">
        <div class="profile-favorites-area">
          <h2 class="favorites-title">VOS CAPTURES</h2>

          <div v-if="loading" class="profile-state">Chargement de vos captures...</div>
          <div v-else-if="error" class="profile-state error">{{ error }}</div>
          <div v-else-if="!favoritePokemons.length" class="profile-state">
            Aucun pokemon capturés.
          </div>
          <div v-else-if="!filteredFavoritePokemons.length" class="profile-state">
            Aucun résultat pour ces filtres.
          </div>

          <div v-else class="favorites-grid">
            <article
              v-for="pokemon in filteredFavoritePokemons"
              :key="pokemon._id"
              class="favorite-card"
              :style="{ '--card-bg': getCardColor(pokemon) }"
              role="button"
              tabindex="0"
              @click="openDetails(pokemon)"
              @keydown.enter.prevent="openDetails(pokemon)"
              @keydown.space.prevent="openDetails(pokemon)"
            >
              <svg
                class="card-energy-mark"
                :viewBox="getEnergyIconViewBox(pokemon)"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <use :href="'#' + getEnergyIconId(pokemon)" />
              </svg>

              <h3 class="card-name">{{ formatPokemonDisplayName(getDisplayName(pokemon), 'INCONNU') }}</h3>

              <button
                type="button"
                class="card-favorite-btn"
                :class="{
                  active: isFavorite(pokemon._id),
                  'is-launching': isFavoriteLaunching(pokemon._id),
                  'is-catching': isFavoriteShaking(pokemon._id),
                  'is-bursting': isFavoriteBursting(pokemon._id),
                  'is-releasing': isFavoriteConcealing(pokemon._id)
                }"
                :aria-label="
                  isFavoriteAnimating(pokemon._id)
                    ? 'Animation en cours'
                    : isFavorite(pokemon._id)
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                "
                @click.stop="toggleFavorite(pokemon._id, $event)"
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
                  <use href="#icon-pokeball-open" />
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
                  <use href="#icon-pokeball-closed" />
                </svg>
              </button>

              <img
                class="card-image"
                :class="{
                  silhouette: shouldUseSilhouette(pokemon._id),
                  revealing: isFavoriteRevealing(pokemon._id),
                  'capture-hidden': isFavoriteHidden(pokemon._id)
                }"
                :src="pokemon.imgUrl"
                :alt="getDisplayName(pokemon) || 'Pokemon'"
                loading="lazy"
                decoding="async"
              />
              <img
                v-if="isFavoriteConcealing(pokemon._id)"
                class="card-image-conceal"
                :src="pokemon.imgUrl"
                :alt="''"
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
            </article>
          </div>
        </div><!-- /profile-favorites-area -->

        <!-- Filter FAB -->
        <button
          type="button"
          class="profile-filter-fab"
          :class="{ active: profileSearchOpen }"
          @click="profileSearchOpen = !profileSearchOpen"
          :aria-label="profileSearchOpen ? 'Fermer les filtres' : 'Ouvrir les filtres'"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              v-if="!profileSearchOpen"
              d="M4 5h16l-6.2 7.1v5.3l-3.6 1.8v-7.1L4 5z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path v-else d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <!-- Search panel -->
        <div class="profile-search-panel" :class="{ open: profileSearchOpen }" role="search">
          <div class="profile-search-head">
            <h4>FILTRES</h4>
            <button
              type="button"
              class="profile-search-reset"
              :disabled="!isProfileFilterActive"
              @click="resetProfileFilters"
            >RESET</button>
          </div>

          <div class="profile-search-field profile-search-field--full">
            <label for="profile-search-name">Recherche par nom</label>
            <input
              id="profile-search-name"
              type="search"
              v-model="profileSearchName"
              placeholder="Ex: Bulbizarre"
              class="profile-search-input"
              autocomplete="off"
            />
          </div>

          <div class="profile-search-fields-grid">
            <div class="profile-search-field">
              <label for="profile-filter-type">Type</label>
              <select id="profile-filter-type" v-model="profileFilterType">
                <option value="ALL">Tous les types</option>
                <option v-for="type in profileAvailableTypes" :key="type" :value="type">
                  {{ TYPE_LABELS_FR[type] || type }}
                </option>
              </select>
            </div>
            <div class="profile-search-field">
              <label for="profile-filter-region">Région</label>
              <select id="profile-filter-region" v-model="profileFilterRegion">
                <option value="ALL">Toutes les régions</option>
                <option v-for="r in profileAvailableRegions" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
            </div>
          </div>
          <div class="profile-search-field">
            <label for="profile-sort-by">Tri</label>
            <select id="profile-sort-by" v-model="profileSortBy">
              <option value="DEFAULT">Par défaut</option>
              <option value="NAME_ASC">Nom A-Z</option>
              <option value="NAME_DESC">Nom Z-A</option>
              <option value="DEX_ASC">Pokédex croissant</option>
              <option value="DEX_DESC">Pokédex décroissant</option>
            </select>
          </div>

          <small>{{ filteredFavoritePokemons.length }} / {{ favoritePokemons.length }} favoris</small>
        </div>

        <div class="profile-detail-slot" :class="{ open: selectedPokemon }">
          <Transition name="profile-detail">
        <aside v-if="selectedPokemon" class="profile-detail-panel">
          <div class="detail-hero" :style="{ '--hero-bg': getCardColor(selectedPokemon) }">
            <div class="detail-head-row">
              <button class="detail-close" type="button" @click="closeDetails" aria-label="Fermer">
                ×
              </button>

              <h3 class="detail-title">
                {{ formatPokemonDisplayName(getDisplayName(selectedPokemon), 'INCONNU') }}
              </h3>

              <button
                class="detail-ball-toggle"
                :class="{
                  active: isFavorite(selectedPokemon?._id),
                  'is-launching': isFavoriteLaunching(selectedPokemon?._id),
                  'is-catching': isFavoriteShaking(selectedPokemon?._id),
                  'is-bursting': isFavoriteBursting(selectedPokemon?._id),
                  'is-releasing': isFavoriteConcealing(selectedPokemon?._id)
                }"
                type="button"
                @click="toggleFavorite(selectedPokemon?._id, $event)"
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
                  <use href="#icon-pokeball-open" />
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
                  <use href="#icon-pokeball-closed" />
                </svg>
              </button>
            </div>

            <svg
              class="detail-energy-mark"
              :viewBox="getEnergyIconViewBox(selectedPokemon)"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <use :href="'#' + getEnergyIconId(selectedPokemon)" />
            </svg>

            <img
              class="detail-hero-image"
              :class="{
                silhouette: shouldUseSilhouette(selectedPokemon?._id),
                revealing: isFavoriteRevealing(selectedPokemon?._id),
                'capture-hidden': isFavoriteHidden(selectedPokemon?._id)
              }"
              :src="selectedPokemon.imgUrl"
              :alt="getDisplayName(selectedPokemon) || 'Pokemon'"
              loading="lazy"
              decoding="async"
            />
            <img
              v-if="isFavoriteConcealing(selectedPokemon?._id)"
              class="detail-hero-image-conceal"
              :src="selectedPokemon.imgUrl"
              :alt="''"
              loading="lazy"
              decoding="async"
              aria-hidden="true"
            />

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

            <audio
              ref="cryAudioEl"
              class="cry-audio"
              preload="none"
              @ended="syncCryAudioState"
              @pause="syncCryAudioState"
              @play="syncCryAudioState"
            />
          </div>

          <div class="detail-body">
            <nav class="detail-section-tabs" aria-label="Sections informations du pokemon">
              <button
                type="button"
                class="detail-section-tab"
                :class="{ active: activeDetailSection === 'PROFILE' }"
                @click="activeDetailSection = 'PROFILE'"
              >
                PROFIL
              </button>
              <button
                type="button"
                class="detail-section-tab"
                :class="{ active: activeDetailSection === 'ABILITIES' }"
                @click="activeDetailSection = 'ABILITIES'"
              >
                TALENTS
              </button>
              <button
                type="button"
                class="detail-section-tab"
                :class="{ active: activeDetailSection === 'STATS' }"
                @click="activeDetailSection = 'STATS'"
              >
                STATS
              </button>
              <button
                type="button"
                class="detail-section-tab"
                :class="{ active: activeDetailSection === 'ORIGIN' }"
                @click="activeDetailSection = 'ORIGIN'"
              >
                ORIGINE
              </button>
            </nav>

            <Transition name="detail-tab" mode="out-in">
              <article
                v-if="activeDetailSection === 'PROFILE'"
                key="detail-profile"
                class="detail-card detail-info-card detail-tab-panel"
              >
                <div class="detail-card-head">
                  <h4>PROFIL</h4>
                  <span class="detail-dex-tag">{{ formatDexNumber(selectedPokemon) }}</span>
                </div>

                <div class="detail-type-row">
                  <span class="detail-type-pill" :style="{ '--type-pill-bg': selectedDetailTypeColor }">
                    {{ getTypeLabel(selectedPrimaryType) }}
                  </span>
                  <span
                    v-for="type in selectedSecondaryTypes"
                    :key="`${selectedPokemon._id}-type-${type}`"
                    class="detail-type-chip"
                    :style="{ '--type-pill-bg': TYPE_COLORS[type] || '#8aa9d8' }"
                  >
                    {{ getTypeLabel(type) }}
                  </span>
                </div>

                <dl class="detail-kv-grid">
                  <div>
                    <dt>TAILLE</dt>
                    <dd>{{ formatHeight(selectedPokemon.height) }}</dd>
                  </div>
                  <div>
                    <dt>POIDS</dt>
                    <dd>{{ formatWeight(selectedPokemon.weight) }}</dd>
                  </div>
                  <div>
                    <dt>EXP. BASE</dt>
                    <dd>{{ selectedBaseExperience }}</dd>
                  </div>
                  <div>
                    <dt>GENRE</dt>
                    <dd>{{ getGenderRatio(selectedPokemon) }}</dd>
                  </div>
                </dl>
              </article>

              <article
                v-else-if="activeDetailSection === 'ABILITIES'"
                key="detail-abilities"
                class="detail-card detail-info-card detail-tab-panel"
              >
                <div class="detail-card-head">
                  <h4>TALENTS</h4>
                </div>

                <ul class="detail-ability-list">
                  <li
                    v-for="ability in selectedAbilityList"
                    :key="`${selectedPokemon._id}-ability-${ability.name}`"
                  >
                    <span>{{ ability.name }}</span>
                    <small v-if="ability.isHidden">CACHE</small>
                  </li>
                  <li v-if="!hasSelectedAbilities" class="detail-muted">-</li>
                </ul>

                <div class="detail-subline">
                  <span>GROUPES OEUF</span>
                  <strong>{{ selectedEggGroupLabel }}</strong>
                </div>
              </article>

              <article
                v-else-if="activeDetailSection === 'STATS'"
                key="detail-stats"
                class="detail-card detail-info-card detail-tab-panel"
              >
                <div class="detail-card-head">
                  <h4>STATS</h4>
                  <span class="detail-total-tag">TOTAL {{ selectedBaseStats.total }}</span>
                </div>

                <ul class="detail-stat-list">
                  <li
                    v-for="stat in selectedBaseStatEntries"
                    :key="`${selectedPokemon._id}-stat-${stat.key}`"
                  >
                    <span class="detail-stat-label">{{ stat.label }}</span>
                    <span class="detail-stat-track" aria-hidden="true">
                      <span class="detail-stat-fill" :style="{ width: `${getStatPercent(stat.value)}%` }"></span>
                    </span>
                    <strong class="detail-stat-value">{{ stat.value }}</strong>
                  </li>
                </ul>
              </article>

              <article v-else key="detail-origin" class="detail-card detail-info-card detail-tab-panel">
                <div class="detail-card-head">
                  <h4>ORIGINE</h4>
                </div>

                <div class="origin-layout">
                  <article class="region-card">
                    <img
                      class="region-map-image"
                      :src="getRegionImageUrl(selectedPokemon)"
                      :alt="`Carte ${selectedRegionName}`"
                      loading="lazy"
                      decoding="async"
                    />
                    <span class="region-name">{{ selectedRegionName.toUpperCase() }}</span>
                  </article>

                  <div class="origin-right">
                    <dl class="detail-kv-grid compact">
                      <div>
                        <dt>GENERATION</dt>
                        <dd>{{ formatSlugLabel(selectedPokemon?.generation) }}</dd>
                      </div>
                      <div>
                        <dt>HABITAT</dt>
                        <dd>{{ formatSlugLabel(selectedPokemon?.habitat) }}</dd>
                        <div class="detail-flag-row" v-if="selectedMetaFlags?.length">
                          <span v-for="flag in selectedMetaFlags" :key="`${selectedPokemon._id}-flag-${flag}`">
                            {{ flag }}
                          </span>
                        </div>
                      </div>
                      <div>
                        <dt>CROISSANCE</dt>
                        <dd>{{ formatSlugLabel(selectedPokemon?.growthRate) }}</dd>
                      </div>
                      <div>
                        <dt>CAPTURE</dt>
                        <dd>{{ selectedCaptureRateLabel }}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            </Transition>

            <div class="detail-lower-grid">
              <div class="group30-card">
                <template
                  v-for="(evolution, spriteIndex) in selectedEvolutions"
                  :key="`${selectedPokemon._id}-evo-${evolution.name || spriteIndex}`"
                >
                  <button
                    type="button"
                    class="group30-evo"
                    :title="formatEvolutionName(evolution.name)"
                    :aria-label="`Voir ${formatEvolutionName(evolution.name)}`"
                    @click="openEvolutionDetails(evolution)"
                  >
                    <img
                      class="group30-sprite"
                      :class="{ silhouette: shouldUseSilhouette(selectedPokemon?._id) }"
                      :src="evolution.sprite"
                      :alt="formatEvolutionName(evolution.name)"
                      loading="lazy"
                      decoding="async"
                    />
                    <span class="group30-name">{{ formatEvolutionName(evolution.name) }}</span>
                  </button>
                  <span v-if="spriteIndex < selectedEvolutions.length - 1" class="group30-arrow" aria-hidden="true">
                    →
                  </span>
                </template>
              </div>

              <article class="detail-description">
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
                <p>{{ selectedDescriptionText }}</p>
              </article>
            </div>
          </div>
        </aside>
          </Transition>
        </div><!-- /profile-detail-slot -->
      </div><!-- /profile-content-layout -->
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  height: 100dvh;
  width: min(100%, 1728px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(280px, 36%) minmax(0, 1fr);
  background: transparent;
  overflow: hidden;
}

.icon-sprite-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.profile-left {
  background: linear-gradient(160deg, #0e1015 0%, #111520 100%);
  border-right: 1px solid rgba(255,255,255,0.07);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: clamp(24px, 4.2vh, 52px) clamp(16px, 2.5vw, 40px);
  position: relative;
  overflow: hidden;
}

.profile-left::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(200,20,50,0.08) 0%, transparent 50%);
  pointer-events: none;
}

.profile-user-block {
  margin-top: clamp(30px, 8vh, 90px);
  text-align: center;
  position: relative;
  z-index: 1;
}

.profile-user-block h1 {
  margin: 0;
  color: #f0f8ff;
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-size: clamp(1.8rem, 2.8vw, 3.2rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 0.92;
  font-weight: 700;
  text-shadow: 0 2px 16px rgba(200,30,50,0.25);
}

.profile-user-block p {
  margin: 12px 0 0;
  color: rgba(150,200,255,0.65);
  font-family: 'Rajdhani', 'Poppins', sans-serif;
  font-size: clamp(0.85rem, 1.2vw, 1.1rem);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  padding: 3px 12px;
  background: rgba(255,255,255,0.05);
  display: inline-block;
}


.profile-watermark {
  width: min(60%, 300px);
  height: auto;
  opacity: 0.12;
  position: relative;
  z-index: 1;
}

.logout-btn {
  width: min(100%, 380px);
  min-height: clamp(52px, 7vh, 72px);
  border: 1px solid rgba(200,20,40,0.45);
  border-radius: 16px;
  background: rgba(200,20,40,0.2);
  backdrop-filter: blur(10px);
  color: rgba(255,160,170,0.9);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: clamp(1rem, 1.4vw, 1.4rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  font-weight: 700;
  position: relative;
  z-index: 1;
  transition: background 200ms ease, border-color 200ms ease, transform 160ms ease;
}

.logout-btn:hover {
  background: rgba(200,20,40,0.35);
  border-color: rgba(200,20,40,0.7);
}

.logout-btn:active {
  transform: scale(0.97);
}

.profile-right {
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: clamp(16px, 2.6vh, 32px) clamp(12px, 2vw, 32px);
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
}

.profile-content-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  flex: 1;
}

.profile-content-layout.with-detail {
  grid-template-columns: minmax(0, 1fr) auto;
}

.profile-favorites-area {
  display: grid;
  align-content: start;
  gap: 16px;
  min-width: 0;
}

.profile-detail-slot {
  width: 0;
  overflow: hidden;
  pointer-events: none;
  transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.profile-detail-slot.open {
  width: clamp(300px, 28vw, 420px);
  overflow: visible;
  pointer-events: auto;
}

.favorites-title {
  margin: 0;
  text-align: left;
  color: rgba(200,235,255,0.9);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: clamp(1.4rem, 2.6vw, 2.8rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

.profile-state {
  min-height: 200px;
  border-radius: 18px;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(160,210,255,0.7);
  font-family: 'Poppins',sans-serif;
  font-weight: 600;
  display: grid;
  place-items: center;
  padding: 20px;
}

.profile-state.error {
  color: #ff8090;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-content: start;
}

.favorite-card {
  --card-bg: #435467;
  position: relative;
  min-height: 220px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--card-bg) 55%, rgba(255,255,255,0.3));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--card-bg) 28%, transparent) 0%, color-mix(in srgb, var(--card-bg) 14%, transparent) 100%);
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18);
  content-visibility: auto;
  contain-intrinsic-size: 250px;
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 240ms ease;
}

.favorite-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%);
  border-radius: 24px 24px 0 0;
  pointer-events: none;
}

.favorite-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22);
}

.card-energy-mark {
  width: clamp(150px, 16vw, 238px);
  position: absolute;
  right: -56px;
  bottom: -42px;
  pointer-events: none;
  opacity: 0.95;
  z-index: 0;
}

.card-name {
  margin: 24px 18px 0;
  color: #ffffff;
  text-transform: uppercase;
  font-family: 'Rajdhani','Astra','Poppins',sans-serif;
  font-size: clamp(1rem, 1.4vw, 1.6rem);
  letter-spacing: 0.07em;
  font-weight: 700;
  line-height: 1;
  max-width: 62%;
  text-shadow: 0 1px 4px rgba(0,0,0,0.4);
  position: relative;
  z-index: 1;
}

.card-favorite-btn {
  position: absolute;
  left: 14px;
  bottom: 12px;
  width: 56px;
  aspect-ratio: 1 / 1;
  --favorite-catch-x: 106px;
  --favorite-catch-y: -78px;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: transform 140ms ease;
  overflow: visible;
  z-index: 12;
}

.card-favorite-btn:active {
  transform: scale(0.94);
}

.favorite-icon {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
}

.card-favorite-btn.is-launching,
.detail-ball-toggle.is-launching {
  animation: favorite-ball-launch 1000ms cubic-bezier(0.32, 0.9, 0.36, 1) 1 both;
}

.card-favorite-btn.is-catching .favorite-icon,
.detail-ball-toggle.is-catching .favorite-icon {
  animation: pokeball-catch-shake 1.95s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
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

.card-favorite-btn.is-bursting .pokeball-burst::before,
.detail-ball-toggle.is-bursting .pokeball-burst::before {
  animation: pokeball-sparkle-a 680ms ease-out 1;
}

.card-favorite-btn.is-bursting .pokeball-burst::after,
.detail-ball-toggle.is-bursting .pokeball-burst::after {
  animation: pokeball-sparkle-b 680ms ease-out 1;
}

.card-image {
  position: absolute;
  right: -8px;
  bottom: -6px;
  width: clamp(160px, 58%, 360px);
  max-height: 92%;
  object-fit: contain;
  filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  transition: filter 220ms ease, opacity 220ms ease;
}

.card-image.silhouette {
  filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
}

.card-image.revealing {
  transform-origin: center center;
  animation: silhouette-collapse-card 320ms cubic-bezier(0.3, 0.82, 0.25, 1) forwards;
}

.card-image.capture-hidden {
  opacity: 0;
}

.card-image-conceal {
  position: absolute;
  right: -8px;
  bottom: -6px;
  width: clamp(160px, 58%, 360px);
  max-height: 92%;
  object-fit: contain;
  pointer-events: none;
  z-index: 6;
  filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  transform-origin: 22% 50%;
  animation: silhouette-cover-from-ball-card 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.profile-detail-panel {
  position: relative;
  width: clamp(300px, 28vw, 420px);
  height: calc(100dvh - 40px);
  max-height: 860px;
  background: linear-gradient(160deg, #0e1015 0%, #13151c 100%);
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.detail-hero {
  --hero-bg: #4f7fce;
  min-height: clamp(250px, 34vh, 340px);
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--hero-bg) 40%, #0a0c10) 0%, color-mix(in srgb, var(--hero-bg) 22%, #0a0c10) 100%);
  position: relative;
  overflow: hidden;
  padding: 14px 18px 0;
}

.detail-hero::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%);
  pointer-events: none;
  z-index: 0;
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
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 999px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(8px);
  color: #eaf4ff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: grid;
  place-items: center;
  transition: background 160ms ease, transform 120ms ease;
}

.detail-close:hover {
  background: rgba(255,255,255,0.22);
}

.detail-close:active {
  transform: scale(0.92);
}

.detail-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  color: #ffffff;
  font-family: 'Rajdhani', 'Astra', 'Poppins', sans-serif;
  letter-spacing: 0.08em;
  font-size: clamp(18px, 1.4vw, 22px);
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1;
  text-shadow: 0 1px 6px rgba(0,0,0,0.4);
}

.detail-ball-toggle {
  position: relative;
  transform: translate3d(0, 0, 0);
  --favorite-catch-x: 106px;
  --favorite-catch-y: -78px;
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
  width: 100%;
  height: 100%;
}

.detail-cry-toggle {
  position: absolute;
  left: 12px;
  bottom: 12px;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(10px);
  color: rgba(200,235,255,0.9);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
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

.detail-energy-mark {
  position: absolute;
  right: -24px;
  bottom: 14px;
  width: 210px;
  height: 210px;
  pointer-events: none;
  opacity: 0.95;
  z-index: 0;
}

.detail-hero-image {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -6px;
  width: min(72%, 330px);
  max-height: 84%;
  object-fit: contain;
  filter: drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  transition: filter 220ms ease, opacity 220ms ease;
}

.detail-hero-image.silhouette {
  filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
}

.detail-hero-image.revealing {
  transform-origin: center center;
  animation: silhouette-collapse-detail 320ms cubic-bezier(0.3, 0.82, 0.25, 1) forwards;
}

.detail-hero-image.capture-hidden {
  opacity: 0;
}

.detail-hero-image-conceal {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -6px;
  width: min(72%, 330px);
  max-height: 84%;
  object-fit: contain;
  pointer-events: none;
  z-index: 6;
  filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  animation: silhouette-cover-from-ball-detail 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.detail-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 12px 14px;
  display: grid;
  align-content: start;
  gap: 10px;
  background: linear-gradient(160deg, #0e1015 0%, #13151c 100%);
}

.detail-card {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07);
  padding: 10px;
}

.detail-card h4 {
  margin: 0 0 8px;
  color: rgba(200,235,255,0.9);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.88rem;
  line-height: 1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-weight: 700;
}

.detail-section-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.detail-section-tab {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  color: rgba(180,220,255,0.6);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
  padding: 8px 5px;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, transform 120ms ease;
}

.detail-section-tab:hover {
  background: rgba(255,255,255,0.12);
  color: rgba(200,235,255,0.9);
}

.detail-section-tab.active {
  background: rgba(100,180,240,0.25);
  border-color: rgba(100,180,240,0.45);
  color: #8dd4ff;
  box-shadow: 0 4px 12px rgba(60,160,240,0.2);
}

.detail-section-tab:active {
  transform: scale(0.97);
}

.detail-tab-enter-active,
.detail-tab-leave-active {
  transition: opacity 190ms ease, transform 240ms ease;
}

.detail-tab-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.detail-tab-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.detail-tab-panel {
  height: auto;
}

.detail-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detail-total-tag {
  font-family: 'Poppins',sans-serif;
  font-size: 0.66rem;
  font-weight: 800;
  color: rgba(140,200,255,0.8);
  background: rgba(100,160,255,0.12);
  border-radius: 999px;
  padding: 4px 8px;
  letter-spacing: 0.03em;
}

.detail-type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.detail-type-pill {
  --type-pill-bg: #78b2df;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  background: var(--type-pill-bg);
  color: #eef8ff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 800;
  font-size: 0.76rem;
  border-radius: 999px;
  padding: 6px 14px;
  letter-spacing: 0.04em;
  box-shadow: 0 6px 10px rgba(41, 87, 111, 0.2);
  text-transform: uppercase;
}

.detail-type-chip {
  --type-pill-bg: #8ba8ce;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border-radius: 999px;
  background: color-mix(in srgb, var(--type-pill-bg) 80%, white 20%);
  color: #163246;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  font-weight: 800;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 5px 10px;
}

.detail-kv-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 8px;
}

.detail-kv-grid.compact {
  gap: 4px 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-kv-grid div {
  display: grid;
  gap: 1px;
}

.detail-kv-grid dt {
  margin: 0;
  font-family: 'Poppins',sans-serif;
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  color: rgba(120,180,240,0.6);
  font-weight: 700;
  text-transform: uppercase;
}

.detail-kv-grid dd {
  margin: 0;
  font-family: 'Poppins',sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(200,235,255,0.9);
  line-height: 1.2;
}

.detail-ability-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.detail-ability-list li {
  min-height: 23px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.07);
  padding: 5px 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: 'Poppins',sans-serif;
  font-size: 0.72rem;
  line-height: 1;
  color: rgba(200,230,255,0.85);
  font-weight: 600;
}

.detail-ability-list small {
  font-size: 0.54rem;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: rgba(130,190,255,0.7);
  text-transform: uppercase;
}

.detail-muted {
  justify-content: center !important;
}

.detail-subline {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.detail-subline span {
  font-family: 'Poppins',sans-serif;
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(140,200,255,0.6);
  font-weight: 700;
}

.detail-subline strong {
  font-family: 'Poppins',sans-serif;
  font-size: 0.68rem;
  color: rgba(200,235,255,0.9);
  font-weight: 700;
  text-align: right;
}

.detail-stat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 5px;
}

.detail-stat-list li {
  display: grid;
  grid-template-columns: 46px 1fr auto;
  align-items: center;
  gap: 6px;
}

.detail-stat-label {
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  color: rgba(140,200,255,0.7);
  font-weight: 700;
  text-transform: uppercase;
}

.detail-stat-track {
  position: relative;
  display: block;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
}

.detail-stat-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, #4090d0 0%, #70d0f0 100%);
  box-shadow: 0 0 8px rgba(80,180,240,0.4);
}

.detail-stat-value {
  font-family: 'Poppins',sans-serif;
  font-size: 0.68rem;
  color: rgba(200,235,255,0.9);
  font-weight: 700;
}

.detail-flag-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.detail-flag-row span {
  border-radius: 999px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(180,220,255,0.7);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.62rem;
  line-height: 1;
  letter-spacing: 0.06em;
  font-weight: 700;
  text-transform: uppercase;
  padding: 4px 8px;
}

.region-card {
  position: relative;
  overflow: hidden;
  min-height: 74px;
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 0;
}

.origin-layout {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.origin-layout .region-card {
  flex: 0 0 44%;
  min-height: 110px;
}

.origin-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
  color: #e8f4ff;
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-weight: 700;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 1px 6px rgba(0,0,0,0.7);
}

.detail-description {
  margin: 0;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07);
  padding: 12px;
}

.detail-description h4 {
  margin: 0 0 8px;
  color: rgba(200,235,255,0.9);
  font-size: 1rem;
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.detail-description p {
  margin: 0;
  color: rgba(180,215,255,0.75);
  font-size: 0.88rem;
  line-height: 1.5;
  font-family: 'Poppins',sans-serif;
}

.detail-lower-grid {
  display: grid;
  gap: 10px;
}

.group30-card {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 78px;
}

.group30-evo {
  position: relative;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  border-radius: 10px;
}

.group30-evo:focus-visible {
  outline: 2px solid rgba(17, 17, 17, 0.5);
  outline-offset: 2px;
}

.group30-sprite {
  width: 56px;
  height: 56px;
  object-fit: contain;
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

.group30-evo:hover .group30-name,
.group30-evo:focus-visible .group30-name {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.group30-arrow {
  font-size: 1.2rem;
  line-height: 1;
  color: rgba(120,180,240,0.6);
  margin: 0 1px;
}

.detail-description-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.detail-description-audio {
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: rgba(160,220,255,0.85);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 6px 12px;
  line-height: 1;
  cursor: pointer;
  transition: transform 130ms ease, opacity 130ms ease, background-color 160ms ease;
}

.detail-description-audio:not(:disabled):active {
  transform: scale(0.96);
}

.detail-description-audio:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.detail-description-audio.playing {
  background: rgba(60,140,200,0.3);
  border-color: rgba(80,180,240,0.45);
  color: #8dd4ff;
}

.profile-detail-enter-active,
.profile-detail-leave-active {
  transition: opacity 220ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.profile-detail-enter-from,
.profile-detail-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* Desktop: slot sticks just below the header */
@media (min-width: 900px) {
  .profile-detail-slot.open {
    position: sticky;
    top: 20px;
    align-self: start;
  }
}

/* Mobile / narrow: stack detail panel below favorites */
@media (max-width: 899px) {
  .profile-content-layout.with-detail {
    grid-template-columns: 1fr;
  }

  .profile-detail-slot {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: block;
    width: 100% !important;
    overflow: hidden;
    pointer-events: none;
    background: rgba(9, 16, 24, 0.28);
    opacity: 0;
    transition: opacity 220ms ease;
  }

  .profile-detail-slot.open {
    opacity: 1;
    pointer-events: auto;
  }

  .profile-detail-panel {
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

  .profile-detail-enter-from,
  .profile-detail-leave-to {
    opacity: 0;
    transform: translateY(20px);
  }

  .favorites-grid {
    max-height: none;
  }
}

/* ═══════════════════════════════ FILTER ═════════════════════════ */
.profile-filter-fab {
  position: fixed;
  right: 28px;
  bottom: 30px;
  width: 60px;
  aspect-ratio: 1 / 1;
  border: 1px solid rgba(200,25,45,0.5);
  border-radius: 18px;
  background: linear-gradient(135deg, #c92030 0%, #a81020 100%);
  box-shadow: 0 8px 24px rgba(180,10,30,0.45), inset 0 1px 0 rgba(255,255,255,0.2);
  color: #fff;
  cursor: pointer;
  z-index: 20;
  transition: transform 160ms ease, box-shadow 200ms ease;
  display: grid;
  place-items: center;
}

.profile-filter-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(180,10,30,0.6), inset 0 1px 0 rgba(255,255,255,0.25);
}

.profile-filter-fab:active {
  transform: scale(0.93);
}

.profile-filter-fab.active {
  background: linear-gradient(135deg, #111318 0%, #1a1d26 100%);
  border-color: rgba(255,255,255,0.2);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}

.profile-filter-fab svg {
  width: 26px;
  height: 26px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.profile-search-panel {
  position: fixed;
  right: 26px;
  bottom: 106px;
  width: min(340px, calc(100vw - 52px));
  background: rgba(10,12,18,0.94);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 18px;
  padding: 14px;
  display: grid;
  gap: 10px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07);
  transform: translateY(14px);
  opacity: 0;
  pointer-events: none;
  transition: transform 200ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease;
  z-index: 19;
}

.profile-search-panel.open {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.profile-search-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.profile-search-head h4 {
  margin: 0;
  color: rgba(200,235,255,0.9);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  font-family: 'Rajdhani','Poppins',sans-serif;
  text-transform: uppercase;
}

.profile-search-reset {
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 999px;
  background: rgba(200,30,50,0.25);
  color: rgba(255,160,170,0.9);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  font-family: 'Rajdhani','Poppins',sans-serif;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 160ms ease;
}

.profile-search-reset:disabled { opacity: 0.35; cursor: default; }
.profile-search-reset:not(:disabled):hover { background: rgba(200,30,50,0.4); }

.profile-search-field {
  display: grid;
  gap: 5px;
}

.profile-search-field--full { width: 100%; }

.profile-search-field label {
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(140,200,255,0.7);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.profile-search-input,
.profile-search-panel select {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 0.88rem;
  font-family: 'Poppins',sans-serif;
  color: rgba(200,235,255,0.9);
  outline: none;
  background: rgba(255,255,255,0.07);
  width: 100%;
  cursor: pointer;
}

.profile-search-input::placeholder {
  color: rgba(120,160,200,0.45);
}

.profile-search-input:focus,
.profile-search-panel select:focus {
  border-color: rgba(80,160,240,0.5);
  background: rgba(255,255,255,0.1);
}

.profile-search-panel select option {
  background: #1a1d26;
  color: #e8f4ff;
}

.profile-search-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 8px;
}

.profile-search-panel small {
  color: rgba(120,180,240,0.55);
  font-size: 0.75rem;
  letter-spacing: 0.03em;
  font-family: 'Poppins',sans-serif;
}

@keyframes favorite-ball-launch {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  60% {
    transform: translate3d(var(--favorite-catch-x, 106px), var(--favorite-catch-y, -78px), 0)
      scale(0.94);
  }

  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes pokeball-catch-shake {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  5.13% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  8.2% {
    transform: translate3d(-2px, 0, 0) rotate(-8deg);
  }

  10.25% {
    transform: translate3d(2px, 0, 0) rotate(8deg);
  }

  12.3% {
    transform: translate3d(-2px, 0, 0) rotate(-8deg);
  }

  15.38% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  71.79% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  74.87% {
    transform: translate3d(-2px, 0, 0) rotate(-8deg);
  }

  76.92% {
    transform: translate3d(2px, 0, 0) rotate(8deg);
  }

  78.97% {
    transform: translate3d(-2px, 0, 0) rotate(-8deg);
  }

  82.05% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
}

@keyframes silhouette-collapse-card {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
  }

  45% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.03);
    filter: brightness(0) saturate(100%) drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
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

@keyframes silhouette-collapse-detail {
  0% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
    filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
  }

  45% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.03);
    filter: brightness(0) saturate(100%) drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
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

@media (max-width: 1220px) {
  .favorites-grid {
    max-height: calc(100dvh - 124px);
  }

  .favorite-card {
    min-height: 228px;
  }
}

@media (max-width: 1100px) {
  .profile-page {
    grid-template-columns: 1fr;
  }

  .profile-left {
    gap: 22px;
    padding-bottom: 24px;
  }

  .profile-user-block {
    margin-top: 34px;
  }

  .favorites-grid {
    max-height: none;
    overflow: visible;
  }
}

@media (max-width: 760px) {
  .profile-page {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  .profile-right {
    height: auto;
    overflow-y: visible;
    overscroll-behavior: auto;
    padding: 14px;
  }

  .favorites-grid {
    grid-template-columns: 1fr;
  }

  .detail-section-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-kv-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-kv-grid.compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
}
</style>
