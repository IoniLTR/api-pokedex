const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET manquant (check .env)");

  return jwt.sign(
    { id: user._id.toString(), username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
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
    user: { id: user._id.toString(), username: user.username, role: user.role }
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
    user: { id: user._id.toString(), username: user.username, role: user.role }
  };
}

module.exports = { register, login };
