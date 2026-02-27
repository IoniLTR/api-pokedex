<script setup>
import IconSprites from '../components/IconSprites.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import captureSfxUrl from '../assets/sounds/capture.mp3'
import relacheSfxUrl from '../assets/sounds/relache.mp3'
import {
  canUseFavorites,
  loadFavoriteIdsForCurrentUser,
  saveFavoriteIdsForCurrentUser
} from '../services/favoritesService'

const router = useRouter()
const route = useRoute()
const pokemons = ref([])
const loading = ref(true)
const error = ref(null)
const showSearch = ref(false)
const selectedTypeFilter = ref([])
const selectedRegionFilter = ref([])
const showFavoritesOnly = ref(false)
const showSeenOnly = ref(false)
const sortFilter = ref('DEFAULT')

// --- Seen Pokémon ---
const SEEN_IDS_KEY = 'pokedex_seen_ids'
const loadSeenIds = () => {
  try {
    const raw = localStorage.getItem(SEEN_IDS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
const seenIds = ref(loadSeenIds())
const isSeen = (id) => Boolean(id) && seenIds.value.has(String(id))
const markAsSeen = (id) => {
  if (!id) return
  const sid = String(id)
  if (seenIds.value.has(sid)) return
  seenIds.value = new Set([...seenIds.value, sid])
  try { localStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...seenIds.value])) } catch {}
}
const favoriteIds = ref(new Set())
const favoriteLaunchIds = ref(new Set())
const favoriteShakeIds = ref(new Set())
const favoriteRevealIds = ref(new Set())
const favoriteHiddenIds = ref(new Set())
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
const evolutionSequenceCache = new Map()
const regionFallbackImageCache = new Map()
const DEFAULT_DESCRIPTION_TEXT = 'Aucune description disponible pour ce Pokemon.'
let activeDescriptionUtterance = null
let favoriteCaptureSfx = null
let favoriteReleaseSfx = null

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const FAVORITE_LAUNCH_MS = 1000
const FAVORITE_REVEAL_DELAY_MS = 600
const FAVORITE_SHAKE_MS = 1950
const FAVORITE_REVEAL_MS = 400
const FAVORITE_BURST_MS = 700
const FAVORITE_CONCEAL_MS = 520
const SEARCH_PAGE_SIZE = 100
const favoriteCaptureTimers = new Map()
let favoriteSyncRequestId = 0
let favoritePersistRequestId = 0

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
const activeDetailSection = ref('PROFILE')

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

const normalizeType = (type) => normalizeToken(type)

const getCanonicalType = (type) => {
  const normalized = normalizeType(type)
  return TYPE_ALIASES[normalized] || normalized
}

