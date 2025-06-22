const formidable = require("formidable-serverless");
const { google } = require("googleapis");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const isProd = process.env.VERCEL_ENV === "production";
const uploadDir = path.resolve(__dirname, "../public/uploads");

let cachedDb = null;
async function connectToDatabase(uri) {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

async function uploadToGoogleDrive(file) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
    const drive = google.drive({ version: "v3", auth });
    const metadata = {
      name: file.originalFilename,
      parents: [process.env.GOOGLE_FOLDER_ID]
    };
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.filepath)
    };
    const res = await drive.files.create({ requestBody: metadata, media });
    const fileId = res.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" }
    });

    return `https://drive.google.com/uc?id=${fileId}`;
  } catch (err) {
    console.error("Erro no uploadToGoogleDrive:", err);
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido");
  }

  console.log("▶️ Início da função submit.js");
  console.log("📦 isProd:", isProd);
  console.log("📦 uploadDir:", uploadDir);

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Pasta de upload criada:", uploadDir);
    }

    const form = new formidable.IncomingForm({
      multiples: true,
      keepExtensions: true,
      uploadDir
    });

    form.parse(req, async (err, fields, files) => {
      console.log("▶️ Dados do formulário recebidos");
      if (err) {
        console.error("❌ Erro no parse do formulário:", err);
        return res.status(400).json({ status: "erro", message: "Erro no parse", detalhe: err.message });
      }

      console.log("📤 Campos recebidos:", fields);
      console.log("📂 Arquivos recebidos:", files);

      try {
        const camposData = ["validade_cnh", "data_nascimento"];
        camposData.forEach(campo => {
          if (fields[campo]) {
            const data = new Date(fields[campo]);
            if (!isNaN(data)) fields[campo] = data;
          }
        });

        const arquivos = [];
        for (const campo in files) {
          const file = files[campo];
          const fileArray = Array.isArray(file) ? file : [file];

          try {
            for (const f of fileArray) {
              console.log("📁 Processando arquivo:", f);
              if (!f || !f.filepath) {
                console.warn("⚠️ Arquivo inválido ou vazio:", f);
                continue;
              }

              if (isProd) {
                const driveLink = await uploadToGoogleDrive(f);
                arquivos.push(driveLink);
              } else {
                const newFileName = `${Date.now()}-${f.originalFilename}`;
                const newPath = path.join(uploadDir, newFileName);
                console.log("📤 Salvando local:", newPath);
                fs.renameSync(f.filepath, newPath);
                arquivos.push(`/uploads/${newFileName}`);
              }
            }
          } catch (uploadErr) {
            console.error("❌ Erro durante upload do campo", campo, uploadErr);
            return res.status(500).json({
              status: "erro",
              message: "Erro no upload de arquivo",
              detalhe: uploadErr.message
            });
          }
        }

        const db = await connectToDatabase(process.env.MONGODB_URI);
        const dados = {
          ...fields,
          arquivos,
          data_envio: new Date()
        };

        await db.collection("funcionarios").insertOne(dados);
        console.log("✅ Registro salvo no MongoDB");

        res.status(200).json({
          status: "ok",
          recebidos: { fields, arquivos }
        });
      } catch (error) {
        console.error("❌ Erro interno ao salvar dados:", error);
        res.status(500).json({
          status: "erro",
          message: "Erro ao salvar ou processar dados.",
          detalhe: error.message
        });
      }
    });
  } catch (err) {
    console.error("❌ Erro fora do form.parse:", err);
    res.status(500).json({
      status: "erro",
      message: "Erro fora do form.parse",
      detalhe: err.message
    });
  }
};
