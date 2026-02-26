require("dotenv").config();

const mongoose = require("mongoose");
const Pokemon = require("../models/pokemon");
const { PkmnType } = require("../models/pkmnType");
const { connectDB } = require("../config/db");
const { resolveRegionName, resolveRegionImageUrl } = require("../utils/regionImages");

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const DEFAULT_LIMIT = 1350;
const DEFAULT_OFFSET = 0;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_RETRIES = 3;
const ALLOWED_TYPES = new Set(PkmnType);
const TYPE_ALIASES = {
  STELLAR: "NORMAL",
  UNKNOWN: "NORMAL"
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const readNumber = (flag, fallback) => {
    const index = args.indexOf(flag);
    if (index < 0) return fallback;
    const value = Number(args[index + 1]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  };

  return {
    limit: readNumber("--limit", DEFAULT_LIMIT),
    offset: readNumber("--offset", DEFAULT_OFFSET),
    concurrency: Math.max(1, readNumber("--concurrency", DEFAULT_CONCURRENCY)),
    retries: Math.max(0, readNumber("--retries", DEFAULT_RETRIES)),
    reset: args.includes("--reset")
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = DEFAULT_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "pokedex-api-seeder/1.0"
      }
    });

    if (response.ok) {
      return response.json();
    }

    const shouldRetry = response.status === 429 || response.status >= 500;
    if (shouldRetry && attempt < retries) {
      await wait(350 * (attempt + 1));
      continue;
    }

    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} on ${url} ${text}`.trim());
  }

  throw new Error(`Unable to fetch ${url}`);
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\n\f\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleFromSlug(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getLocalizedName(names, languageCode, fallback = "") {
  const entries = Array.isArray(names) ? names : [];
  const hit = entries.find((entry) => entry?.language?.name === languageCode);
  return cleanText(hit?.name || fallback);
}

function extractFormSuffix(pokemonSlug, speciesSlug) {
  const pokemonName = String(pokemonSlug || "");
  const speciesName = String(speciesSlug || "");

  if (!pokemonName || !speciesName) return "";
  if (pokemonName === speciesName) return "";

  const prefix = `${speciesName}-`;
  if (pokemonName.startsWith(prefix)) {
    return pokemonName.slice(prefix.length);
  }

  return pokemonName;
}

function formatDisplayName(speciesLocalizedName, formSuffix) {
  const base = cleanText(speciesLocalizedName || "Pokemon");
  if (!formSuffix) return base;
  return `${base} (${toTitleFromSlug(formSuffix)})`;
}

function pickDescription(speciesData) {
  const entries = Array.isArray(speciesData?.flavor_text_entries)
    ? speciesData.flavor_text_entries
    : [];
  const preferredLanguages = ["fr", "en"];

  for (const languageCode of preferredLanguages) {
    const entry = entries.find((item) => item?.language?.name === languageCode && item?.flavor_text);
    if (entry) return cleanText(entry.flavor_text);
  }

  return "";
}

function mapTypes(pokemonData) {
  const raw = Array.isArray(pokemonData?.types) ? pokemonData.types : [];
  const mapped = raw
    .slice()
    .sort((a, b) => Number(a?.slot || 0) - Number(b?.slot || 0))
    .map((entry) => String(entry?.type?.name || "").toUpperCase())
    .map((type) => TYPE_ALIASES[type] || type)
    .filter((type) => ALLOWED_TYPES.has(type));

  return mapped.length ? mapped : ["NORMAL"];
}

function mapAbilities(pokemonData) {
  const raw = Array.isArray(pokemonData?.abilities) ? pokemonData.abilities : [];
  return raw
    .slice()
    .sort((a, b) => Number(a?.slot || 0) - Number(b?.slot || 0))
    .map((entry, index) => ({
      name: cleanText(entry?.ability?.name),
      isHidden: Boolean(entry?.is_hidden),
      slot: Number.isFinite(Number(entry?.slot)) ? Number(entry.slot) : index + 1
    }))
    .filter((ability) => ability.name);
}

function mapBaseStats(pokemonData) {
  const output = {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
    total: 0
  };

  const stats = Array.isArray(pokemonData?.stats) ? pokemonData.stats : [];
  for (const stat of stats) {
    const statName = String(stat?.stat?.name || "");
    const base = Number(stat?.base_stat) || 0;

    if (statName === "hp") output.hp = base;
    if (statName === "attack") output.attack = base;
    if (statName === "defense") output.defense = base;
    if (statName === "special-attack") output.specialAttack = base;
    if (statName === "special-defense") output.specialDefense = base;
    if (statName === "speed") output.speed = base;
  }

  output.total =
    output.hp +
    output.attack +
    output.defense +
    output.specialAttack +
    output.specialDefense +
    output.speed;

  return output;
}

function buildPokemonDocument(pokemonData, speciesData) {
  const pokeApiId = Number(pokemonData?.id) || null;
  const nationalDexNumber = Number(speciesData?.id) || pokeApiId || null;
  const slug = cleanText(pokemonData?.name).toLowerCase();

  const speciesLocalizedName =
    getLocalizedName(speciesData?.names, "fr") || toTitleFromSlug(speciesData?.name);
  const formSuffix = extractFormSuffix(pokemonData?.name, speciesData?.name);
  const displayName = formatDisplayName(speciesLocalizedName, formSuffix);

  const fallbackArtwork = nationalDexNumber
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${nationalDexNumber}.png`
    : "";
  const spriteUrl =
    cleanText(pokemonData?.sprites?.other?.["official-artwork"]?.front_default) ||
    cleanText(pokemonData?.sprites?.front_default) ||
    fallbackArtwork;

  const cryUrl =
    cleanText(pokemonData?.cries?.latest) || cleanText(pokemonData?.cries?.legacy) || "";

  const regionName = resolveRegionName("NATIONAL", nationalDexNumber) || "National";
  const regionImageUrl = resolveRegionImageUrl(regionName, nationalDexNumber);

  return {
    pokeApiId,
    nationalDexNumber,
    slug,
    name: displayName,
    displayName,
    imgUrl: spriteUrl,
    spriteUrl,
    cryUrl,
    description: pickDescription(speciesData),
    height: Number.isFinite(Number(pokemonData?.height)) ? Number(pokemonData.height) / 10 : undefined,
    weight: Number.isFinite(Number(pokemonData?.weight)) ? Number(pokemonData.weight) / 10 : undefined,
    baseExperience: Number.isFinite(Number(pokemonData?.base_experience))
      ? Number(pokemonData.base_experience)
      : 0,
    types: mapTypes(pokemonData),
    abilities: mapAbilities(pokemonData),
    baseStats: mapBaseStats(pokemonData),
    generation: cleanText(speciesData?.generation?.name),
    habitat: cleanText(speciesData?.habitat?.name),
    shape: cleanText(speciesData?.shape?.name),
    color: cleanText(speciesData?.color?.name),
    growthRate: cleanText(speciesData?.growth_rate?.name),
    eggGroups: Array.isArray(speciesData?.egg_groups)
      ? speciesData.egg_groups.map((item) => cleanText(item?.name)).filter(Boolean)
      : [],
    captureRate: Number.isFinite(Number(speciesData?.capture_rate))
      ? Number(speciesData.capture_rate)
      : null,
    baseHappiness: Number.isFinite(Number(speciesData?.base_happiness))
      ? Number(speciesData.base_happiness)
      : null,
    hatchCounter: Number.isFinite(Number(speciesData?.hatch_counter))
      ? Number(speciesData.hatch_counter)
      : null,
    genderRate: Number.isFinite(Number(speciesData?.gender_rate))
      ? Number(speciesData.gender_rate)
      : null,
    isLegendary: Boolean(speciesData?.is_legendary),
    isMythical: Boolean(speciesData?.is_mythical),
    isBaby: Boolean(speciesData?.is_baby),
    regions: [
      {
        regionName,
        regionPokedexNumber: nationalDexNumber,
        regionImageUrl
      }
    ]
  };
}

