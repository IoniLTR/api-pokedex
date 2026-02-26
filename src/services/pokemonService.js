const mongoose = require("mongoose");
const Pokemon = require("../models/pokemon");
const { resolveRegionImageUrl, resolveRegionName } = require("../utils/regionImages");
const { fetchPokemonCryUrlFromPokepedia } = require("../utils/pokepediaCry");

function normalizeType(t) {
  return String(t || "").toUpperCase().trim();
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function assertObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`${fieldName} invalide`);
    err.statusCode = 400;
    throw err;
  }
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toFiniteNumberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toTrimmedStringOrUndefined(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function normalizeStringArray(value) {
  const raw = parseMaybeJson(value);
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function normalizeAbilities(value) {
  const raw = parseMaybeJson(value);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((ability, index) => {
      const base = ability && typeof ability === "object" ? ability : {};
      const name = String(base.name || "").trim();
      if (!name) return null;
      return {
        name,
        isHidden: toBoolean(base.isHidden ?? base.is_hidden),
        slot: Number.isFinite(Number(base.slot)) ? Number(base.slot) : index + 1
      };
    })
    .filter(Boolean);
}

function normalizeBaseStats(value) {
  const raw = parseMaybeJson(value);
  const source = raw && typeof raw === "object" ? raw : {};

  const hp = Math.max(0, Number(source.hp) || 0);
  const attack = Math.max(0, Number(source.attack) || 0);
  const defense = Math.max(0, Number(source.defense) || 0);
  const specialAttack = Math.max(0, Number(source.specialAttack ?? source.special_attack) || 0);
  const specialDefense = Math.max(
    0,
    Number(source.specialDefense ?? source.special_defense) || 0
  );
  const speed = Math.max(0, Number(source.speed) || 0);
  const total = Math.max(0, Number(source.total) || hp + attack + defense + specialAttack + specialDefense + speed);

  return { hp, attack, defense, specialAttack, specialDefense, speed, total };
}

function buildExtendedPokemonFields(payload = {}) {
  const next = {};

  if (payload.pokeApiId !== undefined) {
    const pokeApiId = toFiniteNumberOrUndefined(payload.pokeApiId);
    if (pokeApiId !== undefined) next.pokeApiId = pokeApiId;
  }

  if (payload.nationalDexNumber !== undefined) {
    const nationalDexNumber = toFiniteNumberOrUndefined(payload.nationalDexNumber);
    if (nationalDexNumber !== undefined) next.nationalDexNumber = nationalDexNumber;
  }

  if (payload.slug !== undefined) next.slug = toTrimmedStringOrUndefined(payload.slug) || "";
  if (payload.displayName !== undefined) {
    next.displayName = toTrimmedStringOrUndefined(payload.displayName) || "";
  }
  if (payload.spriteUrl !== undefined) next.spriteUrl = toTrimmedStringOrUndefined(payload.spriteUrl) || "";

  if (payload.height !== undefined) next.height = toFiniteNumberOrUndefined(payload.height);
  if (payload.weight !== undefined) next.weight = toFiniteNumberOrUndefined(payload.weight);
  if (payload.baseExperience !== undefined) {
    next.baseExperience = toFiniteNumberOrUndefined(payload.baseExperience);
  }

  if (payload.generation !== undefined) next.generation = toTrimmedStringOrUndefined(payload.generation) || "";
  if (payload.habitat !== undefined) next.habitat = toTrimmedStringOrUndefined(payload.habitat) || "";
  if (payload.shape !== undefined) next.shape = toTrimmedStringOrUndefined(payload.shape) || "";
  if (payload.color !== undefined) next.color = toTrimmedStringOrUndefined(payload.color) || "";
  if (payload.growthRate !== undefined) next.growthRate = toTrimmedStringOrUndefined(payload.growthRate) || "";

  if (payload.eggGroups !== undefined) next.eggGroups = normalizeStringArray(payload.eggGroups);
  if (payload.abilities !== undefined) next.abilities = normalizeAbilities(payload.abilities);
  if (payload.baseStats !== undefined) next.baseStats = normalizeBaseStats(payload.baseStats);

  if (payload.captureRate !== undefined) next.captureRate = toFiniteNumberOrUndefined(payload.captureRate);
  if (payload.baseHappiness !== undefined) {
    next.baseHappiness = toFiniteNumberOrUndefined(payload.baseHappiness);
  }
  if (payload.hatchCounter !== undefined) next.hatchCounter = toFiniteNumberOrUndefined(payload.hatchCounter);
  if (payload.genderRate !== undefined) next.genderRate = toFiniteNumberOrUndefined(payload.genderRate);

  if (payload.isLegendary !== undefined) next.isLegendary = toBoolean(payload.isLegendary);
  if (payload.isMythical !== undefined) next.isMythical = toBoolean(payload.isMythical);
  if (payload.isBaby !== undefined) next.isBaby = toBoolean(payload.isBaby);

  return next;
}

function enrichRegions(regions) {
  if (!Array.isArray(regions)) return [];

  return regions.map((region) => {
    const base = region?.toObject ? region.toObject() : region;
    const resolvedName = resolveRegionName(base?.regionName, base?.regionPokedexNumber);
    const imageUrl =
      String(base?.regionImageUrl || "").trim() ||
      resolveRegionImageUrl(resolvedName, base?.regionPokedexNumber);
    return {
      ...base,
      regionName: resolvedName || base?.regionName,
      regionImageUrl: imageUrl
    };
  });
}

function enrichPokemon(pokemon) {
  if (!pokemon) return pokemon;
  const base = pokemon?.toObject ? pokemon.toObject() : pokemon;
  return {
    ...base,
    regions: enrichRegions(base.regions)
  };
}

async function createPokemon(payload) {
  const name = String(payload.name || "").trim();
  if (!name) {
    const err = new Error("name requis");
    err.statusCode = 400;
    throw err;
  }

  const imgUrl = String(payload.imgUrl || "").trim();
  if (!imgUrl) {
    const err = new Error("imgUrl requis");
    err.statusCode = 400;
    throw err;
  }

  const exists = await Pokemon.findOne({ name });
  if (exists) {
    const err = new Error("Pokemon existe déjà (name)");
    err.statusCode = 409;
    throw err;
  }

  const typesRaw = parseMaybeJson(payload.types ?? []);
  let types = [];
  if (Array.isArray(typesRaw)) {
    types = typesRaw.map(normalizeType);
  } else if (typeof typesRaw === "string" && typesRaw.includes(",")) {
    types = typesRaw
      .split(",")
      .map((entry) => normalizeType(entry))
      .filter(Boolean);
  } else {
    types = [normalizeType(typesRaw)];
  }

  const manualCryUrl = String(payload.cryUrl || "").trim();
  let resolvedCryUrl = manualCryUrl;
  if (!resolvedCryUrl) {
    resolvedCryUrl = await fetchPokemonCryUrlFromPokepedia(name);
  }

  const extendedFields = buildExtendedPokemonFields(payload);

  const pkmn = await Pokemon.create({
    name,
    imgUrl,
    ...extendedFields,
    cryUrl: resolvedCryUrl,
    description: String(payload.description || ""),
    types,
    regions: []
  });

  return enrichPokemon(pkmn);
}

async function addRegion({ pkmnID, regionName, regionPokedexNumber }) {
  if (!pkmnID || !regionName || regionPokedexNumber === undefined) {
    const err = new Error("pkmnID, regionName, regionPokedexNumber requis");
    err.statusCode = 400;
    throw err;
  }

  assertObjectId(pkmnID, "pkmnID");

  const pkmn = await Pokemon.findById(pkmnID);
  if (!pkmn) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }

  const rn = String(regionName).trim();
  const num = Number(regionPokedexNumber);

  if (!rn) {
    const err = new Error("regionName requis");
    err.statusCode = 400;
    throw err;
  }
  if (Number.isNaN(num)) {
    const err = new Error("regionPokedexNumber invalide");
    err.statusCode = 400;
    throw err;
  }

  const resolvedName = resolveRegionName(rn, num) || rn;
  const resolvedImageUrl = resolveRegionImageUrl(resolvedName, num);

  const idx = pkmn.regions.findIndex((r) => {
    const current = String(r.regionName || "").toLowerCase();
    return current === rn.toLowerCase() || current === resolvedName.toLowerCase();
  });

  if (idx >= 0) {
    pkmn.regions[idx].regionName = resolvedName;
    pkmn.regions[idx].regionPokedexNumber = num; // update si existe
    pkmn.regions[idx].regionImageUrl = resolvedImageUrl;
  } else {
    pkmn.regions.push({
      regionName: resolvedName,
      regionPokedexNumber: num,
      regionImageUrl: resolvedImageUrl
    });
  }

  await pkmn.save();
  return enrichPokemon(pkmn);
}

async function searchPokemons({ page = 1, size = 20, typeOne, typeTwo, partialName }) {
  const p = Math.max(1, Number(page) || 1);
  const s = Math.min(100, Math.max(1, Number(size) || 20));

  const filter = {};

  if (partialName) {
    const regex = { $regex: String(partialName), $options: "i" };
    filter.$or = [{ name: regex }, { displayName: regex }, { slug: regex }];
  }

  const types = [];
  if (typeOne) types.push(normalizeType(typeOne));
  if (typeTwo) types.push(normalizeType(typeTwo));

  if (types.length === 1) filter.types = types[0];
  if (types.length === 2) filter.types = { $all: types };

  const [data, count] = await Promise.all([
    Pokemon.find(filter).sort({ nationalDexNumber: 1, name: 1 }).skip((p - 1) * s).limit(s),
    Pokemon.countDocuments(filter)
  ]);

  return { data: data.map(enrichPokemon), count, page: p, size: s };
}

async function getOne({ id, name }) {
  if (id) {
    assertObjectId(id, "id");

    const p = await Pokemon.findById(id);
    if (!p) {
      const err = new Error("Pokemon introuvable");
      err.statusCode = 404;
      throw err;
    }
    return enrichPokemon(p);
  }

  if (name) {
    const exactName = String(name).trim();
    const p =
      (await Pokemon.findOne({ name: exactName })) ||
      (await Pokemon.findOne({ displayName: exactName })) ||
      (await Pokemon.findOne({ slug: exactName }));
    if (!p) {
      const err = new Error("Pokemon introuvable");
      err.statusCode = 404;
      throw err;
    }
    return enrichPokemon(p);
  }

  const err = new Error("Fournir id ou name");
  err.statusCode = 400;
  throw err;
}

async function deletePokemon({ id }) {
  if (!id) {
    const err = new Error("id requis");
    err.statusCode = 400;
    throw err;
  }

  assertObjectId(id, "id");

  const deleted = await Pokemon.findByIdAndDelete(id);
  if (!deleted) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }
}

