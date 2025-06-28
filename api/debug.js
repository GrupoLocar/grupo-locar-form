const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

module.exports = (req, res) => {
  try {
    const env = {
      MONGODB_URI: process.env.MONGODB_URI ? "[definida]" : "[não definida]",
      EMAIL_USER: process.env.EMAIL_USER || "[não definida]",
      EMAIL_PASS: process.env.EMAIL_PASS ? "[definida]" : "[não definida]"
    };

    const publicPath = path.resolve(__dirname, "../public");
    const arquivosPublicos = fs.existsSync(publicPath)
      ? fs.readdirSync(publicPath)
      : ["[pasta public não encontrada]"];

    res.status(200).json({
      status: "ok",
      ambiente: env,
      arquivosEmPublic: arquivosPublicos,
    timestamp: DateTime.now().setZone("America/Sao_Paulo").toFormat("yyyy-LL-dd HH:mm:ss")
    });
  } catch (error) {
    res.status(500).json({
      status: "erro",
      mensagem: "Erro ao carregar variáveis ou arquivos.",
      detalhe: error.message
    });
  }
};
