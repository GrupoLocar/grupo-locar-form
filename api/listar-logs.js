// /api/listar-logs.js
const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let cachedDb = null;
async function connect(uri) {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

module.exports = async (req, res) => {
  try {
    const db = await connect(process.env.MONGODB_URI);
    const logs = await db.collection("logs").find().sort({ timestamp: -1 }).limit(100).toArray();
    res.status(200).json({ status: "ok", logs });
  } catch (err) {
    res.status(500).json({ status: "erro", message: "Erro ao buscar logs", detalhe: err.message });
  }
};
