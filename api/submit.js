const formidable = require("formidable-serverless");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
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

  const uploadDir = path.resolve(__dirname, "../public/uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = new formidable.IncomingForm({
    multiples: true,
    keepExtensions: true,
    uploadDir
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erro ao processar o formulário:", err);
      return res.status(400).send("Erro no envio.");
    }

    try {
      // Corrigir datas
      const camposData = ["validade_cnh", "data_nascimento"];
      camposData.forEach(campo => {
        if (fields[campo]) {
          const data = new Date(fields[campo]);
          if (!isNaN(data)) fields[campo] = data;
        }
      });

      // Mover arquivos e montar links
      const arquivos = [];
      for (const campo in files) {
        const file = files[campo];
        const fileArray = Array.isArray(file) ? file : [file];
        for (const f of fileArray) {
          const newFileName = `${Date.now()}-${f.originalFilename}`;
          const newPath = path.join(uploadDir, newFileName);
          fs.renameSync(f.filepath, newPath);
          arquivos.push(`/uploads/${newFileName}`);
        }
      }

      const db = await connectToDatabase(process.env.MONGODB_URI);
      const dados = {
        ...fields,
        arquivos,
        data_envio: new Date()
      };

      await db.collection("funcionarios").insertOne(dados);

      res.status(200).json({
        status: "ok",
        recebidos: { fields, arquivos }
      });
    } catch (error) {
      console.error("Erro interno:", error);
      res.status(500).json({
        status: "erro",
        message: "Erro ao salvar ou processar dados.",
        detalhe: error.message
      });
    }
  });
};



// const formidable = require("formidable-serverless");
// const { MongoClient } = require("mongodb");
// const path = require("path");
// require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// let cachedDb = null;

// async function connectToDatabase(uri) {
//   if (cachedDb) return cachedDb;
//   const client = new MongoClient(uri);
//   await client.connect();
//   cachedDb = client.db();
//   return cachedDb;
// }

// module.exports = async (req, res) => {
//   if (req.method !== "POST") {
//     return res.status(405).send("Método não permitido");
//   }

//   const form = new formidable.IncomingForm({ multiples: true });

//   form.parse(req, async (err, fields, files) => {
//     if (err) {
//       console.error("Erro ao processar o formulário:", err);
//       return res.status(400).send("Erro no envio.");
//     }

//     try {
//       // Corrigir campos de data para o formato ISO
//       const camposData = ["validade_cnh", "data_nascimento"];
//       camposData.forEach(campo => {
//         if (fields[campo]) {
//           const data = new Date(fields[campo]);
//           if (!isNaN(data)) {
//             fields[campo] = data; // salvar como tipo Date no MongoDB
//           }
//         }
//       });

//       const db = await connectToDatabase(process.env.MONGODB_URI);
//       const dados = {
//         ...fields,
//         arquivos: Object.keys(files),
//         data_envio: new Date()
//       };

//       await db.collection("funcionarios").insertOne(dados);

//       res.status(200).json({ status: "ok", recebidos: { fields, arquivos: Object.keys(files) } });
//     } catch (error) {
//       console.error("Erro interno:", error);
//       res.status(500).json({
//         status: "erro",
//         message: "Erro ao salvar ou enviar email.",
//         detalhe: error.message
//       });
//     }
//   });
// };
