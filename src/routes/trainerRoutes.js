const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const ctrl = require("../controllers/trainerController");

const router = express.Router();
const upload = multer();

router.post("/", auth, ctrl.createMe);            // create my trainer (username from token)
router.get("/", auth, ctrl.getMe);                // get my trainer
router.delete("/", auth, ctrl.deleteMe);          // delete my trainer
router.post("/mark", auth, upload.none(), ctrl.mark); // mark pokemon seen/catched

module.exports = router;