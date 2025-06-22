const formidable = require("formidable-serverless");

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send("Método não permitido");
  }

  const form = new formidable.IncomingForm({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erro ao processar o formulário:", err);
      return res.status(400).send("Erro no envio.");
    }

    console.log("Campos recebidos:", fields);
    console.log("Arquivos recebidos:", Object.keys(files));

    return res.status(200).json({ status: "ok", recebidos: { fields, arquivos: Object.keys(files) } });
  });
};
