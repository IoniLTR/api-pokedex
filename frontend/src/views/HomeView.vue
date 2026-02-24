<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const pokemons = ref([])
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')
const showSearch = ref(false)
const favoriteIds = ref(new Set())
const selectedPokemon = ref(null)
const detailBallClosed = ref(false)
const selectedEvolutionSprites = ref([])

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
  'GROUND',
  'FAIRY'
])

const ENERGY_TYPE_ALIASES = {
  BUG: 'GRASS',
  ICE: 'WATER',
  POISON: 'PSYCHIC',
  ROCK: 'GROUND',
  GHOST: 'DARK',
  FLYING: 'NORMAL',
  DRAGON: 'DARK'
}

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

const filteredPokemons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return pokemons.value

  return pokemons.value.filter((pokemon) =>
    String(pokemon?.name || '').toLowerCase().includes(query)
  )
})

const normalizeType = (type) =>
  String(type || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

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

const extractIdFromPokeApiUrl = (url) => {
  const match = String(url || '').match(/\/(\d+)\/?$/)
  return match ? Number(match[1]) : null
}

const getSpeciesFromNode = (node) => ({
  id: extractIdFromPokeApiUrl(node?.species?.url),
  name: String(node?.species?.name || '')
})

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

const getFallbackEvolutionSprites = (pokemon) => {
  const currentDex = getPokedexNumber(pokemon)

  if (!currentDex) {
    return [pokemon?.imgUrl].filter(Boolean)
  }

  const first = Math.max(1, currentDex - 2)
  const second = Math.max(1, currentDex - 1)
  return [first, second, currentDex].map(getOfficialArtworkUrl)
}

const loadEvolutionSprites = async (pokemon) => {
  selectedEvolutionSprites.value = []

  const speciesId = getPokedexNumber(pokemon)
  if (!speciesId) {
    selectedEvolutionSprites.value = getFallbackEvolutionSprites(pokemon)
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
    const sprites = sequence
      .map((item) => (item.id ? getOfficialArtworkUrl(item.id) : null))
      .filter(Boolean)

    const limited = sprites.length ? sprites.slice(0, 3) : getFallbackEvolutionSprites(pokemon).slice(0, 3)
    selectedEvolutionSprites.value = limited
  } catch {
    selectedEvolutionSprites.value = getFallbackEvolutionSprites(pokemon).slice(0, 3)
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

const openDetails = (pokemon) => {
  selectedPokemon.value = pokemon
}

const closeDetails = () => {
  selectedPokemon.value = null
  detailBallClosed.value = false
}

const isSelected = (pokemon) =>
  Boolean(selectedPokemon.value?._id) && selectedPokemon.value._id === pokemon?._id

const toggleDetailBall = () => {
  detailBallClosed.value = !detailBallClosed.value
}

const getRegionImageUrl = (pokemon) => {
  const regionLabel = getRegionName(pokemon).toUpperCase()
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
      <text x="480" y="320" text-anchor="middle" fill="#111111" font-size="94" font-family="Avenir Next, Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="2">${regionLabel}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const toggleFavorite = (id) => {
  if (!id) return

  const next = new Set(favoriteIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  favoriteIds.value = next
}

const isFavorite = (id) => id && favoriteIds.value.has(id)

const toggleSearch = () => {
  showSearch.value = !showSearch.value
}

onMounted(fetchPokemons)

watch(
  selectedPokemon,
  async (pokemon) => {
    detailBallClosed.value = false

    if (!pokemon) {
      selectedEvolutionSprites.value = []
      return
    }

    await loadEvolutionSprites(pokemon)
  },
  { immediate: true }
)
</script>

<template>
  <main class="home">
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
          <svg class="energy-mark" viewBox="0 0 162 162" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g v-if="getEnergyType(pokemon) === 'GRASS'">
              <path class="energy-fill" d="M81 17C56 34 43 62 46 87C49 113 67 132 81 144C95 132 113 113 116 87C119 62 106 34 81 17Z"/>
              <path class="energy-line" d="M81 45V128"/>
              <path class="energy-line" d="M81 66C67 58 55 58 43 64"/>
              <path class="energy-line" d="M81 82C66 75 52 75 39 82"/>
              <path class="energy-line" d="M81 66C95 58 107 58 119 64"/>
              <path class="energy-line" d="M81 82C96 75 110 75 123 82"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'FIRE'">
              <path class="energy-fill" d="M84 18C91 32 87 43 87 43C98 40 107 31 111 21C124 35 128 57 118 73C110 85 96 92 84 92C63 92 46 76 46 55C46 39 54 27 66 18C63 28 66 35 72 39C72 39 72 29 84 18Z"/>
              <path class="energy-fill" d="M84 58C88 66 85 72 85 72C91 70 96 65 98 59C105 67 107 78 101 86C97 90 90 93 84 93C73 93 64 84 64 73C64 65 68 59 74 55C72 60 74 63 77 66C77 66 77 61 84 58Z"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'WATER'">
              <path class="energy-fill" d="M81 19C99 44 116 63 116 84C116 103 101 118 81 118C61 118 46 103 46 84C46 63 63 44 81 19Z"/>
              <path class="energy-line" d="M66 98C66 86 73 75 84 67"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'FIGHTING'">
              <rect class="energy-fill" x="31" y="35" width="20" height="44" rx="6"/>
              <rect class="energy-fill" x="54" y="31" width="18" height="48" rx="6"/>
              <rect class="energy-fill" x="74" y="31" width="18" height="48" rx="6"/>
              <rect class="energy-fill" x="95" y="35" width="18" height="44" rx="6"/>
              <path class="energy-fill" d="M36 87H77C81 87 84 90 84 94V104C84 112 78 118 70 118H45C37 118 31 112 31 104V92C31 89 33 87 36 87Z"/>
              <path class="energy-fill" d="M86 87H115C119 87 122 90 122 94V110C122 114 119 117 115 117H95C90 117 86 113 86 108V87Z"/>
              <path class="energy-fill" d="M78 108C78 102 82 98 88 98H98V106C98 112 93 117 87 117H78V108Z"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'STEEL'">
              <path class="energy-line-thick" d="M50 30H112L132 64L112 98H50L30 64L50 30Z"/>
              <path class="energy-line-thick" d="M81 108L103 70H59L81 108Z"/>
              <path class="energy-line-thick" d="M56 110L66 124"/>
              <path class="energy-line-thick" d="M106 110L96 124"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'ELECTRIC'">
              <path class="energy-fill" d="M95 18L48 90H77L66 144L114 72H85L95 18Z"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'PSYCHIC'">
              <path class="energy-line-thick" d="M29 81C42 61 60 50 81 50C102 50 120 61 133 81C120 101 102 112 81 112C60 112 42 101 29 81Z"/>
              <circle class="energy-fill" cx="81" cy="81" r="13"/>
              <path class="energy-fill" d="M87 69C95 69 101 75 101 83C101 91 95 97 87 97C81 97 76 93 74 87C76 88 78 88 80 88C87 88 93 82 93 75C93 73 92 71 91 69C90 69 89 69 87 69Z"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'DARK'">
              <path class="energy-fill" d="M95 22C79 26 67 41 67 58C67 77 81 92 100 95C94 99 87 101 80 101C56 101 37 82 37 58C37 34 56 15 80 15C86 15 91 16 95 18V22Z"/>
              <circle class="energy-fill" cx="97" cy="30" r="9"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'GROUND'">
              <path class="energy-fill" d="M39 91C46 63 67 45 93 45C103 45 112 47 120 52C112 34 94 22 73 22C44 22 21 45 21 74C21 101 41 123 67 126C54 118 44 106 39 91Z"/>
              <path class="energy-fill" d="M74 63L116 98L88 92L74 63Z"/>
            </g>

            <g v-else-if="getEnergyType(pokemon) === 'FAIRY'">
              <path class="energy-fill" d="M81 30L91 50L111 60L91 70L81 90L71 70L51 60L71 50L81 30Z"/>
              <path class="energy-fill" d="M43 102C31 94 24 82 24 68C24 58 27 49 33 41C31 47 31 54 32 60C35 81 49 96 67 102C58 106 50 106 43 102Z"/>
              <path class="energy-fill" d="M119 102C131 94 138 82 138 68C138 58 135 49 129 41C131 47 131 54 130 60C127 81 113 96 95 102C104 106 112 106 119 102Z"/>
            </g>

            <g v-else>
              <path class="energy-fill" d="M81 22L93 58L131 56L102 81L131 106L93 104L81 140L69 104L31 106L60 81L31 56L69 58L81 22Z"/>
            </g>
          </svg>

          <h2 class="pokemon-name">
            {{ String(pokemon.name || 'inconnu').toUpperCase() }}
          </h2>

          <button
            class="favorite-btn"
            :class="{ active: isFavorite(pokemon._id) }"
            type="button"
            @click.stop="toggleFavorite(pokemon._id)"
            :aria-label="isFavorite(pokemon._id) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
          >
            <svg
              v-if="!isFavorite(pokemon._id)"
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
            :src="pokemon.imgUrl"
            :alt="pokemon.name || 'Pokemon'"
            loading="lazy"
          />
        </article>
        </div>

        <aside v-if="selectedPokemon" class="detail-panel">
          <div class="detail-hero" :style="{ '--hero-bg': getCardColor(selectedPokemon) }">
            <button class="detail-close" type="button" @click="closeDetails" aria-label="Fermer le panneau">
              ×
            </button>

            <h3 class="detail-title">{{ String(selectedPokemon.name || 'INCONNU').toUpperCase() }}</h3>

            <button class="detail-ball-toggle" type="button" @click="toggleDetailBall" aria-label="Fermer ou ouvrir la pokeball">
              <svg
                v-if="!detailBallClosed"
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

            <svg class="detail-hero-mark" viewBox="0 0 162 162" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M50.5977 85.4453C52.7241 100.309 65.5053 111.735 80.957 111.735C96.4091 111.735 109.191 100.309 111.317 85.4453H161.452C159.067 127.953 123.843 161.688 80.7383 161.688C37.6338 161.688 2.41053 127.953 0.0253906 85.4453H50.5977ZM80.7383 0C123.991 0 159.311 33.9671 161.478 76.6816H111.317C109.191 61.8173 96.4093 50.3906 80.957 50.3906C65.5051 50.391 52.7239 61.8176 50.5977 76.6816H0C2.16635 33.9672 37.4855 0.000197082 80.7383 0Z" fill="white" fill-opacity="0.3"/>
              <circle cx="80.9579" cy="81.0632" r="15.3363" fill="white" fill-opacity="0.3"/>
            </svg>

            <img
              class="detail-hero-image"
              :src="selectedPokemon.imgUrl"
              :alt="selectedPokemon.name || 'Pokemon'"
              loading="lazy"
            />
          </div>

          <div class="detail-content">
            <span class="detail-type-pill" :style="{ '--type-pill-bg': getCardColor(selectedPokemon) }">
              {{ getTypeLabel(getPrimaryType(selectedPokemon)) }}
            </span>

            <div class="group30-card">
              <template v-for="(sprite, spriteIndex) in selectedEvolutionSprites" :key="`${selectedPokemon._id}-evo-${spriteIndex}`">
                <img class="group30-sprite" :src="sprite" :alt="`evolution-${spriteIndex + 1}`" loading="lazy" />
                <span v-if="spriteIndex < selectedEvolutionSprites.length - 1" class="group30-arrow" aria-hidden="true">→</span>
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
              <h4>DESCRIPTION</h4>
              <p>
                {{
                  selectedPokemon.description && selectedPokemon.description.trim()
                    ? selectedPokemon.description
                    : 'Aucune description disponible pour ce Pokemon.'
                }}
              </p>
            </section>
          </div>
        </aside>
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
      <label for="search-input">Rechercher un pokemon</label>
      <input
        id="search-input"
        v-model="searchQuery"
        type="search"
        placeholder="Nom du pokemon..."
        autocomplete="off"
      />
      <small>{{ filteredPokemons.length }} resultat(s)</small>
    </form>
  </main>
</template>

<style scoped>
.home {
  --mint-bg: #b4e7e3;
  --shadow: 0 8px 18px rgba(61, 117, 130, 0.2);
  min-height: 100vh;
  background: var(--mint-bg);
  padding: clamp(28px, 3.4vw, 56px);
  position: relative;
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
  max-width: 1728px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.state-panel {
  background: rgba(255, 255, 255, 0.64);
  border-radius: 20px;
  color: #1f5f69;
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
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
  display: block;
}

.content-layout.with-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(330px, 430px);
  align-items: start;
  gap: clamp(16px, 1.8vw, 28px);
}

.pokedex-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(16px, 1.9vw, 30px);
}

.content-layout.with-detail .pokedex-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  aspect-ratio: 1 / 1;
  position: absolute;
  right: -56px;
  bottom: -42px;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.3);
}

.energy-fill {
  fill: currentColor;
}

.energy-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 5.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.energy-line-thick {
  fill: none;
  stroke: currentColor;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pokemon-name {
  color: #f7fbff;
  text-transform: uppercase;
  font-family: 'Bank Gothic', 'Eurostile', 'Arial Black', sans-serif;
  font-size: clamp(1.55rem, 1.9vw, 2.2rem);
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
}

.favorite-btn:active {
  transform: translateY(-50%) scale(0.94);
}

.favorite-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.pokemon-image {
  position: absolute;
  right: -8px;
  bottom: -6px;
  width: clamp(150px, 52%, 330px);
  max-height: 92%;
  object-fit: contain;
  filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.18));
}