async function updatePokemon({ id, patch }) {
  if (!id) {
    const err = new Error("id requis");
    err.statusCode = 400;
    throw err;
  }

  assertObjectId(id, "id");

  const current = await Pokemon.findById(id);
  if (!current) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }

  const updates = {};
  const extendedFields = buildExtendedPokemonFields(patch);
  Object.assign(updates, extendedFields);

  if (patch.name !== undefined) updates.name = String(patch.name).trim();
  if (patch.imgUrl !== undefined) updates.imgUrl = String(patch.imgUrl).trim();
  if (patch.cryUrl !== undefined) updates.cryUrl = String(patch.cryUrl).trim();
  if (patch.description !== undefined) updates.description = String(patch.description);

  if (patch.types !== undefined) {
    const raw = parseMaybeJson(patch.types);
    let types = [];

    if (Array.isArray(raw)) {
      types = raw.map(normalizeType);
    } else if (typeof raw === "string" && raw.includes(",")) {
      types = raw
        .split(",")
        .map((entry) => normalizeType(entry))
        .filter(Boolean);
    } else {
      types = [normalizeType(raw)];
    }

    updates.types = types;
  }

  const hasCryUrlPatch = patch.cryUrl !== undefined;
  const nextName = updates.name || current.name;
  const currentCryUrl = String(current.cryUrl || "").trim();
  if (!hasCryUrlPatch && patch.name !== undefined && !currentCryUrl) {
    updates.cryUrl = await fetchPokemonCryUrlFromPokepedia(nextName);
  }

  const p = await Pokemon.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  });

  return enrichPokemon(p);
}

