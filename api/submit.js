// /api/submit.js  – Node 18 (Vercel Serverless)
// Recebe arquivos do formulário, faz upload no Dropbox e grava links no MongoDB Atlas.
// Agora usa refresh token para renovar o access token automaticamente.

const { IncomingForm } = require("formidable-serverless");
const fs               = require("fs");
const { Dropbox }      = require("dropbox");
const { MongoClient }  = require("mongodb");
require("dotenv").config();

// -----------------------------------------------------------------------------
// Dropbox – inicialização com refresh token
// -----------------------------------------------------------------------------
const dbx = new Dropbox({
  accessToken : process.env.ACCESS_TOKEN,   // opcional (primeiro uso)
  refreshToken: process.env.REFRESH_TOKEN,
  clientId    : process.env.APP_KEY,
  clientSecret: process.env.APP_SECRET
});
const uploadFolder = process.env.UPLOAD_FOLDER || "/uploads";

// -----------------------------------------------------------------------------
// Mongo (com cache)
// -----------------------------------------------------------------------------
let cachedDb;
async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

// Desativa body-parser padrão da Vercel
module.exports.config = { api: { bodyParser: false } };

// -----------------------------------------------------------------------------
// Handler principal
// -----------------------------------------------------------------------------
module.exports.default = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Método não permitido");
  }

  try {
    const form = new IncomingForm({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 30 * 1024 * 1024     // 30 MB (ajuste se quiser)
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Erro na leitura do form:", err);
        return res.status(400).json({ message: "Erro no formulário", err });
      }

      // ---------------------------------------
      // Garante token válido antes de começar
      // ---------------------------------------
      try {
        await dbx.auth.checkAndRefreshAccessToken();
      } catch (authErr) {
        console.error("Falha ao renovar token:", authErr);
        return res.status(500).json({ message: "Auth error", error: authErr });
      }

      const attachments = {};

      // Upload de cada arquivo (paralelo)
      try {
        for (const campo in files) {
          const lista = Array.isArray(files[campo]) ? files[campo] : [files[campo]];

          await Promise.all(
            lista.map(async (file) => {
              const tempPath    = file.filepath || file.path;
              const dropboxPath = `${uploadFolder}/${Date.now()}_${file.originalFilename || file.name}`;

              // Upload via stream
              await dbx.filesUpload({
                path: dropboxPath,
                contents: fs.createReadStream(tempPath)
              });

              // Cria (ou obtém) link compartilhável
              let url;
              try {
                const linkRes = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
                url = linkRes.result.url;
              } catch {
                const listRes = await dbx.sharingListSharedLinks({
                  path: dropboxPath,
                  direct_only: true
                });
                url = listRes.result.links[0]?.url;
              }

              if (url) attachments[campo] = url.replace("?dl=0", "?raw=1");
              fs.unlink(tempPath, () => {});
            })
          );
        }
      } catch (uploadErr) {
        console.error("Erro no upload:", uploadErr);
        return res.status(500).json({ message: "Falha no upload", error: uploadErr });
      }

      // Converte datas (se houver)
      ["validade_cnh", "data_nascimento"].forEach((k) => {
        if (fields[k]) {
          const d = new Date(fields[k]);
          if (!isNaN(d)) fields[k] = d;
        }
      });

      // Grava documento no Mongo
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

