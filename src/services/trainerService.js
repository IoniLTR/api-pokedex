const mongoose = require("mongoose");
const Trainer = require("../models/trainer");
const Pokemon = require("../models/pokemon");

function assertObjectId(id, fieldName = "id") {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`${fieldName} invalide`);
    err.statusCode = 400;
    throw err;
  }
}

async function createTrainer({ username }) {
  const exists = await Trainer.findOne({ username });
  if (exists) {
    const err = new Error("Trainer existe déjà");
    err.statusCode = 409;
    throw err;
  }
  return Trainer.create({ username, marks: [] });
}

async function getMyTrainer({ username }) {
  const t = await Trainer.findOne({ username });
  if (!t) {
    const err = new Error("Trainer introuvable");
    err.statusCode = 404;
    throw err;
  }
  return t;
}

async function deleteMyTrainer({ username }) {
  const del = await Trainer.findOneAndDelete({ username });
  if (!del) {
    const err = new Error("Trainer introuvable");
    err.statusCode = 404;
    throw err;
  }
}

async function markPokemon({ username, pkmnID, status }) {
  if (!pkmnID || !status) {
    const err = new Error("pkmnID et status requis");
    err.statusCode = 400;
    throw err;
  }

  assertObjectId(pkmnID, "pkmnID");

  const normalized = String(status).toUpperCase().trim();
  if (!["SEEN", "CATCHED"].includes(normalized)) {
    const err = new Error("status doit être SEEN ou CATCHED");
    err.statusCode = 400;
    throw err;
  }

  const p = await Pokemon.findById(pkmnID);
  if (!p) {
    const err = new Error("Pokemon introuvable");
    err.statusCode = 404;
    throw err;
  }

  // auto-create trainer si absent
  let t = await Trainer.findOne({ username });
  if (!t) t = await Trainer.create({ username, marks: [] });

  const idx = t.marks.findIndex((m) => m.pkmnId.toString() === pkmnID);

  if (idx >= 0) {
    // update
    t.marks[idx].status = normalized;
  } else {
    // insert
    t.marks.push({ pkmnId: p._id, status: normalized });
  }

  await t.save();

  return t;
}

module.exports = {
  createTrainer,
  getMyTrainer,
  deleteMyTrainer,
  markPokemon
};