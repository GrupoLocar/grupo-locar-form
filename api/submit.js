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

  const form = new IncomingForm({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 30 * 1024 * 1024,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ message: "Erro no formulário", err });

    console.log("📥 Campos brutos recebidos:", fields);

    // Função para capitalizar texto (suporta Unicode)
    function formatarTexto(str = "") {
      return str
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\p{L}/gu, match => match.toUpperCase());
    }

    // Normaliza todos os campos de texto (exceto email e pix)
    Object.keys(fields).forEach((k) => {
      if (typeof fields[k] === "string") {
        if (k === "email" || k === "pix") {
          fields[k] = fields[k].toLowerCase().trim();
        } else {
          fields[k] = formatarTexto(fields[k]);
        }
      }
    });

    console.log("✅ Campos normalizados:", fields);

    // Validação do campo 'filhos': apenas um dígito de 0 a 9
    if ("filhos" in fields) {
      const digit = fields.filhos.replace(/[^0-9]/g, "").slice(0, 1);
      fields.filhos = digit || "0";
    }

    const attachments = {};
    // remove caracteres não-letra do nome para usar no filename
    const nomeFormatado = fields.nome
      ? fields.nome.replace(/[^\p{L}\s]/gu, "").trim()
      : "Anexo";

    try {
      for (const campo in files) {
        const lista = Array.isArray(files[campo]) ? files[campo] : [files[campo]];
        attachments[campo] = [];

        await Promise.all(
          lista.map(async (file) => {
            const temp = file.filepath || file.path;
            const original = file.originalFilename || file.name || "";
            const ext = original.split(".").pop().toLowerCase();
            // ignora arquivos sem extensão válida
            if (!ext || !["pdf", "jpg", "jpeg", "png"].includes(ext)) return;

            const filename = `${Date.now()}_${nomeFormatado}-${campo}.${ext}`;
            const dropPath = `${uploadFolder}/${filename}`;
            await dbx.filesUpload({ path: dropPath, contents: fs.createReadStream(temp) });

            let url;
            try {
              url = (await dbx.sharingCreateSharedLinkWithSettings({ path: dropPath })).result.url;
            } catch {
              const list = await dbx.sharingListSharedLinks({ path: dropPath, direct_only: true });
              url = list.result.links[0]?.url;
            }
            if (url) {
              attachments[campo].push(url.replace("?dl=0", "?raw=1"));
            }
            fs.unlink(temp, () => {});
          })
        );
      }
    } catch (uploadErr) {
      console.error("❌ Erro no upload:", uploadErr);
      return res.status(500).json({ message: "Falha no upload", error: uploadErr });
    }

    // Conversão de campos de data (incluindo emissao_cnh)
    ["validade_cnh", "data_nascimento", "emissao_cnh"].forEach((k) => {
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
        data_envio_local: DateTime.now()
          .setZone("America/Sao_Paulo")
          .toFormat("yyyy-LL-dd HH:mm:ss"),
      });
    } catch (mongoErr) {
      console.error("❌ Erro ao gravar no Mongo:", mongoErr);
      return res.status(500).json({ message: "Falha ao gravar", error: mongoErr });
    }

    return res.status(200).json({ status: "ok", links: attachments });
  });
};
