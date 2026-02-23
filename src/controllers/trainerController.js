const svc = require("../services/trainerService");

async function createMe(req, res, next) {
  try {
    const t = await svc.createTrainer({ username: req.user.username });
    res.status(201).json(t);
  } catch (e) {
    next(e);
  }
}

async function getMe(req, res, next) {
  try {
    const t = await svc.getMyTrainer({ username: req.user.username });
    res.status(200).json(t);
  } catch (e) {
    next(e);
  }
}

async function deleteMe(req, res, next) {
  try {
    await svc.deleteMyTrainer({ username: req.user.username });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

async function mark(req, res, next) {
  try {
    // form-data => req.body (via multer.none())
    const t = await svc.markPokemon({
      username: req.user.username,
      pkmnID: req.body.pkmnID,
      status: req.body.status
    });
    res.status(200).json(t);
  } catch (e) {
    next(e);
  }
}

module.exports = { createMe, getMe, deleteMe, mark };