const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  if (!mongoUri) throw new Error("MONGO_URI manquant (check .env)");

  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB connected");
}

module.exports = { connectDB };