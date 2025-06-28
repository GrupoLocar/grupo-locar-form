const { DateTime } = require("luxon");

module.exports = (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API funcionando corretamente ✅",
    timestamp: DateTime.now().setZone("America/Sao_Paulo").toFormat("yyyy-LL-dd HH:mm:ss")
  });
};
