const mongoose = require("mongoose");
const { PkmnType } = require("./pkmnType");

const regionSchema = new mongoose.Schema(
  {
    regionName: { type: String, required: true, trim: true },
    regionPokedexNumber: { type: Number, required: true },
    regionImageUrl: { type: String, default: "", trim: true }
  },
  { _id: false }
);

const pokemonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    imgUrl: { type: String, required: true, trim: true },
    cryUrl: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    height: { type: Number }, // Ajout de la taille (en mètres)
    weight: { type: Number }, // Ajout du poids (en kg)
    types: {
      type: [String],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length >= 1 &&
          arr.length <= 2 &&
          arr.every((t) => PkmnType.includes(String(t).toUpperCase())),
        message: "types doit contenir 1 ou 2 types valides"
      },
      required: true
    },
    regions: { type: [regionSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pokemon", pokemonSchema);