.detail-panel {
  position: sticky;
  top: 20px;
  border-radius: 24px;
  overflow: hidden;
  background: #e9e9e9;
  border: 2px solid rgba(14, 18, 22, 0.8);
  box-shadow: 0 16px 26px rgba(27, 59, 71, 0.24);
}

.detail-hero {
  --hero-bg: #7cb4e2;
  min-height: 360px;
  background: var(--hero-bg);
  position: relative;
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  overflow: hidden;
  padding: 18px 22px 0;
}

.detail-close {
  position: absolute;
  left: 16px;
  top: 8px;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #eaf4ff;
  font-size: 2.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.detail-title {
  margin: 8px 0 0;
  padding-left: 50px;
  color: #edf6ff;
  font-family: 'Bank Gothic', 'Eurostile', 'Arial Black', sans-serif;
  letter-spacing: 0.08em;
  font-size: clamp(2rem, 2.7vw, 2.6rem);
  line-height: 1;
}

.detail-ball-toggle {
  position: absolute;
  right: 16px;
  top: 18px;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.detail-ball-toggle .favorite-icon {
  width: 54px;
  height: 54px;
}

.detail-hero-mark {
  position: absolute;
  right: -34px;
  bottom: 48px;
  width: 240px;
  height: 240px;
  pointer-events: none;
}

.detail-hero-image {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -6px;
  width: min(74%, 360px);
  max-height: 82%;
  object-fit: contain;
  filter: drop-shadow(0 12px 14px rgba(0, 0, 0, 0.2));
}

.detail-content {
  padding: 14px 16px 18px;
}

.detail-type-pill {
  --type-pill-bg: #78b2df;
  display: block;
  width: fit-content;
  margin: -28px auto 12px;
  background: var(--type-pill-bg);
  color: #eef8ff;
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-weight: 900;
  font-size: 1.1rem;
  border-radius: 999px;
  padding: 10px 30px;
  letter-spacing: 0.05em;
  box-shadow: 0 6px 10px rgba(41, 87, 111, 0.28);
  text-transform: uppercase;
}

.group30-card {
  background: #abe2e6;
  border-radius: 18px;
  box-shadow: 0 5px 12px rgba(35, 84, 93, 0.24);
  padding: 14px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 118px;
}

.group30-sprite {
  width: 86px;
  height: 86px;
  object-fit: contain;
}

.group30-arrow {
  font-size: 2rem;
  line-height: 1;
  color: #111111;
  margin: 0 3px;
}

.detail-info-row {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.region-card {
  position: relative;
  overflow: hidden;
  min-height: 126px;
  border-radius: 16px;
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
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-weight: 900;
  font-size: 2rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}

.stats-card {
  min-height: 126px;
  border-radius: 16px;
  background: #b6e7e5;
  box-shadow: 0 4px 10px rgba(39, 79, 87, 0.2);
  padding: 14px 16px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 5px;
}

.stats-card hr {
  width: 100%;
  border: 0;
  border-top: 2px solid rgba(0, 0, 0, 0.35);
  margin: 4px 0;
}

.stats-label {
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-size: 2rem;
  line-height: 1;
  font-weight: 900;
  color: #111111;
}

.stats-value {
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-size: 1.5rem;
  line-height: 1;
  font-weight: 700;
  color: rgba(17, 17, 17, 0.78);
}

.detail-description {
  margin-top: 12px;
}

.detail-description h4 {
  margin: 0 0 8px;
  color: #111111;
  font-size: 2rem;
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.detail-description p {
  margin: 0;
  color: #111111;
  font-size: 1.45rem;
  line-height: 1.58;
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
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
  width: min(300px, calc(100vw - 52px));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 14px;
  display: grid;
  gap: 8px;
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

.search-panel label {
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
  font-weight: 700;
  color: #214f5f;
  font-size: 0.95rem;
}

.search-panel input {
  border: 2px solid #b8dfe8;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 1rem;
  color: #103644;
  outline: none;
  background: #fafdff;
}

.search-panel input:focus {
  border-color: #4aabc8;
}

.search-panel small {
  color: #3d6d7d;
  font-size: 0.83rem;
  font-family: 'Avenir Next', 'Segoe UI', sans-serif;
}

@media (max-width: 1460px) {
  .content-layout.with-detail {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 390px);
  }

  .region-name {
    font-size: 1.75rem;
  }

  .stats-label {
    font-size: 1.75rem;
  }

  .stats-value {
    font-size: 1.3rem;
  }

  .detail-description h4 {
    font-size: 1.8rem;
  }

  .detail-description p {
    font-size: 1.3rem;
  }
}

@media (max-width: 1100px) {
  .content-layout.with-detail {
    grid-template-columns: 1fr;
  }

  .detail-panel {
    position: relative;
    top: 0;
    max-width: 620px;
    width: 100%;
    margin: 0 auto;
  }

  .pokedex-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .home {
    padding: 20px 14px 96px;
  }

  .pokedex-grid {
    grid-template-columns: 1fr;
    gap: 14px;
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
    font-size: clamp(1.45rem, 6vw, 1.95rem);
  }

  .detail-hero {
    min-height: 320px;
  }

  .detail-title {
    font-size: 2rem;
    padding-left: 44px;
  }

  .detail-hero-mark {
    width: 200px;
    height: 200px;
    right: -30px;
    bottom: 36px;
  }

  .detail-content {
    padding: 12px;
  }

  .group30-card {
    min-height: 96px;
    padding: 10px 6px;
    gap: 4px;
  }

  .group30-sprite {
    width: 68px;
    height: 68px;
  }

  .group30-arrow {
    font-size: 1.6rem;
  }

  .detail-info-row {
    grid-template-columns: 1fr;
  }

  .region-name {
    font-size: 1.55rem;
  }

  .stats-label {
    font-size: 1.55rem;
  }

  .stats-value {
    font-size: 1.2rem;
  }

  .detail-description h4 {
    font-size: 1.55rem;
  }

  .detail-description p {
    font-size: 1.08rem;
  }
}
</style>
