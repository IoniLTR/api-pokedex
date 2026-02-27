const express = require("express");
const {
  registerUser,
  loginUser,
  checkUser,
  getUserFavorites,
  updateUserFavorites
} = require("../controllers/userController");
const auth = require("../middlewares/auth");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/checkUser", auth, checkUser);
router.get("/favorites", auth, getUserFavorites);
router.put("/favorites", auth, updateUserFavorites);

module.exports = router;
