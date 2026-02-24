const express = require("express");
const multer = require("multer");

const { getTypes } = require("../controllers/pkmnTypeController");
const ctrl = require("../controllers/pokemonController");

const auth = require("../middlewares/auth");
const permission = require("../middlewares/permission");

const router = express.Router();
const upload = multer();

// Types : auth minimum (comme TP3: gestion pkmn => auth)
router.get("/types", auth, getTypes);

// --- CRUD Pokemon + Search ---
// Create (TP2/TP3 -> manipulation => on met ADMIN)
router.post("/", auth, permission("ADMIN"), upload.none(), ctrl.create);

// Add region (manipulation => ADMIN)
router.post("/region", auth, permission("ADMIN"), upload.none(), ctrl.addRegion);

// Search (PUBLIC : On a retiré "auth" ici pour que le frontend puisse y accéder sans token)
router.get("/search", ctrl.search);

// Get one by id or name (auth minimum)
router.get("/", auth, ctrl.getOne);

// Delete (ADMIN requis)
router.delete("/", auth, permission("ADMIN"), ctrl.remove);

// Update partiel (ADMIN requis)
router.put("/", auth, permission("ADMIN"), upload.none(), ctrl.update);

// Remove region (ADMIN requis)
router.delete("/region", auth, permission("ADMIN"), ctrl.removeRegion);

module.exports = router;