require("dotenv").config();

const mongoose = require("mongoose");
const Pokemon = require("../models/pokemon");
const { connectDB } = require("../config/db");
const { resolveRegionName, resolveRegionImageUrl } = require("../utils/regionImages");

async function run() {
  await connectDB(process.env.MONGO_URI);

  let scanned = 0;
  let updatedPokemons = 0;
  let updatedRegions = 0;

  const cursor = Pokemon.find({ "regions.0": { $exists: true } }).cursor();

  for await (const pokemon of cursor) {
    scanned += 1;
    let hasChanges = false;

    pokemon.regions.forEach((region) => {
      const previousName = String(region.regionName || "").trim();
      const previousImage = String(region.regionImageUrl || "").trim();

      const nextName = resolveRegionName(previousName, region.regionPokedexNumber) || previousName;
      const nextImage =
        previousImage || resolveRegionImageUrl(nextName, region.regionPokedexNumber);

      if (nextName !== previousName || nextImage !== previousImage) {
        region.regionName = nextName;
        region.regionImageUrl = nextImage;
        updatedRegions += 1;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      updatedPokemons += 1;
      await pokemon.save();
    }
  }

  console.log(
    `Correction terminee: ${scanned} pokemon(s) scannes, ${updatedPokemons} pokemon(s) modifies, ${updatedRegions} region(s) corrigee(s).`
  );
}

run()
  .catch((err) => {
    console.error("Echec correction regions:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
