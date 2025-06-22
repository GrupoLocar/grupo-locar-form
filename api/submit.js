// const formidable = require("formidable-serverless");
// const { google } = require("googleapis");
// const { MongoClient } = require("mongodb");
// const path = require("path");
// const fs = require("fs");
// require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// const isProd = process.env.VERCEL_ENV === "production";
// const uploadDir = path.resolve(__dirname, "../public/uploads");

// let cachedDb = null;
// async function connectToDatabase(uri) {
//   if (cachedDb) return cachedDb;
//   const client = new MongoClient(uri);
//   await client.connect();
//   cachedDb = client.db();
//   return cachedDb;
// }

// async function uploadToGoogleDrive(file) {
//   const auth = new google.auth.GoogleAuth({
//     credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
//     scopes: ["https://www.googleapis.com/auth/drive"]
//   });
//   const drive = google.drive({ version: "v3", auth });
//   const metadata = {
//     name: file.originalFilename,
//     parents: [process.env.GOOGLE_FOLDER_ID]
//   };
//   const media = {
//     mimeType: file.mimetype,
//     body: fs.createReadStream(file.filepath)
//   };
//   const res = await drive.files.create({ requestBody: metadata, media });
//   const fileId = res.data.id;

//   await drive.permissions.create({
//     fileId,
//     requestBody: { role: "reader", type: "anyone" }
//   });

//   return `https://drive.google.com/uc?id=${fileId}`;
// }

// module.exports = async (req, res) => {
//   if (req.method !== "POST") {
//     return res.status(405).send("Método não permitido");
//   }

//   if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
//   }

//   const form = new formidable.IncomingForm({
//     multiples: true,
//     keepExtensions: true,
//     uploadDir
//   });

//   form.parse(req, async (err, fields, files) => {
//     console.log("▶️ FIELDS:", fields);
//     console.log("▶️ FILES:", files);
//     console.log("▶️ isProd:", isProd);

//     if (err) {
//       console.error("Erro ao processar o formulário:", err);
//       return res.status(400).send("Erro no envio.");
//     }

//     try {
//       const camposData = ["validade_cnh", "data_nascimento"];
//       camposData.forEach(campo => {
//         if (fields[campo]) {
//           const data = new Date(fields[campo]);
//           if (!isNaN(data)) fields[campo] = data;
//         }
//       });

//       const arquivos = [];
//       for (const campo in files) {
//         const file = files[campo];
//         const fileArray = Array.isArray(file) ? file : [file];

//         try {
//           for (const f of fileArray) {
//             if (!f || !f.filepath) continue;

//             if (isProd) {
//               const driveLink = await uploadToGoogleDrive(f);
//               arquivos.push(driveLink);
//             } else {
//               const newFileName = `${Date.now()}-${f.originalFilename}`;
//               const newPath = path.join(uploadDir, newFileName);
//               console.log("Movendo arquivo:", f.filepath, "para:", newPath);
//               fs.renameSync(f.filepath, newPath);
//               arquivos.push(`/uploads/${newFileName}`);
//             }
//           }
//         } catch (uploadErr) {
//           console.error("Erro durante upload do campo", campo, uploadErr);
//           return res.status(500).json({
//             status: "erro",
//             message: "Erro durante upload",
//             detalhe: uploadErr.message
//           });
//         }
//       }

//       const db = await connectToDatabase(process.env.MONGODB_URI);
//       const dados = {
//         ...fields,
//         arquivos,
//         data_envio: new Date()
//       };

//       await db.collection("funcionarios").insertOne(dados);

//       res.status(200).json({
//         status: "ok",
//         recebidos: { fields, arquivos }
//       });
//     } catch (error) {
//       console.error("Erro interno:", error);
//       res.status(500).json({
//         status: "erro",
//         message: "Erro ao salvar ou processar dados.",
//         detalhe: error.message
//       });
//     }
//   });
// };





const formidable = require("formidable-serverless");
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
    return res.status(405).send("Método não permitido");
  }

  const form = new formidable.IncomingForm({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erro ao processar o formulário:", err);
      return res.status(400).send("Erro no envio.");
    }

    try {
      // Corrigir campos de data para o formato ISO
      const camposData = ["validade_cnh", "data_nascimento"];
      camposData.forEach(campo => {
        if (fields[campo]) {
          const data = new Date(fields[campo]);
          if (!isNaN(data)) {
            fields[campo] = data; // salvar como tipo Date no MongoDB
          }
        }
      });

      const db = await connectToDatabase(process.env.MONGODB_URI);
      const dados = {
        ...fields,
        arquivos: Object.keys(files),
        data_envio: new Date()
      };

      await db.collection("funcionarios").insertOne(dados);

      res.status(200).json({ status: "ok", recebidos: { fields, arquivos: Object.keys(files) } });
    } catch (error) {
      console.error("Erro interno:", error);
      res.status(500).json({
        status: "erro",
        message: "Erro ao salvar ou enviar email.",
        detalhe: error.message
      });
    }
  });
};
