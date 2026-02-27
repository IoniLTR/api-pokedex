const { register, login, getFavorites, setFavorites } = require("../services/userService");

async function registerUser(req, res, next) {
  try {
    const result = await register(req.body);
    return res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

async function loginUser(req, res, next) {
  try {
    const result = await login(req.body);
    return res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

function checkUser(req, res) {
  // req.user est injecté par middleware auth
  return res.status(200).json({ user: req.user });
}

async function getUserFavorites(req, res, next) {
  try {
    const result = await getFavorites({ userId: req.user?.id });
    return res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

async function updateUserFavorites(req, res, next) {
  try {
    const result = await setFavorites({
      userId: req.user?.id,
      favorites: req.body?.favorites
    });
    return res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

module.exports = { registerUser, loginUser, checkUser, getUserFavorites, updateUserFavorites };
