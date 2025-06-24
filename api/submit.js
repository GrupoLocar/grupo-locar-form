// /api/submit.js  – Node 18 (Vercel Serverless Function)
// Faz upload de anexos para o Dropbox e grava link no MongoDB Atlas.
// Dependências: formidable-serverless, dropbox, mongodb, dotenv
// Variáveis de ambiente MONGODB_URI, DROPBOX_ACCESS_TOKEN, DROPBOX_UPLOAD_FOLDER na Vercel.

const { IncomingForm } = require("formidable-serverless");
const fs               = require("fs");
const { Dropbox }      = require("dropbox");
const { MongoClient }  = require("mongodb");
require("dotenv").config();

// --------- Dropbox ----------
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
const uploadFolder = process.env.DROPBOX_UPLOAD_FOLDER || "/uploads";

// --------- Mongo ------------
let cachedDb;
async function getDb () {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedDb = client.db();          // default DB from connection string
  return cachedDb;
}

// ---------- Vercel config: desabilita o bodyParser padrão -------------
module.exports.config = { api: { bodyParser: false } };

// ---------- Handler principal -------------
module.exports.default = async function handler (req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Método não permitido");
  }

  const form = new IncomingForm({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ message: "Erro no envio", err });

    const attachments = {};   // { campoInput: "https://dl.dropboxusercontent.com/..." }

    // Para cada campo de arquivo (pode ter vários arquivos)
    for (const campo in files) {
      const fileList = Array.isArray(files[campo]) ? files[campo] : [files[campo]];

      for (const file of fileList) {
        try {
          const buffer      = fs.readFileSync(file.filepath);
          const dropboxPath = `${uploadFolder}/${Date.now()}_${file.originalFilename}`;

          // 1. Upload
          const upRes = await dbx.filesUpload({ path: dropboxPath, contents: buffer });

          // 2. Link compartilhável (cria ou obtém existente)
          let url;
          try {
            const linkRes = await dbx.sharingCreateSharedLinkWithSettings({ path: upRes.result.path_lower });
            url = linkRes.result.url;
          } catch (e) {
            // Se já existir link, pega o primeiro
            const listRes = await dbx.sharingListSharedLinks({ path: upRes.result.path_lower, direct_only: true });
            url = listRes.result.links[0]?.url;
          }

          // 3. Força download direto
          if (url) {
            url = url.replace("?dl=0", "?raw=1");
            attachments[campo] = url;
          }
        } finally {
          // remove arquivo temporário
          fs.unlinkSync(file.filepath);
        }
      }
    }

    // --------- Conversão simples de datas (ex.: "2025-06-01" -> Date) -----------
    ["validade_cnh", "data_nascimento"].forEach(k => {
      if (fields[k]) {
        const d = new Date(fields[k]);
        if (!isNaN(d)) fields[k] = d;
      }
    });

    // --------- Grava no MongoDB -----------------------------------------------
    const db = await getDb();
    await db.collection("funcionarios").insertOne({
      ...fields,
      arquivos   : attachments,
      data_envio : new Date()
    });

    return res.status(200).json({ status: "ok", links: attachments });
  });
};
