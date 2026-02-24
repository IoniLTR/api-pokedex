const mongoose = require("mongoose");
const Pokemon = require("../models/pokemon");

function normalizeType(t) {
  return String(t || "").toUpperCase().trim();
}

function assertObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`${fieldName} invalide`);
    err.statusCode = 400;
    throw err;
  }
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

  const typesRaw = payload.types ?? [];
  const types = Array.isArray(typesRaw)
    ? typesRaw.map(normalizeType)
    : [normalizeType(typesRaw)];

  // NOUVEAU : On ajoute height et weight
  const pkmn = await Pokemon.create({
    name,
    imgUrl,
    description: String(payload.description || ""),
    height: payload.height ? Number(payload.height) : undefined,
    weight: payload.weight ? Number(payload.weight) : undefined,
    types,
    regions: []
  });

  return pkmn;
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

  const idx = pkmn.regions.findIndex(
    (r) => r.regionName.toLowerCase() === rn.toLowerCase()
  );

  if (idx >= 0) {
    pkmn.regions[idx].regionPokedexNumber = num; // update si existe
  } else {
    pkmn.regions.push({ regionName: rn, regionPokedexNumber: num });
  }

  await pkmn.save();
  return pkmn;
}

async function searchPokemons({ page = 1, size = 20, typeOne, typeTwo, partialName }) {
  const p = Math.max(1, Number(page) || 1);
  const s = Math.min(100, Math.max(1, Number(size) || 20));

  const filter = {};

  if (partialName) {
    filter.name = { $regex: String(partialName), $options: "i" };
  }

  const types = [];
  if (typeOne) types.push(normalizeType(typeOne));
  if (typeTwo) types.push(normalizeType(typeTwo));

  if (types.length === 1) filter.types = types[0];
  if (types.length === 2) filter.types = { $all: types };

  const [data, count] = await Promise.all([
    Pokemon.find(filter).sort({ name: 1 }).skip((p - 1) * s).limit(s),
    Pokemon.countDocuments(filter)
  ]);

  return { data, count, page: p, size: s };
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
    return p;
  }

  if (name) {
    const p = await Pokemon.findOne({ name: String(name).trim() });
    if (!p) {
      const err = new Error("Pokemon introuvable");
      err.statusCode = 404;
      throw err;
    }
    return p;
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

  const updates = {};

  if (patch.name !== undefined) updates.name = String(patch.name).trim();
  if (patch.imgUrl !== undefined) updates.imgUrl = String(patch.imgUrl).trim();
  if (patch.description !== undefined) updates.description = String(patch.description);
  
  // NOUVEAU : Mise à jour de la taille et du poids
  if (patch.height !== undefined) updates.height = Number(patch.height);
  if (patch.weight !== undefined) updates.weight = Number(patch.weight);

  if (patch.types !== undefined) {
    const raw = patch.types;
    const types = Array.isArray(raw) ? raw.map(normalizeType) : [normalizeType(raw)];
    updates.types = types;
  }

  const p = await Pokemon.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  });

  if (!p) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }

  return p;
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

module.exports = {
  createPokemon,
  addRegion,
  searchPokemons,
  getOne,
  deletePokemon,
  updatePokemon,
  removeRegion
};