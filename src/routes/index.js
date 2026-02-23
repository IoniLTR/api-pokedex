const express = require("express");
const pkmnRoutes = require("./pkmnRoutes");
const userRoutes = require("./userRoutes");
const trainerRoutes = require("./trainerRoutes");

const router = express.Router();

router.use("/pkmn", pkmnRoutes);
router.use("/user", userRoutes);
router.use("/trainer", trainerRoutes);

module.exports = router;