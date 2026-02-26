require("dotenv").config();

const mongoose = require("mongoose");
const Pokemon = require("../models/pokemon");
const { connectDB } = require("../config/db");
const { fetchPokemonCryUrlFromPokepedia } = require("../utils/pokepediaCry");

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const force = args.has("--force");

  const limitIndex = argv.indexOf("--limit");
  const limitRaw = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : NaN;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : null;

  return { force, limit };
}

async function run() {
  const { force, limit } = parseArgs(process.argv);

  await connectDB(process.env.MONGO_URI);

  const filter = force
    ? {}
    : {
        $or: [{ cryUrl: { $exists: false } }, { cryUrl: "" }]
      };

  const query = Pokemon.find(filter).sort({ name: 1 });
  if (limit) query.limit(limit);

  const pokemons = await query.exec();

  let scanned = 0;
  let updated = 0;
  let missing = 0;

  for (const pokemon of pokemons) {
    scanned += 1;

    const cryUrl = await fetchPokemonCryUrlFromPokepedia(pokemon.name);
    if (!cryUrl) {
      missing += 1;
      continue;
    }

    const currentCry = String(pokemon.cryUrl || "").trim();
    if (currentCry !== cryUrl) {
      pokemon.cryUrl = cryUrl;
      await pokemon.save();
      updated += 1;
    }
  }

  console.log(
    `Sync cris terminee: ${scanned} pokemon(s) scannes, ${updated} mis a jour, ${missing} sans cri detecte.`
  );
}

run()
  .catch((err) => {
    console.error("Echec sync cris:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

