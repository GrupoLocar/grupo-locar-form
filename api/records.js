// /api/records.js
import { MongoClient } from "mongodb";
import "dotenv/config";

let cachedDb;
async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const db   = await getDb();
  const dados = await db.collection("funcionarios")
                        .find({}, { projection: { arquivos: 1, nome: 1, email: 1, data_envio: 1 } })
                        .sort({ data_envio: -1 })
                        .toArray();

  res.status(200).json(dados);
}
