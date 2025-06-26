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




// // /api/submit.js  – Node 18 (Vercel Serverless)
// // Função que recebe arquivos do formulário, faz upload para o Dropbox
// // e grava os links no MongoDB Atlas.

// // Dependências necessárias (já listadas no package.json):
// //   dotenv, formidable-serverless, dropbox, mongodb

// const { IncomingForm } = require("formidable-serverless");
// const fs = require("fs");
// const { Dropbox } = require("dropbox");
// const { MongoClient } = require("mongodb");
// require("dotenv").config();

// // -----------------------------------------------------------------------------
// // Configurações
// // -----------------------------------------------------------------------------
// // const dbx          = new Dropbox({ accessToken: process.env.ACCESS_TOKEN });
// const dbx = new Dropbox({
//   accessToken: process.env.ACCESS_TOKEN,
//   refreshToken: process.env.REFRESH_TOKEN,
//   clientId: process.env.APP_KEY,
//   clientSecret: process.env.APP_SECRET
// });
// // antes de qualquer chamada:
// await dbx.auth.checkAndRefreshAccessToken();

// const uploadFolder = process.env.UPLOAD_FOLDER || "/uploads";

// // Conexão Mongo com cache simples
// let cachedDb;
// async function getDb() {
//   if (cachedDb) return cachedDb;
//   const client = new MongoClient(process.env.MONGODB_URI);
//   await client.connect();
//   cachedDb = client.db();               // usa o database definido na URI
//   return cachedDb;
// }

// // Desativa o body parser padrão da Vercel
// module.exports.config = { api: { bodyParser: false } };

// // -----------------------------------------------------------------------------
// // Handler principal
// // -----------------------------------------------------------------------------
// module.exports.default = async function handler(req, res) {
//   if (req.method !== "POST") {
//     res.setHeader("Allow", ["POST"]);
//     return res.status(405).end("Método não permitido");
//   }

//   try {
//     const form = new IncomingForm({
//       multiples: true,
//       keepExtensions: true,
//       maxFileSize: 30 * 1024 * 1024        // 30 MB por arquivo (ajuste se preciso)
//     });

//     // Faz o parse do form
//     form.parse(req, async (err, fields, files) => {
//       console.log("===> Campos recebidos:", fields);
//       console.log("===> Arquivos recebidos:", files);

//       if (err) {
//         console.error("Erro durante parse:", err);
//         return res.status(400).json({ message: "Erro no envio", err });
//       }

//       const attachments = {};   // { nomeInput: urlDireta }

//       // -----------------------------------------------------------------------
//       // Upload de cada arquivo para o Dropbox
//       // -----------------------------------------------------------------------
//       console.log("===> Enviando arquivo:", file.originalFilename);

//       try {
//         console.log("===> Enviando arquivo:", file.originalFilename);
//         for (const campo in files) {
//           const lista = Array.isArray(files[campo]) ? files[campo] : [files[campo]];

//           // Uploads em paralelo quando há mais de um arquivo
//           await Promise.all(lista.map(async (file) => {
//             const tempPath = file.filepath || file.path; // compatível com versões
//             const dropboxPath = `${uploadFolder}/${Date.now()}_${file.originalFilename || file.name}`;

//             // 1) Upload usando stream (mais eficiente que buffer inteiro)
//             await dbx.filesUpload({
//               path: dropboxPath,
//               contents: fs.createReadStream(tempPath)
//             });

//             // 2) Gera link compartilhável (ou obtém link já existente)
//             let url;
//             try {
//               const linkRes = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
//               url = linkRes.result.url;
//             } catch {
//               const listRes = await dbx.sharingListSharedLinks({ path: dropboxPath, direct_only: true });
//               url = listRes.result.links[0]?.url;
//             }

//             if (url) attachments[campo] = url.replace("?dl=0", "?raw=1");

//             // Remove arquivo temporário
//             fs.unlink(tempPath, () => { });
//           }));
//         }
//       } catch (uploadErr) {
//         console.error("Erro no upload Dropbox:", uploadErr);
//         return res.status(500).json({ message: "Falha no upload", error: uploadErr });
//       }

//       // -----------------------------------------------------------------------
//       // Convertendo strings de data (opcional)
//       // -----------------------------------------------------------------------
//       ["validade_cnh", "data_nascimento"].forEach((k) => {
//         if (fields[k]) {
//           const d = new Date(fields[k]);
//           if (!isNaN(d)) fields[k] = d;
//         }
//       });

//       // -----------------------------------------------------------------------
//       // Gravando no MongoDB
//       // -----------------------------------------------------------------------
//       try {
//         const db = await getDb();
//         await db.collection("funcionarios").insertOne({
//           ...fields,
//           arquivos: attachments,
//           data_envio: new Date()
//         });
//       } catch (mongoErr) {
//         console.error("Erro ao gravar no Mongo:", mongoErr);
//         return res.status(500).json({ message: "Falha ao gravar", error: mongoErr });
//       }

//       // Sucesso!
//       return res.status(200).json({ status: "ok", links: attachments });
//     });
//   } catch (outer) {
//     console.error("Erro inesperado:", outer);
//     return res.status(500).json({ message: "Erro interno", error: outer });
//   }
// };
