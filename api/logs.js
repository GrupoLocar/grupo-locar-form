const { MongoClient } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let cachedDb = null;

async function connectToDatabase(uri) {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "erro", message: "Apenas POST permitido." });
  }

  try {
    const db = await connectToDatabase(process.env.MONGODB_URI);
    const { acao, detalhes } = req.body || {};

    if (!acao) {
      return res.status(400).json({ status: "erro", message: "Campo 'acao' é obrigatório." });
    }

    const log = {
      acao,
      detalhes: detalhes || null,
      timestamp: new Date()
    };

    await db.collection("logs").insertOne(log);

    res.status(200).json({ status: "ok", message: "Log registrado com sucesso." });
  } catch (error) {
    console.error("Erro ao registrar log:", error);
    res.status(500).json({ status: "erro", message: "Erro ao registrar log.", detalhe: error.message });
  }
};
