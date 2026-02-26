const svc = require("../services/pokemonService");

async function create(req, res, next) {
  try {
    const p = await svc.createPokemon(req.body);
    return res.status(201).json(p);
  } catch (e) {
    next(e);
  }
}

async function addRegion(req, res, next) {
  try {
    const p = await svc.addRegion(req.body);
    return res.status(200).json(p);
  } catch (e) {
    next(e);
  }
}

async function search(req, res, next) {
  try {
    const result = await svc.searchPokemons(req.query);
    return res
      .status(200)
      .json({ data: result.data, count: result.count, page: result.page, size: result.size });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const p = await svc.getOne({ id: req.query.id, name: req.query.name });
    return res.status(200).json(p);
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await svc.deletePokemon({ id: req.query.id });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    // support: query + body (form-data via multer.none()) + json
    const patch = { ...req.query, ...req.body };
    const p = await svc.updatePokemon({ id: req.query.id, patch });
    return res.status(200).json(p);
  } catch (e) {
    next(e);
  }
}

async function removeRegion(req, res, next) {
  try {
    await svc.removeRegion({
      pkmnID: req.query.pkmnID,
      regionName: req.query.regionName
    });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
}

async function syncCry(req, res, next) {
  try {
    const p = await svc.syncPokemonCry({
      pkmnID: req.body?.pkmnID || req.query?.pkmnID,
      name: req.body?.name || req.query?.name,
      force: req.body?.force ?? req.query?.force
    });
    return res.status(200).json(p);
  } catch (e) {
    next(e);
  }
}

module.exports = { create, addRegion, search, getOne, remove, update, removeRegion, syncCry };
