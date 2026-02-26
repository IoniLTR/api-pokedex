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

const abilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isHidden: { type: Boolean, default: false },
    slot: { type: Number, default: 1 }
  },
  { _id: false }
);

const baseStatsSchema = new mongoose.Schema(
  {
    hp: { type: Number, default: 0 },
    attack: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    specialAttack: { type: Number, default: 0 },
    specialDefense: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  { _id: false }
);

const pokemonSchema = new mongoose.Schema(
  {
    pokeApiId: { type: Number, unique: true, sparse: true, index: true },
    nationalDexNumber: { type: Number, index: true },
    slug: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, default: "", trim: true },
    imgUrl: { type: String, required: true, trim: true },
    spriteUrl: { type: String, default: "", trim: true },
    cryUrl: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    height: { type: Number },
    weight: { type: Number },
    baseExperience: { type: Number, default: 0 },
    generation: { type: String, default: "", trim: true },
    habitat: { type: String, default: "", trim: true },
    shape: { type: String, default: "", trim: true },
    color: { type: String, default: "", trim: true },
    growthRate: { type: String, default: "", trim: true },
    eggGroups: { type: [String], default: [] },
    abilities: { type: [abilitySchema], default: [] },
    baseStats: { type: baseStatsSchema, default: () => ({}) },
    captureRate: { type: Number, default: null },
    baseHappiness: { type: Number, default: null },
    hatchCounter: { type: Number, default: null },
    genderRate: { type: Number, default: null },
    isLegendary: { type: Boolean, default: false },
    isMythical: { type: Boolean, default: false },
    isBaby: { type: Boolean, default: false },
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