async function removeRegion({ pkmnID, regionName }) {
  if (!pkmnID || !regionName) {
    const err = new Error("pkmnID et regionName requis");
    err.statusCode = 400;
    throw err;
  }

  assertObjectId(pkmnID, "pkmnID");

  const p = await Pokemon.findById(pkmnID);
  if (!p) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }

  const before = p.regions.length;

  p.regions = p.regions.filter(
    (r) => r.regionName.toLowerCase() !== String(regionName).toLowerCase()
  );

  if (p.regions.length === before) {
    const err = new Error("Région introuvable sur ce Pokemon");
    err.statusCode = 404;
    throw err;
  }

  await p.save();
}

async function syncPokemonCry({ pkmnID, name, force = false }) {
  let pokemon = null;

  if (pkmnID) {
    assertObjectId(pkmnID, "pkmnID");
    pokemon = await Pokemon.findById(pkmnID);
  } else if (name) {
    pokemon = await Pokemon.findOne({ name: String(name).trim() });
  } else {
    const err = new Error("pkmnID ou name requis");
    err.statusCode = 400;
    throw err;
  }

  if (!pokemon) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }

  const hasExistingCry = Boolean(String(pokemon.cryUrl || "").trim());
  if (hasExistingCry && !toBoolean(force)) {
    return enrichPokemon(pokemon);
  }

  const cryUrl = await fetchPokemonCryUrlFromPokepedia(pokemon.name);
  if (cryUrl) {
    pokemon.cryUrl = cryUrl;
    await pokemon.save();
  } else if (!hasExistingCry) {
    pokemon.cryUrl = "";
    await pokemon.save();
  }

  return enrichPokemon(pokemon);
}

module.exports = {
  createPokemon,
  addRegion,
  searchPokemons,
  getOne,
  deletePokemon,
  updatePokemon,
  removeRegion,
  syncPokemonCry
};
