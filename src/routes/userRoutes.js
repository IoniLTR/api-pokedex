const express = require("express");
const { registerUser, loginUser, checkUser } = require("../controllers/userController");
const auth = require("../middlewares/auth");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/checkUser", auth, checkUser);

module.exports = router;