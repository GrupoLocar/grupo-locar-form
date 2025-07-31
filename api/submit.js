const { IncomingForm } = require("formidable-serverless");
const fs = require("fs");
const { Dropbox } = require("dropbox");
const { MongoClient } = require("mongodb");
const { DateTime } = require("luxon");
require("dotenv").config();

const ALLOWED_ORIGINS = [
  "https://formulario.grupolocar.com",
  "https://grupo-locar-form.vercel.app"
];
function isOriginAllowed(origin = "") {
  return ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app");
}

const dbx = new Dropbox({
  refreshToken: process.env.REFRESH_TOKEN,
  clientId: process.env.APP_KEY,
  clientSecret: process.env.APP_SECRET
});
const uploadFolder = process.env.UPLOAD_FOLDER || "/uploads";

let cachedDb;
async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

module.exports.config = { api: { bodyParser: false } };

module.exports.default = async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (isOriginAllowed(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Método não permitido");

  const form = new IncomingForm({ multiples: true, keepExtensions: true, maxFileSize: 30 * 1024 * 1024 });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ message: "Erro no formulário", err });

    try {
      await dbx.auth.checkAndRefreshAccessToken();
    } catch (authErr) {
      console.error("Falha ao renovar token:", authErr);
      return res.status(500).json({ message: "Auth error", error: authErr });
    }

    // Função para capitalizar
    function formatarTexto(str = "") {
      return str
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    // Normaliza todos os campos texto (exceto email e pix)
    for (const k in fields) {
      if (typeof fields[k] === "string") {
        if (["email", "pix"].includes(k)) {
          fields[k] = fields[k].toLowerCase().trim();
        } else {
          fields[k] = formatarTexto(fields[k]);
        }
      }
    }

    // Campo filhos: só 1 dígito 0‑9
    if ("filhos" in fields) {
      const somenteDigito = fields.filhos.replace(/\D/g, "").slice(0, 1);
      const valor = parseInt(somenteDigito, 10);
      fields.filhos = Number.isInteger(valor) && valor >= 0 && valor <= 9 ? String(valor) : "0";
    }

    const attachments = {};
    const nomeFormatado = (fields.nome || "Anexo").replace(/[^\w\s]/gi, "").trim();

    try {
      for (const campo in files) {
        const lista = Array.isArray(files[campo]) ? files[campo] : [files[campo]];
        attachments[campo] = [];

        await Promise.all(lista.map(async (file) => {
          const temp = file.filepath || file.path;
          const nomeOriginal = file.originalFilename || file.name || "";
          const ext = nomeOriginal.split(".").pop()?.toLowerCase();
          if (!ext || !["pdf", "jpg", "jpeg", "png"].includes(ext)) return;

          const nomeArquivo = `${Date.now()}_${nomeFormatado}-${campo}.${ext}`;
          const dropFn = `${uploadFolder}/${nomeArquivo}`;
          await dbx.filesUpload({ path: dropFn, contents: fs.createReadStream(temp) });

          let url;
          try {
            url = (await dbx.sharingCreateSharedLinkWithSettings({ path: dropFn })).result.url;
          } catch (_) {
            const list = await dbx.sharingListSharedLinks({ path: dropFn, direct_only: true });
            url = list.result.links[0]?.url;
          }
          if (url) attachments[campo].push(url.replace("?dl=0", "?raw=1"));

          fs.unlink(temp, () => {});
        }));
      }
    } catch (upErr) {
      console.error("Erro upload:", upErr);
      return res.status(500).json({ message: "Falha no upload", error: upErr });
    }

    // Converter datas (incluindo emissao_cnh)
    ["validade_cnh", "data_nascimento", "emissao_cnh"].forEach(k => {
      if (fields[k]) {
        const d = new Date(fields[k]);
        if (!isNaN(d)) fields[k] = d;
      }
    });

    try {
      const db = await getDb();
      await db.collection("funcionarios").insertOne({
        ...fields,
        arquivos: attachments,
        data_envio_utc: new Date(),
        data_envio_local: DateTime.now().setZone("America/Sao_Paulo").toFormat("yyyy-LL-dd HH:mm:ss")
      });
    } catch (mongoErr) {
      console.error("Erro Mongo:", mongoErr);
      return res.status(500).json({ message: "Falha ao gravar", error: mongoErr });
    }

    res.status(200).json({ status: "ok", links: attachments });
  });
};
