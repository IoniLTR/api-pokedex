const express = require("express");
const multer = require("multer");

const { getTypes } = require("../controllers/pkmnTypeController");
const ctrl = require("../controllers/pokemonController");

const auth = require("../middlewares/auth");
const permission = require("../middlewares/permission");

const router = express.Router();
const upload = multer();

// Types (déjà fait) : auth minimum (comme TP3: gestion pkmn => auth) :contentReference[oaicite:5]{index=5}
router.get("/types", auth, getTypes);

// --- CRUD Pokemon + Search ---
// TP3 : input en form-data (donc upload.none()) :contentReference[oaicite:6]{index=6}

// Create (TP2/TP3 -> manipulation => on met ADMIN)
router.post("/", auth, permission("ADMIN"), upload.none(), ctrl.create);

// Add region (manipulation => ADMIN)
router.post("/region", auth, permission("ADMIN"), upload.none(), ctrl.addRegion);

// Search (auth minimum)
router.get("/search", auth, ctrl.search);

// Get one by id or name (auth minimum)
router.get("/", auth, ctrl.getOne);

// Delete (ADMIN requis) :contentReference[oaicite:7]{index=7}
router.delete("/", auth, permission("ADMIN"), ctrl.remove);

// Update partiel (ADMIN requis) :contentReference[oaicite:8]{index=8}
router.put("/", auth, permission("ADMIN"), upload.none(), ctrl.update);

// Remove region (ADMIN requis) :contentReference[oaicite:9]{index=9}
router.delete("/region", auth, permission("ADMIN"), ctrl.removeRegion);

module.exports = router;