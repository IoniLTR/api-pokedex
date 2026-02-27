const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    favorites: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pokemon" }],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
