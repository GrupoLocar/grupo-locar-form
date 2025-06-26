// /api/submit.js – Node 18 (Vercel Serverless)
// Recebe arquivos, envia ao Dropbox (/uploads) e grava links no MongoDB Atlas.
// CORS dinâmico: aceita Locaweb + produção + qualquer URL *.vercel.app (preview).

const { IncomingForm } = require("formidable-serverless");
const fs               = require("fs");
const { Dropbox }      = require("dropbox");
const { MongoClient }  = require("mongodb");
require("dotenv").config();

// ───────────────────────────────────────────
// 1. CORS – defina domínios fixos e permita previews Vercel
// ───────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://formulario.grupolocar.com",         // front ainda na Locaweb
  "https://grupo-locar-form.vercel.app"        // produção Vercel (quando migrar)
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Libera qualquer preview *.vercel.app
  return origin.endsWith(".vercel.app");
}

// ───────────────────────────────────────────
// 2. Inicializa Dropbox (refresh token)
// ───────────────────────────────────────────
const dbx = new Dropbox({
  accessToken : process.env.ACCESS_TOKEN,      // opcional
  refreshToken: process.env.REFRESH_TOKEN,
  clientId    : process.env.APP_KEY,
  clientSecret: process.env.APP_SECRET
});
const uploadFolder = process.env.UPLOAD_FOLDER || "/uploads";

// ───────────────────────────────────────────
// 3. Conexão MongoDB (com cache)
// ───────────────────────────────────────────
let cachedDb;
async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

// Desativa body-parser padrão
module.exports.config = { api: { bodyParser: false } };

// ───────────────────────────────────────────
// 4. Handler principal
// ───────────────────────────────────────────
module.exports.default = async function handler(req, res) {
  // 4.1 → CORS
  const origin = req.headers.origin || "";
  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Pré-flight
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Método não permitido");
  }

  try {
    const form = new IncomingForm({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 30 * 1024 * 1024 // 30 MB
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Erro na leitura do formulário:", err);
        return res.status(400).json({ message: "Erro no formulário", err });
      }

      // 4.2 → Garante access-token válido
      try {
        await dbx.auth.checkAndRefreshAccessToken();
      } catch (authErr) {
        console.error("Falha ao renovar token:", authErr);
        return res.status(500).json({ message: "Auth error", error: authErr });
      }

      const attachments = {};

      // 4.3 → Upload paralelo
      try {
        for (const campo in files) {
          const lista = Array.isArray(files[campo]) ? files[campo] : [files[campo]];
          await Promise.all(lista.map(async (file) => {
            const temp   = file.filepath || file.path;
            const dropFn = `${uploadFolder}/${Date.now()}_${file.originalFilename || file.name}`;

            await dbx.filesUpload({
              path: dropFn,
              contents: fs.createReadStream(temp)
            });

            let url;
            try {
              url = (await dbx.sharingCreateSharedLinkWithSettings({ path: dropFn })).result.url;
            } catch {
              url = (await dbx.sharingListSharedLinks({ path: dropFn, direct_only: true }))
                      .result.links[0]?.url;
            }

            if (url) attachments[campo] = url.replace("?dl=0", "?raw=1");
            fs.unlink(temp, () => {});
          }));
        }
      } catch (upErr) {
        console.error("Erro no upload:", upErr);
        return res.status(500).json({ message: "Falha no upload", error: upErr });
      }

      // 4.4 → Converte datas (opcional)
      ["validade_cnh", "data_nascimento"].forEach(k => {
        if (fields[k]) {
          const d = new Date(fields[k]);
          if (!isNaN(d)) fields[k] = d;
        }
      });

      // 4.5 → Grava no Mongo
      try {
        const db = await getDb();
        await db.collection("funcionarios").insertOne({
          ...fields,
          arquivos: attachments,
          data_envio: new Date()
        });
      } catch (mongoErr) {
        console.error("Erro Mongo:", mongoErr);
        return res.status(500).json({ message: "Falha ao gravar", error: mongoErr });
      }

      return res.status(200).json({ status: "ok", links: attachments });
    });
  } catch (outer) {
    console.error("Erro inesperado:", outer);
    return res.status(500).json({ message: "Erro interno", error: outer });
  }
};
