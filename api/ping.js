module.exports = (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API funcionando corretamente ✅",
    timestamp: new Date().toISOString()
  });
};
