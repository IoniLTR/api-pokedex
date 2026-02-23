const { register, login } = require("../services/userService");

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

module.exports = { registerUser, loginUser, checkUser };