const getSortablePokemonName = (pokemon) => {
  const display = String(pokemon?.displayName || '').trim()
  if (display) return display
  return String(pokemon?.name || '').trim()
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

const pokemonSearchIndex = computed(() =>
  pokemons.value.map((pokemon) => {
    const sortableName = getSortablePokemonName(pokemon)
    const normalizedName = normalizeToken(sortableName || pokemon?.name || '')
    const normalizedRegion = normalizeToken(pokemon?.regions?.[0]?.regionName || '')
    const canonicalTypes = (Array.isArray(pokemon?.types) ? pokemon.types : [])
      .map((type) => getCanonicalType(type))
      .filter(Boolean)
    const dexValue = Number(pokemon?.regions?.[0]?.regionPokedexNumber)
    const dexAsc = Number.isFinite(dexValue) ? dexValue : Number.POSITIVE_INFINITY
    const dexDesc = Number.isFinite(dexValue) ? dexValue : Number.NEGATIVE_INFINITY

    return {
      pokemon,
      id: String(pokemon?._id || ''),
      sortableName,
      normalizedName,
      normalizedRegion,
      canonicalTypes,
      dexAsc,
      dexDesc
    }
  })
)

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

const availableTypes = computed(() => {
  const knownTypes = new Set()

  for (const entry of pokemonSearchIndex.value) {
    for (const type of entry.canonicalTypes) {
      if (type) knownTypes.add(type)
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
  const nameFilter = normalizeToken(activeNameQuery.value)
  const typeFilters = selectedTypeFilter.value
  const regionFilters = selectedRegionFilter.value
  const favoritesOnly = showFavoritesOnly.value
  const seenOnly = showSeenOnly.value

  const filteredEntries = pokemonSearchIndex.value.filter((entry) => {
    const matchesName = !nameFilter || entry.normalizedName.includes(nameFilter)
    const matchesType = typeFilters.length === 0 || typeFilters.some(t => entry.canonicalTypes.includes(t))
    const matchesRegion = regionFilters.length === 0 || regionFilters.includes(entry.normalizedRegion)
    const matchesFavorite = !favoritesOnly || isFavorite(entry.id)
    const matchesSeen = !seenOnly || isSeen(entry.id)
    return matchesName && matchesType && matchesRegion && matchesFavorite && matchesSeen
  })

  if (sortFilter.value === 'NAME_ASC') {
    return [...filteredEntries]
      .sort((a, b) => a.sortableName.localeCompare(b.sortableName, 'fr', { sensitivity: 'base' }))
      .map((entry) => entry.pokemon)
  }

  if (sortFilter.value === 'NAME_DESC') {
    return [...filteredEntries]
      .sort((a, b) => b.sortableName.localeCompare(a.sortableName, 'fr', { sensitivity: 'base' }))
      .map((entry) => entry.pokemon)
  }

  if (sortFilter.value === 'DEX_ASC') {
    return [...filteredEntries].sort((a, b) => a.dexAsc - b.dexAsc).map((entry) => entry.pokemon)
  }

  if (sortFilter.value === 'DEX_DESC') {
    return [...filteredEntries].sort((a, b) => b.dexDesc - a.dexDesc).map((entry) => entry.pokemon)
  }

  return filteredEntries.map((entry) => entry.pokemon)
})

const hasActiveFilters = computed(
  () =>
    Boolean(activeNameQuery.value) ||
    selectedTypeFilter.value.length > 0 ||
    selectedRegionFilter.value.length > 0 ||
    showFavoritesOnly.value ||
    showSeenOnly.value ||
    sortFilter.value !== 'DEFAULT'
)
const activeNameQuery = computed(() => String(route.query.q || '').trim())

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
  return text
    ? text.replace(/\b\w/g, (char) => char.toUpperCase())
    : '-'
}

const getPokedexNumber = (pokemon) => {
  const raw = pokemon?.nationalDexNumber ?? pokemon?.regions?.[0]?.regionPokedexNumber
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const getRegionName = (pokemon) => String(pokemon?.regions?.[0]?.regionName || 'REGION')
const getDisplayName = (pokemon) => String(pokemon?.displayName || pokemon?.name || '').trim()
const formatDexNumber = (pokemon) => {
  const dex = getPokedexNumber(pokemon)
  return dex ? `#${String(dex).padStart(4, '0')}` : '-'
}
const getSecondaryTypes = (pokemon) => {
  const types = Array.isArray(pokemon?.types) ? pokemon.types : []
  return types.slice(1).map((type) => {
    const normalized = normalizeType(type)
    return TYPE_ALIASES[normalized] || normalized
  })
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
  if (targetPokemon) {
    openDetails(targetPokemon)
  }
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
const selectedBaseExperience = computed(() => {
  const value = Number(selectedPokemon.value?.baseExperience)
  return Number.isFinite(value) ? value : '-'
})
const hasSelectedAbilities = computed(() => selectedAbilityList.value.length > 0)

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
  markAsSeen(pokemon._id)

  if (typeof window !== 'undefined' && window.innerWidth <= 1100) {
    nextTick(() => {
      const slot = document.querySelector('.detail-slot.open')
      if (slot) {
        slot.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }
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
      <path d="M153 402C216 444 302 463 425 479" stroke="#5f8f52" stroke-width="8" stroke-linecap="round"/>
      <path d="M664 156C699 182 737 212 763 246" stroke="#98d385" stroke-width="8" stroke-linecap="round"/>
      <text x="480" y="320" text-anchor="middle" fill="#111111" font-size="94" font-family="Poppins, Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="2">${regionLabel}</text>
    </svg>
  `
  const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  regionFallbackImageCache.set(regionKey, dataUrl)
  return dataUrl
}

const setFavoriteLaunchVector = (triggerElement) => {
  if (!(triggerElement instanceof HTMLElement)) return

  const card = triggerElement.closest('.pokemon-card')
  const detailHero = triggerElement.closest('.detail-hero')
  const targetImage = card?.querySelector('.pokemon-image') || detailHero?.querySelector('.detail-hero-image')
  if (!(targetImage instanceof HTMLElement)) return

  const ballRect = triggerElement.getBoundingClientRect()
  const imageRect = targetImage.getBoundingClientRect()
  const launchX = imageRect.left + imageRect.width / 2 - (ballRect.left + ballRect.width / 2)
  const launchY = imageRect.top + imageRect.height / 2 - (ballRect.top + ballRect.height / 2)

  triggerElement.style.setProperty('--favorite-catch-x', `${launchX.toFixed(1)}px`)
  triggerElement.style.setProperty('--favorite-catch-y', `${launchY.toFixed(1)}px`)
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
    markAsSeen(normalizedId)
    startFavoriteCapture(normalizedId, event?.currentTarget)
  }
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
  }, FAVORITE_CONCEAL_MS)

  registerFavoriteTimer(normalizedId, concealTimer)
}

const loadFavoriteIds = async () => loadFavoriteIdsForCurrentUser()

const persistFavoriteIds = async () => {
  const requestId = ++favoritePersistRequestId
  const persisted = await saveFavoriteIdsForCurrentUser(favoriteIds.value)
  if (requestId !== favoritePersistRequestId) return
  favoriteIds.value = persisted
}

const syncFavoriteStateWithAuth = async () => {
  const requestId = ++favoriteSyncRequestId
  const loaded = await loadFavoriteIds()
  if (requestId !== favoriteSyncRequestId) return
  favoriteIds.value = loaded
}

const handleFavoriteStateSync = () => {
  void syncFavoriteStateWithAuth()
}

const toggleSearch = () => {
  showSearch.value = !showSearch.value
}

const resetFilters = () => {
  const nextQuery = { ...route.query }
  delete nextQuery.q
  router.replace({ query: nextQuery })
  selectedTypeFilter.value = []
  selectedRegionFilter.value = []
  showFavoritesOnly.value = false
  showSeenOnly.value = false
  sortFilter.value = 'DEFAULT'
}

onMounted(() => {
  descriptionSpeechSupported.value = supportsDescriptionSpeech()
  favoriteCaptureSfx = createFavoriteAudio(captureSfxUrl)
  favoriteReleaseSfx = createFavoriteAudio(relacheSfxUrl)
  void syncFavoriteStateWithAuth()
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleFavoriteStateSync)
    window.addEventListener('focus', handleFavoriteStateSync)
  }
  fetchPokemons()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleFavoriteStateSync)
    window.removeEventListener('focus', handleFavoriteStateSync)
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
  <main class="home" :class="{ 'detail-open': selectedPokemon }">
    <IconSprites />

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
          <svg
            v-if="!isFavorite(pokemon._id)"
            class="pokeball-mark"
            viewBox="0 0 162 162"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <use href="#icon-pokeball-bg" />
          </svg>

          <svg
            v-if="isFavorite(pokemon._id)"
            class="energy-mark"
            :viewBox="getEnergyIconViewBox(pokemon)"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <use :href="'#' + getEnergyIconId(pokemon)" />
          </svg>

          <h2 class="pokemon-name" :class="{ seen: isSeen(pokemon._id) || isFavorite(pokemon._id) }">
            {{ formatPokemonDisplayName(getDisplayName(pokemon), 'INCONNU') }}
          </h2>

          <button
            class="favorite-btn"
            :class="{
              active: isFavorite(pokemon._id),
              'is-launching': isFavoriteLaunching(pokemon._id),
              'is-catching': isFavoriteShaking(pokemon._id),
              'is-bursting': isFavoriteBursting(pokemon._id),
              'is-releasing': isFavoriteConcealing(pokemon._id)
            }"
            type="button"
            @click.stop="toggleFavorite(pokemon._id, $event)"
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
            class="pokemon-image"
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
            class="pokemon-image-conceal"
            :src="pokemon.imgUrl"
            :alt="''"
            loading="lazy"
            decoding="async"
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

            <svg
              v-if="!isFavorite(selectedPokemon?._id)"
              class="detail-hero-mark"
              viewBox="0 0 162 162"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <use href="#icon-pokeball-bg" />
            </svg>

            <svg
              v-if="isFavorite(selectedPokemon?._id)"
              class="detail-hero-energy-mark"
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
                class="detail-info-card detail-tab-panel detail-card-profile"
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
                class="detail-info-card detail-tab-panel detail-card-abilities"
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
                class="detail-info-card detail-tab-panel detail-card-stats"
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

              <article v-else key="detail-origin" class="detail-info-card detail-tab-panel detail-card-origin">
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
                      :class="{
                        silhouette: shouldUseSilhouette(selectedPokemon?._id)
                      }"
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
                  {{ selectedDescriptionText }}
                </p>
              </section>
            </div>
          </div>
            </aside>
          </Transition>
        </div>
      </section>
    </div>

    <button
      type="button"
      class="filter-fab"
      :class="{ active: showSearch }"
      @click="toggleSearch"
      :aria-expanded="showSearch"
      aria-controls="search-panel"
      aria-label="Filtrer les pokemon"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          v-if="!showSearch"
          d="M4 5h16l-6.2 7.1v5.3l-3.6 1.8v-7.1L4 5z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path v-else d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-linejoin="round" />
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
          <label for="type-filter">Type <span class="filter-hint">(multi)</span></label>
          <select id="type-filter" v-model="selectedTypeFilter" multiple size="4">
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
          <label for="region-filter">Region <span class="filter-hint">(multi)</span></label>
          <select id="region-filter" v-model="selectedRegionFilter" multiple size="4">
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

        <label class="favorite-filter">
          <input v-model="showSeenOnly" type="checkbox" />
          <span>Vu uniquement</span>
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
  --shadow: 0 8px 24px rgba(0,0,0,0.45);
  --header-h: 116px;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: transparent;
  padding: var(--header-h) clamp(12px, 3vw, 60px) 60px;
  position: relative;
  overflow-x: clip;
}

.icon-sprite-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
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
  padding-top: 10px;
}

.state-panel {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  color: rgba(180,220,255,0.8);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  min-height: 240px;
  display: grid;
  place-items: center;
}

.state-error {
  color: #ff8090;
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
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--card-bg) 28%, transparent) 0%, color-mix(in srgb, var(--card-bg) 14%, transparent) 100%);
  border: 1px solid color-mix(in srgb, var(--card-bg) 55%, rgba(255,255,255,0.3));
  border-radius: 24px;
  min-height: clamp(200px, 16vw, 280px);
  padding: clamp(18px, 1.6vw, 26px) clamp(18px, 1.4vw, 26px);
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.18);
  position: relative;
  overflow: hidden;
  isolation: isolate;
  content-visibility: auto;
  contain-intrinsic-size: 250px;
  transition: transform 220ms ease, box-shadow 260ms ease, border-color 260ms ease;
  cursor: pointer;
}

.pokemon-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%);
  border-radius: 24px 24px 0 0;
  pointer-events: none;
  z-index: 0;
}

.pokemon-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22);
  border-color: color-mix(in srgb, var(--card-bg) 80%, rgba(255,255,255,0.5));
}

.pokemon-card.selected {
  border-color: rgba(255,255,255,0.7);
  box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22);
  transform: translateY(-3px);
}

.pokemon-card.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
  pointer-events: none;
  z-index: 1;
}

.pokeball-mark,
.energy-mark {
  width: clamp(150px, 15vw, 250px);
  position: absolute;
  right: -56px;
  bottom: -42px;
  pointer-events: none;
}

.pokeball-mark {
  z-index: 0;
}

.energy-mark {
  z-index: 0;
  opacity: 0.95;
}

.pokemon-name {
  color: #ffffff;
  text-transform: uppercase;
  font-family: 'Rajdhani', 'Astra', 'Poppins', sans-serif;
  font-size: clamp(15px, 1.4vw, 20px);
  letter-spacing: 0.07em;
  font-weight: 700;
  line-height: 1;
  margin: 0;
  max-width: 58%;
  text-shadow: 0 1px 4px rgba(0,0,0,0.4);
  position: relative;
  z-index: 1;
  filter: blur(6px);
  transition: filter 0.4s ease;
  user-select: none;
}

.pokemon-name.seen {
  filter: none;
  user-select: auto;
}

.favorite-btn {
  position: absolute;
  left: clamp(12px, 1.2vw, 18px);
  bottom: clamp(10px, 1.1vw, 18px);
  transform: translate3d(0, 0, 0);
  --favorite-catch-x: 106px;
  --favorite-catch-y: -78px;
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
  transform: scale(0.94);
}

.favorite-icon {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
}

.favorite-btn.is-launching,
.detail-ball-toggle.is-launching {
  animation: favorite-ball-launch 1000ms cubic-bezier(0.32, 0.9, 0.36, 1) 1 both;
}

.favorite-btn.is-catching .favorite-icon,
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
  transform-origin: center center;
  animation: silhouette-collapse-card 320ms cubic-bezier(0.3, 0.82, 0.25, 1) forwards;
}

.pokemon-image.capture-hidden {
  opacity: 0;
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
  max-height: calc(100dvh - 120px);
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(160deg, #0e1015 0%, #13151c 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08);
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
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--hero-bg) 40%, #0a0c10) 0%, color-mix(in srgb, var(--hero-bg) 22%, #0a0c10) 100%);
  position: relative;
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
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

.detail-hero-mark,
.detail-hero-energy-mark {
  position: absolute;
  right: -24px;
  bottom: 12px;
  width: 186px;
  height: 186px;
  pointer-events: none;
}

.detail-hero-energy-mark {
  opacity: 0.95;
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
  transform-origin: center center;
  animation: silhouette-collapse-detail 320ms cubic-bezier(0.3, 0.82, 0.25, 1) forwards;
}

.detail-hero-image.capture-hidden {
  opacity: 0;
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
  overflow: hidden;
  overscroll-behavior: contain;
  padding: 10px 12px 14px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px;
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

.detail-info-card {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07);
  padding: 10px 10px 16px;
  height: auto;
  display: grid;
  align-content: start;
  gap: 9px;
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

.detail-card-head h4 {
  margin: 0;
  color: rgba(200,235,255,0.9);
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.84rem;
  line-height: 1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-weight: 700;
}

.detail-dex-tag,
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
}

.detail-kv-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 8px;
}

.detail-kv-grid.compact {
  gap: 4px 30px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.detail-lower-grid {
  display: grid;
  gap: 8px;
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
  transition: filter 220ms ease, opacity 220ms ease;
}

.group30-sprite.silhouette {
  filter: brightness(0) saturate(100%);
}

.group30-sprite.revealing {
  animation: silhouette-fade-out-sprite 420ms ease-out forwards;
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
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(160,210,255,0.8);
  text-align: center;
  display: block;
}

.group30-evo:hover .group30-name {
  color: #aed8ff;
}

.group30-arrow {
  font-size: 1.2rem;
  line-height: 1;
  color: rgba(120,180,240,0.6);
  margin: 0 1px;
}

.region-card {
  position: relative;
  overflow: hidden;
  min-height: 74px;
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
  margin-top: 0;
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

.detail-description h4 {
  margin: 0;
  color: rgba(200,235,255,0.9);
  font-size: 1.1rem;
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.detail-description p {
  margin: 0;
  color: rgba(180,215,255,0.75);
  font-size: 0.88rem;
  line-height: 1.5;
  font-family: 'Poppins',sans-serif;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.filter-fab {
  position: fixed;
  left: 28px;
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

.filter-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(180,10,30,0.6), inset 0 1px 0 rgba(255,255,255,0.25);
}

.filter-fab:active {
  transform: scale(0.93);
}

.filter-fab.active {
  background: linear-gradient(135deg, #111318 0%, #1a1d26 100%);
  border-color: rgba(255,255,255,0.2);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
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
  background: rgba(10,12,18,0.92);
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
  color: rgba(200,235,255,0.9);
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-family: 'Rajdhani','Poppins',sans-serif;
  text-transform: uppercase;
}

.search-panel-reset {
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 999px;
  background: rgba(200,30,50,0.25);
  color: rgba(255,160,170,0.9);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 5px 11px;
  font-family: 'Rajdhani','Poppins',sans-serif;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 130ms ease, opacity 130ms ease, background-color 160ms ease;
}

.search-panel-reset:disabled {
  opacity: 0.35;
  cursor: default;
}

.search-panel-reset:not(:disabled):hover {
  background: rgba(200,30,50,0.4);
}

.search-panel-reset:not(:disabled):active {
  transform: scale(0.96);
}

.search-field label {
  font-family: 'Rajdhani','Poppins',sans-serif;
  font-weight: 700;
  color: rgba(140,200,255,0.7);
  font-size: 0.78rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
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
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 0.88rem;
  font-family: 'Poppins',sans-serif;
  color: rgba(200,235,255,0.9);
  outline: none;
  background: rgba(255,255,255,0.07);
  cursor: pointer;
}

.search-panel select:focus {
  border-color: rgba(80,160,240,0.5);
  background: rgba(255,255,255,0.1);
}

.search-panel select option {
  background: #1a1d26;
  color: #e8f4ff;
}

.search-panel select[multiple] {
  padding: 4px 6px;
  height: auto;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(80,160,240,0.4) transparent;
}

.search-panel select[multiple] option:checked,
.search-panel select[multiple] option:selected {
  background: rgba(80,160,240,0.28);
  color: #a0d0ff;
  font-weight: 600;
}

.filter-hint {
  font-size: 0.72rem;
  opacity: 0.5;
  font-weight: 400;
  font-style: italic;
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
  color: rgba(160,210,255,0.8);
  font-family: 'Poppins',sans-serif;
  font-size: 0.84rem;
  font-weight: 600;
}

.favorite-filter input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #4a90d8;
}

.search-panel small {
  color: rgba(120,180,240,0.55);
  font-size: 0.76rem;
  letter-spacing: 0.03em;
  font-family: 'Poppins',sans-serif;
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
    top: var(--header-h, 116px);
    align-self: start;
  }
}

@media (max-width: 1460px) {
  .detail-slot.open {
    width: clamp(300px, 29vw, 390px);
  }

  .detail-section-tab {
    font-size: 0.6rem;
    padding: 7px 4px;
  }

  .region-name {
    font-size: 0.95rem;
  }

  .detail-card-head h4 {
    font-size: 0.78rem;
  }

  .detail-kv-grid dd {
    font-size: 0.69rem;
  }

  .detail-description h4 {
    font-size: 1.08rem;
  }

  .detail-description p {
    font-size: 0.84rem;
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
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
    padding: 115px 10px 80px;
    height: auto;
    overflow: visible;
  }

  .detail-slot.open {
    scroll-margin-top: calc(var(--header-h) + 12px);
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

  .pokeball-mark,
  .energy-mark {
    width: 190px;
    right: -42px;
    bottom: -38px;
  }

  .favorite-btn {
    width: 50px;
    left: 12px;
    bottom: 10px;
    --favorite-catch-x: 84px;
    --favorite-catch-y: -64px;
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

  .detail-hero-mark,
  .detail-hero-energy-mark {
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

  .detail-section-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .detail-section-tab {
    font-size: 0.62rem;
    padding: 8px 6px;
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

  .region-name {
    font-size: 0.95rem;
  }

  .detail-kv-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-kv-grid.compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .detail-description h4 {
    font-size: 1rem;
  }

  .detail-description p {
    font-size: 0.88rem;
  }
}
</style>
