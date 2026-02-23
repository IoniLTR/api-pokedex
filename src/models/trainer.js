const mongoose = require("mongoose");

const markSchema = new mongoose.Schema(
  {
    pkmnId: { type: mongoose.Schema.Types.ObjectId, ref: "Pokemon", required: true },
    status: { type: String, enum: ["SEEN", "CATCHED"], required: true }
  },
  { _id: false }
);

const trainerSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    marks: { type: [markSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trainer", trainerSchema);