async function upsertPokemon(document) {
  try {
    const result = await Pokemon.updateOne(
      { slug: document.slug },
      { $set: document },
      { upsert: true, runValidators: true }
    );
    return result.upsertedCount > 0 ? "created" : "updated";
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.name) {
      const existing = await Pokemon.findOne({ name: document.name });
      if (existing) {
        await Pokemon.updateOne({ _id: existing._id }, { $set: document }, { runValidators: true });
        return "updated";
      }
    }

    if (error?.code === 11000 && error?.keyPattern?.pokeApiId) {
      const existing = await Pokemon.findOne({ pokeApiId: document.pokeApiId });
      if (existing) {
        await Pokemon.updateOne({ _id: existing._id }, { $set: document }, { runValidators: true });
        return "updated";
      }
    }

    throw error;
  }
}

async function run() {
  const { limit, offset, concurrency, retries, reset } = parseArgs(process.argv);
  await connectDB(process.env.MONGO_URI);

  if (reset) {
    await Pokemon.deleteMany({});
    console.log("Collection Pokemon reset.");
  }

  const listUrl = `${POKEAPI_BASE_URL}/pokemon?offset=${offset}&limit=${limit}`;
  const listPayload = await fetchJson(listUrl, retries);
  const entries = Array.isArray(listPayload?.results) ? listPayload.results : [];

  let index = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= entries.length) return;

      const entry = entries[current];
      const name = cleanText(entry?.name);

      try {
        const pokemonData = await fetchJson(entry.url, retries);
        const speciesData = await fetchJson(pokemonData?.species?.url, retries);
        const document = buildPokemonDocument(pokemonData, speciesData);

        if (!document.name || !document.imgUrl || !Array.isArray(document.types) || !document.types.length) {
          throw new Error("missing mandatory fields");
        }

        const status = await upsertPokemon(document);
        if (status === "created") created += 1;
        if (status === "updated") updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`FAIL ${current + 1}/${entries.length} ${name}:`, error.message);
      }

      if ((current + 1) % 25 === 0 || current + 1 === entries.length) {
        console.log(
          `Progress ${current + 1}/${entries.length} | created:${created} updated:${updated} failed:${failed}`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(
    `Import termine. Total:${entries.length} | created:${created} updated:${updated} failed:${failed}`
  );
}

run()
  .catch((error) => {
    console.error("Seeder PokeAPI en echec:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
