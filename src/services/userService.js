const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");
const Pokemon = require("../models/pokemon");

function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET manquant (check .env)");

  return jwt.sign(
    { id: user._id.toString(), username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function buildAuthUserPayload(user) {
  return { id: user._id.toString(), username: user.username, role: user.role };
}

async function findUserFromTokenUserId(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!mongoose.isValidObjectId(normalizedUserId)) {
    const err = new Error("UNAUTHORIZED");
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(normalizedUserId);
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    err.statusCode = 401;
    throw err;
  }

  return user;
}

function normalizeFavoriteIds(values) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  const normalized = [];

  for (const value of values) {
    const id = String(value || "").trim();
    if (!id || seen.has(id) || !mongoose.isValidObjectId(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

async function keepExistingPokemonIds(ids) {
  if (!ids.length) return [];

  const existing = await Pokemon.find({ _id: { $in: ids } }).select("_id").lean();
  const existingIds = new Set(existing.map((pokemon) => String(pokemon._id)));

  return ids.filter((id) => existingIds.has(id));
}

async function register({ username, password, role }) {
  if (!username || !password) {
    const err = new Error("username et password sont requis");
    err.statusCode = 400;
    throw err;
  }

  const existing = await User.findOne({ username });
  if (existing) {
    const err = new Error("username déjà utilisé");
    err.statusCode = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 10);
  const normalizedRole = role === "ADMIN" ? "ADMIN" : "USER";

  const user = await User.create({
    username,
    password: hashed,
    role: normalizedRole
  });

  const token = signToken(user);
  return {
    token,
    user: buildAuthUserPayload(user)
  };
}

async function login({ username, password }) {
  if (!username || !password) {
    const err = new Error("username et password sont requis");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ username });
  if (!user) {
    const err = new Error("identifiants invalides");
    err.statusCode = 401;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const err = new Error("identifiants invalides");
    err.statusCode = 401;
    throw err;
  }

  const token = signToken(user);
  return {
    token,
    user: buildAuthUserPayload(user)
  };
}

async function getFavorites({ userId }) {
  const user = await findUserFromTokenUserId(userId);
  const ids = Array.isArray(user.favorites) ? user.favorites.map((id) => String(id)) : [];
  return { favorites: ids };
}

async function setFavorites({ userId, favorites }) {
  const user = await findUserFromTokenUserId(userId);
  if (!Array.isArray(favorites)) {
    const err = new Error("favorites doit etre un tableau");
    err.statusCode = 400;
    throw err;
  }

  const normalizedIds = normalizeFavoriteIds(favorites);
  const existingIds = await keepExistingPokemonIds(normalizedIds);

  user.favorites = existingIds;
  await user.save();

  return { favorites: user.favorites.map((id) => String(id)) };
}

module.exports = { register, login, getFavorites, setFavorites };
